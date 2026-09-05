import { Badge } from '@/components/ui/badge';
import { formatLastSynced } from '@/lib/format';

export type Ww360DataMode = 'sample' | 'live' | 'mixed';

export interface Ww360DataModeBadgeProps {
  mode: Ww360DataMode;
  lastSynced?: string | null;
  className?: string;
}

const MODE_COPY: Record<Ww360DataMode, string> = {
  sample: 'Sample data',
  live: 'Live data',
  mixed: 'Mixed · live SDWIS + sample program metrics',
};

export function Ww360DataModeBadge({ mode, lastSynced, className = '' }: Ww360DataModeBadgeProps) {
  const synced = formatLastSynced(lastSynced);
  const label =
    mode === 'live' && synced ? `${MODE_COPY.live} · synced ${synced}` : MODE_COPY[mode];

  const tone =
    mode === 'live'
      ? 'border-transparent bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/20'
      : mode === 'mixed'
        ? 'border-transparent bg-amber-400/20 text-amber-100 hover:bg-amber-400/20'
        : 'border-transparent bg-sky-400/20 text-sky-100 hover:bg-sky-400/20';

  return (
    <Badge className={`text-xs ${tone} ${className}`}>{label}</Badge>
  );
}

/** Light-surface variant for pages without navy hero. */
export function Ww360DataModeBadgeLight({
  mode,
  lastSynced,
  className = '',
}: Ww360DataModeBadgeProps) {
  const synced = formatLastSynced(lastSynced);
  const label =
    mode === 'live' && synced ? `${MODE_COPY.live} · synced ${synced}` : MODE_COPY[mode];

  const tone =
    mode === 'live'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50'
      : mode === 'mixed'
        ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50'
        : 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-50';

  return (
    <Badge variant="outline" className={`text-xs font-normal ${tone} ${className}`}>
      {label}
    </Badge>
  );
}
