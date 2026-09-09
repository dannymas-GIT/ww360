#!/usr/bin/env python3
"""Clear Document Studio program library and seed one filled sample per template.

Usage (inside backend container or with PYTHONPATH=backend):
  python scripts/seed_doc_studio_samples.py
  python scripts/seed_doc_studio_samples.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.database import SessionLocal, init_db
from app.models.doc_document import (
    DocAsset,
    DocDocument,
    DocFolder,
    DocVersion,
    program_scope_for_state,
)
from app.models.user import User
from app.schemas.doc_studio import DocContentSave, DocDocumentCreate
from app.services.doc_studio_service import DocStudioService

# State-keyed program library (legacy ``program`` migrated to program:NY).
PROGRAM_SCOPE = program_scope_for_state("NY")

# category → default program folder name
FOLDER_BY_CATEGORY = {
    "brief": "Program briefs",
    "training": "Training & cohorts",
    "grant": "Grant reporting",
    "outreach": "Outreach",
    "operations": "Operations",
    "tutorial": "Tutorials",
}

# One mock-filled sample per gallery template (skip empty blank).
SAMPLES: list[dict[str, Any]] = [
    {
        "template_id": "regional-brief",
        "category": "brief",
        "title": "Sample — Capital Region workforce brief (Q3)",
        "publish": True,
        "extra_versions": [
            "Added SDWIS counts for Albany / Rensselaer",
            "Partner ask revised after NYRWA call",
        ],
        "markdown": """## Headline

Capital Region systems face a Grade II/III operator shortage within 24 months as retirements concentrate in Albany and Rensselaer counties.

## By the numbers

| Measure | This quarter | Change | Source |
| --- | --- | --- | --- |
| Active community water systems | 412 | +3 | EPA SDWIS |
| Systems with health-based violations | 27 | −4 | EPA SDWIS |
| Expected openings (24 mo) | 68 | +11 | Water Workforce 360 |
| Candidates in training | 34 | +8 | Learning Stream |

## Where the gaps are

- **Grade / role:** Grade II treatment and Grade III distribution are short by ~20 seats region-wide.
- **Small systems:** Towns under 3,300 population report no bench for weekend coverage.
- **Timing:** Six chief operators signal retirement before June 2027; DOH exam seats fill by February.

## Recommended actions

1. **Training** — Spring Grade II cohort in Albany (24 seats) with evening virtual modules.
2. **Outreach** — Invite 12 Capital Region utilities still outside Water Workforce 360.
3. **Partners** — Brief county EM directors on mutual-aid coverage during exam season.

> **Ask:** Approve funding for two instructor stipends so the Albany cohort can open in March.
""",
    },
    {
        "template_id": "statewide-quarterly",
        "category": "brief",
        "title": "Sample — Statewide quarterly update (FY26 Q1)",
        "publish": False,
        "extra_versions": ["Filled training + employer sections"],
        "markdown": """## Summary

Three bullets an executive can repeat in a meeting.

- Learning Stream issued 1,240 CE hours; Grade II pass rate held at 78%.
- 94 utilities now enrolled in Water Workforce 360; 41 critical-role succession plans started.
- EPA SDWIS shows health-based violations down 6% YoY in NY community systems.

## Candidate pipeline

Awareness → enrollment conversion improved after career-fair season, but certification → placement still drops hardest in Western NY where vacancies sit far from training sites.

## Training (Learning Stream)

Registrations up 12% vs last quarter. Albany Grade II filled; Binghamton waited on two seats. CE renewals for distribution operators remain the strongest fill rate.

## Employer demand (Water Workforce 360)

Utilities report 210 openings statewide; Grade III treatment and small-system operator-in-charge roles dominate. Finger Lakes systems flag succession risk on chief operator within 18 months.

## Compliance backdrop (EPA SDWIS)

Heaviest compliance pressure clusters in Southern Tier and North Country counties — those regions stay priority for the next cohort calendar.

## Next quarter

