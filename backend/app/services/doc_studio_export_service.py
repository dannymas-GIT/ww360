"""Document Studio export (PDF / DOCX / HTML / Markdown) and import (DOCX / PDF / MD / TXT).

The markdown dialect is what ``tiptap-markdown`` emits: ATX headings, ``-``/``1.``
lists, ``- [ ]`` tasks, ``>`` quotes, fenced code, pipe tables, ``![alt](src)``
images, ``**bold**`` / ``*em*`` / `` `code` `` inline marks and ``---`` rules.
"""

from __future__ import annotations

import html
import io
import logging
import re
from dataclasses import dataclass, field

from app.models.doc_document import DocAsset, DocDocument
from app.services.doc_studio_service import ASSET_URL_PREFIX, DocStudioService
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

BRAND_NAVY = "#07111f"
BRAND_SKY = "#38bdf8"
BRAND_SLATE = "#475569"


# ── Markdown block parser (small, dependency-free) ──────────────────────────


@dataclass
class Block:
    kind: (
        str  # heading | paragraph | bullets | numbers | tasks | quote | code | table | image | rule
    )
    text: str = ""
    level: int = 0
    items: list[str] = field(default_factory=list)
    checked: list[bool] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    src: str = ""
    alt: str = ""


_IMG_RE = re.compile(r"^!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)\s*$")
_TASK_RE = re.compile(r"^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$")
_BULLET_RE = re.compile(r"^\s*[-*+]\s+(.*)$")
_NUM_RE = re.compile(r"^\s*\d+[.)]\s+(.*)$")
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
_TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")


def parse_markdown(markdown: str) -> list[Block]:
    lines = (markdown or "").replace("\r\n", "\n").split("\n")
    blocks: list[Block] = []
    i = 0
    n = len(lines)
    para: list[str] = []

    def flush_para() -> None:
        nonlocal para
        if para:
            blocks.append(Block(kind="paragraph", text=" ".join(s.strip() for s in para)))
            para = []

    while i < n:
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            flush_para()
            i += 1
            continue

        if stripped.startswith("```"):
            flush_para()
            i += 1
            code: list[str] = []
            while i < n and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            i += 1
            blocks.append(Block(kind="code", text="\n".join(code)))
            continue

        m = _HEADING_RE.match(stripped)
        if m:
            flush_para()
            blocks.append(Block(kind="heading", level=len(m.group(1)), text=m.group(2)))
            i += 1
            continue

        if re.match(r"^(-{3,}|\*{3,}|_{3,})$", stripped):
            flush_para()
            blocks.append(Block(kind="rule"))
            i += 1
            continue

        m = _IMG_RE.match(stripped)
        if m:
            flush_para()
            blocks.append(Block(kind="image", alt=m.group(1), src=m.group(2)))
            i += 1
            continue

        if stripped.startswith("|") and i + 1 < n and _TABLE_SEP_RE.match(lines[i + 1]):
            flush_para()
            rows: list[list[str]] = []
            rows.append([c.strip() for c in stripped.strip("|").split("|")])
            i += 2
            while i < n and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            blocks.append(Block(kind="table", rows=rows))
            continue

        if stripped.startswith(">"):
            flush_para()
            quote: list[str] = []
            while i < n and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip().lstrip(">").strip())
                i += 1
            blocks.append(Block(kind="quote", text=" ".join(q for q in quote if q)))
            continue

        if _TASK_RE.match(line):
            flush_para()
            items: list[str] = []
            checked: list[bool] = []
            while i < n and _TASK_RE.match(lines[i]):
                tm = _TASK_RE.match(lines[i])
                assert tm
                checked.append(tm.group(1).lower() == "x")
                items.append(tm.group(2))
                i += 1
            blocks.append(Block(kind="tasks", items=items, checked=checked))
            continue

        if _BULLET_RE.match(line):
            flush_para()
            items = []
            while i < n and _BULLET_RE.match(lines[i]) and not _TASK_RE.match(lines[i]):
                bm = _BULLET_RE.match(lines[i])
                assert bm
                items.append(bm.group(1))
                i += 1
            blocks.append(Block(kind="bullets", items=items))
            continue

        if _NUM_RE.match(line):
            flush_para()
            items = []
            while i < n and _NUM_RE.match(lines[i]):
                nm = _NUM_RE.match(lines[i])
                assert nm
                items.append(nm.group(1))
                i += 1
            blocks.append(Block(kind="numbers", items=items))
            continue

        para.append(line)
        i += 1

    flush_para()
    return blocks


