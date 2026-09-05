"""District scheduled training CRUD and CEU shortfall recommendations."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.workforce_succession import (
    WorkforceScheduledTraining,
    WorkforceTrainingCourse,
)
from app.services.workforce_succession.ceu_requirements import normalize_grade


class ScheduledTrainingError(Exception):
    """Validation failure for scheduled training operations."""


def _parse_target_grades(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [g.strip().upper() for g in value.split(",") if g.strip()]


def _grades_match(training_grades: Optional[str], operator_grade: Optional[str]) -> bool:
    targets = _parse_target_grades(training_grades)
    if not targets:
        return True
    norm = normalize_grade(operator_grade)
    if not norm:
        return False
    return norm in targets or any(norm.startswith(t) or t.startswith(norm) for t in targets)


def _cert_type_for_grade(grade: Optional[str]) -> Optional[str]:
    norm = normalize_grade(grade)
    if norm == "D":
        return "distribution"
    if norm in ("IA", "IIA", "IB", "IIB", "C"):
        return "treatment"
    return None


def list_scheduled_trainings(
    db: Session,
    *,
    district_code: str,
    upcoming_only: bool = False,
    cert_type: Optional[str] = None,
    status: Optional[str] = None,
    include_archived: bool = False,
) -> List[WorkforceScheduledTraining]:
    query = db.query(WorkforceScheduledTraining).filter(
        WorkforceScheduledTraining.district_code == district_code,
    )
    if not include_archived:
        query = query.filter(WorkforceScheduledTraining.record_status == "active")
    if status:
        query = query.filter(WorkforceScheduledTraining.status == status.strip())
    if cert_type:
        query = query.filter(WorkforceScheduledTraining.cert_type == cert_type.strip())
    if upcoming_only:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        query = query.filter(
            WorkforceScheduledTraining.status == "scheduled",
            WorkforceScheduledTraining.start_datetime >= now,
        )
    return query.order_by(WorkforceScheduledTraining.start_datetime.asc()).all()


def create_scheduled_training(db: Session, data: Dict[str, Any]) -> WorkforceScheduledTraining:
    district_code = (data.get("district_code") or "").strip()
    if not district_code:
        raise ScheduledTrainingError("district_code is required")
    if not (data.get("title") or "").strip():
        raise ScheduledTrainingError("title is required")
    if not (data.get("provider") or "").strip():
        raise ScheduledTrainingError("provider is required")
    if data.get("start_datetime") is None:
        raise ScheduledTrainingError("start_datetime is required")

    allowed = {c.name for c in WorkforceScheduledTraining.__table__.columns}
    payload = {k: v for k, v in data.items() if k in allowed}
    payload.setdefault("record_status", "active")
    row = WorkforceScheduledTraining(**payload)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_scheduled_training(
    db: Session,
    *,
    entity_id: int,
    district_code: str,
    data: Dict[str, Any],
) -> WorkforceScheduledTraining:
    row = (
        db.query(WorkforceScheduledTraining)
        .filter(
            WorkforceScheduledTraining.id == entity_id,
            WorkforceScheduledTraining.district_code == district_code,
        )
        .first()
    )
    if row is None:
        raise ScheduledTrainingError("Record not found")
    for key, value in data.items():
        if value is not None and hasattr(row, key):
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


def soft_delete_scheduled_training(
    db: Session, *, entity_id: int, district_code: str
) -> WorkforceScheduledTraining:
    row = (
        db.query(WorkforceScheduledTraining)
        .filter(
            WorkforceScheduledTraining.id == entity_id,
            WorkforceScheduledTraining.district_code == district_code,
        )
        .first()
    )
    if row is None:
        raise ScheduledTrainingError("Record not found")
    row.record_status = "archived"
    db.commit()
    db.refresh(row)
    return row


def _date_to_datetime(d: Optional[date], *, end_of_day: bool = False) -> Optional[datetime]:
    if d is None:
        return None
    t = time(17, 0) if end_of_day else time(9, 0)
    return datetime.combine(d, t)


def build_from_catalog_course(
    db: Session,
    *,
    district_code: str,
    course_id: int,
) -> Dict[str, Any]:
    course = db.query(WorkforceTrainingCourse).filter(WorkforceTrainingCourse.id == course_id).first()
    if course is None:
        raise ScheduledTrainingError("Catalog course not found")

    start_dt = _date_to_datetime(course.start_date)
    end_dt = _date_to_datetime(course.end_date, end_of_day=True) or start_dt
    if start_dt is None:
        raise ScheduledTrainingError(
            "This catalog course has no scheduled date. Add training manually or pick a dated session."
        )
    target_grades = course.grade or None
    delivery_mode = course.delivery_mode or "in_person"

    return {
        "district_code": district_code,
        "title": course.course_name,
        "provider": course.sponsor,
        "location": course.location_text or course.city,
        "delivery_mode": delivery_mode,
        "start_datetime": start_dt,
        "end_datetime": end_dt,
        "ceu_hours": course.contact_hours,
        "cert_program": course.cert_program,
        "cert_type": course.cert_type,
        "target_grades": target_grades,
        "category": course.course_category,
        "cost_text": course.cost_text,
        "registration_url": course.source_url,
        "contact_name": course.contact_name,
        "contact_email": course.contact_email,
        "contact_phone": course.contact_phone,
        "source_course_id": course.id,
        "status": "scheduled",
        "notes": course.description
        or f"Seeded from NYSDOH catalog course #{course.id}",
    }


def create_from_catalog_course(
    db: Session,
    *,
    district_code: str,
    course_id: int,
    overrides: Optional[Dict[str, Any]] = None,
) -> WorkforceScheduledTraining:
    payload = build_from_catalog_course(db, district_code=district_code, course_id=course_id)
    if overrides:
        payload.update({k: v for k, v in overrides.items() if v is not None})
    return create_scheduled_training(db, payload)


def recommend_trainings_for_operator(
    db: Session,
    *,
    district_code: str,
    certification_grade: Optional[str],
    remaining_hours: float,
    today: Optional[date] = None,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """Return upcoming district trainings that may close a CEU shortfall."""
    del today
    if remaining_hours <= 0:
        return []

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    expected_cert_type = _cert_type_for_grade(certification_grade)

    rows = (
        db.query(WorkforceScheduledTraining)
        .filter(
            WorkforceScheduledTraining.district_code == district_code,
            WorkforceScheduledTraining.record_status == "active",
            WorkforceScheduledTraining.status == "scheduled",
            WorkforceScheduledTraining.start_datetime >= now,
        )
        .order_by(WorkforceScheduledTraining.start_datetime.asc())
        .all()
    )

    recommendations: List[Dict[str, Any]] = []
    for row in rows:
        if expected_cert_type and row.cert_type != expected_cert_type:
            continue
        if not _grades_match(row.target_grades, certification_grade):
            continue
        recommendations.append(
            {
                "id": row.id,
                "title": row.title,
                "provider": row.provider,
                "location": row.location,
                "delivery_mode": row.delivery_mode,
                "start_datetime": row.start_datetime,
                "end_datetime": row.end_datetime,
                "ceu_hours": row.ceu_hours,
                "cert_type": row.cert_type,
                "target_grades": row.target_grades,
                "category": row.category,
                "registration_url": row.registration_url,
                "cost_text": row.cost_text,
            }
        )
        if len(recommendations) >= limit:
            break
    return recommendations
