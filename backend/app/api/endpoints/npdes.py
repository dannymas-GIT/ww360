"""NPDES / POTW landscape endpoints (ECHO ICIS-NPDES cache + ExtFacility)."""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.models.npdes_state_facility import NpdesStateFacility
from app.models.sync import ExtFacility
from app.services.national.npdes_bulk_ingest import refresh_all_states, refresh_state_landscape
from app.tenant_auth import TenantContext

logger = logging.getLogger(__name__)
router = APIRouter()


def _serialize_npdes(row: NpdesStateFacility) -> dict[str, Any]:
    return {
        "state_code": row.state_code,
        "npdes_id": row.npdes_id,
        "facility_name": row.facility_name,
        "county": row.county,
        "facility_type_code": row.facility_type_code,
        "permit_type": row.permit_type,
        "major_minor": row.major_minor,
        "sic_code": row.sic_code,
        "design_flow_mgd": row.design_flow_mgd,
        "total_design_flow": row.total_design_flow,
        "permit_effective": row.permit_effective,
        "permit_expiration": row.permit_expiration,
        "snc": row.snc,
        "qtrs_with_nc": row.qtrs_with_nc,
        "owner_type": row.owner_type,
        "plant_class": row.plant_class,
        "last_refreshed": row.last_refreshed.isoformat() if row.last_refreshed else None,
    }


def _serialize_ext_facility(row: ExtFacility) -> dict[str, Any]:
    return {
        "publisher": row.publisher,
        "facility_id": row.facility_id,
        "district_code": row.district_code,
        "facility_type": row.facility_type,
        "name": row.name,
        "state_code": row.state_code,
        "pwsid": row.pwsid,
        "npdes_id": row.npdes_id,
        "spdes_id": row.spdes_id,
        "plant_class": row.plant_class,
        "design_flow_mgd": row.design_flow_mgd,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "is_active": row.is_active,
        "version": row.version,
    }


@router.get("/landscape")
def npdes_landscape(
    state: str = Query(..., min_length=2, max_length=2),
    major_only: bool = Query(False),
    q: Optional[str] = Query(None, description="Name or NPDES id filter"),
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    """Cached POTW landscape for a state."""
    st = state.upper()
    query = db.query(NpdesStateFacility).filter(NpdesStateFacility.state_code == st)
    if major_only:
        query = query.filter(NpdesStateFacility.major_minor == "MAJOR")
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (NpdesStateFacility.facility_name.ilike(like))
            | (NpdesStateFacility.npdes_id.ilike(like))
            | (NpdesStateFacility.county.ilike(like))
        )
    rows = query.order_by(NpdesStateFacility.facility_name).limit(limit).all()
    majors = sum(1 for r in rows if (r.major_minor or "").upper() == "MAJOR")
    return {
        "state_code": st,
        "count": len(rows),
        "major_count": majors,
        "facilities": [_serialize_npdes(r) for r in rows],
    }


@router.get("/facilities/{npdes_id}")
def npdes_facility_detail(
    npdes_id: str,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    row = (
        db.query(NpdesStateFacility)
        .filter(NpdesStateFacility.npdes_id == npdes_id.strip().upper())
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="NPDES facility not found")
    return _serialize_npdes(row)


@router.post("/refresh")
def npdes_refresh(
    state: Optional[str] = Query(None, min_length=2, max_length=2),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    """Admin: refresh NPDES cache for one state or all states (bulk)."""
    if state:
        count = refresh_state_landscape(db, state.upper())
        return {"success": True, "state": state.upper(), "facilities_refreshed": count}
    results = refresh_all_states(db)
    return {"success": True, "results": results, "states_refreshed": len(results)}


@router.get("/ext-facilities")
def list_ext_facilities(
    district_code: Optional[str] = Query(None),
    facility_type: Optional[str] = Query(None, description="pws | wwtp | collection_system"),
    state_code: Optional[str] = Query(None, min_length=2, max_length=2),
    limit: int = Query(200, ge=1, le=2000),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    """District-linked facilities from AquaSafe / wastewater sync."""
    query = db.query(ExtFacility).filter(ExtFacility.is_active.is_(True))
    if district_code:
        query = query.filter(ExtFacility.district_code == district_code)
    if facility_type:
        query = query.filter(ExtFacility.facility_type == facility_type)
    if state_code:
        query = query.filter(ExtFacility.state_code == state_code.upper())
    rows = query.order_by(ExtFacility.name).limit(limit).all()
    return {"count": len(rows), "facilities": [_serialize_ext_facility(r) for r in rows]}
