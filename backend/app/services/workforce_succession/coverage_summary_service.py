"""Facility operator-grade coverage vs plant classification."""

from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.sync import ExtFacility
from app.models.workforce_succession import WorkforceCertification, WorkforceEmployee
from app.services.workforce_succession.ceu_requirements_wastewater import (
    grade_meets_required,
    grade_rank_ww,
)

FACILITY_TYPE_TO_PROGRAM = {
    "pws": "drinking_water",
    "wwtp": "wastewater",
    "collection_system": "wastewater",
}


def cert_program_for_facility_type(facility_type: Optional[str]) -> str:
    key = (facility_type or "pws").strip().lower()
    return FACILITY_TYPE_TO_PROGRAM.get(key, "drinking_water")


def _normalize_dw_grade(grade: Optional[str]) -> Optional[str]:
    if not grade:
        return None
    from app.services.workforce_succession.ceu_requirements import normalize_grade

    return normalize_grade(grade)


def _dw_grade_rank(grade: Optional[str]) -> int:
    order = {"D": 1, "C": 2, "IB": 3, "IIB": 4, "IA": 5, "IIA": 6, "IIIB": 5, "IIIA": 6, "IIIC": 2}
    norm = _normalize_dw_grade(grade)
    return order.get(norm or "", 0)


def grade_meets_required_dw(actual: Optional[str], required: Optional[str]) -> bool:
    if not actual or not required:
        return False
    return _dw_grade_rank(actual) >= _dw_grade_rank(required)


def compute_coverage_summary(
    db: Session,
    *,
    district_code: str,
    facility_id: str,
    today: Optional[date] = None,
) -> Dict:
    today = today or date.today()
    facility = (
        db.query(ExtFacility)
        .filter(
            ExtFacility.district_code == district_code,
            ExtFacility.facility_id == facility_id,
            ExtFacility.is_active.is_(True),
        )
        .first()
    )
    if not facility:
        return {
            "facility_id": facility_id,
            "district_code": district_code,
            "facility_type": None,
            "required_grade": None,
            "program": "drinking_water",
            "covered": False,
            "chief_operator": None,
            "warnings": ["facility_not_found"],
        }

    program = cert_program_for_facility_type(facility.facility_type)
    required_grade = facility.plant_class

    certs = (
        db.query(WorkforceCertification, WorkforceEmployee)
        .join(
            WorkforceEmployee,
            (WorkforceEmployee.district_code == WorkforceCertification.district_code)
            & (WorkforceEmployee.employee_code == WorkforceCertification.employee_code),
        )
        .filter(
            WorkforceCertification.district_code == district_code,
            WorkforceCertification.record_status == "active",
            WorkforceCertification.cert_program == program,
            WorkforceEmployee.record_status == "active",
            WorkforceEmployee.is_active.is_(True),
        )
        .all()
    )

    chief: Optional[Tuple[WorkforceCertification, WorkforceEmployee]] = None
    best_rank = -1
    for cert, emp in certs:
        grade = cert.certification_grade
        if program == "wastewater":
            rank = grade_rank_ww(grade)
        else:
            rank = _dw_grade_rank(grade)
        if rank > best_rank:
            best_rank = rank
            chief = (cert, emp)

    warnings: List[str] = []
    chief_payload = None
    covered = False

    if chief is None:
        warnings.append("no_chief_operator")
    else:
        cert, emp = chief
        chief_payload = {
            "employee_code": emp.employee_code,
            "employee_name": emp.full_name,
            "certification_grade": cert.certification_grade,
            "expiration_date": cert.expiration_date,
        }
        if required_grade:
            if program == "wastewater":
                covered = grade_meets_required(cert.certification_grade, required_grade)
            else:
                covered = grade_meets_required_dw(cert.certification_grade, required_grade)
            if not covered:
                warnings.append("grade_below_class")
        else:
            covered = True

        if cert.expiration_date:
            days_left = (cert.expiration_date - today).days
            if 0 <= days_left <= 90:
                warnings.append("expiring_90d")

    return {
        "facility_id": facility_id,
        "district_code": district_code,
        "facility_type": facility.facility_type,
        "required_grade": required_grade,
        "program": program,
        "covered": covered,
        "chief_operator": chief_payload,
        "warnings": warnings,
    }
