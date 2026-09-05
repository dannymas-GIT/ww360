"""CEU tracking and renewal-cycle analytics for NYS operator recertification."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.workforce_succession import (
    WorkforceCertification,
    WorkforceCeuRecord,
    WorkforceCeuVoucher,
    WorkforceEmployee,
)
from app.services.workforce_succession.ceu_requirements import (
    DEFAULT_CEU_REQUIREMENTS_BY_GRADE,
    RENEWAL_CYCLE_YEARS,
    mandatory_category_rules,
    normalize_grade,
    required_hours_for_grade as _required_hours_for_grade,
)

# Re-export for tests and district config overrides (workforce_alerts.ceu_requirements_by_grade).
__all__ = [
    "CONTACT_HOURS_PER_CEU",
    "DEFAULT_CEU_REQUIREMENTS_BY_GRADE",
    "RENEWAL_CYCLE_YEARS",
    "ceu_for_record",
    "contact_hours_for_record",
    "normalize_grade",
    "required_hours_for_grade",
    "mandatory_category_rules",
]

CONTACT_HOURS_PER_CEU = 10.0


@dataclass
class CeuOperatorSummary:
    employee_code: str
    employee_name: str
    certification_grade: Optional[str]
    certification_id: Optional[int]
    expiration_date: Optional[date]
    renewal_cycle_start: date
    renewal_cycle_end: date
    required_hours: float
    earned_hours: float
    remaining_hours: float
    percent_complete: float
    is_shortfall: bool
    days_until_cycle_end: int
    record_count: int
    voucher_count: int = 0
    records_missing_vouchers: int = 0
    earned_contact_hours: float = 0.0
    required_contact_hours: float = 0.0


def contact_hours_for_record(record: WorkforceCeuRecord) -> float:
    """Contact hours credited for one CEU row (matches DOH-352 export)."""
    if record.contact_hours is not None:
        return float(record.contact_hours)
    # When contact_hours is unset, ceu_hours holds contact hours (legacy imports/UI).
    return float(record.ceu_hours or 0)


def ceu_for_record(record: WorkforceCeuRecord) -> float:
    return contact_hours_for_record(record) / CONTACT_HOURS_PER_CEU


def required_hours_for_grade(
    grade: Optional[str], overrides: Optional[Dict[str, float]] = None
) -> float:
    return _required_hours_for_grade(grade, overrides)


def renewal_cycle_bounds(
    expiration_date: Optional[date], today: Optional[date] = None
) -> tuple[date, date]:
    today = today or date.today()
    if expiration_date:
        cycle_end = expiration_date
        cycle_start = expiration_date - timedelta(days=365 * RENEWAL_CYCLE_YEARS)
        return cycle_start, cycle_end
    cycle_end = date(today.year + 1, today.month, today.day)
    cycle_start = cycle_end - timedelta(days=365 * RENEWAL_CYCLE_YEARS)
    return cycle_start, cycle_end


def compute_operator_ceu_summary(
    db: Session,
    *,
    district_code: str,
    employee: WorkforceEmployee,
    certification: Optional[WorkforceCertification],
    today: Optional[date] = None,
    ceu_overrides: Optional[Dict[str, float]] = None,
) -> CeuOperatorSummary:
    today = today or date.today()
    grade = (getattr(employee, "operator_grade", None) or "").strip() or None
    if not grade and certification:
        grade = certification.certification_grade
    cert_id = certification.id if certification else None
    exp = certification.expiration_date if certification else None
    cycle_start, cycle_end = renewal_cycle_bounds(exp, today)
    required = required_hours_for_grade(grade, ceu_overrides)
    required_contact = required * CONTACT_HOURS_PER_CEU

    records = (
        db.query(WorkforceCeuRecord)
        .filter(
            WorkforceCeuRecord.district_code == district_code,
            WorkforceCeuRecord.employee_code == employee.employee_code,
            WorkforceCeuRecord.record_status == "active",
            WorkforceCeuRecord.completion_date >= cycle_start,
            WorkforceCeuRecord.completion_date <= cycle_end,
        )
        .all()
    )
    earned_contact = sum(contact_hours_for_record(r) for r in records)
    earned = earned_contact / CONTACT_HOURS_PER_CEU
    remaining = max(0.0, required - earned)
    pct = min(100.0, (earned / required * 100.0) if required > 0 else 100.0)
    days_left = (cycle_end - today).days
    record_ids = [r.id for r in records]
    voucher_count = 0
    records_missing_vouchers = 0
    if record_ids:
        voucher_count = (
            db.query(WorkforceCeuVoucher)
            .filter(WorkforceCeuVoucher.ceu_record_id.in_(record_ids))
            .count()
        )
        counts_by_record = dict(
            db.query(
                WorkforceCeuVoucher.ceu_record_id,
                func.count(WorkforceCeuVoucher.id),
            )
            .filter(WorkforceCeuVoucher.ceu_record_id.in_(record_ids))
            .group_by(WorkforceCeuVoucher.ceu_record_id)
            .all()
        )
        records_missing_vouchers = sum(
            1 for rid in record_ids if counts_by_record.get(rid, 0) == 0
        )

    return CeuOperatorSummary(
        employee_code=employee.employee_code,
        employee_name=employee.full_name,
        certification_grade=grade,
        certification_id=cert_id,
        expiration_date=exp,
        renewal_cycle_start=cycle_start,
        renewal_cycle_end=cycle_end,
        required_hours=required,
        earned_hours=earned,
        remaining_hours=remaining,
        percent_complete=round(pct, 1),
        is_shortfall=earned < required,
        days_until_cycle_end=days_left,
        record_count=len(records),
        voucher_count=voucher_count,
        records_missing_vouchers=records_missing_vouchers,
        earned_contact_hours=round(earned_contact, 2),
        required_contact_hours=round(required_contact, 2),
    )


def compute_district_ceu_summaries(
    db: Session,
    district_code: str,
    *,
    today: Optional[date] = None,
    ceu_overrides: Optional[Dict[str, float]] = None,
    ceu_shortfall_lead_days: int = 90,
    employee_code: Optional[str] = None,
) -> List[Dict]:
    today = today or date.today()
    emp_query = db.query(WorkforceEmployee).filter(
        WorkforceEmployee.district_code == district_code,
        WorkforceEmployee.record_status == "active",
        WorkforceEmployee.is_active.is_(True),
    )
    if employee_code:
        emp_query = emp_query.filter(WorkforceEmployee.employee_code == employee_code)
    employees = emp_query.all()
    certs = (
        db.query(WorkforceCertification)
        .filter(
            WorkforceCertification.district_code == district_code,
            WorkforceCertification.record_status == "active",
        )
        .all()
    )
    certs_by_employee: Dict[str, List[WorkforceCertification]] = {}
    for c in certs:
        certs_by_employee.setdefault(c.employee_code, []).append(c)

    out: List[Dict] = []
    for emp in employees:
        emp_certs = certs_by_employee.get(emp.employee_code, [])
        nys_certs = [
            c
            for c in emp_certs
            if (c.certification_type or "").lower().find("operator") >= 0
            or (c.issuing_authority or "").upper().find("DOH") >= 0
        ]
        target_cert = nys_certs[0] if nys_certs else (emp_certs[0] if emp_certs else None)
        summary = compute_operator_ceu_summary(
            db,
            district_code=district_code,
            employee=emp,
            certification=target_cert,
            today=today,
            ceu_overrides=ceu_overrides,
        )
        alert_window = summary.is_shortfall and 0 <= summary.days_until_cycle_end <= ceu_shortfall_lead_days
        out.append(
            {
                **summary.__dict__,
                "needs_ceu_alert": alert_window,
            }
        )
    out.sort(key=lambda row: row["days_until_cycle_end"])
    return out
