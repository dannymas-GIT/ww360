import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatPct } from '@/lib/format';
import { Ww360SourceChip } from './Ww360SourceChip';
import { WW360_SOURCE_LABEL, type Ww360SourceId } from './ww360SourceTokens';

export interface Ww360KpiTileProps {
  label: string;
  value: string;
  sub: string;
  delta: number;
  invert?: boolean;
  icon: React.ReactNode;
  sources?: Ww360SourceId[];
  target?: string;
}

export function Ww360KpiTile({
  label,
  value,
  sub,
  delta,
  invert,
  icon,
  sources = [],
  target,
}: Ww360KpiTileProps) {
  const good = invert ? delta <= 0 : delta >= 0;
  const Icon = delta >= 0 ? TrendingUp : TrendingDown;
  return (
    <Card
      className="group relative overflow-hidden border-slate-200 bg-white shadow-sm"
      title={
        sources.length
          ? `Source: ${sources.map(s => WW360_SOURCE_LABEL[s]).join(' + ')}`
          : undefined
      }
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <span className="rounded-md bg-slate-100 p-1.5 text-slate-600">{icon}</span>
        </div>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className={`inline-flex items-center gap-1 font-medium ${good ? 'text-emerald-700' : 'text-red-600'}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {delta >= 0 ? '+' : ''}
            {formatPct(delta)}
          </span>
          <span className="text-slate-500">{sub}</span>
        </div>
        {target ? (
          <p className="mt-2 text-[11px] text-slate-500">
            <span className="font-medium text-slate-600">EPA target:</span> {target}
          </p>
        ) : null}
        {sources.length ? (
          <div className="mt-2 flex flex-wrap gap-1 opacity-70 transition-opacity group-hover:opacity-100">
            {sources.map(s => (
              <Ww360SourceChip key={s} id={s} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Simple stat tile without delta (for SDWIS landscape KPIs). */
export function Ww360StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
      <p className="text-xs font-medium text-sky-800">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-[#07111f]">{value}</p>
    </div>
  );
}
