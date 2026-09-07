#!/usr/bin/env python3
"""Seed national platform admin + NJ state/district demo accounts and sample data.

Creates:
  - ww360-national     platform_admin (cross-state switcher)
  - nj-state-admin     state_admin for NJ_OWW (executive overview)
  - wb-admin           district_admin for Township of Woodbridge Water (WBWD)
  - wb-manager         district/workforce manager
  - wb-operator-1      operator with CEU + documentation tasks

Also seeds NJ org branding, WBWD continuity data, review-queue tasks,
notifications, and a few Document Studio samples in program:NJ.

Usage:
  python scripts/seed_national_nj_demo.py
  WW360_SEED_NATIONAL_PASSWORD=... WW360_SEED_NJ_PASSWORD=... python scripts/seed_national_nj_demo.py
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.db.database import SessionLocal, init_db  # noqa: E402
from app.models.doc_document import DocDocument, DocFolder, program_scope_for_state  # noqa: E402
from app.models.documentation_task import DocumentationGrant, DocumentationTask, DocumentationTaskNote  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.water_district import WaterDistrict  # noqa: E402
from app.models.workforce_organization import (  # noqa: E402
    OrganizationDistrictMembership,
    OrganizationUserMembership,
    WorkforceOrganization,
)
from app.models.workforce_succession import (  # noqa: E402
    WorkforceCertification,
    WorkforceCriticalFunction,
    WorkforceCeuRecord,
    WorkforceEmployee,
    WorkforcePosition,
    WorkforceRoleCoverage,
    WorkforceSuccessionCandidate,
)

NJ_ORG = "NJ_OWW"
NY_ORG = "NY_OWW"
DISTRICT_CODE = "WBWD"
DISTRICT_NAME = "Township of Woodbridge Water Department"

DEFAULT_NATIONAL_PASSWORD = "ChangeMe-National!"
DEFAULT_NJ_PASSWORD = "ChangeMe-NJ!"


def _upsert_user(
    db,
    *,
    username: str,
    email: str,
    full_name: str,
    roles: list[str],
    password: str,
    districts: list[str] | None = None,
) -> User:
    user = db.query(User).filter(User.username == username).one_or_none()
    if not user:
        user = User(
            username=username,
            email=email,
            full_name=full_name,
            roles=roles,
            district_memberships=districts or [],
            is_active=True,
        )
        user.set_password(password)
        db.add(user)
        db.flush()
        print(f"  created user {username} roles={roles}")
    else:
        user.roles = roles
        user.district_memberships = districts or []
        user.full_name = full_name
        user.email = email
        user.is_active = True
        if password:
            user.set_password(password)
        print(f"  updated user {username} roles={roles}")
    return user


def _upsert_org(db, *, org_code: str, name: str, state_code: str, partner_label: str, section_label: str) -> None:
    org = db.query(WorkforceOrganization).filter(WorkforceOrganization.org_code == org_code).one_or_none()
    if not org:
        org = WorkforceOrganization(
            org_code=org_code,
            name=name,
            org_type="state_program",
            state_code=state_code,
            partner_label=partner_label,
            section_label=section_label,
            content_pack_key=state_code,
            is_active=True,
        )
        db.add(org)
        print(f"Created organization {org_code}")
    else:
        org.state_code = state_code
        org.partner_label = partner_label
        org.section_label = section_label
        org.content_pack_key = state_code
        org.is_active = True
        print(f"Updated organization {org_code}")


def _ensure_org_user(db, *, user_id: int, org_code: str, role: str = "state_admin") -> None:
    exists = (
        db.query(OrganizationUserMembership)
        .filter(
            OrganizationUserMembership.user_id == user_id,
            OrganizationUserMembership.org_code == org_code,
        )
        .one_or_none()
    )
    if exists:
        exists.role = role
        return
    db.add(
        OrganizationUserMembership(
            id=str(uuid.uuid4()),
            user_id=user_id,
            org_code=org_code,
            role=role,
        )
    )


def _ensure_org_district(db, *, org_code: str, district_code: str) -> None:
    exists = (
        db.query(OrganizationDistrictMembership)
        .filter(
            OrganizationDistrictMembership.org_code == org_code,
            OrganizationDistrictMembership.district_code == district_code,
        )
        .one_or_none()
    )
    if exists:
        return
    db.add(
        OrganizationDistrictMembership(
            id=str(uuid.uuid4()),
            org_code=org_code,
            district_code=district_code,
        )
    )


def _seed_workforce(db, *, op_user_id: int | None) -> dict[str, int]:
    today = date.today()
    positions_spec = [
        ("CHIEF-OP", "Chief Operator", "Operations"),
        ("T3-OP-1", "T3 Treatment Operator", "Treatment"),
        ("T3-OP-2", "T3 Treatment Operator", "Treatment"),
        ("W2-DIST", "W2 Distribution Operator", "Distribution"),
        ("LAB-LEAD", "Lab / Compliance Lead", "Laboratory"),
        ("MAINT-1", "Maintenance Mechanic", "Maintenance"),
    ]
    pos_ids: dict[str, int] = {}
    for code, title, dept in positions_spec:
        row = (
            db.query(WorkforcePosition)
            .filter(
                WorkforcePosition.district_code == DISTRICT_CODE,
                WorkforcePosition.position_code == code,
            )
            .one_or_none()
        )
        if not row:
            row = WorkforcePosition(
                district_code=DISTRICT_CODE,
                position_code=code,
                title=title,
                department=dept,
                fte_count=1,
                is_funded=True,
                is_vacant=code == "MAINT-1",
            )
            db.add(row)
            db.flush()
        else:
            row.is_vacant = code == "MAINT-1"
        pos_ids[code] = row.id

    employees_spec = [
        ("WB-001", "Devon Blake", "T3-OP-1", "T3", op_user_id, today - timedelta(days=2100)),
        ("WB-002", "Morgan Lee", "T3-OP-2", "T3", None, today - timedelta(days=1600)),
        ("WB-003", "Priya Shah", "CHIEF-OP", "T4", None, today - timedelta(days=5200)),
        ("WB-004", "Chris Alvarez", "W2-DIST", "W2", None, today - timedelta(days=1400)),
        ("WB-005", "Taylor Kim", "LAB-LEAD", None, None, today - timedelta(days=1100)),
        ("WB-006", "Jamie Ortiz", "T3-OP-1", "T2", None, today - timedelta(days=420)),
    ]
    emp_ids: dict[str, int] = {}
    for ecode, name, pcode, grade, linked_uid, hire in employees_spec:
        row = (
            db.query(WorkforceEmployee)
            .filter(
                WorkforceEmployee.district_code == DISTRICT_CODE,
                WorkforceEmployee.employee_code == ecode,
            )
            .one_or_none()
        )
        if not row:
            row = WorkforceEmployee(
                district_code=DISTRICT_CODE,
                employee_code=ecode,
                full_name=name,
                position_code=pcode,
                position_id=pos_ids.get(pcode),
                operator_grade=grade,
                linked_aquasafe_user_id=linked_uid,
                hire_date=hire,
                retirement_eligible_date=today + timedelta(days=420) if ecode == "WB-003" else None,
                planned_departure_date=today + timedelta(days=300) if ecode == "WB-003" else None,
                is_active=True,
            )
            db.add(row)
            db.flush()
        else:
            if linked_uid:
                row.linked_aquasafe_user_id = linked_uid
            if ecode == "WB-003":
                row.retirement_eligible_date = today + timedelta(days=420)
                row.planned_departure_date = today + timedelta(days=300)
        emp_ids[ecode] = row.id

    functions_spec = [
        ("FN-TREAT", "Surface water treatment train", "Treatment"),
        ("FN-CHEM", "Chemical feed & disinfection", "Treatment"),
        ("FN-DIST", "Distribution flushing & valve ops", "Distribution"),
        ("FN-LAB", "Compliance sampling & lab QC", "Compliance"),
        ("FN-SCADA", "SCADA / pump station oversight", "Operations"),
    ]
    fn_ids: dict[str, int] = {}
    for fcode, fname, area in functions_spec:
        row = (
            db.query(WorkforceCriticalFunction)
            .filter(
                WorkforceCriticalFunction.district_code == DISTRICT_CODE,
                WorkforceCriticalFunction.function_code == fcode,
            )
            .one_or_none()
        )
        if not row:
            row = WorkforceCriticalFunction(
                district_code=DISTRICT_CODE,
                function_code=fcode,
                function_name=fname,
                function_area=area,
            )
            db.add(row)
            db.flush()
        fn_ids[fcode] = row.id

    coverage_spec = [
        ("FN-TREAT", "WB-001", "primary"),
        ("FN-TREAT", "WB-002", "backup"),
        ("FN-CHEM", "WB-002", "primary"),
        ("FN-CHEM", "WB-006", "trainee"),
        ("FN-DIST", "WB-004", "primary"),
        ("FN-DIST", "WB-001", "backup"),
        ("FN-LAB", "WB-005", "primary"),
        ("FN-SCADA", "WB-003", "primary"),
        ("FN-SCADA", "WB-001", "backup"),
    ]
    for fcode, ecode, role in coverage_spec:
        exists = (
            db.query(WorkforceRoleCoverage)
            .filter(
                WorkforceRoleCoverage.district_code == DISTRICT_CODE,
                WorkforceRoleCoverage.function_code == fcode,
                WorkforceRoleCoverage.employee_code == ecode,
                WorkforceRoleCoverage.coverage_role == role,
            )
            .one_or_none()
        )
        if not exists:
            db.add(
                WorkforceRoleCoverage(
                    district_code=DISTRICT_CODE,
                    function_id=fn_ids[fcode],
                    function_code=fcode,
                    employee_id=emp_ids[ecode],
                    employee_code=ecode,
                    coverage_role=role,
                    proficiency_level="proficient" if role == "primary" else "developing",
                )
            )

    for ecode, target, readiness, notes in [
        ("WB-001", "CHIEF-OP", "6-12mo", "Strong treatment lead; SCADA cross-training underway"),
        ("WB-002", "CHIEF-OP", "12-24mo", "Central Jersey T4 exam planned spring"),
        ("WB-006", "T3-OP-1", "0-6mo", "T2 upgrading to T3; needs night-shift mentoring"),
    ]:
        exists = (
            db.query(WorkforceSuccessionCandidate)
            .filter(
                WorkforceSuccessionCandidate.district_code == DISTRICT_CODE,
                WorkforceSuccessionCandidate.employee_code == ecode,
                WorkforceSuccessionCandidate.target_position_code == target,
            )
            .one_or_none()
        )
        if not exists:
            db.add(
                WorkforceSuccessionCandidate(
                    district_code=DISTRICT_CODE,
                    employee_code=ecode,
                    employee_id=emp_ids[ecode],
                    target_position_code=target,
                    target_position_id=pos_ids.get(target),
                    readiness_level=readiness,
                    notes=notes,
                )
            )

    ceu_rows = [
        ("WB-001", "NJDEP Surface Water Treatment Review", 14.0, "technical"),
        ("WB-001", "Backflow Prevention Refresher", 4.0, "safety"),
        ("WB-002", "Chemical Feed Safety & Calibration", 8.0, "technical"),
        ("WB-004", "Distribution System Flushing Best Practices", 6.0, "technical"),
        ("WB-006", "Intro to Water Treatment Math", 10.0, "technical"),
    ]
    for ecode, title, hours, category in ceu_rows:
        exists = (
            db.query(WorkforceCeuRecord)
            .filter(
                WorkforceCeuRecord.district_code == DISTRICT_CODE,
                WorkforceCeuRecord.employee_code == ecode,
                WorkforceCeuRecord.course_title == title,
            )
            .one_or_none()
        )
        if not exists:
            db.add(
                WorkforceCeuRecord(
                    district_code=DISTRICT_CODE,
                    employee_code=ecode,
                    employee_id=emp_ids[ecode],
                    course_title=title,
                    provider="NJ Water Association / Learning Stream",
                    ceu_hours=hours,
                    completion_date=today - timedelta(days=30 if ecode != "WB-006" else 12),
                    category=category,
                )
            )

    for ecode, grade, days_to_exp in [
        ("WB-001", "T3", 95),
        ("WB-002", "T3", 210),
        ("WB-004", "W2", 55),
        ("WB-006", "T2", 40),
    ]:
        exists = (
            db.query(WorkforceCertification)
            .filter(
                WorkforceCertification.district_code == DISTRICT_CODE,
                WorkforceCertification.employee_code == ecode,
                WorkforceCertification.certification_type == "Operator",
            )
            .one_or_none()
        )
        if not exists:
            db.add(
                WorkforceCertification(
                    district_code=DISTRICT_CODE,
                    employee_code=ecode,
                    employee_id=emp_ids[ecode],
                    certification_type="Operator",
                    certification_grade=grade,
                    expiration_date=today + timedelta(days=days_to_exp),
                    issued_date=today - timedelta(days=365 * 2),
                )
            )
        else:
            exists.expiration_date = today + timedelta(days=days_to_exp)
            exists.certification_grade = grade

    return fn_ids


def _seed_tasks_and_notifications(
    db,
    *,
    admin: User,
    manager: User,
    operator: User,
    fn_ids: dict[str, int],
) -> None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    tasks_spec = [
        {
            "title": "Record SCADA alarm acknowledgement walkthrough",
            "instructions": (
                "Capture a screenshots-only tutorial: open SCADA overview, acknowledge a high-service "
                "pump alarm, and note who to call after hours. Submit for manager review."
            ),
            "status": "assigned",
            "due_days": 10,
            "fn": "FN-SCADA",
            "mode": "screenshots",
        },
        {
            "title": "Document chemical feed calibration checklist",
            "instructions": (
                "Screen-record the weekly chlorine residual probe calibration. Include PPE steps and "
                "where the logbook lives in Document Studio."
            ),
            "status": "submitted",
            "due_days": -2,
            "fn": "FN-CHEM",
            "mode": "screen",
        },
        {
            "title": "Flushing route for Wood Avenue / Route 9 corridor",
            "instructions": "Voice-narrate the flushing sequence and valve order for the Route 9 loop.",
            "status": "in_progress",
            "due_days": 5,
            "fn": "FN-DIST",
            "mode": "voice",
        },
    ]
    for spec in tasks_spec:
        exists = (
            db.query(DocumentationTask)
            .filter(
                DocumentationTask.district_code == DISTRICT_CODE,
                DocumentationTask.assignee_user_id == operator.id,
                DocumentationTask.title == spec["title"],
            )
            .one_or_none()
        )
        if exists:
            continue
        task = DocumentationTask(
            district_code=DISTRICT_CODE,
            assignee_user_id=operator.id,
            assigned_by=manager.id,
            critical_function_id=fn_ids.get(spec["fn"]),
            title=spec["title"],
            instructions=spec["instructions"],
            capture_mode=spec["mode"],
            due_at=now + timedelta(days=spec["due_days"]),
            status=spec["status"],
        )
        db.add(task)
        db.flush()
        if spec["status"] == "submitted":
            db.add(
                DocumentationTaskNote(
                    task_id=task.id,
                    author_id=operator.id,
                    body="Draft tutorial uploaded — please review calibration timestamps at 02:14.",
                    progress_pct=100,
                )
            )
            db.add(
                Notification(
                    user_id=manager.id,
                    district_code=DISTRICT_CODE,
                    category="documentation_review",
                    title="Tutorial ready for review",
                    body=f"{operator.full_name} submitted “{spec['title']}”.",
                    link_path="/continuity?tab=documentation",
                )
            )
        elif spec["status"] == "assigned":
            db.add(
                Notification(
                    user_id=operator.id,
                    district_code=DISTRICT_CODE,
                    category="documentation_task",
                    title="New documentation task",
                    body=spec["title"],
                    link_path="/dashboard",
                )
            )

    grant = (
        db.query(DocumentationGrant)
        .filter(
            DocumentationGrant.district_code == DISTRICT_CODE,
            DocumentationGrant.user_id == operator.id,
        )
        .one_or_none()
    )
    if not grant:
        db.add(
            DocumentationGrant(
                district_code=DISTRICT_CODE,
                user_id=operator.id,
                granted_by=manager.id,
                expires_at=now + timedelta(days=45),
                allowed_modes="screen,screenshots,voice",
            )
        )

    # Manager / admin situational alerts
    for user, title, body, path in [
        (
            manager,
            "Chief operator departure in ~10 months",
            "Priya Shah (Chief Operator) has a planned departure. Review succession board for WB-001 / WB-002.",
            "/continuity?tab=succession",
        ),
        (
            manager,
            "W2 certification renews in 55 days",
            "Chris Alvarez (Distribution) certification expires soon — schedule CE before the renewal window.",
            "/continuity/ceu-training?tab=ceu",
        ),
        (
            admin,
            "Funded vacancy: Maintenance Mechanic",
            "MAINT-1 is funded and vacant. Posting can be coordinated with NJ Water Workforce Coalition.",
            "/continuity",
        ),
        (
            operator,
            "T3 CE shortfall risk",
            "You have recent CE logged; confirm renewal packet is complete before the 95-day window closes.",
            "/continuity/ceu-training?tab=ceu",
        ),
    ]:
        exists = (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.title == title,
            )
            .one_or_none()
        )
        if not exists:
            db.add(
                Notification(
                    user_id=user.id,
                    district_code=DISTRICT_CODE,
                    category="workforce_alert",
                    title=title,
                    body=body,
                    link_path=path,
                )
            )


def _seed_nj_program_docs(db, *, author: User) -> None:
    try:
        from app.schemas.doc_studio import DocContentSave, DocDocumentCreate
        from app.services.doc_studio_service import DocStudioService
    except Exception as exc:
        print(f"Doc Studio seed skipped (import): {exc}")
        return

    scope = program_scope_for_state("NJ")
    svc = DocStudioService(db)
    svc.ensure_default_folders(scope, author.id)
    folders = {
        f.name: f.id
        for f in db.query(DocFolder).filter(DocFolder.scope == scope).all()
    }

    samples = [
        (
            "Program briefs",
            "Central Jersey workforce brief (sample)",
            """## Headline

