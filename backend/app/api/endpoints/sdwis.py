"""SDWIS / EPA ECHO integration endpoints."""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.sdwis_enforcement_action import SDWISEnforcementAction
from app.models.sdwis_violation import SDWISViolation
from app.models.sdwis_district_remembered_pwsid import SDWISDistrictRememberedPwsid
from app.models.sdwis_water_system import SDWISWaterSystem
from app.schemas.sdwis import (
    SDWISEnforcementOut,
    SDWISComplianceSummaryOut,
    SDWISLinkRequest,
    SDWISLinkResponse,
    SDWISLookupRow,
    SDWISDistrictRememberedPwsidOut,
    SDWISDistrictRememberedPwsidPut,
    SDWISSyncResponse,
    SDWISystemDetailOut,
    SDWISViolationOut,
    SDWISWaterSystemOut,
    SDWISWorkforceInsightsOut,
)
from app.services.district_security_service import DistrictSecurityService
from app.services.sdwis_client import SDWISClient, SDWISClientError
from app.services.sdwis_state_refresh_service import refresh_state_landscape
from app.services.sdwis_sync_service import SDWISSyncService
from app.services.sdwis_workforce_insights import build_workforce_insights
from app.tenant_auth import TenantContext

logger = logging.getLogger(__name__)

router = APIRouter()

_lookup_cache: Dict[Tuple[str, str], Tuple[datetime, List[SDWISLookupRow]]] = {}
_LOOKUP_CACHE_TTL = timedelta(minutes=5)
_LOOKUP_CACHE_MAX_ENTRIES = 200


def _lookup_cache_get(state: str, q: str) -> Optional[List[SDWISLookupRow]]:
    key = (state.upper(), q.strip().lower())
    entry = _lookup_cache.get(key)
    if not entry:
        return None
    cached_at, rows = entry
    if datetime.utcnow() - cached_at > _LOOKUP_CACHE_TTL:
        _lookup_cache.pop(key, None)
        return None
    return rows


def _lookup_cache_put(state: str, q: str, rows: List[SDWISLookupRow]) -> None:
    key = (state.upper(), q.strip().lower())
    if len(_lookup_cache) >= _LOOKUP_CACHE_MAX_ENTRIES:
        oldest_key = min(_lookup_cache.items(), key=lambda item: item[1][0])[0]
        _lookup_cache.pop(oldest_key, None)
    _lookup_cache[key] = (datetime.utcnow(), rows)


def _authorized_district_codes(db: Session, context: TenantContext) -> Set[str]:
    return DistrictSecurityService(db).get_authorized_districts(context)


def _filter_systems_query(db: Session, context: TenantContext):
    q = db.query(SDWISWaterSystem)
    auth = _authorized_district_codes(db, context)
    if "*" in auth:
        return q
    codes = {c for c in auth if c}
    if not codes:
        return q.filter(False)
    return q.filter(SDWISWaterSystem.district_code.in_(list(codes)))


def _ensure_pws_access(db: Session, context: TenantContext, pwsid: str) -> SDWISWaterSystem:
    row = db.query(SDWISWaterSystem).filter(SDWISWaterSystem.pwsid == pwsid.upper()).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Water system not linked")
    auth = _authorized_district_codes(db, context)
    if "*" not in auth and row.district_code not in auth:
        raise HTTPException(status_code=403, detail="Not authorized for this water system")
    return row


