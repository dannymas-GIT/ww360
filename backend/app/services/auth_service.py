"""WW360 auth: redeem AquaSafe handoff and mint local JWT."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)


async def redeem_aquasafe_handoff(code: str) -> dict[str, Any]:
    """Exchange handoff code with AquaSafe integration API."""
    url = f"{settings.AQUASAFE_INTEGRATION_BASE_URL.rstrip('/')}/api/v1/integrations/ww360/handoff/redeem"
    headers = {"Authorization": f"Bearer {settings.WW360_SERVICE_TOKEN}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json={"code": code}, headers=headers)
        resp.raise_for_status()
        return resp.json()


def mint_ww360_token(
    user_payload: dict[str, Any],
    *,
    act_as: dict[str, Any] | None = None,
    expire_minutes: int | None = None,
) -> str:
    ttl = expire_minutes if expire_minutes is not None else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=ttl)
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
    if act_as:
        claims["act_as"] = act_as
    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_ww360_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
