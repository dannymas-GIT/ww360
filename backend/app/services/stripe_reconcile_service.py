"""Nightly Stripe reconcile + past_due reminder emails (read-only restricted key)."""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

from app.core.advisory_lock import pg_try_advisory_lock
from app.core.config import settings
from app.models.stripe_entitlement import OwwStripeEntitlement
from app.models.user import User
from app.models.workforce_organization import OrganizationUserMembership, WorkforceOrganization
from app.services.email_service import EmailService
from app.services.entitlement_service import sync_org_from_entitlement_row
from app.services.stripe_entitlement_utils import (
    compute_grace_until,
    is_eligible_product_price,
    seat_limit_for,
    utcnow,
)
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

ADVISORY_LOCK_KEY = 360_600_001  # WW360 Stripe reconcile


def _stripe_client():
    key = (settings.OWW_STRIPE_RESTRICTED_KEY or "").strip()
    if not key:
        return None
    import stripe

    stripe.api_key = key
    return stripe


def _extract_product_price(sub: Any) -> tuple[str | None, str | None]:
    if isinstance(sub, dict):
        items = sub.get("items") or {}
        data = items.get("data") if isinstance(items, dict) else []
    else:
        items = getattr(sub, "items", None)
        if items is None:
            data = []
        elif isinstance(items, dict):
            data = items.get("data") or []
        else:
            data = getattr(items, "data", None) or []
    if not data:
        return None, None
    first = data[0]
    if isinstance(first, dict):
        price = first.get("price")
    else:
        price = getattr(first, "price", None)
    if price is None:
        return None, None
    if isinstance(price, str):
        return None, price
    if isinstance(price, dict):
        price_id = price.get("id")
        product = price.get("product")
    else:
        price_id = getattr(price, "id", None)
        product = getattr(price, "product", None)
    if isinstance(product, str):
        product_id = product
    elif isinstance(product, dict):
        product_id = product.get("id")
    elif product is not None:
        product_id = getattr(product, "id", None)
    else:
        product_id = None
    return product_id, price_id


def apply_subscription_snapshot(
    db: Session,
    *,
    customer_id: str,
    subscription_id: str | None,
    status: str,
    product_id: str | None,
    price_id: str | None,
    period_end: datetime | None,
    cancel_at_period_end: bool,
    billing_email: str | None = None,
    customer_name: str | None = None,
) -> OwwStripeEntitlement | None:
    if not is_eligible_product_price(product_id, price_id):
        return None
    import uuid

    row = (
        db.query(OwwStripeEntitlement)
        .filter(OwwStripeEntitlement.stripe_customer_id == customer_id)
        .first()
    )
    if row is None:
        row = OwwStripeEntitlement(
            id=str(uuid.uuid4()),
            stripe_customer_id=customer_id,
            status=status,
        )
        db.add(row)
    row.stripe_subscription_id = subscription_id or row.stripe_subscription_id
    row.status = status
    row.product_id = product_id or row.product_id
    row.price_id = price_id or row.price_id
    row.current_period_end = period_end
    row.cancel_at_period_end = cancel_at_period_end
    row.grace_until = compute_grace_until(status)
    row.seat_limit = seat_limit_for(row.product_id, row.price_id)
    if billing_email:
        row.billing_email = billing_email.lower().strip()
    if customer_name:
        row.customer_name = customer_name
    row.last_synced_at = utcnow()
    sync_org_from_entitlement_row(db, row)
    return row


