"""Document Studio service — folders, documents, versions, assets.

Roles
-----
Authors: platform_admin, oww_partner, district_admin, district_manager,
ceu_admin, workforce_manager. Viewers: any authenticated WW360 user.
Operators may author when recorder access allows.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any

from app.models.doc_document import (
    PROGRAM_SCOPE,
    DocAsset,
    DocDocument,
    DocFolder,
    DocVersion,
    is_program_scope,
    normalize_doc_scope,
    program_scope_for_state,
)
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
from app.services.doc_studio_seeds import (
    LIBRARY_SEED_TAG,
    folders_for_scope,
    seed_docs_for_scope,
)
from app.tenant_auth import TenantContext
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

AUTHOR_ROLES = {
    "platform_admin",
    "oww_partner",
    "state_admin",
    "district_admin",
    "district_manager",
    "ceu_admin",
    "workforce_manager",
    "admin",
}
PUBLISH_ROLES = {"platform_admin", "oww_partner", "state_admin", "district_admin", "ceu_admin", "admin"}
CUSTODY_TRANSFER_ROLES = PUBLISH_ROLES | {"district_manager", "workforce_manager"}

ASSET_URL_PREFIX = "/api/v1/doc-studio/assets"
_WORD_RE = re.compile(r"[A-Za-z0-9’'-]+")


def _word_count(markdown: str | None) -> int:
    if not markdown:
        return 0
    return len(_WORD_RE.findall(markdown))


def resolve_scope(context: TenantContext, requested: str | None = None) -> str:
    """State-keyed program library or district scope."""
    default_program = context.program_scope()

    if requested:
        norm = normalize_doc_scope(requested, default_state=context.active_state_code)
        if context.is_global_admin:
            return norm
        if is_program_scope(norm) and context.is_state_exec():
            if norm == default_program:
                return norm
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to that document scope")
        if context.has_district_access(norm):
            return norm
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to that document scope")

    if context.is_global_admin or context.is_state_exec():
        return default_program
    if context.district_code:
        return context.district_code
    return default_program


class DocStudioService:
    def __init__(self, db: Session):
        self.db = db

    # ── Access ─────────────────────────────────────────────────────────────

    def access(self, context: TenantContext, scope: str) -> DocStudioAccess:
        roles = set(context.roles)
        operator_roles = {"ceu_user", "district_operator", "workforce_operator"}
        can_author = context.is_global_admin or bool(roles & AUTHOR_ROLES)
        if not can_author and roles & operator_roles:
            from app.services.documentation_task_service import recorder_access

            rec = recorder_access(self.db, context, scope)
            can_author = rec.can_record
        can_publish = context.is_global_admin or bool(roles & PUBLISH_ROLES)
        can_custody = context.is_global_admin or bool(roles & CUSTODY_TRANSFER_ROLES)
        label = (
            f"{context.active_state_code} program library"
            if is_program_scope(scope)
            else f"{scope} library"
        )
        return DocStudioAccess(
            scope=scope,
            scope_label=label,
            can_view=True,
            can_author=can_author,
            can_publish=can_publish,
            can_manage_folders=can_author,
            can_connect_library=can_author,
            can_custody_transfer=can_custody,
            roles=sorted(roles),
        )

    def require_author(self, context: TenantContext, scope: str) -> None:
        if not self.access(context, scope).can_author:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Authoring requires a program or district manager role"
            )

    def require_publisher(self, context: TenantContext, scope: str) -> None:
        if not self.access(context, scope).can_publish:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Publishing requires an admin or program partner role"
            )

    # ── Folders + library samples ──────────────────────────────────────────

    def ensure_default_folders(self, scope: str, user_id: int | None) -> None:
        """Create any missing default folders (safe to call on every access)."""
        defaults = folders_for_scope(scope)
        existing_names = {
            name
            for (name,) in self.db.query(DocFolder.name).filter(DocFolder.scope == scope).all()
        }
        added = False
        for idx, (name, desc) in enumerate(defaults):
            if name in existing_names:
                continue
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
            added = True
        if added:
            self.db.commit()

    def ensure_library_samples(self, scope: str, user_id: int | None) -> None:
        """Idempotently seed sample documents so empty libraries are not blank.

        Uses tags ``library_seed`` + ``template_id`` so re-runs skip existing seeds
        without blocking user-created docs that happen to share a title.
        """
        self.ensure_default_folders(scope, user_id)
        seeds = seed_docs_for_scope(scope)
        if not seeds:
            return

        folders = {
            f.name: f
            for f in self.db.query(DocFolder).filter(DocFolder.scope == scope).all()
        }
        existing_template_ids: set[str] = set()
        for (tags,) in (
            self.db.query(DocDocument.tags)
            .filter(DocDocument.scope == scope, DocDocument.status != "archived")
            .all()
        ):
            if not isinstance(tags, list):
                continue
            if LIBRARY_SEED_TAG not in tags:
                continue
            for t in tags:
                if isinstance(t, str) and t.startswith("template:"):
                    existing_template_ids.add(t.split(":", 1)[1])

        added = False
        for seed in seeds:
            if seed["template_id"] in existing_template_ids:
                continue
            folder = folders.get(seed["folder"])
            md = seed["markdown"]
            d = DocDocument(
                scope=scope,
                folder_id=folder.id if folder else None,
                title=seed["title"],
                doc_type=seed.get("doc_type") or "document",
                status="draft",
                summary="Starter sample — edit or duplicate for your utility.",
                tags=[LIBRARY_SEED_TAG, f"template:{seed['template_id']}"],
                template_id=seed["template_id"],
                content_markdown=md,
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
                    note=f"Library sample from template {seed['template_id']}",
                    kind="save",
                    created_by=user_id,
                )
            )
            added = True
        if added:
            self.db.commit()

    def provision_library(self, scope: str, user_id: int | None) -> None:
        """Folders + sample docs for the active scope."""
        self.ensure_library_samples(scope, user_id)

    def list_folders(self, scope: str) -> list[DocFolderRead]:
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
        out: list[DocFolderRead] = []
        for f in rows:
            item = DocFolderRead.model_validate(f)
            item.document_count = int(counts.get(f.id, 0))
            out.append(item)
        return out

    def _get_folder(self, scope: str, folder_id: str) -> DocFolder:
        f = (
            self.db.query(DocFolder)
            .filter(DocFolder.id == folder_id, DocFolder.scope == scope)
            .first()
        )
        if not f:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
        return f

    def create_folder(
        self, scope: str, payload: DocFolderCreate, user_id: int | None
    ) -> DocFolderRead:
        if payload.parent_id:
            self._get_folder(scope, payload.parent_id)
        max_sort = (
            self.db.query(func.max(DocFolder.sort_order)).filter(DocFolder.scope == scope).scalar()
            or 0
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
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "A folder cannot be its own parent"
                )
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
        folder_id: str | None = None,
        q: str | None = None,
        status_filter: str | None = None,
        review_state: str | None = None,
        include_archived: bool = False,
        limit: int = 200,
    ) -> list[DocDocumentRead]:
        query = self.db.query(DocDocument).filter(DocDocument.scope == scope)
        if folder_id == "__root__":
            query = query.filter(DocDocument.folder_id.is_(None))
        elif folder_id:
            query = query.filter(DocDocument.folder_id == folder_id)
        if status_filter:
            query = query.filter(DocDocument.status == status_filter)
        if review_state:
            query = query.filter(DocDocument.review_state == review_state)
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

    def require_custody_transfer(self, context: TenantContext, scope: str) -> None:
        if not self.access(context, scope).can_custody_transfer:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Custody transfer requires a manager or publish role",
            )

    def document_detail(self, scope: str, document_id: str) -> DocDocumentDetail:
        row = self._get_document_row(scope, document_id)
        detail = DocDocumentDetail.model_validate(row)
        if row.external_ref:
            from app.schemas.doc_studio import DocExternalRefRead

            detail.external_ref = DocExternalRefRead.model_validate(row.external_ref)
        return detail

    def get_document(self, scope: str, document_id: str) -> DocDocumentDetail:
        return self.document_detail(scope, document_id)

    def create_document(
        self, scope: str, payload: DocDocumentCreate, user_id: int | None
    ) -> DocDocumentDetail:
        if payload.folder_id:
            self._get_folder(scope, payload.folder_id)
        md = payload.content_markdown or ""
        d = DocDocument(
            scope=scope,
            folder_id=payload.folder_id,
            title=payload.title.strip(),
            doc_type=payload.doc_type or "document",
            status="draft",
            summary=payload.summary,
            tags=payload.tags,
            template_id=payload.template_id,
            content_markdown=md,
            content_json=payload.content_json,
            tutorial_data=payload.tutorial_data,
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
                tutorial_data=payload.tutorial_data,
                note="Created"
                + (f" from template {payload.template_id}" if payload.template_id else ""),
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
        folder_id: str | None,
        source_filename: str,
        user_id: int | None,
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
        self, scope: str, document_id: str, payload: DocDocumentUpdate, user_id: int | None
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
        self, scope: str, document_id: str, payload: DocContentSave, user_id: int | None
    ) -> DocDocumentDetail:
        d = self._get_document_row(scope, document_id)
        incoming = payload.content_markdown or ""
        if payload.autosave:
            # Autosave only updates the working copy; compare against it.
            changed = (d.content_markdown or "") != incoming
        else:
            # Explicit save snapshots a version whenever the content differs from the
            # last *version*, not the last autosave (otherwise Save after an autosave is a no-op).
            latest = (
                self.db.query(DocVersion)
                .filter(DocVersion.document_id == d.id)
                .order_by(DocVersion.version_no.desc())
                .first()
            )
            baseline = (latest.content_markdown if latest else d.content_markdown) or ""
            changed = baseline != incoming
        if payload.title is not None and payload.title.strip() and payload.title.strip() != d.title:
            d.title = payload.title.strip()
            changed = True
        d.content_markdown = payload.content_markdown or ""
        d.content_json = payload.content_json
        if payload.tutorial_data is not None:
            d.tutorial_data = payload.tutorial_data
        d.word_count = _word_count(d.content_markdown)
        d.updated_by = user_id
        if (changed and not payload.autosave) or payload.force_version:
            d.version_no = int(d.version_no or 1) + 1
            self.db.add(
                DocVersion(
                    document_id=d.id,
                    version_no=d.version_no,
                    title=d.title,
                    content_markdown=d.content_markdown,
                    content_json=d.content_json,
                    tutorial_data=d.tutorial_data,
                    note=payload.note,
                    kind="save",
                    created_by=user_id,
                )
            )
            self._prune_versions(d.id)
        self.db.commit()
        self.db.refresh(d)
        return DocDocumentDetail.model_validate(d)

    def set_review_state(
        self, scope: str, document_id: str, review_state: str, user_id: int | None
    ) -> DocDocumentDetail:
        d = self._get_document_row(scope, document_id)
        d.review_state = review_state
        d.updated_by = user_id
        self.db.commit()
        self.db.refresh(d)
        return DocDocumentDetail.model_validate(d)

    def publish(self, scope: str, document_id: str, user_id: int | None) -> DocDocumentDetail:
        d = self._get_document_row(scope, document_id)
        d.status = "published"
        d.review_state = "approved"
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
                tutorial_data=d.tutorial_data,
                note="Published",
                kind="publish",
                created_by=user_id,
            )
        )
        self.db.commit()
        self.db.refresh(d)
        return DocDocumentDetail.model_validate(d)

    def duplicate(self, scope: str, document_id: str, user_id: int | None) -> DocDocumentDetail:
        src = self._get_document_row(scope, document_id)
        payload = DocDocumentCreate(
            title=f"{src.title} (copy)",
            folder_id=src.folder_id,
            doc_type=src.doc_type or "document",
            template_id=src.template_id,
            content_markdown=src.content_markdown or "",
            content_json=src.content_json,
            tutorial_data=src.tutorial_data,
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

    def list_versions(self, scope: str, document_id: str) -> list[DocVersionRead]:
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
        self, scope: str, document_id: str, version_no: int, user_id: int | None
    ) -> DocDocumentDetail:
        d = self._get_document_row(scope, document_id)
        v = self.get_version(scope, document_id, version_no)
        d.content_markdown = v.content_markdown or ""
        d.content_json = v.content_json
        d.tutorial_data = v.tutorial_data
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
                tutorial_data=d.tutorial_data,
                note=f"Restored v{version_no}",
                kind="restore",
                created_by=user_id,
            )
        )
        self.db.commit()
        self.db.refresh(d)
        return DocDocumentDetail.model_validate(d)

    # ── Assets ─────────────────────────────────────────────────────────────

    MAX_ASSET_BYTES = 50 * 1024 * 1024  # tutorial video + step screenshots

    def create_asset(
        self,
        scope: str,
        *,
        filename: str,
        content_type: str,
        data: bytes,
        document_id: str | None,
        user_id: int | None,
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

    def list_assets(
        self,
        scope: str,
        *,
        document_id: str | None = None,
        images_only: bool = True,
        limit: int = 100,
    ) -> list[DocAssetRead]:
        q = self.db.query(DocAsset).filter(DocAsset.scope == scope)
        if document_id:
            q = q.filter(
                (DocAsset.document_id == document_id) | (DocAsset.document_id.is_(None))
            )
        if images_only:
            q = q.filter(DocAsset.content_type.like("image/%"))
        rows = q.order_by(DocAsset.created_at.desc()).limit(max(1, min(limit, 200))).all()
        return [self._asset_read(a) for a in rows]

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
        from app.services.workforce_succession.binder_catalog import BINDER_TAG

        docs_q = self.db.query(DocDocument).filter(
            DocDocument.scope == scope, DocDocument.status != "archived"
        )
        rows = docs_q.all()
        total = len(rows)
        drafts = sum(1 for d in rows if d.status == "draft")
        published = sum(1 for d in rows if d.status == "published")
        pending_approval = sum(1 for d in rows if (d.review_state or "none") == "submitted")
        tutorials = sum(1 for d in rows if (d.doc_type or "") == "tutorial")

        folder_rows = (
            self.db.query(DocFolder.id, DocFolder.name).filter(DocFolder.scope == scope).all()
        )
        folders = len(folder_rows)
        ops_ids = {fid for fid, name in folder_rows if (name or "").strip().lower() == "operations"}
        succession_folder_ids = {
            fid
            for fid, name in folder_rows
            if "succession" in (name or "").lower()
        }

        def _is_succession(d: DocDocument) -> bool:
            tags = d.tags if isinstance(d.tags, list) else []
            if any(isinstance(t, str) and (t == BINDER_TAG or t.startswith(f"{BINDER_TAG}:")) for t in tags):
                return True
            if d.folder_id and d.folder_id in succession_folder_ids:
                return True
            title = (d.title or "").lower()
            return "succession binder" in title or "ceu tracker" in title

        succession_docs = sum(1 for d in rows if _is_succession(d))
        succession_published = sum(
            1 for d in rows if _is_succession(d) and d.status == "published"
        )
        operations_docs = sum(1 for d in rows if d.folder_id in ops_ids)

        words = int(
            self.db.query(func.coalesce(func.sum(DocDocument.word_count), 0))
            .filter(DocDocument.scope == scope, DocDocument.status != "archived")
            .scalar()
            or 0
        )
        recent = sorted(rows, key=lambda d: d.updated_at or d.created_at or datetime.min, reverse=True)[
            :5
        ]
        return DocStudioStats(
            folders=int(folders),
            documents=total,
            drafts=drafts,
            published=published,
            words=words,
            pending_approval=pending_approval,
            tutorials=tutorials,
            succession_docs=succession_docs,
            succession_published=succession_published,
            operations_docs=operations_docs,
            recent=[DocDocumentRead.model_validate(r) for r in recent],
        )

    # ── Compatibility with workforce_succession doc-pack endpoint ─────────

    def _doc_with_lock_name(self, doc: Any, user_id: int | None) -> DocDocumentRead:
        return DocDocumentRead.model_validate(doc)
