"""Pluggable entitlement resolution for OWW-linked utilities.

Provider chain (first decisive hit wins):
  1. ProgramCodeProvider — grant / PO / complimentary via program_code
  2. AquaSafeModuleProvider — ext_module_flags ww360=true
  3. StripeCacheProvider — oww_stripe_entitlements (+ Redis TTL)
  4. OwwApiProvider — legacy OWW HTTP adapter when OWW_ENTITLEMENT_BASE_URL set
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import asdict, dataclass, field
from typing import Any

import httpx
from app.core.config import settings
from app.db.database import get_db
from app.models.stripe_entitlement import OwwStripeEntitlement
from app.models.sync import ExtModuleFlag
from app.models.workforce_organization import (
    OrganizationDistrictMembership,
    WorkforceOrganization,
)
from app.services.entitlement_redis import (
    entitlement_cache_key,
    redis_delete,
    redis_get_json,
    redis_set_json,
)
from app.services.stripe_entitlement_utils import evaluate_access, utcnow
from app.tenant_auth import TenantContext
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


@dataclass
class EntitlementResult:
    oww_org_id: str
    status: str
    stripe_customer_id: str | None = None
    source: str = "unknown"  # program_code | aquasafe | stripe_cache | oww | unknown
    checked_at: str | None = None
    access_mode: str = "none"  # full | grace | readonly | archived | none
    allows_write: bool = False
    allows_read: bool = False
    grace_until: str | None = None
    current_period_end: str | None = None
    org_code: str | None = None
    extras: dict[str, Any] = field(default_factory=dict)

    @property
    def is_active(self) -> bool:
        """True when the org has full or grace read/write access."""
        return bool(self.allows_write) or self.status in ("active", "trialing")

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "source": self.source,
            "access_mode": self.access_mode,
            "allows_write": self.allows_write,
            "allows_read": self.allows_read,
            "is_active": self.is_active,
            "grace_until": self.grace_until,
            "current_period_end": self.current_period_end,
            "stripe_customer_id": self.stripe_customer_id,
            "org_code": self.org_code,
        }


class EntitlementProvider(ABC):
    name: str = "base"

    @abstractmethod
    def resolve(
        self,
        db: Session,
        *,
        org: WorkforceOrganization | None,
        org_code: str | None,
        oww_org_id: str | None,
    ) -> EntitlementResult | None:
        """Return a result when this provider can decide; None to defer."""


class ProgramCodeProvider(EntitlementProvider):
    name = "program_code"

    def resolve(
        self,
        db: Session,
        *,
        org: WorkforceOrganization | None,
        org_code: str | None,
        oww_org_id: str | None,
    ) -> EntitlementResult | None:
        code = (org.org_code if org else None) or org_code
        if not code or not org_has_program_code(db, code):
            return None
        return EntitlementResult(
            oww_org_id=(org.oww_org_id if org else None) or oww_org_id or code,
            status="active",
            stripe_customer_id=org.stripe_customer_id if org else None,
            source="program_code",
            access_mode="full",
            allows_write=True,
            allows_read=True,
            org_code=code,
            checked_at=utcnow().isoformat(),
        )


class AquaSafeModuleProvider(EntitlementProvider):
    name = "aquasafe"

    def resolve(
        self,
        db: Session,
        *,
        org: WorkforceOrganization | None,
        org_code: str | None,
        oww_org_id: str | None,
    ) -> EntitlementResult | None:
        code = (org.org_code if org else None) or org_code
        districts: list[str] = []
        if code:
            districts = [
                m.district_code
                for m in db.query(OrganizationDistrictMembership)
                .filter(OrganizationDistrictMembership.org_code == code)
                .all()
            ]
        if not districts:
            return None
        flag = (
            db.query(ExtModuleFlag)
            .filter(
                ExtModuleFlag.district_code.in_(districts),
                ExtModuleFlag.module_key == "ww360",
                ExtModuleFlag.enabled.is_(True),
            )
            .first()
        )
        if not flag:
            return None
        return EntitlementResult(
            oww_org_id=(org.oww_org_id if org else None) or oww_org_id or code or "",
            status="active",
            stripe_customer_id=org.stripe_customer_id if org else None,
            source="aquasafe",
            access_mode="full",
            allows_write=True,
            allows_read=True,
            org_code=code,
            checked_at=utcnow().isoformat(),
        )


class StripeCacheProvider(EntitlementProvider):
    name = "stripe_cache"

    def resolve(
        self,
        db: Session,
        *,
        org: WorkforceOrganization | None,
        org_code: str | None,
        oww_org_id: str | None,
    ) -> EntitlementResult | None:
        cache_key = entitlement_cache_key(
            org_code=(org.org_code if org else None) or org_code,
            oww_org_id=oww_org_id or (org.oww_org_id if org else None),
        )
        cached = redis_get_json(cache_key)
        if cached and cached.get("source") == "stripe_cache":
            return _result_from_dict(cached)

        row: OwwStripeEntitlement | None = None
        if org and org.stripe_customer_id:
            row = (
                db.query(OwwStripeEntitlement)
                .filter(OwwStripeEntitlement.stripe_customer_id == org.stripe_customer_id)
                .first()
            )
        if row is None and org and org.org_code:
            row = (
                db.query(OwwStripeEntitlement)
                .filter(OwwStripeEntitlement.org_code == org.org_code)
                .first()
            )
        if row is None and org and org.stripe_subscription_id:
            row = (
                db.query(OwwStripeEntitlement)
                .filter(
                    OwwStripeEntitlement.stripe_subscription_id == org.stripe_subscription_id
                )
                .first()
            )

        # Fall back to org denormalized fields when cache row missing but org has status.
        if row is None and org and org.entitlement_status and org.entitlement_source == "stripe":
            access = evaluate_access(
                org.entitlement_status,
                grace_until=org.grace_until,
                current_period_end=org.current_period_end,
            )
            result = EntitlementResult(
                oww_org_id=org.oww_org_id or oww_org_id or org.org_code,
                status=str(access["status"]),
                stripe_customer_id=org.stripe_customer_id,
                source="stripe_cache",
                access_mode=str(access["access_mode"]),
                allows_write=bool(access["allows_write"]),
                allows_read=bool(access["allows_read"]),
                grace_until=org.grace_until.isoformat() if org.grace_until else None,
                current_period_end=(
                    org.current_period_end.isoformat() if org.current_period_end else None
                ),
                org_code=org.org_code,
                checked_at=utcnow().isoformat(),
            )
            redis_set_json(cache_key, _result_to_dict(result))
            return result

        if row is None:
            return None

        access = evaluate_access(
            row.status,
            grace_until=row.grace_until,
            current_period_end=row.current_period_end,
        )
        result = EntitlementResult(
            oww_org_id=(org.oww_org_id if org else None) or oww_org_id or row.stripe_customer_id,
            status=str(access["status"]),
            stripe_customer_id=row.stripe_customer_id,
            source="stripe_cache",
            access_mode=str(access["access_mode"]),
            allows_write=bool(access["allows_write"]),
            allows_read=bool(access["allows_read"]),
            grace_until=row.grace_until.isoformat() if row.grace_until else None,
            current_period_end=(
                row.current_period_end.isoformat() if row.current_period_end else None
            ),
            org_code=row.org_code or (org.org_code if org else org_code),
            checked_at=utcnow().isoformat(),
        )
        redis_set_json(cache_key, _result_to_dict(result))
        return result


class OwwApiProvider(EntitlementProvider):
    name = "oww"

    def resolve(
        self,
        db: Session,
        *,
        org: WorkforceOrganization | None,
        org_code: str | None,
        oww_org_id: str | None,
    ) -> EntitlementResult | None:
        base = (settings.OWW_ENTITLEMENT_BASE_URL or "").rstrip("/")
        api_key = settings.OWW_API_KEY
        if not base or not api_key:
            return None
        resolved = (org.oww_org_id if org else None) or (str(oww_org_id) if oww_org_id else "")
        if not resolved:
            return None
        return fetch_oww_entitlement(resolved)


def default_providers() -> Sequence[EntitlementProvider]:
    return (
        ProgramCodeProvider(),
        AquaSafeModuleProvider(),
        StripeCacheProvider(),
        OwwApiProvider(),
    )


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


def _resolve_org(
    db: Session,
    *,
    org_code: str | None,
    oww_org_id: str | None,
) -> WorkforceOrganization | None:
    if org_code:
        return db.query(WorkforceOrganization).filter(WorkforceOrganization.org_code == org_code).first()
    if oww_org_id:
        return (
            db.query(WorkforceOrganization)
            .filter(WorkforceOrganization.oww_org_id == str(oww_org_id))
            .first()
        )
    return None


def entitlement_for_org(
    db: Session,
    *,
    org_code: str | None = None,
    oww_org_id: str | None = None,
    providers: Sequence[EntitlementProvider] | None = None,
) -> EntitlementResult:
    """Resolve entitlement by WW360 org_code and/or OWW org id via provider chain."""
    org = _resolve_org(db, org_code=org_code, oww_org_id=oww_org_id)
    resolved_oww = (org.oww_org_id if org else None) or (str(oww_org_id) if oww_org_id else "")
    resolved_code = org.org_code if org else org_code

    for provider in providers or default_providers():
        try:
            result = provider.resolve(
                db, org=org, org_code=resolved_code, oww_org_id=resolved_oww or oww_org_id
            )
        except Exception as exc:
            logger.warning("Entitlement provider %s failed: %s", provider.name, exc)
            continue
        if result is not None:
            return result

    return EntitlementResult(
        oww_org_id=resolved_oww or "",
        status="none",
        source="unknown",
        access_mode="none",
        allows_write=False,
        allows_read=False,
        org_code=resolved_code,
        checked_at=utcnow().isoformat(),
    )


def fetch_oww_entitlement(oww_org_id: str) -> EntitlementResult:
    cache_key = entitlement_cache_key(oww_org_id=str(oww_org_id))
    cached = redis_get_json(cache_key)
    if cached and cached.get("is_active"):
        return _result_from_dict(cached)

    base = (settings.OWW_ENTITLEMENT_BASE_URL or "").rstrip("/")
    api_key = settings.OWW_API_KEY
    if not base or not api_key:
        logger.warning("OWW entitlement not configured; treating as none")
        return EntitlementResult(
            oww_org_id=str(oww_org_id),
            status="none",
            source="unknown",
            access_mode="none",
        )

    url = f"{base}/api/v1/integrations/ww360/entitlement"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                url,
                params={"oww_org_id": str(oww_org_id)},
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
    except Exception as exc:
        logger.warning("OWW entitlement call failed for %s: %s", oww_org_id, exc)
        if cached:
            return _result_from_dict(cached)
        return EntitlementResult(
            oww_org_id=str(oww_org_id),
            status="none",
            source="unknown",
            access_mode="none",
        )

    status_val = str(data.get("status") or "none").lower()
    access = evaluate_access(status_val)
    result = EntitlementResult(
        oww_org_id=str(data.get("oww_org_id") or oww_org_id),
        status=str(access["status"]),
        stripe_customer_id=data.get("stripe_customer_id"),
        source="oww",
        checked_at=data.get("checked_at") or utcnow().isoformat(),
        access_mode=str(access["access_mode"]),
        allows_write=bool(access["allows_write"]),
        allows_read=bool(access["allows_read"]),
    )
    if result.is_active:
        redis_set_json(cache_key, _result_to_dict(result), ttl=int(settings.OWW_ENTITLEMENT_CACHE_SECONDS or 1800))
    else:
        redis_delete(cache_key)
    return result


def clear_entitlement_cache(oww_org_id: str | None = None, org_code: str | None = None) -> None:
    if org_code:
        redis_delete(entitlement_cache_key(org_code=org_code))
    if oww_org_id:
        redis_delete(entitlement_cache_key(oww_org_id=oww_org_id))
    if oww_org_id is None and org_code is None:
        # Best-effort: no global flush without Redis SCAN; callers invalidate by key.
        return


def invalidate_org_entitlement(db: Session, org_code: str | None, stripe_customer_id: str | None = None) -> None:
    clear_entitlement_cache(org_code=org_code)
    if stripe_customer_id:
        redis_delete(f"ww360:entitlement:stripe:{stripe_customer_id}")


def sync_org_from_entitlement_row(db: Session, row: OwwStripeEntitlement) -> None:
    """Mirror entitlement row onto linked workforce_organizations."""
    if not row.org_code:
        return
    org = (
        db.query(WorkforceOrganization)
        .filter(WorkforceOrganization.org_code == row.org_code)
        .first()
    )
    if not org:
        return
    access = evaluate_access(
        row.status,
        grace_until=row.grace_until,
        current_period_end=row.current_period_end,
    )
    org.stripe_customer_id = row.stripe_customer_id
    org.stripe_subscription_id = row.stripe_subscription_id
    org.entitlement_status = str(access["status"])
    org.entitlement_source = "stripe"
    org.current_period_end = row.current_period_end
    org.grace_until = row.grace_until
    org.seat_limit = row.seat_limit
    invalidate_org_entitlement(db, row.org_code, row.stripe_customer_id)


def _result_to_dict(result: EntitlementResult) -> dict[str, Any]:
    data = asdict(result)
    data["is_active"] = result.is_active
    return data


def _result_from_dict(data: dict[str, Any]) -> EntitlementResult:
    return EntitlementResult(
        oww_org_id=str(data.get("oww_org_id") or ""),
        status=str(data.get("status") or "none"),
        stripe_customer_id=data.get("stripe_customer_id"),
        source=str(data.get("source") or "cache"),
        checked_at=data.get("checked_at"),
        access_mode=str(data.get("access_mode") or "none"),
        allows_write=bool(data.get("allows_write")),
        allows_read=bool(data.get("allows_read")),
        grace_until=data.get("grace_until"),
        current_period_end=data.get("current_period_end"),
        org_code=data.get("org_code"),
        extras=data.get("extras") or {},
    )


# --- FastAPI dependency: block mutating requests in read-only / archived mode ---

_WRITE_ALLOW_PREFIXES = (
    "/api/v1/auth/",
    "/api/v1/webhooks/",
    "/api/v1/impersonation/",
    "/api/v1/public/",
)

_EXPORT_ALLOW_SUBSTRINGS = (
    "/export",
    "/download",
    "/ceu",
    "/doh-352",
    "/sop",
)


def require_entitlement_write(
    request: Request,
    context: TenantContext,
    db: Session = Depends(get_db),
) -> EntitlementResult:
    """Reject mutating calls when the active org is in read-only export or archived."""
    method = request.method.upper()
    if method in ("GET", "HEAD", "OPTIONS"):
        return entitlement_for_org(db, org_code=context.active_org_code)

    path = request.url.path
    if any(path.startswith(p) for p in _WRITE_ALLOW_PREFIXES):
        return entitlement_for_org(db, org_code=context.active_org_code)
    if any(s in path.lower() for s in _EXPORT_ALLOW_SUBSTRINGS):
        return entitlement_for_org(db, org_code=context.active_org_code)

    # Platform admins always write.
    if "platform_admin" in set(context.roles or []):
        return EntitlementResult(
            oww_org_id="",
            status="active",
            source="platform_admin",
            access_mode="full",
            allows_write=True,
            allows_read=True,
        )

    org_code = context.active_org_code
    if not org_code:
        return EntitlementResult(
            oww_org_id="",
            status="none",
            source="unknown",
            access_mode="none",
            allows_write=True,  # no org context → do not block (district-only users)
            allows_read=True,
        )

    result = entitlement_for_org(db, org_code=org_code)
    if result.access_mode in ("readonly", "archived") or (
        not result.allows_write and result.source in ("stripe_cache", "oww")
    ):
        if result.access_mode == "readonly" or result.allows_read:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "code": "entitlement_readonly",
                    "message": (
                        "Membership is past due or canceled. "
                        "You can export CEU / DOH-352 / SOP records for 90 days, "
                        "but edits are blocked until billing is restored."
                    ),
                    "access_mode": result.access_mode,
                    "status": result.status,
                },
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "entitlement_archived",
                "message": "Membership access has expired. Contact OWW support.",
                "access_mode": result.access_mode,
                "status": result.status,
            },
        )
    return result
