"""Module entitlement resolution and guards for AquaSafe product modules."""

from __future__ import annotations

from typing import List, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import deps
from app.services.district_module_config import (
    ALL_MODULES,
    DEFAULT_DISTRICT_MODULES,
    MODULE_CORE,
    MODULE_LMS,
    MODULE_WORKFORCE,
    load_district_module_config,
)
from app.tenant_auth import TenantContext

MODULE_REGISTRY = {
    MODULE_CORE: {
        "key": MODULE_CORE,
        "display_name": "AquaSafe",
        "description": "Water quality monitoring and compliance platform",
    },
    MODULE_LMS: {
        "key": MODULE_LMS,
        "display_name": "The Reservoir",
        "description": "Learning management — a store of knowledge",
    },
    MODULE_WORKFORCE: {
        "key": MODULE_WORKFORCE,
        "display_name": "Workforce Continuity (CEU)",
        "description": "Workforce succession, CEU tracking, and training continuity",
    },
}


def _tables_exist(db: Session) -> bool:
    try:
        bind = db.get_bind()
        if bind.dialect.name == "sqlite":
            row = db.execute(
                text(
                    """
                    SELECT 1 FROM sqlite_master
                    WHERE type = 'table' AND name = 'user_module_access'
                    """
                )
            ).fetchone()
            return row is not None
        row = db.execute(
            text(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'user_module_access'
                """
            )
        ).fetchone()
        return row is not None
    except Exception:
        return False


def get_user_module_grants(db: Session, user_id: int) -> Set[str]:
    """Active per-user module grants."""
    if not _tables_exist(db):
        return set()

    rows = db.execute(
        text(
            """
            SELECT module_key
            FROM user_module_access
            WHERE user_id = :user_id AND is_active = true
            """
        ),
        {"user_id": user_id},
    ).fetchall()
    return {str(r[0]).strip() for r in rows if r[0] and str(r[0]).strip() in ALL_MODULES}


def resolve_user_modules(
    db: Session,
    user_id: int,
    district_code: str | None,
    *,
    is_global_admin: bool = False,
) -> List[str]:
    """
    Effective modules = district enabled_modules (if district) ∪ user grants.
    Global admins receive all modules.
    """
    if is_global_admin:
        return list(ALL_MODULES)

    modules: Set[str] = set()

    if district_code:
        district_cfg = load_district_module_config(db, district_code)
        modules.update(district_cfg.enabled_modules)
    else:
        modules.update(get_user_module_grants(db, user_id))
        if not modules:
            modules.update(DEFAULT_DISTRICT_MODULES)

    modules.update(get_user_module_grants(db, user_id))
    return sorted(modules)


def user_has_module(context: TenantContext, module_key: str) -> bool:
    if getattr(context, "is_global_admin", False) or context.is_system_admin:
        return True
    modules = getattr(context, "modules", None) or []
    return module_key in modules


def set_user_module_grants(
    db: Session,
    user_id: int,
    module_keys: List[str],
    granted_by: int,
) -> List[str]:
    """Replace active module grants for a user."""
    valid = [m for m in module_keys if m in ALL_MODULES]
    if not _tables_exist(db):
        return valid

    db.execute(
        text(
            """
            UPDATE user_module_access
            SET is_active = false
            WHERE user_id = :user_id
            """
        ),
        {"user_id": user_id},
    )

    for key in valid:
        db.execute(
            text(
                """
                INSERT INTO user_module_access (user_id, module_key, granted_by, is_active)
                VALUES (:user_id, :module_key, :granted_by, true)
                ON CONFLICT (user_id, module_key)
                DO UPDATE SET
                    is_active = true,
                    granted_by = EXCLUDED.granted_by,
                    granted_at = CURRENT_TIMESTAMP
                """
            ),
            {"user_id": user_id, "module_key": key, "granted_by": granted_by},
        )

    db.commit()
    return valid


def require_module(module_key: str):
    """FastAPI dependency factory — user must have the module in their context."""

    async def dependency(
        context: TenantContext = Depends(deps.get_current_tenant_user),
    ) -> TenantContext:
        if user_has_module(context, module_key):
            return context
        display = MODULE_REGISTRY.get(module_key, {}).get("display_name", module_key)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Module not enabled: {display}",
        )

    return dependency


def require_any_module(module_keys: List[str]):
    """FastAPI dependency factory — user must have at least one of the modules."""

    async def dependency(
        context: TenantContext = Depends(deps.get_current_tenant_user),
    ) -> TenantContext:
        if any(user_has_module(context, key) for key in module_keys):
            return context
        displays = ", ".join(
            MODULE_REGISTRY.get(key, {}).get("display_name", key)
            for key in module_keys
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Module not enabled: {displays}",
        )

    return dependency
