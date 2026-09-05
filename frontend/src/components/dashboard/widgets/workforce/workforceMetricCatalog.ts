import type {
  WorkforceContinuityScorecard,
  WorkforceWidgetSummary,
} from '@/services/workforceSuccessionService';
import { buildWorkforceTabPath } from '@/components/workforce/workforceContinuityTabs';

export type WorkforceMetricId =
  | 'readiness_score'
  | 'coverage_pct'
  | 'cert_cliff_30d'
  | 'cert_cliff_90d'
  | 'cert_cliff_365d'
  | 'employees_retirement_eligible_24mo'
  | 'vacant_positions'
  | 'overdue_milestones'
  | 'ceu_shortfall_count'
  | 'ceu_avg_completion_pct'
  | 'doh352_ready_count'
  | 'records_missing_vouchers'
  | 'functions_without_backup';

export type WorkforceMetricGroupId =
  | 'certification_health'
  | 'ceu_compliance'
  | 'coverage_succession'
  | 'readiness_overview';

export type MetricTone = 'default' | 'warn' | 'good';

export type MetricFormat = 'number' | 'percent' | 'score';

export interface WorkforceMetricDefinition {
  id: WorkforceMetricId;
  title: string;
  description: string;
  format: MetricFormat;
  linkTo: string;
  warnWhen?: (value: number) => boolean;
  goodWhen?: (value: number) => boolean;
  invertTone?: boolean;
}

export interface WorkforceMetricGroupDefinition {
  id: WorkforceMetricGroupId;
  title: string;
  description: string;
  metricIds: WorkforceMetricId[];
  linkTo: string;
}

export interface WorkforceMetricDataSources {
  scorecard: WorkforceContinuityScorecard | null | undefined;
  widgetSummary: WorkforceWidgetSummary | null | undefined;
}

export const WORKFORCE_METRICS: WorkforceMetricDefinition[] = [
  {
    id: 'readiness_score',
    title: 'Readiness Score',
    description: 'Composite workforce continuity health',
    format: 'score',
    linkTo: buildWorkforceTabPath('dashboard'),
    warnWhen: v => v < 60,
    goodWhen: v => v >= 80,
  },
  {
    id: 'coverage_pct',
    title: 'Coverage',
    description: 'Critical functions with qualified backup',
    format: 'percent',
    linkTo: buildWorkforceTabPath('coverage'),
    warnWhen: v => v < 70,
    goodWhen: v => v >= 90,
  },
  {
    id: 'cert_cliff_30d',
    title: 'Certs Expiring (30d)',
    description: 'Certifications expiring within 30 days',
    format: 'number',
    linkTo: buildWorkforceTabPath('certifications', { certExpiring: 30 }),
    warnWhen: v => v > 0,
    invertTone: true,
  },
  {
    id: 'cert_cliff_90d',
    title: 'Certs Expiring (90d)',
    description: 'Certifications expiring within 90 days',
    format: 'number',
    linkTo: buildWorkforceTabPath('certifications', { certExpiring: 90 }),
    warnWhen: v => v > 0,
    invertTone: true,
  },
  {
    id: 'cert_cliff_365d',
    title: 'Certs Expiring (365d)',
    description: 'Certifications expiring within one year',
    format: 'number',
    linkTo: buildWorkforceTabPath('certifications', { certExpiring: 365 }),
    warnWhen: v => v > 3,
    invertTone: true,
  },
  {
    id: 'employees_retirement_eligible_24mo',
    title: 'Retirement Eligible (24mo)',
    description: 'Employees eligible for retirement within 24 months',
    format: 'number',
    linkTo: buildWorkforceTabPath('succession'),
    warnWhen: v => v > 0,
    invertTone: true,
  },
  {
    id: 'vacant_positions',
    title: 'Vacant Positions',
    description: 'Active positions marked vacant',
    format: 'number',
    linkTo: buildWorkforceTabPath('positions'),
    warnWhen: v => v > 0,
    invertTone: true,
  },
  {
    id: 'overdue_milestones',
    title: 'Overdue Milestones',
    description: 'Transition milestones past target date',
    format: 'number',
    linkTo: buildWorkforceTabPath('milestones'),
    warnWhen: v => v > 0,
    invertTone: true,
  },
  {
    id: 'ceu_shortfall_count',
    title: 'CEU Shortfall',
    description: 'Operators behind on renewal hours',
    format: 'number',
    linkTo: buildWorkforceTabPath('ceu'),
    warnWhen: v => v > 0,
    invertTone: true,
  },
  {
    id: 'ceu_avg_completion_pct',
    title: 'CEU Avg Completion',
    description: 'Average operator CEU cycle completion',
    format: 'percent',
    linkTo: buildWorkforceTabPath('ceu'),
    warnWhen: v => v < 70,
    goodWhen: v => v >= 90,
  },
  {
    id: 'doh352_ready_count',
    title: 'DOH-352 Ready',
    description: 'Operators ready for DOH-352 submission',
    format: 'number',
    linkTo: buildWorkforceTabPath('ceu'),
    goodWhen: v => v > 0,
  },
  {
    id: 'records_missing_vouchers',
    title: 'Missing Vouchers',
    description: 'CEU records without proof attached',
    format: 'number',
    linkTo: buildWorkforceTabPath('ceu'),
    warnWhen: v => v > 0,
    invertTone: true,
  },
  {
    id: 'functions_without_backup',
    title: 'No Backup Coverage',
    description: 'Critical functions without qualified backup',
    format: 'number',
    linkTo: buildWorkforceTabPath('coverage'),
    warnWhen: v => v > 0,
    invertTone: true,
  },
];

