"""
API dependencies for FastAPI dependency injection
"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, status, Header, Query
from fastapi.security import (
    OAuth2PasswordBearer,
    HTTPBearer,
    HTTPAuthorizationCredentials,
)
import jwt
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import jwt_signing_key, settings
from app.db.database import get_db  # Import get_db from the centralized module
from app.schemas.token import TokenPayload  # Move import to top

# Import tenant authentication system
from app.tenant_auth import TenantAuthService, TenantContext

logger = logging.getLogger(__name__)

# Security schemes
reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
tenant_bearer = HTTPBearer()
tenant_bearer_optional = HTTPBearer(auto_error=False)

# Global tenant auth service instance
_tenant_auth_service: Optional[TenantAuthService] = None


def get_tenant_auth_service() -> TenantAuthService:
    """Get the tenant authentication service"""
    global _tenant_auth_service
    if _tenant_auth_service is None:
        from app.db.database import SessionLocal

        _tenant_auth_service = TenantAuthService(SessionLocal)
    return _tenant_auth_service


# Legacy authentication (keep for backward compatibility)
def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
):
    """
    Validate access token and return current user (legacy system).
    """
    try:
        payload = jwt.decode(
            token, jwt_signing_key(), algorithms=[settings.ALGORITHM]
        )
        logger.debug("JWT payload decoded for user sub=%s", payload.get("sub"))
        token_data = TokenPayload(**payload)
    except (jwt.PyJWTError, ValidationError) as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )

    # Import User model here to avoid circular imports
    from app.models.user import User

    # Get user_id from token payload (new tenant system includes both sub and user_id)
    user_id = None

    # Try to get user_id from the token payload first (new tenant system)
    if hasattr(token_data, "user_id") and token_data.user_id:
        user_id = token_data.user_id
    else:
        try:
            user_id = int(token_data.sub) if token_data.sub else None
        except (ValueError, TypeError) as e:
            logger.error(
                f"Token format error: sub='{token_data.sub}', no user_id field, error={str(e)}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid token format: neither user_id field nor convertible sub field found",
            )

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid token payload: no valid user_id",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


def _decode_hybrid_token(token: str) -> TokenPayload:
    """Decode JWT using the same signing keys as tenant login."""
    from app.tenant_auth import JWT_SECRET_KEY as tenant_jwt_key

    # Include tenant_jwt_key even when empty — tenant auth signs/verifies with it
    # when JWT_SECRET_KEY and SECRET_KEY are unset (local dev), and hybrid must match.
    jwt_keys: list[str] = []
    for key in (
        tenant_jwt_key,
        settings.JWT_SECRET_KEY,
        settings.SECRET_KEY,
        jwt_signing_key(),
    ):
        if key not in jwt_keys:
            jwt_keys.append(key)

    last_error: Exception | None = None
    payload = None
    for key in jwt_keys:
        try:
            payload = jwt.decode(token, key, algorithms=[settings.ALGORITHM])
            break
        except jwt.PyJWTError as exc:
            last_error = exc
            continue

    if payload is None:
        logger.error("Hybrid JWT validation error: %s", last_error)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )

    try:
        return TokenPayload(**payload)
    except ValidationError as exc:
        logger.error("Hybrid JWT payload validation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )


def _get_current_user_hybrid_impl(
    db: Session,
    token: str,
    *,
    allow_temp_token: bool,
):
    token_data = _decode_hybrid_token(token)
    if token_data.token_type == "temp_2fa" and not allow_temp_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Temporary authentication token not valid for this endpoint",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Import User model here to avoid circular imports
    from app.models.user import User

    user = None

    # Prefer explicit user_id from tenant JWT, then legacy integer sub, then username sub
    if getattr(token_data, "user_id", None):
        user = db.query(User).filter(User.id == token_data.user_id).first()

    # Try to determine if this is a legacy token (integer user_id) or tenant token (username)
    if not user and token_data.sub:
        # First try as legacy token (integer user_id)
        try:
            user_id = int(token_data.sub)
            user = db.query(User).filter(User.id == user_id).first()
        except (ValueError, TypeError):
            # If conversion to int fails, treat as username (new tenant token)
            username = str(token_data.sub)
            user = db.query(User).filter(User.username == username).first()

    if token_data.user_id and not user:
        user = db.query(User).filter(User.id == token_data.user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


def get_current_user_hybrid(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
):
    """
    Hybrid authentication that can handle both legacy tokens (integer user_id in sub)
    and new tenant tokens (username in sub). Rejects temp_2fa tokens.
    """
    return _get_current_user_hybrid_impl(db, token, allow_temp_token=False)


def get_current_user_hybrid_allow_temp(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
):
    """Hybrid auth that accepts temp_2fa tokens (mandatory 2FA setup flow only)."""
    return _get_current_user_hybrid_impl(db, token, allow_temp_token=True)


def get_current_active_user(
    current_user=Depends(get_current_user),
):
    """
    Get current active user (legacy system).
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return current_user


