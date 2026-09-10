"""Pre-fill DOH-352 renewal application PDF from workforce + CEU data."""

from __future__ import annotations

import io
import logging
import math
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.water_district import WaterDistrict
from app.models.workforce_succession import (
    WorkforceCertification,
    WorkforceCeuRecord,
    WorkforceCeuVoucher,
    WorkforceEmployee,
)
from app.services.document_storage_service import DocumentStorageService
from app.services.workforce_succession.ceu_service import (
    compute_operator_ceu_summary,
    renewal_cycle_bounds,
)

logger = logging.getLogger(__name__)

PAGE_HEIGHT = 792.0
PAGE_WIDTH = 612.0
FONT = "Helvetica"
FONT_SIZE = 9
CEU_FONT_SIZE = 8
COVER_MARGIN = 54.0
VOUCHER_MARGIN = 36.0

_REPO_ROOT = Path(__file__).resolve().parents[4]
DOH352_TEMPLATE_CANDIDATES = (
    Path(__file__).resolve().parents[2] / "static" / "forms" / "DOH-352.pdf",
    _REPO_ROOT / "docs" / "doh-352.pdf",
)

# Geometry measured from docs/doh-352.pdf via pdfplumber (line tops, verticals).
CEU_COLUMN_X = (36.2, 265.0, 332.3, 399.6, 487.8, 576.5)
CEU_COLUMN_PADDING = 3.0
# Pre-printed row numbers (1–10 page 1, 11–30 page 2) sit at x≈40.3 in the first column.
# Course titles must start to the right of the widest label ("10") plus a small gap.
CEU_COURSE_TITLE_X = 58.0
VOUCHER_HEADER_HEIGHT = 48.0
PAGE1_CEU_ROW_STEP = 26.0
PAGE2_CEU_ROW_STEP = 28.8
PAGE1_CEU_ROW_COUNT = 10
PAGE2_CEU_ROW_COUNT = 20

VETERAN_YES_BOX = (429.2, 350.6, 437.8, 359.1)
VETERAN_NO_BOX = (462.2, 350.6, 470.8, 359.1)
CONTRACT_YES_BOX = (429.2, 366.2, 437.8, 374.8)
CONTRACT_NO_BOX = (462.2, 366.2, 470.8, 374.8)


@dataclass
class VoucherAttachment:
    voucher_id: int
    ceu_record_id: int
    course_title: str
    completion_date: Optional[date]
    filename: str
    content_type: Optional[str]
    file_extension: str
    storage_kind: str
    blob_name: Optional[str]
    file_path: Optional[str]
    available: bool = True


def _baseline_for_underline(top: float, pad: float = 2.0) -> float:
    """ReportLab y for text sitting just above a ruled underline."""
    return PAGE_HEIGHT - top + pad


def _baseline_for_cell_bottom(row_top: float, row_height: float, pad: float = 6.0) -> float:
    """ReportLab y for text anchored to a table cell's lower ruled line."""
    return PAGE_HEIGHT - (row_top + row_height) + pad


def _field_xy(x: float, underline_top: float) -> Tuple[float, float]:
    return (x, _baseline_for_underline(underline_top))


# Section I — applicant / employer (page 1)
SECTION_I_FIELDS: Dict[str, Tuple[float, float]] = {
    # Left block — name and home address in open area above corrections line.
    "applicant_name": _field_xy(42.0, 248.0),
    "home_address_line1": _field_xy(42.0, 290.0),
    "home_address_line2": _field_xy(42.0, 305.0),
    "home_address_line3": _field_xy(42.0, 338.0),
    # Right column — anchored to measured underline x0 + padding.
    "home_phone": _field_xy(443.4, 239.6),
    "home_email": _field_xy(415.0, 254.6),
    "employer_name": _field_xy(415.0, 269.5),
    "employer_address_line1": _field_xy(415.0, 284.5),
    "employer_address_line2": _field_xy(415.0, 299.4),
    "work_phone": _field_xy(443.4, 314.4),
    "work_email": _field_xy(415.0, 329.3),
    "county_of_employment": _field_xy(415.0, 344.3),
}

