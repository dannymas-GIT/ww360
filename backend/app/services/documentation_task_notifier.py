"""Daily reminders for documentation tasks (in-app + email)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.documentation_task import DocumentationTask
from app.models.user import User
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def run_documentation_task_notifier(db: Session) -> dict:
    now = _utcnow()
    sent = {"reminder_50": 0, "reminder_80": 0, "due_day": 0, "overdue": 0, "manager_digest": 0}
    open_statuses = ("assigned", "in_progress", "changes_requested", "overdue")

    tasks = (
        db.query(DocumentationTask)
        .filter(
            DocumentationTask.status.in_(open_statuses),
            DocumentationTask.due_at.isnot(None),
        )
        .all()
    )

    manager_digest: dict[str, list[DocumentationTask]] = {}

    for task in tasks:
        if not task.due_at:
            continue
        total = (task.due_at - task.created_at).total_seconds()
        if total <= 0:
            total = 86400
        elapsed = (now - task.created_at).total_seconds()
        pct = elapsed / total

        assignee = db.query(User).filter(User.id == task.assignee_user_id).one_or_none()
        if not assignee:
            continue

        if pct >= 0.5 and not task.reminder_50_sent_at:
            create_notification(
                db,
                user_id=task.assignee_user_id,
                district_code=task.district_code,
                category="documentation_task",
                title=f"Documentation task halfway: {task.title}",
                body=f"Due {task.due_at.date().isoformat()}",
                link_path="/dashboard",
                send_email=True,
            )
            task.reminder_50_sent_at = now
            sent["reminder_50"] += 1

        if pct >= 0.8 and not task.reminder_80_sent_at:
            create_notification(
                db,
                user_id=task.assignee_user_id,
                district_code=task.district_code,
                category="documentation_task",
                title=f"Documentation task due soon: {task.title}",
                body=f"Due {task.due_at.date().isoformat()}",
                link_path="/dashboard",
                send_email=True,
            )
            task.reminder_80_sent_at = now
            sent["reminder_80"] += 1

        if task.due_at.date() == now.date() and not task.due_day_sent_at:
            create_notification(
                db,
                user_id=task.assignee_user_id,
                district_code=task.district_code,
                category="documentation_task",
                title=f"Documentation task due today: {task.title}",
                link_path="/dashboard",
                send_email=True,
            )
            task.due_day_sent_at = now
            sent["due_day"] += 1

        if task.due_at < now and task.status != "overdue":
            task.status = "overdue"
            create_notification(
                db,
                user_id=task.assignee_user_id,
                district_code=task.district_code,
                category="documentation_task",
                title=f"Documentation task overdue: {task.title}",
                link_path="/dashboard",
                send_email=True,
            )
            task.overdue_sent_at = now
            sent["overdue"] += 1
            manager_digest.setdefault(task.district_code, []).append(task)

    for district_code, overdue_tasks in manager_digest.items():
        managers = (
            db.query(User)
            .filter(User.district_memberships.contains([district_code]))
            .all()
        )
        for mgr in managers:
            roles = set(mgr.roles or [])
            if not roles & {"district_manager", "district_admin", "ceu_manager", "workforce_manager"}:
                continue
            create_notification(
                db,
                user_id=mgr.id,
                district_code=district_code,
                category="documentation_task_digest",
                title=f"{len(overdue_tasks)} overdue documentation task(s)",
                body=", ".join(t.title for t in overdue_tasks[:5]),
                link_path="/dashboard",
                send_email=True,
            )
            sent["manager_digest"] += 1

    db.commit()
    logger.info("Documentation task notifier: %s", sent)
    return sent
