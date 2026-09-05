"""
Multi-Tenant Authentication and Authorization System
Provides JWT-based authentication with tenant context and role-based access control
"""

import jwt
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from functools import wraps
from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel, ValidationError, field_validator
import logging

from app.models.user import User

# Setup logging
logger = logging.getLogger(__name__)

# JWT Configuration
from app.core.config import settings

JWT_SECRET_KEY = settings.JWT_SECRET_KEY or settings.SECRET_KEY
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

# Security scheme
security = HTTPBearer()


# Role definitions for easy reference
class Roles:
    GLOBAL_ADMIN = (
        "global_admin"  # Internal/system-wide admin with access to all districts
    )
    SYSTEM_ADMIN = "system_admin"  # System admin (legacy, equivalent to global_admin)
    PLATFORM_ADMIN = "platform_admin"  # Platform-level admin
    DISTRICT_ADMIN = "district_admin"  # District-specific admin
    DISTRICT_MANAGER = "district_manager"  # District manager
    DISTRICT_OPERATOR = "district_operator"  # District operator
    DISTRICT_VIEWER = "district_viewer"  # District viewer (read-only)
    LEAD_ENGINEER = "lead_engineer"  # Lead engineer (multi-district)
    FIELD_ENGINEER = "field_engineer"  # Field engineer
    SAMPLE_COLLECTOR = "sample_collector"  # Field sample collection (limited /tester workflow)
    CONTRACTOR = "contractor"  # External contractor
    REGIONAL_ANALYST = "regional_analyst"  # Cross-district regional analysis / heatmaps
    REGULATORY_VIEWER = "regulatory_viewer"  # Health dept / regulatory read-only (existing)
    CEU_ADMIN = "ceu_admin"  # Workforce/CEU tenant admin (module-scoped, runs CEU-only tenants)
    CEU_MANAGER = "ceu_manager"  # Workforce/CEU editor (CRUD within workforce module only)
    CEU_USER = "ceu_user"  # Workforce/CEU read-only user
    OWW_PARTNER = "oww_partner"  # One Water Workforce program partner (paired with platform_admin)


# Workforce/CEU module-scoped roles - access ONLY the workforce-succession module
CEU_ROLES = [Roles.CEU_ADMIN, Roles.CEU_MANAGER, Roles.CEU_USER]

# Program-partner marker roles (global scope, no district). They do not grant
# permissions on their own; pair with platform_admin for platform privileges.
PARTNER_ROLES = [Roles.OWW_PARTNER]


# Global admin roles - have access to all districts
GLOBAL_ADMIN_ROLES = [Roles.GLOBAL_ADMIN, Roles.SYSTEM_ADMIN, Roles.PLATFORM_ADMIN]

# District admin roles - have admin access within their district
DISTRICT_ADMIN_ROLES = [Roles.DISTRICT_ADMIN]

# All admin roles
ADMIN_ROLES = GLOBAL_ADMIN_ROLES + DISTRICT_ADMIN_ROLES


def _normalize_str_list(raw: Optional[Any]) -> List[str]:
    """
    Flatten JWT/DB role or district lists into unique strings.
    Avoids TypeError from ``set()`` on unhashable corrupt payloads (nested lists/dicts).
    """
    if raw is None:
        return []
    if isinstance(raw, str):
        s = raw.strip()
        return [s] if s else []
    if isinstance(raw, (list, tuple, set)):
        out: List[str] = []
        for item in raw:
            if item is None:
                continue
            if isinstance(item, str):
                s = item.strip()
                if s:
                    out.append(s)
            elif isinstance(item, (dict, list)):
                logger.warning("Skipping non-scalar entry in tenant list: %r", item)
                continue
            else:
                s = str(item).strip()
                if s:
                    out.append(s)
        return list(dict.fromkeys(out))
    return []