def get_current_active_superuser(
    current_user=Depends(get_current_active_user),
):
    """
    Get current active superuser (legacy system).
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user


def get_current_active_user_hybrid(
    current_user=Depends(get_current_user_hybrid),
):
    """
    Get current active user (hybrid system that supports both legacy and tenant tokens).
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return current_user


def get_current_user_optional(
    db: Session = Depends(get_db), authorization: Optional[str] = Header(None)
) -> Optional:
    """
    Get current user if authenticated, otherwise return None.
    This allows endpoints to work for both authenticated and anonymous users.
    """
    if not authorization:
        return None

    try:
        # Extract token from "Bearer <token>" format
        if authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
        else:
            token = authorization

        payload = jwt.decode(
            token, jwt_signing_key(), algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)

        # Import User model here to avoid circular imports
        from app.models.user import User

        # Try to get user_id from token
        user_id = None
        if hasattr(token_data, "user_id") and token_data.user_id:
            user_id = token_data.user_id
        elif token_data.sub:
            try:
                user_id = int(token_data.sub)
            except (ValueError, TypeError):
                username = str(token_data.sub)
                user = db.query(User).filter(User.username == username).first()
                return user if user and user.is_active else None

        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            return user if user and user.is_active else None

        return None

    except (jwt.PyJWTError, ValidationError, Exception):
        # If any error occurs, just return None (not authenticated)
        return None


