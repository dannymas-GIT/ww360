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
    STATE_ADMIN = "state_admin"
    OWW_PARTNER = "oww_partner"
    NATIONAL_OBSERVER = "national_observer"
    CEU_ADMIN = "ceu_admin"
    CEU_MANAGER = "ceu_manager"
    CEU_USER = "ceu_user"
    DISTRICT_ADMIN = "district_admin"
    DISTRICT_MANAGER = "district_manager"
    DISTRICT_VIEWER = "district_viewer"


GLOBAL_ADMIN_ROLES = [Roles.PLATFORM_ADMIN]
PARTNER_ROLES = [Roles.OWW_PARTNER, Roles.STATE_ADMIN]
STATE_EXEC_ROLES = [Roles.OWW_PARTNER, Roles.STATE_ADMIN]
CEU_ROLES = [Roles.CEU_ADMIN, Roles.CEU_MANAGER, Roles.CEU_USER]

DEFAULT_STATE_CODE = "NY"


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
        active_state_code: str = DEFAULT_STATE_CODE,
        active_org_code: Optional[str] = None,
        is_national_admin: bool = False,
        orgs: Optional[List[dict[str, Any]]] = None,
        *,
        actor_user_id: Optional[int] = None,
        is_impersonating: bool = False,
        impersonation_mode: Optional[str] = None,
        impersonation_session_id: Optional[str] = None,
        impersonation_persona_key: Optional[str] = None,
    ):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.district_code = district_code
        self.roles = _normalize_str_list(roles)
        self.assigned_districts = _normalize_str_list(assigned_districts)
        self.is_system_admin = is_system_admin
        self.modules = _normalize_str_list(modules) or ["workforce"]
        self.active_state_code = (active_state_code or DEFAULT_STATE_CODE).upper()[:2]
        self.active_org_code = active_org_code
        self.is_national_admin = is_national_admin
        self.orgs = orgs or []
        self.actor_user_id = actor_user_id or user_id
        self.is_impersonating = is_impersonating
        self.impersonation_mode = impersonation_mode
        self.impersonation_session_id = impersonation_session_id
        self.impersonation_persona_key = impersonation_persona_key

        self.is_global_admin = any(role in GLOBAL_ADMIN_ROLES for role in self.roles)

    def has_module(self, module_key: str) -> bool:
        if self.is_global_admin:
            return True
        return module_key in self.modules

    def has_role(self, role: str) -> bool:
        if role == Roles.OWW_PARTNER and Roles.STATE_ADMIN in self.roles:
            return True
        if role == Roles.STATE_ADMIN and Roles.OWW_PARTNER in self.roles:
            return True
        return role in self.roles or self.is_global_admin

    def has_any_role(self, roles: List[str]) -> bool:
        expanded = set(roles)
        if Roles.OWW_PARTNER in expanded:
            expanded.add(Roles.STATE_ADMIN)
        if Roles.STATE_ADMIN in expanded:
            expanded.add(Roles.OWW_PARTNER)
        return any(role in self.roles for role in expanded) or self.is_global_admin

    def has_district_access(self, district_code: str) -> bool:
        if self.is_global_admin:
            return True
        return (
            district_code == self.district_code
            or district_code in self.assigned_districts
        )

    def is_state_exec(self) -> bool:
        return self.is_global_admin or self.has_any_role(list(STATE_EXEC_ROLES))

    def program_scope(self) -> str:
        from app.models.doc_document import program_scope_for_state

        return program_scope_for_state(self.active_state_code)


class TenantAuthService:
    """Verify WW360-issued JWTs and build tenant context."""

    async def verify_token(
        self,
        token: str,
        *,
        requested_state: str | None = None,
    ) -> Optional[TenantContext]:
        try:
            payload = decode_ww360_token(token)
        except jwt.PyJWTError:
            return None

        if payload.get("iss") != "ww360":
            return None

        sub = payload.get("sub")
        try:
            actor_user_id = int(sub) if sub is not None else 0
        except (TypeError, ValueError):
            return None

        act_as = payload.get("act_as")
        is_impersonating = isinstance(act_as, dict) and act_as.get("target_user_id")

        if is_impersonating:
            effective_user_id = int(act_as.get("target_user_id") or actor_user_id)
            districts = _normalize_str_list(act_as.get("districts"))
            roles = _normalize_str_list(act_as.get("roles"))
            orgs = act_as.get("orgs") or []
            active_state = str(act_as.get("active_state_code") or DEFAULT_STATE_CODE).upper()[:2]
            active_org = act_as.get("active_org_code")
            is_national = bool(act_as.get("is_national_admin"))
            username = str(act_as.get("target_username") or payload.get("username") or "")
            impersonation_mode = str(act_as.get("mode") or "preview")
            impersonation_session_id = act_as.get("session_id")
            impersonation_persona_key = act_as.get("persona_key")
        else:
            effective_user_id = actor_user_id
            districts = _normalize_str_list(payload.get("districts"))
            roles = _normalize_str_list(payload.get("roles"))
            orgs = payload.get("orgs") or []
            active_state = str(payload.get("active_state_code") or DEFAULT_STATE_CODE).upper()[:2]
            active_org = payload.get("active_org_code")
            is_national = bool(payload.get("is_national_admin"))
            username = str(payload.get("username") or "")
            impersonation_mode = None
            impersonation_session_id = None
            impersonation_persona_key = None

        if not isinstance(orgs, list):
            orgs = []

        is_global = any(r in GLOBAL_ADMIN_ROLES for r in roles)

        if requested_state:
            req = requested_state.upper()[:2]
            if is_global or is_national:
                active_state = req
            elif any(o.get("state_code") == req for o in orgs if isinstance(o, dict)):
                active_state = req
            elif Roles.OWW_PARTNER in roles and req == DEFAULT_STATE_CODE:
                active_state = req
            elif Roles.NATIONAL_OBSERVER in roles and req == "US":
                active_state = req

        return TenantContext(
            user_id=effective_user_id,
            username=username,
            email=payload.get("email"),
            district_code=districts[0] if districts and not is_global else None,
            roles=roles,
            assigned_districts=districts,
            is_system_admin=False,
            modules=["workforce"],
            active_state_code=active_state,
            active_org_code=active_org,
            is_national_admin=is_national,
            orgs=[o for o in orgs if isinstance(o, dict)],
            actor_user_id=actor_user_id,
            is_impersonating=bool(is_impersonating),
            impersonation_mode=impersonation_mode,
            impersonation_session_id=impersonation_session_id,
            impersonation_persona_key=impersonation_persona_key,
        )

    async def set_database_context(self, db, context: TenantContext) -> None:
        """No-op for WW360 (no RLS session vars)."""
        return None


def build_user_token_payload(user) -> dict:
    """Build dict for mint_ww360_token from WW360User (legacy, no jurisdiction)."""
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
