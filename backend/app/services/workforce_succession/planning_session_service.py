"""Draft planning sessions for the workforce succession wizard."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.workforce_succession import (
    WorkforceImportBatch,
    WorkforcePlanningSession,
)
from app.services.workforce_succession.importer import (
    ENTITY_TYPES,
    ENTITY_TYPE_ORDER,
    ingest_workforce_rows,
)

logger = logging.getLogger(__name__)


class PlanningSessionNotFound(Exception):
    pass


class PlanningSessionConflict(Exception):
    pass


def _default_payload() -> Dict[str, Any]:
    return {
        "meta": {
            "contact_name": "",
            "contact_email": "",
            "planning_scope_notes": "",
        },
        **{k: [] for k in ENTITY_TYPES},
    }


def parse_session_payload(raw: Optional[str]) -> Dict[str, Any]:
    """Parse stored JSON into the canonical wizard payload shape."""

    return _parse_payload_inner(raw)


def _parse_payload_inner(raw: Optional[str]) -> Dict[str, Any]:
    if not raw or not raw.strip():
        return _default_payload()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Corrupt planning session payload; resetting structure")
        return _default_payload()
    if not isinstance(data, dict):
        return _default_payload()
    base = _default_payload()
    meta = data.get("meta")
    if isinstance(meta, dict):
        base["meta"].update(
            {
                k: str(meta.get(k) or "")
                for k in ("contact_name", "contact_email", "planning_scope_notes")
            }
        )
    for k in ENTITY_TYPES:
        rows = data.get(k)
        base[k] = rows if isinstance(rows, list) else []
    return base


def _serialize_payload(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, default=str)


def _ensure_district_on_rows(
    rows: List[Any], district_code: str
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        copy = dict(row)
        if not copy.get("district_code"):
            copy["district_code"] = district_code
        out.append(copy)
    return out


ACTIVE_UNPUBLISHED_STATUSES = ("draft", "ready")


def get_active_draft(
    db: Session, *, district_code: str, user_id: int
) -> Optional[WorkforcePlanningSession]:
    """Return the user's current unpublished planning session (draft or validated-ready)."""
    return (
        db.query(WorkforcePlanningSession)
        .filter(
            WorkforcePlanningSession.district_code == district_code,
            WorkforcePlanningSession.created_by_user_id == user_id,
            WorkforcePlanningSession.status.in_(ACTIVE_UNPUBLISHED_STATUSES),
        )
        .order_by(WorkforcePlanningSession.updated_at.desc())
        .first()
    )


def get_planning_session(
    db: Session, *, session_id: int, user_id: int
) -> WorkforcePlanningSession:
    row = db.query(WorkforcePlanningSession).filter_by(id=session_id).first()
    if row is None:
        raise PlanningSessionNotFound()
    if row.created_by_user_id != user_id:
        raise PlanningSessionNotFound()
    return row


