"""Per-record CRUD for workforce succession planning entities."""

from __future__ import annotations

import re
from datetime import date
from typing import Any, Dict, List, Optional, Tuple, Type

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.workforce_succession import (
    WORKFORCE_RECORD_STATES,
    WorkforceCertification,
    WorkforceCriticalFunction,
    WorkforceEmployee,
    WorkforceImportBatch,
    WorkforceKnowledgeArtifact,
    WorkforcePosition,
    WorkforceRoleCoverage,
    WorkforceSuccessionCandidate,
    WorkforceTransitionMilestone,
)
from app.services.workforce_succession.importer import (
    ENTITY_TYPES,
    ENTITY_TYPE_ORDER,
    _post_process_row,
    ingest_workforce_rows,
)

CODE_ENTITY_MAP: Dict[str, Tuple[Type, str, str]] = {
    "positions": (WorkforcePosition, "position_code", "Position #"),
    "employees": (WorkforceEmployee, "employee_code", "Employee #"),
    "critical_functions": (WorkforceCriticalFunction, "function_code", "Function #"),
}


class WorkforceCrudError(Exception):
    """Raised for validation failures during CRUD operations."""


def _next_display_code(
    db: Session, model: Type, district_code: str, code_column: str
) -> str:
    """Return the next numeric display code unique within a district."""
    rows = (
        db.query(getattr(model, code_column))
        .filter(model.district_code == district_code)
        .all()
    )
    max_num = 0
    for (raw,) in rows:
        if raw is None:
            continue
        text = str(raw).strip()
        if text.isdigit():
            max_num = max(max_num, int(text))
            continue
        match = re.search(r"(\d+)\s*$", text)
        if match:
            max_num = max(max_num, int(match.group(1)))
    return str(max_num + 1) if max_num > 0 else "1"


def _ensure_display_code(
    db: Session, entity_type: str, data: Dict[str, Any]
) -> Dict[str, Any]:
    if entity_type not in CODE_ENTITY_MAP:
        return data
    model, code_column, _ = CODE_ENTITY_MAP[entity_type]
    district_code = (data.get("district_code") or "").strip()
    if not district_code:
        return data
    current = data.get(code_column)
    if current is not None and str(current).strip() != "":
        return data
    payload = dict(data)
    payload[code_column] = _next_display_code(db, model, district_code, code_column)
    return payload


def _friendly_integrity_error(exc: IntegrityError, entity_type: str) -> str:
    message = str(getattr(exc, "orig", exc)).lower()
    if entity_type in CODE_ENTITY_MAP:
        _, _, label = CODE_ENTITY_MAP[entity_type]
        if "unique" in message or "duplicate" in message:
            return f"{label} already used in this district"
    return "A record with these values already exists in this district"


ENTITY_MODEL_MAP: Dict[str, Type] = {
    "positions": WorkforcePosition,
    "employees": WorkforceEmployee,
    "certifications": WorkforceCertification,
    "critical_functions": WorkforceCriticalFunction,
    "role_coverage": WorkforceRoleCoverage,
    "succession_candidates": WorkforceSuccessionCandidate,
    "knowledge_artifacts": WorkforceKnowledgeArtifact,
    "transition_milestones": WorkforceTransitionMilestone,
}

ENTITY_TYPE_TO_IMPORT: Dict[str, str] = {
    "position": "positions",
    "employee": "employees",
    "certification": "certifications",
    "critical_function": "critical_functions",
    "role_coverage": "role_coverage",
    "succession_candidate": "succession_candidates",
    "knowledge_artifact": "knowledge_artifacts",
    "transition_milestone": "transition_milestones",
}


def _get_model(entity_type: str) -> Type:
    if entity_type not in ENTITY_MODEL_MAP:
        raise WorkforceCrudError(
            f"unknown entity_type '{entity_type}', expected one of {ENTITY_TYPES}"
        )
    return ENTITY_MODEL_MAP[entity_type]


