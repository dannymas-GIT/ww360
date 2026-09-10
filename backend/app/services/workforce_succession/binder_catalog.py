"""Succession Binder + CEU Tracker pack section catalog.

Maps NY REDC-style utility profiles to Document Studio sections. Markdown lives
here so pack generation does not depend on the frontend template gallery.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

BinderProfile = Literal["small_system", "multi_plant", "district_trainees"]
PackType = Literal["succession_binder", "ceu_tracker_pack"]

WORKFORCE_ROOT_FOLDER = "Workforce & succession"
TRAINING_CE_FOLDER = "Training & CE"
SUCCESSION_BINDER_FOLDER = "Succession Binder"

BINDER_TAG = "workforce_binder"
CEU_PACK_TAG = "ceu_tracker_pack"


@dataclass(frozen=True)
class BinderSection:
    section_id: str
    title: str
    template_id: str
    markdown: str
    optional_for: frozenset[BinderProfile] = frozenset()


def _cover_md() -> str:
    return """# Succession Binder

**Utility:** {{utility_name}}  
**District code:** {{district_code}}  
**Prepared by:** {{contact_name}}  
**Contact:** {{contact_email}}  
**Last updated:** {{generated_date}}

## Purpose

This binder documents critical roles, backup coverage, retirement risk, succession candidates, and knowledge transfer plans for your utility. Review it when roles change, before board meetings, and after retirements or promotions.

{{operations_summary}}

## Sections

{{section_links}}

## Custody & backup

When this binder is complete, **export PDFs or transfer custody** to your utility's cloud storage (OneDrive, SharePoint, Google Drive). Water Workforce 360 is an authoring tool — **your organization owns long-term backup and retention** after transfer.

> WW360 is not your system of record once custody is transferred.
"""


def _critical_roles_md() -> str:
    return """## Critical roles & backups

**Utility:** {{utility_name}}  
**As of:** {{generated_date}}

### Role coverage

{{coverage_table}}

### Gaps to address

- Functions without a qualified backup
- Single points of failure on weekends or leave
- Cross-training needed before retirement windows
"""


def _retirement_md() -> str:
    return """## Retirement & risk snapshot

**Utility:** {{utility_name}}  
**As of:** {{generated_date}}

### Employees within 24 months of retirement eligibility

{{retirement_table}}

### Certification cliff (next 90 days)

{{cert_cliff_table}}

### Actions

1. Confirm exit windows with incumbents
2. Accelerate bench readiness for at-risk roles
3. Schedule knowledge capture before departures
"""


def _bench_md() -> str:
    return """## Succession candidates

**Utility:** {{utility_name}}  
**As of:** {{generated_date}}

| Candidate | Target role | Readiness | Target date | Notes |
| --- | --- | --- | --- | --- |
{{succession_rows}}

## Plan

1. **Knowledge capture** — SOPs, walk-throughs, recorded tutorials
2. **Training** — courses and exam timeline for lead candidates
3. **Coverage** — interim arrangement if the window closes early
"""


def _knowledge_md() -> str:
    return """## Knowledge transfer checklist

**Utility:** {{utility_name}}

### Before any planned exit

- [ ] Critical SOPs reviewed and current
- [ ] Operator walk-through recorded (filter, disinfection, distribution)
- [ ] SCADA / control procedures documented
- [ ] Vendor and emergency contacts updated
- [ ] Regulatory reporting responsibilities mapped

### Artifacts on file

{{knowledge_table}}

### Sign-off

| Role | Name | Date |
| --- | --- | --- |
| Chief / supervisor | | |
| Successor / trainee | | |
"""


def _signoff_md() -> str:
    return """## Review & sign-off

**Utility:** {{utility_name}}  
**Review date:** {{generated_date}}

This succession binder was reviewed by utility leadership. Updates are required when roles, certifications, or backup coverage change.

| Reviewer | Title | Signature / date |
| --- | --- | --- |
| | District manager | |
| | Chief operator | |
| | Board liaison (if applicable) | |

### Next review due

- [ ] Annual board update scheduled
- [ ] Post-retirement review within 30 days of exit
"""


def _multi_plant_md() -> str:
    return """## Multi-plant coverage matrix

**Utility:** {{utility_name}}

| Plant / site | Primary operator | Backup | Trainee | Notes |
| --- | --- | --- | --- | --- |
| Main plant | | | | |
| Remote site | | | | |

### Mutual aid / contract coverage

Document interim arrangements if internal backup is insufficient.
"""


def _trainee_md() -> str:
    return """## Trainee pathway