SECTION_I_MAX_CHARS: Dict[str, int] = {
    "applicant_name": 42,
    "home_address_line1": 42,
    "home_address_line2": 42,
    "home_address_line3": 42,
    "home_phone": 18,
    "home_email": 28,
    "employer_name": 28,
    "employer_address_line1": 28,
    "employer_address_line2": 28,
    "work_phone": 18,
    "work_email": 28,
    "county_of_employment": 28,
}

# Certificate summary (top-right box — values sit on ruled lines inside the box).
CERT_HEADER_X = 476.0
CERT_HEADER_FIELDS: Dict[str, Tuple[float, float]] = {
    "certification_grade": _field_xy(CERT_HEADER_X, 48.0),
    "effective_date": _field_xy(CERT_HEADER_X, 59.7),
    "expiration_date": _field_xy(CERT_HEADER_X, 71.4),
}

# Section II — CEU table columns (x start from verticals + padding).
CEU_COLUMNS = {
    "course_title": CEU_COURSE_TITLE_X,
    "dates": CEU_COLUMN_X[1] + CEU_COLUMN_PADDING,
    "contact_hours": CEU_COLUMN_X[2] + CEU_COLUMN_PADDING,
    "approval_number": CEU_COLUMN_X[3] + CEU_COLUMN_PADDING,
    "provider": CEU_COLUMN_X[4] + CEU_COLUMN_PADDING,
}
CEU_COLUMN_WIDTHS = {
    "course_title": CEU_COLUMN_X[1] - CEU_COURSE_TITLE_X - CEU_COLUMN_PADDING,
    "dates": CEU_COLUMN_X[2] - CEU_COLUMN_X[1] - (2 * CEU_COLUMN_PADDING),
    "contact_hours": CEU_COLUMN_X[3] - CEU_COLUMN_X[2] - (2 * CEU_COLUMN_PADDING),
    "approval_number": CEU_COLUMN_X[4] - CEU_COLUMN_X[3] - (2 * CEU_COLUMN_PADDING),
    "provider": CEU_COLUMN_X[5] - CEU_COLUMN_X[4] - (2 * CEU_COLUMN_PADDING),
}
PAGE1_CEU_LINE_TOPS = [459.5 + (i * PAGE1_CEU_ROW_STEP) for i in range(PAGE1_CEU_ROW_COUNT)]
# Measured horizontal ruled lines on page 2 (docs/doh-352.pdf).
PAGE2_CEU_LINE_TOPS = [
    36.2,
    65.7,
    94.5,
    123.3,
    152.1,
    180.9,
    209.6,
    238.4,
    267.2,
    296.0,
    324.7,
    353.5,
    382.3,
    411.1,
    439.8,
    468.6,
    497.4,
    526.2,
    554.9,
    583.7,
]


def _ceu_row_height(line_top: float, row_index: int, line_tops: List[float], default_step: float) -> float:
    if row_index + 1 < len(line_tops):
        return line_tops[row_index + 1] - line_tops[row_index]
    return default_step


def _ceu_table_row_capacity(entry_count: int) -> int:
    """Round entry count up to the nearest multiple of 5 (min 5, max 30)."""
    if entry_count <= 0:
        return 5
    return min(30, max(5, math.ceil(entry_count / 5) * 5))


def _mask_unused_ceu_rows(
    canvas: Any,
    line_tops: List[float],
    first_masked_index: int,
    default_step: float,
) -> None:
    """Cover pre-printed row numbers and ruled lines below the dynamic capacity."""
    if first_masked_index <= 0 or first_masked_index >= len(line_tops):
        return
    x0 = CEU_COLUMN_X[0] - 1.0
    x1 = CEU_COLUMN_X[5] + 1.0
    last_used_index = first_masked_index - 1
    last_top = line_tops[last_used_index]
    last_height = _ceu_row_height(last_top, last_used_index, line_tops, default_step)
    # Start below the bottom ruled line of the last visible row (preserve its border).
    top = last_top + last_height + 1.0
    last_idx = len(line_tops) - 1
    last_row_top = line_tops[last_idx]
    last_row_height = _ceu_row_height(last_row_top, last_idx, line_tops, default_step)
    bottom = last_row_top + last_row_height
    rl_y = PAGE_HEIGHT - bottom
    rl_h = bottom - top
    if rl_h <= 0:
        return
    canvas.setFillColorRGB(1, 1, 1)
    canvas.rect(x0, rl_y, x1 - x0, rl_h, fill=1, stroke=0)


