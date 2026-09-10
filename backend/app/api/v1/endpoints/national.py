"""National executive overview API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.services.national.national_overview_service import build_national_overview, build_state_scorecard
from app.tenant_auth import Roles, TenantContext

router = APIRouter()


def _require_national_access(context: TenantContext) -> None:
    if context.is_global_admin or context.is_national_admin:
        return
    if context.has_role(Roles.NATIONAL_OBSERVER):
        return
    if context.has_any_role([Roles.STATE_ADMIN, Roles.OWW_PARTNER]):
        return
    raise HTTPException(status_code=403, detail="National view not authorized")


@router.get("/overview")
def national_overview(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_national_access(context)
    return build_national_overview(db)


@router.get("/states/{state_code}")
def state_scorecard(
    state_code: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_national_access(context)
    return build_state_scorecard(db, state_code)
