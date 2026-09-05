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
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

PROGRAM_SCOPE = "program"


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
    doc_type = Column(String(32), nullable=False, default="document")  # document | imported_file
    status = Column(String(32), nullable=False, default="draft")  # draft | published | archived
    summary = Column(Text, nullable=True)
    tags = Column(JSONB, nullable=True)
    content_markdown = Column(Text, nullable=True)
    content_json = Column(JSONB, nullable=True)
    template_id = Column(String(64), nullable=True)
    version_no = Column(Integer, nullable=False, default=1)
    word_count = Column(Integer, nullable=False, default=0)
    source_filename = Column(String(300), nullable=True)
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    published_at = Column(DateTime, nullable=True)

    folder = relationship("DocFolder", back_populates="documents")
    versions = relationship(
        "DocVersion",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocVersion.version_no.desc()",
    )
    assets = relationship("DocAsset", back_populates="document", cascade="all, delete-orphan")


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
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS template_id VARCHAR(64)",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS version_no INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS word_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS source_filename VARCHAR(300)",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS created_by INTEGER",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS updated_by INTEGER",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()",
        "ALTER TABLE doc_documents ADD COLUMN IF NOT EXISTS published_at TIMESTAMP",
        "CREATE INDEX IF NOT EXISTS ix_doc_documents_scope ON doc_documents (scope)",
        "CREATE INDEX IF NOT EXISTS ix_doc_documents_folder_id ON doc_documents (folder_id)",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