def _draw_ceu_row_bottom_line(
    canvas: Any, line_top: float, row_height: float
) -> None:
    """Redraw the bottom ruled line for the last visible CEU row after masking."""
    y = PAGE_HEIGHT - (line_top + row_height)
    canvas.setStrokeColorRGB(0, 0, 0)
    canvas.setLineWidth(0.5)
    canvas.line(CEU_COLUMN_X[0], y, CEU_COLUMN_X[5], y)


def _resolve_template_path() -> Optional[Path]:
    for path in DOH352_TEMPLATE_CANDIDATES:
        if path.exists():
            return path
    return None


def _format_date(value: Optional[date]) -> str:
    if value is None:
        return ""
    return value.strftime("%m/%d/%Y")


def _truncate(text: str, max_len: int) -> str:
    text = (text or "").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def _truncate_to_width(text: str, max_width: float, font_name: str, font_size: float) -> str:
    """Truncate text to fit a column width in points."""
    from reportlab.pdfbase.pdfmetrics import stringWidth

    text = (text or "").strip()
    if not text:
        return ""
    if stringWidth(text, font_name, font_size) <= max_width:
        return text
    ellipsis = "…"
    while text and stringWidth(text + ellipsis, font_name, font_size) > max_width:
        text = text[:-1]
    return text + ellipsis if text else ellipsis


def _format_home_address_line3(
    city: Optional[str], state: Optional[str], zip_code: Optional[str]
) -> str:
    city = (city or "").strip()
    state = (state or "").strip()
    zip_code = (zip_code or "").strip()
    parts: List[str] = []
    if city:
        parts.append(city)
    if state and zip_code:
        parts.append(f"{state} {zip_code}")
    elif state:
        parts.append(state)
    elif zip_code:
        parts.append(zip_code)
    return ", ".join(parts)


def _gather_operator_data(
    db: Session, district_code: str, employee_code: str
) -> Tuple[
    Optional[WorkforceEmployee],
    Optional[WaterDistrict],
    Optional[WorkforceCertification],
    List[WorkforceCeuRecord],
]:
    employee = (
        db.query(WorkforceEmployee)
        .filter(
            WorkforceEmployee.district_code == district_code,
            WorkforceEmployee.employee_code == employee_code,
            WorkforceEmployee.record_status == "active",
        )
        .first()
    )
    if employee is None:
        return None, None, None, []

    district = (
        db.query(WaterDistrict)
        .filter(WaterDistrict.district_code == district_code)
        .first()
    )

    certs = (
        db.query(WorkforceCertification)
        .filter(
            WorkforceCertification.district_code == district_code,
            WorkforceCertification.employee_code == employee_code,
            WorkforceCertification.record_status == "active",
        )
        .order_by(WorkforceCertification.expiration_date.asc().nullslast())
        .all()
    )
    cert = certs[0] if certs else None
    cycle_start, cycle_end = renewal_cycle_bounds(
        cert.expiration_date if cert else None
    )
    ceu_rows = (
        db.query(WorkforceCeuRecord)
        .filter(
            WorkforceCeuRecord.district_code == district_code,
            WorkforceCeuRecord.employee_code == employee_code,
            WorkforceCeuRecord.record_status == "active",
            WorkforceCeuRecord.completion_date >= cycle_start,
            WorkforceCeuRecord.completion_date <= cycle_end,
        )
        .order_by(WorkforceCeuRecord.completion_date.asc())
        .all()
    )
    return employee, district, cert, ceu_rows


