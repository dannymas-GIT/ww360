"""Pydantic schemas for in-app notifications."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    district_code: str | None = None
    category: str
    title: str
    body: str | None = None
    link_path: str | None = None
    meta: dict[str, Any] | None = None
    read_at: datetime | None = None
    created_at: datetime


class NotificationCreate(BaseModel):
    user_id: int
    district_code: str | None = None
    category: str = "general"
    title: str = Field(min_length=1, max_length=500)
    body: str | None = None
    link_path: str | None = None
    meta: dict[str, Any] | None = None


class NotificationSummary(BaseModel):
    unread: int = 0
