"""Document Studio endpoints — ``/api/v1/doc-studio``.

Scope resolution: OWW partners and platform admins default to the shared
``program`` library; district users default to their district. Any endpoint
accepts ``?scope=`` for admins who need to switch.
"""

from __future__ import annotations

import json
import logging
from urllib.parse import quote

from app.api import deps
from app.core.config import settings
from app.schemas.doc_studio import (
    CustodyAcknowledgmentRead,
    CustodyAcknowledgmentRequest,
    CustodyPolicyRead,
    CustodyTransferCreate,
    CustodyTransferItemRead,
    CustodyTransferRead,
    DocAssetRead,
    DocContentSave,
    DocDocumentCreate,
    DocDocumentDetail,
    DocDocumentRead,
    DocDocumentUpdate,
    DocFolderCreate,
    DocFolderRead,
    DocFolderUpdate,
    DocLibraryConnectionRead,
    DocLibraryConnectionUpdate,
    DocStudioAccess,
    DocStudioStats,
    DocVersionDetail,
    DocVersionRead,
    ExternalBrowseItem,
    ExternalExportRequest,
    ExternalImportRequest,
    TutorialGenerateResponse,
)
from app.models.doc_document import DocLibraryConnection
from app.services.doc_custody_service import DocCustodyService
from app.services.doc_studio_library_constants import resolve_owner
from app.services.external_library_provider import ExternalLibraryService, get_provider
from app.services.doc_studio_export_service import (
    DocStudioExportService,
    file_to_markdown,
    title_from_markdown,
)
from app.services.doc_studio_service import DocStudioService, resolve_scope
from app.services.tutorial_generation_service import get_tutorial_generation_service
from app.tenant_auth import TenantContext
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse, PlainTextResponse
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_enabled() -> None:
    if not settings.WW360_DOC_STUDIO_ENABLED:
        raise HTTPException(
            status.HTTP_501_NOT_IMPLEMENTED, "Document Studio is not enabled on this WW360 host"
        )


def _ctx(
    context: TenantContext = Depends(deps.get_current_tenant_user),
    scope: str | None = Query(None, description="program | <district_code>"),
) -> tuple[TenantContext, str]:
    _require_enabled()
    return context, resolve_scope(context, scope)


def _filename(title: str, ext: str) -> str:
    safe = (
        "".join(c if c.isalnum() or c in " -_" else "" for c in (title or "document")).strip()
        or "document"
    )
    return f"{safe[:80]}.{ext}"


def _user_id(context: TenantContext) -> int | None:
    return context.user_id


def _user_display_name(context: TenantContext) -> str:
    return getattr(context, "username", None) or str(context.user_id or "user")


def _transfer_to_read(transfer) -> CustodyTransferRead:
    return CustodyTransferRead(
        id=transfer.id,
        scope=transfer.scope,
        destination_owner_type=transfer.destination_owner_type,
        destination_owner_code=transfer.destination_owner_code,
        connection_id=transfer.connection_id,
        external_folder_id=transfer.external_folder_id,
        status=transfer.status,
        retention_days=transfer.retention_days,
        purge_scheduled_at=transfer.purge_scheduled_at,
        purged_at=transfer.purged_at,
        initiated_by_name=transfer.initiated_by_name,
        verified_by_name=transfer.verified_by_name,
        verified_at=transfer.verified_at,
        failure_reason=transfer.failure_reason,
        created_at=transfer.created_at,
        items=[CustodyTransferItemRead.model_validate(i) for i in transfer.items],
    )


# ── Access / stats ───────────────────────────────────────────────────────────