| Priority | Owner | Due |
| --- | --- | --- |
| Open Syracuse Grade II cohort | Training lead | Oct 15 |
| Enroll 20 additional utilities | Outreach | Nov 30 |
| Publish EPA Area 3 Q2 narrative | Grant team | Dec 10 |
""",
    },
    {
        "template_id": "cohort-plan",
        "category": "training",
        "title": "Sample — Albany Grade II spring cohort plan",
        "publish": True,
        "extra_versions": ["Checklist updated after venue confirm"],
        "markdown": """## Cohort overview

**Program:** Learning Stream — Grade II Treatment  
**Grade / certification:** NY Grade II  
**Region:** Capital Region  
**Target start:** March 10, 2026  
**Seats:** 24

## Who this serves

New entrants from career pipeline plus Grade I operators upgrading. Recruitment via onewaterworkforce.org, NYRWA newsletter, and enrolled Capital Region utilities.

## Schedule

| Week | Topic | Format | Instructor |
| --- | --- | --- | --- |
| 1 | Treatment fundamentals & safety | In person (Albany) | M. Chen |
| 2 | Coagulation / filtration labs | Hybrid | M. Chen |
| 3 | Disinfection & regs | Virtual | J. Ortiz |
| 4 | Exam prep & plant walk-through | In person | M. Chen |

## Readiness checklist

- [x] Learning Stream course section created
- [x] Instructors confirmed
- [x] Venue or virtual room booked
- [ ] Exam date coordinated with DOH
- [ ] Employer partners notified of expected completers

## Outcomes we'll report

Completion rate, exam pass rate, placements within 90 days, CE hours issued.
""",
    },
    {
        "template_id": "course-outline",
        "category": "training",
        "title": "Sample — Distribution CE renewal course outline",
        "publish": False,
        "extra_versions": [],
        "markdown": """## Course

**Title:** Distribution Systems CE Renewal  
**CE hours:** 7  
**Delivery:** Virtual (live) + recorded modules  
**Prerequisites:** Active NY distribution certification

## Learning objectives

By the end of this course, learners can:

1. Apply flushing and valve-exercise schedules that meet AWWA guidance.
2. Interpret residual chlorine data against state minimums.
3. Document incidents for DOH reporting without rework.

## Modules

| # | Module | Duration | Key activities |
| --- | --- | --- | --- |
| 1 | Hydraulics refresh | 90 min | Case study + quiz |
| 2 | Water quality in the pipes | 2 hr | Residual logs workshop |
| 3 | Emergency response | 90 min | Tabletop scenario |
| 4 | Reporting & CE wrap | 60 min | Forms + attestation |

## Assessment

Module quizzes (70% pass) plus a short open-book scenario mapped to Grade II/III distribution exam topics.

## Materials

LMS links, residual log template, county contact sheet, virtual lab credentials mailed 5 days prior.
""",
    },
    {
        "template_id": "tutorial",
        "category": "tutorial",
        "title": "Sample — How to enroll a utility in WW360",
        "doc_type": "tutorial",
        "publish": False,
        "extra_versions": ["Added overview for learners"],
        "markdown": """## Overview

Walkthrough for program partners who need to enroll a New York utility in Water Workforce 360 and confirm succession contacts.

## Steps

1. Open **Admin → Utilities** and search by PWSID or name.
2. Click **Invite to enroll** and choose the district admin contact.
3. Confirm the utility appears under **Enrolled** with succession roles listed.
4. Send the partner the Document Studio link for their private library.

> Tip: Record this flow with **Record tutorial** (Screenshots mode works well for click-throughs).
""",
        "tutorial_data": {
            "mode": "studio-screenshots",
            "steps": [
                {
                    "id": "s1",
                    "order": 1,
                    "title": "Find the utility",
                    "body": "Search Admin → Utilities by PWSID or name.",
                    "timestamp_seconds": 0,
                },
                {
                    "id": "s2",
                    "order": 2,
                    "title": "Send the invite",
                    "body": "Click Invite to enroll and pick the district admin contact.",
                    "timestamp_seconds": 12,
                },
                {
                    "id": "s3",
                    "order": 3,
                    "title": "Confirm enrollment",
                    "body": "Verify Enrolled status and succession roles, then share Document Studio.",
                    "timestamp_seconds": 28,
                },
            ],
        },
    },
    {
        "template_id": "epa-quarterly-narrative",
        "category": "grant",
        "title": "Sample — EPA Area 3 quarterly narrative (FY26 Q1)",
        "publish": True,
        "extra_versions": ["Measures table filled", "Barriers section tightened"],
        "markdown": """## Reporting period

