import type { BinderIntakeStepId } from '@/services/workforceSuccessionService';

export interface BinderIntakeStepMeta {
  id: BinderIntakeStepId;
  label: string;
  caption: string;
  fills: string;
}

export const BINDER_INTAKE_STEPS: BinderIntakeStepMeta[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    caption: 'Choose how you want to build your Succession Binder.',
    fills: 'Overview — no documents written yet.',
  },
  {
    id: 'utility_profile',
    label: 'Utility profile',
    caption: 'Template size and who prepared this binder.',
    fills: 'Cover page — utility name, contacts, section list.',
  },
  {
    id: 'operations_snapshot',
    label: 'Operations snapshot',
    caption: 'Plants, sites, and the biggest workforce gaps you see today.',
    fills: 'Cover purpose notes and multi-plant matrix (when applicable).',
  },
  {
    id: 'critical_roles',
    label: 'Critical roles',
    caption: 'Roles that must never go uncovered — primary and backup.',
    fills: 'Critical roles & backups section.',
  },
  {
    id: 'retirement_risk',
    label: 'Retirement & risk',
    caption: 'Near-term retirements and certification cliffs.',
    fills: 'Retirement & risk snapshot section.',
  },
  {
    id: 'succession_bench',
    label: 'Succession bench',
    caption: 'Candidates being developed for at-risk roles.',
    fills: 'Succession candidates section.',
  },
  {
    id: 'knowledge_transfer',
    label: 'Knowledge transfer',
    caption: 'SOPs and know-how that must be captured before exits.',
    fills: 'Knowledge transfer checklist section.',
  },
  {
    id: 'review',
    label: 'Review & generate',
    caption: 'Confirm what will be written to Document Studio.',
    fills: 'All binder sections — create or update in one step.',
  },
];

export const BINDER_INTAKE_STEP_IDS = BINDER_INTAKE_STEPS.map(s => s.id);

export const GAP_CHIP_OPTIONS = [
  'Weekend coverage',
  'Grade IIA backup',
  'SCADA knowledge',
  'Certification cliff',
  'Trainee pipeline',
  'Board reporting',
];

export function stepIndex(stepId: BinderIntakeStepId): number {
  return BINDER_INTAKE_STEP_IDS.indexOf(stepId);
}

export function stepLabel(stepId: BinderIntakeStepId): string {
  return BINDER_INTAKE_STEPS.find(s => s.id === stepId)?.label ?? stepId;
}
