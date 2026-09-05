"""Mock Learning Stream catalog courses (import-style reference data)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Tuple

from sqlalchemy.orm import Session

from app.models.workforce_succession import WorkforceScheduledTraining, WorkforceTrainingCourse
from app.services.workforce_succession.scheduled_training_service import create_from_catalog_course
from app.services.workforce_succession.training_scraper import compute_natural_key_hash

LEARNING_STREAM_SOURCE = "Learning Stream"

MOCK_LEARNING_STREAM_COURSES: List[Dict[str, Any]] = [
    {
        "course_name": "Distribution System Operations — Grade D Renewal",
        "sponsor": "One Water Workforce (Learning Stream)",
        "cert_type": "distribution",
        "course_category": "renewal",
        "grade": "D",
        "contact_hours": 6.0,
        "delivery_mode": "virtual",
        "delivery_type_label": "Live online",
        "city": "Virtual",
        "county": "Statewide",
        "location_text": "Learning Stream live classroom",
        "cost_text": "$95 OWW member",
        "description": "Imported from Learning Stream — distribution renewal core topics and NYS rule updates.",
        "contact_name": "OWW Training Desk",
        "contact_email": "training@onewaterworkforce.org",
        "days_from_now": 21,
        "duration_days": 1,
    },
    {
        "course_name": "Water Treatment Plant Operations — Grades A & B",
        "sponsor": "One Water Workforce (Learning Stream)",
        "cert_type": "treatment",
        "course_category": "renewal",
        "grade": "A, B",
        "contact_hours": 8.0,
        "delivery_mode": "in_person",
        "delivery_type_label": "In person",
        "city": "Hauppauge",
        "county": "Suffolk",
        "location_text": "OWW Training Center, 999 Motor Parkway",
        "cost_text": "$125 OWW member",
        "description": "Imported from Learning Stream — treatment operations, safety, and regulatory refresh.",
        "contact_name": "OWW Training Desk",
        "contact_email": "training@onewaterworkforce.org",
        "days_from_now": 35,
        "duration_days": 1,
    },
    {
        "course_name": "Cross-Connection & Backflow Awareness",
        "sponsor": "One Water Workforce (Learning Stream)",
        "cert_type": "backflow",
        "course_category": "mandatory",
        "grade": "All grades",
        "contact_hours": 3.0,
        "delivery_mode": "hybrid",
        "delivery_type_label": "Hybrid",
        "city": "Virtual + Hauppauge",
        "county": "Suffolk",
        "location_text": "Morning virtual, afternoon lab optional",
        "cost_text": "$75 OWW member",
        "description": "Imported from Learning Stream — cross-connection control and backflow prevention essentials.",
        "contact_name": "OWW Training Desk",
        "contact_email": "training@onewaterworkforce.org",
        "days_from_now": 49,
        "duration_days": 1,
    },
    {
        "course_name": "Emergency Response & Contamination Events",
        "sponsor": "One Water Workforce (Learning Stream)",
        "cert_type": "treatment",
        "course_category": "mandatory",
        "grade": "IA, IB",
        "contact_hours": 4.0,
        "delivery_mode": "virtual",
        "delivery_type_label": "Live online",
        "city": "Virtual",
        "county": "Statewide",
        "location_text": "Learning Stream live classroom",
        "cost_text": "$85 OWW member",
        "description": "Imported from Learning Stream — incident response, public notification, and recovery planning.",
        "contact_name": "OWW Training Desk",
        "contact_email": "training@onewaterworkforce.org",
        "days_from_now": 63,
        "duration_days": 1,
    },
    {
        "course_name": "Leadership for Water Supervisors",
        "sponsor": "One Water Workforce (Learning Stream)",
        "cert_type": "treatment",
        "course_category": "general",
        "grade": "Supervisor",
        "contact_hours": 5.0,
        "delivery_mode": "in_person",
        "delivery_type_label": "In person",
        "city": "Albany",
        "county": "Albany",
        "location_text": "Capital District training room",
        "cost_text": "$110 OWW member",
        "description": "Imported from Learning Stream — crew leadership, coverage planning, and handoff readiness.",
        "contact_name": "OWW Training Desk",
        "contact_email": "training@onewaterworkforce.org",
        "days_from_now": 77,
        "duration_days": 2,
    },
]


def _course_row(spec: Dict[str, Any]) -> Dict[str, Any]:
    today = date.today()
    start = today + timedelta(days=int(spec["days_from_now"]))
    end = start + timedelta(days=max(0, int(spec.get("duration_days", 1)) - 1))
    row = {
        "state": "NY",
        "source": LEARNING_STREAM_SOURCE,
        "cert_program": "drinking_water",
        "cert_type": spec["cert_type"],
        "course_category": spec["course_category"],
        "sponsor": spec["sponsor"],
        "course_name": spec["course_name"],
        "grade": spec.get("grade"),
        "start_date": start,
        "end_date": end,
        "cost_text": spec.get("cost_text"),
        "contact_name": spec.get("contact_name"),
        "contact_email": spec.get("contact_email"),
        "county": spec.get("county"),
        "city": spec.get("city"),
        "location_text": spec.get("location_text"),
        "delivery_mode": spec.get("delivery_mode"),
        "delivery_type_label": spec.get("delivery_type_label"),
        "contact_hours": spec.get("contact_hours"),
        "description": spec.get("description"),
        "source_url": "https://learningstream.onewaterworkforce.org/courses",
        "source_anchor": spec["course_name"][:80],
        "is_active": True,
    }
    row["natural_key_hash"] = compute_natural_key_hash(row)
    return row


def seed_learning_stream_catalog(db: Session) -> Tuple[int, int]:
    """Upsert mock Learning Stream courses. Returns (added, updated)."""
    added = 0
    updated = 0
    for spec in MOCK_LEARNING_STREAM_COURSES:
        row = _course_row(spec)
        existing = (
            db.query(WorkforceTrainingCourse)
            .filter(WorkforceTrainingCourse.natural_key_hash == row["natural_key_hash"])
            .first()
        )
        if existing is None:
            db.add(WorkforceTrainingCourse(**row))
            added += 1
        else:
            for key, value in row.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            existing.last_seen_at = datetime.utcnow()
            updated += 1
    db.commit()
    return added, updated


def seed_learning_stream_district_sessions(
    db: Session,
    *,
    district_code: str,
    limit: int = 5,
) -> int:
    """Create district scheduled trainings from Learning Stream catalog (idempotent)."""
    courses = (
        db.query(WorkforceTrainingCourse)
        .filter(
            WorkforceTrainingCourse.source == LEARNING_STREAM_SOURCE,
            WorkforceTrainingCourse.is_active.is_(True),
        )
        .order_by(WorkforceTrainingCourse.start_date.asc())
        .limit(limit)
        .all()
    )
    created = 0
    for course in courses:
        exists = (
            db.query(WorkforceScheduledTraining)
            .filter(
                WorkforceScheduledTraining.district_code == district_code,
                WorkforceScheduledTraining.source_course_id == course.id,
                WorkforceScheduledTraining.record_status == "active",
            )
            .first()
        )
        if exists:
            continue
        create_from_catalog_course(db, district_code=district_code, course_id=course.id)
        row = (
            db.query(WorkforceScheduledTraining)
            .filter(
                WorkforceScheduledTraining.district_code == district_code,
                WorkforceScheduledTraining.source_course_id == course.id,
            )
            .order_by(WorkforceScheduledTraining.id.desc())
            .first()
        )
        if row and row.notes:
            row.notes = f"{row.notes} · Imported from Learning Stream"
        elif row:
            row.notes = "Imported from Learning Stream"
        created += 1
    db.commit()
    return created