# ── Inline formatting ───────────────────────────────────────────────────────

_INLINE_LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
_INLINE_BOLD = re.compile(r"\*\*(.+?)\*\*|__(.+?)__")
_INLINE_EM = re.compile(r"(?<![*\w])\*(?!\*)(.+?)(?<!\*)\*(?![*\w])|(?<!\w)_(.+?)_(?!\w)")
_INLINE_CODE = re.compile(r"`([^`]+)`")
_INLINE_STRIKE = re.compile(r"~~(.+?)~~")


def inline_to_html(text: str) -> str:
    """Markdown inline marks → minimal HTML (safe for ReportLab Paragraph and HTML export)."""
    out = html.escape(text or "", quote=False)
    out = _INLINE_CODE.sub(lambda m: f"<font face='Courier'>{m.group(1)}</font>", out)
    out = _INLINE_BOLD.sub(lambda m: f"<b>{m.group(1) or m.group(2)}</b>", out)
    out = _INLINE_EM.sub(lambda m: f"<i>{m.group(1) or m.group(2)}</i>", out)
    out = _INLINE_STRIKE.sub(lambda m: f"<strike>{m.group(1)}</strike>", out)
    out = _INLINE_LINK.sub(
        lambda m: f"<a href='{m.group(2)}' color='#0369a1'>{m.group(1)}</a>", out
    )
    return out


def inline_to_plain(text: str) -> str:
    out = _INLINE_LINK.sub(lambda m: m.group(1), text or "")
    for rx in (_INLINE_BOLD, _INLINE_EM, _INLINE_CODE, _INLINE_STRIKE):
        out = rx.sub(lambda m: next(g for g in m.groups() if g is not None), out)
    return out


# ── Export service ──────────────────────────────────────────────────────────