**Utility:** {{utility_name}}

| Trainee | Current grade | Target grade | Mentor | Exam / course timeline |
| --- | --- | --- | --- | --- |
| | | | | |

### Milestones

- [ ] Grade exam scheduled
- [ ] Required CE hours on track
- [ ] Shadowing hours logged
- [ ] Ready for promotion decision
"""


def _board_md() -> str:
    return """## Board / council workforce update

**Utility:** {{utility_name}}  
**Meeting date:** (edit)

### Headline

One paragraph on staffing, succession, and certification status.

### Asks

- Budget for vacancy backfill
- Training approval
- Policy decisions needed

### Metrics

- Vacant positions: {{vacant_positions}}
- Retirement-eligible (24 mo): {{retirement_24mo}}
- CEU shortfalls: {{ceu_shortfall_count}}
"""


def _ceu_tracker_md() -> str:
    return """## CEU Tracker — {{pack_label}}

**Utility:** {{utility_name}}  
**Generated:** {{generated_date}}  
**Prepared by:** {{contact_name}}

### Operator renewal status

| Operator | Grade | Cycle end | Required hr | Earned hr | Remaining | Status |
| --- | --- | --- | --- | --- | --- | --- |
{{ceu_rows}}

### Certification cliff (90 days)

{{cert_cliff_table}}

### DOH-352

Generate renewal packages from **CEU & Training → Certifications** when operators are ready. Attach voucher PDFs to each operator record before filing.

> This pack is a **point-in-time snapshot**. Refresh each cycle or before board / DOH filing.
"""


def _ceu_plan_md() -> str:
    return """## Annual CE & training plan

**Calendar year:** {{calendar_year}}  
**Utility:** {{utility_name}}

## Operator roster

| Operator | Grade | CE due | Hours needed | Planned courses |
| --- | --- | --- | --- | --- |
{{ceu_plan_rows}}

## Priority courses

| Course | Provider | Target attendees | Window |
| --- | --- | --- | --- |
| | Learning Stream | | |

## Tracking

- [ ] Hours logged in WW360 / Learning Stream
- [ ] Certificates filed
- [ ] Renewals confirmed with DOH
"""


BASE_SECTIONS: tuple[BinderSection, ...] = (
    BinderSection("cover", "Succession Binder — Cover", "binder-cover", _cover_md()),
    BinderSection(
        "critical_roles",
        "Critical roles & backups",
        "critical-roles-coverage",
        _critical_roles_md(),
    ),
    BinderSection(
        "retirement_risk",
        "Retirement & risk snapshot",
        "retirement-risk-snapshot",
        _retirement_md(),
    ),
    BinderSection(
        "succession_bench",
        "Succession candidates",
        "succession-memo",
        _bench_md(),
    ),
    BinderSection(
        "knowledge_transfer",
        "Knowledge transfer checklist",
        "knowledge-transfer-checklist",
        _knowledge_md(),
    ),
    BinderSection(
        "signoff",
        "Review & sign-off",
        "binder-signoff",
        _signoff_md(),
    ),
)

OPTIONAL_SECTIONS: tuple[BinderSection, ...] = (
    BinderSection(
        "multi_plant_matrix",
        "Multi-plant coverage matrix",
        "multi-plant-matrix",
        _multi_plant_md(),
        optional_for=frozenset({"multi_plant"}),
    ),
    BinderSection(
        "trainee_pathway",
        "Trainee pathway",
        "trainee-pathway",
        _trainee_md(),
        optional_for=frozenset({"district_trainees", "multi_plant"}),
    ),
    BinderSection(
        "board_one_pager",
        "Board workforce update",
        "util-board-update",
        _board_md(),
        optional_for=frozenset({"multi_plant", "district_trainees"}),
    ),
)

CEU_SECTIONS: tuple[BinderSection, ...] = (
    BinderSection(
        "ceu_tracker",
        "CEU Tracker snapshot",
        "ceu-tracker-snapshot",
        _ceu_tracker_md(),
    ),
    BinderSection(
        "ceu_plan",
        "Annual CE & training plan",
        "util-ceu-plan",
        _ceu_plan_md(),
    ),
)


def sections_for_profile(profile: BinderProfile) -> list[BinderSection]:
    out = list(BASE_SECTIONS)
    for section in OPTIONAL_SECTIONS:
        if profile in section.optional_for:
            out.append(section)
    return out


PROFILE_LABELS: dict[BinderProfile, str] = {
    "small_system": "Small system (single plant)",
    "multi_plant": "Multi-plant utility",
    "district_trainees": "District with trainees",
}