export const WORKFORCE_METRIC_GROUPS: WorkforceMetricGroupDefinition[] = [
  {
    id: 'certification_health',
    title: 'Certification Health',
    description: 'Certification cliff at 30, 90, and 365 days',
    metricIds: ['cert_cliff_30d', 'cert_cliff_90d', 'cert_cliff_365d'],
    linkTo: buildWorkforceTabPath('certifications'),
  },
  {
    id: 'ceu_compliance',
    title: 'CEU Compliance',
    description: 'Shortfalls, completion, and missing vouchers',
    metricIds: ['ceu_shortfall_count', 'ceu_avg_completion_pct', 'records_missing_vouchers'],
    linkTo: buildWorkforceTabPath('ceu'),
  },
  {
    id: 'coverage_succession',
    title: 'Coverage & Succession',
    description: 'Backup coverage, retirement horizon, and vacancies',
    metricIds: [
      'coverage_pct',
      'functions_without_backup',
      'employees_retirement_eligible_24mo',
      'vacant_positions',
    ],
    linkTo: buildWorkforceTabPath('coverage'),
  },
  {
    id: 'readiness_overview',
    title: 'Readiness Overview',
    description: 'Composite score and key component metrics',
    metricIds: ['readiness_score', 'coverage_pct', 'ceu_avg_completion_pct', 'cert_cliff_90d'],
    linkTo: buildWorkforceTabPath('dashboard'),
  },
];

export const WORKFORCE_METRIC_BY_ID = Object.fromEntries(
  WORKFORCE_METRICS.map(metric => [metric.id, metric])
) as Record<WorkforceMetricId, WorkforceMetricDefinition>;

export const WORKFORCE_METRIC_GROUP_BY_ID = Object.fromEntries(
  WORKFORCE_METRIC_GROUPS.map(group => [group.id, group])
) as Record<WorkforceMetricGroupId, WorkforceMetricGroupDefinition>;

export function getWorkforceMetricById(id: string): WorkforceMetricDefinition | undefined {
  return WORKFORCE_METRIC_BY_ID[id as WorkforceMetricId];
}

export function getWorkforceMetricGroupById(
  id: string
): WorkforceMetricGroupDefinition | undefined {
  return WORKFORCE_METRIC_GROUP_BY_ID[id as WorkforceMetricGroupId];
}