def _get_row(
    db: Session, model: Type, entity_id: int, district_code: str
) -> Any:
    row = (
        db.query(model)
        .filter(model.id == entity_id, model.district_code == district_code)
        .first()
    )
    if row is None:
        raise WorkforceCrudError("Record not found")
    return row


def _apply_fk_resolution(db: Session, entity_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    cleaned = dict(data)
    return _post_process_row(db, entity_type, cleaned)


def create_entity(
    db: Session, *, entity_type: str, data: Dict[str, Any]
) -> Any:
    model = _get_model(entity_type)
    district_code = (data.get("district_code") or "").strip()
    if not district_code:
        raise WorkforceCrudError("district_code is required")

    payload = _ensure_display_code(db, entity_type, {**data, "record_status": "active"})
    payload = _apply_fk_resolution(db, entity_type, payload)
    row = model(**{k: v for k, v in payload.items() if hasattr(model, k)})
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as exc:
        db.rollback()
        raise WorkforceCrudError(_friendly_integrity_error(exc, entity_type)) from exc
    except Exception as exc:
        db.rollback()
        raise WorkforceCrudError(str(exc)) from exc
    return row


def update_entity(
    db: Session,
    *,
    entity_type: str,
    entity_id: int,
    district_code: str,
    data: Dict[str, Any],
) -> Any:
    model = _get_model(entity_type)
    row = _get_row(db, model, entity_id, district_code)

    merged = {c.name: getattr(row, c.name) for c in row.__table__.columns}
    merged.update({k: v for k, v in data.items() if v is not None})
    merged["district_code"] = district_code
    resolved = _apply_fk_resolution(db, entity_type, merged)

    for key, value in resolved.items():
        if hasattr(row, key) and key not in ("id", "created_at"):
            setattr(row, key, value)

    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as exc:
        db.rollback()
        raise WorkforceCrudError(_friendly_integrity_error(exc, entity_type)) from exc
    except Exception as exc:
        db.rollback()
        raise WorkforceCrudError(str(exc)) from exc
    return row


def validate_district_workforce_data(
    db: Session, *, district_code: str
) -> Dict[str, Any]:
    """Run importer validation rules against live district rows (non-blocking)."""
    per_entity: Dict[str, Any] = {}
    all_issues: List[Dict[str, Any]] = []
    ok = True
    model_map = ENTITY_MODEL_MAP

    for entity in ENTITY_TYPE_ORDER:
        model = model_map[entity]
        rows_db = (
            db.query(model)
            .filter(
                model.district_code == district_code,
                model.record_status != "archived",
            )
            .all()
        )
        if not rows_db:
            per_entity[entity] = {
                "total_rows": 0,
                "valid_rows": 0,
                "invalid_rows": 0,
                "issues": [],
            }
            continue

        row_dicts: List[Dict[str, Any]] = []
        for row in rows_db:
            raw = {
                c.name: getattr(row, c.name)
                for c in row.__table__.columns
                if c.name not in ("created_at", "updated_at")
            }
            row_dicts.append(_post_process_row(db, entity, raw))

        summary, issues = ingest_workforce_rows(
            db,
            entity_type=entity,
            rows=row_dicts,
            target_district=district_code,
            commit=False,
        )
        per_entity[entity] = {
            "total_rows": summary["total_rows"],
            "valid_rows": summary["valid_rows"],
            "invalid_rows": summary["invalid_rows"],
            "issues": issues[:100],
        }
        if summary["invalid_rows"] > 0:
            ok = False
        for issue in issues:
            issue_copy = dict(issue)
            issue_copy["entity_type"] = entity
            all_issues.append(issue_copy)

    return {
        "ok": ok,
        "district_code": district_code,
        "entities": per_entity,
        "issues": all_issues[:300],
    }


def soft_delete_entity(
    db: Session, *, entity_type: str, entity_id: int, district_code: str
) -> Any:
    model = _get_model(entity_type)
    row = _get_row(db, model, entity_id, district_code)
    row.record_status = "archived"
    db.commit()
    db.refresh(row)
    return row


def _text_search_filter(query, model: Type, q: str):
    if not q:
        return query
    needle = f"%{q.strip().lower()}%"
    clauses = []
    for col in model.__table__.columns:
        if col.type.python_type is str:
            clauses.append(getattr(model, col.name).ilike(needle))
    if not clauses:
        return query
    return query.filter(or_(*clauses))


def list_entities(
    db: Session,
    *,
    entity_type: str,
    district_code: str,
    limit: int = 500,
    record_status: Optional[str] = None,
    q: Optional[str] = None,
    department: Optional[str] = None,
    position_code: Optional[str] = None,
    employee_code: Optional[str] = None,
    function_code: Optional[str] = None,
    expiring_within_days: Optional[int] = None,
    upcoming_only: Optional[bool] = None,
) -> List[Any]:
    model = _get_model(entity_type)
    query = db.query(model).filter(model.district_code == district_code)

    if record_status:
        query = query.filter(model.record_status == record_status)
    else:
        query = query.filter(model.record_status != "archived")

    if q:
        query = _text_search_filter(query, model, q)

    if department and hasattr(model, "department"):
        query = query.filter(model.department == department)
    if position_code and hasattr(model, "position_code"):
        query = query.filter(model.position_code == position_code)
    if employee_code and hasattr(model, "employee_code"):
        query = query.filter(model.employee_code == employee_code)
    if function_code and hasattr(model, "function_code"):
        query = query.filter(model.function_code == function_code)

    if expiring_within_days is not None and hasattr(model, "expiration_date"):
        cutoff = date.today().toordinal() + expiring_within_days
        query = query.filter(
            model.expiration_date.isnot(None),
            model.expiration_date <= date.fromordinal(cutoff),
        )

    if upcoming_only and hasattr(model, "status"):
        query = query.filter(model.status.in_(("planned", "in_progress", "blocked")))

    order_col = getattr(model, "id", None)
    if entity_type == "certifications" and hasattr(model, "expiration_date"):
        query = query.order_by(model.expiration_date.asc().nullslast())
    elif entity_type == "transition_milestones" and hasattr(model, "target_date"):
        query = query.order_by(model.target_date.asc().nullslast())
    elif entity_type == "knowledge_artifacts" and hasattr(model, "captured_date"):
        query = query.order_by(model.captured_date.desc().nullslast())
    elif order_col is not None:
        query = query.order_by(order_col.asc())

    return query.limit(limit).all()


def promote_import_batch(
    db: Session,
    *,
    batch_id: int,
    district_code: str,
    reviewer_user_id: Optional[int],
    review_notes: Optional[str] = None,
) -> WorkforceImportBatch:
    batch = (
        db.query(WorkforceImportBatch)
        .filter(
            WorkforceImportBatch.id == batch_id,
            WorkforceImportBatch.district_code == district_code,
        )
        .first()
    )
    if batch is None:
        raise WorkforceCrudError("Import batch not found")
    if batch.status not in ("staged", "partial"):
        raise WorkforceCrudError(f"Batch status '{batch.status}' cannot be promoted")

    batch.status = "promoted"
    batch.reviewer_user_id = reviewer_user_id
    batch.review_notes = review_notes
    from datetime import datetime

    batch.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(batch)
    return batch


def reject_import_batch(
    db: Session,
    *,
    batch_id: int,
    district_code: str,
    reviewer_user_id: Optional[int],
    review_notes: Optional[str] = None,
) -> WorkforceImportBatch:
    batch = (
        db.query(WorkforceImportBatch)
        .filter(
            WorkforceImportBatch.id == batch_id,
            WorkforceImportBatch.district_code == district_code,
        )
        .first()
    )
    if batch is None:
        raise WorkforceCrudError("Import batch not found")
    if batch.status in ("rejected",):
        raise WorkforceCrudError("Batch already rejected")

    batch.status = "rejected"
    batch.reviewer_user_id = reviewer_user_id
    batch.review_notes = review_notes
    from datetime import datetime

    batch.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(batch)
    return batch