def _collect_cycle_vouchers(
    db: Session, ceu_rows: List[WorkforceCeuRecord]
) -> List[VoucherAttachment]:
    if not ceu_rows:
        return []
    record_ids = [row.id for row in ceu_rows]
    ceu_by_id = {row.id: row for row in ceu_rows}
    vouchers = (
        db.query(WorkforceCeuVoucher)
        .filter(WorkforceCeuVoucher.ceu_record_id.in_(record_ids))
        .order_by(WorkforceCeuVoucher.ceu_record_id.asc(), WorkforceCeuVoucher.id.asc())
        .all()
    )
    attachments: List[VoucherAttachment] = []
    for voucher in vouchers:
        ceu = ceu_by_id.get(voucher.ceu_record_id)
        attachments.append(
            VoucherAttachment(
                voucher_id=voucher.id,
                ceu_record_id=voucher.ceu_record_id,
                course_title=ceu.course_title if ceu else "",
                completion_date=ceu.completion_date if ceu else None,
                filename=voucher.filename,
                content_type=voucher.content_type,
                file_extension=voucher.file_extension,
                storage_kind=voucher.storage_kind,
                blob_name=voucher.blob_name,
                file_path=voucher.file_path,
            )
        )
    return attachments


def build_voucher_manifest(
    attachments: List[VoucherAttachment],
    storage: Optional[DocumentStorageService] = None,
) -> Tuple[List[Dict[str, Any]], List[VoucherAttachment]]:
    storage = storage or DocumentStorageService()
    manifest: List[Dict[str, Any]] = []
    resolved: List[VoucherAttachment] = []
    for item in attachments:
        available = True
        try:
            content = storage.read_bytes(item.storage_kind, item.blob_name, item.file_path)
            if not content:
                available = False
        except Exception:
            available = False
        resolved_item = VoucherAttachment(
            voucher_id=item.voucher_id,
            ceu_record_id=item.ceu_record_id,
            course_title=item.course_title,
            completion_date=item.completion_date,
            filename=item.filename,
            content_type=item.content_type,
            file_extension=item.file_extension,
            storage_kind=item.storage_kind,
            blob_name=item.blob_name,
            file_path=item.file_path,
            available=available,
        )
        resolved.append(resolved_item)
        manifest.append(
            {
                "voucher_id": item.voucher_id,
                "ceu_record_id": item.ceu_record_id,
                "course_title": item.course_title,
                "completion_date": _format_date(item.completion_date),
                "filename": item.filename,
                "available": available,
                "status": "attached" if available else "unavailable",
            }
        )
    return manifest, resolved


def build_doh352_field_map(
    db: Session, district_code: str, employee_code: str
) -> Dict[str, Any]:
    """Map workforce data to DOH-352 logical fields aligned with the official form."""
    employee, district, cert, ceu_rows = _gather_operator_data(
        db, district_code, employee_code
    )
    if employee is None:
        return {"error": "employee_not_found"}

    summary = compute_operator_ceu_summary(
        db, district_code=district_code, employee=employee, certification=cert
    )
    missing: List[str] = []
    if not employee.full_name:
        missing.append("applicant_name")
    if not cert:
        missing.append("certification")
    if not cert or not cert.expiration_date:
        missing.append("expiration_date")

    ceu_entries: List[Dict[str, str]] = []
    if len(ceu_rows) > 30:
        missing.append("ceu_entries_truncated")
    for row in ceu_rows[:30]:
        hours = row.contact_hours if row.contact_hours is not None else row.ceu_hours
        ceu_entries.append(
            {
                "course_title": row.course_title or "",
                "dates": _format_date(row.completion_date),
                "contact_hours": f"{hours:g}" if hours is not None else "",
                "approval_number": row.approval_number or "",
                "provider": row.provider or "",
            }
        )
    ceu_table_capacity = _ceu_table_row_capacity(len(ceu_rows))

    fields: Dict[str, Any] = {
        "district_code": district_code,
        "applicant_name": employee.full_name or "",
        "employee_code": employee.employee_code,
        "home_phone": employee.home_phone or "",
        "home_email": employee.home_email or "",
        "home_address_line1": employee.home_address_line1 or "",
        "home_address_line2": employee.home_address_line2 or "",
        "home_address_line3": _format_home_address_line3(
            employee.home_city, employee.home_state, employee.home_zip
        ),
        "employer_name": (district.district_name if district else district_code) or "",
        "employer_address_line1": (
            getattr(district, "mailing_address_line1", None) if district else None
        )
        or "",
        "employer_address_line2": (
            getattr(district, "mailing_address_line2", None) if district else None
        )
        or "",
        "work_phone": employee.work_phone or "",
        "work_email": employee.work_email or "",
        "county_of_employment": employee.county_of_employment or "",
        "is_veteran": employee.is_veteran,
        "is_contract_operator": employee.is_contract_operator,
        "certificate_number": cert.credential_id if cert and cert.credential_id else "",
        "certification_type": cert.certification_type if cert else "",
        "certification_grade": cert.certification_grade if cert else "",
        "issuing_authority": cert.issuing_authority if cert else "NYSDOH",
        "effective_date": _format_date(cert.issued_date if cert else None),
        "expiration_date": _format_date(cert.expiration_date if cert else None),
        "renewal_cycle_start": _format_date(summary.renewal_cycle_start),
        "renewal_cycle_end": _format_date(summary.renewal_cycle_end),
        "total_contact_hours": str(summary.earned_contact_hours),
        "required_contact_hours": str(summary.required_contact_hours),
        "remaining_contact_hours": str(
            max(0.0, summary.required_contact_hours - summary.earned_contact_hours)
        ),
        "generated_on": _format_date(date.today()),
        "missing_fields": missing,
        "ceu_record_count": len(ceu_rows),
        "ceu_table_capacity": ceu_table_capacity,
        "ceu_entries": ceu_entries,
    }
    return fields


