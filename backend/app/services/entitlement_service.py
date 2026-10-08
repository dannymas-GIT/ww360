"""Check whether an OWW-linked utility may use WW360 (Stripe via OWW, or grant program_code)."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.workforce_organization import (
    OrganizationDistrictMembership,
    WorkforceOrganization,
)

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, "EntitlementResult"]] = {}


@dataclass
class EntitlementResult:
    oww_org_id: str
    status: str
    stripe_customer_id: str | None = None
    source: str = "oww"  # oww | program_code | cache | unknown
    checked_at: str | None = None

    @property
    def is_active(self) -> bool:
        return self.status == "active"


def org_has_program_code(db: Session, org_code: str) -> bool:
    row = (
        db.query(OrganizationDistrictMembership)
        .filter(
            OrganizationDistrictMembership.org_code == org_code,
            OrganizationDistrictMembership.program_code.isnot(None),
            OrganizationDistrictMembership.program_code != "",
        )
        .first()
    )
    return row is not None


def entitlement_for_org(
    db: Session,
    *,
    org_code: str | None = None,
    oww_org_id: str | None = None,
) -> EntitlementResult:
    """Resolve entitlement by WW360 org_code and/or OWW org id."""
    org: WorkforceOrganization | None = None
    if org_code:
        org = db.query(WorkforceOrganization).filter(WorkforceOrganization.org_code == org_code).first()
    elif oww_org_id:
        org = (
            db.query(WorkforceOrganization)
            .filter(WorkforceOrganization.oww_org_id == str(oww_org_id))
            .first()
        )

    resolved_oww = (org.oww_org_id if org else None) or (str(oww_org_id) if oww_org_id else "")
    resolved_code = org.org_code if org else org_code

    if resolved_code and org_has_program_code(db, resolved_code):
        return EntitlementResult(
            oww_org_id=resolved_oww or resolved_code,
            status="active",
            stripe_customer_id=org.stripe_customer_id if org else None,
            source="program_code",
        )

    if not resolved_oww:
        return EntitlementResult(
            oww_org_id="",
            status="none",
            source="unknown",
        )

    return fetch_oww_entitlement(resolved_oww)


def fetch_oww_entitlement(oww_org_id: str) -> EntitlementResult:
    cache_key = str(oww_org_id)
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and cached[0] > now:
        result = cached[1]
        if result.is_active:
            return EntitlementResult(
                oww_org_id=result.oww_org_id,
                status=result.status,
                stripe_customer_id=result.stripe_customer_id,
                source="cache",
                checked_at=result.checked_at,
            )

    base = (settings.OWW_ENTITLEMENT_BASE_URL or "").rstrip("/")
    api_key = settings.OWW_API_KEY
    if not base or not api_key:
        logger.warning("OWW entitlement not configured; treating as none")
        return EntitlementResult(oww_org_id=cache_key, status="none", source="unknown")

    url = f"{base}/api/v1/integrations/ww360/entitlement"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                url,
                params={"oww_org_id": cache_key},
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
    except Exception as exc:
        logger.warning("OWW entitlement call failed for %s: %s", cache_key, exc)
        if cached:
            return cached[1]
        return EntitlementResult(oww_org_id=cache_key, status="none", source="unknown")

    status_val = str(data.get("status") or "none").lower()
    result = EntitlementResult(
        oww_org_id=str(data.get("oww_org_id") or cache_key),
        status=status_val,
        stripe_customer_id=data.get("stripe_customer_id"),
        source="oww",
        checked_at=data.get("checked_at"),
    )
    # Only cache active answers (per agreement).
    if result.is_active:
        ttl = max(60, int(settings.OWW_ENTITLEMENT_CACHE_SECONDS or 1800))
        _cache[cache_key] = (now + ttl, result)
    else:
        _cache.pop(cache_key, None)
    return result


def clear_entitlement_cache(oww_org_id: str | None = None) -> None:
    if oww_org_id is None:
        _cache.clear()
    else:
        _cache.pop(str(oww_org_id), None)