@router.get("/access", response_model=DocStudioAccess)
def get_access(pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    svc = DocStudioService(db)
    svc.provision_library(scope, context.user_id)
    return svc.access(context, scope)


@router.get("/stats", response_model=DocStudioStats)
def get_stats(pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    _, scope = pair
    return DocStudioService(db).stats(scope)


# ── Folders ──────────────────────────────────────────────────────────────────


@router.get("/folders", response_model=list[DocFolderRead])
def list_folders(pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    svc = DocStudioService(db)
    svc.provision_library(scope, context.user_id)
    return svc.list_folders(context, scope)


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


@router.get("/documents", response_model=list[DocDocumentRead])
def list_documents(
    folder_id: str | None = Query(None, description="folder id, or __root__ for unfiled"),
    q: str | None = Query(None, min_length=1, max_length=200),
    status_filter: str | None = Query(None, alias="status"),
    review_state: str | None = Query(None),
    include_archived: bool = False,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    return DocStudioService(db).list_documents(
        context,
        scope,
        folder_id=folder_id,
        q=q,
        status_filter=status_filter,
        review_state=review_state,
        include_archived=include_archived,
    )


@router.post("/documents", response_model=DocDocumentDetail, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocDocumentCreate, pair=Depends(_ctx), db: Session = Depends(deps.get_db)
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    return svc.create_document(scope, payload, context.user_id, context)


@router.post(
    "/documents/import", response_model=DocDocumentDetail, status_code=status.HTTP_201_CREATED
)
async def import_document(
    file: UploadFile = File(...),
    folder_id: str | None = Form(None),
    title: str | None = Form(None),
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
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Could not read that file"
        ) from exc
    fallback = (file.filename or "Imported document").rsplit(".", 1)[0]
    return svc.create_imported_document(
        scope,
        title=(title or title_from_markdown(markdown, fallback)),
        markdown=markdown,
        folder_id=folder_id or None,
        source_filename=file.filename or fallback,
        user_id=context.user_id,
        context=context,
    )


@router.get("/documents/{document_id}", response_model=DocDocumentDetail)
def get_document(document_id: str, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    context, scope = pair
    return DocStudioService(db).get_document(context, scope, document_id)


@router.patch("/documents/{document_id}", response_model=DocDocumentDetail)
def update_document(
    document_id: str,
    payload: DocDocumentUpdate,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    if payload.status == "published":
        svc.require_publisher(context, scope)
    return svc.update_document(scope, document_id, payload, context.user_id, context)


@router.put("/documents/{document_id}/content", response_model=DocDocumentDetail)
def save_content(
    document_id: str,
    payload: DocContentSave,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    return svc.save_content(scope, document_id, payload, context.user_id)


@router.post("/documents/{document_id}/publish", response_model=DocDocumentDetail)
def publish_document(document_id: str, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    from app.models.documentation_task import DocumentationTask
    from app.services.documentation_task_service import mark_published

    context, scope = pair
    svc = DocStudioService(db)
    svc.require_publisher(context, scope)
    detail = svc.publish(scope, document_id, context.user_id)
    for task in db.query(DocumentationTask).filter(DocumentationTask.document_id == document_id):
        mark_published(db, task.id, document_id)
    return detail


@router.patch("/documents/{document_id}/review-state", response_model=DocDocumentDetail)
def set_review_state(
    document_id: str,
    review_state: str = Query(..., pattern="^(none|submitted|changes_requested|approved)$"),
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    return svc.set_review_state(scope, document_id, review_state, context.user_id)


@router.post(
    "/documents/{document_id}/duplicate", response_model=DocDocumentDetail, status_code=201
)
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


@router.get("/documents/{document_id}/versions", response_model=list[DocVersionRead])
def list_versions(document_id: str, pair=Depends(_ctx), db: Session = Depends(deps.get_db)):
    _, scope = pair
    return DocStudioService(db).list_versions(scope, document_id)


@router.get("/documents/{document_id}/versions/{version_no}", response_model=DocVersionDetail)
def get_version(
    document_id: str, version_no: int, pair=Depends(_ctx), db: Session = Depends(deps.get_db)
):
    _, scope = pair
    return DocStudioService(db).get_version(scope, document_id, version_no)


@router.post(
    "/documents/{document_id}/versions/{version_no}/restore", response_model=DocDocumentDetail
)
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
    scope: str | None = Query(None),
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
            headers={
                "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(_filename(doc.title, 'md'))}"
            },
        )
    if fmt == "html":
        return HTMLResponse(exporter.export_html(resolved, document_id))
    if fmt == "pdf":
        data = exporter.export_pdf(resolved, document_id)
        return Response(
            data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(_filename(doc.title, 'pdf'))}"
            },
        )
    if fmt == "docx":
        try:
            data = exporter.export_docx(resolved, document_id)
        except RuntimeError as exc:
            raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, str(exc)) from exc
        return Response(
            data,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(_filename(doc.title, 'docx'))}"
            },
        )
    raise HTTPException(
        status.HTTP_400_BAD_REQUEST, "Unsupported format — use pdf, docx, markdown or html"
    )


# ── Assets ───────────────────────────────────────────────────────────────────


@router.get("/assets", response_model=list[DocAssetRead])
def list_assets(
    document_id: str | None = None,
    images_only: bool = True,
    limit: int = 100,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    """List reusable Studio assets (images) for the active scope."""
    _context, scope = pair
    svc = DocStudioService(db)
    return svc.list_assets(scope, document_id=document_id, images_only=images_only, limit=limit)


@router.post("/assets", response_model=DocAssetRead, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    file: UploadFile = File(...),
    document_id: str | None = Form(None),
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    data = await file.read()
    ctype = file.content_type or "application/octet-stream"
    allowed = (
        ctype.startswith("image/")
        or ctype.startswith("video/")
        or ctype.startswith("audio/")
        or ctype == "application/octet-stream"
    )
    if not allowed:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Asset must be image, video, or audio",
        )
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
    """Serve an embedded asset (image, video, audio).

    Unauthenticated by design: asset ids are unguessable UUIDs. Only allowed MIME
    types are accepted on upload.
    """
    _require_enabled()
    a = DocStudioService(db).get_asset(asset_id)
    return Response(
        bytes(a.data),
        media_type=a.content_type,
        headers={
            "Cache-Control": "private, max-age=86400",
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(a.filename)}",
        },
    )


# ── Tutorial generation ──────────────────────────────────────────────────────


@router.post("/tutorials/generate", response_model=TutorialGenerateResponse)
async def generate_studio_tutorial(
    events: str = Form(...),
    base_title: str = Form(""),
    audio: UploadFile | None = File(None),
    pair=Depends(_ctx),
):
    """Generate a draft step-by-step guide from a recording interaction log."""
    _, scope = pair
    try:
        parsed = json.loads(events)
    except json.JSONDecodeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "events must be valid JSON") from exc

    steps = parsed.get("steps") or []
    if not isinstance(steps, list) or not steps:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No interaction steps captured")

    task_title = (parsed.get("title") or "").strip()
    guide_base = (base_title or task_title or "Document Studio tutorial").strip()

    generator = get_tutorial_generation_service()
    transcript = ""
    if audio is not None:
        try:
            audio_bytes = await audio.read()
            filename = audio.filename or "narration.webm"
            transcript = await run_in_threadpool(
                generator.transcribe_narration, audio_bytes, filename
            )
        except Exception as exc:
            logger.warning("Studio tutorial transcription failed: %s", exc)

    try:
        result = await generator.generate_guide(
            base_title=guide_base,
            task_title=task_title,
            steps=steps,
            transcript=transcript,
        )
        return TutorialGenerateResponse(**result)
    except Exception as exc:
        logger.error("Studio tutorial generation failed: %s", exc)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to generate guide") from exc


# ── External library ─────────────────────────────────────────────────────────


@router.get("/library/connections", response_model=list[DocLibraryConnectionRead])
def list_library_connections(
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    owner_type, owner_code = resolve_owner(scope)
    rows = ExternalLibraryService(db).list_connections(owner_type, owner_code)
    return [DocLibraryConnectionRead.model_validate(r) for r in rows]


@router.patch("/library/connections/{connection_id}", response_model=DocLibraryConnectionRead)
async def update_library_connection(
    connection_id: str,
    payload: DocLibraryConnectionUpdate,
    ensure_structure: bool = Query(True),
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    owner_type, owner_code = resolve_owner(scope)
    lib = ExternalLibraryService(db)
    try:
        if ensure_structure:
            conn = (
                db.query(DocLibraryConnection)
                .filter(
                    DocLibraryConnection.id == connection_id,
                    DocLibraryConnection.owner_type == owner_type,
                    DocLibraryConnection.owner_code == owner_code,
                    DocLibraryConnection.is_active.is_(True),
                )
                .first()
            )
            if not conn:
                raise ValueError("Library connection not found")
            result = await lib.ensure_remote_structure(
                conn,
                payload.default_folder_id,
                payload.default_folder_path,
            )
            conn = result["connection"]
        else:
            conn = lib.update_default_folder(
                connection_id,
                owner_type,
                owner_code,
                payload.default_folder_id,
                payload.default_folder_path,
            )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to update library connection folder")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Cloud folder setup failed: {exc}") from exc
    return DocLibraryConnectionRead.model_validate(conn)


@router.delete("/library/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_library_connection(
    connection_id: str,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    owner_type, owner_code = resolve_owner(scope)
    try:
        ExternalLibraryService(db).disconnect_connection(connection_id, owner_type, owner_code)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return None


@router.get("/library/auth-url")
def library_auth_url(
    provider: str = Query(...),
    redirect_uri: str = Query(...),
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    DocStudioService(db).require_author(context, scope)
    owner_type, owner_code = resolve_owner(scope)
    try:
        import urllib.parse

        base_url = get_provider(provider).get_auth_url(owner_code, redirect_uri)
        parsed = urllib.parse.urlparse(base_url)
        qs = urllib.parse.parse_qs(parsed.query)
        qs["state"] = [f"{owner_type}|{owner_code}|{scope}"]
        new_query = urllib.parse.urlencode({k: v[0] for k, v in qs.items()})
        url = urllib.parse.urlunparse(parsed._replace(query=new_query))
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {"auth_url": url, "owner_type": owner_type, "owner_code": owner_code}


@router.post("/library/callback", response_model=DocLibraryConnectionRead)
async def library_oauth_callback(
    provider: str = Query(...),
    code: str = Query(...),
    redirect_uri: str = Query(...),
    state: str | None = Query(None),
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    if state and "|" in state:
        parts = state.split("|", 2)
        owner_type = parts[0]
        owner_code = parts[1] if len(parts) > 1 else scope
    else:
        owner_type, owner_code = resolve_owner(scope)
    prov = get_provider(provider)
    tokens = await prov.exchange_code(code, redirect_uri)
    conn = ExternalLibraryService(db).save_connection(
        owner_type,
        owner_code,
        provider,
        tokens,
        _user_id(context),
    )
    try:
        result = await ExternalLibraryService(db).ensure_remote_structure(conn, "root", "/")
        conn = result["connection"]
    except Exception:
        logger.exception("Connected %s but failed to create remote folder tree", provider)
    return DocLibraryConnectionRead.model_validate(conn)


@router.get("/library/browse", response_model=list[ExternalBrowseItem])
async def browse_library(
    connection_id: str = Query(...),
    folder_id: str | None = Query(None),
    drive_id: str | None = Query(None),
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    owner_type, owner_code = resolve_owner(scope)
    conn = (
        db.query(DocLibraryConnection)
        .filter(
            DocLibraryConnection.id == connection_id,
            DocLibraryConnection.owner_type == owner_type,
            DocLibraryConnection.owner_code == owner_code,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection not found")
    provider = get_provider(conn.provider)
    return await provider.list_items(conn, folder_id=folder_id, drive_id=drive_id)


@router.post("/library/import", response_model=DocDocumentRead)
async def import_external(
    payload: ExternalImportRequest,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    owner_type, owner_code = resolve_owner(scope)
    doc = await ExternalLibraryService(db).import_or_link(
        scope,
        owner_type,
        owner_code,
        payload.connection_id,
        payload.item_id,
        payload.mode,
        payload.folder_id,
        _user_id(context),
        payload.drive_id,
    )
    return DocDocumentRead.model_validate(doc)


@router.post("/library/export")
async def export_to_library(
    document_id: str = Query(...),
    payload: ExternalExportRequest = ...,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    svc = DocStudioService(db)
    svc.require_author(context, scope)
    owner_type, owner_code = resolve_owner(scope)
    conn = (
        db.query(DocLibraryConnection)
        .filter(
            DocLibraryConnection.id == payload.connection_id,
            DocLibraryConnection.owner_type == owner_type,
            DocLibraryConnection.owner_code == owner_code,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection not found")
    exporter = DocStudioExportService(db)
    fmt = payload.format
    if fmt == "pdf":
        data = exporter.export_pdf(scope, document_id)
        filename = f"export-{document_id[:8]}.pdf"
        content_type = "application/pdf"
    elif fmt == "docx":
        data = exporter.export_docx(scope, document_id)
        filename = f"export-{document_id[:8]}.docx"
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        data = exporter.export_markdown(scope, document_id).encode("utf-8")
        filename = f"export-{document_id[:8]}.md"
        content_type = "text/markdown"
    provider = get_provider(conn.provider)
    result = await provider.upload_item(conn, payload.folder_id, filename, data, content_type)
    return {"uploaded": True, "external": result}


# ── Custody transfer ─────────────────────────────────────────────────────────


@router.get("/custody/policy", response_model=CustodyPolicyRead)
def get_custody_policy(
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    DocStudioService(db).require_custody_transfer(context, scope)
    policy = DocCustodyService(db).get_policy()
    return CustodyPolicyRead(**policy)


@router.get("/custody/acknowledgment", response_model=CustodyAcknowledgmentRead | None)
def get_custody_acknowledgment(
    owner_type: str | None = Query(None),
    owner_code: str | None = Query(None),
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    DocStudioService(db).require_custody_transfer(context, scope)
    otype, ocode = resolve_owner(scope)
    if owner_type:
        otype = owner_type
    if owner_code:
        ocode = owner_code
    row = DocCustodyService(db).get_acknowledgment_status(otype, ocode)
    return CustodyAcknowledgmentRead.model_validate(row) if row else None


@router.post("/custody/acknowledgment", response_model=CustodyAcknowledgmentRead)
def record_custody_acknowledgment(
    payload: CustodyAcknowledgmentRequest,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    DocStudioService(db).require_custody_transfer(context, scope)
    row = DocCustodyService(db).record_acknowledgment(
        payload.owner_type,
        payload.owner_code,
        _user_id(context),
        _user_display_name(context),
        payload.confirmed,
    )
    return CustodyAcknowledgmentRead.model_validate(row)


@router.post("/custody/transfers", response_model=CustodyTransferRead)
async def create_custody_transfer(
    payload: CustodyTransferCreate,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    DocStudioService(db).require_custody_transfer(context, scope)
    transfer = await DocCustodyService(db).create_transfer(
        scope,
        payload.document_ids,
        payload.destination_owner_type,
        payload.destination_owner_code,
        payload.connection_id,
        payload.external_folder_id or "root",
        _user_id(context),
        _user_display_name(context),
        payload.export_format,
        payload.retention_days,
    )
    return _transfer_to_read(transfer)


@router.get("/custody/transfers", response_model=list[CustodyTransferRead])
def list_custody_transfers(
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    transfers = DocCustodyService(db).list_transfers(scope)
    return [_transfer_to_read(t) for t in transfers]


@router.post("/custody/transfers/{transfer_id}/purge")
def purge_custody_transfer(
    transfer_id: str,
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    DocStudioService(db).require_custody_transfer(context, scope)
    DocCustodyService(db).get_transfer(transfer_id, scope)
    count = DocCustodyService(db).purge_due_transfers(force_transfer_id=transfer_id)
    return {"purged": count}


@router.post("/custody/purge-due")
def purge_due_custody_transfers(
    pair=Depends(_ctx),
    db: Session = Depends(deps.get_db),
):
    context, scope = pair
    DocStudioService(db).require_custody_transfer(context, scope)
    count = DocCustodyService(db).purge_due_transfers()
    return {"purged": count}
