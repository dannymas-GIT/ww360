"""WW360 API dependencies."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.tenant_auth import TenantAuthService, TenantContext

logger = logging.getLogger(__name__)

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
tenant_bearer = HTTPBearer()
tenant_bearer_optional = HTTPBearer(auto_error=False)

_tenant_auth_service: Optional[TenantAuthService] = None


def get_tenant_auth_service() -> TenantAuthService:
    global _tenant_auth_service
    if _tenant_auth_service is None:
        _tenant_auth_service = TenantAuthService()
    return _tenant_auth_service


async def get_current_tenant_user(
    credentials: HTTPAuthorizationCredentials = Depends(tenant_bearer),
) -> TenantContext:
    auth_service = get_tenant_auth_service()
    context = await auth_service.verify_token(credentials.credentials)
    if not context:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return context


async def get_current_tenant_user_from_header_or_query(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(tenant_bearer_optional),
    access_token: Optional[str] = Query(None),
) -> TenantContext:
    token = credentials.credentials if credentials else access_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    auth_service = get_tenant_auth_service()
    context = await auth_service.verify_token(token)
    if not context:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return context


async def get_optional_tenant_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(tenant_bearer_optional),
) -> Optional[TenantContext]:
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_tenant_auth_service().verify_token(credentials.credentials)
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
