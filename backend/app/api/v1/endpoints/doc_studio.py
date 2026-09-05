"""Document Studio endpoints — ``/api/v1/doc-studio``.

Scope resolution: OWW partners and platform admins default to the shared
``program`` library; district users default to their district. Any endpoint
accepts ``?scope=`` for admins who need to switch.
"""

from __future__ import annotations

import logging
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import HTMLResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
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
from app.services.doc_studio_export_service import (
    DocStudioExportService,
    file_to_markdown,
    title_from_markdown,
)
from app.services.doc_studio_service import DocStudioService, resolve_scope
from app.tenant_auth import TenantContext

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_enabled() -> None:
    if not settings.WW360_DOC_STUDIO_ENABLED:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Document Studio is not enabled on this WW360 host")


def _ctx(
    context: TenantContext = Depends(deps.get_current_tenant_user),
    scope: Optional[str] = Query(None, description="program | <district_code>"),
) -> tuple[TenantContext, str]:
    _require_enabled()
    return context, resolve_scope(context, scope)


def _filename(title: str, ext: str) -> str:
    safe = "".join(c if c.isalnum() or c in " -_" else "" for c in (title or "document")).strip() or "document"
    return f"{safe[:80]}.{ext}"


# ── Access / stats ───────────────────────────────────────────────────────────