def get_current_active_superuser_hybrid(
    current_user=Depends(get_current_active_user_hybrid),
):
    """
    Get current active superuser (hybrid system that supports both legacy and tenant tokens).
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user


# New tenant-aware dependencies
async def get_current_tenant_user(
    credentials: HTTPAuthorizationCredentials = Depends(tenant_bearer),
) -> TenantContext:
    """
    Get current tenant user with context (new multi-tenant system).
    This replaces get_current_user for tenant-aware endpoints.
    """
    try:
        print("[DEBUG] Starting tenant authentication...")
        auth_service = get_tenant_auth_service()

        if not auth_service:
            print("[DEBUG] Auth service is None!")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Auth service not initialized",
            )

        print("[DEBUG] Auth service available, extracting token...")
        token = credentials.credentials
        print(f"[DEBUG] Token extracted: {token[:20]}... (length: {len(token)})")

        print("[DEBUG] Verifying token with auth service...")
        context = await auth_service.verify_token(token)

        if not context:
            print("[DEBUG] Token verification returned None - token is invalid")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        print(f"[DEBUG] Token verification successful for user: {context.username}")
        return context

    except HTTPException as e:
        print(f"[DEBUG] HTTPException in tenant auth: {e.detail}")
        raise e
    except Exception as e:
        # Log full error for debugging but return 401 (not 500)
        import logging

        logger = logging.getLogger(__name__)
        logger.error(
            f"Unexpected error in tenant auth: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or missing tenant authentication - {type(e).__name__}: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_tenant_user_from_header_or_query(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(tenant_bearer_optional),
    access_token: Optional[str] = Query(None, description="JWT for iframe PDF viewing"),
) -> TenantContext:
    """Accept Bearer header or access_token query param (iframe cannot send headers)."""
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
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        tenant_bearer_optional
    ),
) -> Optional[TenantContext]:
    """Return tenant context when a valid Bearer token is present; else None."""
    if not credentials or not credentials.credentials:
        return None
    try:
        auth_service = get_tenant_auth_service()
        if not auth_service:
            return None
        return await auth_service.verify_token(credentials.credentials)
    except Exception:
        return None


async def get_current_tenant_user_with_db(
    context: TenantContext = Depends(get_current_tenant_user),
    db: Session = Depends(get_db),
) -> tuple[TenantContext, Session]:
    """
    Get current tenant user and database session with tenant context applied.
    """
    try:
        auth_service = get_tenant_auth_service()
        await auth_service.set_database_context(db, context)
        return context, db
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set tenant context",
        )


def require_tenant_roles(roles: list[str], require_any: bool = True):
    """
    Dependency factory to require specific tenant roles.

    Args:
        roles: List of required roles
        require_any: If True, user needs any of the roles. If False, user needs all roles.
    """

    async def dependency(context: TenantContext = Depends(get_current_tenant_user)):
        # Global admins have access to everything
        if hasattr(context, "is_global_admin") and context.is_global_admin:
            return context
        # Backwards compatibility with is_system_admin
        if context.is_system_admin:
            return context

        if require_any:
            if not context.has_any_role(roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User does not have any of the required roles: {roles}",
                )
        else:
            for role in roles:
                if not context.has_role(role):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"User does not have required role: {role}",
                    )
        return context

    return dependency


def require_district_access(district_param: str = "district_code"):
    """
    Dependency factory to require access to a specific district.
    The district code should be passed as a path or query parameter.
    """

    async def dependency(
        context: TenantContext = Depends(get_current_tenant_user),
        request=None,  # Will be injected by FastAPI
    ):
        # Extract district code from request parameters
        district_code = None
        if hasattr(request, "path_params") and district_param in request.path_params:
            district_code = request.path_params[district_param]
        elif (
            hasattr(request, "query_params") and district_param in request.query_params
        ):
            district_code = request.query_params[district_param]

        if district_code and not context.has_district_access(district_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have access to district: {district_code}",
            )

        return context

    return dependency


# Convenience dependencies for common role combinations
require_global_admin = require_tenant_roles(
    ["global_admin", "system_admin", "platform_admin"], require_any=True
)
require_system_admin = require_tenant_roles(
    ["global_admin", "system_admin"], require_any=True
)  # Updated for backwards compatibility
require_district_admin = require_tenant_roles(
    ["district_admin", "global_admin", "system_admin"], require_any=True
)
require_district_manager = require_tenant_roles(
    ["district_admin", "district_manager", "global_admin", "system_admin"],
    require_any=True,
)
require_district_operator = require_tenant_roles(
    [
        "district_admin",
        "district_manager",
        "district_operator",
        "global_admin",
        "system_admin",
    ],
    require_any=True,
)
require_field_engineer = require_tenant_roles(
    ["field_engineer", "lead_engineer", "global_admin", "system_admin"],
    require_any=True,
)
require_any_engineer = require_tenant_roles(
    [
        "field_engineer",
        "lead_engineer",
        "district_operator",
        "global_admin",
        "system_admin",
    ],
    require_any=True,
)

_ELEVATED_ROLES = ["global_admin", "system_admin", "platform_admin"]


def require_configured_role_for_batch(action: str):
    """Require the district-configured role for a staging batch action."""

    async def dependency(
        batch_id: int,
        context: TenantContext = Depends(get_current_tenant_user),
        db: Session = Depends(get_db),
    ):
        from app.models.staging_lab_result import StagingBatch
        from app.services.district_decision_config import effective_role_for

        batch = db.query(StagingBatch).filter(StagingBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
        if batch.district_code and not context.has_district_access(batch.district_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied for this batch",
            )
        if context.is_global_admin or context.is_system_admin:
            return context
        required = effective_role_for(action, batch.district_code, db)
        if not context.has_any_role([required] + _ELEVATED_ROLES):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {required}",
            )
        return context

    return dependency


def require_configured_role_for_district(action: str):
    """Require the district-configured role using ``district_code`` path param."""

    async def dependency(
        district_code: str,
        context: TenantContext = Depends(get_current_tenant_user),
        db: Session = Depends(get_db),
    ):
        from app.services.district_decision_config import effective_role_for

        if not context.has_district_access(district_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have access to district: {district_code}",
            )
        if context.is_global_admin or context.is_system_admin:
            return context
        required = effective_role_for(action, district_code, db)
        if not context.has_any_role([required] + _ELEVATED_ROLES):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {required}",
            )
        return context

    return dependency


# Re-export get_db for convenience
# All API endpoints should use this for database access
