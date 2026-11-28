"""Shared WW360 service-token AuthZ helpers (AquaSafe / Wastewater backends)."""

from __future__ import annotations

import hmac

from app.core.config import settings
from app.models.water_district import WaterDistrict
from app.tenant_auth import TenantContext
from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session


def extract_bearer_token(
    authorization: str | None = None,
    credentials: HTTPAuthorizationCredentials | None = None,
) -> str | None:
    if credentials and credentials.credentials:
        return credentials.credentials.strip()
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


def is_valid_service_token(token: str | None) -> bool:
    expected = (settings.WW360_SERVICE_TOKEN or "").strip()
    if not expected or not token:
        return False
    return hmac.compare_digest(token, expected)


def require_service_token_or_raise(token: str | None) -> None:
    if not is_valid_service_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing service token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def district_exists(db: Session, district_code: str) -> bool:
    code = (district_code or "").strip()
    if not code:
        return False
    row = (
        db.query(WaterDistrict.id)
        .filter(WaterDistrict.district_code == code)
        .first()
    )
    return row is not None


def assert_service_token_district(db: Session, district_code: str) -> str:
    """Service token may read any known district_code (existence check only)."""
    code = (district_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="district_code is required")
    if not district_exists(db, code):
        raise HTTPException(status_code=404, detail="District not found")
    return code


def context_can_access_district(context: TenantContext, district_code: str) -> bool:
    code = (district_code or "").strip()
    if not code:
        return False
    if context.is_global_admin or context.is_system_admin or context.is_national_admin:
        return True
    if "*" in (context.assigned_districts or []):
        return True
    return code in (context.assigned_districts or [])
