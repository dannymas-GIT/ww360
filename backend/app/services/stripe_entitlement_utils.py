"""Shared helpers for Stripe product whitelist, grace windows, and seat map."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def parse_seat_map() -> dict[str, int]:
    raw = (settings.OWW_STRIPE_SEAT_MAP_JSON or "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return {}
        out: dict[str, int] = {}
        for key, val in data.items():
            try:
                out[str(key)] = int(val)
            except (TypeError, ValueError):
                continue
        return out
    except json.JSONDecodeError:
        logger.warning("Invalid OWW_STRIPE_SEAT_MAP_JSON; ignoring")
        return {}


def seat_limit_for(product_id: str | None, price_id: str | None) -> int | None:
    seats = parse_seat_map()
    if price_id and price_id in seats:
        return seats[price_id]
    if product_id and product_id in seats:
        return seats[product_id]
    return None


def is_eligible_product_price(product_id: str | None, price_id: str | None) -> bool:
    """Return True when product/price is whitelisted (or whitelist is empty = allow-all in dev)."""
    products = settings.oww_stripe_eligible_product_ids
    prices = settings.oww_stripe_eligible_price_ids
    if not products and not prices:
        # Empty whitelist: accept all (local/dev). Staging/prod must set env lists.
        return True
    if price_id and price_id in prices:
        return True
    if product_id and product_id in products:
        return True
    return False


def compute_grace_until(status: str, *, now: datetime | None = None) -> datetime | None:
    status_l = (status or "").lower()
    if status_l != "past_due":
        return None
    now = now or utcnow()
    days = max(1, int(settings.OWW_STRIPE_GRACE_DAYS or 14))
    return now + timedelta(days=days)


def evaluate_access(
    status: str,
    *,
    grace_until: datetime | None = None,
    current_period_end: datetime | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Map Stripe/org status + windows → access_mode / allows_write / allows_read."""
    now = now or utcnow()
    status_l = (status or "none").lower()

    if status_l in ("active", "trialing"):
        return {
            "status": status_l,
            "access_mode": "full",
            "allows_write": True,
            "allows_read": True,
            "is_active": True,
        }

    if status_l == "past_due":
        if grace_until and grace_until >= now:
            return {
                "status": status_l,
                "access_mode": "grace",
                "allows_write": True,
                "allows_read": True,
                "is_active": True,
            }
        # Grace exhausted → read-only export window from grace_until (or now)
        readonly_start = grace_until or now
        readonly_days = max(1, int(settings.OWW_STRIPE_READONLY_DAYS or 90))
        readonly_until = readonly_start + timedelta(days=readonly_days)
        if now <= readonly_until:
            return {
                "status": status_l,
                "access_mode": "readonly",
                "allows_write": False,
                "allows_read": True,
                "is_active": False,
            }
        return {
            "status": "archived",
            "access_mode": "archived",
            "allows_write": False,
            "allows_read": False,
            "is_active": False,
        }

    if status_l in ("canceled", "cancelled", "unpaid", "incomplete_expired"):
        # 90-day read-only from period end (or now)
        start = current_period_end or now
        readonly_days = max(1, int(settings.OWW_STRIPE_READONLY_DAYS or 90))
        readonly_until = start + timedelta(days=readonly_days)
        if now <= readonly_until:
            return {
                "status": status_l,
                "access_mode": "readonly",
                "allows_write": False,
                "allows_read": True,
                "is_active": False,
            }
        return {
            "status": "archived",
            "access_mode": "archived",
            "allows_write": False,
            "allows_read": False,
            "is_active": False,
        }

    return {
        "status": status_l or "none",
        "access_mode": "none",
        "allows_write": False,
        "allows_read": False,
        "is_active": False,
    }