**Quarter:** FY26 Q1 (Jul–Sep)  
**Prepared by:** One Water Workforce grant team  
**Date:** October 3, 2026

## Progress by task

### Task 1 — Outreach and recruitment
Twelve career events and four community-college briefings; 310 new pipeline contacts.

### Task 2 — Training delivery
Six Learning Stream sections delivered; 1,240 CE hours; Grade II pass rate 78%.

### Task 3 — Employer engagement
94 utilities enrolled; 18 placements confirmed within 90 days of certification.

### Task 4 — Evaluation and reporting
Dashboards refreshed weekly; mid-quarter learning review with DOH and NYRWA.

## Output measures

| Measure | Target | This quarter | Cumulative |
| --- | --- | --- | --- |
| Learners served | 200 | 186 | 412 |
| CE hours issued | 1,000 | 1,240 | 2,610 |
| Utilities enrolled | 80 | 94 | 94 |
| Placements (90 days) | 25 | 18 | 41 |

## Barriers and adjustments

Rural travel time limited in-person attendance in the North Country. We added two virtual exam-prep sessions and will co-locate the next cohort with an existing NYRWA training day.

## Next period

Deliver Syracuse Grade II cohort, publish partner newsletter, and submit mid-year measures package.
""",
    },
    {
        "template_id": "success-story",
        "category": "grant",
        "title": "Sample — Success story: Maria from Rensselaer County",
        "publish": False,
        "extra_versions": [],
        "markdown": """## Title

From career fair to Grade II operator in nine months

## The person

Maria Lopez works at a small Rensselaer County water district. She joined a One Water Workforce career fair looking for a path that stayed local and served her community.

## The challenge

She held no treatment certification and could not leave her shift for a full-time program. Exam fees and travel to Albany were the other blockers.

## What the program did

Evening Grade II hybrid cohort, mentor match with a neighboring utility, and a scholarship covering exam fees and two weeks of study leave.

## The outcome

Maria earned Grade II on the first attempt and moved into the operator-in-charge rotation. The district reports full weekend coverage for the first time in two years.

> "I didn't think water was a career until someone showed me the ladder — and stayed with me through the exam."

*Photo and consent on file: yes*
""",
    },
    {
        "template_id": "utility-invitation",
        "category": "outreach",
        "title": "Sample — Invitation: Village of Hudson Falls",
        "publish": False,
        "extra_versions": ["Personalized opening paragraph"],
        "markdown": """Dear Superintendent Hale,

## Why we're writing

New York's operator shortage is already showing up in systems your size — longer overtime, delayed retirements, and hard-to-fill Grade II seats. Hudson Falls does not have to navigate that alone.

## What Water Workforce 360 gives you

- A view of certified candidates coming out of training in your region
- Succession and retirement risk tools for your critical roles
- Direct access to Learning Stream cohorts and CE renewals

## What we ask

A short enrollment form: current positions, expected retirements, training needs. Utility records stay utility-owned; you choose what partners can see.

## How to join

Reply to this note or book a 20-minute walkthrough at onewaterworkforce.org/enroll. We can complete enrollment before your next board meeting.

With appreciation,

Jenny Ingrao  
One Water Workforce
""",
    },
    {
        "template_id": "newsletter",
        "category": "outreach",
        "title": "Sample — Partner newsletter (September)",
        "publish": True,
        "extra_versions": [],
        "markdown": """## This month

Albany's Grade II cohort filled two weeks early, and 18 newly certified operators found placements within 90 days. We're opening a Syracuse section next — seats are limited for small-system staff.

## Training calendar

| Date | Course | Region | Seats left |
| --- | --- | --- | --- |
| Oct 8 | Distribution CE renewal | Statewide virtual | 14 |
| Oct 22 | Grade II exam prep | Albany | 6 |
| Nov 5 | Grade II treatment cohort | Syracuse | 18 |

