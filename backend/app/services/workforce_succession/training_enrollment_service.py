"""Operator enrollment in district scheduled training sessions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.workforce_succession import (
    WorkforceScheduledTraining,
    WorkforceTrainingEnrollment,
)
from app.services.workforce_succession.operator_scope import get_linked_employee
from app.services.workforce_succession.workforce_training_settings import (
    WorkforceTrainingSettings,
    load_workforce_training_settings,
)
from app.tenant_auth import TenantContext


class TrainingEnrollmentError(Exception):
    pass


def _active_enrollment_count(db: Session, training_id: int) -> int:
    return (
        db.query(WorkforceTrainingEnrollment)
        .filter(
            WorkforceTrainingEnrollment.scheduled_training_id == training_id,
            WorkforceTrainingEnrollment.status == "enrolled",
        )
        .count()
    )


def get_enrollment_for_employee(
    db: Session,
    *,
    training_id: int,
    employee_code: str,
) -> Optional[WorkforceTrainingEnrollment]:
    return (
        db.query(WorkforceTrainingEnrollment)
        .filter(
            WorkforceTrainingEnrollment.scheduled_training_id == training_id,
            WorkforceTrainingEnrollment.employee_code == employee_code,
        )
        .order_by(WorkforceTrainingEnrollment.id.desc())
        .first()
    )


def enrich_scheduled_training(
    db: Session,
    row: WorkforceScheduledTraining,
    *,
    employee_code: Optional[str] = None,
) -> Dict[str, Any]:
    count = _active_enrollment_count(db, row.id)
    payload = {
        **{c.name: getattr(row, c.name) for c in row.__table__.columns},
        "enrollment_count": count,
        "is_enrolled": False,
        "spots_remaining": None,
    }
    if row.capacity is not None:
        payload["spots_remaining"] = max(0, row.capacity - count)
    if employee_code:
        enr = get_enrollment_for_employee(
            db, training_id=row.id, employee_code=employee_code
        )
        payload["is_enrolled"] = enr is not None and enr.status == "enrolled"
    return payload


def list_my_enrollments(
    db: Session,
    *,
    district_code: str,
    employee_code: str,
) -> List[WorkforceTrainingEnrollment]:
    return (
        db.query(WorkforceTrainingEnrollment)
        .options(joinedload(WorkforceTrainingEnrollment.scheduled_training))
        .filter(
            WorkforceTrainingEnrollment.district_code == district_code,
            WorkforceTrainingEnrollment.employee_code == employee_code,
            WorkforceTrainingEnrollment.status == "enrolled",
        )
        .order_by(WorkforceTrainingEnrollment.enrolled_at.desc())
        .all()
    )


def enroll_operator(
    db: Session,
    context: TenantContext,
    *,
    district_code: str,
    training_id: int,
) -> WorkforceTrainingEnrollment:
    settings = load_workforce_training_settings(db, district_code)
    if not settings.operator_self_enroll_enabled:
        raise TrainingEnrollmentError(
            "Operator self-enrollment is disabled for this district"
        )

    emp = get_linked_employee(db, user_id=context.user_id, district_code=district_code)
    if emp is None:
        raise TrainingEnrollmentError("No workforce profile is linked to this login")

    training = (
        db.query(WorkforceScheduledTraining)
        .filter(
            WorkforceScheduledTraining.id == training_id,
            WorkforceScheduledTraining.district_code == district_code,
            WorkforceScheduledTraining.record_status == "active",
        )
        .first()
    )
    if training is None:
        raise TrainingEnrollmentError("Training session not found")
    if training.status != "scheduled":
        raise TrainingEnrollmentError("This session is not open for sign-up")

    existing = get_enrollment_for_employee(
        db, training_id=training_id, employee_code=emp.employee_code
    )
    if existing and existing.status == "enrolled":
        raise TrainingEnrollmentError("You are already signed up for this session")

    active = _active_enrollment_count(db, training_id)
    if training.capacity is not None and active >= training.capacity:
        raise TrainingEnrollmentError("This session is full")

    if existing:
        existing.status = "enrolled"
        existing.cancelled_at = None
        existing.enrolled_at = datetime.utcnow()
        existing.user_id = context.user_id
        db.commit()
        db.refresh(existing)
        return existing

    row = WorkforceTrainingEnrollment(
        district_code=district_code,
        scheduled_training_id=training_id,
        employee_code=emp.employee_code,
        user_id=context.user_id,
        status="enrolled",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def cancel_enrollment(
    db: Session,
    context: TenantContext,
    *,
    district_code: str,
    training_id: int,
) -> WorkforceTrainingEnrollment:
    emp = get_linked_employee(db, user_id=context.user_id, district_code=district_code)
    if emp is None:
        raise TrainingEnrollmentError("No workforce profile is linked to this login")

    enr = get_enrollment_for_employee(
        db, training_id=training_id, employee_code=emp.employee_code
    )
    if enr is None or enr.status != "enrolled":
        raise TrainingEnrollmentError("You are not signed up for this session")

    enr.status = "cancelled"
    enr.cancelled_at = datetime.utcnow()
    db.commit()
    db.refresh(enr)
    return enr
