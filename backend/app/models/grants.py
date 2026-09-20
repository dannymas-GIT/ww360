"""Grants Studio models — program applications and checklist state."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.base_class import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class GrantApplication(Base):
    """Tracked grant application for a district or program-level (OWW) owner."""

    __tablename__ = "grant_applications"
    __table_args__ = (
        UniqueConstraint(
            "program_id",
            "owner_scope",
            "owner_code",
            "cycle_key",
            name="uq_grant_application_owner_cycle",
        ),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    program_id = Column(String(64), nullable=False, index=True)
    owner_scope = Column(String(16), nullable=False, index=True)  # district | program | state
    owner_code = Column(String(64), nullable=False, index=True)
    cycle_key = Column(String(32), nullable=False, default="current")
    status = Column(
        String(24),
        nullable=False,
        default="exploring",
        index=True,
    )  # exploring|eligible|drafting|submitted|awarded|declined
    fit_score = Column(Integer, nullable=True)
    fit_reasons = Column(JSONB, nullable=True)
    missing_facts = Column(JSONB, nullable=True)
    checklist = Column(JSONB, nullable=True)
    auto_fill = Column(JSONB, nullable=True)
    notes = Column(Text, nullable=True)
    due_date = Column(String(32), nullable=True)
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class GrantApplicationEvent(Base):
    """Audit trail for grant application create / status changes."""

    __tablename__ = "grant_application_events"

    id = Column(String(36), primary_key=True, default=_uuid)
    application_id = Column(String(36), nullable=False, index=True)
    actor_user_id = Column(Integer, nullable=True)
    action = Column(String(64), nullable=False)
    detail = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


def ensure_grants_schema(engine) -> None:
    from sqlalchemy import inspect

    insp = inspect(engine)
    for table in (GrantApplication, GrantApplicationEvent):
        if not insp.has_table(table.__tablename__):
            table.__table__.create(bind=engine, checkfirst=True)
