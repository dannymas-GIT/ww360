/**
 * Single source of truth for Workforce Continuity flow visuals:
 * plain-language copy, tab dependencies, pathway links, and factual citations.
 */
import type {
  WorkforceContinuityTab,
  WorkforceTabPhase,
} from '@/components/workforce/workforceContinuityTabs';
import type { WorkforcePathwayId } from '@/components/workforce/workforceSampleTemplates';
import type { WorkforceEntityType } from '@/services/workforceSuccessionService';

/** Tab ids plus dashboard outputs shown on the flow map. */
export type WorkforceFlowNodeId = WorkforceContinuityTab | 'readiness' | 'alerts' | 'doh352';

export interface WorkforceFlowCitation {
  label: string;
  url: string;
}

export interface WorkforceFlowNode {
  id: WorkforceFlowNodeId;
  label: string;
  phase: WorkforceTabPhase | 'output';
  plainLanguage: string;
  whyItMatters: string;
  needs: WorkforceFlowNodeId[];
  feeds: WorkforceFlowNodeId[];
  relatedPathways?: WorkforcePathwayId[];
  citation?: WorkforceFlowCitation;
  /** External route when the node is not a workforce tab. */
  externalHref?: string;
}

export const WORKFORCE_PHASE_JOURNEY: {
  id: WorkforceTabPhase;
  label: string;
  tagline: string;
}[] = [
  { id: 'overview', label: 'Overview', tagline: 'See the big picture' },
  { id: 'plan', label: 'Plan', tagline: 'Know your people and risks' },
  { id: 'hire', label: 'Hire', tagline: 'Grow replacements' },
  { id: 'transition', label: 'Transition', tagline: 'Capture knowledge' },
  { id: 'sustain', label: 'Sustain', tagline: 'Keep licenses current' },
];

export const NYS_CEU_CITATION: WorkforceFlowCitation = {
  label: '10 NYCRR §5-4.8',
  url: 'https://regs.health.ny.gov/content/section-5-48-renewalrecertification-requirements',
};

/** Ordered node groups for the dashboard flow map layout. */
export const WORKFORCE_FLOW_LANES: {
  phase: WorkforceTabPhase | 'output';
  title: string;
  subtitle: string;
  nodeIds: WorkforceFlowNodeId[];
}[] = [
  {
    phase: 'overview',
    title: 'Overview',
    subtitle: 'Your district readiness at a glance',
    nodeIds: ['dashboard'],
  },
  {
    phase: 'plan',
    title: 'Plan',
    subtitle: 'Jobs, people, and what must stay covered',
    nodeIds: ['positions', 'employees', 'functions', 'coverage', 'import'],
  },
  {
    phase: 'hire',
    title: 'Hire',
    subtitle: 'Identify who could step up',
    nodeIds: ['succession'],
  },
  {
    phase: 'transition',
    title: 'Transition',
    subtitle: 'Document know-how and track handoff tasks',
    nodeIds: ['knowledge', 'milestones'],
  },
  {
    phase: 'sustain',
    title: 'Sustain',
    subtitle: 'Renew operator licenses and close training loops',
    nodeIds: ['certifications', 'ceu', 'training'],
  },
  {
    phase: 'output',
    title: 'Outcomes',
    subtitle: 'What good data produces',
    nodeIds: ['readiness', 'alerts', 'doh352'],
  },
];

/** Two-workspace swimlanes for the flow overview dialog. */
export const WORKFORCE_FLOW_SWIMLANES: {
  id: 'continuity' | 'ceu_training' | 'outcomes';
  title: string;
  subtitle: string;
  nodeIds: WorkforceFlowNodeId[];
  band: string;
  titleClass: string;
}[] = [
  {
    id: 'continuity',
    title: 'Workforce Continuity',
    subtitle: 'Roster, coverage, succession, and handoff tasks',
    nodeIds: [
      'dashboard',
      'positions',
      'employees',
      'functions',
      'coverage',
      'succession',
      'knowledge',
      'milestones',
      'import',
    ],
    band: 'border-indigo-200 bg-indigo-50/60',
    titleClass: 'text-indigo-900',
  },
  {
    id: 'ceu_training',
    title: 'CEU & Training',
    subtitle: 'Credential lifecycle — licenses, renewal hours, and courses',
    nodeIds: ['certifications', 'ceu', 'training'],
    band: 'border-emerald-200 bg-emerald-50/60',
    titleClass: 'text-emerald-900',
  },
  {
    id: 'outcomes',
    title: 'Outcomes',
    subtitle: 'What good data produces across both workspaces',
    nodeIds: ['readiness', 'alerts', 'doh352'],
    band: 'border-slate-300 bg-slate-100/80',
    titleClass: 'text-slate-900',
  },
];

