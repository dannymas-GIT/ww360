/**
 * State-partner privilege model for One Water Workforce executives.
 *
 * Roles behind it (granted to jenny-oww):
 *  - `state_admin`  — state / section administration (not national platform).
 *  - `oww_partner`  — marker role: routes to the OWW workspace, switches nav,
 *                     and labels the tenant as a program partner.
 *
 * National platform demos use `ww360-national` / `aquasafe-admin` (`platform_admin`).
 * Utility-owned records stay utility-owned: partner access to per-utility
 * detail is governed by each utility's data-sharing consent captured in the
 * Water Workforce 360 enrollment form, never by the role alone.
 */

export type PrivilegeStatus = 'granted' | 'consent' | 'restricted';

export interface OwwPrivilege {
  id: string;
  capability: string;
  scope: string;
  status: PrivilegeStatus;
  note?: string;
}

export interface OwwPrivilegeGroup {
  id: string;
  title: string;
  blurb: string;
  items: OwwPrivilege[];
}

export const OWW_PRIVILEGE_GROUPS: OwwPrivilegeGroup[] = [
  {
    id: 'intelligence',
    title: 'Workforce intelligence',
    blurb: 'Statewide view of employer demand reported through Water Workforce 360.',
    items: [
      {
        id: 'agg-demand',
        capability: 'Aggregate staffing, vacancy, retirement and succession-risk data',
        scope: 'All participating utilities · by region and grade',
        status: 'granted',
      },
      {
        id: 'utility-detail',
        capability: 'Drill into a single utility’s workforce record',
        scope: '19 of 27 utilities have consented to partner visibility',
        status: 'consent',
        note: 'Utilities without consent appear only in aggregates.',
      },
      {
        id: 'edit-roster',
        capability: 'Edit utility rosters, positions or employee records',
        scope: 'Utility-owned',
        status: 'restricted',
        note: 'Only the utility’s own CEU admin / manager can change these.',
      },
    ],
  },
  {
    id: 'learning-stream',
    title: 'Learning Stream program data',
    blurb: 'Read-only mirror of OWW’s LMS system of record; Learning Stream stays authoritative.',
    items: [
      {
        id: 'ls-read',
        capability: 'Registrations, attendance, CE issuance, revenue and fill rates',
        scope: 'All OWW-sponsored events',
        status: 'granted',
      },
      {
        id: 'ls-sync',
        capability: 'Trigger an on-demand sync and view sync health',
        scope: 'Rate-limited (60 / min, 1 000 / hr)',
        status: 'granted',
      },
      {
        id: 'ls-write',
        capability: 'Create events or edit registrations',
        scope: 'Done in Learning Stream',
        status: 'restricted',
        note: 'Water Workforce 360 links out rather than duplicating the LMS.',
      },
    ],
  },
  {
    id: 'pipeline',
    title: 'Candidate pipeline (onewaterworkforce.org)',
    blurb: 'Member journey from awareness through employment at a participating utility.',
    items: [
      {
        id: 'pipeline-read',
        capability: 'Pipeline stages, audiences, referral sources, content engagement',
        scope: 'Site-wide',
        status: 'granted',
      },
      {
        id: 'matching',
        capability: 'Match exam-ready candidates to reported vacancies',
        scope: 'Candidates who opted in to utility sharing',
        status: 'consent',
      },
      {
        id: 'pii',
        capability: 'Export individual member contact details',
        scope: 'Restricted to OWW staff with data-steward role',
        status: 'restricted',
      },
    ],
  },
  {
    id: 'reporting',
    title: 'Grant reporting & exports',
    blurb: 'EPA Area 3 measures, quarterly packages and board-ready summaries.',
    items: [
      {
        id: 'epa-package',
        capability: 'Generate EPA quarterly report package (PDF + CSV)',
        scope: 'Tasks 1–4 measures',
        status: 'granted',
      },
      {
        id: 'board-export',
        capability: 'Export charts and tables for NYSAWWA board / section meetings',
        scope: 'Aggregated, de-identified',
        status: 'granted',
      },
      {
        id: 'scheduled',
        capability: 'Schedule recurring email digests',
        scope: 'Weekly · monthly',
        status: 'granted',
      },
    ],
  },
  {
    id: 'platform',
    title: 'Platform administration',
    blurb: 'Manage the OWW partner tenant on Water Workforce 360.',
    items: [
      {
        id: 'staff',
        capability: 'Invite and manage OWW program staff accounts',
        scope: 'oww_partner · ceu_manager roles',
        status: 'granted',
      },
      {
        id: 'invite-utility',
        capability: 'Approve utility access requests and enrollments',
        scope: 'Water Workforce 360 join requests',
        status: 'granted',
      },
      {
        id: 'doc-studio',
        capability: 'Author and publish program content in Document Studio',
        scope: 'One Water Workforce program library · PDF / Word export',
        status: 'granted',
        note: 'Utility libraries are separate; utilities author their own.',
      },
      {
        id: 'aquasafe-core',
        capability: 'AquaSafe compliance, water-quality and facility modules',
        scope: 'Not shown on waterworkforce360.org',
        status: 'restricted',
        note: 'Platform scope is limited to the workforce module on this host.',
      },
    ],
  },
];

export const OWW_PRIVILEGE_STATUS_LABEL: Record<PrivilegeStatus, string> = {
  granted: 'Granted',
  consent: 'By consent',
  restricted: 'Not included',
};