class TenantContext:
    """Represents the current user's tenant context"""

    def __init__(
        self,
        user_id: int,
        username: str,
        district_code: Optional[str] = None,
        roles: List[str] = None,
        assigned_districts: List[str] = None,
        is_system_admin: bool = False,
        modules: List[str] = None,
    ):
        self.user_id = user_id
        self.username = username
        self.district_code = district_code
        self.roles = _normalize_str_list(roles)
        self.assigned_districts = _normalize_str_list(assigned_districts)
        self.is_system_admin = is_system_admin
        self.modules = _normalize_str_list(modules)

        # Check if user has global admin roles
        self.is_global_admin = is_system_admin or any(
            role in GLOBAL_ADMIN_ROLES for role in self.roles
        )

    def has_module(self, module_key: str) -> bool:
        """Check if user has access to a product module."""
        if self.is_global_admin:
            return True
        return module_key in self.modules

    def has_role(self, role: str) -> bool:
        """Check if user has a specific role"""
        return role in self.roles or self.is_global_admin

    def has_any_role(self, roles: List[str]) -> bool:
        """Check if user has any of the specified roles"""
        return any(role in self.roles for role in roles) or self.is_global_admin

    def has_district_access(self, district_code: str) -> bool:
        """Check if user has access to a specific district"""
        if self.is_global_admin:
            return True
        return (
            district_code == self.district_code
            or district_code in self.assigned_districts
        )

    def get_accessible_districts(self) -> List[str]:
        """Get all districts the user has access to"""
        if self.is_global_admin:
            return ["*"]  # All districts
        districts: List[str] = []
        if self.district_code:
            dc = str(self.district_code).strip()
            if dc:
                districts.append(dc)
        districts.extend(self.assigned_districts)
        return list(dict.fromkeys(districts))


class UserCredentials(BaseModel):
    """User login credentials"""

    username: str
    password: str
    district_code: Optional[str] = None


class TokenData(BaseModel):
    """Token payload data"""

    user_id: int
    username: str
    district_code: Optional[str] = None
    roles: List[str] = []
    assigned_districts: List[str] = []
    is_system_admin: bool = False
    modules: List[str] = []

    @field_validator("roles", mode="before")
    @classmethod
    def _coerce_roles(cls, v: Any) -> Any:
        if v is None:
            return []
        if isinstance(v, str):
            return [v.strip()] if v.strip() else []
        return v

    @field_validator("assigned_districts", mode="before")
    @classmethod
    def _coerce_assigned_districts(cls, v: Any) -> Any:
        if v is None:
            return []
        if isinstance(v, str):
            return [v.strip()] if v.strip() else []
        return v

    @field_validator("modules", mode="before")
    @classmethod
    def _coerce_modules(cls, v: Any) -> Any:
        if v is None:
            return []
        if isinstance(v, str):
            return [v.strip()] if v.strip() else []
        return v


