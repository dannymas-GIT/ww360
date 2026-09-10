"""Document Studio tables for WW360.

Scope model
-----------
Every folder/document belongs to a ``scope``:

* ``program`` — the shared One Water Workforce library (OWW partners, platform admins)
* ``<district_code>`` — a utility's private library

``doc_documents`` keeps ``id = String(36)`` so the existing
``workforce_succession`` FK (``SET NULL``) stays valid.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from app.db.base_class import Base
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

PROGRAM_SCOPE = "program"  # legacy alias — migrated to program:{state_code}
CUSTODY_STATUSES = ("local", "transferred", "purge_scheduled", "purged")
OWNER_TYPES = ("district", "program")


def program_scope_for_state(state_code: str) -> str:
    return f"program:{(state_code or 'NY').upper()[:2]}"


def normalize_doc_scope(scope: str, *, default_state: str = "NY") -> str:
    """Map legacy ``program`` to a state-keyed program library scope."""
    if scope == PROGRAM_SCOPE:
        return program_scope_for_state(default_state)
    return scope


def is_program_scope(scope: str) -> bool:
    return scope == PROGRAM_SCOPE or scope.startswith("program:")


def _uuid() -> str:
    return str(uuid.uuid4())


class DocFolder(Base):
    __tablename__ = "doc_folders"

    id = Column(String(36), primary_key=True, default=_uuid)
    scope = Column(String(64), nullable=False, index=True, default=PROGRAM_SCOPE)
    parent_id = Column(
        String(36), ForeignKey("doc_folders.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_system = Column(Boolean, nullable=False, default=False)
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    documents = relationship("DocDocument", back_populates="folder")


class DocDocument(Base):
    __tablename__ = "doc_documents"

    id = Column(String(36), primary_key=True, default=_uuid)
    title = Column(String(500), nullable=True)
    scope = Column(String(64), nullable=True, index=True)
    folder_id = Column(
        String(36), ForeignKey("doc_folders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    doc_type = Column(String(32), nullable=False, default="document")  # document | tutorial | imported_file
    status = Column(String(32), nullable=False, default="draft")  # draft | published | archived
    review_state = Column(String(32), nullable=False, default="none")  # none | submitted | changes_requested | approved
    summary = Column(Text, nullable=True)
    tags = Column(JSONB, nullable=True)
    content_markdown = Column(Text, nullable=True)
    content_json = Column(JSONB, nullable=True)
    tutorial_data = Column(JSONB, nullable=True)
    template_id = Column(String(64), nullable=True)
    version_no = Column(Integer, nullable=False, default=1)
    word_count = Column(Integer, nullable=False, default=0)
    source_filename = Column(String(300), nullable=True)
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    published_at = Column(DateTime, nullable=True)
    custody_status = Column(String(30), nullable=False, default="local", index=True)
    custody_transfer_id = Column(String(36), nullable=True, index=True)

    folder = relationship("DocFolder", back_populates="documents")
    versions = relationship(
        "DocVersion",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocVersion.version_no.desc()",
    )
    assets = relationship("DocAsset", back_populates="document", cascade="all, delete-orphan")
    external_ref = relationship(
        "DocExternalRef",
        back_populates="document",
        uselist=False,
        cascade="all, delete-orphan",
    )


class DocVersion(Base):
    __tablename__ = "doc_versions"

    id = Column(String(36), primary_key=True, default=_uuid)
    document_id = Column(
        String(36), ForeignKey("doc_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_no = Column(Integer, nullable=False)
    title = Column(String(500), nullable=True)
    content_markdown = Column(Text, nullable=True)
    content_json = Column(JSONB, nullable=True)
    tutorial_data = Column(JSONB, nullable=True)
    note = Column(String(300), nullable=True)
    kind = Column(String(32), nullable=False, default="save")  # save | publish | restore | import
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("DocDocument", back_populates="versions")


class DocAsset(Base):
    """Images and files embedded in documents (stored in Postgres for simplicity)."""

    __tablename__ = "doc_assets"

    id = Column(String(36), primary_key=True, default=_uuid)
    document_id = Column(
        String(36), ForeignKey("doc_documents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    scope = Column(String(64), nullable=False, index=True, default=PROGRAM_SCOPE)
    filename = Column(String(300), nullable=False)
    content_type = Column(String(120), nullable=False, default="application/octet-stream")
    size_bytes = Column(Integer, nullable=False, default=0)
    data = Column(LargeBinary, nullable=False)
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("DocDocument", back_populates="assets")


class DocLibraryConnection(Base):
    """OAuth connection to an external document library (district or program scope)."""

    __tablename__ = "doc_library_connections"
    __table_args__ = (
        UniqueConstraint(
            "owner_type",
            "owner_code",
            "provider",
            name="uq_doc_library_connections_owner_provider",
        ),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    owner_type = Column(String(20), nullable=False, default="district")
    owner_code = Column(String(64), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    display_name = Column(String(255), nullable=True)
    account_email = Column(String(255), nullable=True)
    default_folder_id = Column(String(500), nullable=True)
    default_folder_path = Column(String(1000), nullable=True)
    encrypted_refresh_token = Column(Text, nullable=True)
    encrypted_access_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    scopes = Column(Text, nullable=True)
    delta_token = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    connected_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class DocExternalRef(Base):
    """External provider metadata for imported or linked documents."""

    __tablename__ = "doc_external_refs"

    id = Column(String(36), primary_key=True, default=_uuid)
    document_id = Column(
        String(36),
        ForeignKey("doc_documents.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    connection_id = Column(
        String(36),
        ForeignKey("doc_library_connections.id", ondelete="SET NULL"),
        nullable=True,
    )
    provider = Column(String(50), nullable=False)
    external_item_id = Column(String(500), nullable=False)
    external_drive_id = Column(String(500), nullable=True)
    external_web_url = Column(String(2000), nullable=True)
    external_etag = Column(String(200), nullable=True)
    external_mime_type = Column(String(200), nullable=True)
    delta_token = Column(Text, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("DocDocument", back_populates="external_ref")
    connection = relationship("DocLibraryConnection")


class DocCustodyAcknowledgment(Base):
    """Recorded acceptance of the data custody policy before transfer."""

    __tablename__ = "doc_custody_acknowledgments"
    __table_args__ = (
        UniqueConstraint(
            "owner_type",
            "owner_code",
            "policy_version",
            name="uq_doc_custody_ack_owner_policy",
        ),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    owner_type = Column(String(20), nullable=False)
    owner_code = Column(String(64), nullable=False, index=True)
    policy_version = Column(String(50), nullable=False)
    acknowledgment_text = Column(Text, nullable=False)
    acknowledged_by_user_id = Column(Integer, nullable=True)
    acknowledged_by_name = Column(String(255), nullable=False)
    acknowledged_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DocCustodyTransfer(Base):
    """Batch transfer of documents to external organizational storage."""

    __tablename__ = "doc_custody_transfers"

    id = Column(String(36), primary_key=True, default=_uuid)
    scope = Column(String(64), nullable=False, index=True)
    destination_owner_type = Column(String(20), nullable=False)
    destination_owner_code = Column(String(64), nullable=False)
    connection_id = Column(
        String(36),
        ForeignKey("doc_library_connections.id", ondelete="SET NULL"),
        nullable=True,
    )
    external_folder_id = Column(String(500), nullable=True)
    external_folder_path = Column(String(1000), nullable=True)
    status = Column(String(30), nullable=False, default="pending", index=True)
    retention_days = Column(Integer, nullable=False, default=30)
    purge_scheduled_at = Column(DateTime, nullable=True)
    purged_at = Column(DateTime, nullable=True)
    initiated_by_user_id = Column(Integer, nullable=True)
    initiated_by_name = Column(String(255), nullable=True)
    verified_by_user_id = Column(Integer, nullable=True)
    verified_by_name = Column(String(255), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    items = relationship(
        "DocCustodyTransferItem",
        back_populates="transfer",
        cascade="all, delete-orphan",
    )
    connection = relationship("DocLibraryConnection")


class DocCustodyTransferItem(Base):
    """Individual document included in a custody transfer batch."""

    __tablename__ = "doc_custody_transfer_items"

    id = Column(String(36), primary_key=True, default=_uuid)
    transfer_id = Column(
        String(36),
        ForeignKey("doc_custody_transfers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id = Column(
        String(36),
        ForeignKey("doc_documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    filename = Column(String(500), nullable=False)
    export_format = Column(String(20), nullable=False, default="pdf")
    sha256_checksum = Column(String(64), nullable=False)
    size_bytes = Column(BigInteger, nullable=False, default=0)
    external_item_id = Column(String(500), nullable=True)
    external_web_url = Column(String(2000), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    transfer = relationship("DocCustodyTransfer", back_populates="items")
    document = relationship("DocDocument")


def ensure_doc_studio_schema(engine) -> None:
    """Idempotently add columns introduced after the original ``doc_documents`` stub.

    WW360 uses ``create_all`` (no Alembic history yet), which never alters
    existing tables. Staging already has the two-column stub, so we patch it.
    """
    from sqlalchemy import text

    statements = [
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS scope VARCHAR(64)",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS folder_id VARCHAR(36)",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS doc_type VARCHAR(32) NOT NULL DEFAULT 'document'",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'draft'",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS summary TEXT",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS tags JSONB",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS content_markdown TEXT",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS content_json JSONB",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS tutorial_data JSONB",
        "ALTER TABLE doc_versions ADD COLUMN IF NOT EXISTS tutorial_data JSONB",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS template_id VARCHAR(64)",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS version_no INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS word_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS source_filename VARCHAR(300)",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS created_by INTEGER",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS updated_by INTEGER",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS published_at TIMESTAMP",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS review_state VARCHAR(32) NOT NULL DEFAULT 'none'",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS custody_status VARCHAR(30) NOT NULL DEFAULT 'local'",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS custody_transfer_id VARCHAR(36)",
        "CREATE INDEX IF NOT EXISTS ix_doc_documents_scope ON doc_documents (scope)",
        "CREATE INDEX IF NOT EXISTS ix_doc_documents_folder_id ON doc_documents (folder_id)",
        "CREATE INDEX IF NOT EXISTS ix_doc_documents_custody_status ON doc_documents (custody_status)",
    ]
    table_ddl = [
        """
        CREATE TABLE IF NOT EXISTS doc_library_connections (
            id VARCHAR(36) PRIMARY KEY,
            owner_type VARCHAR(20) NOT NULL DEFAULT 'district',
            owner_code VARCHAR(64) NOT NULL,
            provider VARCHAR(50) NOT NULL,
            display_name VARCHAR(255),
            account_email VARCHAR(255),
            default_folder_id VARCHAR(500),
            default_folder_path VARCHAR(1000),
            encrypted_refresh_token TEXT,
            encrypted_access_token TEXT,
            token_expires_at TIMESTAMP,
            scopes TEXT,
            delta_token TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            connected_by INTEGER,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_doc_library_connections_owner_provider UNIQUE (owner_type, owner_code, provider)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS doc_external_refs (
            id VARCHAR(36) PRIMARY KEY,
            document_id VARCHAR(36) NOT NULL UNIQUE REFERENCES doc_documents(id) ON DELETE CASCADE,
            connection_id VARCHAR(36) REFERENCES doc_library_connections(id) ON DELETE SET NULL,
            provider VARCHAR(50) NOT NULL,
            external_item_id VARCHAR(500) NOT NULL,
            external_drive_id VARCHAR(500),
            external_web_url VARCHAR(2000),
            external_etag VARCHAR(200),
            external_mime_type VARCHAR(200),
            delta_token TEXT,
            last_synced_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS doc_custody_acknowledgments (
            id VARCHAR(36) PRIMARY KEY,
            owner_type VARCHAR(20) NOT NULL,
            owner_code VARCHAR(64) NOT NULL,
            policy_version VARCHAR(50) NOT NULL,
            acknowledgment_text TEXT NOT NULL,
            acknowledged_by_user_id INTEGER,
            acknowledged_by_name VARCHAR(255) NOT NULL,
            acknowledged_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_doc_custody_ack_owner_policy UNIQUE (owner_type, owner_code, policy_version)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS doc_custody_transfers (
            id VARCHAR(36) PRIMARY KEY,
            scope VARCHAR(64) NOT NULL,
            destination_owner_type VARCHAR(20) NOT NULL,
            destination_owner_code VARCHAR(64) NOT NULL,
            connection_id VARCHAR(36) REFERENCES doc_library_connections(id) ON DELETE SET NULL,
            external_folder_id VARCHAR(500),
            external_folder_path VARCHAR(1000),
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            retention_days INTEGER NOT NULL DEFAULT 30,
            purge_scheduled_at TIMESTAMP,
            purged_at TIMESTAMP,
            initiated_by_user_id INTEGER,
            initiated_by_name VARCHAR(255),
            verified_by_user_id INTEGER,
            verified_by_name VARCHAR(255),
            verified_at TIMESTAMP,
            failure_reason TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS doc_custody_transfer_items (
            id VARCHAR(36) PRIMARY KEY,
            transfer_id VARCHAR(36) NOT NULL REFERENCES doc_custody_transfers(id) ON DELETE CASCADE,
            document_id VARCHAR(36) REFERENCES doc_documents(id) ON DELETE SET NULL,
            filename VARCHAR(500) NOT NULL,
            export_format VARCHAR(20) NOT NULL DEFAULT 'pdf',
            sha256_checksum VARCHAR(64) NOT NULL,
            size_bytes BIGINT NOT NULL DEFAULT 0,
            external_item_id VARCHAR(500),
            external_web_url VARCHAR(2000),
            verified_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_doc_custody_transfers_scope ON doc_custody_transfers (scope)",
        "CREATE INDEX IF NOT EXISTS ix_doc_custody_transfer_items_transfer ON doc_custody_transfer_items (transfer_id)",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        for stmt in table_ddl:
            conn.execute(text(stmt))