def _draw_checkbox_x(canvas: Any, box: Tuple[float, float, float, float]) -> None:
    x0, top, x1, bottom = box
    y0 = PAGE_HEIGHT - bottom
    y1 = PAGE_HEIGHT - top
    canvas.setLineWidth(0.75)
    canvas.line(x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5)
    canvas.line(x0 + 1.5, y1 - 1.5, x1 - 1.5, y0 + 1.5)


def _draw_yes_no_checkboxes(
    canvas: Any,
    value: Optional[bool],
    yes_box: Tuple[float, float, float, float],
    no_box: Tuple[float, float, float, float],
) -> None:
    if value is None:
        return
    _draw_checkbox_x(canvas, yes_box if value else no_box)


def _overlay_page(
    canvas: Any,
    field_map: Dict[str, Any],
    *,
    page_index: int,
) -> None:
    canvas.setFont(FONT, FONT_SIZE)
    capacity = int(field_map.get("ceu_table_capacity") or 30)
    entries = field_map.get("ceu_entries") or []

    if page_index == 0:
        for key, (x, y) in SECTION_I_FIELDS.items():
            value = str(field_map.get(key) or "")
            if value:
                max_len = SECTION_I_MAX_CHARS.get(key, 36)
                canvas.drawString(x, y, _truncate(value, max_len))

        for key, (x, y) in CERT_HEADER_FIELDS.items():
            value = str(field_map.get(key) or "")
            if value:
                canvas.setFillColorRGB(0, 0, 0)
                canvas.drawString(x, y, _truncate(value, 12))

        _draw_yes_no_checkboxes(
            canvas,
            field_map.get("is_veteran"),
            VETERAN_YES_BOX,
            VETERAN_NO_BOX,
        )
        _draw_yes_no_checkboxes(
            canvas,
            field_map.get("is_contract_operator"),
            CONTRACT_YES_BOX,
            CONTRACT_NO_BOX,
        )

        page1_rows = min(capacity, PAGE1_CEU_ROW_COUNT)
        for idx, line_top in enumerate(PAGE1_CEU_LINE_TOPS):
            if idx >= page1_rows or idx >= len(entries):
                break
            row_height = _ceu_row_height(
                line_top, idx, PAGE1_CEU_LINE_TOPS, PAGE1_CEU_ROW_STEP
            )
            _draw_ceu_row(canvas, entries[idx], line_top, row_height)

        if page1_rows < PAGE1_CEU_ROW_COUNT:
            _mask_unused_ceu_rows(
                canvas,
                PAGE1_CEU_LINE_TOPS,
                page1_rows,
                PAGE1_CEU_ROW_STEP,
            )
            last_idx = page1_rows - 1
            last_top = PAGE1_CEU_LINE_TOPS[last_idx]
            last_height = _ceu_row_height(
                last_top, last_idx, PAGE1_CEU_LINE_TOPS, PAGE1_CEU_ROW_STEP
            )
            _draw_ceu_row_bottom_line(canvas, last_top, last_height)

    if page_index == 1:
        page2_rows = max(0, min(capacity - PAGE1_CEU_ROW_COUNT, PAGE2_CEU_ROW_COUNT))
        for idx, line_top in enumerate(PAGE2_CEU_LINE_TOPS):
            if idx >= page2_rows:
                break
            entry_idx = idx + PAGE1_CEU_ROW_COUNT
            if entry_idx >= len(entries):
                break
            row_height = _ceu_row_height(
                line_top, idx, PAGE2_CEU_LINE_TOPS, PAGE2_CEU_ROW_STEP
            )
            _draw_ceu_row(canvas, entries[entry_idx], line_top, row_height)

        if page2_rows < PAGE2_CEU_ROW_COUNT and page2_rows > 0:
            _mask_unused_ceu_rows(
                canvas,
                PAGE2_CEU_LINE_TOPS,
                page2_rows,
                PAGE2_CEU_ROW_STEP,
            )
            last_idx = page2_rows - 1
            last_top = PAGE2_CEU_LINE_TOPS[last_idx]
            last_height = _ceu_row_height(
                last_top, last_idx, PAGE2_CEU_LINE_TOPS, PAGE2_CEU_ROW_STEP
            )
            _draw_ceu_row_bottom_line(canvas, last_top, last_height)