class TenantAuthService:
    """Main authentication service for multi-tenant system"""

    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def authenticate_user(
        self, credentials: UserCredentials
    ) -> Optional[TenantContext]:
        """Authenticate user and return tenant context"""
        try:
            db = self.session_factory()

            logger.info(f"Authenticating user: {credentials.username}")
            # Get user with password verification
            user_query = text("""
                SELECT u.id, u.username, u.email, u.hashed_password, u.is_superuser,
                       u.primary_district, u.default_role, u.is_active, u.locked_until,
                       u.login_attempts
                FROM users u 
                WHERE u.username = :username AND u.is_active = true
            """)

            logger.info("Executing user query...")
            result = db.execute(user_query, {"username": credentials.username})
            user_data = result.fetchone()

            if not user_data:
                logger.warning(
                    f"Authentication failed: User {credentials.username} not found"
                )
                return None

            # Check if account is locked
            if user_data.locked_until and user_data.locked_until > datetime.utcnow():
                logger.warning(
                    f"Authentication failed: Account {credentials.username} is locked"
                )
                raise HTTPException(status_code=423, detail="Account is locked")

            # Verify password using the imported verify_password function from core.security
            from app.core.security import verify_password

            if not verify_password(credentials.password, user_data.hashed_password):
                # Increment login attempts
                logger.warning(
                    f"Invalid password for {credentials.username}. Incrementing login attempts."
                )
                await self._increment_login_attempts(db, user_data.id)
                logger.warning(
                    f"Authentication failed: Invalid password for {credentials.username}"
                )
                return None

            # Reset login attempts on successful authentication
            logger.info(
                f"Password verified for {credentials.username}. Resetting login attempts."
            )
            await self._reset_login_attempts(db, user_data.id)

            # Determine district context
            logger.info("Determining district context...")
            logger.info(
                f"🔍 DEBUG: credentials.district_code = {credentials.district_code}"
            )
            logger.info(
                f"🔍 DEBUG: user_data.primary_district = {user_data.primary_district}"
            )
            district_code = (
                credentials.district_code
                or user_data.primary_district
                or await self._get_user_default_district(db, user_data.id)
            )
            logger.info(f"🔍 DEBUG: FINAL district_code = {district_code}")

            # Get user roles and assignments
            logger.info(
                f"Getting roles for user {user_data.id} in district {district_code}"
            )
            roles = await self._get_user_roles(db, user_data.id, district_code)
            logger.info(f"Getting assigned districts for user {user_data.id}")
            assigned_districts = await self._get_assigned_districts(db, user_data.id)

            # Update last accessed district
            logger.info(f"Updating last accessed district for user {user_data.id}")
            await self._update_last_accessed_district(db, user_data.id, district_code)

            # Check if user is global admin
            is_global_admin = user_data.is_superuser or any(
                role in GLOBAL_ADMIN_ROLES for role in roles
            )

            from app.services.module_access_service import resolve_user_modules

            modules = resolve_user_modules(
                db,
                user_data.id,
                district_code,
                is_global_admin=is_global_admin,
            )

            context = TenantContext(
                user_id=user_data.id,
                username=user_data.username,
                district_code=district_code,
                roles=roles,
                assigned_districts=assigned_districts,
                is_system_admin=is_global_admin,  # Keep for backwards compatibility
                modules=modules,
            )

            db.close()
            return context

        except HTTPException:
            # Re-raise HTTPException (like "Account is locked") to preserve status codes
            raise
        except Exception as e:
            logger.error(
                f"Authentication error in authenticate_user: {str(e)}", exc_info=True
            )
            return None

    async def switch_district_context(
        self,
        db: Session,
        *,
        user_id: int,
        username: str,
        district_code: str,
    ) -> TenantContext:
        """Rebuild tenant context for a different acting district (JWT re-issue)."""
        roles = await self._get_user_roles(db, user_id, district_code)
        assigned_districts = await self._get_assigned_districts(db, user_id)

        user_row = db.execute(
            text("SELECT is_superuser FROM users WHERE id = :user_id"),
            {"user_id": user_id},
        ).fetchone()
        is_superuser = bool(user_row and user_row[0])

        is_global_admin = is_superuser or any(
            role in GLOBAL_ADMIN_ROLES for role in roles
        )

        from app.services.module_access_service import resolve_user_modules

        modules = resolve_user_modules(
            db,
            user_id,
            district_code,
            is_global_admin=is_global_admin,
        )

        await self._update_last_accessed_district(db, user_id, district_code)

        return TenantContext(
            user_id=user_id,
            username=username,
            district_code=district_code,
            roles=roles,
            assigned_districts=assigned_districts,
            is_system_admin=is_global_admin,
            modules=modules,
        )

    async def build_context_for_user(
        self,
        db: Session,
        user: User,
        *,
        district_code: Optional[str] = None,
    ) -> Optional[TenantContext]:
        """Rebuild tenant context after domain handoff or session restore."""
        if not user.is_active:
            return None
        code = (
            district_code
            or user.primary_district
            or await self._get_user_default_district(db, user.id)
        )
        if not code:
            roles = await self._get_user_roles(db, user.id, None)
            assigned_districts = await self._get_assigned_districts(db, user.id)
            is_global_admin = user.is_superuser or any(
                role in GLOBAL_ADMIN_ROLES for role in roles
            )
            from app.services.module_access_service import resolve_user_modules

            modules = resolve_user_modules(
                db,
                user.id,
                None,
                is_global_admin=is_global_admin,
            )
            return TenantContext(
                user_id=user.id,
                username=user.username,
                district_code=None,
                roles=roles,
                assigned_districts=assigned_districts,
                is_system_admin=is_global_admin,
                modules=modules,
            )
        return await self.switch_district_context(
            db,
            user_id=user.id,
            username=user.username,
            district_code=code,
        )

    async def _increment_login_attempts(self, db: Session, user_id: int):
        """Increment login attempts for a user"""
        try:
            increment_query = text("""
                UPDATE users 
                SET login_attempts = COALESCE(login_attempts, 0) + 1,
                    locked_until = CASE 
                        WHEN COALESCE(login_attempts, 0) + 1 >= 5 
                        THEN NOW() + INTERVAL '15 minutes' 
                        ELSE locked_until 
                    END
                WHERE id = :user_id
            """)
            db.execute(increment_query, {"user_id": user_id})
            db.commit()
        except Exception as e:
            logger.error(f"Error incrementing login attempts: {e}")

    async def _reset_login_attempts(self, db: Session, user_id: int):
        """Reset login attempts for a user"""
        try:
            reset_query = text("""
                UPDATE users 
                SET login_attempts = 0, locked_until = NULL
                WHERE id = :user_id
            """)
            db.execute(reset_query, {"user_id": user_id})
            db.commit()
        except Exception as e:
            logger.error(f"Error resetting login attempts: {e}")

    async def _get_user_roles(
        self, db: Session, user_id: int, district_code: Optional[str]
    ) -> List[str]:
        """Get user roles for the specified district (or global roles when district-less)."""
        if district_code:
            roles_query = text("""
                SELECT DISTINCT ur.role_name
                FROM user_roles ur
                WHERE ur.user_id = :user_id 
                AND ur.is_active = true
                AND (ur.district_code = :district_code OR ur.district_code IS NULL)
                AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
            """)
            params = {"user_id": user_id, "district_code": district_code}
        else:
            roles_query = text("""
                SELECT DISTINCT ur.role_name
                FROM user_roles ur
                WHERE ur.user_id = :user_id 
                AND ur.is_active = true
                AND ur.district_code IS NULL
                AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
            """)
            params = {"user_id": user_id}

        result = db.execute(roles_query, params)
        role_names = [row[0] for row in result]
        try:
            from app.services.district_roles_service import expand_roles_with_parents

            return expand_roles_with_parents(db, role_names, district_code or "")
        except Exception:
            return role_names

    async def _get_assigned_districts(self, db: Session, user_id: int) -> List[str]:
        """Get districts assigned to the user (for engineers)"""
        districts_query = text("""
            SELECT DISTINCT uda.district_code
            FROM user_district_assignments uda
            WHERE uda.user_id = :user_id 
            AND uda.is_active = true
            AND (uda.expires_at IS NULL OR uda.expires_at > CURRENT_TIMESTAMP)
        """)

        result = db.execute(districts_query, {"user_id": user_id})
        return [row[0] for row in result]

    async def _get_user_default_district(
        self, db: Session, user_id: int
    ) -> Optional[str]:
        """Get user's default district if none specified"""
        default_query = text("""
            SELECT district_code FROM user_roles ur
            WHERE ur.user_id = :user_id 
            AND ur.is_active = true
            AND ur.district_code IS NOT NULL
            ORDER BY ur.granted_at DESC
            LIMIT 1
        """)

        result = db.execute(default_query, {"user_id": user_id})
        row = result.fetchone()
        # Return None instead of defaulting to WWD - force explicit district assignment
        return row[0] if row else None

    async def _update_last_accessed_district(
        self, db: Session, user_id: int, district_code: Optional[str]
    ):
        """Update user's last accessed district (skip for district-less LMS users)."""
        if not district_code:
            return
        update_query = text("""
            UPDATE users 
            SET last_district_accessed = :district_code
            WHERE id = :user_id
        """)
        db.execute(update_query, {"user_id": user_id, "district_code": district_code})
        db.commit()

    def create_access_token(self, context: TenantContext, temp: bool = False) -> str:
        """Create JWT access token with tenant context"""
        if temp:
            # Temporary token for 2FA verification (5 minutes)
            expires = datetime.utcnow() + timedelta(minutes=5)
            token_type = "temp_2fa"
        else:
            # Full access token
            expires = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            token_type = "access"

        token_data = {
            "sub": context.username,
            "user_id": context.user_id,
            "district_code": context.district_code,
            "roles": context.roles,
            "assigned_districts": context.assigned_districts,
            "is_system_admin": context.is_system_admin,
            "modules": context.modules,
            "token_type": token_type,
            "exp": expires,
        }

        return jwt.encode(token_data, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    async def verify_token(
        self, token: str, *, allow_temp_token: bool = False
    ) -> Optional[TenantContext]:
        """Verify JWT token and return tenant context."""
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

            token_type = payload.get("token_type", "access")
            if token_type in {"temp_2fa", "domain_handoff"} and not allow_temp_token:
                logger.warning("Rejected %s token on protected route", token_type)
                return None

            try:
                token_data = TokenData(
                    user_id=payload.get("user_id"),
                    username=payload.get("sub"),
                    district_code=payload.get("district_code"),
                    roles=payload.get("roles", []),
                    assigned_districts=payload.get("assigned_districts", []),
                    is_system_admin=payload.get("is_system_admin", False),
                    modules=payload.get("modules", []),
                )
            except ValidationError as e:
                logger.warning("JWT payload failed validation: %s", e)
                return None

            # For global admins, provide a default district if none specified
            district_code = token_data.district_code
            if not district_code:
                if token_data.assigned_districts:
                    district_code = token_data.assigned_districts[0]
                elif token_data.is_system_admin or any(
                    role in GLOBAL_ADMIN_ROLES for role in token_data.roles
                ):
                    district_code = "WWD"  # Default district for global admins

            return TenantContext(
                user_id=token_data.user_id,
                username=token_data.username,
                district_code=district_code,
                roles=token_data.roles,
                assigned_districts=token_data.assigned_districts,
                is_system_admin=token_data.is_system_admin,
                modules=token_data.modules,
            )

        except jwt.PyJWTError as e:
            logger.warning("Token verification failed: %s", e)
            return None

    async def set_database_context(self, db: Session, context: TenantContext):
        """
        Set PostgreSQL user context for Row Level Security (RLS) enforcement.
        This enables district-based data isolation at the database level.
        """
        if not context or not context.district_code:
            logger.warning("No tenant context or district code provided for RLS")
            return

        try:
            # Call PostgreSQL function to set user context for RLS
            set_context_query = text("""
                SELECT set_user_context(
                    :user_id,
                    :district_code,
                    :user_roles,
                    :is_system_admin,
                    :assigned_districts
                )
            """)

            db.execute(
                set_context_query,
                {
                    "user_id": context.user_id,
                    "district_code": context.district_code,
                    "user_roles": context.roles or [],
                    "is_system_admin": context.is_system_admin,
                    "assigned_districts": context.assigned_districts or [],
                },
            )

            logger.debug(
                f"✅ RLS context set for user {context.username} (district: {context.district_code})"
            )

        except Exception as e:
            logger.error(f"Failed to set RLS context for user {context.username}: {e}")
            # SECURITY: RLS failure is logged and tracked. Application-level filtering
            # via DistrictSecurityService still enforces isolation, but this should be
            # investigated immediately if it occurs in production.
        # Original, problematic implementation is commented out below:
        # if not context or not context.district_code:
        #     logger.warning("No tenant context or district code, using default database connection")
        #     return

        # # For global admins, we might use a shared admin schema or default connection
        # if context.is_global_admin:
        #     logger.debug("Global admin context, using default connection")
        #     return

        # # For district users, set the search path to their district-specific schema
        # district_schema = f"district_{context.district_code.lower()}"
        # logger.info(f"Setting search path for user {context.username} to '{district_schema}'")

        # try:
        #     # Use "SET search_path" to isolate the tenant's data
        #     # This is safer than reconnecting and works well with connection pooling
        #     db.execute(text(f"SET search_path TO {district_schema}, public;"))
        #     logger.info(f"Successfully set search_path to '{district_schema}'")
        # except Exception as e:
        #     logger.error(f"Failed to set search_path for schema '{district_schema}': {e}")
        #     # If the schema doesn't exist, this will raise an error.
        #     # This might indicate a provisioning issue for the tenant.
        #     raise HTTPException(
        #         status_code=500,
        #         detail=f"Database for district '{context.district_code}' is not accessible."
        #     )


# Global auth service instance (will be initialized with session factory)
auth_service: Optional[TenantAuthService] = None


def init_auth_service(session_factory):
    """Initialize the global auth service"""
    global auth_service
    auth_service = TenantAuthService(session_factory)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TenantContext:
    """Dependency to get current authenticated user with tenant context"""
    if not auth_service:
        raise HTTPException(status_code=500, detail="Auth service not initialized")

    token = credentials.credentials
    context = await auth_service.verify_token(token)

    if not context:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return context


async def get_current_user_with_db(
    context: TenantContext = Depends(get_current_user),
    db: Session = Depends(lambda: auth_service.session_factory()),
) -> tuple[TenantContext, Session]:
    """Dependency to get current user and set database context"""
    await auth_service.set_database_context(db, context)
    return context, db


def require_roles(
    required_roles: List[str], require_district: bool = True, require_any: bool = True
):
    """
    Decorator to enforce role-based access control

    Args:
        required_roles: List of roles that can access the endpoint
        require_district: Whether a district context is required
        require_any: If True, user needs ANY of the roles. If False, ALL roles required
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract context from function arguments (both positional and named)
            context = None

            # Check positional arguments
            for arg in args:
                if isinstance(arg, TenantContext):
                    context = arg
                    break

            # If not found in args, check named arguments
            if not context:
                for value in kwargs.values():
                    if isinstance(value, TenantContext):
                        context = value
                        break

            if not context:
                raise HTTPException(status_code=401, detail="Authentication required")

            # Check role requirements
            if require_any:
                has_permission = context.has_any_role(required_roles)
            else:
                has_permission = all(context.has_role(role) for role in required_roles)

            if not has_permission:
                logger.warning(
                    f"Access denied for user {context.username}: missing roles {required_roles}"
                )
                raise HTTPException(
                    status_code=403,
                    detail=f"Insufficient permissions. Required roles: {required_roles}",
                )

            # Check district requirement
            if require_district and not context.district_code:
                raise HTTPException(status_code=400, detail="District context required")

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_district_access(district_code_param: str = "district_code"):
    """
    Decorator to ensure user has access to the specified district

    Args:
        district_code_param: Name of the parameter containing the district code
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract context and district code
            context = None
            district_code = None

            # Check positional arguments
            for arg in args:
                if isinstance(arg, TenantContext):
                    context = arg
                    break

            # If not found in args, check named arguments
            if not context:
                for value in kwargs.values():
                    if isinstance(value, TenantContext):
                        context = value
                        break

            district_code = kwargs.get(district_code_param)

            if not context:
                raise HTTPException(status_code=401, detail="Authentication required")

            if district_code and not context.has_district_access(district_code):
                logger.warning(
                    f"Access denied for user {context.username} to district {district_code}"
                )
                raise HTTPException(
                    status_code=403, detail=f"Access denied to district {district_code}"
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


# Manager roles
MANAGER_ROLES = ADMIN_ROLES + [Roles.DISTRICT_MANAGER]

# Operator roles
OPERATOR_ROLES = MANAGER_ROLES + [Roles.DISTRICT_OPERATOR, Roles.FIELD_ENGINEER]

# All roles
ALL_ROLES = OPERATOR_ROLES + [
    Roles.DISTRICT_VIEWER,
    Roles.LEAD_ENGINEER,
    Roles.CONTRACTOR,
]


# Convenience decorators
def require_global_admin():
    """Decorator to require global admin access"""
    return require_roles(GLOBAL_ADMIN_ROLES, require_district=False)


def require_admin_roles():
    """Decorator to require any admin role (global or district)"""
    return require_roles(ADMIN_ROLES, require_district=False)


def require_system_admin():
    """Legacy decorator for backwards compatibility"""
    return require_global_admin()


# Audit logging function
async def log_tenant_activity(
    context: TenantContext,
    action: str,
    table_name: str = None,
    record_id: int = None,
    old_values: Dict = None,
    new_values: Dict = None,
    request: Request = None,
):
    """Log tenant activity for audit purposes"""
    db = None
    try:
        # Create database session directly instead of relying on auth_service
        from app.db.database import SessionLocal

        db = SessionLocal()

        # Extract request information if available
        ip_address = None
        user_agent = None
        endpoint = None
        query_params = None

        if request:
            # Use real client IP from middleware if available, otherwise fall back to request.client.host
            ip_address = getattr(request.state, "real_client_ip", None)
            if not ip_address and request.client:
                ip_address = request.client.host

            user_agent = request.headers.get("user-agent")
            endpoint = str(request.url.path)
            query_params = dict(request.query_params) if request.query_params else None

        # Insert audit log
        audit_query = text("""
            INSERT INTO tenant_audit_log (
                user_id, user_role, district_code, action, table_name, 
                record_id, old_values, new_values, ip_address, user_agent,
                endpoint, query_params
            ) VALUES (
                :user_id, :user_role, :district_code, :action, :table_name,
                :record_id, :old_values, :new_values, :ip_address, :user_agent,
                :endpoint, :query_params
            )
        """)

        # For failed logins with user_id=0, use NULL instead to avoid foreign key constraint violation
        user_id = context.user_id if context.user_id and context.user_id > 0 else None

        # Validate district_code exists in water_districts table to avoid foreign key constraint violation
        district_code = context.district_code
        if district_code:
            try:
                district_check = db.execute(
                    text(
                        "SELECT district_code FROM water_districts WHERE district_code = :district_code"
                    ),
                    {"district_code": district_code},
                ).first()
                if not district_check:
                    # District doesn't exist, set to NULL for failed logins or invalid districts
                    district_code = None
            except Exception as district_check_error:
                # If district validation fails, set to NULL to avoid foreign key constraint violation
                logger.warning(
                    f"Failed to validate district_code {district_code}: {district_check_error}"
                )
                district_code = None

        # Deduplicate roles and truncate to fit database constraint (50 characters max)
        unique_roles = list(set(context.roles))  # Remove duplicates
        user_role_str = ",".join(unique_roles)
        if len(user_role_str) > 50:
            user_role_str = user_role_str[:47] + "..."

        # Convert dict objects to JSON strings for database storage
        old_values_json = json.dumps(old_values) if old_values else None
        new_values_json = json.dumps(new_values) if new_values else None
        query_params_json = json.dumps(query_params) if query_params else None

        db.execute(
            audit_query,
            {
                "user_id": user_id,
                "user_role": user_role_str,
                "district_code": district_code,
                "action": action,
                "table_name": table_name,
                "record_id": record_id,
                "old_values": old_values_json,
                "new_values": new_values_json,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "endpoint": endpoint,
                "query_params": query_params_json,
            },
        )

        db.commit()

    except Exception as e:
        logger.error(f"Failed to log tenant activity: {str(e)}", exc_info=True)
        # Rollback if there's an error
        if db:
            try:
                db.rollback()
            except Exception:
                pass
        # Don't fail the request if audit logging fails
    finally:
        # Always close the database session
        if db:
            try:
                db.close()
            except Exception:
                pass
