/**
 * Document Studio templates — starting points by role audience.
 *
 * Markdown round-trips through tiptap-markdown: headings, lists, task lists,
 * quotes, pipe tables and horizontal rules only.
 *
 * Audiences
 * ---------
 * - program  — OWW partners / platform admins (statewide library)
 * - district — utility managers / district admins
 * - operator — plant operators & CE users
 */

export type StudioTemplateAudience = 'program' | 'district' | 'operator';

export type StudioTemplateCategory =
  | 'brief'
  | 'training'
  | 'grant'
  | 'outreach'
  | 'operations'
  | 'compliance'
  | 'shift';

export interface StudioTemplate {
  id: string;
  name: string;
  description: string;
  category: StudioTemplateCategory;
  /** Who sees this in New document / insert-template. */
  audiences: StudioTemplateAudience[];
  /** Short line shown under the name in the gallery. */
  preview: string;
  markdown: string;
}

export const STUDIO_TEMPLATE_CATEGORIES: Record<StudioTemplateCategory, string> = {
  brief: 'Briefs & updates',
  training: 'Training & CE',
  grant: 'Grant reporting',
  outreach: 'Outreach',
  operations: 'Operations',
  compliance: 'Compliance',
  shift: 'Shift & plant floor',
};

export const CATEGORY_ORDER: StudioTemplateCategory[] = [
  'brief',
  'training',
  'grant',
  'outreach',
  'operations',
  'compliance',
  'shift',
];

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  // ── Shared ──────────────────────────────────────────────────────────────
  {
    id: 'blank',
    name: 'Blank document',
    description: 'Start from an empty page.',
    category: 'operations',
    audiences: ['program', 'district', 'operator'],
    preview: 'Type / for headings, lists, tables and more',
    markdown: '',
  },
  {
    id: 'tutorial',
    name: 'Tutorial (blank)',
    description: 'Empty shell for a step-by-step tutorial — record or attach steps later.',
    category: 'training',
    audiences: ['program', 'district', 'operator'],
    preview: 'Record a walkthrough or build steps manually',
    markdown: `## Overview

Brief intro learners see before step one.

## Steps

Use **Record tutorial** in the header to capture a walkthrough, or write steps here.
`,
  },
  {
    id: 'sop',
    name: 'Standard operating procedure',
    description: 'Purpose, scope, responsibilities and numbered steps.',
    category: 'operations',
    audiences: ['program', 'district', 'operator'],
    preview: 'SOP layout with safety notes',
    markdown: `## Purpose

Why this procedure exists.

## Scope

Who and what this SOP applies to.

## Responsibilities

| Role | Responsibility |
| --- | --- |
| Operator | Daily execution |
| Supervisor | Review and approval |

## Procedure

1. **Preparation** — prerequisites and safety checks.
2. **Execution** — step-by-step instructions.
3. **Completion** — verification and documentation.

## Safety notes

> **Important:** critical safety considerations.
`,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting notes',
    description: 'Attendees, decisions and action items.',
    category: 'operations',
    audiences: ['program', 'district', 'operator'],
    preview: 'Attendees + decisions + actions',
    markdown: `## Meeting notes

**Date:**  
**Attendees:**  

### Agenda
1. 
2. 

### Decisions
- 

### Action items
- [ ] Owner — action, due date
`,
  },

  // ── Program (OWW / platform) ────────────────────────────────────────────
  {
    id: 'regional-brief',
    name: 'Regional workforce brief',
    description: 'One-page picture of supply, demand and risk for a New York region.',
    category: 'brief',
    audiences: ['program'],
    preview: 'Headline → numbers → gaps → asks',
    markdown: `## Headline

One sentence on the region's workforce position this quarter.

## By the numbers

| Measure | This quarter | Change | Source |
| --- | --- | --- | --- |
| Active community water systems | | | EPA SDWIS |
| Systems with health-based violations | | | EPA SDWIS |
| Expected openings (24 mo) | | | Water Workforce 360 |
| Candidates in training | | | Learning Stream |

## Where the gaps are

- **Grade / role:** which certifications are short and by how much.
- **Small systems:** what rural utilities are telling us.
- **Timing:** retirements or exams that make the gap urgent.

## Recommended actions

1. **Training** — cohort or bootcamp to schedule, and where.
2. **Outreach** — utilities to invite, career pipeline messaging.
3. **Partners** — who needs to hear this (DOH, NYRWA, county EMs).

> **Ask:** the single decision or resource this brief needs from its reader.
`,
  },
  {
    id: 'statewide-quarterly',
    name: 'Statewide quarterly update',
    description: 'Executive update across all four sources for partners and funders.',
    category: 'brief',
    audiences: ['program'],
    preview: 'Pipeline → training → employers → compliance backdrop',
    markdown: `## Summary

Three bullets an executive can repeat in a meeting.

- 
- 
- 

## Candidate pipeline

Movement between awareness, enrollment, certification and placement. Call out the biggest drop-off.

## Training (Learning Stream)

Registrations, attendance, CE hours, fill rate and waitlists — what filled, what didn't, what's next.

## Employer demand (Water Workforce 360)

Vacancies, retirements and succession risk reported by utilities, by region and grade.

## Compliance backdrop (EPA SDWIS)

Counties with the heaviest compliance pressure and how that shapes where we place effort.

## Next quarter

| Priority | Owner | Due |
| --- | --- | --- |
| | | |
`,
  },
  {
    id: 'cohort-plan',
    name: 'Cohort / training plan',
    description: 'Plan a certification cohort or bootcamp end to end.',
    category: 'training',
    audiences: ['program'],
    preview: 'Audience → schedule → instructors → outcomes',
    markdown: `## Cohort overview

**Program:**  
**Grade / certification:**  
**Region:**  
**Target start:**  
**Seats:**  

## Who this serves

Describe the learners — new entrants, operators upgrading a grade, small-system staff — and how they'll be recruited.

## Schedule

| Week | Topic | Format | Instructor |
| --- | --- | --- | --- |
| 1 | | In person / virtual | |
| 2 | | | |
| 3 | | | |

## Readiness checklist

- [ ] Learning Stream course section created
- [ ] Instructors confirmed
- [ ] Venue or virtual room booked
- [ ] Exam date coordinated with DOH
- [ ] Employer partners notified of expected completers

## Outcomes we'll report

Completion rate, exam pass rate, placements within 90 days, CE hours issued.
`,
  },
  {
    id: 'course-outline',
    name: 'Course outline',
    description: 'Learning objectives, modules and assessment for a single course.',
    category: 'training',
    audiences: ['program', 'district'],
    preview: 'Objectives → modules → assessment → CE hours',
    markdown: `## Course

**Title:**  
**CE hours:**  
**Delivery:**  
**Prerequisites:**  

## Learning objectives

By the end of this course, learners can:

1. 
2. 
3. 

## Modules

| # | Module | Duration | Key activities |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

## Assessment

How mastery is demonstrated and how it maps to the certification exam.

## Materials

Links, handouts and equipment the instructor needs on day one.
`,
  },
  {
    id: 'epa-quarterly-narrative',
    name: 'EPA Area 3 quarterly narrative',
    description: 'Progress narrative for the grant reporting period, mapped to Tasks 1–4.',
    category: 'grant',
    audiences: ['program'],
    preview: 'Task-by-task progress, measures, barriers, next period',
    markdown: `## Reporting period

**Quarter:**  
**Prepared by:**  
**Date:**  

## Progress by task

### Task 1 — Outreach and recruitment
What was delivered, who was reached, what changed.

### Task 2 — Training delivery
Courses held, learners served, CE hours issued, pass rates.

### Task 3 — Employer engagement
Utilities enrolled, vacancies posted, placements.

### Task 4 — Evaluation and reporting
Data collected, dashboards updated, lessons learned.

## Output measures

| Measure | Target | This quarter | Cumulative |
| --- | --- | --- | --- |
| | | | |

## Barriers and adjustments

Plain language on what slowed progress and how the plan adapts.

## Next period

Planned activities and any support requested from EPA.
`,
  },
  {
    id: 'success-story',
    name: 'Success story',
    description: 'Short human story for a report, newsletter or funder update.',
    category: 'grant',
    audiences: ['program'],
    preview: 'Person → challenge → program → outcome → quote',
    markdown: `## Title

## The person

Who they are, where they work or hope to work, and what brought them to water.

## The challenge

What stood between them and a certification or job.

## What the program did

Course, mentor, scholarship, exam prep — the specific help that mattered.

## The outcome

Certification earned, job placed, system stabilized. Include a number if you have one.

> "A one- or two-sentence quote in their own words."

*Photo and consent on file: yes / no*
`,
  },
  {
    id: 'utility-invitation',
    name: 'Utility invitation letter',
    description: 'Invite a utility to enroll in Water Workforce 360.',
    category: 'outreach',
    audiences: ['program'],
    preview: 'Why → what they get → what we ask → how to join',
    markdown: `Dear [Utility leader],

## Why we're writing

One paragraph on the statewide operator shortage and what it means for a system like theirs.

## What Water Workforce 360 gives you

- A view of certified candidates coming out of training in your region
- Succession and retirement risk tools for your critical roles
- Direct access to Learning Stream cohorts and CE renewals

## What we ask

A short enrollment form: current positions, expected retirements, training needs. Utility records stay utility-owned; you choose what partners can see.

## How to join

Contact and next step.

With appreciation,

[Name]  
One Water Workforce
`,
  },
  {
    id: 'newsletter',
    name: 'Partner newsletter',
    description: 'Monthly update for utilities, instructors and partners.',
    category: 'outreach',
    audiences: ['program'],
    preview: 'Lead story → training calendar → spotlight → dates',
    markdown: `## This month

Lead story in two short paragraphs.

## Training calendar

| Date | Course | Region | Seats left |
| --- | --- | --- | --- |
| | | | |

## Utility spotlight

A partner utility doing something worth copying.

## Career pipeline

New members on onewaterworkforce.org, upcoming career events, exam dates.

## Dates to know

- 
- 
`,
  },
  {
    id: 'job-profile',
    name: 'Role profile / job posting',
    description: 'Describe an operator role for the career pipeline.',
    category: 'outreach',
    audiences: ['program', 'district'],
    preview: 'Role → certification → day-to-day → path',
    markdown: `## Role

**Title:**  
**Utility / region:**  
**Grade required:**  
**Pay range:**  

## What you'll do

Plain-language description of the daily work and why it matters to public health.

## What you need

- Certification or eligibility to sit the exam
- Licenses, physical requirements, schedule

## Career path

Where this role leads and how the program supports upgrades.

## How to apply

Contact, deadline and link.
`,
  },
  // ── Succession binder (Document Studio pack) ─────────────────────────────
  {
    id: 'binder-cover',
    name: 'Succession Binder — Cover',
    description: 'Cover page linking all succession binder sections for board and cloud archive.',
    category: 'operations',
    audiences: ['district'],
    preview: 'Purpose → sections → custody note',
    markdown: `# Succession Binder

**Utility:**  
**Prepared by:**  
**Last updated:**

## Purpose

Document critical roles, backups, retirement risk, and knowledge transfer.

## Custody & backup

Export or transfer custody to your utility cloud when ready — WW360 is not your long-term archive.
`,
  },
  {
    id: 'critical-roles-coverage',
    name: 'Critical roles & backups',
    description: 'Role coverage table for succession planning.',
    category: 'operations',
    audiences: ['district'],
    preview: 'Functions → primary → backup → risk',
    markdown: `## Critical roles & backups

| Function | Primary | Backup | Risk |
| --- | --- | --- | --- |
| | | | |
`,
  },
  {
    id: 'knowledge-transfer-checklist',
    name: 'Knowledge transfer checklist',
    description: 'Checklist before planned retirements or promotions.',
    category: 'operations',
    audiences: ['district'],
    preview: 'SOPs → walk-throughs → sign-off',
    markdown: `## Knowledge transfer checklist

- [ ] Critical SOPs current
- [ ] Operator walk-through recorded
- [ ] Emergency contacts updated
`,
  },
  {
    id: 'ceu-tracker-snapshot',
    name: 'CEU Tracker snapshot',
    description: 'Point-in-time CEU and certification status for filing or board review.',
    category: 'training',
    audiences: ['district'],
    preview: 'Operators → hours → cliff → DOH-352',
    markdown: `## CEU Tracker snapshot

| Operator | Grade | Cycle end | Remaining hr | Status |
| --- | --- | --- | --- | --- |
| | | | | |
`,
  },
  {
    id: 'succession-memo',
    name: 'Succession planning memo',
    description: 'Summarize continuity risk and a plan for a critical role.',
    category: 'operations',
    audiences: ['program', 'district'],
    preview: 'Role at risk → timeline → candidates → plan',
    markdown: `## Role at risk

**Position:**  
**Incumbent retirement / exit window:**  
**Certification held:**  

## Why it matters

What stops or degrades if this role is vacant.

## Candidate bench

| Candidate | Current grade | Gap to role | Ready by |
| --- | --- | --- | --- |
| | | | |

## Plan

1. **Knowledge capture** — SOPs, walk-throughs, recorded tutorials.
2. **Training** — courses and exam timeline for the lead candidate.
3. **Coverage** — interim arrangement or mutual aid if the window closes early.

## Decisions needed

- 
`,
  },

  // ── District manager / utility ──────────────────────────────────────────
  {
    id: 'util-staffing-brief',
    name: 'Utility staffing brief',
    description: 'Snapshot of headcount, certifications, vacancies and near-term risk for your plant.',
    category: 'brief',
    audiences: ['district'],
    preview: 'Headcount → grades → vacancies → asks',
    markdown: `## Utility staffing brief

**Utility / PWSID:**  
**Prepared by:**  
**Date:**  

## Headcount by role

| Role / grade | Filled | Vacant | Expected exits (24 mo) |
| --- | --- | --- | --- |
| Chief / Grade IA | | | |
| Operator | | | |
| Lab / other | | | |

## Certification gaps

Which grades are short, and by how many FTEs.

## Near-term risks

Retirements, leave, or single points of failure in the next 12–24 months.

## Actions

1. **Recruit / promote** — 
2. **Train / CE** — 
3. **Document** — SOPs or tutorials to capture before exits

> **Ask:** decision or support needed from the board or partners.
`,
  },
  {
    id: 'util-ceu-plan',
    name: 'Annual CE & training plan',
    description: 'Plan contact hours and courses for each certified operator this year.',
    category: 'training',
    audiences: ['district'],
    preview: 'Operator → hours needed → courses → due dates',
    markdown: `## Annual CE & training plan

**Calendar year:**  
**Utility:**  

## Operator roster

| Operator | Grade | CE due | Hours needed | Planned courses |
| --- | --- | --- | --- | --- |
| | | | | |

## Priority courses

| Course | Provider | Target attendees | Window |
| --- | --- | --- | --- |
| | | | |

## Budget & coverage

How shifts are covered while staff are in training.

## Tracking

- [ ] Hours logged in Learning Stream / WW360
- [ ] Certificates filed
- [ ] Renewals confirmed with DOH
`,
  },
  {
    id: 'util-board-update',
    name: 'Board / council workforce update',
    description: 'One-page update for trustees on staffing, training and continuity.',
    category: 'brief',
    audiences: ['district'],
    preview: 'Status → risk → ask',
    markdown: `## Workforce update for the board

**Period:**  
**Prepared by:**  

## Status in one paragraph

Headcount, open roles, and training progress.

## Risks

What could disrupt operations if unaddressed.

## What we did this period

- 
- 

## What we need

Budget, hiring authority, or partnership support — one clear ask.
`,
  },
  {
    id: 'util-onboarding',
    name: 'New hire onboarding checklist',
    description: 'First-week and first-month checklist for a new operator or trainee.',
    category: 'training',
    audiences: ['district', 'operator'],
    preview: 'Day 1 → week 1 → month 1',
    markdown: `## New hire onboarding

**Name:**  
**Role / grade track:**  
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
1. 
2. 
3. 
`,
  },
  {
    id: 'util-emergency-ops',
    name: 'Emergency / after-hours playbook',
    description: 'Who to call, what to do first, and how to document an after-hours event.',
    category: 'compliance',
    audiences: ['district', 'operator'],
    preview: 'Trigger → notify → act → log',
    markdown: `## Emergency / after-hours playbook

**System:**  
**Last reviewed:**  

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
`,
  },
  {
    id: 'util-compliance-checklist',
    name: 'Monthly compliance checklist',
    description: 'Recurring sampling, reporting and inspection reminders for the utility.',
    category: 'compliance',
    audiences: ['district'],
    preview: 'Samples → reports → inspections',
    markdown: `## Monthly compliance checklist

**Month:**  
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
`,
  },
  {
    id: 'util-incident-report',
    name: 'Utility incident report',
    description: 'Capture what happened, response, and corrective actions for plant leadership.',
    category: 'compliance',
    audiences: ['district', 'operator'],
    preview: 'What → when → response → follow-up',
    markdown: `## Incident report

**Date / time:**  
**Location:**  
**Reported by:**  
**Severity:** near miss / minor / major  

## What happened

## Immediate response

## People / systems affected

## Root cause (known or suspected)

## Corrective actions

| Action | Owner | Due |
| --- | --- | --- |
| | | |

## Notifications made

- [ ] Supervisor
- [ ] Manager
- [ ] Regulator (if required)
`,
  },

  // ── Operator / plant floor ──────────────────────────────────────────────
  {
    id: 'op-shift-handoff',
    name: 'Shift handoff notes',
    description: 'What the next operator needs to know — status, alarms, work in progress.',
    category: 'shift',
    audiences: ['operator', 'district'],
    preview: 'Status → alarms → WIP → asks',
    markdown: `## Shift handoff

**From:**  
**To:**  
**Date / shift:**  

## Plant status

Process summary in a few sentences.

## Alarms & issues this shift

| Time | Alarm / issue | Cleared? | Notes |
| --- | --- | --- | --- |
| | | | |

## Work in progress

- 

## Samples / chemical adds

- 

## For the next operator

- [ ] 
`,
  },
  {
    id: 'op-rounds-log',
    name: 'Daily rounds log',
    description: 'Checklist-style rounds with readings and notes for the shift.',
    category: 'shift',
    audiences: ['operator'],
    preview: 'Station → reading → OK / action',
    markdown: `## Daily rounds

**Operator:**  
**Date / shift:**  

| Station / check | Reading / status | OK? | Action |
| --- | --- | --- | --- |
| Clearwell level | | | |
| Filters | | | |
| High service pumps | | | |
| Chlorine residual | | | |
| Generator / SCADA | | | |

## Notes

`,
  },
  {
    id: 'op-documentation-task',
    name: 'Documentation task write-up',
    description: 'Capture knowledge for a documentation assignment from your operator home.',
    category: 'operations',
    audiences: ['operator'],
    preview: 'Task → steps → tips → done',
    markdown: `## Documentation task

**Task / procedure:**  
**Assigned by:**  
**Due:**  

## Why this matters

Who uses this procedure and what goes wrong if it is missing.

## Steps (as performed)

1. 
2. 
3. 

## Tips & gotchas

- 

## Attachments / recording

- [ ] Tutorial recorded in Document Studio
- [ ] Photos or diagrams attached

## Ready for review

- [ ] Draft complete — notify manager
`,
  },
  {
    id: 'op-equipment-check',
    name: 'Equipment check sheet',
    description: 'Inspect a pump, generator, or other asset and log findings.',
    category: 'shift',
    audiences: ['operator', 'district'],
    preview: 'Asset → checks → findings',
    markdown: `## Equipment check

**Asset:**  
**Location:**  
**Date:**  
**Operator:**  

## Checks

| Item | Pass / fail | Notes |
| --- | --- | --- |
| Leaks / unusual noise | | |
| Oil / lubricant level | | |
| Gauges / runtime hours | | |
| Safety guards in place | | |

## Findings & follow-up

- [ ] Work order needed — #
`,
  },
  {
    id: 'op-safety-near-miss',
    name: 'Safety / near-miss note',
    description: 'Quick write-up when something almost went wrong — no blame, learn fast.',
    category: 'compliance',
    audiences: ['operator', 'district'],
    preview: 'What almost happened → why → fix',
    markdown: `## Safety / near-miss note

**Date / time:**  
**Reported by:**  

## What almost happened

## Contributing factors

## Suggested fix

## Shared with supervisor

- [ ] Yes — date:
`,
  },
  {
    id: 'opcert-epa-annual-report',
    name: 'EPA Operator Certification Annual Report (Nine Baseline Standards)',
    description:
      'NYSDOH primacy program narrative pre-filled from WW360 OpCert coverage metrics.',
    category: 'compliance',
    audiences: ['program'],
    preview: 'Nine Baseline Standards · roster coverage · renewal cliff',
    markdown: `## EPA Operator Certification Annual Report

**State:** New York  
**Reporting period:** {{year}}  
**Prepared by:** NYSDOH Bureau of Water Supply Protection

### Summary metrics (from WW360)

| Metric | Value |
| --- | --- |
| Certified operators (roster) | {{total_operators}} |
| Community water systems | {{active_cws}} |
| Renewals ≤ 12 months | {{renewal_cliff_12mo}} |
| Systems per operator | {{systems_per_operator}} |

### Nine Baseline Standards checklist

1. **Authorization** — Statutory authority for operator certification program  
2. **Classification** — System and operator grade classifications  
3. **Operator qualifications** — Education, experience, examination requirements  
4. **Enforcement** — Disciplinary actions and enforcement procedures  
5. **Certification renewal** — Renewal cycle and continuing education  
6. **Resources** — Staffing and budget adequate to implement program  
7. **Recertification** — Reinstatement procedures for lapsed certificates  
8. **Stakeholder involvement** — Advisory boards and public participation  
9. **Program review** — Internal audit and continuous improvement

### Narrative

Describe how the state program meets each baseline standard. Attach supporting documentation as required by EPA Region 2.

### Certification

State Attorney General certification attached: [ ] Yes  [ ] N/A
`,
  },
];

