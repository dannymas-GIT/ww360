"""Impersonation sessions, audit events, and demo persona catalog."""

from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.base_class import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class ImpersonationSession(Base):
    __tablename__ = "impersonation_sessions"

    id = Column(String(36), primary_key=True, default=_uuid)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    persona_key = Column(String(80), nullable=True, index=True)
    mode = Column(String(20), nullable=False, default="preview")  # preview | act
    reason = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)


class ImpersonationEvent(Base):
    __tablename__ = "impersonation_events"

    id = Column(String(36), primary_key=True, default=_uuid)
    session_id = Column(
        String(36),
        ForeignKey("impersonation_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    method = Column(String(16), nullable=False)
    path = Column(String(512), nullable=False)
    status_code = Column(Integer, nullable=False, default=200)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DemoPersona(Base):
    __tablename__ = "demo_personas"

    persona_key = Column(String(80), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tier = Column(String(20), nullable=False)  # utility | state | regional | national
    label = Column(String(255), nullable=False)
    subtitle = Column(String(512), nullable=True)
    narrative_bullets = Column(JSONB, nullable=False, default=list)
    sort_order = Column(Integer, nullable=False, default=0)
    visible_to_scopes = Column(JSONB, nullable=False, default=list)
    catalog_group = Column(String(64), nullable=True, index=True)
    state_code = Column(String(2), nullable=True, index=True)
    is_active = Column(Integer, nullable=False, default=1)


def ensure_impersonation_schema(engine) -> None:
    """Create impersonation tables if missing."""
    from sqlalchemy import inspect

    insp = inspect(engine)
    if not insp.has_table("impersonation_sessions"):
        ImpersonationSession.__table__.create(bind=engine, checkfirst=True)
    if not insp.has_table("impersonation_events"):
        ImpersonationEvent.__table__.create(bind=engine, checkfirst=True)
    if not insp.has_table("demo_personas"):
        DemoPersona.__table__.create(bind=engine, checkfirst=True)
    else:
        cols = {c["name"] for c in insp.get_columns("demo_personas")}
        if "catalog_group" not in cols:
            from sqlalchemy import text

            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE demo_personas ADD COLUMN IF NOT EXISTS "
                        "catalog_group VARCHAR(64) NULL"
                    )
                )
