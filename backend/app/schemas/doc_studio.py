"""Document Studio schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

DocStatus = Literal["draft", "published", "archived"]
DocType = Literal["document", "tutorial", "imported_file"]


class DocStudioAccess(BaseModel):
    scope: str
    scope_label: str
    can_view: bool
    can_author: bool
    can_publish: bool
    can_manage_folders: bool
    can_connect_library: bool = False
    can_custody_transfer: bool = False
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
    doc_type: DocType = "document"
    template_id: str | None = None
    content_markdown: str | None = ""
    content_json: dict[str, Any] | None = None
    tutorial_data: dict[str, Any] | None = None
    summary: str | None = None
    tags: list[str] | None = None


class DocDocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    folder_id: str | None = None
    summary: str | None = None
    tags: list[str] | None = None
    status: DocStatus | None = None
    review_state: str | None = None
    tutorial_data: dict[str, Any] | None = None


class DocContentSave(BaseModel):
    content_markdown: str = ""
    content_json: dict[str, Any] | None = None
    tutorial_data: dict[str, Any] | None = None
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
    review_state: str = "none"
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
    custody_status: str = "local"


class DocDocumentDetail(DocDocumentRead):
    content_markdown: str | None = ""
    content_json: dict[str, Any] | None = None
    tutorial_data: dict[str, Any] | None = None
    custody_status: str = "local"
    external_ref: "DocExternalRefRead | None" = None


class DocExternalRefRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    external_item_id: str
    external_web_url: str | None = None
    external_mime_type: str | None = None
    last_synced_at: datetime | None = None


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
    tutorial_data: dict[str, Any] | None = None


class TutorialGenerateResponse(BaseModel):
    """Draft step-by-step guide generated from a recording."""

    title: str
    markdown: str
    stepCount: int
    usedAi: bool
    usedTranscript: bool


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
    pending_approval: int = 0
    tutorials: int = 0
    succession_docs: int = 0
    succession_published: int = 0
    operations_docs: int = 0
    recent: list[DocDocumentRead] = Field(default_factory=list)


# ── External library ───────────────────────────────────────────────────────


class DocLibraryConnectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_type: str = "district"
    owner_code: str
    provider: str
    display_name: str | None = None
    account_email: str | None = None
    default_folder_id: str | None = None
    default_folder_path: str | None = None
    is_active: bool
    created_at: datetime


class DocLibraryConnectionUpdate(BaseModel):
    default_folder_id: str | None = None
    default_folder_path: str | None = None


class ExternalBrowseItem(BaseModel):
    id: str
    name: str
    is_folder: bool
    mime_type: str | None = None
    web_url: str | None = None
    size_bytes: int | None = None
    modified_at: str | None = None


class ExternalImportRequest(BaseModel):
    connection_id: str
    item_id: str
    drive_id: str | None = None
    folder_id: str | None = None
    mode: str = "import"  # import | link


class ExternalExportRequest(BaseModel):
    connection_id: str
    folder_id: str
    format: str = "pdf"


# ── Custody ──────────────────────────────────────────────────────────────────


class CustodyPolicyRead(BaseModel):
    version: str
    markdown: str
    default_retention_days: int


class CustodyAcknowledgmentRequest(BaseModel):
    owner_type: str
    owner_code: str
    confirmed: bool = Field(..., description="Must be true to record acknowledgment")


class CustodyAcknowledgmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_type: str
    owner_code: str
    policy_version: str
    acknowledgment_text: str
    acknowledged_by_name: str
    acknowledged_at: datetime


class CustodyTransferCreate(BaseModel):
    document_ids: list[str] = Field(..., min_length=1)
    destination_owner_type: str
    destination_owner_code: str
    connection_id: str
    external_folder_id: str = ""
    export_format: str = "pdf"
    retention_days: int = Field(30, ge=0, le=365)


class CustodyTransferItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str | None
    filename: str
    export_format: str
    sha256_checksum: str
    size_bytes: int
    external_item_id: str | None
    external_web_url: str | None
    verified_at: datetime | None


class CustodyTransferRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scope: str
    destination_owner_type: str
    destination_owner_code: str
    connection_id: str | None
    external_folder_id: str | None
    status: str
    retention_days: int
    purge_scheduled_at: datetime | None
    purged_at: datetime | None
    initiated_by_name: str | None
    verified_by_name: str | None
    verified_at: datetime | None
    failure_reason: str | None
    created_at: datetime
    items: list[CustodyTransferItemRead] = Field(default_factory=list)
