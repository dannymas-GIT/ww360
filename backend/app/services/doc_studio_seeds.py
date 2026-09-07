"""Default folders + sample documents for Document Studio libraries.

Program scope keeps the OWW partner library. District scopes get a utility
folder tree and sample docs (manager + operator starters) on first access.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TypedDict

PROGRAM_SCOPE = "program"
LIBRARY_SEED_TAG = "library_seed"


class SeedDoc(TypedDict):
    template_id: str
    folder: str
    title: str
    markdown: str
    doc_type: str


DEFAULT_PROGRAM_FOLDERS: Sequence[tuple[str, str]] = (
    ("Program briefs", "Regional and statewide workforce briefs — the picture partners and funders need."),
    ("Training & cohorts", "Cohort plans, course outlines and Learning Stream delivery."),
    ("Grant reporting", "EPA Area 3 narratives, success stories and measure write-ups."),
    ("Outreach", "Utility invitations, newsletters, job profiles and career-pipeline messaging."),
    ("Operations", "SOPs, succession memos, meeting notes and day-to-day procedures."),
    ("Tutorials", "Recorded walkthroughs and step-by-step guides from Tutorial Studio."),
    ("Templates", "Blank starters — copy into a working folder before editing."),
)

DEFAULT_DISTRICT_FOLDERS: Sequence[tuple[str, str]] = (
    ("Workforce & succession", "Staffing briefs, succession memos and board workforce updates."),
    ("Training & CE", "Annual CE plans, onboarding checklists and course outlines."),
    ("Operations", "SOPs, meeting notes and day-to-day procedures."),
    ("Compliance", "Monthly checklists, emergency playbooks and incident reports."),
    ("Shift logs", "Handoffs, rounds and equipment checks for operators."),
    ("Tutorials", "Recorded walkthroughs and documentation-task write-ups."),
    ("Templates", "Blank starters — copy into a working folder before editing."),
)


def folders_for_scope(scope: str) -> Sequence[tuple[str, str]]:
    if scope == PROGRAM_SCOPE:
        return DEFAULT_PROGRAM_FOLDERS
    return DEFAULT_DISTRICT_FOLDERS


# Sample docs for every utility library (managers + operators share the scope).
DISTRICT_SEED_DOCS: Sequence[SeedDoc] = (
    {
        "template_id": "util-staffing-brief",
        "folder": "Workforce & succession",
        "title": "Sample — Utility staffing brief",
        "doc_type": "document",
        "markdown": """## Utility staffing brief

**Utility / PWSID:** Hudson Falls Water District (demo)  
**Prepared by:** District manager  
**Date:** (edit me)

## Headcount by role

| Role / grade | Filled | Vacant | Expected exits (24 mo) |
| --- | --- | --- | --- |
| Chief / Grade IA | 1 | 0 | 0 |
| Operator | 2 | 1 | 1 |
| Lab / other | 0 | 0 | 0 |

## Certification gaps

One Grade II vacancy; one operator within 18 months of retirement.

## Near-term risks

Single-person coverage on weekends; limited bench for chief operator duties.

## Actions

1. **Recruit / promote** — post Grade II opening; identify internal upgrade candidate.
2. **Train / CE** — schedule exam prep before retirement window.
3. **Document** — record filter backwash SOP tutorial before exit.

> **Ask:** board approval to backfill vacancy in next budget cycle.
""",
    },
    {
        "template_id": "util-ceu-plan",
        "folder": "Training & CE",
        "title": "Sample — Annual CE & training plan",
        "doc_type": "document",
        "markdown": """## Annual CE & training plan

**Calendar year:** (current)  
**Utility:** Hudson Falls Water District (demo)

## Operator roster

| Operator | Grade | CE due | Hours needed | Planned courses |
| --- | --- | --- | --- | --- |
| Operator 1 | II | Dec | 10 | Distribution refresh |
| Operator 2 | I | Jun | 5 | Safety / chlorine |

## Priority courses

