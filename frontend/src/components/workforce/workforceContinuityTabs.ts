/** Tab ids for Workforce Continuity — must match TabsTrigger values and ?tab= query param. */
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Flag,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  School,
  Shield,
  Upload,
  Users,
} from 'lucide-react';

export const WORKFORCE_CONTINUITY_TABS = [
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
] as const;

export type WorkforceContinuityTab = (typeof WORKFORCE_CONTINUITY_TABS)[number];

export type WorkforceWorkspace = 'continuity' | 'ceu_training';

export const WORKFORCE_CONTINUITY_WORKSPACE_TABS = [
  'dashboard',
  'positions',
  'employees',
  'functions',
  'coverage',
  'succession',
  'knowledge',
  'milestones',
  'import',
] as const satisfies readonly WorkforceContinuityTab[];

export const WORKFORCE_CEU_TRAINING_WORKSPACE_TABS = [
  'certifications',
  'ceu',
  'training',
] as const satisfies readonly WorkforceContinuityTab[];

export interface WorkforceTabGroup {
  label: string;
  tabIds: readonly WorkforceContinuityTab[];
}

export const WORKFORCE_CONTINUITY_TAB_GROUPS: WorkforceTabGroup[] = [
  { label: 'Overview', tabIds: ['dashboard'] },
  { label: 'Roster', tabIds: ['positions', 'employees'] },
  { label: 'Cover', tabIds: ['functions', 'coverage', 'succession'] },
  { label: 'Handoff', tabIds: ['knowledge', 'milestones'] },
  { label: 'Tools', tabIds: ['import'] },
];

export const WORKFORCE_WORKSPACE_PATHS: Record<WorkforceWorkspace, string> = {
  continuity: '/dashboard/workforce-continuity',
  ceu_training: '/dashboard/ceu-training',
};

export const WORKFORCE_WORKSPACE_META: Record<
  WorkforceWorkspace,
  {
    title: string;
    description: string;
    icon: LucideIcon;
    gradientFrom: string;
    gradientTo: string;
    descriptionColor: string;
    defaultTab: WorkforceContinuityTab;
  }
> = {
  continuity: {
    title: 'Workforce Continuity',
    description:
      'Plan, hire, and cover critical functions — workforce risk grounded in AquaSafe operational data.',
    icon: Users,
    gradientFrom: 'indigo-600',
    gradientTo: 'purple-700',
    descriptionColor: 'indigo-200',
    defaultTab: 'dashboard',
  },
  ceu_training: {
    title: 'CEU & Training',
    description:
      'Renew operator licenses and close the training loop — certifications, CEUs, and statewide courses.',
    icon: GraduationCap,
    gradientFrom: 'emerald-600',
    gradientTo: 'teal-700',
    descriptionColor: 'emerald-200',
    defaultTab: 'certifications',
  },
};

export type WorkforceTabPhase = 'overview' | 'plan' | 'hire' | 'transition' | 'sustain';

export interface WorkforceTabMeta {
  label: string;
  icon: LucideIcon;
  phase: WorkforceTabPhase;
  activeClass: string;
  workspace: WorkforceWorkspace;
}

export const WORKFORCE_TAB_META: Record<WorkforceContinuityTab, WorkforceTabMeta> = {
  dashboard: {
    label: 'Dashboard',
    icon: LayoutDashboard,
    phase: 'overview',
    activeClass: 'border-indigo-600 text-indigo-700',
    workspace: 'continuity',
  },
  positions: {
    label: 'Positions',
    icon: Briefcase,
    phase: 'plan',
    activeClass: 'border-blue-600 text-blue-700',
    workspace: 'continuity',
  },
  employees: {
    label: 'Employees',
    icon: Users,
    phase: 'plan',
    activeClass: 'border-blue-600 text-blue-700',
    workspace: 'continuity',
  },
  certifications: {
    label: 'Certifications',
    icon: BadgeCheck,
    phase: 'plan',
    activeClass: 'border-green-600 text-green-700',
    workspace: 'ceu_training',
  },
  ceu: {
    label: 'CEUs',
    icon: GraduationCap,
    phase: 'sustain',
    activeClass: 'border-green-600 text-green-700',
    workspace: 'ceu_training',
  },
  training: {
    label: 'Training',
    icon: School,
    phase: 'sustain',
    activeClass: 'border-green-600 text-green-700',
    workspace: 'ceu_training',
  },
  functions: {
    label: 'Critical functions',
    icon: AlertTriangle,
    phase: 'plan',
    activeClass: 'border-blue-600 text-blue-700',
    workspace: 'continuity',
  },
  coverage: {
    label: 'Coverage',
    icon: Shield,
    phase: 'plan',
    activeClass: 'border-blue-600 text-blue-700',
    workspace: 'continuity',
  },
  succession: {
    label: 'Succession',
    icon: GitBranch,
    phase: 'hire',
    activeClass: 'border-amber-600 text-amber-700',
    workspace: 'continuity',
  },
  knowledge: {
    label: 'Knowledge',
    icon: BookOpen,
    phase: 'transition',
    activeClass: 'border-purple-600 text-purple-700',
    workspace: 'continuity',
  },
  milestones: {
    label: 'Milestones',
    icon: Flag,
    phase: 'transition',
    activeClass: 'border-purple-600 text-purple-700',
    workspace: 'continuity',
  },
  import: {
    label: 'Import',
    icon: Upload,
    phase: 'plan',
    activeClass: 'border-blue-600 text-blue-700',
    workspace: 'continuity',
  },
};

