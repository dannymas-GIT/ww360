"""Document Studio schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

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
    roles: List[str] = Field(default_factory=list)


# ── Folders ──────────────────────────────────────────────────────────────────


class DocFolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: Optional[str] = None
    description: Optional[str] = None


class DocFolderUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    parent_id: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class DocFolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scope: str
    parent_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    is_system: bool = False
    document_count: int = 0
    created_at: datetime
    updated_at: datetime


# ── Documents ────────────────────────────────────────────────────────────────


class DocDocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    folder_id: Optional[str] = None
    template_id: Optional[str] = None
    content_markdown: Optional[str] = ""
    content_json: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None


class DocDocumentUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    folder_id: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[DocStatus] = None


class DocContentSave(BaseModel):
    content_markdown: str = ""
    content_json: Optional[Dict[str, Any]] = None
    title: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=300)
    # Force a new version even if content is unchanged.
    force_version: bool = False
    # Autosave: persist content but do not cut a new version (explicit Save does).
    autosave: bool = False


class DocDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str = ""
    scope: Optional[str] = None
    folder_id: Optional[str] = None
    doc_type: str = "document"
    status: str = "draft"
    summary: Optional[str] = None
    tags: Optional[List[str]] = None
    template_id: Optional[str] = None
    version_no: int = 1
    word_count: int = 0
    source_filename: Optional[str] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None


class DocDocumentDetail(DocDocumentRead):
    content_markdown: Optional[str] = ""
    content_json: Optional[Dict[str, Any]] = None


class DocVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    version_no: int
    title: Optional[str] = None
    note: Optional[str] = None
    kind: str = "save"
    created_by: Optional[int] = None
    created_at: datetime


class DocVersionDetail(DocVersionRead):
    content_markdown: Optional[str] = ""
    content_json: Optional[Dict[str, Any]] = None


class DocAssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: Optional[str] = None
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
    recent: List[DocDocumentRead] = Field(default_factory=list)