| Course | Provider | Target attendees | Window |
| --- | --- | --- | --- |
| Distribution basics | Learning Stream | Both operators | Q2 |

## Budget & coverage

Cross-cover shifts; avoid both operators off-site same week.

## Tracking

- [ ] Hours logged in Learning Stream / WW360
- [ ] Certificates filed
- [ ] Renewals confirmed with DOH
""",
    },
    {
        "template_id": "util-compliance-checklist",
        "folder": "Compliance",
        "title": "Sample — Monthly compliance checklist",
        "doc_type": "document",
        "markdown": """## Monthly compliance checklist

**Month:** (edit)  
**Completed by:**  

### Sampling & lab
- [ ] Routine samples collected and shipped
- [ ] Results reviewed and filed
- [ ] Any detects escalated

### Reporting
- [ ] Monthly operating report submitted
- [ ] Consumer / public notices current (if applicable)

### Plant & records
- [ ] Log books reviewed
- [ ] Chemical deliveries documented
- [ ] Calibration / maintenance due items closed

### Notes
Demo checklist — replace with your utility's recurring requirements.
""",
    },
    {
        "template_id": "util-emergency-ops",
        "folder": "Compliance",
        "title": "Sample — Emergency / after-hours playbook",
        "doc_type": "document",
        "markdown": """## Emergency / after-hours playbook

**System:** Hudson Falls Water District (demo)  
**Last reviewed:** (edit)

## When this applies

Power loss, main break, boil-water, chemical alarm, security, other.

## Immediate actions

1. Ensure personal safety.
2. Stabilize the process if trained to do so.
3. Notify the on-call supervisor.

## Call tree

| Role | Name | Phone |
| --- | --- | --- |
| On-call supervisor | | |
| Chief operator | | |
| Utility manager | | |
| DOH / county (if required) | | |

## Documentation

- [ ] Time of event and who responded
- [ ] Actions taken
- [ ] Customers / regulators notified (if any)
- [ ] Follow-up work order created
""",
    },
    {
        "template_id": "sop",
        "folder": "Operations",
        "title": "Sample — Filter backwash SOP",
        "doc_type": "document",
        "markdown": """## Purpose

Restore filter headloss and effluent quality after a normal run.

## Scope

Operators trained on filter gallery controls at this plant.

## Responsibilities

| Role | Responsibility |
| --- | --- |
| Operator | Execute steps and log readings |
| Supervisor | Review outliers and approve procedure updates |

## Procedure

1. **Preparation** — confirm spare filter online; PPE and isolation ready.
2. **Execution** — initiate backwash sequence per control panel; watch waste turbidity.
3. **Completion** — return filter to service; log start/stop and notes.

## Safety notes

> **Important:** never leave a filter isolated without notifying the next shift.
""",
    },
    {
        "template_id": "op-shift-handoff",
        "folder": "Shift logs",
        "title": "Sample — Shift handoff notes",
        "doc_type": "document",
        "markdown": """## Shift handoff

**From:** Day operator  
**To:** Night operator  
**Date / shift:** (demo)

## Plant status

Filters stable; clearwell mid-range; no active boil-water order.

## Alarms & issues this shift

| Time | Alarm / issue | Cleared? | Notes |
| --- | --- | --- | --- |
| 14:10 | High turbidity filter 2 | Yes | Brief spike after rate change |

## Work in progress

- Chemical tote delivery expected tomorrow AM

## Samples / chemical adds

- Free Cl2 residual checked at 15:00 — in range

## For the next operator

- [ ] Watch filter 2 headloss overnight
""",
    },
    {
        "template_id": "op-rounds-log",
        "folder": "Shift logs",
        "title": "Sample — Daily rounds log",
        "doc_type": "document",
        "markdown": """## Daily rounds

**Operator:** (demo)  
**Date / shift:**  

| Station / check | Reading / status | OK? | Action |
| --- | --- | --- | --- |
| Clearwell level | Mid | Yes | |
| Filters | Online | Yes | |
| High service pumps | 1 duty / 1 standby | Yes | |
| Chlorine residual | In range | Yes | |
| Generator / SCADA | Normal | Yes | |

