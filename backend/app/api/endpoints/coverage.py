"""Operator certification coverage vs facility plant class."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.api.endpoints.workforce_succession import (
    _require_district_auth,
    require_workforce_viewer,
)
from app.schemas.workforce_succession import CoverageSummaryResponse
from app.tenant_auth import TenantContext
from app.services.workforce_succession.coverage_summary_service import compute_coverage_summary

router = APIRouter()


@router.get("/summary", response_model=CoverageSummaryResponse)
async def coverage_summary(
    district_code: str = Query(..., min_length=1),
    facility_id: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    return CoverageSummaryResponse(
        **compute_coverage_summary(db, district_code=code, facility_id=facility_id)
    )
