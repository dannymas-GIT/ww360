"""User workspace home customizations — panel layout persisted per user/profile."""

from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.base_class import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class WorkspaceCustomization(Base):
    """Saved home-screen layout for a user (and optional persona/profile)."""

    __tablename__ = "workspace_customizations"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "workspace_profile",
            "persona_key",
            name="uq_workspace_custom_user_profile_persona",
        ),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # national | regional | state_partner | regulator | utility
    workspace_profile = Column(String(40), nullable=False, default="state_partner", index=True)
    # Empty string when not impersonating / no persona key
    persona_key = Column(String(80), nullable=False, default="", index=True)
    # Ordered list of { "module_id": str, "visible": bool, "size": "full"|"half" }
    layout = Column(JSONB, nullable=False, default=list)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


def ensure_workspace_customization_schema(engine) -> None:
    from sqlalchemy import inspect

    insp = inspect(engine)
    if not insp.has_table("workspace_customizations"):
        WorkspaceCustomization.__table__.create(bind=engine, checkfirst=True)