def _draw_ceu_row(
    canvas: Any, entry: Dict[str, str], line_top: float, row_height: float
) -> None:
    y = _baseline_for_cell_bottom(line_top, row_height)
    canvas.setFillColorRGB(0, 0, 0)
    canvas.setFont(FONT, CEU_FONT_SIZE)
    canvas.drawString(
        CEU_COLUMNS["course_title"],
        y,
        _truncate_to_width(
            entry.get("course_title", ""),
            CEU_COLUMN_WIDTHS["course_title"],
            FONT,
            CEU_FONT_SIZE,
        ),
    )
    canvas.drawString(
        CEU_COLUMNS["dates"],
        y,
        _truncate_to_width(
            entry.get("dates", ""),
            CEU_COLUMN_WIDTHS["dates"],
            FONT,
            CEU_FONT_SIZE,
        ),
    )
    canvas.drawString(
        CEU_COLUMNS["contact_hours"],
        y,
        _truncate_to_width(
            entry.get("contact_hours", ""),
            CEU_COLUMN_WIDTHS["contact_hours"],
            FONT,
            CEU_FONT_SIZE,
        ),
    )
    canvas.drawString(
        CEU_COLUMNS["approval_number"],
        y,
        _truncate_to_width(
            entry.get("approval_number", ""),
            CEU_COLUMN_WIDTHS["approval_number"],
            FONT,
            CEU_FONT_SIZE,
        ),
    )
    canvas.drawString(
        CEU_COLUMNS["provider"],
        y,
        _truncate_to_width(
            entry.get("provider", ""),
            CEU_COLUMN_WIDTHS["provider"],
            FONT,
            CEU_FONT_SIZE,
        ),
    )
    canvas.setFont(FONT, FONT_SIZE)


