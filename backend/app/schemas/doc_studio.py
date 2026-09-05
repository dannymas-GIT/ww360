"""Document Studio schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

DocStatus = Literal["draft", "published", "archived"]
DocType = Literal["document", "imported_file"]


class DocStudioAccess(BaseModel):
    scope: str
    scope_label: str
    can_view: bool
    can_author: bool
    can_publish: bool
    can_manage_folders: bool
    roles: list[str] = Field(default_factory=list)


# ── Folders ──────────────────────────────────────────────────────────────────


class DocFolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: str | None = None
    description: str | None = None


class DocFolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_id: str | None = None
    description: str | None = None
    sort_order: int | None = None


class DocFolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scope: str
    parent_id: str | None = None
    name: str
    description: str | None = None
    sort_order: int = 0
    is_system: bool = False
    document_count: int = 0
    created_at: datetime
    updated_at: datetime


# ── Documents ────────────────────────────────────────────────────────────────


class DocDocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    folder_id: str | None = None
    template_id: str | None = None
    content_markdown: str | None = ""
    content_json: dict[str, Any] | None = None
    summary: str | None = None
    tags: list[str] | None = None


class DocDocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    folder_id: str | None = None
    summary: str | None = None
    tags: list[str] | None = None
    status: DocStatus | None = None


class DocContentSave(BaseModel):
    content_markdown: str = ""
    content_json: dict[str, Any] | None = None
    title: str | None = None
    note: str | None = Field(default=None, max_length=300)
    # Force a new version even if content is unchanged.
    force_version: bool = False
    # Autosave: persist content but do not cut a new version (explicit Save does).
    autosave: bool = False


class DocDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str = ""
    scope: str | None = None
    folder_id: str | None = None
    doc_type: str = "document"
    status: str = "draft"
    summary: str | None = None
    tags: list[str] | None = None
    template_id: str | None = None
    version_no: int = 1
    word_count: int = 0
    source_filename: str | None = None
    created_by: int | None = None
    updated_by: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    published_at: datetime | None = None


class DocDocumentDetail(DocDocumentRead):
    content_markdown: str | None = ""
    content_json: dict[str, Any] | None = None


class DocVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    version_no: int
    title: str | None = None
    note: str | None = None
    kind: str = "save"
    created_by: int | None = None
    created_at: datetime


class DocVersionDetail(DocVersionRead):
    content_markdown: str | None = ""
    content_json: dict[str, Any] | None = None


class DocAssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str | None = None
    filename: str
    content_type: str
    size_bytes: int
    url: str
    created_at: datetime


class DocStudioStats(BaseModel):
    folders: int
    documents: int
    drafts: int
    published: int
    words: int
    recent: list[DocDocumentRead] = Field(default_factory=list)
