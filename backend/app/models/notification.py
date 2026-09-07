"""In-app notifications for WW360."""

from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base_class import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    district_code = Column(String(50), nullable=True, index=True)
    category = Column(String(64), nullable=False, default="general", index=True)
    title = Column(String(500), nullable=False)
    body = Column(Text, nullable=True)
    link_path = Column(String(500), nullable=True)
    meta = Column(JSONB, nullable=True)
    read_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)


def ensure_notification_schema(engine) -> None:
    return None
