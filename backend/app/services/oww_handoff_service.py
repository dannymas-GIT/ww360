"""Provision WW360 users from OWW handoff and issue one-time redeem codes."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.oww_integration import OwwHandoffCode, OwwReferral
from app.models.user import User
from app.models.workforce_organization import (
    OrganizationUserMembership,
    WorkforceOrganization,
)
from app.services.auth_service import mint_ww360_token
from app.services.entitlement_service import entitlement_for_org
from app.services.jurisdiction_context_service import build_session_payload
from app.tenant_auth import Roles

logger = logging.getLogger(__name__)

# Utility administrators from OWW map to district_admin in WW360 (utility org admin).
UTILITY_ADMIN_ROLE = Roles.DISTRICT_ADMIN
PLATFORM_HANDOFF_ORG = "PLATFORM"


def _org_code_for_oww(oww_org_id: str) -> str:
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in str(oww_org_id))[:40]
    return f"OWW_{safe}"


def _username_for(email: str, oww_user_id: str) -> str:
    local = (email or "").split("@")[0].strip().lower() or f"oww{oww_user_id}"
    base = "".join(c if c.isalnum() or c in "._-" else "_" for c in local)[:40]
    return base or f"oww_{oww_user_id}"


def _public_app_url() -> str:
    if settings.WW360_PUBLIC_APP_URL:
        return settings.WW360_PUBLIC_APP_URL.rstrip("/")
    domain = settings.APP_DOMAIN or "ww360.aquasafe-solutions.us"
    scheme = "http" if domain.startswith("localhost") or domain.startswith("127.") else "https"
    return f"{scheme}://{domain}"


def upsert_org_and_utility_admin(
    db: Session,
    *,
    oww_org_id: str,
    oww_user_id: str,
    email: str,
    full_name: str,
    utility_name: str,
    stripe_customer_id: str | None,
    state_code: str,
    program_code: str | None = None,
) -> tuple[WorkforceOrganization, User]:
    org = (
        db.query(WorkforceOrganization)
        .filter(WorkforceOrganization.oww_org_id == str(oww_org_id))
        .first()
    )
    if not org:
        code = _org_code_for_oww(oww_org_id)
        # Avoid collision if org_code already taken without oww link.
        existing = db.query(WorkforceOrganization).filter(WorkforceOrganization.org_code == code).first()
        if existing and not existing.oww_org_id:
            existing.oww_org_id = str(oww_org_id)
            org = existing
        elif existing:
            code = f"{code}_{secrets.token_hex(2)}"
            org = WorkforceOrganization(
                org_code=code,
                name=utility_name or code,
                org_type="utility",
                state_code=(state_code or "NY").upper()[:2],
                oww_org_id=str(oww_org_id),
                stripe_customer_id=stripe_customer_id,
                is_active=True,
            )
            db.add(org)
        else:
            org = WorkforceOrganization(
                org_code=code,
                name=utility_name or code,
                org_type="utility",
                state_code=(state_code or "NY").upper()[:2],
                oww_org_id=str(oww_org_id),
                stripe_customer_id=stripe_customer_id,
                is_active=True,
            )
            db.add(org)
    else:
        if utility_name:
            org.name = utility_name
        if stripe_customer_id:
            org.stripe_customer_id = stripe_customer_id
        if state_code:
            org.state_code = state_code.upper()[:2]

    db.flush()

    user = db.query(User).filter(User.oww_user_id == str(oww_user_id)).first()
    if not user and email:
        user = db.query(User).filter(User.email == email.lower()).first()
        if user:
            user.oww_user_id = str(oww_user_id)

    if not user:
        username = _username_for(email, oww_user_id)
        if db.query(User).filter(User.username == username).first():
            username = f"{username}_{secrets.token_hex(2)}"
        user = User(
            username=username,
            email=(email or None) and email.lower(),
            full_name=full_name or None,
            roles=[UTILITY_ADMIN_ROLE],
            district_memberships=[],
            is_active=True,
            oww_user_id=str(oww_user_id),
        )
        # Placeholder password; utility admin uses handoff / invite accept for staff.
        user.set_password(secrets.token_urlsafe(24))
        db.add(user)
        db.flush()
    else:
        if email:
            user.email = email.lower()
        if full_name:
            user.full_name = full_name
        user.is_active = True
        roles = list(user.roles or [])
        if UTILITY_ADMIN_ROLE not in roles:
            roles.append(UTILITY_ADMIN_ROLE)
            user.roles = roles

    membership = (
        db.query(OrganizationUserMembership)
        .filter(
            OrganizationUserMembership.user_id == user.id,
            OrganizationUserMembership.org_code == org.org_code,
        )
        .first()
    )
    if not membership:
        db.add(
            OrganizationUserMembership(
                user_id=user.id,
                org_code=org.org_code,
                role=UTILITY_ADMIN_ROLE,
            )
        )
    else:
        membership.role = UTILITY_ADMIN_ROLE

    # Optional grant tag on a placeholder district membership row is handled by callers
    # via OrganizationDistrictMembership.program_code when a district is linked.
    _ = program_code

    db.commit()
    db.refresh(org)
    db.refresh(user)
    return org, user


def create_handoff_code(db: Session, *, user: User, org_code: str) -> tuple[str, int]:
    ttl = max(30, int(settings.OWW_HANDOFF_CODE_TTL_SECONDS or 90))
    code = secrets.token_urlsafe(24)
    expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=ttl)
    db.add(
        OwwHandoffCode(
            code=code,
            user_id=user.id,
            org_code=org_code,
            expires_at=expires,
        )
    )
    db.commit()
    return code, ttl


def upsert_platform_admin(
    db: Session,
    *,
    oww_user_id: str,
    email: str,
    full_name: str,
) -> User:
    """Ensure an OWW platform admin (Jenny, etc.) exists as WW360 platform_admin."""
    user = db.query(User).filter(User.oww_user_id == str(oww_user_id)).first()
    if not user and email:
        user = db.query(User).filter(User.email == email.lower()).first()
        if user:
            user.oww_user_id = str(oww_user_id)

    if not user:
        username = _username_for(email, oww_user_id)
        if db.query(User).filter(User.username == username).first():
            username = f"{username}_{secrets.token_hex(2)}"
        user = User(
            username=username,
            email=(email or None) and email.lower(),
            full_name=full_name or None,
            roles=[Roles.PLATFORM_ADMIN],
            district_memberships=[],
            is_active=True,
            oww_user_id=str(oww_user_id),
        )
        user.set_password(secrets.token_urlsafe(24))
        db.add(user)
        db.flush()
    else:
        if email:
            user.email = email.lower()
        if full_name:
            user.full_name = full_name
        user.is_active = True
        roles = list(user.roles or [])
        if Roles.PLATFORM_ADMIN not in roles:
            roles.append(Roles.PLATFORM_ADMIN)
            user.roles = roles

    db.commit()
    db.refresh(user)
    return user


def redeem_handoff_code(db: Session, code: str) -> dict[str, Any]:
    row = db.query(OwwHandoffCode).filter(OwwHandoffCode.code == code).first()
    if not row or row.consumed_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired handoff code")
    now = datetime.utcnow()
    if row.expires_at < now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired handoff code")

    user = db.query(User).filter(User.id == row.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    is_platform = row.org_code == PLATFORM_HANDOFF_ORG or Roles.PLATFORM_ADMIN in (user.roles or [])
    if not is_platform:
        # Entitlement gate at redeem time for utility administrators.
        entitlement = entitlement_for_org(db, org_code=row.org_code)
        if not entitlement.is_active:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail={"code": "payment_required", "status": entitlement.status},
            )

    row.consumed_at = now
    db.commit()

    payload = build_session_payload(db, user)
    token = mint_ww360_token(payload)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "roles": list(payload.get("roles") or []),
            "districts": list(payload.get("district_memberships") or []),
            "active_state_code": payload.get("active_state_code"),
            "active_org_code": payload.get("active_org_code"),
        },
    }


def process_platform_handoff(db: Session, body: dict[str, Any]) -> dict[str, Any]:
    """OWW platform / NYSAWWA admins open WW360 as platform_admin (no utility org)."""
    user = upsert_platform_admin(
        db,
        oww_user_id=str(body["oww_user_id"]),
        email=str(body.get("email") or ""),
        full_name=str(body.get("full_name") or ""),
    )
    code, ttl = create_handoff_code(db, user=user, org_code=PLATFORM_HANDOFF_ORG)
    next_path = str(body.get("next") or "/admin/users").strip() or "/admin/users"
    if not next_path.startswith("/"):
        next_path = "/admin/users"
    redirect_url = f"{_public_app_url()}/auth/oww?code={code}&next={next_path}"
    return {
        "ww360_org_id": PLATFORM_HANDOFF_ORG,
        "ww360_user_id": str(user.id),
        "redirect_url": redirect_url,
        "expires_in": ttl,
    }


def process_handoff(
    db: Session,
    body: dict[str, Any],
) -> dict[str, Any]:
    handoff_kind = str(body.get("handoff_kind") or "utility").lower()
    if handoff_kind in ("platform", "platform_admin"):
        return process_platform_handoff(db, body)

    oww_org_id = str(body["oww_org_id"])
    subscription_status = str(body.get("subscription_status") or "none").lower()
    program_code = body.get("program_code")

    # Fast reject before creating accounts (unless grant program).
    if program_code:
        pass
    elif subscription_status != "active":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "payment_required", "status": subscription_status},
        )

    if not body.get("is_billing_admin"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Only the utility billing administrator may open Water Workforce 360 from OWW",
        )

    org, user = upsert_org_and_utility_admin(
        db,
        oww_org_id=oww_org_id,
        oww_user_id=str(body["oww_user_id"]),
        email=str(body.get("email") or ""),
        full_name=str(body.get("full_name") or ""),
        utility_name=str(body.get("utility_name") or ""),
        stripe_customer_id=body.get("stripe_customer_id"),
        state_code=str(body.get("state_code") or "NY"),
        program_code=program_code,
    )

    # Re-check via entitlement service (program_code bypass or live OWW).
    entitlement = entitlement_for_org(db, org_code=org.org_code, oww_org_id=oww_org_id)
    if not entitlement.is_active and not program_code:
        # Roll back identity if OWW says not active after create? Keep link; block redirect.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "payment_required", "status": entitlement.status},
        )

    code, ttl = create_handoff_code(db, user=user, org_code=org.org_code)
    next_path = str(body.get("next") or "/dashboard").strip() or "/dashboard"
    if not next_path.startswith("/"):
        next_path = "/dashboard"
    redirect_url = f"{_public_app_url()}/auth/oww?code={code}&next={next_path}"
    return {
        "ww360_org_id": org.org_code,
        "ww360_user_id": str(user.id),
        "redirect_url": redirect_url,
        "expires_in": ttl,
    }


def record_referral(db: Session, body: dict[str, Any]) -> OwwReferral:
    existing = (
        db.query(OwwReferral)
        .filter(OwwReferral.oww_referral_id == str(body["oww_referral_id"]))
        .first()
    )
    if existing:
        return existing

    org = (
        db.query(WorkforceOrganization)
        .filter(WorkforceOrganization.oww_org_id == str(body["oww_org_id"]))
        .first()
    )
    row = OwwReferral(
        oww_referral_id=str(body["oww_referral_id"]),
        oww_org_id=str(body["oww_org_id"]),
        org_code=org.org_code if org else None,
        district_code=body.get("district_code"),
        candidate_label=body.get("candidate_label"),
        job_title=body.get("job_title"),
        status=str(body.get("status") or "received"),
        payload={k: v for k, v in body.items() if k not in {"oww_referral_id"}},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