## Notes

Replace readings with your plant's round sheet.
""",
    },
    {
        "template_id": "op-documentation-task",
        "folder": "Tutorials",
        "title": "Sample — Documentation task write-up",
        "doc_type": "document",
        "markdown": """## Documentation task

**Task / procedure:** Chemical tote change-out  
**Assigned by:** District manager  
**Due:** (demo)

## Why this matters

Incorrect change-out risks underfeed and safety exposure for the next shift.

## Steps (as performed)

1. Verify remaining volume and isolate feed.
2. Don PPE; disconnect and swap tote per SOP.
3. Prime line; confirm residual; log tote number.

## Tips & gotchas

- Confirm secondary containment before cracking fittings.

## Attachments / recording

- [ ] Tutorial recorded in Document Studio
- [ ] Photos or diagrams attached

## Ready for review

- [ ] Draft complete — notify manager
""",
    },
    {
        "template_id": "util-onboarding",
        "folder": "Training & CE",
        "title": "Sample — New hire onboarding checklist",
        "doc_type": "document",
        "markdown": """## New hire onboarding

**Name:** (new operator)  
**Role / grade track:** Grade I trainee  
**Start date:**  
**Buddy / mentor:**  

### Day 1
- [ ] Badges, keys, PPE issued
- [ ] Safety orientation
- [ ] Intro to plant layout and emergency exits
- [ ] WW360 / Learning Stream login

### Week 1
- [ ] Shadow shift handoff
- [ ] Read critical SOPs (list below)
- [ ] Meet lab, distribution, admin contacts

### Month 1
- [ ] Complete assigned tutorials
- [ ] Sit exam prep plan (if upgrading)
- [ ] 30-day check-in with supervisor

### Critical SOPs to read
1. Filter backwash
2. Emergency / after-hours playbook
3. Chemical tote change-out
""",
    },
    {
        "template_id": "util-board-update",
        "folder": "Workforce & succession",
        "title": "Sample — Board workforce update",
        "doc_type": "document",
        "markdown": """## Workforce update for the board

**Period:** (demo quarter)  
**Prepared by:** District manager  

## Status in one paragraph

Two operators on staff, one Grade II vacancy posted, CE plan on track for renewals this year.

## Risks

Weekend single coverage; retirement window within 18 months on one seat.

## What we did this period

- Posted vacancy and began screening
- Started documentation tasks for critical SOPs

## What we need

Authorization to fill the Grade II role and budget for exam prep coursework.
""",
    },
)

PROGRAM_SEED_DOCS: Sequence[SeedDoc] = (
    {
        "template_id": "regional-brief",
        "folder": "Program briefs",
        "title": "Sample — Regional workforce brief",
        "doc_type": "document",
        "markdown": """## Headline

North Country systems need Grade II operators faster than training currently delivers.

## By the numbers

| Measure | This quarter | Change | Source |
| --- | --- | --- | --- |
| Active community water systems | (live) | | EPA SDWIS |
| Systems with health-based violations | (live) | | EPA SDWIS |
| Expected openings (24 mo) | (sample) | | Water Workforce 360 |
| Candidates in training | (sample) | | Learning Stream |

## Where the gaps are

- **Grade / role:** Grade II short in rural counties.
- **Small systems:** mutual aid and shared operators under discussion.
- **Timing:** spring exam window is the next milestone.

## Recommended actions

1. **Training** — fill the next regional cohort.
2. **Outreach** — invite three utilities still off-platform.
3. **Partners** — brief county EM on placement targets.

> **Ask:** prioritize travel stipends for the next cohort.
""",
    },
)


def seed_docs_for_scope(scope: str) -> Sequence[SeedDoc]:
    if scope == PROGRAM_SCOPE:
        return PROGRAM_SEED_DOCS
    return DISTRICT_SEED_DOCS
