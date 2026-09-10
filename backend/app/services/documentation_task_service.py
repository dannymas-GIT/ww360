"""Documentation task business logic."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.documentation_task import (
    DocumentationGrant,
    DocumentationTask,
    DocumentationTaskNote,
)
from app.models.user import User
from app.models.workforce_succession import (
    WorkforceCriticalFunction,
    WorkforceEmployee,
    WorkforceRoleCoverage,
)
from app.schemas.documentation_task import (
    DocumentationGrantCreate,
    DocumentationTaskCreate,
    DocumentationTaskNoteCreate,
    DocumentationTaskSummary,
    DocumentationTaskUpdate,
    RecorderAccess,
)
from app.services.workforce_succession.workforce_alert_settings import (
    load_workforce_alert_settings,
)
from app.tenant_auth import TenantContext

OPEN_STATUSES = ("assigned", "in_progress", "changes_requested", "overdue")
MANAGER_ROLES = {
    "district_admin",
    "district_manager",
    "ceu_manager",
    "workforce_manager",
    "ceu_admin",
    "platform_admin",
    "oww_partner",
}
OPERATOR_ROLES = {"ceu_user", "district_operator", "workforce_operator"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _default_due_days(db: Session, district_code: str) -> int:
    settings = load_workforce_alert_settings(db, district_code)
    raw = getattr(settings, "documentation_task_default_days", None)
    if raw is not None:
        try:
            return max(1, int(raw))
        except (TypeError, ValueError):
            pass
    return 14


def _require_district(context: TenantContext, district_code: str) -> None:
    if not context.has_district_access(district_code):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to district")


def _is_manager(context: TenantContext) -> bool:
    return context.is_global_admin or bool(set(context.roles) & MANAGER_ROLES)


def _is_operator(context: TenantContext) -> bool:
    return bool(set(context.roles) & OPERATOR_ROLES) and not _is_manager(context)


def list_tasks_for_district(
    db: Session, context: TenantContext, district_code: str
) -> list[DocumentationTask]:
    _require_district(context, district_code)
    q = (
        db.query(DocumentationTask)
        .options(joinedload(DocumentationTask.notes))
        .filter(DocumentationTask.district_code == district_code)
    )
    if _is_operator(context):
        q = q.filter(DocumentationTask.assignee_user_id == context.user_id)
    return q.order_by(DocumentationTask.due_at.asc().nullslast(), DocumentationTask.id.desc()).all()


def list_my_tasks(db: Session, context: TenantContext) -> list[DocumentationTask]:
    return (
        db.query(DocumentationTask)
        .options(joinedload(DocumentationTask.notes))
        .filter(DocumentationTask.assignee_user_id == context.user_id)
        .order_by(DocumentationTask.due_at.asc().nullslast(), DocumentationTask.id.desc())
        .all()
    )


def create_task(
    db: Session,
    context: TenantContext,
    body: DocumentationTaskCreate,
) -> DocumentationTask:
    if not _is_manager(context):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Managers only")
    _require_district(context, body.district_code)
    due = body.due_at
    if due is None:
        due = _utcnow() + timedelta(days=_default_due_days(db, body.district_code))
    row = DocumentationTask(
        district_code=body.district_code,
        assignee_user_id=body.assignee_user_id,
        assigned_by=context.user_id,
        critical_function_id=body.critical_function_id,
        title=body.title,
        instructions=body.instructions,
        capture_mode=body.capture_mode,
        due_at=due,
        status="assigned",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_task(
    db: Session,
    context: TenantContext,
    task_id: int,
    body: DocumentationTaskUpdate,
) -> DocumentationTask:
    row = db.query(DocumentationTask).filter(DocumentationTask.id == task_id).one_or_none()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    _require_district(context, row.district_code)
    if _is_operator(context) and row.assignee_user_id != context.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your task")
    if _is_operator(context) and body.status and body.status not in (
        "in_progress",
        "submitted",
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid status for operator")
    if not _is_manager(context) and not _is_operator(context):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def add_task_note(
    db: Session,
    context: TenantContext,
    task_id: int,
    body: DocumentationTaskNoteCreate,
) -> DocumentationTaskNote:
    row = db.query(DocumentationTask).filter(DocumentationTask.id == task_id).one_or_none()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    _require_district(context, row.district_code)
    if _is_operator(context) and row.assignee_user_id != context.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your task")
    if not _is_manager(context) and not (
        _is_operator(context) and row.assignee_user_id == context.user_id
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
    note = DocumentationTaskNote(
        task_id=task_id,
        author_id=context.user_id,
        body=body.body,
        progress_pct=body.progress_pct,
    )
    db.add(note)
    if body.progress_pct is not None and row.status == "assigned":
        row.status = "in_progress"
    db.commit()
    db.refresh(note)
    return note


def submit_task(
    db: Session, context: TenantContext, task_id: int, document_id: str
) -> DocumentationTask:
    row = db.query(DocumentationTask).filter(DocumentationTask.id == task_id).one_or_none()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    if row.assignee_user_id != context.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your task")
    row.document_id = document_id
    row.status = "submitted"
    db.add(
        DocumentationTaskNote(
            task_id=task_id,
            author_id=context.user_id,
            body="Submitted tutorial draft for manager review.",
            progress_pct=100,
        )
    )
    db.commit()
    db.refresh(row)
    return row


def request_changes(
    db: Session, context: TenantContext, task_id: int, note: str
) -> DocumentationTask:
    if not _is_manager(context):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Managers only")
    row = db.query(DocumentationTask).filter(DocumentationTask.id == task_id).one_or_none()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    _require_district(context, row.district_code)
    row.status = "changes_requested"
    db.add(
        DocumentationTaskNote(
            task_id=task_id,
            author_id=context.user_id,
            body=note,
        )
    )
    db.commit()
    db.refresh(row)
    return row


def approve_task(db: Session, context: TenantContext, task_id: int) -> DocumentationTask:
    if not _is_manager(context):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Managers only")
    row = db.query(DocumentationTask).filter(DocumentationTask.id == task_id).one_or_none()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    _require_district(context, row.district_code)
    row.status = "approved"
    db.add(
        DocumentationTaskNote(
            task_id=task_id,
            author_id=context.user_id,
            body="Approved — ready to publish.",
        )
    )
    db.commit()
    db.refresh(row)
    return row


def mark_published(db: Session, task_id: int, document_id: str) -> None:
    row = (
        db.query(DocumentationTask)
        .filter(DocumentationTask.id == task_id, DocumentationTask.document_id == document_id)
        .one_or_none()
    )
    if row:
        row.status = "published"
        db.commit()


def task_summary(db: Session, context: TenantContext, district_code: str) -> DocumentationTaskSummary:
    _require_district(context, district_code)
    now = _utcnow()
    soon = now + timedelta(days=3)
    base = db.query(DocumentationTask).filter(DocumentationTask.district_code == district_code)
    open_count = base.filter(DocumentationTask.status.in_(OPEN_STATUSES)).count()
    due_soon = base.filter(
        DocumentationTask.status.in_(OPEN_STATUSES),
        DocumentationTask.due_at.isnot(None),
        DocumentationTask.due_at <= soon,
        DocumentationTask.due_at >= now,
    ).count()
    overdue = base.filter(DocumentationTask.status.in_(("overdue",) + OPEN_STATUSES)).filter(
        DocumentationTask.due_at.isnot(None),
        DocumentationTask.due_at < now,
    ).count()
    review = base.filter(DocumentationTask.status == "submitted").count()
    return DocumentationTaskSummary(
        open=open_count, due_soon=due_soon, overdue=overdue, review_queue=review
    )


def list_grants(db: Session, context: TenantContext, district_code: str) -> list[DocumentationGrant]:
    _require_district(context, district_code)
    if not _is_manager(context):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Managers only")
    return (
        db.query(DocumentationGrant)
        .filter(DocumentationGrant.district_code == district_code)
        .order_by(DocumentationGrant.created_at.desc())
        .all()
    )


def create_grant(
    db: Session, context: TenantContext, body: DocumentationGrantCreate
) -> DocumentationGrant:
    if not _is_manager(context):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Managers only")
    _require_district(context, body.district_code)
    row = DocumentationGrant(
        district_code=body.district_code,
        user_id=body.user_id,
        granted_by=context.user_id,
        expires_at=body.expires_at,
        allowed_modes=body.allowed_modes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_grant(db: Session, context: TenantContext, grant_id: int) -> None:
    row = db.query(DocumentationGrant).filter(DocumentationGrant.id == grant_id).one_or_none()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grant not found")
    if not _is_manager(context):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Managers only")
    _require_district(context, row.district_code)
    db.delete(row)
    db.commit()


def recorder_access(
    db: Session, context: TenantContext, district_code: str
) -> RecorderAccess:
    _require_district(context, district_code)
    now = _utcnow()
    grant = (
        db.query(DocumentationGrant)
        .filter(
            DocumentationGrant.district_code == district_code,
            DocumentationGrant.user_id == context.user_id,
            or_(DocumentationGrant.expires_at.is_(None), DocumentationGrant.expires_at >= now),
        )
        .order_by(DocumentationGrant.created_at.desc())
        .first()
    )
    open_tasks = (
        db.query(DocumentationTask.id)
        .filter(
            DocumentationTask.district_code == district_code,
            DocumentationTask.assignee_user_id == context.user_id,
            DocumentationTask.status.in_(OPEN_STATUSES),
        )
        .all()
    )
    open_ids = [t[0] for t in open_tasks]
    if _is_manager(context):
        return RecorderAccess(can_record=True, reason="manager", open_task_ids=open_ids)
    if grant or open_ids:
        return RecorderAccess(
            can_record=True,
            reason="grant" if grant else "open_task",
            active_grant=grant,
            open_task_ids=open_ids,
        )
    return RecorderAccess(can_record=False, reason="no_grant_or_task")


def maybe_create_task_from_coverage(
    db: Session,
    *,
    coverage: WorkforceRoleCoverage,
    assigned_by: int | None,
) -> DocumentationTask | None:
    if coverage.coverage_role not in ("primary", "backup"):
        return None
    employee = (
        db.query(WorkforceEmployee)
        .filter(
            WorkforceEmployee.id == coverage.employee_id,
            WorkforceEmployee.district_code == coverage.district_code,
        )
        .one_or_none()
    )
    if not employee or not employee.linked_aquasafe_user_id:
        return None
    fn = (
        db.query(WorkforceCriticalFunction)
        .filter(
            WorkforceCriticalFunction.id == coverage.function_id,
            WorkforceCriticalFunction.district_code == coverage.district_code,
        )
        .one_or_none()
    )
    fn_name = fn.function_name if fn else coverage.function_code
    existing = (
        db.query(DocumentationTask)
        .filter(
            DocumentationTask.district_code == coverage.district_code,
            DocumentationTask.assignee_user_id == employee.linked_aquasafe_user_id,
            DocumentationTask.critical_function_id == coverage.function_id,
            DocumentationTask.status.in_(OPEN_STATUSES + ("submitted", "approved")),
        )
        .first()
    )
    if existing:
        return None
    due = _utcnow() + timedelta(days=_default_due_days(db, coverage.district_code))
    row = DocumentationTask(
        district_code=coverage.district_code,
        assignee_user_id=employee.linked_aquasafe_user_id,
        assigned_by=assigned_by,
        critical_function_id=coverage.function_id,
        title=f"Document: {fn_name}",
        instructions=(
            f"Record a tutorial documenting how you perform “{fn_name}”. "
            "Include tools, safety checks, and handoff notes."
        ),
        capture_mode="screen",
        due_at=due,
        status="assigned",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def mark_overdue_tasks(db: Session) -> int:
    now = _utcnow()
    rows = (
        db.query(DocumentationTask)
        .filter(
            DocumentationTask.status.in_(("assigned", "in_progress", "changes_requested")),
            DocumentationTask.due_at.isnot(None),
            DocumentationTask.due_at < now,
        )
        .all()
    )
    for row in rows:
        row.status = "overdue"
    if rows:
        db.commit()
    return len(rows)