## Utility spotlight

Town of Bethlehem published a succession plan for three critical roles and is mentoring two Grade I operators toward Grade II this winter.

## Career pipeline

420 new members joined onewaterworkforce.org after September career events. Next DOH exam window opens November 12.

## Dates to know

- Oct 15 — Syracuse cohort registration closes
- Nov 1 — EPA Area 3 measures draft due internally
- Nov 12 — DOH Grade II exam window opens
""",
    },
    {
        "template_id": "job-profile",
        "category": "outreach",
        "title": "Sample — Job profile: Grade II Treatment Operator",
        "publish": False,
        "extra_versions": [],
        "markdown": """## Role

**Title:** Grade II Treatment Operator  
**Utility / region:** Capital Region municipal utility  
**Grade required:** NY Grade II (or eligibility to sit within 12 months)  
**Pay range:** $28–$36 / hour + benefits

## What you'll do

Operate and monitor filtration and disinfection processes that keep drinking water safe for roughly 18,000 residents. Daily rounds, sample collection, residual logs, and weekend rotation shared with a three-person team.

## What you need

- Certification or eligibility to sit the Grade II exam
- Valid driver's license; ability to lift 40 lb; on-call rotation
- Comfort with SCADA basics preferred

## Career path

Grade II → lead operator → chief operator. One Water Workforce supports CE renewals and Grade III upgrade cohorts.

## How to apply

Send resume to careers@example-utility.ny.gov by October 31, or apply through onewaterworkforce.org/jobs.
""",
    },
    {
        "template_id": "succession-memo",
        "category": "operations",
        "title": "Sample — Succession memo: Chief Operator (Finger Lakes)",
        "publish": False,
        "extra_versions": ["Candidate bench updated"],
        "markdown": """## Role at risk

**Position:** Chief Operator  
**Incumbent retirement / exit window:** Q2 2027  
**Certification held:** Grade III Treatment

## Why it matters

Without a ready Grade III, the plant cannot maintain continuous compliance coverage; mutual aid would be required within 30 days of vacancy.

## Candidate bench

| Candidate | Current grade | Gap to role | Ready by |
| --- | --- | --- | --- |
| A. Patel | Grade II | Grade III + 6 mo lead time | Mar 2027 |
| L. Brooks | Grade II | Grade III exam + mentoring | Jun 2027 |

## Plan

1. **Knowledge capture** — SOP walk-throughs and recorded plant tutorials this quarter.
2. **Training** — Enroll Patel in winter Grade III cohort; Brooks follows in spring.
3. **Coverage** — Neighboring utility mutual-aid letter drafted if window closes early.

## Decisions needed

- Approve overtime for dual-coverage during exam week
- Confirm board briefing date for succession plan
""",
    },
    {
        "template_id": "meeting-notes",
        "category": "operations",
        "title": "Sample — Meeting notes: Training calendar sync",
        "publish": False,
        "extra_versions": [],
        "markdown": """## Meeting notes

**Date:** September 4, 2026  
**Attendees:** Jenny Ingrao, Training lead, NYRWA liaison, DOH observer

### Agenda
1. Spring cohort venues
2. Exam seat coordination
3. Newsletter deadlines

### Decisions
- Albany Grade II opens March 10 with 24 seats
- Syracuse waits on venue contract before marketing

### Action items
- [ ] Training lead — confirm Albany venue deposit, due Sep 12
- [ ] Outreach — draft Syracuse save-the-date, due Sep 18
- [ ] Grant team — pull Q1 measures draft, due Sep 20
""",
    },
    {
        "template_id": "sop",
        "category": "operations",
        "title": "Sample — SOP: Weekly distribution flushing check",
        "publish": False,
        "extra_versions": ["Safety notes expanded"],
        "markdown": """## Purpose

Ensure dead-end mains are flushed on schedule so residual chlorine stays within state minimums and customer complaints stay low.

## Scope

Applies to all Grade I–III distribution operators on the weekly rotation for community systems enrolled in the program's sample library.

## Responsibilities

