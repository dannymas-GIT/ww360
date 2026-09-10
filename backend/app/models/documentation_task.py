"""Documentation tasks — operator assignments to capture process knowledge."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base_class import Base

TASK_STATUSES = (
    "assigned",
    "in_progress",
    "submitted",
    "changes_requested",
    "approved",
    "published",
    "overdue",
)


class DocumentationTask(Base):
    __tablename__ = "documentation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    assignee_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    critical_function_id = Column(
        Integer,
        ForeignKey("workforce_critical_functions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = Column(String(500), nullable=False)
    instructions = Column(Text, nullable=True)
    capture_mode = Column(String(32), nullable=True)
    due_at = Column(DateTime, nullable=True, index=True)
    status = Column(String(32), nullable=False, default="assigned", index=True)
    document_id = Column(String(36), nullable=True, index=True)
    reminder_50_sent_at = Column(DateTime, nullable=True)
    reminder_80_sent_at = Column(DateTime, nullable=True)
    due_day_sent_at = Column(DateTime, nullable=True)
    overdue_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    notes = relationship(
        "DocumentationTaskNote",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="DocumentationTaskNote.created_at",
    )


class DocumentationTaskNote(Base):
    __tablename__ = "documentation_task_notes"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(
        Integer,
        ForeignKey("documentation_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body = Column(Text, nullable=False)
    progress_pct = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    task = relationship("DocumentationTask", back_populates="notes")


class DocumentationGrant(Base):
    """Temporary recorder privilege for an operator."""

    __tablename__ = "documentation_grants"

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    granted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    allowed_modes = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


def ensure_documentation_task_schema(engine) -> None:
    return None
