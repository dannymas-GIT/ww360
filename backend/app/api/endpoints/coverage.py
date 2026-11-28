"""Operator certification coverage vs facility plant class."""

from __future__ import annotations

from app.api import deps
from app.api.endpoints.workforce_succession import (
    WORKFORCE_VIEWER_ROLES,
    _require_district_auth,
)
from app.api.service_token_auth import (
    assert_service_token_district,
    extract_bearer_token,
    is_valid_service_token,
)
from app.schemas.workforce_succession import CoverageSummaryResponse
from app.services.workforce_succession.coverage_summary_service import compute_coverage_summary
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/summary", response_model=CoverageSummaryResponse)
async def coverage_summary(
    district_code: str = Query(..., min_length=1),
    facility_id: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    authorization: str | None = Header(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(deps.tenant_bearer_optional),
):
    """Dual auth: user JWT (workforce viewer + district scope) or WW360_SERVICE_TOKEN."""
    token = extract_bearer_token(authorization, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if is_valid_service_token(token):
        code = assert_service_token_district(db, district_code)
    else:
        context = await deps.get_tenant_auth_service().verify_token(token)
        if not context:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not (
            context.is_global_admin
            or context.is_system_admin
            or context.has_any_role(list(WORKFORCE_VIEWER_ROLES))
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient workforce viewer role",
            )
        code = _require_district_auth(db, context, district_code)

    return CoverageSummaryResponse(
        **compute_coverage_summary(db, district_code=code, facility_id=facility_id)
    )
