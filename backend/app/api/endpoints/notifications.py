"""In-app notification API."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.notification import Notification
from app.schemas.notification import NotificationRead, NotificationSummary
from app.tenant_auth import TenantContext

router = APIRouter()


@router.get("/summary", response_model=NotificationSummary)
def summary(
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == context.user_id, Notification.read_at.is_(None))
        .count()
    )
    return NotificationSummary(unread=unread)


@router.get("", response_model=list[NotificationRead])
def list_notifications(
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == context.user_id)
        .order_by(Notification.created_at.desc())
        .limit(100)
        .all()
    )


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_read(
    notification_id: int,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    row = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == context.user_id)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    row.read_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    db.query(Notification).filter(
        Notification.user_id == context.user_id, Notification.read_at.is_(None)
    ).update({Notification.read_at: datetime.utcnow()})
    db.commit()
    return {"ok": True}
