"""Process signed Stripe webhook events into oww_stripe_entitlements."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from app.models.stripe_entitlement import OwwStripeEntitlement, StripeWebhookEvent
from app.services.entitlement_service import sync_org_from_entitlement_row
from app.services.stripe_entitlement_utils import (
    compute_grace_until,
    is_eligible_product_price,
    seat_limit_for,
    utcnow,
)
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

HANDLED_TYPES = {
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "customer.updated",
}


def _ts_to_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.utcfromtimestamp(int(value))
    except (TypeError, ValueError, OSError):
        return None


def _extract_product_price(sub_obj: dict[str, Any]) -> tuple[str | None, str | None]:
    items = (sub_obj.get("items") or {}).get("data") or []
    if not items:
        return None, None
    price = items[0].get("price") or {}
    if isinstance(price, str):
        return None, price
    price_id = price.get("id")
    product = price.get("product")
    product_id = product if isinstance(product, str) else (product or {}).get("id")
    return product_id, price_id


def process_stripe_event(db: Session, event: dict[str, Any]) -> dict[str, Any]:
    """Idempotently apply a verified Stripe event. Returns a small status dict."""
    event_id = str(event.get("id") or "")
    event_type = str(event.get("type") or "")
    created = event.get("created")
    if not event_id:
        return {"ok": False, "reason": "missing_event_id"}

    existing = db.query(StripeWebhookEvent).filter(StripeWebhookEvent.event_id == event_id).first()
    if existing:
        return {"ok": True, "deduplicated": True, "event_id": event_id}

    if event_type not in HANDLED_TYPES:
        db.add(
            StripeWebhookEvent(
                event_id=event_id,
                event_type=event_type,
                stripe_created_at=int(created) if created else None,
            )
        )
        db.commit()
        return {"ok": True, "ignored": True, "reason": "unhandled_type", "event_id": event_id}

    data_obj = (event.get("data") or {}).get("object") or {}
    result = _apply_object(db, event_type=event_type, created=created, obj=data_obj)
    if result.get("stale"):
        # Still record the event so Stripe retries don't loop; state unchanged.
        db.add(
            StripeWebhookEvent(
                event_id=event_id,
                event_type=event_type,
                stripe_created_at=int(created) if created else None,
            )
        )
        db.commit()
        return result

    db.add(
        StripeWebhookEvent(
            event_id=event_id,
            event_type=event_type,
            stripe_created_at=int(created) if created else None,
        )
    )
    db.commit()
    result["event_id"] = event_id
    return result


def _apply_object(
    db: Session,
    *,
    event_type: str,
    created: Any,
    obj: dict[str, Any],
) -> dict[str, Any]:
    created_i = int(created) if created is not None else None

    if event_type == "customer.updated":
        customer_id = obj.get("id")
        if not customer_id:
            return {"ok": True, "ignored": True, "reason": "no_customer"}
        row = (
            db.query(OwwStripeEntitlement)
            .filter(OwwStripeEntitlement.stripe_customer_id == customer_id)
            .first()
        )
        if not row:
            return {"ok": True, "ignored": True, "reason": "unknown_customer"}
        if (
            created_i is not None
            and row.last_event_created_at
            and created_i < row.last_event_created_at
        ):
            return {"ok": True, "stale": True, "reason": "out_of_order"}
        email = (obj.get("email") or "").strip().lower() or None
        if email:
            row.billing_email = email
        row.customer_name = obj.get("name") or row.customer_name
        row.last_event_created_at = created_i or row.last_event_created_at
        row.last_synced_at = utcnow()
        sync_org_from_entitlement_row(db, row)
        return {"ok": True, "updated": "customer"}

    if event_type == "checkout.session.completed":
        customer_id = obj.get("customer")
        subscription_id = obj.get("subscription")
        email = (obj.get("customer_email") or obj.get("customer_details", {}).get("email") or "")
        email = email.strip().lower() or None
        if not customer_id:
            return {"ok": True, "ignored": True, "reason": "no_customer"}
        # Metadata may carry product hints; eligibility checked when subscription events arrive.
        row = _upsert_row(
            db,
            customer_id=str(customer_id),
            subscription_id=str(subscription_id) if subscription_id else None,
            billing_email=email,
            status="active",
            product_id=None,
            price_id=None,
            period_end=None,
            cancel_at_period_end=False,
            created_i=created_i,
            require_whitelist=False,
        )
        if row is None:
            return {"ok": True, "ignored": True, "reason": "not_eligible"}
        if isinstance(row, dict) and row.get("stale"):
            return row
        return {"ok": True, "updated": "checkout"}

    if event_type.startswith("customer.subscription.") or event_type in (
        "invoice.payment_succeeded",
        "invoice.payment_failed",
    ):
        sub = obj
        if event_type.startswith("invoice."):
            # Prefer expanded subscription object; else look up by subscription id on row.
            sub_field = obj.get("subscription")
            if isinstance(sub_field, dict):
                sub = sub_field
            else:
                customer_id = obj.get("customer")
                subscription_id = sub_field
                status_hint = "active" if event_type.endswith("succeeded") else "past_due"
                if not customer_id:
                    return {"ok": True, "ignored": True, "reason": "no_customer"}
                row = _upsert_row(
                    db,
                    customer_id=str(customer_id),
                    subscription_id=str(subscription_id) if subscription_id else None,
                    billing_email=(obj.get("customer_email") or "").strip().lower() or None,
                    status=status_hint,
                    product_id=None,
                    price_id=None,
                    period_end=_ts_to_dt(obj.get("period_end")),
                    cancel_at_period_end=False,
                    created_i=created_i,
                    require_whitelist=False,
                )
                if isinstance(row, dict) and row.get("stale"):
                    return row
                return {"ok": True, "updated": "invoice"}

        customer_id = sub.get("customer")
        subscription_id = sub.get("id")
        if not customer_id:
            return {"ok": True, "ignored": True, "reason": "no_customer"}
        product_id, price_id = _extract_product_price(sub)
        if not is_eligible_product_price(product_id, price_id):
            # Ignore non-WW360 catalog items (conference tickets, donations).
            return {"ok": True, "ignored": True, "reason": "not_whitelisted"}

        status_val = str(sub.get("status") or "none").lower()
        if event_type == "customer.subscription.deleted":
            status_val = "canceled"

        row = _upsert_row(
            db,
            customer_id=str(customer_id),
            subscription_id=str(subscription_id) if subscription_id else None,
            billing_email=None,
            status=status_val,
            product_id=product_id,
            price_id=price_id,
            period_end=_ts_to_dt(sub.get("current_period_end")),
            cancel_at_period_end=bool(sub.get("cancel_at_period_end")),
            created_i=created_i,
            require_whitelist=True,
            customer_name=None,
        )
        if row is None:
            return {"ok": True, "ignored": True, "reason": "not_eligible"}
        if isinstance(row, dict) and row.get("stale"):
            return row
        return {"ok": True, "updated": "subscription", "status": status_val}

    return {"ok": True, "ignored": True}


def _upsert_row(
    db: Session,
    *,
    customer_id: str,
    subscription_id: str | None,
    billing_email: str | None,
    status: str,
    product_id: str | None,
    price_id: str | None,
    period_end: datetime | None,
    cancel_at_period_end: bool,
    created_i: int | None,
    require_whitelist: bool,
    customer_name: str | None = None,
) -> OwwStripeEntitlement | dict[str, Any] | None:
    if require_whitelist and product_id is None and price_id is None:
        # Allow status updates for known customers even without items payload.
        pass
    elif require_whitelist and not is_eligible_product_price(product_id, price_id):
        return None

    row = (
        db.query(OwwStripeEntitlement)
        .filter(OwwStripeEntitlement.stripe_customer_id == customer_id)
        .with_for_update()
        .first()
    )
    if row is None and subscription_id:
        row = (
            db.query(OwwStripeEntitlement)
            .filter(OwwStripeEntitlement.stripe_subscription_id == subscription_id)
            .with_for_update()
            .first()
        )

    if (
        row
        and created_i is not None
        and row.last_event_created_at
        and created_i < row.last_event_created_at
    ):
        return {"ok": True, "stale": True, "reason": "out_of_order"}

    if row is None:
        import uuid

        row = OwwStripeEntitlement(
            id=str(uuid.uuid4()),
            stripe_customer_id=customer_id,
            status=status,
        )
        db.add(row)

    row.stripe_customer_id = customer_id
    if subscription_id:
        row.stripe_subscription_id = subscription_id
    if billing_email:
        row.billing_email = billing_email
    if customer_name:
        row.customer_name = customer_name
    if product_id:
        row.product_id = product_id
    if price_id:
        row.price_id = price_id
    row.status = status
    row.current_period_end = period_end if period_end is not None else row.current_period_end
    row.cancel_at_period_end = cancel_at_period_end
    row.grace_until = compute_grace_until(status)
    row.seat_limit = seat_limit_for(row.product_id, row.price_id)
    if created_i is not None:
        row.last_event_created_at = created_i
    row.last_synced_at = utcnow()
    sync_org_from_entitlement_row(db, row)
    db.flush()
    return row