export function resolveMetricValue(
  metricId: WorkforceMetricId,
  sources: WorkforceMetricDataSources
): number | null {
  const { scorecard, widgetSummary } = sources;
  if (!scorecard && !widgetSummary) return null;

  switch (metricId) {
    case 'readiness_score':
      return scorecard?.readiness_score ?? widgetSummary?.readiness_score ?? null;
    case 'coverage_pct':
      return scorecard?.coverage_pct ?? null;
    case 'cert_cliff_30d':
      return scorecard?.cert_cliff_30d ?? null;
    case 'cert_cliff_90d':
      return scorecard?.cert_cliff_90d ?? widgetSummary?.cert_cliff_90d ?? null;
    case 'cert_cliff_365d':
      return scorecard?.cert_cliff_365d ?? null;
    case 'employees_retirement_eligible_24mo':
      return (
        scorecard?.employees_retirement_eligible_24mo ?? widgetSummary?.retirement_24mo ?? null
      );
    case 'vacant_positions':
      return scorecard?.vacant_positions ?? null;
    case 'overdue_milestones':
      return scorecard?.overdue_milestones ?? null;
    case 'ceu_shortfall_count':
      return scorecard?.ceu_shortfall_count ?? widgetSummary?.ceu_shortfall_count ?? null;
    case 'ceu_avg_completion_pct':
      return scorecard?.ceu_avg_completion_pct ?? null;
    case 'doh352_ready_count':
      return scorecard?.doh352_ready_count ?? null;
    case 'records_missing_vouchers':
      return widgetSummary?.records_missing_vouchers ?? null;
    case 'functions_without_backup':
      return scorecard?.functions_without_backup ?? null;
    default:
      return null;
  }
}

export function resolveMetricHint(
  metricId: WorkforceMetricId,
  sources: WorkforceMetricDataSources
): string | undefined {
  const { scorecard, widgetSummary } = sources;
  if (!scorecard) return undefined;

  switch (metricId) {
    case 'coverage_pct':
      return `${scorecard.functions_with_qualified_backup} of ${scorecard.total_critical_functions} functions covered`;
    case 'readiness_score':
      if (scorecard.readiness_score >= 80) return 'Strong continuity posture';
      if (scorecard.readiness_score >= 60) return 'Adequate — monitor gaps';
      if (scorecard.readiness_score >= 40) return 'At risk — review coverage';
      return 'Critical — immediate attention needed';
    case 'employees_retirement_eligible_24mo':
      if (scorecard.vacant_positions > 0) {
        return `${scorecard.vacant_positions} vacant position${scorecard.vacant_positions === 1 ? '' : 's'}`;
      }
      return undefined;
    case 'overdue_milestones':
      return scorecard.overdue_milestones > 0 ? 'Review transition milestones' : undefined;
    case 'ceu_shortfall_count': {
      const top = widgetSummary?.ceu_shortfall_operators?.[0];
      if (top) return `${top.employee_name} needs ${top.remaining_hours} hrs`;
      return undefined;
    }
    case 'doh352_ready_count':
      return `${scorecard.doh352_ready_count ?? 0} of ${scorecard.total_employees} operators`;
    default:
      return undefined;
  }
}

export function resolveMetricTone(
  metric: WorkforceMetricDefinition,
  value: number | null
): MetricTone {
  if (value == null || Number.isNaN(value)) return 'default';

  const isWarn = metric.warnWhen?.(value) ?? false;
  const isGood = metric.goodWhen?.(value) ?? false;

  if (metric.invertTone) {
    if (isWarn) return 'warn';
    if (value === 0) return 'good';
    return 'default';
  }

  if (isGood) return 'good';
  if (isWarn) return 'warn';
  return 'default';
}

export function formatMetricValue(value: number | null, format: MetricFormat): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (format === 'percent') return `${Math.round(value)}%`;
  if (format === 'score') return String(Math.round(value));
  return String(value);
}

export function getMetricBorderClass(tone: MetricTone): string {
  switch (tone) {
    case 'warn':
      return 'border-l-amber-500';
    case 'good':
      return 'border-l-green-500';
    default:
      return 'border-l-blue-500';
  }
}

export function getMetricValueClass(tone: MetricTone): string {
  switch (tone) {
    case 'warn':
      return 'text-amber-600';
    case 'good':
      return 'text-green-600';
    default:
      return 'text-blue-600';
  }
}