def reconcile_from_stripe(
    db: Session,
    *,
    dry_run: bool = False,
    list_subscriptions: Callable[..., Any] | None = None,
) -> dict[str, Any]:
    """Pull whitelisted subscriptions via restricted key (or injected mock)."""
    stats = {"seen": 0, "upserted": 0, "skipped": 0, "dry_run": dry_run, "errors": 0}

    def _default_list(**kwargs):
        stripe = _stripe_client()
        if stripe is None:
            raise RuntimeError("OWW_STRIPE_RESTRICTED_KEY not configured")
        return stripe.Subscription.list(**kwargs)

    lister = list_subscriptions or _default_list
    starting_after = None
    highest: dict[str, Any] = {}

    while True:
        params: dict[str, Any] = {"limit": 100, "status": "all", "expand": ["data.customer"]}
        if starting_after:
            params["starting_after"] = starting_after
        page = lister(**params)
        data = getattr(page, "data", None) or page.get("data") or []
        if not data:
            break
        for sub in data:
            stats["seen"] += 1
            product_id, price_id = _extract_product_price(sub)
            if not is_eligible_product_price(product_id, price_id):
                stats["skipped"] += 1
                continue
            customer = getattr(sub, "customer", None)
            if customer is None and isinstance(sub, dict):
                customer = sub.get("customer")
            if isinstance(customer, str):
                customer_id = customer
                billing_email = None
                customer_name = None
            elif customer is not None:
                customer_id = getattr(customer, "id", None) or customer.get("id")
                billing_email = getattr(customer, "email", None) or customer.get("email")
                customer_name = getattr(customer, "name", None) or customer.get("name")
            else:
                stats["skipped"] += 1
                continue
            status_val = getattr(sub, "status", None) or sub.get("status")
            # Keep highest-privilege status per customer (active > trialing > past_due > …)
            rank = {"active": 5, "trialing": 4, "past_due": 3, "unpaid": 2, "canceled": 1}.get(
                str(status_val), 0
            )
            prev = highest.get(str(customer_id))
            if prev and prev["rank"] >= rank:
                continue
            period_end_raw = getattr(sub, "current_period_end", None) or (
                sub.get("current_period_end") if isinstance(sub, dict) else None
            )
            period_end = (
                datetime.utcfromtimestamp(int(period_end_raw)) if period_end_raw else None
            )
            highest[str(customer_id)] = {
                "rank": rank,
                "customer_id": str(customer_id),
                "subscription_id": getattr(sub, "id", None) or sub.get("id"),
                "status": str(status_val),
                "product_id": product_id,
                "price_id": price_id,
                "period_end": period_end,
                "cancel_at_period_end": bool(
                    getattr(sub, "cancel_at_period_end", None)
                    or (sub.get("cancel_at_period_end") if isinstance(sub, dict) else False)
                ),
                "billing_email": billing_email,
                "customer_name": customer_name,
            }
        has_more = getattr(page, "has_more", None)
        if has_more is None and isinstance(page, dict):
            has_more = page.get("has_more")
        if not has_more:
            break
        starting_after = getattr(data[-1], "id", None) or data[-1].get("id")

    if dry_run:
        stats["would_upsert"] = len(highest)
        return stats

    for snap in highest.values():
        try:
            apply_subscription_snapshot(
                db,
                customer_id=snap["customer_id"],
                subscription_id=snap["subscription_id"],
                status=snap["status"],
                product_id=snap["product_id"],
                price_id=snap["price_id"],
                period_end=snap["period_end"],
                cancel_at_period_end=snap["cancel_at_period_end"],
                billing_email=snap.get("billing_email"),
                customer_name=snap.get("customer_name"),
            )
            stats["upserted"] += 1
        except Exception as exc:
            logger.warning("Reconcile upsert failed for %s: %s", snap.get("customer_id"), exc)
            stats["errors"] += 1
    db.commit()
    return stats


def send_past_due_reminders(db: Session) -> dict[str, int]:
    """Day 1 / 7 / 12 reminders to district_admins for orgs in past_due grace."""
    stats = {"candidates": 0, "sent": 0}
    now = utcnow()
    rows = (
        db.query(OwwStripeEntitlement)
        .filter(
            OwwStripeEntitlement.status == "past_due",
            OwwStripeEntitlement.grace_until.isnot(None),
            OwwStripeEntitlement.grace_until >= now,
            OwwStripeEntitlement.org_code.isnot(None),
        )
        .all()
    )
    mailer = EmailService()
    grace_days = max(1, int(settings.OWW_STRIPE_GRACE_DAYS or 14))
    for row in rows:
        stats["candidates"] += 1
        # Approximate "day N of grace" from grace_until - grace_days
        grace_start = row.grace_until - timedelta(days=grace_days) if row.grace_until else now
        day_n = (now.date() - grace_start.date()).days + 1
        if day_n not in (1, 7, 12):
            continue
        memberships = (
            db.query(OrganizationUserMembership)
            .filter(
                OrganizationUserMembership.org_code == row.org_code,
                OrganizationUserMembership.role.in_(["district_admin", "state_admin"]),
            )
            .all()
        )
        org = (
            db.query(WorkforceOrganization)
            .filter(WorkforceOrganization.org_code == row.org_code)
            .first()
        )
        for m in memberships:
            user = db.query(User).filter(User.id == m.user_id).first()
            if not user or not user.email:
                continue
            subject = f"WW360 membership past due (day {day_n}) — update billing"
            body = (
                f"Hello {user.full_name or user.username},\n\n"
                f"The OWW membership for {org.name if org else row.org_code} is past due "
                f"(day {day_n} of {grace_days}). Please update billing with One Water Workforce "
                f"to keep full access. After day {grace_days}, the workspace becomes "
                f"read-only export for {settings.OWW_STRIPE_READONLY_DAYS} days "
                f"(CEU records are never deleted).\n\n"
                f"— Water Workforce 360\n"
            )
            try:
                if mailer.send_email(
                    to_emails=[user.email], subject=subject, body_text=body
                ):
                    stats["sent"] += 1
            except Exception as exc:
                logger.warning("past_due reminder failed for %s: %s", user.email, exc)
    return stats


def run_nightly_stripe_jobs(db: Session) -> dict[str, Any]:
    if not settings.OWW_STRIPE_RECONCILE_ENABLED:
        return {"skipped": True, "reason": "disabled"}
    with pg_try_advisory_lock(db, ADVISORY_LOCK_KEY) as acquired:
        if not acquired:
            return {"skipped": True, "reason": "lock_held"}
        reconcile_stats: dict[str, Any] = {"skipped": True, "reason": "no_key"}
        if (settings.OWW_STRIPE_RESTRICTED_KEY or "").strip():
            try:
                reconcile_stats = reconcile_from_stripe(db, dry_run=False)
            except Exception as exc:
                logger.warning("Stripe reconcile failed: %s", exc)
                reconcile_stats = {"errors": 1, "message": str(exc)}
        reminders = send_past_due_reminders(db)
        return {"reconcile": reconcile_stats, "reminders": reminders}
