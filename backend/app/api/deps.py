"""WW360 API dependencies."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal, get_db
from app.tenant_auth import TenantAuthService, TenantContext

logger = logging.getLogger(__name__)

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
tenant_bearer = HTTPBearer()
tenant_bearer_optional = HTTPBearer(auto_error=False)

IMPERSONATION_WRITE_ALLOWLIST = {
    ("POST", "/api/v1/impersonation/stop"),
    ("POST", "/api/v1/auth/active-state"),
    ("GET", "/api/v1/auth/me"),
    ("GET", "/api/v1/impersonation/personas"),
}

_tenant_auth_service: Optional[TenantAuthService] = None


def get_tenant_auth_service() -> TenantAuthService:
    global _tenant_auth_service
    if _tenant_auth_service is None:
        _tenant_auth_service = TenantAuthService()
    return _tenant_auth_service


async def _resolve_context(
    token: str,
    *,
    requested_state: str | None = None,
) -> TenantContext:
    auth_service = get_tenant_auth_service()
    context = await auth_service.verify_token(token, requested_state=requested_state)
    if not context:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return context


async def get_current_tenant_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(tenant_bearer),
    x_ww360_state: str | None = Header(None, alias="X-WW360-State"),
    state: str | None = Query(None, description="Active primacy state override"),
) -> TenantContext:
    requested = (x_ww360_state or state or "").strip().upper()[:2] or None
    context = await _resolve_context(credentials.credentials, requested_state=requested)
    _enforce_impersonation_read_only(request, context)
    return context


def _enforce_impersonation_read_only(request: Request, context: TenantContext) -> None:
    if not context.is_impersonating or context.impersonation_mode != "preview":
        return
    method = request.method.upper()
    if method in ("GET", "HEAD", "OPTIONS"):
        return
    path = request.url.path.rstrip("/") or "/"
    key = (method, path)
    if key in IMPERSONATION_WRITE_ALLOWLIST:
        return
    # Allow stop with trailing slash variants
    if method == "POST" and path.endswith("/impersonation/stop"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="IMPERSONATION_READ_ONLY",
    )


def log_impersonation_request(context: TenantContext, request: Request, status_code: int) -> None:
    if not context.is_impersonating or not context.impersonation_session_id:
        return
    if context.impersonation_mode != "act":
        return
    try:
        from app.services.impersonation_service import log_impersonation_event

        db = SessionLocal()
        try:
            log_impersonation_event(
                db,
                session_id=context.impersonation_session_id,
                method=request.method,
                path=request.url.path,
                status_code=status_code,
            )
        finally:
            db.close()
    except Exception as exc:
        logger.debug("impersonation event log failed: %s", exc)


async def get_current_tenant_user_from_header_or_query(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(tenant_bearer_optional),
    access_token: Optional[str] = Query(None),
    x_ww360_state: str | None = Header(None, alias="X-WW360-State"),
    state: str | None = Query(None),
) -> TenantContext:
    token = credentials.credentials if credentials else access_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    requested = (x_ww360_state or state or "").strip().upper()[:2] or None
    return await _resolve_context(token, requested_state=requested)


async def get_optional_tenant_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(tenant_bearer_optional),
    x_ww360_state: str | None = Header(None, alias="X-WW360-State"),
    state: str | None = Query(None),
) -> Optional[TenantContext]:
    if not credentials or not credentials.credentials:
        return None
    try:
        requested = (x_ww360_state or state or "").strip().upper()[:2] or None
        return await get_tenant_auth_service().verify_token(
            credentials.credentials,
            requested_state=requested,
        )
    except Exception:
        return None


async def get_current_tenant_user_with_db(
    context: TenantContext = Depends(get_current_tenant_user),
    db: Session = Depends(get_db),
) -> tuple[TenantContext, Session]:
    await get_tenant_auth_service().set_database_context(db, context)
    return context, db


def require_tenant_roles(roles: list[str], require_any: bool = True):
    async def dependency(context: TenantContext = Depends(get_current_tenant_user)):
        if context.is_global_admin or context.is_system_admin:
            return context
        if require_any:
            if not context.has_any_role(roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User does not have any of the required roles: {roles}",
                )
        else:
            if not all(context.has_role(r) for r in roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User does not have all required roles: {roles}",
                )
        return context

    return dependency


def require_global_admin():
    return require_tenant_roles(["platform_admin"], require_any=True)


def require_state_or_global_admin():
    return require_tenant_roles(["platform_admin", "state_admin", "oww_partner"], require_any=True)
