"""Tenant-scoped helpers (district list for the signed-in user)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.water_district import WaterDistrict
from app.services.district_security_service import DistrictSecurityService
from app.tenant_auth import TenantContext

router = APIRouter()


@router.get("/tenant/districts")
def list_tenant_districts(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    auth = DistrictSecurityService(db).get_authorized_districts(context)
    q = db.query(WaterDistrict).filter(WaterDistrict.is_active.is_(True))
    if "*" not in auth:
        codes = {c for c in auth if c}
        if not codes:
            return {"districts": []}
        q = q.filter(WaterDistrict.district_code.in_(list(codes)))
    rows = q.order_by(WaterDistrict.district_name).all()
    return {
        "districts": [
            {"code": d.district_code, "name": d.district_name, "state_code": d.state_code}
            for d in rows
        ]
    }
