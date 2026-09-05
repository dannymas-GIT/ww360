"""Document Studio service — folders, documents, versions, assets.

Roles
-----
Authors: platform_admin, oww_partner, district_admin, district_manager,
ceu_admin, workforce_manager. Viewers: any authenticated WW360 user.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.doc_document import PROGRAM_SCOPE, DocAsset, DocDocument, DocFolder, DocVersion
from app.schemas.doc_studio import (
    DocAssetRead,
    DocContentSave,
    DocDocumentCreate,
    DocDocumentDetail,
    DocDocumentRead,
    DocDocumentUpdate,
    DocFolderCreate,
    DocFolderRead,
    DocFolderUpdate,
    DocStudioAccess,
    DocStudioStats,
    DocVersionDetail,
    DocVersionRead,
)
from app.tenant_auth import TenantContext

logger = logging.getLogger(__name__)

AUTHOR_ROLES = {
    "platform_admin",
    "oww_partner",
    "district_admin",
    "district_manager",
    "ceu_admin",
    "workforce_manager",
    "admin",
}
PUBLISH_ROLES = {"platform_admin", "oww_partner", "district_admin", "ceu_admin", "admin"}

DEFAULT_PROGRAM_FOLDERS: Sequence[tuple[str, str]] = (
    ("Program briefs", "Regional and statewide workforce briefs for partners and funders."),
    ("Training & cohorts", "Cohort plans, course outlines and Learning Stream announcements."),
    ("Grant reporting", "EPA Area 3 narratives, quarterly packages and measure write-ups."),
    ("Outreach", "Utility invitations, newsletters and career-pipeline messaging."),
    ("Templates", "Reusable starting points — copy into a folder before editing."),
)

ASSET_URL_PREFIX = "/api/v1/doc-studio/assets"
_WORD_RE = re.compile(r"[A-Za-z0-9’'-]+")


def _word_count(markdown: Optional[str]) -> int:
    if not markdown:
        return 0
    return len(_WORD_RE.findall(markdown))


def resolve_scope(context: TenantContext, requested: Optional[str] = None) -> str:
    """Program partners and platform admins work in the shared program library.

    District users are pinned to their own district scope; platform admins may
    request any scope explicitly.
    """
    if requested:
        if context.is_global_admin:
            return requested
        if requested == PROGRAM_SCOPE and context.has_role("oww_partner"):
            return PROGRAM_SCOPE
        if context.has_district_access(requested):
            return requested
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to that document scope")
    if context.is_global_admin or context.has_role("oww_partner"):
        return PROGRAM_SCOPE
    if context.district_code:
        return context.district_code
    return PROGRAM_SCOPE


class DocStudioService:
    def __init__(self, db: Session):
        self.db = db

    # ── Access ─────────────────────────────────────────────────────────────

    def access(self, context: TenantContext, scope: str) -> DocStudioAccess:
        roles = set(context.roles)
        can_author = context.is_global_admin or bool(roles & AUTHOR_ROLES)
        can_publish = context.is_global_admin or bool(roles & PUBLISH_ROLES)
        label = "One Water Workforce program library" if scope == PROGRAM_SCOPE else f"{scope} library"
        return DocStudioAccess(
            scope=scope,
            scope_label=label,
            can_view=True,
            can_author=can_author,
            can_publish=can_publish,
            can_manage_folders=can_author,
            roles=sorted(roles),
        )

    def require_author(self, context: TenantContext, scope: str) -> None:
        if not self.access(context, scope).can_author:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Authoring requires a program or district manager role")

    def require_publisher(self, context: TenantContext, scope: str) -> None:
        if not self.access(context, scope).can_publish:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Publishing requires an admin or program partner role")

    # ── Folders ────────────────────────────────────────────────────────────

    def ensure_default_folders(self, scope: str, user_id: Optional[int]) -> None:
        if scope != PROGRAM_SCOPE:
            return
        existing = self.db.query(func.count(DocFolder.id)).filter(DocFolder.scope == scope).scalar() or 0
        if existing:
            return
        for idx, (name, desc) in enumerate(DEFAULT_PROGRAM_FOLDERS):
            self.db.add(
                DocFolder(
                    scope=scope,
                    name=name,
                    description=desc,
                    sort_order=idx,
                    is_system=True,
                    created_by=user_id,
                )
            )
        self.db.commit()

    def list_folders(self, scope: str) -> List[DocFolderRead]:
        counts = dict(
            self.db.query(DocDocument.folder_id, func.count(DocDocument.id))
            .filter(DocDocument.scope == scope, DocDocument.status != "archived")
            .group_by(DocDocument.folder_id)
            .all()
        )
        rows = (
            self.db.query(DocFolder)
            .filter(DocFolder.scope == scope)
            .order_by(DocFolder.sort_order.asc(), DocFolder.name.asc())
            .all()
        )
        out: List[DocFolderRead] = []
        for f in rows:
            item = DocFolderRead.model_validate(f)
            item.document_count = int(counts.get(f.id, 0))
            out.append(item)
        return out

    def _get_folder(self, scope: str, folder_id: str) -> DocFolder:
        f = self.db.query(DocFolder).filter(DocFolder.id == folder_id, DocFolder.scope == scope).first()
        if not f:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
        return f

    def create_folder(self, scope: str, payload: DocFolderCreate, user_id: Optional[int]) -> DocFolderRead:
        if payload.parent_id:
            self._get_folder(scope, payload.parent_id)
        max_sort = (
            self.db.query(func.max(DocFolder.sort_order)).filter(DocFolder.scope == scope).scalar() or 0
        )
        f = DocFolder(
            scope=scope,
            parent_id=payload.parent_id,
            name=payload.name.strip(),
            description=payload.description,
            sort_order=int(max_sort) + 1,
            created_by=user_id,
        )
        self.db.add(f)
        self.db.commit()
        self.db.refresh(f)
        return DocFolderRead.model_validate(f)

    def update_folder(self, scope: str, folder_id: str, payload: DocFolderUpdate) -> DocFolderRead:
        f = self._get_folder(scope, folder_id)
        data = payload.model_dump(exclude_unset=True)
        if "parent_id" in data and data["parent_id"]:
            if data["parent_id"] == folder_id:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "A folder cannot be its own parent")
            self._get_folder(scope, data["parent_id"])
        for k, v in data.items():
            setattr(f, k, v.strip() if isinstance(v, str) and k == "name" else v)
        self.db.commit()
        self.db.refresh(f)
        return DocFolderRead.model_validate(f)

    def delete_folder(self, scope: str, folder_id: str) -> None:
        f = self._get_folder(scope, folder_id)
        # Move documents up to the parent (or root) rather than deleting content.
        self.db.query(DocDocument).filter(DocDocument.folder_id == folder_id).update(
            {DocDocument.folder_id: f.parent_id}, synchronize_session=False
        )
        self.db.query(DocFolder).filter(DocFolder.parent_id == folder_id).update(
            {DocFolder.parent_id: f.parent_id}, synchronize_session=False
        )
        self.db.delete(f)
        self.db.commit()

    # ── Documents ──────────────────────────────────────────────────────────

    def _get_document_row(self, scope: str, document_id: str) -> DocDocument:
        d = (
            self.db.query(DocDocument)
            .filter(DocDocument.id == document_id, DocDocument.scope == scope)
            .first()
        )
        if not d:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
        return d

    def list_documents(
        self,
        scope: str,
        folder_id: Optional[str] = None,
        q: Optional[str] = None,
        status_filter: Optional[str] = None,
        include_archived: bool = False,
        limit: int = 200,
    ) -> List[DocDocumentRead]:
        query = self.db.query(DocDocument).filter(DocDocument.scope == scope)
        if folder_id == "__root__":
            query = query.filter(DocDocument.folder_id.is_(None))
        elif folder_id:
            query = query.filter(DocDocument.folder_id == folder_id)
        if status_filter:
            query = query.filter(DocDocument.status == status_filter)
        elif not include_archived:
            query = query.filter(DocDocument.status != "archived")
        if q:
            like = f"%{q.strip()}%"
            query = query.filter(
                or_(
                    DocDocument.title.ilike(like),
                    DocDocument.summary.ilike(like),
                    DocDocument.content_markdown.ilike(like),
                )
            )
        rows = query.order_by(DocDocument.updated_at.desc()).limit(limit).all()
        return [DocDocumentRead.model_validate(r) for r in rows]

    def get_document(self, scope: str, document_id: str) -> DocDocumentDetail:
        return DocDocumentDetail.model_validate(self._get_document_row(scope, document_id))

    def create_document(
        self, scope: str, payload: DocDocumentCreate, user_id: Optional[int]
    ) -> DocDocumentDetail:
        if payload.folder_id:
            self._get_folder(scope, payload.folder_id)
        md = payload.content_markdown or ""
        d = DocDocument(
            scope=scope,
            folder_id=payload.folder_id,
            title=payload.title.strip(),
            doc_type="document",
            status="draft",
            summary=payload.summary,
            tags=payload.tags,
            template_id=payload.template_id,
            content_markdown=md,
            content_json=payload.content_json,
            version_no=1,
            word_count=_word_count(md),
            created_by=user_id,
            updated_by=user_id,
        )
        self.db.add(d)
        self.db.flush()
        self.db.add(
            DocVersion(
                document_id=d.id,
                version_no=1,
                title=d.title,
                content_markdown=md,
                content_json=payload.content_json,
                note="Created" + (f" from template {payload.template_id}" if payload.template_id else ""),
                kind="save",
                created_by=user_id,
            )
        )
        self.db.commit()
        self.db.refresh(d)
        return DocDocumentDetail.model_validate(d)

    def create_imported_document(
        self,
        scope: str,
        *,
        title: str,
        markdown: str,
        folder_id: Optional[str],
        source_filename: str,
        user_id: Optional[int],
    ) -> DocDocumentDetail:
        if folder_id:
            self._get_folder(scope, folder_id)
        d = DocDocument(
            scope=scope,
            folder_id=folder_id,
            title=title.strip() or source_filename,
            doc_type="imported_file",
            status="draft",
            content_markdown=markdown,
            version_no=1,
            word_count=_word_count(markdown),
            source_filename=source_filename,
            created_by=user_id,
            updated_by=user_id,
        )
        self.db.add(d)
        self.db.flush()
        self.db.add(
            DocVersion(
                document_id=d.id,
                version_no=1,
                title=d.title,
                content_markdown=markdown,
                note=f"Imported {source_filename}",
                kind="import",
                created_by=user_id,
            )
        )
        self.db.commit()
        self.db.refresh(d)
        return DocDocumentDetail.model_validate(d)

    def update_document(
        self, scope: str, document_id: str, payload: DocDocumentUpdate, user_id: Optional[int]
    ) -> DocDocumentDetail:
        d = self._get_document_row(scope, document_id)
        data = payload.model_dump(exclude_unset=True)
        if "folder_id" in data and data["folder_id"]:
            self._get_folder(scope, data["folder_id"])
        for k, v in data.items():
            setattr(d, k, v.strip() if isinstance(v, str) and k == "title" else v)
        if data.get("status") == "published" and not d.published_at:
            d.published_at = datetime.utcnow()
        d.updated_by = user_id
        self.db.commit()
        self.db.refresh(d)
        return DocDocumentDetail.model_validate(d)

    def save_content(
        self, scope: str, document_id: str, payload: DocContentSave, user_id: Optional[int]
    ) -> DocDocumentDetail:
        d = self._get_document_row(scope, document_id)
        changed = (d.content_markdown or "") != (payload.content_markdown or "")
        if payload.title is not None and payload.title.strip() and payload.title.strip() != d.title:
            d.title = payload.title.strip()
            changed = True
        d.content_markdown = payload.content_markdown or ""
        d.content_json = payload.content_json
        d.word_count = _word_count(d.content_markdown)
        d.updated_by = user_id
        d.doc_type = "document"
        if (changed and not payload.autosave) or payload.force_version:
            d.version_no = int(d.version_no or 1) + 1
            self.db.add(
                DocVersion(
                    document_id=d.id,
                    version_no=d.version_no,
                    title=d.title,
                    content_markdown=d.content_markdown,
                    content_json=d.content_json,
                    note=payload.note,
                    kind="save",
                    created_by=user_id,
                )
            )
            self._prune_versions(d.id)
        self.db.commit()
        self.db.refresh(d)
        return DocDocumentDetail.model_validate(d)

    def publish(self, scope: str, document_id: str, user_id: Optional[int]) -> DocDocumentDetail:
        d = self._get_document_row(scope, document_id)
        d.status = "published"
        d.published_at = datetime.utcnow()
        d.updated_by = user_id
        d.version_no = int(d.version_no or 1) + 1
        self.db.add(
            DocVersion(
                document_id=d.id,
                version_no=d.version_no,
                title=d.title,
                content_markdown=d.content_markdown,
                content_json=d.content_json,
                note="Published",
                kind="publish",
                created_by=user_id,
            )
        )
        self.db.commit()
        self.db.refresh(d)
        return DocDocumentDetail.model_validate(d)

    def duplicate(self, scope: str, document_id: str, user_id: Optional[int]) -> DocDocumentDetail:
        src = self._get_document_row(scope, document_id)
        payload = DocDocumentCreate(
            title=f"{src.title} (copy)",
            folder_id=src.folder_id,
            template_id=src.template_id,
            content_markdown=src.content_markdown or "",
            content_json=src.content_json,
            summary=src.summary,
            tags=src.tags,
        )
        return self.create_document(scope, payload, user_id)

    def delete_document(self, scope: str, document_id: str) -> None:
        d = self._get_document_row(scope, document_id)
        self.db.delete(d)
        self.db.commit()

    # ── Versions ───────────────────────────────────────────────────────────

    MAX_VERSIONS = 60

    def _prune_versions(self, document_id: str) -> None:
        rows = (
            self.db.query(DocVersion)
            .filter(DocVersion.document_id == document_id)
            .order_by(DocVersion.version_no.desc())
            .all()
        )
        for old in rows[self.MAX_VERSIONS :]:
            if old.kind == "save":
                self.db.delete(old)

    def list_versions(self, scope: str, document_id: str) -> List[DocVersionRead]:
        self._get_document_row(scope, document_id)
        rows = (
            self.db.query(DocVersion)
            .filter(DocVersion.document_id == document_id)
            .order_by(DocVersion.version_no.desc())
            .all()
        )
        return [DocVersionRead.model_validate(r) for r in rows]

    def get_version(self, scope: str, document_id: str, version_no: int) -> DocVersionDetail:
        self._get_document_row(scope, document_id)
        v = (
            self.db.query(DocVersion)
            .filter(DocVersion.document_id == document_id, DocVersion.version_no == version_no)
            .first()
        )
        if not v:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Version not found")
        return DocVersionDetail.model_validate(v)

    def restore_version(
        self, scope: str, document_id: str, version_no: int, user_id: Optional[int]
    ) -> DocDocumentDetail:
        d = self._get_document_row(scope, document_id)
        v = self.get_version(scope, document_id, version_no)
        d.content_markdown = v.content_markdown or ""
        d.content_json = v.content_json
        d.word_count = _word_count(d.content_markdown)
        d.version_no = int(d.version_no or 1) + 1
        d.updated_by = user_id
        self.db.add(
            DocVersion(
                document_id=d.id,
                version_no=d.version_no,
                title=d.title,
                content_markdown=d.content_markdown,
                content_json=d.content_json,
                note=f"Restored v{version_no}",
                kind="restore",
                created_by=user_id,
            )
        )
        self.db.commit()
        self.db.refresh(d)
        return DocDocumentDetail.model_validate(d)

    # ── Assets ─────────────────────────────────────────────────────────────

    MAX_ASSET_BYTES = 8 * 1024 * 1024

    def create_asset(
        self,
        scope: str,
        *,
        filename: str,
        content_type: str,
        data: bytes,
        document_id: Optional[str],
        user_id: Optional[int],
    ) -> DocAssetRead:
        if len(data) > self.MAX_ASSET_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Asset exceeds 8 MB")
        if document_id:
            self._get_document_row(scope, document_id)
        a = DocAsset(
            scope=scope,
            document_id=document_id,
            filename=filename[:300],
            content_type=content_type or "application/octet-stream",
            size_bytes=len(data),
            data=data,
            created_by=user_id,
        )
        self.db.add(a)
        self.db.commit()
        self.db.refresh(a)
        return self._asset_read(a)

    def get_asset(self, asset_id: str) -> DocAsset:
        a = self.db.query(DocAsset).filter(DocAsset.id == asset_id).first()
        if not a:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
        return a

    def _asset_read(self, a: DocAsset) -> DocAssetRead:
        return DocAssetRead(
            id=a.id,
            document_id=a.document_id,
            filename=a.filename,
            content_type=a.content_type,
            size_bytes=a.size_bytes,
            url=f"{ASSET_URL_PREFIX}/{a.id}/file",
            created_at=a.created_at,
        )

    # ── Stats ──────────────────────────────────────────────────────────────

    def stats(self, scope: str) -> DocStudioStats:
        docs = self.db.query(DocDocument).filter(DocDocument.scope == scope, DocDocument.status != "archived")
        total = docs.count()
        drafts = docs.filter(DocDocument.status == "draft").count()
        published = docs.filter(DocDocument.status == "published").count()
        words = int(
            self.db.query(func.coalesce(func.sum(DocDocument.word_count), 0))
            .filter(DocDocument.scope == scope, DocDocument.status != "archived")
            .scalar()
            or 0
        )
        folders = self.db.query(func.count(DocFolder.id)).filter(DocFolder.scope == scope).scalar() or 0
        recent = docs.order_by(DocDocument.updated_at.desc()).limit(5).all()
        return DocStudioStats(
            folders=int(folders),
            documents=total,
            drafts=drafts,
            published=published,
            words=words,
            recent=[DocDocumentRead.model_validate(r) for r in recent],
        )

    # ── Compatibility with workforce_succession doc-pack endpoint ─────────

    def _doc_with_lock_name(self, doc: Any, user_id: Optional[int]) -> DocDocumentRead:
        return DocDocumentRead.model_validate(doc)