def _overlay_on_template(template_bytes: bytes, field_map: Dict[str, Any]) -> bytes:
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas

    capacity = int(field_map.get("ceu_table_capacity") or 30)
    template_reader = PdfReader(io.BytesIO(template_bytes))
    writer = PdfWriter()

    for page_index, template_page in enumerate(template_reader.pages):
        if page_index == 1 and capacity <= PAGE1_CEU_ROW_COUNT:
            continue
        packet = io.BytesIO()
        page_canvas = canvas.Canvas(packet, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
        _overlay_page(page_canvas, field_map, page_index=page_index)
        page_canvas.save()
        packet.seek(0)
        overlay_reader = PdfReader(packet)
        if overlay_reader.pages:
            template_page.merge_page(overlay_reader.pages[0])
        writer.add_page(template_page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _build_cover_sheet(field_map: Dict[str, Any], voucher_manifest: List[Dict[str, Any]]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=(PAGE_WIDTH, PAGE_HEIGHT),
        leftMargin=COVER_MARGIN,
        rightMargin=COVER_MARGIN,
        topMargin=COVER_MARGIN,
        bottomMargin=COVER_MARGIN,
    )
    styles = getSampleStyleSheet()
    story: List[Any] = []

    story.append(Paragraph("DOH-352 Renewal Package — AquaSafe Summary", styles["Title"]))
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            f"<b>Applicant:</b> {field_map.get('applicant_name', '')} "
            f"({field_map.get('employee_code', '')})",
            styles["Normal"],
        )
    )
    story.append(
        Paragraph(
            f"<b>Employer:</b> {field_map.get('employer_name', '')} "
            f"({field_map.get('district_code', '')})",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 10))

    summary_rows = [
        ["Certificate / license #", field_map.get("certificate_number", "")],
        ["Certification type", field_map.get("certification_type", "")],
        ["Issuing authority", field_map.get("issuing_authority", "")],
        ["Grade", field_map.get("certification_grade", "")],
        ["Effective date", field_map.get("effective_date", "")],
        ["Expiration date", field_map.get("expiration_date", "")],
        [
            "Renewal cycle",
            f"{field_map.get('renewal_cycle_start', '')} – {field_map.get('renewal_cycle_end', '')}",
        ],
        [
            "CEU hours earned / required / remaining",
            f"{field_map.get('total_contact_hours', '')} / "
            f"{field_map.get('required_contact_hours', '')} / "
            f"{field_map.get('remaining_contact_hours', '')}",
        ],
        ["CEU records in cycle", str(field_map.get("ceu_record_count", 0))],
        ["Generated on", field_map.get("generated_on", "")],
    ]
    summary_table = Table(summary_rows, colWidths=[180, 300])
    summary_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 12))

    missing = field_map.get("missing_fields") or []
    if missing:
        story.append(
            Paragraph(
                f"<b>Missing data warnings:</b> {', '.join(missing)}",
                styles["Normal"],
            )
        )
        story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Attached CEU vouchers</b>", styles["Heading3"]))
    if voucher_manifest:
        voucher_rows = [["Course", "Completion date", "Filename", "Status"]]
        for item in voucher_manifest:
            voucher_rows.append(
                [
                    item.get("course_title", ""),
                    item.get("completion_date", ""),
                    item.get("filename", ""),
                    item.get("status", ""),
                ]
            )
        voucher_table = Table(voucher_rows, colWidths=[170, 80, 150, 80], repeatRows=1)
        voucher_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTNAME", (0, 1), (-1, -1), FONT),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(voucher_table)
    else:
        story.append(Paragraph("No vouchers attached for this renewal cycle.", styles["Normal"]))

    story.append(Spacer(1, 16))
    story.append(
        Paragraph(
            "The following pages contain the official DOH-352 form and attached voucher documents.",
            styles["Italic"],
        )
    )

    doc.build(story)
    return buffer.getvalue()


def _draw_voucher_header(canvas: Any, title: str) -> None:
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(VOUCHER_MARGIN, PAGE_HEIGHT - VOUCHER_MARGIN - 10, "CEU Voucher Attachment")
    canvas.setFont(FONT, 9)
    wrapped = _truncate_to_width(title, PAGE_WIDTH - (2 * VOUCHER_MARGIN), FONT, 9)
    canvas.drawString(VOUCHER_MARGIN, PAGE_HEIGHT - VOUCHER_MARGIN - 24, wrapped)