export function templateById(id: string | null | undefined): StudioTemplate | undefined {
  return STUDIO_TEMPLATES.find(t => t.id === id);
}

export function templatesForAudience(audience: StudioTemplateAudience): StudioTemplate[] {
  return STUDIO_TEMPLATES.filter(t => t.audiences.includes(audience));
}

export function groupedTemplatesForAudience(audience: StudioTemplateAudience): Array<{
  category: StudioTemplateCategory;
  items: StudioTemplate[];
}> {
  const list = templatesForAudience(audience);
  const map = new Map<StudioTemplateCategory, StudioTemplate[]>();
  list.forEach(t => map.set(t.category, [...(map.get(t.category) ?? []), t]));
  return CATEGORY_ORDER.filter(c => map.has(c)).map(c => ({ category: c, items: map.get(c)! }));
}

/** Default sample used by the guided tour when the library is empty. */
export function tourSampleTemplateId(audience: StudioTemplateAudience): string {
  switch (audience) {
    case 'operator':
      return 'op-shift-handoff';
    case 'district':
      return 'util-staffing-brief';
    default:
      return 'regional-brief';
  }
}

export function newDocumentDialogBlurb(audience: StudioTemplateAudience): string {
  switch (audience) {
    case 'operator':
      return 'Pick a starting point for plant-floor work — shift handoffs, rounds, documentation tasks, SOPs and tutorials.';
    case 'district':
      return 'Pick a starting point for your utility — staffing briefs, CE plans, compliance checklists, SOPs and board updates.';
    default:
      return 'Pick a starting point. Templates are written for One Water Workforce content — briefs, cohorts, grant narratives and outreach.';
  }
}

/** Map Studio tour audience (incl. viewer) onto template audience. */
export function templateAudienceFromTour(
  tourAudience: 'program' | 'district' | 'operator' | 'viewer'
): StudioTemplateAudience {
  if (tourAudience === 'operator') return 'operator';
  if (tourAudience === 'district' || tourAudience === 'viewer') return 'district';
  return 'program';
}