class DocStudioExportService:
    def __init__(self, db: Session):
        self.db = db
        self.studio = DocStudioService(db)

    def _doc(self, scope: str, document_id: str) -> DocDocument:
        return self.studio._get_document_row(scope, document_id)

    def _asset_bytes(self, src: str) -> bytes | None:
        m = re.search(rf"{re.escape(ASSET_URL_PREFIX)}/([0-9a-fA-F-]{{36}})/file", src or "")
        if not m:
            return None
        a = self.db.query(DocAsset).filter(DocAsset.id == m.group(1)).first()
        return bytes(a.data) if a else None

    # Markdown
    def export_markdown(self, scope: str, document_id: str) -> str:
        doc = self._doc(scope, document_id)
        body = doc.content_markdown or ""
        if body.lstrip().startswith("# "):
            return body
        return f"# {doc.title}\n\n{body}"

    # HTML (used for print preview and as the DOCX/PDF fallback)
    def export_html(self, scope: str, document_id: str) -> str:
        doc = self._doc(scope, document_id)
        parts: list[str] = [
            "<!doctype html><html><head><meta charset='utf-8'>",
            f"<title>{html.escape(doc.title or 'Document')}</title>",
            "<style>body{font-family:Inter,system-ui,sans-serif;color:#0f172a;max-width:52rem;margin:2rem auto;padding:0 1rem;line-height:1.55}"
            f"h1{{color:{BRAND_NAVY}}} h2{{border-bottom:2px solid {BRAND_SKY};padding-bottom:.25rem}} "
            "table{border-collapse:collapse;width:100%} td,th{border:1px solid #cbd5e1;padding:.35rem .5rem} th{background:#e0f2fe;text-align:left} "
            "blockquote{border-left:4px solid #38bdf8;margin:0;padding:.25rem 1rem;color:#334155;background:#f0f9ff} "
            "pre{background:#0f172a;color:#e2e8f0;padding:.75rem;border-radius:.5rem;overflow:auto} img{max-width:100%} "
            ".brand{font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:#0369a1;font-weight:600}</style></head><body>",
            "<p class='brand'>Water Workforce 360 · One Water Workforce</p>",
            f"<h1>{html.escape(doc.title or '')}</h1>",
        ]
        for b in parse_markdown(doc.content_markdown or ""):
            if b.kind == "heading":
                lvl = min(6, max(1, b.level + 1))
                parts.append(f"<h{lvl}>{inline_to_html(b.text)}</h{lvl}>")
            elif b.kind == "paragraph":
                parts.append(f"<p>{inline_to_html(b.text)}</p>")
            elif b.kind == "bullets":
                parts.append(
                    "<ul>" + "".join(f"<li>{inline_to_html(t)}</li>" for t in b.items) + "</ul>"
                )
            elif b.kind == "numbers":
                parts.append(
                    "<ol>" + "".join(f"<li>{inline_to_html(t)}</li>" for t in b.items) + "</ol>"
                )
            elif b.kind == "tasks":
                lis = "".join(
                    f"<li>{'☑' if c else '☐'} {inline_to_html(t)}</li>"
                    for t, c in zip(b.items, b.checked, strict=False)
                )
                parts.append(f"<ul style='list-style:none;padding-left:0'>{lis}</ul>")
            elif b.kind == "quote":
                parts.append(f"<blockquote>{inline_to_html(b.text)}</blockquote>")
            elif b.kind == "code":
                parts.append(f"<pre><code>{html.escape(b.text)}</code></pre>")
            elif b.kind == "rule":
                parts.append("<hr/>")
            elif b.kind == "image":
                parts.append(f"<img src='{html.escape(b.src)}' alt='{html.escape(b.alt)}'/>")
            elif b.kind == "table" and b.rows:
                head = "".join(f"<th>{inline_to_html(c)}</th>" for c in b.rows[0])
                body_rows = "".join(
                    "<tr>" + "".join(f"<td>{inline_to_html(c)}</td>" for c in r) + "</tr>"
                    for r in b.rows[1:]
                )
                parts.append(
                    f"<table><thead><tr>{head}</tr></thead><tbody>{body_rows}</tbody></table>"
                )
        parts.append("</body></html>")
        return "".join(parts)

    # PDF (ReportLab)
    def export_pdf(self, scope: str, document_id: str) -> bytes:
        doc = self._doc(scope, document_id)
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            HRFlowable,
            Image,
            ListFlowable,
            ListItem,
            PageBreak,  # noqa: F401
            Paragraph,
            Preformatted,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )

        styles = getSampleStyleSheet()
        base = ParagraphStyle(
            "ww-body", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=15
        )
        h_styles = {
            1: ParagraphStyle(
                "ww-h1",
                parent=styles["Heading1"],
                textColor=colors.HexColor(BRAND_NAVY),
                spaceBefore=10,
                spaceAfter=6,
            ),
            2: ParagraphStyle(
                "ww-h2",
                parent=styles["Heading2"],
                textColor=colors.HexColor(BRAND_NAVY),
                spaceBefore=10,
                spaceAfter=4,
            ),
            3: ParagraphStyle(
                "ww-h3",
                parent=styles["Heading3"],
                textColor=colors.HexColor(BRAND_SLATE),
                spaceBefore=8,
                spaceAfter=3,
            ),
        }
        quote_style = ParagraphStyle(
            "ww-quote",
            parent=base,
            leftIndent=14,
            textColor=colors.HexColor("#334155"),
            borderPadding=(4, 6, 4, 6),
            backColor=colors.HexColor("#f0f9ff"),
            borderColor=colors.HexColor(BRAND_SKY),
            borderWidth=0,
        )
        code_style = ParagraphStyle(
            "ww-code",
            parent=styles["Code"],
            fontSize=8.5,
            leading=11,
            backColor=colors.HexColor("#f1f5f9"),
            borderPadding=(4, 6, 4, 6),
        )
        brand_style = ParagraphStyle(
            "ww-brand",
            parent=base,
            fontSize=8,
            textColor=colors.HexColor("#0369a1"),
            alignment=TA_LEFT,
        )
        title_style = ParagraphStyle(
            "ww-title",
            parent=styles["Title"],
            textColor=colors.HexColor(BRAND_NAVY),
            alignment=TA_LEFT,
            fontSize=22,
            leading=26,
            spaceAfter=4,
        )

        buf = io.BytesIO()
        pdf = SimpleDocTemplate(
            buf,
            pagesize=letter,
            leftMargin=0.9 * inch,
            rightMargin=0.9 * inch,
            topMargin=0.8 * inch,
            bottomMargin=0.8 * inch,
            title=doc.title or "Document",
            author="Water Workforce 360",
        )
        story: list = [
            Paragraph("WATER WORKFORCE 360 · ONE WATER WORKFORCE", brand_style),
            Paragraph(html.escape(doc.title or "Document"), title_style),
            HRFlowable(width="100%", thickness=2, color=colors.HexColor(BRAND_SKY), spaceAfter=10),
        ]
        avail_w = letter[0] - pdf.leftMargin - pdf.rightMargin

        for b in parse_markdown(doc.content_markdown or ""):
            if b.kind == "heading":
                story.append(
                    Paragraph(inline_to_html(b.text), h_styles.get(min(b.level, 3), h_styles[3]))
                )
            elif b.kind == "paragraph":
                story.append(Paragraph(inline_to_html(b.text), base))
                story.append(Spacer(1, 4))
            elif b.kind in ("bullets", "numbers", "tasks"):
                if b.kind == "tasks":
                    items = [
                        ListItem(
                            Paragraph(("☑ " if c else "☐ ") + inline_to_html(t), base), leftIndent=6
                        )
                        for t, c in zip(b.items, b.checked, strict=False)
                    ]
                    story.append(ListFlowable(items, bulletType="bullet", start="", leftIndent=10))
                else:
                    items = [ListItem(Paragraph(inline_to_html(t), base)) for t in b.items]
                    story.append(
                        ListFlowable(
                            items,
                            bulletType="1" if b.kind == "numbers" else "bullet",
                            leftIndent=14,
                        )
                    )
                story.append(Spacer(1, 4))
            elif b.kind == "quote":
                story.append(Paragraph(inline_to_html(b.text), quote_style))
                story.append(Spacer(1, 6))
            elif b.kind == "code":
                story.append(Preformatted(b.text, code_style))
                story.append(Spacer(1, 6))
            elif b.kind == "rule":
                story.append(
                    HRFlowable(
                        width="100%",
                        thickness=0.6,
                        color=colors.HexColor("#cbd5e1"),
                        spaceBefore=6,
                        spaceAfter=6,
                    )
                )
            elif b.kind == "image":
                raw = self._asset_bytes(b.src)
                if raw:
                    try:
                        img = Image(io.BytesIO(raw))
                        ratio = img.imageHeight / float(img.imageWidth or 1)
                        w = min(avail_w, img.imageWidth)
                        img.drawWidth = w
                        img.drawHeight = w * ratio
                        story.append(img)
                        story.append(Spacer(1, 6))
                    except Exception as exc:  # pragma: no cover
                        logger.warning("PDF image skipped: %s", exc)
                elif b.alt:
                    story.append(Paragraph(f"<i>[Image: {html.escape(b.alt)}]</i>", base))
            elif b.kind == "table" and b.rows:
                ncols = max(len(r) for r in b.rows)
                data = [
                    [Paragraph(inline_to_html(c), base) for c in (r + [""] * (ncols - len(r)))]
                    for r in b.rows
                ]
                t = Table(data, colWidths=[avail_w / ncols] * ncols, repeatRows=1)
                t.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0f2fe")),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 5),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                        ]
                    )
                )
                story.append(t)
                story.append(Spacer(1, 8))

        def _footer(canvas, d):
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.HexColor("#64748b"))
            canvas.drawString(
                d.leftMargin, 0.5 * inch, f"{doc.title or 'Document'} · v{doc.version_no}"
            )
            canvas.drawRightString(letter[0] - d.rightMargin, 0.5 * inch, f"Page {d.page}")
            canvas.restoreState()

        pdf.build(story, onFirstPage=_footer, onLaterPages=_footer)
        return buf.getvalue()

    # DOCX (python-docx)
    def export_docx(self, scope: str, document_id: str) -> bytes:
        try:
            from docx import Document
            from docx.shared import Inches, Pt, RGBColor
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("python-docx is required for DOCX export") from exc

        doc = self._doc(scope, document_id)
        d = Document()
        brand = d.add_paragraph()
        run = brand.add_run("WATER WORKFORCE 360 · ONE WATER WORKFORCE")
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(0x03, 0x69, 0xA1)
        d.add_heading(doc.title or "Document", level=0)

        def add_inline(paragraph, text: str) -> None:
            # Very small inline-mark renderer: **bold**, *em*, `code`.
            pos = 0
            token_re = re.compile(r"(\*\*.+?\*\*|`[^`]+`|(?<![*\w])\*(?!\*).+?\*(?![*\w]))")
            for m in token_re.finditer(text):
                if m.start() > pos:
                    paragraph.add_run(inline_to_plain(text[pos : m.start()]))
                tok = m.group(0)
                if tok.startswith("**"):
                    r = paragraph.add_run(tok[2:-2])
                    r.bold = True
                elif tok.startswith("`"):
                    r = paragraph.add_run(tok[1:-1])
                    r.font.name = "Courier New"
                else:
                    r = paragraph.add_run(tok[1:-1])
                    r.italic = True
                pos = m.end()
            if pos < len(text):
                paragraph.add_run(inline_to_plain(text[pos:]))

        for b in parse_markdown(doc.content_markdown or ""):
            if b.kind == "heading":
                d.add_heading(inline_to_plain(b.text), level=min(b.level, 4))
            elif b.kind == "paragraph":
                add_inline(d.add_paragraph(), b.text)
            elif b.kind == "bullets":
                for t in b.items:
                    add_inline(d.add_paragraph(style="List Bullet"), t)
            elif b.kind == "numbers":
                for t in b.items:
                    add_inline(d.add_paragraph(style="List Number"), t)
            elif b.kind == "tasks":
                for t, c in zip(b.items, b.checked, strict=False):
                    add_inline(d.add_paragraph(), ("☑ " if c else "☐ ") + t)
            elif b.kind == "quote":
                p = d.add_paragraph(style="Intense Quote")
                add_inline(p, b.text)
            elif b.kind == "code":
                p = d.add_paragraph()
                r = p.add_run(b.text)
                r.font.name = "Courier New"
                r.font.size = Pt(9)
            elif b.kind == "rule":
                d.add_paragraph("―" * 30)
            elif b.kind == "image":
                raw = self._asset_bytes(b.src)
                if raw:
                    try:
                        d.add_picture(io.BytesIO(raw), width=Inches(6))
                    except Exception as exc:  # pragma: no cover
                        logger.warning("DOCX image skipped: %s", exc)
                elif b.alt:
                    d.add_paragraph(f"[Image: {b.alt}]")
            elif b.kind == "table" and b.rows:
                ncols = max(len(r) for r in b.rows)
                t = d.add_table(rows=len(b.rows), cols=ncols)
                t.style = "Light Grid Accent 1"
                for ri, r in enumerate(b.rows):
                    for ci in range(ncols):
                        cell = t.cell(ri, ci)
                        cell.text = ""
                        add_inline(cell.paragraphs[0], r[ci] if ci < len(r) else "")
        buf = io.BytesIO()
        d.save(buf)
        return buf.getvalue()


