"""OWW ↔ Water Workforce 360 integration endpoints."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.workforce_organization import WorkforceOrganization
from app.models.workforce_succession import WorkforcePosition, WorkforceEmployee
from app.services.oww_handoff_service import process_handoff, record_referral, redeem_handoff_code

logger = logging.getLogger(__name__)
router = APIRouter()


class OwwHandoffBody(BaseModel):
    """Utility administrator handoff, or platform_admin handoff (Jenny / OWW platform)."""

    oww_user_id: str = Field(..., min_length=1, max_length=64)
    email: str = Field(..., min_length=3, max_length=255)
    full_name: str = Field(..., min_length=1, max_length=255)
    # utility handoff fields (optional when handoff_kind=platform_admin)
    oww_org_id: str | None = Field(default=None, max_length=64)
    utility_name: str | None = Field(default=None, max_length=255)
    is_billing_admin: bool = True
    subscription_status: str = Field(default="none", max_length=32)
    stripe_customer_id: str | None = Field(default=None, max_length=120)
    state_code: str | None = Field(default="NY", max_length=2)
    program_code: str | None = Field(default=None, max_length=64)
    handoff_kind: str = Field(default="utility", max_length=32)
    next: str | None = Field(default=None, max_length=255)


class OwwRedeemBody(BaseModel):
    code: str = Field(..., min_length=8, max_length=128)


class OwwReferralBody(BaseModel):
    oww_referral_id: str = Field(..., min_length=1, max_length=64)
    oww_org_id: str = Field(..., min_length=1, max_length=64)
    district_code: str | None = None
    candidate_label: str | None = None
    job_title: str | None = None
    status: str = "received"


def _require_oww_service_token(
    authorization: str | None = Header(default=None),
) -> None:
    token = settings.OWW_SERVICE_TOKEN
    if not token:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="OWW integration not configured")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    provided = authorization.split(" ", 1)[1].strip()
    if not hmac.compare_digest(provided, token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid service token")


def _verify_oww_hmac(body: bytes, signature: str | None) -> None:
    secret = settings.OWW_HMAC_SECRET
    if not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="OWW HMAC not configured")
    if not signature:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing X-OWW-Signature")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")


@router.post("/integrations/oww/handoff")
def oww_handoff(
    body: OwwHandoffBody,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """OWW server posts utility administrator or platform admin identity; returns one-time redirect URL."""
    _require_oww_service_token(authorization)
    data = body.model_dump()
    kind = str(data.get("handoff_kind") or "utility").lower()
    if kind not in ("platform", "platform_admin") and not data.get("oww_org_id"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="oww_org_id required for utility handoff")
    if kind not in ("platform", "platform_admin") and not data.get("utility_name"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="utility_name required for utility handoff")
    return process_handoff(db, data)


@router.post("/auth/oww/redeem")
def oww_redeem(body: OwwRedeemBody, db: Session = Depends(get_db)):
    """Browser exchanges one-time OWW handoff code for a WW360 JWT."""
    return redeem_handoff_code(db, body.code)


@router.get("/integrations/oww/employer-needs")
def employer_needs(
    region: str | None = Query(None),
    oww_org_id: str | None = Query(None),
    db: Session = Depends(get_db),
    x_oww_signature: str | None = Header(default=None, alias="X-OWW-Signature"),
):
    """HMAC-signed employer workforce needs for OWW matching."""
    probe = {"region": region, "oww_org_id": oww_org_id}
    raw = json.dumps(probe, sort_keys=True).encode()
    _verify_oww_hmac(raw, x_oww_signature)

    q = db.query(WorkforceOrganization).filter(
        WorkforceOrganization.oww_org_id.isnot(None),
        WorkforceOrganization.is_active.is_(True),
    )
    if oww_org_id:
        q = q.filter(WorkforceOrganization.oww_org_id == oww_org_id)
    orgs = q.all()

    needs: list[dict[str, Any]] = []
    for org in orgs:
        # Positions linked via district memberships would be ideal; until districts
        # are linked, surface org-level vacancy flags from any district the utility admin
        # may manage is deferred — return org stub with vacant position counts when
        # district_memberships exist on users of this org.
        vacant = 0
        anticipated = 0
        # Best-effort: count vacant positions if districts share naming with org.
        # Full wiring lands with CFG grant fields + district links.
        needs.append(
            {
                "oww_org_id": org.oww_org_id,
                "ww360_org_id": org.org_code,
                "utility_name": org.name,
                "state_code": org.state_code,
                "region": region,
                "vacant_positions": vacant,
                "anticipated_vacancies": anticipated,
                "required_qualifications": [],
            }
        )

    # Enrich from global vacant positions when a single org is requested and we have
    # district codes on linked users — keep payload honest about zeros for now.
    _ = (WorkforcePosition, WorkforceEmployee)

    payload = {"needs": needs, "count": len(needs)}
    return payload


@router.post("/integrations/oww/referrals")
def oww_referrals(
    body: OwwReferralBody,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """OWW acknowledges a candidate referral to a utility."""
    _require_oww_service_token(authorization)
    row = record_referral(db, body.model_dump())
    return {
        "id": row.id,
        "oww_referral_id": row.oww_referral_id,
        "status": row.status,
        "org_code": row.org_code,
    }
