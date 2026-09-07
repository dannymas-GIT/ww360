"""Pydantic schemas for documentation tasks."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TaskStatus = Literal[
    "assigned",
    "in_progress",
    "submitted",
    "changes_requested",
    "approved",
    "published",
    "overdue",
]


class DocumentationTaskNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    author_id: int | None = None
    body: str
    progress_pct: int | None = None
    created_at: datetime


class DocumentationTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    district_code: str
    assignee_user_id: int
    assigned_by: int | None = None
    critical_function_id: int | None = None
    title: str
    instructions: str | None = None
    capture_mode: str | None = None
    due_at: datetime | None = None
    status: TaskStatus
    document_id: str | None = None
    created_at: datetime
    updated_at: datetime
    notes: list[DocumentationTaskNoteRead] = Field(default_factory=list)


class DocumentationTaskCreate(BaseModel):
    district_code: str = Field(min_length=1, max_length=50)
    assignee_user_id: int
    critical_function_id: int | None = None
    title: str = Field(min_length=1, max_length=500)
    instructions: str | None = None
    capture_mode: str | None = None
    due_at: datetime | None = None


class DocumentationTaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    instructions: str | None = None
    capture_mode: str | None = None
    due_at: datetime | None = None
    status: TaskStatus | None = None
    document_id: str | None = None


class DocumentationTaskNoteCreate(BaseModel):
    body: str = Field(min_length=1)
    progress_pct: int | None = Field(default=None, ge=0, le=100)


class DocumentationTaskSubmit(BaseModel):
    document_id: str = Field(min_length=1)


class DocumentationGrantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    district_code: str
    user_id: int
    granted_by: int | None = None
    expires_at: datetime | None = None
    allowed_modes: str | None = None
    created_at: datetime


class DocumentationGrantCreate(BaseModel):
    district_code: str = Field(min_length=1, max_length=50)
    user_id: int
    expires_at: datetime | None = None
    allowed_modes: str | None = None


class DocumentationTaskSummary(BaseModel):
    open: int = 0
    due_soon: int = 0
    overdue: int = 0
    review_queue: int = 0


class RecorderAccess(BaseModel):
    can_record: bool
    reason: str | None = None
    active_grant: DocumentationGrantRead | None = None
    open_task_ids: list[int] = Field(default_factory=list)
