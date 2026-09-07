"""Create and deliver in-app + email notifications."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


def create_notification(
    db: Session,
    *,
    user_id: int,
    title: str,
    body: str | None = None,
    district_code: str | None = None,
    category: str = "general",
    link_path: str | None = None,
    meta: dict[str, Any] | None = None,
    send_email: bool = False,
) -> Notification:
    row = Notification(
        user_id=user_id,
        district_code=district_code,
        category=category,
        title=title,
        body=body,
        link_path=link_path,
        meta=meta,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    if send_email:
        user = db.query(User).filter(User.id == user_id).one_or_none()
        if user and user.email:
            svc = EmailService()
            svc.send_email(
                to_emails=[user.email],
                subject=title,
                body_text=body or title,
                body_html=f"<p>{body or title}</p>",
            )
    return row