@router.get("/access", response_model=DocStudioAccess)
def get_access(pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    svc = DocStudioService(db)
    svc.ensure_default_folders(scope, context.user_id)
    return svc.access(context, scope)


@router.get("/stats", response_model=DocStudioStats)
def get_stats(pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    _, scope = pair
    return DocStudioService(db).stats(scope)


# ── Folders ──────────────────────────────────────────────────────────────────


@router.get("/folders", response_model=List[DocFolderRead])
def list_folders(pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    svc = DocStudioService(db)
    svc.ensure_default_folders(scope, context.user_id)
    return svc.list_folders(scope)


@router.post("/folders", response_model=DocFolderRead, status_code=status.HTTP_201_CREATED)
def create_folder(payload: DocFolderCreate, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    return svc.create_folder(scope, payload, context.user_id)


@router.patch("/folders/{folder_id}", response_model=DocFolderRead)
def update_folder(
    folder_id: str, payload: DocFolderUpdate, pair=Depends(_ctx), db: Session = Depends(deps.get_db)
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    return svc.update_folder(scope, folder_id, payload)


@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: str, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    svc.delete_folder(scope, folder_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Documents ────────────────────────────────────────────────────────────────


@router.get("/documents", response_model=List[DocDocumentRead])
def list_documents(
    folder_id: Optional[str] = Query(None, description="folder id, or __root__ for unfiled"),
    q: Optional[str] = Query(None, min_length=1, max_length=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    include_archived: bool = False,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    _, scope = pair
    return DocStudioService(db).list_documents(
        scope, folder_id=folder_id, q=q, status_filter=status_filter, include_archived=include_archived
    )


@router.post("/documents", response_model=DocDocumentDetail, status_code=status.HTTP_201_CREATED)
def create_document(payload: DocDocumentCreate, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    return svc.create_document(scope, payload, context.user_id)


@router.post("/documents/import", response_model=DocDocumentDetail, status_code=status.HTTP_201_CREATED)
async def import_document(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File exceeds 20 MB")
    try:
        markdown = file_to_markdown(file.filename or "", file.content_type or "", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc
    except Exception as exc:
        logger.warning("Import failed for %s: %s", file.filename, exc)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Could not read that file") from exc
    fallback = (file.filename or "Imported document").rsplit(".", 1)[0]
    return svc.create_imported_document(
        scope,
        title=(title or title_from_markdown(markdown, fallback)),
        markdown=markdown,
        folder_id=folder_id or None,
        source_filename=file.filename or fallback,
        user_id=context.user_id,
    )


@router.get("/documents/{document_id}", response_model=DocDocumentDetail)
def get_document(document_id: str, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    _, scope = pair
    return DocStudioService(db).get_document(scope, document_id)


@router.patch("/documents/{document_id}", response_model=DocDocumentDetail)
def update_document(
    document_id: str, payload: DocDocumentUpdate, pair=Depends(_ctx), db: Session = Depends(deps.get_db)
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    if payload.status == "published":
        svc.require_publisher(context, scope)
    return svc.update_document(scope, document_id, payload, context.user_id)


@router.put("/documents/{document_id}/content", response_model=DocDocumentDetail)
def save_content(
    document_id: str, payload: DocContentSave, pair=Depends(_ctx), db: Session = Depends(deps.get_db)
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    return svc.save_content(scope, document_id, payload, context.user_id)


@router.post("/documents/{document_id}/publish", response_model=DocDocumentDetail)
def publish_document(document_id: str, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_publisher(context, scope)
    return svc.publish(scope, document_id, context.user_id)


@router.post("/documents/{document_id}/duplicate", response_model=DocDocumentDetail, status_code=201)
def duplicate_document(document_id: str, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    return svc.duplicate(scope, document_id, context.user_id)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    svc.delete_document(scope, document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Versions ─────────────────────────────────────────────────────────────────


@router.get("/documents/{document_id}/versions", response_model=List[DocVersionRead])
def list_versions(document_id: str, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    _, scope = pair
    return DocStudioService(db).list_versions(scope, document_id)


@router.get("/documents/{document_id}/versions/{version_no}", response_model=DocVersionDetail)
def get_version(
    document_id: str, version_no: int, pair=Depends(_ctx), db: Session = Depends(deps.get_db)
):
    _, scope = pair
    return DocStudioService(db).get_version(scope, document_id, version_no)


@router.post("/documents/{document_id}/versions/{version_no}/restore", response_model=DocDocumentDetail)
def restore_version(
    document_id: str, version_no: int, pair=Depends(_ctx), db: Session = Depends(deps.get_db)
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    return svc.restore_version(scope, document_id, version_no, context.user_id)


# ── Export ───────────────────────────────────────────────────────────────────


@router.get("/documents/{document_id}/export/{fmt}")
def export_document(
    document_id: str,
    fmt: str,
    download: bool = True,
    context: TenantContext = Depends(deps.get_current_tenant_user_from_header_or_query),
    scope: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
):
    _require_enabled()
    resolved = resolve_scope(context, scope)
    exporter = DocStudioExportService(db)
    doc = exporter._doc(resolved, document_id)
    disposition = "attachment" if download else "inline"
    fmt = fmt.lower()
    if fmt in ("md", "markdown"):
        body = exporter.export_markdown(resolved, document_id)
        return PlainTextResponse(
            body,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(_filename(doc.title, 'md'))}"},
        )
    if fmt == "html":
        return HTMLResponse(exporter.export_html(resolved, document_id))
    if fmt == "pdf":
        data = exporter.export_pdf(resolved, document_id)
        return Response(
            data,
            media_type="application/pdf",
            headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(_filename(doc.title, 'pdf'))}"},
        )
    if fmt == "docx":
        try:
            data = exporter.export_docx(resolved, document_id)
        except RuntimeError as exc:
            raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, str(exc)) from exc
        return Response(
            data,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(_filename(doc.title, 'docx'))}"},
        )
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported format — use pdf, docx, markdown or html")


# ── Assets ───────────────────────────────────────────────────────────────────


@router.post("/assets", response_model=DocAssetRead, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    file: UploadFile = File(...),
    document_id: Optional[str] = Form(None),
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    data = await file.read()
    ctype = file.content_type or "application/octet-stream"
    if not ctype.startswith("image/"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only image uploads are supported inline")
    return svc.create_asset(
        scope,
        filename=file.filename or "image",
        content_type=ctype,
        data=data,
        document_id=document_id or None,
        user_id=context.user_id,
    )


@router.get("/assets/{asset_id}/file")
def get_asset_file(asset_id: str, db: Session = Depends(deps.get_db)):
    """Serve an embedded image.

    Unauthenticated by design: asset ids are unguessable UUIDs and the editor
    renders ``<img src>`` without headers. Only image MIME types are accepted on
    upload, so no documents leak through this route.
    """
    _require_enabled()
    a = DocStudioService(db).get_asset(asset_id)
    return Response(
        bytes(a.data),
        media_type=a.content_type,
        headers={"Cache-Control": "private, max-age=86400", "Content-Disposition": f"inline; filename*=UTF-8''{quote(a.filename)}"},
    )
