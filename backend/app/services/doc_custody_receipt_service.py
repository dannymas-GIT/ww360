"""PDF custody transfer receipt for utility / program audit records."""

from __future__ import annotations

import io
from datetime import datetime
from typing import List, Optional

from app.models.doc_document import DocCustodyAcknowledgment, DocCustodyTransfer, DocCustodyTransferItem


def build_transfer_receipt_pdf(
    transfer: DocCustodyTransfer,
    items: List[DocCustodyTransferItem],
    acknowledgment: Optional[DocCustodyAcknowledgment],
) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75 * inch)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("WW360 Document Custody Transfer Receipt", styles["Title"]))
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            f"Transfer ID: {transfer.id}<br/>"
            f"Library scope: {transfer.scope}<br/>"
            f"Destination: {transfer.destination_owner_type} / {transfer.destination_owner_code}<br/>"
            f"External folder: {transfer.external_folder_path or transfer.external_folder_id or '—'}<br/>"
            f"Initiated by: {transfer.initiated_by_name or '—'}<br/>"
            f"Verified at: {transfer.verified_at or '—'}<br/>"
            f"Purge scheduled: {transfer.purge_scheduled_at or '—'}<br/>"
            f"Status: {transfer.status}",
            styles["Normal"],
        )
    )
    if acknowledgment:
        story.append(Spacer(1, 8))
        story.append(
            Paragraph(
                f"Policy acknowledgment: {acknowledgment.policy_version} "
                f"by {acknowledgment.acknowledged_by_name} on {acknowledgment.acknowledged_at}",
                styles["Normal"],
            )
        )

    story.append(Spacer(1, 16))
    story.append(Paragraph("Transferred documents", styles["Heading2"]))
    rows = [["Filename", "SHA-256", "Size (bytes)", "External ID"]]
    for item in items:
        rows.append(
            [
                item.filename,
                (item.sha256_checksum or "")[:16] + "…",
                str(item.size_bytes or 0),
                (item.external_item_id or "")[:24],
            ]
        )
    table = Table(rows, colWidths=[2.2 * inch, 2.0 * inch, 1.0 * inch, 1.5 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            f"Generated {datetime.utcnow().isoformat()}Z. "
            "WW360 retains this receipt and audit metadata only after content purge.",
            styles["Normal"],
        )
    )
    doc.build(story)
    return buffer.getvalue()
