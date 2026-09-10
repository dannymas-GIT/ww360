"""Assemble Succession Binder and CEU Tracker packs in Document Studio."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.doc_document import DocDocument, DocFolder
from app.models.water_district import WaterDistrict
from app.models.workforce_succession import (
    WorkforceCriticalFunction,
    WorkforceEmployee,
    WorkforceKnowledgeArtifact,
    WorkforcePosition,
    WorkforceRoleCoverage,
    WorkforceSuccessionCandidate,
)
from app.schemas.doc_studio import DocContentSave, DocDocumentCreate, DocFolderCreate
from app.services.doc_studio_service import DocStudioService
from app.services.workforce_succession.analytics import compute_continuity_response
from app.services.workforce_succession.binder_catalog import (
    BINDER_TAG,
    CEU_PACK_TAG,
    CEU_SECTIONS,
    SUCCESSION_BINDER_FOLDER,
    TRAINING_CE_FOLDER,
    WORKFORCE_ROOT_FOLDER,
    BinderProfile,
    BinderSection,
    PackType,
    sections_for_profile,
)
from app.services.workforce_succession.ceu_service import compute_district_ceu_summaries


@dataclass
class WorkforceDocPackResult:
    pack_type: PackType
    profile: BinderProfile | None
    folder_id: str
    cover_document_id: str | None
    documents: list[DocDocument]


def _placeholder_row(cols: int, text: str = "—") -> str:
    """Single markdown table *body* row (headers must already be in the template)."""
    return "| " + " | ".join([text] * cols) + " |"


def _md_table(headers: list[str], rows: list[list[str]] | None = None) -> str:
    """Full GFM table — TipTap only parses tables with a header + separator row."""
    if not headers:
        return ""
    head = "| " + " | ".join(headers) + " |"
    sep = "| " + " | ".join("---" for _ in headers) + " |"
    body_rows = rows if rows else [["—"] * len(headers)]
    body_lines = []
    for row in body_rows:
        cells = list(row) + ["—"] * max(0, len(headers) - len(row))
        cells = [str(c if c is not None and str(c).strip() != "" else "—") for c in cells[: len(headers)]]
        body_lines.append("| " + " | ".join(cells) + " |")
    return "\n".join([head, sep, *body_lines])


COVERAGE_HEADERS = ["Function / role", "Primary", "Backup", "Risk", "Notes"]
RETIREMENT_HEADERS = ["Employee", "Position", "Eligible date", "Months"]
CERT_CLIFF_HEADERS = ["Employee", "Credential", "Expires", "Window"]
KNOWLEDGE_HEADERS = ["Title", "Type", "Status"]
SUCCESSION_HEADERS = ["Candidate", "Target role", "Readiness", "Target date", "Notes"]
CEU_HEADERS = ["Operator", "Grade", "Cycle end", "Required hr", "Earned hr", "Remaining", "Status"]
CEU_PLAN_HEADERS = ["Operator", "Grade", "CE due", "Hours needed", "Planned courses"]


class WorkforceDocPackService:
    def __init__(self, db: Session):
        self.db = db
        self.studio = DocStudioService(db)

    def generate_pack(
        self,
        district_code: str,
        user_id: int | None,
        *,
        pack_type: PackType = "succession_binder",
        profile: BinderProfile = "small_system",
        contact_name: str | None = None,
        contact_email: str | None = None,
        use_live_data: bool = True,
        intake_answers: dict[str, Any] | None = None,
        force_refresh: bool = False,
    ) -> WorkforceDocPackResult:
        if not settings.WW360_DOC_STUDIO_ENABLED:
            raise HTTPException(status_code=501, detail="Document Studio is not enabled on WW360")

        scope = district_code
        self.studio.ensure_default_folders(scope, user_id)
        district = (
            self.db.query(WaterDistrict)
            .filter(WaterDistrict.district_code == district_code)
            .first()
        )
        utility_name = (district.district_name if district else None) or district_code

        if intake_answers:
            profile = intake_answers.get("profile") or profile  # type: ignore[assignment]
            contact_name = intake_answers.get("contact_name") or contact_name
            contact_email = intake_answers.get("contact_email") or contact_email
            use_live_data = bool(intake_answers.get("use_live_data", use_live_data))

        context = self._build_context(
            district_code,
            utility_name,
            contact_name,
            contact_email,
            use_live_data,
            intake_answers=intake_answers,
        )

        if pack_type == "succession_binder":
            return self._generate_succession_binder(
                scope,
                district_code,
                user_id,
                profile,
                context,
                force_refresh=force_refresh or bool(intake_answers),
            )
        return self._generate_ceu_tracker_pack(scope, district_code, user_id, context)

    def find_existing_binder(self, scope: str) -> WorkforceDocPackResult | None:
        """Return an existing succession binder if the cover doc is present."""
        binder_folder = self._find_binder_folder(scope)
        if not binder_folder:
            return None
        docs = (
            self.db.query(DocDocument)
            .filter(
                DocDocument.scope == scope,
                DocDocument.folder_id == binder_folder.id,
                DocDocument.status != "archived",
            )
            .order_by(DocDocument.created_at.asc())
            .all()
        )
        cover = next(
            (d for d in docs if isinstance(d.tags, list) and f"{BINDER_TAG}:cover" in d.tags),
            None,
        )
        if not cover:
            return None
        return WorkforceDocPackResult(
            pack_type="succession_binder",
            profile=None,
            folder_id=binder_folder.id,
            cover_document_id=cover.id,
            documents=docs,
        )

    def _generate_succession_binder(
        self,
        scope: str,
        district_code: str,
        user_id: int | None,
        profile: BinderProfile,
        context: dict[str, str],
        *,
        force_refresh: bool = False,
    ) -> WorkforceDocPackResult:
        existing = self.find_existing_binder(scope)
        if existing and not force_refresh:
            return existing

        root = self._folder_by_name(scope, WORKFORCE_ROOT_FOLDER)
        if not root:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Workforce folder missing")

        binder_folder = self._ensure_subfolder(
            scope, SUCCESSION_BINDER_FOLDER, root.id, user_id,
            "Stable succession planning documents — export or transfer custody when ready.",
        )

        sections = sections_for_profile(profile)
        section_links: list[str] = []
        for section in sections:
            if section.section_id == "cover":
                continue
            section_links.append(f"- [{section.title}](#{section.section_id.replace('_', '-')})")
        context["section_links"] = "\n".join(section_links) if section_links else "- (sections below)"

        if existing and force_refresh:
            return self._refresh_succession_binder_docs(
                scope, user_id, profile, context, binder_folder, existing
            )

        created: list[DocDocument] = []
        cover_doc: DocDocument | None = None
        for section in sections:
            md = self._render(section.markdown, context)
            title = (
                "Succession Binder — Cover"
                if section.section_id == "cover"
                else section.title
            )
            doc = self._create_binder_doc(
                scope,
                binder_folder.id,
                title=title,
                template_id=section.template_id,
                markdown=md,
                user_id=user_id,
                tags=[
                    BINDER_TAG,
                    f"{BINDER_TAG}:{'cover' if section.section_id == 'cover' else 'section'}",
                    f"{BINDER_TAG}:section:{section.section_id}",
                    f"template:{section.template_id}",
                ],
            )
            created.append(doc)
            if section.section_id == "cover":
                cover_doc = doc

        return WorkforceDocPackResult(
            pack_type="succession_binder",
            profile=profile,
            folder_id=binder_folder.id,
            cover_document_id=cover_doc.id if cover_doc else None,
            documents=created,
        )

    def _refresh_succession_binder_docs(
        self,
        scope: str,
        user_id: int | None,
        profile: BinderProfile,
        context: dict[str, str],
        binder_folder: DocFolder,
        existing: WorkforceDocPackResult,
    ) -> WorkforceDocPackResult:
        sections = sections_for_profile(profile)
        docs_by_section: dict[str, DocDocument] = {}
        for doc in existing.documents:
            tags = doc.tags if isinstance(doc.tags, list) else []
            for tag in tags:
                if tag.startswith(f"{BINDER_TAG}:section:"):
                    docs_by_section[tag.split(":", 2)[-1]] = doc

        updated_docs: list[DocDocument] = list(existing.documents)
        cover_doc = existing.cover_document_id

        for section in sections:
            md = self._render(section.markdown, context)
            title = (
                "Succession Binder — Cover"
                if section.section_id == "cover"
                else section.title
            )
            existing_doc = docs_by_section.get(section.section_id)
            if existing_doc:
                self.studio.save_content(
                    scope,
                    existing_doc.id,
                    DocContentSave(content_markdown=md, title=title, force_version=True),
                    user_id,
                )
                refreshed = (
                    self.db.query(DocDocument)
                    .filter(DocDocument.id == existing_doc.id)
                    .first()
                )
                if refreshed:
                    idx = next(
                        (i for i, d in enumerate(updated_docs) if d.id == refreshed.id),
                        None,
                    )
                    if idx is not None:
                        updated_docs[idx] = refreshed
                    if section.section_id == "cover":
                        cover_doc = refreshed.id
            else:
                doc = self._create_binder_doc(
                    scope,
                    binder_folder.id,
                    title=title,
                    template_id=section.template_id,
                    markdown=md,
                    user_id=user_id,
                    tags=[
                        BINDER_TAG,
                        f"{BINDER_TAG}:{'cover' if section.section_id == 'cover' else 'section'}",
                        f"{BINDER_TAG}:section:{section.section_id}",
                        f"template:{section.template_id}",
                    ],
                )
                updated_docs.append(doc)
                if section.section_id == "cover":
                    cover_doc = doc.id

        return WorkforceDocPackResult(
            pack_type="succession_binder",
            profile=profile,
            folder_id=binder_folder.id,
            cover_document_id=cover_doc,
            documents=updated_docs,
        )

    def _generate_ceu_tracker_pack(
        self,
        scope: str,
        district_code: str,
        user_id: int | None,
        context: dict[str, str],
    ) -> WorkforceDocPackResult:
        today = date.today()
        pack_label = today.strftime("%Y-%m-%d")
        folder_name = f"CEU Tracker — {pack_label}"

        training_root = self._folder_by_name(scope, TRAINING_CE_FOLDER)
        if not training_root:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Training folder missing")

        pack_folder = self._ensure_subfolder(
            scope,
            folder_name,
            training_root.id,
            user_id,
            "Point-in-time CEU snapshot — archive to your cloud after each refresh.",
        )

        context["pack_label"] = pack_label
        context["calendar_year"] = str(today.year)

        created: list[DocDocument] = []
        for section in CEU_SECTIONS:
            md = self._render(section.markdown, context)
            doc = self._create_binder_doc(
                scope,
                pack_folder.id,
                title=section.title if section.section_id != "ceu_tracker" else folder_name,
                template_id=section.template_id,
                markdown=md,
                user_id=user_id,
                tags=[
                    CEU_PACK_TAG,
                    f"{CEU_PACK_TAG}:{pack_label}",
                    f"template:{section.template_id}",
                ],
            )
            created.append(doc)

        cover = next((d for d in created if CEU_PACK_TAG in (d.tags or [])), created[0] if created else None)
        return WorkforceDocPackResult(
            pack_type="ceu_tracker_pack",
            profile=None,
            folder_id=pack_folder.id,
            cover_document_id=cover.id if cover else None,
            documents=created,
        )

    def _build_context(
        self,
        district_code: str,
        utility_name: str,
        contact_name: str | None,
        contact_email: str | None,
        use_live_data: bool,
        intake_answers: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        today = date.today()
        ctx: dict[str, str] = {
            "utility_name": utility_name,
            "district_code": district_code,
            "contact_name": contact_name or "(edit)",
            "contact_email": contact_email or "(edit)",
            "generated_date": today.isoformat(),
            "operations_summary": "",
            "vacant_positions": "—",
            "retirement_24mo": "—",
            "ceu_shortfall_count": "—",
            "coverage_table": _md_table(
                COVERAGE_HEADERS,
                [["(add coverage in Continuity or edit here)", "—", "—", "—", "—"]],
            ),
            "retirement_table": _md_table(RETIREMENT_HEADERS),
            "cert_cliff_table": _md_table(CERT_CLIFF_HEADERS),
            "succession_rows": _placeholder_row(5, "—"),
            "knowledge_table": _md_table(KNOWLEDGE_HEADERS),
            "ceu_rows": _placeholder_row(7, "—"),
            "ceu_plan_rows": _placeholder_row(5, "—"),
        }

        if intake_answers:
            self._apply_intake_answers(ctx, intake_answers)

        if use_live_data:
            continuity = compute_continuity_response(self.db, district_code)
            scorecard = continuity.get("scorecard") or {}
            ctx["vacant_positions"] = str(scorecard.get("vacant_positions", "—"))
            ctx["retirement_24mo"] = str(scorecard.get("employees_retirement_eligible_24mo", "—"))
            ctx["ceu_shortfall_count"] = str(scorecard.get("ceu_shortfall_count", "—"))

            use_cov = not intake_answers or intake_answers.get("use_continuity_coverage", True)
            coverage = continuity.get("coverage") or []
            if use_cov and coverage and not (
                intake_answers and intake_answers.get("critical_roles")
            ):
                rows = [
                    [
                        r.get("function_name") or r.get("function_code") or "—",
                        ", ".join(r.get("primary_employee_codes") or []) or "—",
                        ", ".join(r.get("backup_employee_codes") or []) or "—",
                        r.get("risk_level") or "—",
                        "No backup" if not r.get("has_qualified_backup") else "OK",
                    ]
                    for r in coverage[:25]
                ]
                ctx["coverage_table"] = _md_table(COVERAGE_HEADERS, rows)

            use_ret = not intake_answers or intake_answers.get("use_continuity_retirement", True)
            retirement = continuity.get("retirement_horizon") or []
            if use_ret and retirement and not (
                intake_answers and intake_answers.get("retirement_entries")
            ):
                rows = [
                    [
                        r.get("employee_name") or r.get("employee_code") or "—",
                        r.get("position_code") or "—",
                        str(r.get("retirement_eligible_date") or "—"),
                        f"{r.get('months_until_eligible', '—')} mo",
                    ]
                    for r in retirement[:20]
                ]
                ctx["retirement_table"] = _md_table(RETIREMENT_HEADERS, rows)

            cert_cliff = continuity.get("cert_cliff") or []
            cliff_90 = [c for c in cert_cliff if (c.get("days_until_expiration") or 999) <= 90]
            if cliff_90:
                rows = [
                    [
                        c.get("employee_name") or "—",
                        c.get("certification_grade") or c.get("certification_type") or "—",
                        str(c.get("expiration_date") or "—"),
                        f"{c.get('days_until_expiration', '—')} days",
                    ]
                    for c in cliff_90[:15]
                ]
                ctx["cert_cliff_table"] = _md_table(CERT_CLIFF_HEADERS, rows)

            use_bench = not intake_answers or intake_answers.get("use_continuity_bench", True)
            candidates = (
                self.db.query(WorkforceSuccessionCandidate)
                .filter(
                    WorkforceSuccessionCandidate.district_code == district_code,
                    WorkforceSuccessionCandidate.record_status == "active",
                )
                .limit(20)
                .all()
            )
            employees = {
                e.employee_code: e.full_name
                for e in self.db.query(WorkforceEmployee)
                .filter(
                    WorkforceEmployee.district_code == district_code,
                    WorkforceEmployee.record_status == "active",
                )
                .all()
            }
            positions = {
                p.position_code: p.title
                for p in self.db.query(WorkforcePosition)
                .filter(
                    WorkforcePosition.district_code == district_code,
                    WorkforcePosition.record_status == "active",
                )
                .all()
            }
            if use_bench and candidates and not (
                intake_answers and intake_answers.get("succession_candidates")
            ):
                rows = [
                    f"| {employees.get(c.employee_code, c.employee_code)} "
                    f"| {positions.get(c.target_position_code, c.target_position_code)} "
                    f"| {c.readiness_level or '—'} "
                    f"| {c.readiness_target_date or '—'} "
                    f"| {(c.notes or '')[:80] or '—'} |"
                    for c in candidates
                ]
                ctx["succession_rows"] = "\n".join(rows)

            if not (intake_answers and intake_answers.get("knowledge_items")):
                artifacts = (
                    self.db.query(WorkforceKnowledgeArtifact)
                    .filter(
                        WorkforceKnowledgeArtifact.district_code == district_code,
                        WorkforceKnowledgeArtifact.record_status == "active",
                    )
                    .limit(15)
                    .all()
                )
                if artifacts:
                    rows = [
                        [
                            a.title or "—",
                            a.artifact_type or "—",
                            a.record_status or "—",
                        ]
                        for a in artifacts
                    ]
                    ctx["knowledge_table"] = _md_table(KNOWLEDGE_HEADERS, rows)

            ceu_summaries = compute_district_ceu_summaries(self.db, district_code)
            if ceu_summaries:
                rows = [
                    f"| {s.employee_name} "
                    f"| {s.certification_grade or '—'} "
                    f"| {s.renewal_cycle_end} "
                    f"| {s.required_hours:g} "
                    f"| {s.earned_hours:g} "
                    f"| {s.remaining_hours:g} "
                    f"| {'Shortfall' if s.is_shortfall else 'On track'} |"
                    for s in ceu_summaries
                ]
                ctx["ceu_rows"] = "\n".join(rows)
                ctx["ceu_plan_rows"] = "\n".join(
                    f"| {s.employee_name} | {s.certification_grade or '—'} "
                    f"| {s.renewal_cycle_end} | {s.remaining_hours:g} | (planned) |"
                    for s in ceu_summaries
                )

        return ctx

    def _apply_intake_answers(self, ctx: dict[str, str], answers: dict[str, Any]) -> None:
        plant_count = answers.get("plant_count")
        gap_notes = str(answers.get("gap_notes") or "").strip()
        gaps = answers.get("largest_gaps") or []
        if plant_count or gap_notes or gaps:
            parts = []
            if plant_count:
                parts.append(f"**Plants / sites:** {plant_count}")
            if gaps:
                parts.append(f"**Priority gaps:** {', '.join(str(g) for g in gaps)}")
            if gap_notes:
                parts.append(gap_notes)
            ctx["operations_summary"] = "\n\n".join(parts)

        roles = answers.get("critical_roles") or []
        if isinstance(roles, list) and roles:
            rows = []
            for r in roles:
                if not isinstance(r, dict):
                    continue
                rows.append(
                    [
                        r.get("role_name") or "—",
                        r.get("primary_name") or "—",
                        r.get("backup_name") or "—",
                        "—",
                        r.get("notes") or "—",
                    ]
                )
            if rows:
                ctx["coverage_table"] = _md_table(COVERAGE_HEADERS, rows)

        ret_entries = answers.get("retirement_entries") or []
        if isinstance(ret_entries, list) and ret_entries:
            rows = []
            for r in ret_entries:
                if not isinstance(r, dict):
                    continue
                rows.append(
                    [
                        r.get("employee_name") or "—",
                        r.get("position") or "—",
                        r.get("timeline") or "—",
                        r.get("notes") or "—",
                    ]
                )
            if rows:
                ctx["retirement_table"] = _md_table(RETIREMENT_HEADERS, rows)
        elif answers.get("retirement_notes"):
            # Free-text notes are not a table — keep as prose under the section.
            ctx["retirement_table"] = str(answers.get("retirement_notes"))

        candidates = answers.get("succession_candidates") or []
        if isinstance(candidates, list) and candidates:
            rows = []
            for c in candidates:
                if not isinstance(c, dict):
                    continue
                rows.append(
                    f"| {c.get('candidate_name') or '—'} "
                    f"| {c.get('target_role') or '—'} "
                    f"| {c.get('readiness') or '—'} "
                    f"| {c.get('target_date') or '—'} "
                    f"| {c.get('notes') or '—'} |"
                )
            if rows:
                ctx["succession_rows"] = "\n".join(rows)

        knowledge = answers.get("knowledge_items") or []
        if isinstance(knowledge, list) and knowledge:
            rows = []
            for k in knowledge:
                if not isinstance(k, dict):
                    continue
                rows.append(
                    [
                        k.get("title") or "—",
                        k.get("item_type") or "SOP",
                        k.get("status") or "planned",
                    ]
                )
            if rows:
                ctx["knowledge_table"] = _md_table(KNOWLEDGE_HEADERS, rows)

    def _render(self, template: str, context: dict[str, str]) -> str:
        out = template
        for key, value in context.items():
            out = out.replace(f"{{{{{key}}}}}", value or "")
        return out.strip() + "\n"

    def _folder_by_name(self, scope: str, name: str, parent_id: str | None = None) -> DocFolder | None:
        q = self.db.query(DocFolder).filter(DocFolder.scope == scope, DocFolder.name == name)
        if parent_id:
            q = q.filter(DocFolder.parent_id == parent_id)
        else:
            q = q.filter(DocFolder.parent_id.is_(None))
        return q.first()

    def _find_binder_folder(self, scope: str) -> DocFolder | None:
        root = self._folder_by_name(scope, WORKFORCE_ROOT_FOLDER)
        if not root:
            return None
        return self._folder_by_name(scope, SUCCESSION_BINDER_FOLDER, root.id)

    def _ensure_subfolder(
        self,
        scope: str,
        name: str,
        parent_id: str,
        user_id: int | None,
        description: str,
    ) -> DocFolder:
        existing = self._folder_by_name(scope, name, parent_id)
        if existing:
            return existing
        created = self.studio.create_folder(
            scope,
            DocFolderCreate(name=name, parent_id=parent_id, description=description),
            user_id,
        )
        row = self.db.query(DocFolder).filter(DocFolder.id == created.id).first()
        return row  # type: ignore[return-value]

    def _create_binder_doc(
        self,
        scope: str,
        folder_id: str,
        *,
        title: str,
        template_id: str,
        markdown: str,
        user_id: int | None,
        tags: list[str],
    ) -> DocDocument:
        detail = self.studio.create_document(
            scope,
            DocDocumentCreate(
                title=title,
                folder_id=folder_id,
                template_id=template_id,
                content_markdown=markdown,
                summary="Workforce binder document — edit, export, or transfer custody when ready.",
                tags=tags,
            ),
            user_id,
        )
        return self.db.query(DocDocument).filter(DocDocument.id == detail.id).first()  # type: ignore[return-value]
