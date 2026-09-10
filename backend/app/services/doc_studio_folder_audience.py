"""Role-based folder visibility for the WW360 platform library."""

from __future__ import annotations

from typing import Literal

from app.tenant_auth import TenantContext

FolderAudience = Literal["all", "operator", "manager", "partner"]

OPERATOR_ROLES = frozenset({"ceu_user", "district_operator", "workforce_operator"})
MANAGER_ROLES = frozenset(
    {"district_admin", "district_manager", "workforce_manager", "ceu_admin", "ceu_manager"}
)
PARTNER_ROLES = frozenset(
    {"oww_partner", "state_admin", "platform_admin", "admin", "national_observer"}
)


def visible_folder_audiences(context: TenantContext) -> set[str]:
    """Audiences this user may see. Higher roles inherit lower tiers."""
    roles = set(context.roles)
    visible: set[str] = {"all"}

    if context.is_global_admin or context.is_state_exec() or "national_observer" in roles:
        return {"all", "operator", "manager", "partner"}

    if roles & OPERATOR_ROLES or roles & MANAGER_ROLES or roles & PARTNER_ROLES:
        visible.add("operator")
    if roles & MANAGER_ROLES or roles & PARTNER_ROLES:
        visible.add("manager")
    if roles & PARTNER_ROLES:
        visible.add("partner")

    return visible


def folder_visible(context: TenantContext, audience: str | None) -> bool:
    return (audience or "all") in visible_folder_audiences(context)