def get_or_create_planning_session(
    db: Session,
    *,
    district_code: str,
    user_id: int,
    title: Optional[str] = None,
) -> Tuple[WorkforcePlanningSession, bool]:
    existing = get_active_draft(db, district_code=district_code, user_id=user_id)
    if existing:
        return existing, False
    sess = WorkforcePlanningSession(
        district_code=district_code,
        created_by_user_id=user_id,
        title=title,
        current_step="welcome",
        completed_steps=None,
        status="draft",
        payload_json=_serialize_payload(_default_payload()),
        validation_summary=None,
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return sess, True


def create_planning_session(
    db: Session,
    *,
    district_code: str,
    user_id: int,
    title: Optional[str] = None,
) -> WorkforcePlanningSession:
    if get_active_draft(db, district_code=district_code, user_id=user_id):
        raise PlanningSessionConflict(
            "An active draft already exists for this district; open or abandon it first."
        )
    sess, _ = get_or_create_planning_session(
        db, district_code=district_code, user_id=user_id, title=title
    )
    return sess


def update_planning_session(
    db: Session,
    *,
    session_id: int,
    user_id: int,
    payload: Optional[Dict[str, Any]] = None,
    current_step: Optional[str] = None,
    completed_steps: Optional[List[str]] = None,
    title: Optional[str] = None,
    status: Optional[str] = None,
) -> WorkforcePlanningSession:
    row = get_planning_session(db, session_id=session_id, user_id=user_id)
    if row.status not in ("draft", "ready"):
        raise PlanningSessionConflict("Cannot edit a published or abandoned session.")
    if payload is not None:
        merged = _parse_payload_inner(row.payload_json)
        if "meta" in payload and isinstance(payload["meta"], dict):
            merged["meta"].update(payload["meta"])
        for k in ENTITY_TYPES:
            if k in payload:
                merged[k] = payload[k] if isinstance(payload[k], list) else []
        row.payload_json = _serialize_payload(merged)
    if current_step is not None:
        row.current_step = current_step[:50]
    if completed_steps is not None:
        row.completed_steps = json.dumps(completed_steps)
    if title is not None:
        row.title = title[:255] if title else None
    if status is not None:
        if status not in WorkforcePlanningSession.STATUS_VALUES:
            raise ValueError(f"invalid status {status}")
        row.status = status
    row.last_saved_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def abandon_planning_session(
    db: Session, *, session_id: int, user_id: int
) -> WorkforcePlanningSession:
    row = get_planning_session(db, session_id=session_id, user_id=user_id)
    if row.status == "published":
        raise PlanningSessionConflict("Published sessions cannot be abandoned.")
    row.status = "abandoned"
    row.last_saved_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _run_validation(
    db: Session, *, district_code: str, payload: Dict[str, Any]
) -> Dict[str, Any]:
    per_entity: Dict[str, Any] = {}
    all_issues: List[Dict[str, Any]] = []
    ok = True
    for entity in ENTITY_TYPE_ORDER:
        raw_rows = payload.get(entity, [])
        if not isinstance(raw_rows, list) or not raw_rows:
            per_entity[entity] = {
                "total_rows": 0,
                "valid_rows": 0,
                "invalid_rows": 0,
                "issues": [],
            }
            continue
        rows = _ensure_district_on_rows(raw_rows, district_code)
        summary, issues = ingest_workforce_rows(
            db,
            entity_type=entity,
            rows=rows,
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
        "entities": per_entity,
        "issues": all_issues[:300],
    }


def validate_planning_session(
    db: Session, *, session_id: int, user_id: int
) -> Dict[str, Any]:
    row = get_planning_session(db, session_id=session_id, user_id=user_id)
    payload = _parse_payload_inner(row.payload_json)
    result = _run_validation(db, district_code=row.district_code, payload=payload)
    row.validation_summary = json.dumps(result, default=str)
    row.last_saved_at = datetime.utcnow()
    if result["ok"]:
        row.status = "ready"
    else:
        row.status = "draft"
    db.add(row)
    db.commit()
    db.refresh(row)
    return result


def publish_planning_session(
    db: Session,
    *,
    session_id: int,
    user_id: int,
    submitted_by_user_id: Optional[int],
) -> Dict[str, Any]:
    row = get_planning_session(db, session_id=session_id, user_id=user_id)
    if row.status == "published":
        raise PlanningSessionConflict("Session already published.")
    payload = _parse_payload_inner(row.payload_json)
    validation = _run_validation(db, district_code=row.district_code, payload=payload)
    if not validation["ok"]:
        row.validation_summary = json.dumps(validation, default=str)
        row.status = "draft"
        db.add(row)
        db.commit()
        raise ValueError("Validation failed; fix issues before publishing.")

    row.status = "publishing"
    db.add(row)
    db.flush()

    batch_ids: List[int] = []

    try:
        for entity in ENTITY_TYPE_ORDER:
            raw_rows = payload.get(entity, [])
            if not isinstance(raw_rows, list) or not raw_rows:
                continue
            rows = _ensure_district_on_rows(raw_rows, row.district_code)
            summary, issues = ingest_workforce_rows(
                db,
                entity_type=entity,
                rows=rows,
                target_district=row.district_code,
                commit=True,
            )
            status = "promoted"
            if summary["invalid_rows"] > 0:
                status = "partial" if summary["valid_rows"] > 0 else "rejected"

            batch = WorkforceImportBatch(
                district_code=row.district_code,
                entity_type=entity,
                original_filename="wizard_publish.json",
                submitted_by_user_id=submitted_by_user_id,
                total_rows=summary["total_rows"],
                rows_valid=summary["valid_rows"],
                rows_invalid=summary["invalid_rows"],
                rows_promoted=summary["promoted_rows"],
                status=status,
                validation_summary=json.dumps(
                    {"issues": issues[:200], "summary": summary, "source": "wizard"},
                    default=str,
                ),
            )
            db.add(batch)
            db.flush()
            batch_ids.append(batch.id)

        row.status = "published"
        row.submitted_at = datetime.utcnow()
        row.published_at = datetime.utcnow()
        row.published_batch_id = batch_ids[-1] if batch_ids else None
        row.validation_summary = json.dumps(validation, default=str)
        row.last_saved_at = datetime.utcnow()
        db.add(row)
        db.commit()
        db.refresh(row)

        return {
            "session_id": row.id,
            "district_code": row.district_code,
            "status": row.status,
            "batch_ids": batch_ids,
            "published_batch_id": row.published_batch_id,
        }
    except Exception:
        db.rollback()
        row = db.query(WorkforcePlanningSession).filter_by(id=session_id).first()
        if row:
            row.status = "draft"
            db.add(row)
            db.commit()
        raise


def list_planning_sessions(
    db: Session,
    *,
    district_code: str,
    user_id: int,
    limit: int = 20,
) -> List[WorkforcePlanningSession]:
    return (
        db.query(WorkforcePlanningSession)
        .filter(
            WorkforcePlanningSession.district_code == district_code,
            WorkforcePlanningSession.created_by_user_id == user_id,
        )
        .order_by(WorkforcePlanningSession.updated_at.desc())
        .limit(limit)
        .all()
    )
