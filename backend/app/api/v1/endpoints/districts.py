"""District workforce summary for AquaSafe read-back."""

from __future__ import annotations

from datetime import date, timedelta

from app.api import deps
from app.api.endpoints.workforce_succession import _require_district_auth
from app.api.service_token_auth import (
    assert_service_token_district,
    extract_bearer_token,
    is_valid_service_token,
)
from app.db.database import get_db
from app.models.workforce_succession import (
    WorkforceCriticalFunction,
    WorkforceEmployee,
    WorkforcePosition,
    WorkforceRoleCoverage,
    WorkforceSuccessionCandidate,
)
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

router = APIRouter()

# Ready / developing readiness buckets for succession candidates.
_READY_DEVELOPING = ("now", "0-12mo", "12-24mo")


def _count_retirements_24mo(db: Session, district_code: str) -> int:
    """Active employees with retirement/departure within the next 24 months."""
    today = date.today()
    horizon = today + timedelta(days=365 * 2)
    return (
        db.query(func.count(WorkforceEmployee.id))
        .filter(
            WorkforceEmployee.district_code == district_code,
            WorkforceEmployee.is_active.is_(True),
            WorkforceEmployee.record_status == "active",
            or_(
                and_(
                    WorkforceEmployee.retirement_eligible_date.isnot(None),
                    WorkforceEmployee.retirement_eligible_date >= today,
                    WorkforceEmployee.retirement_eligible_date <= horizon,
                ),
                and_(
                    WorkforceEmployee.planned_departure_date.isnot(None),
                    WorkforceEmployee.planned_departure_date >= today,
                    WorkforceEmployee.planned_departure_date <= horizon,
                ),
            ),
        )
        .scalar()
        or 0
    )


def _count_critical_roles_without_successor(db: Session, district_code: str) -> int:
    """Critical functions lacking an active ready/developing succession candidate.

    A function is covered when any of its primary employees' position codes has an
    active succession candidate with readiness in now / 0-12mo / 12-24mo, or when
    an active backup/interim role-coverage row exists.
    """
    functions = (
        db.query(WorkforceCriticalFunction)
        .filter(
            WorkforceCriticalFunction.district_code == district_code,
            WorkforceCriticalFunction.record_status == "active",
        )
        .all()
    )
    if not functions:
        return 0

    coverage_rows = (
        db.query(WorkforceRoleCoverage)
        .filter(
            WorkforceRoleCoverage.district_code == district_code,
            WorkforceRoleCoverage.record_status == "active",
        )
        .all()
    )
    employees = (
        db.query(WorkforceEmployee)
        .filter(
            WorkforceEmployee.district_code == district_code,
            WorkforceEmployee.is_active.is_(True),
        )
        .all()
    )
    emp_position = {e.employee_code: e.position_code for e in employees if e.position_code}

    coverage_by_fn: dict[str, dict[str, list[str]]] = {}
    for c in coverage_rows:
        bucket = coverage_by_fn.setdefault(
            c.function_code, {"primary": [], "backup": [], "interim": []}
        )
        role = c.coverage_role or ""
        if role in bucket:
            bucket[role].append(c.employee_code)

    ready_targets = {
        row.target_position_code
        for row in db.query(WorkforceSuccessionCandidate)
        .filter(
            WorkforceSuccessionCandidate.district_code == district_code,
            WorkforceSuccessionCandidate.record_status == "active",
            WorkforceSuccessionCandidate.readiness_level.in_(_READY_DEVELOPING),
        )
        .all()
        if row.target_position_code
    }

    missing = 0
    for fn in functions:
        roles = coverage_by_fn.get(fn.function_code, {"primary": [], "backup": [], "interim": []})
        backups = roles.get("backup", []) + roles.get("interim", [])
        if backups:
            continue
        primary_positions = {
            emp_position[code]
            for code in roles.get("primary", [])
            if code in emp_position
        }
        if primary_positions & ready_targets:
            continue
        # Vacant critical function with no ready successor on any known position.
        missing += 1
    return missing


@router.get("/districts/{district_code}/workforce-summary")
async def workforce_summary(
    district_code: str,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(deps.tenant_bearer_optional),
):
    """AquaSafe read-back summary — service token or district-authorized JWT."""
    token = extract_bearer_token(authorization, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    code = (district_code or "").strip()
    if is_valid_service_token(token):
        code = assert_service_token_district(db, code)
    else:
        context = await deps.get_tenant_auth_service().verify_token(token)
        if not context:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        code = _require_district_auth(db, context, code)

    positions = (
        db.query(func.count(WorkforcePosition.id))
        .filter(WorkforcePosition.district_code == code)
        .scalar()
        or 0
    )
    vacant = (
        db.query(func.count(WorkforcePosition.id))
        .filter(
            WorkforcePosition.district_code == code,
            WorkforcePosition.is_vacant.is_(True),
        )
        .scalar()
        or 0
    )
    employees = (
        db.query(func.count(WorkforceEmployee.id))
        .filter(WorkforceEmployee.district_code == code)
        .scalar()
        or 0
    )
    if positions == 0 and employees == 0:
        raise HTTPException(status_code=404, detail="District not found or no workforce data")
    return {
        "district_code": code,
        "position_count": positions,
        "vacant_count": vacant,
        "employee_count": employees,
        "retirements_24mo": _count_retirements_24mo(db, code),
        "critical_roles_without_successor": _count_critical_roles_without_successor(db, code),
    }
