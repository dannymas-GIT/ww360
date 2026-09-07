"""Generate EPA Area 3 quarterly package PDF for executive dashboard export."""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

# Sample measures mirror frontend owwMockData until grant adapters are live.
EPA_MEASURES: list[dict[str, Any]] = [
    {
        "id": "enrolled",
        "label": "Individuals enrolled in OWW pathway",
        "task": "Task 1",
        "target": 300,
        "actual": 212,
    },
    {
        "id": "utilities",
        "label": "Utilities reporting in Water Workforce 360",
        "task": "Task 2",
        "target": 40,
        "actual": 27,
    },
    {
        "id": "referrals",
        "label": "Referrals into Learning Stream training",
        "task": "Task 3",
        "target": 150,
        "actual": 98,
    },
    {
        "id": "ce-hours",
        "label": "Contact hours delivered",
        "task": "Task 3",
        "target": 2500,
        "actual": 1930,
        "unit": "hrs",
    },
    {
        "id": "placements",
        "label": "Employment connections at utilities",
        "task": "Task 4",
        "target": 60,
        "actual": 31,
    },
    {
        "id": "collab",
        "label": "Regional collaborations formalized",
        "task": "Task 1",
        "target": 10,
        "actual": 7,
    },
]

EPA_REPORTING: dict[str, Any] = {
    "period": "FY26 Q4 (Jul – Sep 2026)",
    "due_date": "2026-10-30",
    "readiness": 0.82,
    "open_items": [
        "Utility consent confirmations (8 pending)",
        "Q4 Learning Stream attendance reconciliation",
    ],
}


def build_epa_quarterly_package_pdf(
    *,
    partner_name: str = "One Water Workforce",
    state_code: str = "NY",
) -> bytes:
    """Return a branded letter-size PDF for the EPA Area 3 quarterly package."""
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
        title=f"EPA Area 3 quarterly package — {partner_name}",
        author="Water Workforce 360",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "EpaTitle",
        parent=styles["Title"],
        fontSize=16,
        textColor=colors.HexColor("#07111f"),
        spaceAfter=6,
        alignment=TA_LEFT,
    )
    h2 = ParagraphStyle(
        "EpaH2",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=14,
        spaceAfter=8,
    )
    body = ParagraphStyle(
        "EpaBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
    )
    meta = ParagraphStyle(
        "EpaMeta",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748b"),
    )

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    readiness_pct = int(round(float(EPA_REPORTING["readiness"]) * 100))
    story: list[Any] = [
        Paragraph("Water Workforce 360", meta),
        Paragraph(f"EPA Area 3 quarterly package — {partner_name}", title_style),
        Paragraph(
            f"State primacy: <b>{state_code}</b> &nbsp;·&nbsp; "
            f"Reporting period: <b>{EPA_REPORTING['period']}</b> &nbsp;·&nbsp; "
            f"Due: <b>{EPA_REPORTING['due_date']}</b> &nbsp;·&nbsp; "
            f"Readiness: <b>{readiness_pct}%</b>",
            body,
        ),
        Paragraph(f"Generated {stamp}", meta),
        Spacer(1, 8),
        Paragraph("Program measures", h2),
    ]

    rows = [["Task", "Measure", "Actual", "Target", "% of target"]]
    for m in EPA_MEASURES:
        target = float(m["target"] or 0)
        actual = float(m["actual"] or 0)
        pct = f"{int(round(100 * actual / target))}%" if target else "—"
        unit = f" {m['unit']}" if m.get("unit") else ""
        rows.append(
            [
                str(m["task"]),
                Paragraph(str(m["label"]), body),
                f"{actual:,.0f}{unit}",
                f"{target:,.0f}{unit}",
                pct,
            ]
        )

    table = Table(rows, colWidths=[0.7 * inch, 3.4 * inch, 1.0 * inch, 1.0 * inch, 0.9 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#07111f")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
            ]
        )
    )
    story.append(table)

    story.append(Paragraph("Open items before submission", h2))
    for item in EPA_REPORTING["open_items"]:
        story.append(Paragraph(f"• {item}", body))

    story.append(Paragraph("Notes", h2))
    story.append(
        Paragraph(
            "This package is assembled from the executive dashboard program measures "
            "(sample until grant adapters are live). Attach Learning Stream attendance "
            "reconciliation and utility consent confirmations before EPA submission.",
            body,
        )
    )

    doc.build(story)
    return buffer.getvalue()
