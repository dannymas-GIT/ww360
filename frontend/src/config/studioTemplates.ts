/**
 * Document Studio templates — starting points for One Water Workforce content.
 *
 * Markdown here round-trips through tiptap-markdown, so keep to headings,
 * lists, task lists, quotes, pipe tables and horizontal rules.
 */

export type StudioTemplateCategory = 'brief' | 'training' | 'grant' | 'outreach' | 'operations';

export interface StudioTemplate {
  id: string;
  name: string;
  description: string;
  category: StudioTemplateCategory;
  /** Short line shown under the name in the gallery. */
  preview: string;
  markdown: string;
}

export const STUDIO_TEMPLATE_CATEGORIES: Record<StudioTemplateCategory, string> = {
  brief: 'Program briefs',
  training: 'Training & cohorts',
  grant: 'Grant reporting',
  outreach: 'Outreach',
  operations: 'Operations',
};

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: 'blank',
    name: 'Blank document',
    description: 'Start from an empty page.',
    category: 'operations',
    preview: 'Type / for headings, lists, tables and more',
    markdown: '',
  },
  {
    id: 'regional-brief',
    name: 'Regional workforce brief',
    description: 'One-page picture of supply, demand and risk for a New York region.',
    category: 'brief',
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
  {
    id: 'succession-memo',
    name: 'Succession planning memo',
    description: 'Summarize continuity risk and a plan for a critical role.',
    category: 'operations',
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
  {
    id: 'meeting-notes',
    name: 'Meeting notes',
    description: 'Attendees, decisions and action items.',
    category: 'operations',
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
  {
    id: 'sop',
    name: 'Standard operating procedure',
    description: 'Purpose, scope, responsibilities and numbered steps.',
    category: 'operations',
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
];

export function templateById(id: string | null | undefined): StudioTemplate | undefined {
  return STUDIO_TEMPLATES.find(t => t.id === id);
}
