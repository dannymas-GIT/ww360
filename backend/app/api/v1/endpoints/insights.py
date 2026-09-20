"""WW360 Insights API — correlation overlays for national / partner / utility personas."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.services.insights.service import (
    CORRELATION_IDS,
    build_insights_overview,
    get_correlation,
    list_personas,
)
from app.tenant_auth import Roles, TenantContext

router = APIRouter()

DISTRICT_ROLES = [
    Roles.DISTRICT_ADMIN,
    Roles.DISTRICT_MANAGER,
    Roles.DISTRICT_VIEWER,
]


def _has_national_access(context: TenantContext) -> bool:
    if context.is_global_admin or context.is_national_admin:
        return True
    if context.has_role(Roles.NATIONAL_OBSERVER):
        return True
    if context.has_any_role([Roles.STATE_ADMIN, Roles.OWW_PARTNER]):
        return True
    return False


def _is_district_user(context: TenantContext) -> bool:
    if context.has_any_role(DISTRICT_ROLES):
        return True
    return bool(context.district_code or context.assigned_districts)


def _require_insights_access(
    context: TenantContext,
    *,
    state: str,
    persona: str | None = None,
) -> None:
    st = state.upper()[:2]
    if _has_national_access(context):
        return
    # District users: utility persona only, scoped to their active state
    if _is_district_user(context):
        if persona and persona.lower() not in ("utility", ""):
            raise HTTPException(
                status_code=403,
                detail="District users may only use persona=utility",
            )
        if context.active_state_code != st:
            raise HTTPException(
                status_code=403,
                detail="Not authorized for this state",
            )
        return
    raise HTTPException(status_code=403, detail="Insights view not authorized")


@router.get("/overview")
def insights_overview(
    state: str = Query("NY", min_length=2, max_length=2),
    persona: str = Query("jenny", pattern="^(jenny|regulator|utility)$"),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_insights_access(context, state=state, persona=persona)
    return build_insights_overview(db, state_code=state, persona=persona)


@router.get("/correlations/{correlation_id}")
def insights_correlation(
    correlation_id: str,
    state: str = Query("NY", min_length=2, max_length=2),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if correlation_id not in CORRELATION_IDS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown correlation_id; expected one of {CORRELATION_IDS}",
        )
    # Single correlation: national access OR district user for their state
    persona = "utility" if _is_district_user(context) and not _has_national_access(context) else None
    _require_insights_access(context, state=state, persona=persona)
    try:
        return get_correlation(db, correlation_id, state_code=state)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown correlation_id") from None


@router.get("/personas")
def insights_personas(
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if not (_has_national_access(context) or _is_district_user(context)):
        raise HTTPException(status_code=403, detail="Insights view not authorized")
    briefs = list_personas()
    if _is_district_user(context) and not _has_national_access(context):
        briefs = [b for b in briefs if b["id"] == "utility"]
    return {"personas": briefs}


@router.post("/refresh-overlays")
def refresh_overlays(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    """Global-admin only — refresh ACS MHI, NY DAC, and EJScreen overlay snapshots."""
    if context.is_impersonating and context.impersonation_mode == "preview":
        raise HTTPException(status_code=403, detail="IMPERSONATION_READ_ONLY")
    if not context.is_global_admin:
        raise HTTPException(status_code=403, detail="Global admin required")

    from app.services.national.acs_mhi_adapter import refresh_acs_mhi
    from app.services.national.ejscreen_adapter import refresh_ejscreen
    from app.services.national.ny_dac_adapter import refresh_ny_dac

    return {
        "census_acs": refresh_acs_mhi(db),
        "ny_dac": refresh_ny_dac(db),
        "epa_ejscreen": refresh_ejscreen(db),
    }
