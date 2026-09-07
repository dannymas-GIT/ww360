"""Document custody transfer, acknowledgment, and purge lifecycle (WW360)."""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timedelta
from typing import Any

from app.models.doc_document import (
    DocAsset,
    DocCustodyAcknowledgment,
    DocCustodyTransfer,
    DocCustodyTransferItem,
    DocDocument,
    DocFolder,
    DocLibraryConnection,
    PROGRAM_SCOPE,
)
from app.services.doc_custody_policy import (
    CUSTODY_POLICY_VERSION,
    MAX_TRANSFER_BYTES,
    MAX_TRANSFER_DOCUMENTS,
    render_acknowledgment_text,
    render_custody_policy,
)
from app.services.doc_custody_receipt_service import build_transfer_receipt_pdf
from app.services.doc_studio_export_service import DocStudioExportService
from app.services.doc_studio_library_constants import is_custody_transferable_folder, resolve_owner
from app.services.external_library_provider import ExternalLibraryService, get_provider
from fastapi import HTTPException
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

DEFAULT_RETENTION_DAYS = 30


def _sanitize_filename(title: str) -> str:
    base = re.sub(r"[^\w\s\-]", "", title).strip().replace(" ", "_")
    return (base[:80] or "document")


class DocCustodyService:
    def __init__(self, db: Session):
        self.db = db

    def get_policy(self, retention_days: int = DEFAULT_RETENTION_DAYS) -> dict[str, Any]:
        return {
            "version": CUSTODY_POLICY_VERSION,
            "markdown": render_custody_policy(retention_days),
            "default_retention_days": DEFAULT_RETENTION_DAYS,
        }

    def get_acknowledgment_status(
        self, owner_type: str, owner_code: str
    ) -> DocCustodyAcknowledgment | None:
        return (
            self.db.query(DocCustodyAcknowledgment)
            .filter(
                DocCustodyAcknowledgment.owner_type == owner_type,
                DocCustodyAcknowledgment.owner_code == owner_code,
                DocCustodyAcknowledgment.policy_version == CUSTODY_POLICY_VERSION,
            )
            .first()
        )

    def record_acknowledgment(
        self,
        owner_type: str,
        owner_code: str,
        user_id: int | None,
        user_name: str,
        confirmed: bool,
    ) -> DocCustodyAcknowledgment:
        if not confirmed:
            raise HTTPException(status_code=400, detail="Acknowledgment checkbox required")
        if owner_type not in ("district", "program"):
            raise HTTPException(status_code=400, detail="Invalid owner_type")
        existing = self.get_acknowledgment_status(owner_type, owner_code)
        if existing:
            return existing
        owner_name = self._resolve_owner_name(owner_type, owner_code)
        ack_text = render_acknowledgment_text(owner_type, owner_code, owner_name)
        row = DocCustodyAcknowledgment(
            owner_type=owner_type,
            owner_code=owner_code,
            policy_version=CUSTODY_POLICY_VERSION,
            acknowledgment_text=ack_text,
            acknowledged_by_user_id=user_id,
            acknowledged_by_name=user_name,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def resolve_connection(
        self,
        owner_type: str,
        owner_code: str,
        connection_id: str,
    ) -> DocLibraryConnection:
        conn = (
            self.db.query(DocLibraryConnection)
            .filter(
                DocLibraryConnection.id == connection_id,
                DocLibraryConnection.owner_type == owner_type,
                DocLibraryConnection.owner_code == owner_code,
                DocLibraryConnection.is_active.is_(True),
            )
            .first()
        )
        if not conn:
            raise HTTPException(status_code=404, detail="Library connection not found")
        return conn

    async def _resolve_remote_folder(
        self,
        conn: DocLibraryConnection,
        doc: DocDocument,
        studio_root_id: str,
        provider,
        cache: dict[str, str],
    ) -> str:
        folder_name = "Imported"
        if doc.folder_id:
            folder = (
                self.db.query(DocFolder)
                .filter(DocFolder.id == doc.folder_id, DocFolder.scope == doc.scope)
                .first()
            )
            if folder and folder.name:
                folder_name = folder.name
        if not is_custody_transferable_folder(folder_name):
            raise HTTPException(
                status_code=400,
                detail=f"Folder '{folder_name}' is not eligible for custody transfer",
            )
        if folder_name in cache:
            return cache[folder_name]
        parent_id = studio_root_id if studio_root_id not in ("", "root", "/") else "root"
        created = await provider.ensure_child_folder(
            conn,
            None if parent_id in ("root", "/") else parent_id,
            folder_name,
        )
        remote_id = created["id"]
        cache[folder_name] = remote_id
        return remote_id

    async def create_transfer(
        self,
        scope: str,
        document_ids: list[str],
        destination_owner_type: str,
        destination_owner_code: str,
        connection_id: str,
        external_folder_id: str,
        initiated_by_user_id: int | None,
        initiated_by_name: str,
        export_format: str = "pdf",
        retention_days: int = DEFAULT_RETENTION_DAYS,
    ) -> DocCustodyTransfer:
        if destination_owner_type not in ("district", "program"):
            raise HTTPException(status_code=400, detail="Invalid destination owner_type")
        if not self.get_acknowledgment_status(destination_owner_type, destination_owner_code):
            raise HTTPException(
                status_code=403,
                detail="Custody policy must be acknowledged before transfer",
            )
        if export_format not in ("pdf", "docx", "markdown"):
            raise HTTPException(status_code=400, detail="Unsupported export format")

        docs = (
            self.db.query(DocDocument)
            .filter(
                DocDocument.scope == scope,
                DocDocument.id.in_(document_ids),
                DocDocument.custody_status == "local",
            )
            .all()
        )
        if len(docs) != len(document_ids):
            raise HTTPException(
                status_code=400,
                detail="One or more documents not found or not eligible for transfer",
            )

        folder_ids = {d.folder_id for d in docs if d.folder_id}
        folder_names: dict[str, str] = {}
        if folder_ids:
            for folder in (
                self.db.query(DocFolder)
                .filter(DocFolder.scope == scope, DocFolder.id.in_(folder_ids))
                .all()
            ):
                folder_names[folder.id] = folder.name

        blocked = [
            d.title
            for d in docs
            if d.folder_id
            and not is_custody_transferable_folder(folder_names.get(d.folder_id, ""))
        ]
        if blocked:
            raise HTTPException(
                status_code=400,
                detail=(
                    "These documents are in folders that cannot be custody-transferred: "
                    + ", ".join(blocked[:5])
                    + ("…" if len(blocked) > 5 else "")
                ),
            )

        if len(docs) > MAX_TRANSFER_DOCUMENTS:
            raise HTTPException(
                status_code=400,
                detail=f"Transfer exceeds maximum of {MAX_TRANSFER_DOCUMENTS} documents",
            )

        conn = self.resolve_connection(
            destination_owner_type, destination_owner_code, connection_id
        )
        studio_root = conn.default_folder_id or external_folder_id or "root"
        transfer = DocCustodyTransfer(
            scope=scope,
            destination_owner_type=destination_owner_type,
            destination_owner_code=destination_owner_code,
            connection_id=conn.id,
            external_folder_id=studio_root,
            external_folder_path=conn.default_folder_path,
            retention_days=retention_days,
            initiated_by_user_id=initiated_by_user_id,
            initiated_by_name=initiated_by_name,
            status="pending",
        )
        self.db.add(transfer)
        self.db.flush()

        exporter = DocStudioExportService(self.db)
        provider = get_provider(conn.provider)
        folder_cache: dict[str, str] = {}
        total_bytes = 0
        transfer_items: list[DocCustodyTransferItem] = []

        try:
            for doc in docs:
                if export_format == "pdf":
                    data = exporter.export_pdf(scope, doc.id)
                    content_type = "application/pdf"
                    ext = "pdf"
                elif export_format == "docx":
                    data = exporter.export_docx(scope, doc.id)
                    content_type = (
                        "application/vnd.openxmlformats-officedocument"
                        ".wordprocessingml.document"
                    )
                    ext = "docx"
                else:
                    data = exporter.export_markdown(scope, doc.id).encode("utf-8")
                    content_type = "text/markdown"
                    ext = "md"

                total_bytes += len(data)
                if total_bytes > MAX_TRANSFER_BYTES:
                    raise HTTPException(
                        status_code=400,
                        detail="Transfer exceeds maximum allowed upload size",
                    )

                checksum = hashlib.sha256(data).hexdigest()
                filename = f"{_sanitize_filename(doc.title or 'document')}.{ext}"
                target_folder = await self._resolve_remote_folder(
                    conn, doc, studio_root, provider, folder_cache
                )
                result = await provider.upload_item(
                    conn, target_folder, filename, data, content_type
                )
                external_id = result.get("id") or result.get("path_display") or filename
                web_url = (
                    result.get("webViewLink")
                    or result.get("webUrl")
                    or result.get("path_display")
                )

                item = DocCustodyTransferItem(
                    transfer_id=transfer.id,
                    document_id=doc.id,
                    filename=filename,
                    export_format=export_format,
                    sha256_checksum=checksum,
                    size_bytes=len(data),
                    external_item_id=str(external_id),
                    external_web_url=web_url,
                    verified_at=datetime.utcnow(),
                )
                self.db.add(item)
                transfer_items.append(item)
                doc.custody_status = "transferred"
                doc.custody_transfer_id = transfer.id

            ack = self.get_acknowledgment_status(
                destination_owner_type, destination_owner_code
            )
            receipt_pdf = build_transfer_receipt_pdf(transfer, transfer_items, ack)
            receipt_name = f"WW360_Custody_Receipt_{transfer.id[:8]}.pdf"
            await provider.upload_item(
                conn,
                studio_root,
                receipt_name,
                receipt_pdf,
                "application/pdf",
            )

            transfer.status = "verified"
            transfer.verified_at = datetime.utcnow()
            transfer.verified_by_user_id = initiated_by_user_id
            transfer.verified_by_name = initiated_by_name
            transfer.purge_scheduled_at = datetime.utcnow() + timedelta(days=retention_days)
            transfer.status = "purge_scheduled"
            self.db.commit()
            self.db.refresh(transfer)
            return transfer
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Custody transfer failed: %s", exc)
            transfer.status = "failed"
            transfer.failure_reason = str(exc)[:2000]
            self.db.commit()
            raise HTTPException(status_code=502, detail=f"Transfer failed: {exc}") from exc

    def purge_due_transfers(self, *, force_transfer_id: str | None = None) -> int:
        now = datetime.utcnow()
        if force_transfer_id:
            query = self.db.query(DocCustodyTransfer).filter(
                DocCustodyTransfer.id == force_transfer_id,
                DocCustodyTransfer.status.in_(("purge_scheduled", "verified")),
            )
        else:
            query = self.db.query(DocCustodyTransfer).filter(
                DocCustodyTransfer.status == "purge_scheduled",
                DocCustodyTransfer.purge_scheduled_at <= now,
            )
        transfers = query.all()
        purged = 0

        for transfer in transfers:
            doc_ids = [item.document_id for item in transfer.items if item.document_id]
            if not doc_ids:
                doc_ids = [
                    d.id
                    for d in self.db.query(DocDocument)
                    .filter(DocDocument.custody_transfer_id == transfer.id)
                    .all()
                ]
            if doc_ids:
                self.db.query(DocAsset).filter(DocAsset.document_id.in_(doc_ids)).delete(
                    synchronize_session=False
                )
                docs = self.db.query(DocDocument).filter(DocDocument.id.in_(doc_ids)).all()
                for doc in docs:
                    doc.content_markdown = (
                        f"*Document content purged from WW360 on "
                        f"{now.date().isoformat()}. See custody transfer audit.*"
                    )
                    doc.content_json = None
                    doc.tutorial_data = None
                    doc.custody_status = "purged"
                    if doc.title and not doc.title.startswith("[Purged]"):
                        doc.title = f"[Purged] {doc.title}"[:500]

            transfer.status = "purged"
            transfer.purged_at = now
            purged += 1

        if purged:
            self.db.commit()
        return purged

    def get_transfer(self, transfer_id: str, scope: str) -> DocCustodyTransfer:
        transfer = (
            self.db.query(DocCustodyTransfer)
            .filter(DocCustodyTransfer.id == transfer_id, DocCustodyTransfer.scope == scope)
            .first()
        )
        if not transfer:
            raise HTTPException(status_code=404, detail="Transfer not found")
        return transfer

    def list_transfers(self, scope: str) -> list[DocCustodyTransfer]:
        return (
            self.db.query(DocCustodyTransfer)
            .filter(DocCustodyTransfer.scope == scope)
            .order_by(DocCustodyTransfer.created_at.desc())
            .all()
        )

    def _resolve_owner_name(self, owner_type: str, owner_code: str) -> str:
        if owner_type == "program":
            return "One Water Workforce program library"
        from app.models.water_district import WaterDistrict

        district = (
            self.db.query(WaterDistrict)
            .filter(WaterDistrict.district_code == owner_code)
            .first()
        )
        return district.district_name if district else owner_code
