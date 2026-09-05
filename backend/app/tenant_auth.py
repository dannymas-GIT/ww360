"""WW360 tenant context and role definitions."""

from __future__ import annotations

from typing import Any, List, Optional

import jwt
from fastapi import HTTPException, status

from app.core.config import settings
from app.services.auth_service import decode_ww360_token


def _normalize_str_list(raw: Optional[Any]) -> List[str]:
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
            else:
                s = str(item).strip()
                if s:
                    out.append(s)
        return list(dict.fromkeys(out))
    return []


class Roles:
    PLATFORM_ADMIN = "platform_admin"
    OWW_PARTNER = "oww_partner"
    CEU_ADMIN = "ceu_admin"
    CEU_MANAGER = "ceu_manager"
    CEU_USER = "ceu_user"
    DISTRICT_ADMIN = "district_admin"
    DISTRICT_MANAGER = "district_manager"
    DISTRICT_VIEWER = "district_viewer"


GLOBAL_ADMIN_ROLES = [Roles.PLATFORM_ADMIN]
PARTNER_ROLES = [Roles.OWW_PARTNER]
CEU_ROLES = [Roles.CEU_ADMIN, Roles.CEU_MANAGER, Roles.CEU_USER]


class TenantContext:
    def __init__(
        self,
        user_id: int,
        username: str,
        district_code: Optional[str] = None,
        roles: Optional[List[str]] = None,
        assigned_districts: Optional[List[str]] = None,
        is_system_admin: bool = False,
        modules: Optional[List[str]] = None,
        email: Optional[str] = None,
    ):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.district_code = district_code
        self.roles = _normalize_str_list(roles)
        self.assigned_districts = _normalize_str_list(assigned_districts)
        self.is_system_admin = is_system_admin
        self.modules = _normalize_str_list(modules) or ["workforce"]

        self.is_global_admin = is_system_admin or any(
            role in GLOBAL_ADMIN_ROLES for role in self.roles
        )

    def has_module(self, module_key: str) -> bool:
        if self.is_global_admin:
            return True
        return module_key in self.modules

    def has_role(self, role: str) -> bool:
        return role in self.roles or self.is_global_admin

    def has_any_role(self, roles: List[str]) -> bool:
        return any(role in self.roles for role in roles) or self.is_global_admin

    def has_district_access(self, district_code: str) -> bool:
        if self.is_global_admin:
            return True
        return (
            district_code == self.district_code
            or district_code in self.assigned_districts
        )


class TenantAuthService:
    """Verify WW360-issued JWTs and build tenant context."""

    async def verify_token(self, token: str) -> Optional[TenantContext]:
        try:
            payload = decode_ww360_token(token)
        except jwt.PyJWTError:
            return None

        if payload.get("iss") != "ww360":
            return None

        sub = payload.get("sub")
        try:
            user_id = int(sub) if sub is not None else 0
        except (TypeError, ValueError):
            return None

        districts = _normalize_str_list(payload.get("districts"))
        roles = _normalize_str_list(payload.get("roles"))
        is_global = any(r in GLOBAL_ADMIN_ROLES for r in roles)

        return TenantContext(
            user_id=user_id,
            username=str(payload.get("username") or ""),
            email=payload.get("email"),
            district_code=districts[0] if districts and not is_global else None,
            roles=roles,
            assigned_districts=districts,
            is_system_admin=is_global,
            modules=["workforce"],
        )

    async def set_database_context(self, db, context: TenantContext) -> None:
        """No-op for WW360 (no RLS session vars)."""
        return None


def build_user_token_payload(user) -> dict:
    """Build dict for mint_ww360_token from WW360User."""
    districts: List[str] = []
    if hasattr(user, "district_memberships"):
        districts = list(user.district_memberships or [])
    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "roles": list(user.roles or []),
        "district_memberships": districts,
    }
