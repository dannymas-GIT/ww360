"""Guided Succession Binder intake session persistence."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.workforce_succession import WorkforceBinderIntakeSession

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = ("draft",)

BINDER_INTAKE_STEP_IDS = (
    "welcome",
    "utility_profile",
    "operations_snapshot",
    "critical_roles",
    "retirement_risk",
    "succession_bench",
    "knowledge_transfer",
    "review",
)


class BinderIntakeNotFound(Exception):
    pass


class BinderIntakeConflict(Exception):
    pass


def _default_answers() -> Dict[str, Any]:
    return {
        "profile": "small_system",
        "contact_name": "",
        "contact_email": "",
        "use_live_data": True,
        "plant_count": 1,
        "largest_gaps": [],
        "gap_notes": "",
        "critical_roles": [],
        "use_continuity_coverage": True,
        "retirement_notes": "",
        "use_continuity_retirement": True,
        "retirement_entries": [],
        "succession_candidates": [],
        "use_continuity_bench": True,
        "knowledge_items": [],
    }


def parse_intake_answers(raw: Optional[str]) -> Dict[str, Any]:
    base = _default_answers()
    if not raw or not str(raw).strip():
        return base
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Corrupt binder intake answers; resetting")
        return base
    if not isinstance(data, dict):
        return base
    for key, default in base.items():
        if key not in data:
            continue
        val = data[key]
        if isinstance(default, list) and isinstance(val, list):
            base[key] = val
        elif isinstance(default, bool):
            base[key] = bool(val)
        elif isinstance(default, int):
            try:
                base[key] = int(val)
            except (TypeError, ValueError):
                pass
        elif isinstance(default, str):
            base[key] = str(val or "")
        else:
            base[key] = val
    return base


def _serialize_answers(answers: Dict[str, Any]) -> str:
    return json.dumps(answers, default=str)


def _parse_completed(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(x) for x in parsed]
    except json.JSONDecodeError:
        pass
    return []


def get_active_binder_intake(
    db: Session, *, district_code: str, user_id: int | None
) -> Optional[WorkforceBinderIntakeSession]:
    if user_id is None:
        return None
    return (
        db.query(WorkforceBinderIntakeSession)
        .filter(
            WorkforceBinderIntakeSession.district_code == district_code,
            WorkforceBinderIntakeSession.created_by_user_id == user_id,
            WorkforceBinderIntakeSession.status.in_(ACTIVE_STATUSES),
        )
        .order_by(WorkforceBinderIntakeSession.updated_at.desc())
        .first()
    )


def get_binder_intake_session(
    db: Session, *, session_id: int, user_id: int | None
) -> WorkforceBinderIntakeSession:
    row = db.query(WorkforceBinderIntakeSession).filter_by(id=session_id).first()
    if not row:
        raise BinderIntakeNotFound("Binder intake session not found")
    if user_id is not None and row.created_by_user_id != user_id:
        raise BinderIntakeNotFound("Binder intake session not found")
    return row


def ensure_binder_intake_session(
    db: Session, *, district_code: str, user_id: int | None
) -> Tuple[WorkforceBinderIntakeSession, bool]:
    existing = get_active_binder_intake(db, district_code=district_code, user_id=user_id)
    if existing:
        return existing, False
    row = WorkforceBinderIntakeSession(
        district_code=district_code,
        created_by_user_id=user_id,
        current_step="welcome",
        completed_steps="[]",
        status="draft",
        answers_json=_serialize_answers(_default_answers()),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, True


def update_binder_intake_session(
    db: Session,
    *,
    session_id: int,
    user_id: int | None,
    answers: Optional[Dict[str, Any]] = None,
    current_step: Optional[str] = None,
    completed_steps: Optional[List[str]] = None,
    binder_folder_id: Optional[str] = None,
    status: Optional[str] = None,
) -> WorkforceBinderIntakeSession:
    row = get_binder_intake_session(db, session_id=session_id, user_id=user_id)
    if row.status != "draft":
        raise BinderIntakeConflict("Cannot edit a completed or abandoned intake session.")
    if answers is not None:
        merged = parse_intake_answers(row.answers_json)
        merged.update(answers)
        row.answers_json = _serialize_answers(merged)
    if current_step is not None:
        row.current_step = current_step[:50]
    if completed_steps is not None:
        row.completed_steps = json.dumps(completed_steps)
    if binder_folder_id is not None:
        row.binder_folder_id = binder_folder_id
    if status is not None:
        if status not in WorkforceBinderIntakeSession.STATUS_VALUES:
            raise ValueError(f"invalid status {status}")
        row.status = status
        if status == "completed":
            row.completed_at = datetime.utcnow()
    row.last_saved_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def abandon_binder_intake_session(
    db: Session, *, session_id: int, user_id: int | None
) -> WorkforceBinderIntakeSession:
    row = get_binder_intake_session(db, session_id=session_id, user_id=user_id)
    if row.status == "completed":
        raise BinderIntakeConflict("Completed intake sessions cannot be abandoned.")
    row.status = "abandoned"
    row.last_saved_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def session_to_dict(row: WorkforceBinderIntakeSession) -> Dict[str, Any]:
    return {
        "id": row.id,
        "district_code": row.district_code,
        "created_by_user_id": row.created_by_user_id,
        "current_step": row.current_step,
        "completed_steps": _parse_completed(row.completed_steps),
        "status": row.status,
        "answers": parse_intake_answers(row.answers_json),
        "binder_folder_id": row.binder_folder_id,
        "last_saved_at": row.last_saved_at,
        "completed_at": row.completed_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }
