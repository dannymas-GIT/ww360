import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplet,
  GitBranch,
  GraduationCap,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type CeuStatusKind = 'complete' | 'on_track' | 'due_soon' | 'shortfall';

const GRADE_STYLES: Record<string, string> = {
  IA: 'bg-blue-700 text-white hover:bg-blue-700',
  IIA: 'bg-blue-600 text-white hover:bg-blue-600',
  IB: 'bg-indigo-700 text-white hover:bg-indigo-700',
  IIB: 'bg-indigo-600 text-white hover:bg-indigo-600',
  C: 'bg-teal-700 text-white hover:bg-teal-700',
  D: 'bg-emerald-700 text-white hover:bg-emerald-700',
  TESTER: 'bg-violet-700 text-white hover:bg-violet-700',
};

export function normalizeDisplayGrade(grade: string | null | undefined): string {
  if (!grade) return '—';
  const g = grade.trim().toUpperCase();
  if (g === 'A') return 'IA';
  if (g === 'B') return 'IB';
  return g;
}

export function GradeBadge({
  grade,
  className,
}: {
  grade: string | null | undefined;
  className?: string;
}) {
  const display = normalizeDisplayGrade(grade);
  if (display === '—') return <span className="text-gray-400">—</span>;
  const style = GRADE_STYLES[display] ?? 'bg-slate-600 text-white hover:bg-slate-600';
  return (
    <Badge className={cn('font-mono text-[10px] px-1.5 py-0', style, className)}>
      Grade {display}
    </Badge>
  );
}

export function ceuStatusFromProgress(
  percentComplete: number,
  isShortfall: boolean,
  daysUntilCycleEnd: number
): CeuStatusKind {
  if (!isShortfall && percentComplete >= 100) return 'complete';
  if (isShortfall) return 'shortfall';
  if (daysUntilCycleEnd <= 90) return 'due_soon';
  return 'on_track';
}

const CEU_STATUS_CONFIG: Record<
  CeuStatusKind,
  { label: string; icon: LucideIcon; className: string }
> = {
  complete: {
    label: 'Complete',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  on_track: {
    label: 'On track',
    icon: Clock,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  due_soon: {
    label: 'Due soon',
    icon: Clock,
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  shortfall: {
    label: 'Shortfall',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-800 border-red-200',
  },
};

export function CeuStatusBadge({
  status,
  className,
}: {
  status: CeuStatusKind;
  className?: string;
}) {
  const cfg = CEU_STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 text-[10px] px-1.5 py-0', cfg.className, className)}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

export function CeuProgressBadge({
  percentComplete,
  isShortfall,
  daysUntilCycleEnd,
  className,
}: {
  percentComplete: number;
  isShortfall: boolean;
  daysUntilCycleEnd: number;
  className?: string;
}) {
  const status = ceuStatusFromProgress(percentComplete, isShortfall, daysUntilCycleEnd);
  return <CeuStatusBadge status={status} className={className} />;
}

const CEU_PROGRESS_BAR: Record<CeuStatusKind, { track: string; indicator: string }> = {
  complete: {
    track: 'bg-green-100',
    indicator: 'bg-gradient-to-r from-green-500 to-emerald-400',
  },
  on_track: {
    track: 'bg-blue-100',
    indicator: 'bg-gradient-to-r from-blue-500 to-sky-400',
  },
  due_soon: {
    track: 'bg-amber-100',
    indicator: 'bg-gradient-to-r from-amber-500 to-orange-400',
  },
  shortfall: {
    track: 'bg-red-100',
    indicator: 'bg-gradient-to-r from-red-500 to-rose-400',
  },
};

export function CeuProgressBar({
  percentComplete,
  isShortfall,
  daysUntilCycleEnd,
  className,
}: {
  percentComplete: number;
  isShortfall: boolean;
  daysUntilCycleEnd: number;
  className?: string;
}) {
  const status = ceuStatusFromProgress(percentComplete, isShortfall, daysUntilCycleEnd);
  const colors = CEU_PROGRESS_BAR[status];
  return (
    <Progress
      value={Math.min(100, percentComplete)}
      className={cn('h-2.5', colors.track, className)}
      indicatorClassName={colors.indicator}
    />
  );
}

const ROLE_ICONS: Record<string, LucideIcon> = {
  water_treatment_plant_operator: Droplet,
  water_treatment_assistant_operator: GraduationCap,
  distribution_system_operator: GitBranch,
  backflow_prevention_assembly_tester: ShieldCheck,
  treatment: Droplet,
  distribution: GitBranch,
  backflow: ShieldCheck,
};

export function RoleIcon({
  roleKey,
  certType,
  className,
}: {
  roleKey?: string | null;
  certType?: string | null;
  className?: string;
}) {
  const key = roleKey ?? certType ?? 'treatment';
  const Icon = ROLE_ICONS[key] ?? Droplet;
  return <Icon className={cn('h-4 w-4 text-slate-500', className)} aria-hidden />;
}

export function DeliveryModeBadge({ mode }: { mode: string }) {
  const labels: Record<string, string> = {
    in_person: 'In person',
    virtual: 'Virtual',
    hybrid: 'Hybrid',
  };
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
      {labels[mode] ?? mode.replace(/_/g, ' ')}
    </Badge>
  );
}

export function TrainingStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 capitalize', styles[status] ?? '')}
    >
      {status}
    </Badge>
  );
}