| Role | Responsibility |
| --- | --- |
| Operator | Execute flush list and log residuals |
| Supervisor | Review logs weekly and escalate excursions |

## Procedure

1. **Preparation** — Review hydrant list, traffic cones, PPE, and residual kit calibration.
2. **Execution** — Open hydrant to clear water, measure residual, record flow time and appearance.
3. **Completion** — Close hydrant, enter log in SCADA/app, notify supervisor of any residual below minimum.

## Safety notes

> **Important:** Wear eye protection and high-visibility gear. Never stand directly in front of an open hydrant. Call supervisor before flushing near schools during arrival/dismissal.
""",
    },
]


def _folder_map(svc: DocStudioService, user_id: int | None) -> dict[str, str]:
    svc.ensure_default_folders(PROGRAM_SCOPE, user_id)
    folders = {
        f.name: f.id
        for f in svc.db.query(DocFolder).filter(DocFolder.scope == PROGRAM_SCOPE).all()
    }
    # Belt-and-suspenders: create any category folder still missing after ensure.
    needed = sorted(set(FOLDER_BY_CATEGORY.values()))
    for name in needed:
        if name in folders:
            continue
        folder = DocFolder(
            scope=PROGRAM_SCOPE,
            name=name,
            description=f"{name} (seeded)",
            sort_order=len(folders),
            is_system=True,
            created_by=user_id,
        )
        svc.db.add(folder)
        svc.db.commit()
        svc.db.refresh(folder)
        folders[name] = folder.id
        print(f"  created folder {name!r}")
    return folders


def _clear_program_docs(db) -> int:
    docs = db.query(DocDocument).filter(DocDocument.scope == PROGRAM_SCOPE).all()
    n = len(docs)
    for d in docs:
        db.query(DocAsset).filter(DocAsset.document_id == d.id).delete(synchronize_session=False)
        db.query(DocVersion).filter(DocVersion.document_id == d.id).delete(synchronize_session=False)
        db.delete(d)
    db.commit()
    return n


def seed(dry_run: bool = False) -> None:
    init_db()
    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .filter(User.username.in_(["jenny-oww", "jingrao-aman-OWW"]))
            .one_or_none()
        )
        user_id = user.id if user else None
        svc = DocStudioService(db)

        if dry_run:
            print(f"[dry-run] would delete program docs and create {len(SAMPLES)} samples")
            for s in SAMPLES:
                print(f"  - {s['title']} → {FOLDER_BY_CATEGORY[s['category']]}")
            return

        deleted = _clear_program_docs(db)
        print(f"Cleared {deleted} program document(s)")

        folders = _folder_map(svc, user_id)
        created = 0
        for sample in SAMPLES:
            folder_name = FOLDER_BY_CATEGORY[sample["category"]]
            folder_id = folders.get(folder_name)
            if not folder_id:
                print(f"! missing folder {folder_name!r}; creating unfiled")
            detail = svc.create_document(
                PROGRAM_SCOPE,
                DocDocumentCreate(
                    title=sample["title"],
                    folder_id=folder_id,
                    template_id=sample["template_id"],
                    doc_type=sample.get("doc_type", "document"),
                    content_markdown=sample["markdown"],
                    tutorial_data=sample.get("tutorial_data"),
                    tags=["sample", sample["template_id"]],
                    summary=f"Filled sample of the {sample['template_id']} template",
                ),
                user_id,
            )
            markdown = sample["markdown"]
            for note in sample.get("extra_versions") or []:
                markdown = f"{markdown.rstrip()}\n\n> _{note}_\n"
                detail = svc.save_content(
                    PROGRAM_SCOPE,
                    detail.id,
                    DocContentSave(
                        content_markdown=markdown,
                        autosave=False,
                        note=note,
                        tutorial_data=sample.get("tutorial_data"),
                    ),
                    user_id,
                )
            if sample.get("publish"):
                detail = svc.publish(PROGRAM_SCOPE, detail.id, user_id)
            created += 1
            print(
                f"  + {detail.title}  [{detail.status} v{detail.version_no}]  folder={folder_name}"
            )

        print(f"Seeded {created} sample document(s) into program library")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    seed(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
