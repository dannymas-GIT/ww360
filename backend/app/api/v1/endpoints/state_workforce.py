"""State workforce metrics API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.services.state_workforce_service import build_state_workforce
from app.tenant_auth import Roles, TenantContext

router = APIRouter()


@router.get("/{state_code}/workforce")
def state_workforce(
    state_code: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    st = state_code.upper()[:2]
    if not (
        context.is_global_admin
        or context.is_national_admin
        or context.has_role(Roles.NATIONAL_OBSERVER)
        or context.active_state_code == st
        or context.has_any_role([Roles.STATE_ADMIN, Roles.OWW_PARTNER])
    ):
        raise HTTPException(status_code=403, detail="Not authorized for this state")
    return build_state_workforce(db, st)


@router.get("/{state_code}/continuity")
def state_continuity(
    state_code: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    data = build_state_workforce(db, state_code)
    return data.get("continuity_rollup") or {}
