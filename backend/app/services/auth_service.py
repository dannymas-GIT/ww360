"""WW360 auth: redeem AquaSafe handoff and mint local JWT."""

from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)


async def redeem_aquasafe_handoff(code: str) -> dict[str, Any]:
    """Exchange handoff code with AquaSafe integration API."""
    url = f"{settings.AQUASAFE_INTEGRATION_BASE_URL.rstrip('/')}/api/v1/integrations/ww360/handoff/redeem"
    headers = {"Authorization": f"Bearer {settings.WW360_SERVICE_TOKEN}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json={"code": code}, headers=headers)
        resp.raise_for_status()
        return resp.json()


def _username_for_aquasafe(email: str | None, aquasafe_user_id: int) -> str:
    local = (email or "").split("@")[0].strip().lower() or f"as{aquasafe_user_id}"
    base = "".join(c if c.isalnum() or c in "._-" else "_" for c in local)[:40]
    return base or f"aquasafe_{aquasafe_user_id}"


def upsert_local_user_from_aquasafe(
    db: Session,
    aquasafe_payload: dict[str, Any],
) -> User:
    """Resolve/create a local ``users`` row keyed by ``aquasafe_user_id``.

    Never reuses an unrelated OWW user's local id. Matching verified email is
    allowed only when that row has no conflicting ``oww_user_id`` ownership that
    would cross-link identities incorrectly — if email matches a user that already
    has a different ``aquasafe_user_id``, create a distinct row instead.
    """
    raw_id = aquasafe_payload.get("user_id")
    if raw_id is None:
        raw_id = aquasafe_payload.get("id")
    if raw_id is None:
        raise ValueError("AquaSafe handoff payload missing user_id")
    aquasafe_user_id = int(raw_id)

    email = (aquasafe_payload.get("email") or "").strip().lower() or None
    username = (aquasafe_payload.get("username") or "").strip()
    full_name = aquasafe_payload.get("full_name")
    roles = list(aquasafe_payload.get("roles") or [])
    districts = list(
        aquasafe_payload.get("district_memberships")
        or aquasafe_payload.get("districts")
        or []
    )

    user = db.query(User).filter(User.aquasafe_user_id == aquasafe_user_id).first()

    if not user and email:
        by_email = db.query(User).filter(User.email == email).first()
        if by_email is not None:
            # Link only when the row is not already tied to a different AquaSafe id
            # and is not an OWW-only account we should leave alone when emails collide
            # with a different Aquasafe identity (guard: oww_user_id without aquasafe).
            if by_email.aquasafe_user_id is None:
                if by_email.oww_user_id and aquasafe_user_id:
                    # Email collision with an OWW user — do not overwrite; create new.
                    by_email = None
                else:
                    by_email.aquasafe_user_id = aquasafe_user_id
                    user = by_email
            elif by_email.aquasafe_user_id != aquasafe_user_id:
                by_email = None

    if not user:
        uname = username or _username_for_aquasafe(email, aquasafe_user_id)
        if db.query(User).filter(User.username == uname).first():
            uname = f"{uname}_{secrets.token_hex(2)}"
        user = User(
            username=uname,
            email=email,
            full_name=full_name,
            roles=roles or ["district_viewer"],
            district_memberships=districts,
            is_active=True,
            aquasafe_user_id=aquasafe_user_id,
        )
        user.set_password(secrets.token_urlsafe(24))
        db.add(user)
        db.flush()
    else:
        if email:
            user.email = email
        if full_name:
            user.full_name = full_name
        if roles:
            user.roles = roles
        if districts:
            user.district_memberships = districts
        user.is_active = True
        user.aquasafe_user_id = aquasafe_user_id

    db.commit()
    db.refresh(user)
    return user


def mint_ww360_token(
    user_payload: dict[str, Any],
    *,
    act_as: dict[str, Any] | None = None,
    expire_minutes: int | None = None,
    origin: str | None = None,
) -> str:
    ttl = expire_minutes if expire_minutes is not None else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(UTC) + timedelta(minutes=ttl)
    claims = {
        "sub": str(user_payload["user_id"]),
        "username": user_payload.get("username"),
        "email": user_payload.get("email"),
        "roles": user_payload.get("roles") or [],
        "districts": user_payload.get("district_memberships") or [],
        "active_state_code": (user_payload.get("active_state_code") or "NY").upper()[:2],
        "active_org_code": user_payload.get("active_org_code"),
        "is_national_admin": bool(user_payload.get("is_national_admin")),
        "orgs": user_payload.get("orgs") or [],
        "exp": expire,
        "iss": "ww360",
    }
    origin_claim = origin or user_payload.get("origin")
    if origin_claim:
        claims["origin"] = origin_claim
    if act_as:
        claims["act_as"] = act_as
    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_ww360_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


async def complete_aquasafe_handoff(db: Session, code: str) -> dict[str, Any]:
    """Redeem AquaSafe code → upsert local user → mint JWT with local ``sub``."""
    # Lazy import avoids tenant_auth ↔ auth_service circular import at module load.
    from app.services.jurisdiction_context_service import build_session_payload

    remote = await redeem_aquasafe_handoff(code)
    user = upsert_local_user_from_aquasafe(db, remote)
    payload = build_session_payload(db, user)
    payload["origin"] = "aquasafe"
    token = mint_ww360_token(payload, origin="aquasafe")
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
            "origin": "aquasafe",
            "aquasafe_user_id": user.aquasafe_user_id,
        },
    }