Central Jersey systems (Middlesex / Monmouth / Mercer) report concentrated T3/T4 retirements within 18 months.

## By the numbers

| Measure | Value | Source |
| --- | --- | --- |
| Active CWS (NJ cache) | — | EPA SDWIS (refresh NJ) |
| Utilities in WW360 (demo) | 1 (Woodbridge) | Continuity |
| Expected openings (24 mo) | 42 | Sample program estimate |
| Candidates in training | 19 | Sample Learning Stream |

## Recommended actions

1. Open a spring T3 cohort in New Brunswick (evening hybrid).
2. Invite Woodbridge peer utilities along the Raritan corridor.
3. Pair NJDEP exam prep scholarships with employer-side succession plans.
""",
        ),
        (
            "Training & cohorts",
            "Woodbridge succession cohort plan (sample)",
            """## Cohort goal

Prepare two internal successors for Chief Operator at Township of Woodbridge Water Department.

## Participants

- Devon Blake (T3) — 6–12 month readiness
- Morgan Lee (T3) — 12–24 month readiness

## Milestones

1. SCADA shadow shifts (Q1)
2. NJDEP T4 exam registration (Q2)
3. Documented SOPs for chemical feed + high-service pumps (Document Studio)
""",
        ),
    ]
    for folder_name, title, markdown in samples:
        folder_id = folders.get(folder_name)
        exists = (
            db.query(DocDocument)
            .filter(DocDocument.scope == scope, DocDocument.title == title)
            .one_or_none()
        )
        if exists:
            continue
        if not folder_id:
            print(f"  skip doc '{title}' — folder {folder_name!r} missing")
            continue
        detail = svc.create_document(
            scope,
            DocDocumentCreate(
                folder_id=folder_id,
                title=title,
                doc_type="document",
                content_markdown=markdown,
            ),
            author.id,
        )
        svc.save_content(
            scope,
            detail.id,
            DocContentSave(content_markdown=markdown, note="NJ demo seed", force_version=True),
            author.id,
        )
        print(f"  seeded program doc: {title}")


def main() -> int:
    national_pw = os.environ.get("WW360_SEED_NATIONAL_PASSWORD", DEFAULT_NATIONAL_PASSWORD)
    nj_pw = os.environ.get("WW360_SEED_NJ_PASSWORD", DEFAULT_NJ_PASSWORD)

    init_db()
    db = SessionLocal()
    try:
        print("=== Organizations ===")
        _upsert_org(
            db,
            org_code=NY_ORG,
            name="NY Operator Workforce Works",
            state_code="NY",
            partner_label="One Water Workforce",
            section_label="New York Section AWWA",
        )
        _upsert_org(
            db,
            org_code=NJ_ORG,
            name="NJ Water Workforce Coalition",
            state_code="NJ",
            partner_label="NJ Water Workforce Coalition",
            section_label="New Jersey Section AWWA",
        )

        print("=== National admin ===")
        national = _upsert_user(
            db,
            username="ww360-national",
            email="national@waterworkforce360.org",
            full_name="Alex Morgan (National)",
            roles=["platform_admin"],
            password=national_pw,
            districts=[],
        )
        # National admin can act across orgs; memberships optional for switcher discovery
        _ensure_org_user(db, user_id=national.id, org_code=NY_ORG, role="platform_observer")
        _ensure_org_user(db, user_id=national.id, org_code=NJ_ORG, role="platform_observer")

        print("=== NJ state admin ===")
        nj_state = _upsert_user(
            db,
            username="nj-state-admin",
            email="state-admin@njwaterworkforce.org",
            full_name="Elena Vasquez",
            roles=["state_admin"],
            password=nj_pw,
            districts=[],
        )
        _ensure_org_user(db, user_id=nj_state.id, org_code=NJ_ORG, role="state_admin")

        print("=== Woodbridge district ===")
        district = (
            db.query(WaterDistrict).filter(WaterDistrict.district_code == DISTRICT_CODE).one_or_none()
        )
        if not district:
            district = WaterDistrict(
                district_code=DISTRICT_CODE,
                district_name=DISTRICT_NAME,
                state_code="NJ",
                mailing_address_line1="1 Main Street",
                mailing_address_line2="Woodbridge, NJ 07095",
                is_active=True,
            )
            db.add(district)
            print(f"Created district {DISTRICT_CODE}")
        else:
            district.district_name = DISTRICT_NAME
            district.state_code = "NJ"
            district.mailing_address_line1 = district.mailing_address_line1 or "1 Main Street"
            district.mailing_address_line2 = district.mailing_address_line2 or "Woodbridge, NJ 07095"
            district.is_active = True

        _ensure_org_district(db, org_code=NJ_ORG, district_code=DISTRICT_CODE)

        admin = _upsert_user(
            db,
            username="wb-admin",
            email="admin@woodbridge-nj.gov",
            full_name="Heather Quinn",
            roles=["district_admin", "ceu_admin"],
            password=nj_pw,
            districts=[DISTRICT_CODE],
        )
        manager = _upsert_user(
            db,
            username="wb-manager",
            email="manager@woodbridge-nj.gov",
            full_name="Marcus Delgado",
            roles=["district_manager", "ceu_manager", "workforce_manager"],
            password=nj_pw,
            districts=[DISTRICT_CODE],
        )
        operator = _upsert_user(
            db,
            username="wb-operator-1",
            email="operator@woodbridge-nj.gov",
            full_name="Devon Blake",
            roles=["ceu_user", "district_operator", "workforce_operator"],
            password=nj_pw,
            districts=[DISTRICT_CODE],
        )

        print("=== Continuity sample data ===")
        fn_ids = _seed_workforce(db, op_user_id=operator.id)
        _seed_tasks_and_notifications(
            db, admin=admin, manager=manager, operator=operator, fn_ids=fn_ids
        )

        # Link Jenny to NY org if present
        jenny = db.query(User).filter(User.username == "jingrao-aman-OWW").one_or_none()
        if jenny:
            _ensure_org_user(db, user_id=jenny.id, org_code=NY_ORG, role="state_admin")

        db.commit()

        print("=== NJ program Document Studio samples ===")
        _seed_nj_program_docs(db, author=nj_state)
        db.commit()

        print()
        print("National + NJ demo seed complete.")
        print(f"  ww360-national / {national_pw}     → national exec + state switcher")
        print(f"  nj-state-admin / {nj_pw}           → NJ executive overview")
        print(f"  wb-admin       / {nj_pw}           → Woodbridge district admin")
        print(f"  wb-manager     / {nj_pw}           → continuity + review queue")
        print(f"  wb-operator-1  / {nj_pw}           → operator home + CEU / tasks")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
