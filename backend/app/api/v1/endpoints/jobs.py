"""Public workforce job listings (federal USAJOBS). Available to all authenticated users."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api import deps
from app.services.national.usajobs_adapter import search_federal_operator_jobs
from app.tenant_auth import TenantContext

router = APIRouter()


@router.get("/federal")
def federal_job_openings(
    state: str | None = Query(default=None, max_length=2, description="Optional US state filter"),
    limit: int = Query(default=12, ge=1, le=50),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    """Live federal water/wastewater operator postings from USAJOBS."""
    del context  # any authenticated role may view public federal listings
    st = state or None
    return search_federal_operator_jobs(state=st, limit=limit)
