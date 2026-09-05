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


def mint_ww360_token(user_payload: dict[str, Any]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    claims = {
        "sub": str(user_payload["user_id"]),
        "username": user_payload.get("username"),
        "email": user_payload.get("email"),
        "roles": user_payload.get("roles") or [],
        "districts": user_payload.get("district_memberships") or [],
        "exp": expire,
        "iss": "ww360",
    }
    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_ww360_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