# ── Import: uploaded file → markdown ────────────────────────────────────────


def _docx_to_markdown(data: bytes) -> str:
    from docx import Document

    d = Document(io.BytesIO(data))
    out: list[str] = []
    for p in d.paragraphs:
        text = p.text.strip()
        style = (p.style.name or "").lower() if p.style is not None else ""
        if not text:
            out.append("")
            continue
        if style.startswith("heading"):
            try:
                lvl = int(style.split()[-1])
            except ValueError:
                lvl = 2
            out.append("#" * max(1, min(lvl, 6)) + " " + text)
        elif style.startswith("title"):
            out.append("# " + text)
        elif "bullet" in style:
            out.append("- " + text)
        elif "number" in style:
            out.append("1. " + text)
        else:
            out.append(text)
    for t in d.tables:
        out.append("")
        rows = [[c.text.strip().replace("\n", " ") for c in r.cells] for r in t.rows]
        if rows:
            out.append("| " + " | ".join(rows[0]) + " |")
            out.append("| " + " | ".join("---" for _ in rows[0]) + " |")
            for r in rows[1:]:
                out.append("| " + " | ".join(r) + " |")
    return "\n".join(out).strip() + "\n"


def _pdf_to_markdown(data: bytes) -> str:
    try:
        import pdfplumber

        parts: list[str] = []
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                txt = page.extract_text() or ""
                if txt.strip():
                    parts.append(txt.strip())
        return "\n\n".join(parts) + "\n"
    except Exception:  # pragma: no cover
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join((p.extract_text() or "").strip() for p in reader.pages) + "\n"


def file_to_markdown(filename: str, content_type: str, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".docx") or "wordprocessingml" in (content_type or ""):
        return _docx_to_markdown(data)
    if name.endswith(".pdf") or content_type == "application/pdf":
        return _pdf_to_markdown(data)
    if name.endswith((".md", ".markdown", ".txt")) or (content_type or "").startswith("text/"):
        return data.decode("utf-8", errors="replace")
    raise ValueError("Unsupported file type — upload .docx, .pdf, .md or .txt")


_BRAND_LINE = "WATER WORKFORCE 360"


def title_from_markdown(markdown: str, fallback: str) -> str:
    """Prefer the first H1 in the opening lines; otherwise the first real line."""
    lines = [ln.strip() for ln in (markdown or "").splitlines()]
    head = [ln for ln in lines[:20] if ln]
    for s in head:
        if s.startswith("# "):
            return s[2:].strip()[:200]
    for s in head:
        if s.upper().startswith(_BRAND_LINE):
            continue
        return s.lstrip("#").strip()[:120]
    return fallback