export const WORKFORCE_TRAINING_SUB_TABS = ['catalog', 'sessions', 'my-signups'] as const;
export type WorkforceTrainingSubTab = (typeof WORKFORCE_TRAINING_SUB_TABS)[number];

export interface WorkforceTabLinkOptions {
  sub?: WorkforceTrainingSubTab;
  certExpiring?: number;
  flowMap?: boolean;
  district?: string;
}

export function getWorkspaceForTab(tab: WorkforceContinuityTab): WorkforceWorkspace {
  return WORKFORCE_TAB_META[tab].workspace;
}

export function getWorkspaceForPath(pathname: string): WorkforceWorkspace {
  if (pathname.includes('/ceu-training')) {
    return 'ceu_training';
  }
  return 'continuity';
}

export function getTabsForWorkspace(
  workspace: WorkforceWorkspace
): readonly WorkforceContinuityTab[] {
  return workspace === 'ceu_training'
    ? WORKFORCE_CEU_TRAINING_WORKSPACE_TABS
    : WORKFORCE_CONTINUITY_WORKSPACE_TABS;
}

export function getDefaultTabForWorkspace(workspace: WorkforceWorkspace): WorkforceContinuityTab {
  return WORKFORCE_WORKSPACE_META[workspace].defaultTab;
}

export function parseWorkforceTab(
  value: string | null,
  workspace: WorkforceWorkspace = 'continuity'
): WorkforceContinuityTab {
  const allowed = getTabsForWorkspace(workspace);
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as WorkforceContinuityTab;
  }
  return getDefaultTabForWorkspace(workspace);
}

export function parseTrainingSubTab(value: string | null): WorkforceTrainingSubTab {
  if (value === 'upcoming') return 'sessions';
  if (value && (WORKFORCE_TRAINING_SUB_TABS as readonly string[]).includes(value)) {
    return value as WorkforceTrainingSubTab;
  }
  return 'catalog';
}

export function buildWorkforceTabPath(
  tab: WorkforceContinuityTab,
  opts?: WorkforceTabLinkOptions
): string {
  const workspace = getWorkspaceForTab(tab);
  const base = WORKFORCE_WORKSPACE_PATHS[workspace];
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (opts?.sub) params.set('sub', opts.sub);
  if (opts?.certExpiring != null) params.set('cert_expiring', String(opts.certExpiring));
  if (opts?.flowMap) params.set('flow_map', 'open');
  if (opts?.district) params.set('district', opts.district);
  return `${base}?${params.toString()}`;
}

/** Legacy deep links on /workforce-continuity that belong in CEU & Training. */
export function getLegacyWorkforceRedirect(
  pathname: string,
  search: string,
  tab: string | null
): string | null {
  if (!pathname.includes('/workforce-continuity') || pathname.includes('/ceu-training')) {
    return null;
  }
  if (tab && (WORKFORCE_CEU_TRAINING_WORKSPACE_TABS as readonly string[]).includes(tab)) {
    const params = new URLSearchParams(search);
    return `${WORKFORCE_WORKSPACE_PATHS.ceu_training}?${params.toString()}`;
  }
  return null;
}

export function buildWorkforceSearchParams(
  tab: WorkforceContinuityTab,
  opts?: {
    sub?: WorkforceTrainingSubTab;
    certExpiring?: number;
    clearCertExpiring?: boolean;
  }
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (opts?.sub) params.set('sub', opts.sub);
  else if (tab !== 'training') params.delete('sub');
  if (opts?.certExpiring != null) {
    params.set('cert_expiring', String(opts.certExpiring));
  } else if (opts?.clearCertExpiring) {
    params.delete('cert_expiring');
  }
  return params;
}