def _image_bytes_to_pdf_page(image_bytes: bytes, title: str = "") -> bytes:
    from PIL import Image as PILImage
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    with PILImage.open(io.BytesIO(image_bytes)) as img:
        img = img.convert("RGB")
        img_width, img_height = img.size

    header_space = VOUCHER_HEADER_HEIGHT if title else 0.0
    max_w = PAGE_WIDTH - (2 * VOUCHER_MARGIN)
    content_top = PAGE_HEIGHT - VOUCHER_MARGIN - header_space
    content_bottom = VOUCHER_MARGIN
    max_h = content_top - content_bottom
    scale = min(max_w / img_width, max_h / img_height, 1.0)
    draw_w = img_width * scale
    draw_h = img_height * scale
    x = VOUCHER_MARGIN + (max_w - draw_w) / 2
    y = content_bottom + (max_h - draw_h) / 2

    packet = io.BytesIO()
    page = canvas.Canvas(packet, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    if title:
        _draw_voucher_header(page, title)
    page.drawImage(
        ImageReader(io.BytesIO(image_bytes)),
        x,
        y,
        width=draw_w,
        height=draw_h,
        preserveAspectRatio=True,
        anchor="sw",
    )
    page.save()
    packet.seek(0)
    return packet.getvalue()


def _pdf_bytes_with_header(content_bytes: bytes, title: str) -> bytes:
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas

    reader = PdfReader(io.BytesIO(content_bytes))
    writer = PdfWriter()
    for page_index, page in enumerate(reader.pages):
        if page_index == 0 and title:
            packet = io.BytesIO()
            overlay_canvas = canvas.Canvas(packet, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
            _draw_voucher_header(overlay_canvas, title)
            overlay_canvas.save()
            packet.seek(0)
            overlay_page = PdfReader(packet).pages[0]
            page.merge_page(overlay_page)
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _append_voucher_pages(
    writer: Any,
    attachments: List[VoucherAttachment],
    storage: DocumentStorageService,
) -> None:
    from pypdf import PdfReader

    for item in attachments:
        if not item.available:
            continue

        attachment_title = (
            f"Attachment — {item.course_title} ({_format_date(item.completion_date)}) — {item.filename}"
        )

        try:
            content = storage.read_bytes(item.storage_kind, item.blob_name, item.file_path)
        except Exception as exc:
            logger.warning("Could not read voucher id=%s: %s", item.voucher_id, exc)
            continue
        if not content:
            continue

        ext = (item.file_extension or "").lower()
        content_type = (item.content_type or "").lower()
        is_pdf = ext == "pdf" or "pdf" in content_type
        is_image = ext in {"png", "jpg", "jpeg"} or content_type.startswith("image/")

        try:
            if is_pdf:
                voucher_bytes = _pdf_bytes_with_header(content, attachment_title)
                voucher_reader = PdfReader(io.BytesIO(voucher_bytes))
                for page in voucher_reader.pages:
                    writer.add_page(page)
            elif is_image:
                image_pdf = PdfReader(
                    io.BytesIO(_image_bytes_to_pdf_page(content, attachment_title))
                )
                writer.add_page(image_pdf.pages[0])
            else:
                logger.warning(
                    "Unsupported voucher type for id=%s ext=%s content_type=%s",
                    item.voucher_id,
                    ext,
                    content_type,
                )
        except Exception as exc:
            logger.warning("Could not append voucher id=%s: %s", item.voucher_id, exc)


def generate_doh352_pdf(
    db: Session, district_code: str, employee_code: str
) -> Tuple[bytes, Dict[str, Any]]:
    """Return (pdf_bytes, preview_metadata). Uses official DOH-352 layout when template exists."""
    field_map = build_doh352_field_map(db, district_code, employee_code)
    if field_map.get("error"):
        raise ValueError(field_map["error"])

    template_path = _resolve_template_path()
    if template_path is None:
        raise FileNotFoundError(
            "DOH-352 template not found. Expected backend/app/static/forms/DOH-352.pdf "
            "or docs/doh-352.pdf"
        )

    _, _, _, ceu_rows = _gather_operator_data(db, district_code, employee_code)
    attachments = _collect_cycle_vouchers(db, ceu_rows)
    storage = DocumentStorageService()
    voucher_manifest, resolved_attachments = build_voucher_manifest(attachments, storage)

    filled_form = _overlay_on_template(template_path.read_bytes(), field_map)
    cover_sheet = _build_cover_sheet(field_map, voucher_manifest)

    from pypdf import PdfReader, PdfWriter

    writer = PdfWriter()
    for page in PdfReader(io.BytesIO(cover_sheet)).pages:
        writer.add_page(page)
    for page in PdfReader(io.BytesIO(filled_form)).pages:
        writer.add_page(page)
    _append_voucher_pages(writer, resolved_attachments, storage)

    out = io.BytesIO()
    writer.write(out)
    pdf_bytes = out.getvalue()

    field_map["fill_method"] = "official_template_overlay_with_cover_and_vouchers"
    field_map["template_path"] = str(template_path)
    field_map["voucher_count"] = len(voucher_manifest)
    field_map["voucher_manifest"] = voucher_manifest
    field_map["page_count"] = len(PdfReader(io.BytesIO(pdf_bytes)).pages)
    return pdf_bytes, field_map