export const WORKFORCE_FLOW_NODES: Record<WorkforceFlowNodeId, WorkforceFlowNode> = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    phase: 'overview',
    plainLanguage:
      'A scoreboard that rolls up everything you enter — coverage, expiring certs, retirement risk, and CEU progress.',
    whyItMatters:
      'Leaders see workforce risk in one place instead of hunting through spreadsheets. Click any metric to jump to the tab that fixes it.',
    needs: ['positions', 'employees', 'certifications', 'functions', 'coverage', 'ceu'],
    feeds: ['readiness', 'alerts'],
    relatedPathways: ['retirement', 'single_point'],
  },
  positions: {
    id: 'positions',
    label: 'Positions',
    phase: 'plan',
    plainLanguage:
      'The jobs your district pays for — funded slots, vacancies, and civil service titles.',
    whyItMatters:
      'You cannot plan succession for a role you have not named. Positions anchor employees, candidates, and milestones.',
    needs: [],
    feeds: ['employees', 'succession', 'milestones'],
    relatedPathways: ['retirement'],
  },
  employees: {
    id: 'employees',
    label: 'Employees',
    phase: 'plan',
    plainLanguage:
      'The people in those jobs today — names, operator grades, hire dates, and retirement timelines.',
    whyItMatters:
      'If the only person who runs the plant retires with no backup, you have a coverage gap. This tab is your roster.',
    needs: ['positions'],
    feeds: ['certifications', 'coverage', 'ceu', 'succession'],
    relatedPathways: ['retirement', 'bench'],
  },
  certifications: {
    id: 'certifications',
    label: 'Certifications',
    phase: 'plan',
    plainLanguage:
      'Licenses and credentials with expiration dates — operator grades, OSHA, CDL, and more.',
    whyItMatters:
      'An expired license can sideline an operator overnight. Tracking expirations drives cert-cliff alerts and CEU grades.',
    needs: ['employees'],
    feeds: ['ceu', 'coverage', 'readiness', 'alerts'],
    relatedPathways: ['compliance', 'bench'],
  },
  functions: {
    id: 'functions',
    label: 'Critical functions',
    phase: 'plan',
    plainLanguage:
      'Operational responsibilities that must stay covered — treatment, SCADA, sampling, emergency response, and similar.',
    whyItMatters:
      'Not every task needs a backup plan. Critical functions are the ones where a gap stops safe operations.',
    needs: [],
    feeds: ['coverage', 'knowledge'],
    relatedPathways: ['single_point', 'compliance', 'emergency'],
  },
  coverage: {
    id: 'coverage',
    label: 'Coverage',
    phase: 'plan',
    plainLanguage: 'Who is primary, backup, or trainee for each critical function.',
    whyItMatters:
      'Coverage is the heart of continuity planning. A function with no qualified backup is a single point of failure.',
    needs: ['employees', 'functions'],
    feeds: ['readiness', 'alerts'],
    relatedPathways: ['single_point', 'emergency', 'compliance'],
  },
  import: {
    id: 'import',
    label: 'Import',
    phase: 'plan',
    plainLanguage:
      'Upload CSV files to load many records at once — preview first, then commit when rows look right.',
    whyItMatters:
      'Bulk intake saves time when HR already has rosters in spreadsheets. Follow the recommended order on the Import tab.',
    needs: [],
    feeds: ['positions', 'employees', 'certifications', 'functions', 'coverage'],
    relatedPathways: ['retirement'],
  },
  succession: {
    id: 'succession',
    label: 'Succession',
    phase: 'hire',
    plainLanguage: 'Internal candidates who could move into upstream roles, with readiness notes.',
    whyItMatters:
      'Hiring from within is often faster and preserves institutional knowledge — if you have identified and developed candidates early.',
    needs: ['positions', 'employees'],
    feeds: ['milestones', 'readiness', 'alerts'],
    relatedPathways: ['retirement', 'bench'],
  },
  knowledge: {
    id: 'knowledge',
    label: 'Knowledge',
    phase: 'transition',
    plainLanguage:
      'SOPs, vendor contacts, troubleshooting notes, and decision history to transfer before someone leaves.',
    whyItMatters:
      "Much know-how lives only in one person's head. Writing it down before retirement prevents operational surprises.",
    needs: ['functions'],
    feeds: ['milestones'],
    relatedPathways: ['retirement', 'single_point', 'emergency'],
  },
  milestones: {
    id: 'milestones',
    label: 'Milestones',
    phase: 'transition',
    plainLanguage:
      'Dated tasks across Plan, Hire, Transition, and Sustain — who owns each step and when it is due.',
    whyItMatters:
      'Succession without deadlines slips. Milestones turn plans into accountable checklists.',
    needs: ['positions', 'succession'],
    feeds: ['readiness', 'alerts'],
    relatedPathways: ['retirement'],
  },
  ceu: {
    id: 'ceu',
    label: 'CEUs',
    phase: 'sustain',
    plainLanguage:
      'Continuing education hours each operator earns toward NYS license renewal, with voucher proof.',
    whyItMatters:
      'Operators must complete CEUs on a fixed renewal cycle. Shortfalls show up on the dashboard and trigger alerts.',
    needs: ['employees', 'certifications'],
    feeds: ['training', 'readiness', 'alerts', 'doh352'],
    relatedPathways: ['bench', 'compliance'],
    citation: NYS_CEU_CITATION,
  },
  training: {
    id: 'training',
    label: 'Training',
    phase: 'sustain',
    plainLanguage:
      "Statewide NYSDOH course catalog plus your district's scheduled training events.",
    whyItMatters:
      'When an operator is behind on CEUs, the training loop finds courses, schedules them, and records completion.',
    needs: ['ceu'],
    feeds: ['ceu'],
    relatedPathways: ['bench', 'compliance'],
    citation: NYS_CEU_CITATION,
  },
  readiness: {
    id: 'readiness',
    label: 'Readiness score',
    phase: 'output',
    plainLanguage:
      'A 0–100 score averaging coverage, certification health, retirement risk, and CEU completion when data exists.',
    whyItMatters:
      'One number helps executives compare districts and spot where to invest in backups, training, or hiring.',
    needs: ['coverage', 'certifications', 'employees', 'ceu'],
    feeds: ['alerts'],
    citation: {
      label: 'Score formula (AquaSafe analytics)',
      url: 'https://github.com',
    },
  },
  alerts: {
    id: 'alerts',
    label: 'Workforce alerts',
    phase: 'output',
    plainLanguage:
      'Automatic warnings for expiring certs, coverage gaps, retirement horizon, CEU shortfalls, and overdue milestones.',
    whyItMatters:
      'Alerts push problems to the inbox before they become emergencies — daily scan optional per district settings.',
    needs: ['readiness'],
    feeds: [],
    externalHref: '/dashboard/alerts',
  },
  doh352: {
    id: 'doh352',
    label: 'DOH-352',
    phase: 'output',
    plainLanguage:
      'The NYSDOH operator renewal form — export it when CEU records and vouchers are complete.',
    whyItMatters:
      'Renewal paperwork is easier when CEU hours and proof are already organized in AquaSafe.',
    needs: ['ceu'],
    feeds: [],
    relatedPathways: ['bench'],
  },
};

