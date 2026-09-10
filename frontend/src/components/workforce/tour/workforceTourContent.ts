import type { WorkforceContinuityTab } from '@/components/workforce/workforceContinuityTabs';
import type { WorkforceTourRole } from './workforceTourStorage';
import type { WorkforceTourAreaId } from './workforceTourApi';

export interface WorkforceTourSlide {
  id: string;
  title: string;
  body: string;
  tip?: string;
  highlight?: string;
}

const OPERATOR_AREAS: WorkforceContinuityTab[] = ['certifications', 'ceu', 'training'];

const MANAGER_AREAS: WorkforceContinuityTab[] = [
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

const OPERATOR_SLIDES: Record<WorkforceTourAreaId, WorkforceTourSlide[]> = {
  certifications: [
    {
      id: 'op-cert-1',
      title: 'Your licenses live here',
      body: 'Every operator license and credential tied to you appears on this tab — grades, expiration dates, and renewal status.',
      tip: 'An expired license can sideline you overnight. Check expiring-soon rows first.',
    },
    {
      id: 'op-cert-2',
      title: 'What the numbers mean',
      body: 'The strip at the top shows certs expiring in 90 days, CEU shortfall, and DOH-352 readiness for your district. These drive alerts your manager sees.',
    },
  ],
  ceu: [
    {
      id: 'op-ceu-1',
      title: 'Track your CEU progress',
      body: 'See hours earned toward renewal by grade, voucher status, and whether you are on track before your license expires.',
      tip: 'Upload completion vouchers when you finish a course — they count toward renewal paperwork.',
    },
    {
      id: 'op-ceu-2',
      title: 'Log completed training',
      body: 'Add CEU records from courses you attended. Match the grade on your license and include the provider approval number when you have it.',
    },
  ],
  training: [
    {
      id: 'op-training-1',
      title: 'Find renewal courses',
      body: 'Browse the statewide catalog filtered by grade and topic. Upcoming district sessions appear under Upcoming district training.',
    },
    {
      id: 'op-training-2',
      title: 'Close the loop',
      body: 'After you attend a session, record CEUs from the training row so your renewal file stays current.',
    },
  ],
  dashboard: [],
  positions: [],
  employees: [],
  functions: [],
  coverage: [],
  succession: [],
  knowledge: [],
  milestones: [],
  import: [],
};

const MANAGER_SLIDES: Record<WorkforceTourAreaId, WorkforceTourSlide[]> = {
  dashboard: [
    {
      id: 'mgr-dash-1',
      title: 'District readiness at a glance',
      body: 'The dashboard rolls up coverage, cert cliffs, retirement horizon, and CEU shortfalls into one readiness score for the selected district.',
    },
    {
      id: 'mgr-dash-2',
      title: 'Drill into risk',
      body: 'Click any metric card to jump to the tab behind it — coverage gaps, expiring certs, or succession risk.',
      tip: 'Run alert scan from the district bar to push new items into the Alerts inbox.',
    },
  ],
  positions: [
    {
      id: 'mgr-pos-1',
      title: 'Define the org chart',
      body: 'Positions are the job titles you hire and cover — operator grades, supervisors, and specialty roles.',
    },
    {
      id: 'mgr-pos-2',
      title: 'Link to coverage',
      body: 'Each position can tie to critical functions and succession candidates so you know who backs up whom.',
    },
  ],
  employees: [
    {
      id: 'mgr-emp-1',
      title: 'Your roster',
      body: 'Employees are the people in seats — linked to AquaSafe logins when operators need self-service access.',
    },
    {
      id: 'mgr-emp-2',
      title: 'Certs and CEUs follow people',
      body: 'Open an employee to see licenses, training history, and CEU progress without leaving continuity planning.',
    },
  ],
  certifications: [
    {
      id: 'mgr-cert-1',
      title: 'District-wide license health',
      body: 'All operator certifications with expiration dates — grades, OSHA, CDL, and more. Cert cliffs feed alerts and readiness.',
    },
    {
      id: 'mgr-cert-2',
      title: 'Prevent cert cliffs',
      body: 'Sort by expiration and assign renewal training before licenses lapse. Operators see only their own records.',
    },
  ],
  ceu: [
    {
      id: 'mgr-ceu-1',
      title: 'CEU compliance by operator',
      body: 'Track hours toward renewal, voucher gaps, and shortfalls across the district. DOH-352 export lives here when records are complete.',
    },
    {
      id: 'mgr-ceu-2',
      title: 'Employer profile',
      body: 'Set district employer details once — they prefill renewal forms and DOH submissions.',
    },
  ],
  training: [
    {
      id: 'mgr-training-1',
      title: 'Catalog and schedule',
      body: 'Statewide courses for discovery; schedule district sessions and let operators record CEUs after attendance.',
    },
  ],
  functions: [
    {
      id: 'mgr-fn-1',
      title: 'Critical functions',
      body: 'Name the operations that cannot go uncovered — treatment, distribution, compliance reporting, and more.',
    },
  ],
  coverage: [
    {
      id: 'mgr-cov-1',
      title: 'Who covers what',
      body: 'Assign qualified backups to each critical function. Coverage percentage drives the readiness score.',
    },
  ],
  succession: [
    {
      id: 'mgr-succ-1',
      title: 'Retirement and bench strength',
      body: 'Track succession candidates and retirement horizon so you are not surprised by a single point of failure.',
    },
  ],
  knowledge: [
    {
      id: 'mgr-know-1',
      title: 'Knowledge handoff',
      body: 'Document procedures, SOPs, and tribal knowledge before transitions — linked to milestones and roles.',
    },
  ],
  milestones: [
    {
      id: 'mgr-mile-1',
      title: 'Transition milestones',
      body: 'Due dates for handoffs, training completions, and retirement steps. Overdue milestones trigger alerts.',
    },
  ],
  import: [
    {
      id: 'mgr-import-1',
      title: 'Bulk load workforce data',
      body: 'Import CSV templates for positions, employees, and certifications. Preview before commit.',
      tip: 'Use Express setup from the district bar for a guided first load instead of CSV alone.',
    },
  ],
};

export function tourRoleFromFlags(isWorkforceOperator: boolean): WorkforceTourRole {
  return isWorkforceOperator ? 'operator' : 'manager';
}

export function listTourAreas(role: WorkforceTourRole): WorkforceTourAreaId[] {
  return role === 'operator' ? OPERATOR_AREAS : MANAGER_AREAS;
}

export function getTourSlides(
  areaId: WorkforceTourAreaId,
  role: WorkforceTourRole
): WorkforceTourSlide[] {
  const bank = role === 'operator' ? OPERATOR_SLIDES : MANAGER_SLIDES;
  return bank[areaId] ?? [];
}

export function getTourAreaLabel(areaId: WorkforceTourAreaId): string {
  const labels: Partial<Record<WorkforceTourAreaId, string>> = {
    dashboard: 'Dashboard',
    positions: 'Positions',
    employees: 'Employees',
    certifications: 'Certifications',
    ceu: 'CEUs',
    training: 'Training',
    functions: 'Critical functions',
    coverage: 'Coverage',
    succession: 'Succession',
    knowledge: 'Knowledge',
    milestones: 'Milestones',
    import: 'Import',
  };
  return labels[areaId] ?? areaId;
}
