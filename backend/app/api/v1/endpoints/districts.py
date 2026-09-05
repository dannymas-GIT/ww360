"""District workforce summary for AquaSafe read-back."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.workforce_succession import (
    WorkforceEmployee,
    WorkforcePosition,
)

router = APIRouter()


@router.get("/districts/{district_code}/workforce-summary")
def workforce_summary(district_code: str, db: Session = Depends(get_db)):
    positions = (
        db.query(func.count(WorkforcePosition.id))
        .filter(WorkforcePosition.district_code == district_code)
        .scalar()
        or 0
    )
    vacant = (
        db.query(func.count(WorkforcePosition.id))
        .filter(
            WorkforcePosition.district_code == district_code,
            WorkforcePosition.is_vacant.is_(True),
        )
        .scalar()
        or 0
    )
    employees = (
        db.query(func.count(WorkforceEmployee.id))
        .filter(WorkforceEmployee.district_code == district_code)
        .scalar()
        or 0
    )
    if positions == 0 and employees == 0:
        raise HTTPException(status_code=404, detail="District not found or no workforce data")
    return {
        "district_code": district_code,
        "position_count": positions,
        "vacant_count": vacant,
        "employee_count": employees,
        "retirements_24mo": 0,
        "critical_roles_without_successor": 0,
    }