/** Remove placeholder citation URL on readiness — use no citation instead. */
WORKFORCE_FLOW_NODES.readiness.citation = undefined;

export const ENTITY_TO_FLOW_NODE: Record<WorkforceEntityType, WorkforceFlowNodeId> = {
  positions: 'positions',
  employees: 'employees',
  certifications: 'certifications',
  critical_functions: 'functions',
  role_coverage: 'coverage',
  succession_candidates: 'succession',
  knowledge_artifacts: 'knowledge',
  transition_milestones: 'milestones',
};

export const WORKFORCE_CONTINUITY_TABS_AS_FLOW: WorkforceFlowNodeId[] = [
  'dashboard',
  'positions',
  'employees',
  'certifications',
  'ceu',
  'training',
  'functions',
  'coverage',
  'succession',
  'knowledge',
  'milestones',
  'import',
];

export function isNavigableFlowNode(id: WorkforceFlowNodeId): id is WorkforceContinuityTab {
  return id !== 'readiness' && id !== 'alerts' && id !== 'doh352';
}

/** Validate graph integrity — used by tests. */
export function validateWorkforceFlowModel(): string[] {
  const errors: string[] = [];
  const ids = new Set(Object.keys(WORKFORCE_FLOW_NODES));

  for (const tab of WORKFORCE_CONTINUITY_TABS_AS_FLOW) {
    if (!WORKFORCE_FLOW_NODES[tab]) {
      errors.push(`Missing flow node for tab: ${tab}`);
    }
  }

  for (const node of Object.values(WORKFORCE_FLOW_NODES)) {
    for (const dep of [...node.needs, ...node.feeds]) {
      if (!ids.has(dep)) {
        errors.push(`Node ${node.id} references unknown id: ${dep}`);
      }
    }
    if (node.citation && !node.citation.url.startsWith('http')) {
      errors.push(`Node ${node.id} citation URL must be absolute`);
    }
  }

  for (const lane of WORKFORCE_FLOW_LANES) {
    for (const nodeId of lane.nodeIds) {
      if (!WORKFORCE_FLOW_NODES[nodeId]) {
        errors.push(`Lane ${lane.phase} references unknown node: ${nodeId}`);
      }
    }
  }

  return errors;
}
