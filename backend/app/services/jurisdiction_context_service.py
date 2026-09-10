"""Resolve active state / org for tenant sessions."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.water_district import WaterDistrict
from app.models.workforce_organization import (
    OrganizationUserMembership,
    WorkforceOrganization,
)
from app.services.jurisdiction_service import load_pack
from app.tenant_auth import GLOBAL_ADMIN_ROLES, Roles, STATE_EXEC_ROLES, _normalize_str_list

DEFAULT_STATE = "NY"
DEFAULT_ORG = "NY_OWW"


def _user_org_memberships(db: Session, user_id: int) -> list[OrganizationUserMembership]:
    return (
        db.query(OrganizationUserMembership)
        .filter(OrganizationUserMembership.user_id == user_id)
        .all()
    )


def orgs_payload(db: Session, user: User) -> list[dict[str, Any]]:
    rows = _user_org_memberships(db, user.id)
    out: list[dict[str, Any]] = []
    for row in rows:
        org = db.query(WorkforceOrganization).filter(
            WorkforceOrganization.org_code == row.org_code,
            WorkforceOrganization.is_active.is_(True),
        ).first()
        if not org:
            continue
        out.append(
            {
                "org_code": org.org_code,
                "state_code": (org.state_code or DEFAULT_STATE).upper(),
                "name": org.name,
                "role": row.role,
                "content_pack_key": org.content_pack_key or org.state_code,
                "org_type": org.org_type or "state_program",
                "parent_org_code": org.parent_org_code,
            }
        )
    return out


def _district_state_codes(db: Session, district_codes: list[str]) -> list[str]:
    if not district_codes:
        return []
    rows = (
        db.query(WaterDistrict.state_code)
        .filter(WaterDistrict.district_code.in_(district_codes))
        .all()
    )
    return sorted({(r[0] or DEFAULT_STATE).upper() for r in rows if r[0]})


def _org_for_state(db: Session, state_code: str) -> WorkforceOrganization | None:
    code = state_code.upper()[:2]
    return (
        db.query(WorkforceOrganization)
        .filter(
            WorkforceOrganization.state_code == code,
            WorkforceOrganization.is_active.is_(True),
        )
        .order_by(WorkforceOrganization.org_code)
        .first()
    )


def _can_access_state(
    *,
    roles: list[str],
    orgs: list[dict[str, Any]],
    state_code: str,
) -> bool:
    code = state_code.upper()[:2]
    if any(r in GLOBAL_ADMIN_ROLES for r in roles):
        return True
    if any(o.get("state_code") == code for o in orgs):
        return True
    if Roles.OWW_PARTNER in roles and code == DEFAULT_STATE:
        return True
    if any(r in STATE_EXEC_ROLES for r in roles):
        return any(o.get("state_code") == code for o in orgs)
    return False


def resolve_active_jurisdiction(
    db: Session,
    user: User,
    *,
    requested_state: str | None = None,
) -> dict[str, Any]:
    """Return active_state_code, active_org_code, orgs, is_national_admin."""
    roles = _normalize_str_list(user.roles)
    orgs = orgs_payload(db, user)
    districts = _normalize_str_list(user.district_memberships)
    is_national = any(r in GLOBAL_ADMIN_ROLES for r in roles)

    default_state = DEFAULT_STATE
    default_org = DEFAULT_ORG

    if orgs:
        default_state = orgs[0]["state_code"]
        default_org = orgs[0]["org_code"]
    elif Roles.OWW_PARTNER in roles:
        org = _org_for_state(db, DEFAULT_STATE)
        if org:
            default_state = (org.state_code or DEFAULT_STATE).upper()
            default_org = org.org_code
    elif districts:
        district_states = _district_state_codes(db, districts)
        if district_states:
            default_state = district_states[0]
            org = _org_for_state(db, default_state)
            if org:
                default_org = org.org_code

    active_state = default_state
    if requested_state:
        req = requested_state.upper()[:2]
        if _can_access_state(roles=roles, orgs=orgs, state_code=req):
            active_state = req
        elif is_national:
            try:
                load_pack(req)
                active_state = req
            except Exception:
                active_state = default_state

    org = _org_for_state(db, active_state)
    active_org = org.org_code if org else default_org

    return {
        "active_state_code": active_state,
        "active_org_code": active_org,
        "orgs": orgs,
        "is_national_admin": is_national,
    }


def build_session_payload(
    db: Session,
    user: User,
    *,
    requested_state: str | None = None,
) -> dict[str, Any]:
    base = {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "roles": list(user.roles or []),
        "district_memberships": list(user.district_memberships or []),
    }
    base.update(
        resolve_active_jurisdiction(db, user, requested_state=requested_state)
    )
    return base