@router.get("/workforce-insights", response_model=SDWISWorkforceInsightsOut)
def workforce_insights(
    state: str = Query("NY", min_length=2, max_length=2),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _ = context
    return build_workforce_insights(db, state.upper())


@router.post("/refresh-state")
def refresh_state(
    state: str = Query("NY", min_length=2, max_length=2),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    _ = context
    count = refresh_state_landscape(db, state.upper())
    return {"success": True, "state": state.upper(), "systems_refreshed": count}


@router.get("/district-remembered-pwsids", response_model=List[SDWISDistrictRememberedPwsidOut])
def list_district_remembered_pwsids(
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    auth = _authorized_district_codes(db, context)
    q = db.query(SDWISDistrictRememberedPwsid)
    if "*" not in auth:
        codes = {c for c in auth if c}
        if not codes:
            return []
        q = q.filter(SDWISDistrictRememberedPwsid.district_code.in_(list(codes)))
    return q.order_by(SDWISDistrictRememberedPwsid.district_code).all()


@router.put("/district-remembered-pwsids/{district_code}", response_model=SDWISDistrictRememberedPwsidOut)
def upsert_district_remembered_pwsid(
    district_code: str,
    body: SDWISDistrictRememberedPwsidPut,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    code = district_code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="district_code required")
    auth = _authorized_district_codes(db, context)
    if "*" not in auth and code not in auth:
        raise HTTPException(status_code=403, detail="Cannot set remembered PWSID for this district")

    pid = body.pwsid.strip().upper()
    if len(pid) < 7:
        raise HTTPException(status_code=400, detail="Invalid PWSID")

    now = datetime.utcnow()
    row = (
        db.query(SDWISDistrictRememberedPwsid)
        .filter(SDWISDistrictRememberedPwsid.district_code == code)
        .one_or_none()
    )
    if row:
        row.pwsid = pid
        row.updated_at = now
    else:
        row = SDWISDistrictRememberedPwsid(district_code=code, pwsid=pid, updated_at=now)
        db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save remembered PWSID") from e
    return row


@router.get("/systems", response_model=List[SDWISWaterSystemOut])
def list_linked_systems(
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return _filter_systems_query(db, context).order_by(SDWISWaterSystem.pwsid).all()


@router.get("/systems/{pwsid}", response_model=SDWISystemDetailOut)
def get_system_detail(
    pwsid: str,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    ws = _ensure_pws_access(db, context, pwsid)
    pid = ws.pwsid
    vq = db.query(SDWISViolation).filter(SDWISViolation.pwsid == pid)
    total_v = vq.count()
    open_v = vq.filter(
        (SDWISViolation.status.is_(None)) | (SDWISViolation.status != "Resolved")
    ).count()
    enf = db.query(SDWISEnforcementAction).filter(SDWISEnforcementAction.pwsid == pid).count()
    return SDWISystemDetailOut(
        system=SDWISWaterSystemOut.model_validate(ws),
        violation_count=total_v,
        open_violation_count=open_v,
        enforcement_count=enf,
        raw_compliance_status=ws.raw_compliance_status_json
        if isinstance(ws.raw_compliance_status_json, dict)
        else None,
    )


@router.get("/systems/{pwsid}/violations", response_model=List[SDWISViolationOut])
def list_violations(
    pwsid: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _ensure_pws_access(db, context, pwsid)
    pid = pwsid.upper()
    return (
        db.query(SDWISViolation)
        .filter(SDWISViolation.pwsid == pid)
        .order_by(SDWISViolation.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/systems/{pwsid}/enforcement-actions", response_model=List[SDWISEnforcementOut])
def list_enforcement(
    pwsid: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _ensure_pws_access(db, context, pwsid)
    pid = pwsid.upper()
    return (
        db.query(SDWISEnforcementAction)
        .filter(SDWISEnforcementAction.pwsid == pid)
        .order_by(SDWISEnforcementAction.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/systems/link", response_model=SDWISLinkResponse)
def link_water_system(
    body: SDWISLinkRequest,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    if not settings.SDWIS_SYNC_ENABLED:
        raise HTTPException(status_code=503, detail="SDWIS sync is disabled")

    district = (body.district_code or context.district_code or "").strip()
    if not district:
        raise HTTPException(status_code=400, detail="district_code required")

    sync = SDWISSyncService(db)
    try:
        ws, v_ct, e_ct = sync.sync_water_system_from_dfr(body.pwsid.strip(), district)
    except SDWISClientError as e:
        raise HTTPException(status_code=502, detail=f"EPA API error: {e}") from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    finally:
        sync.close()

    return SDWISLinkResponse(
        success=True,
        pwsid=ws.pwsid,
        message="Linked and synced from EPA ECHO",
        violations_synced=v_ct,
        enforcement_synced=e_ct,
    )


@router.post("/systems/{pwsid}/sync", response_model=SDWISSyncResponse)
def resync_water_system(
    pwsid: str,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if not settings.SDWIS_SYNC_ENABLED:
        raise HTTPException(status_code=503, detail="SDWIS sync is disabled")

    ws = _ensure_pws_access(db, context, pwsid)
    sync = SDWISSyncService(db)
    try:
        ws, v_ct, e_ct = sync.sync_water_system_from_dfr(ws.pwsid, ws.district_code)
    except SDWISClientError as e:
        raise HTTPException(status_code=502, detail=f"EPA API error: {e}") from e
    finally:
        sync.close()

    return SDWISSyncResponse(
        success=True,
        pwsid=ws.pwsid,
        violations_synced=v_ct,
        enforcement_synced=e_ct,
        last_synced_at=ws.last_synced_at,
    )


@router.get("/compliance-summary", response_model=SDWISComplianceSummaryOut)
def compliance_summary(
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    systems = _filter_systems_query(db, context).order_by(SDWISWaterSystem.pwsid).all()
    open_total = health = snc = 0
    for ws in systems:
        pid = ws.pwsid
        open_total += (
            db.query(SDWISViolation)
            .filter(SDWISViolation.pwsid == pid)
            .filter((SDWISViolation.status.is_(None)) | (SDWISViolation.status != "Resolved"))
            .count()
        )
        if (ws.health_flag or "").lower() == "yes":
            health += 1
        if (ws.qtrs_with_snc or 0) > 0:
            snc += 1

    return SDWISComplianceSummaryOut(
        systems_linked=len(systems),
        total_open_violations=open_total,
        systems_with_health_flag=health,
        systems_in_snc=snc,
        systems=[SDWISWaterSystemOut.model_validate(s) for s in systems],
    )


@router.get("/lookup", response_model=List[SDWISLookupRow])
def lookup_echo_systems(
    state: str = Query(..., min_length=2, max_length=2),
    q: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _ = db
    _ = context
    q_trim = (q or "").strip()
    if len(q_trim) < settings.SDWIS_LOOKUP_MIN_QUERY_LEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Search text must be at least {settings.SDWIS_LOOKUP_MIN_QUERY_LEN} characters.",
        )
    state_upper = state.upper()
    cached = _lookup_cache_get(state_upper, q_trim)
    if cached is not None:
        return cached

    client = SDWISClient()
    try:
        rows = client.lookup_water_systems(state=state_upper, name_query=q_trim)
    except SDWISClientError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e
    finally:
        client.close()

    out: List[SDWISLookupRow] = []
    for row in rows[:50]:
        pid = row.get("PWSId") or row.get("PWSID") or ""
        out.append(
            SDWISLookupRow(
                pwsid=str(pid),
                pws_name=row.get("PWSName"),
                state_code=row.get("StateCode"),
                population_served=str(row.get("PopulationServedCount"))
                if row.get("PopulationServedCount") is not None
                else None,
                snc=row.get("SNC"),
            )
        )
    _lookup_cache_put(state_upper, q_trim, out)
    return out
