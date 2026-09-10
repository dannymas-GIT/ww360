import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { useWorkforceContinuity, useWorkforceWidgetSummary } from '@/hooks/useWorkforceSuccession';
import {
  formatMetricValue,
  getMetricBorderClass,
  getMetricValueClass,
  getWorkforceMetricById,
  resolveMetricHint,
  resolveMetricTone,
  resolveMetricValue,
  type WorkforceMetricId,
} from './workforceMetricCatalog';
import { useWorkforceDistrictCode } from './useWorkforceDistrictCode';

interface Props {
  metricId: WorkforceMetricId;
  districtCode?: string;
}

const metricShellClass =
  'h-full min-h-[6.5rem] shadow-sm hover:shadow-md transition-shadow duration-200 bg-white rounded-lg p-2 sm:p-3 flex flex-col';

export function WorkforceMetricCard({ metricId, districtCode }: Props) {
  const resolvedDistrict = useWorkforceDistrictCode(districtCode);
  const metric = getWorkforceMetricById(metricId);
  const continuityQuery = useWorkforceContinuity(resolvedDistrict || undefined);
  const widgetQuery = useWorkforceWidgetSummary(resolvedDistrict || undefined);

  if (!metric) {
    return (
      <div className={`${metricShellClass} border-l-4 border-l-slate-300 text-sm text-gray-500`}>
        Unknown workforce metric: {metricId}
      </div>
    );
  }

  if (!resolvedDistrict) {
    return (
      <div className={`${metricShellClass} border-l-4 border-l-slate-300 text-sm text-gray-500`}>
        Select a district on Workforce Continuity to populate this metric.
      </div>
    );
  }

  if (continuityQuery.isLoading || widgetQuery.isLoading) {
    return (
      <div className={`${metricShellClass} border-l-4 border-l-slate-300 text-sm text-gray-500`}>
        Loading {metric.title}…
      </div>
    );
  }

  if (continuityQuery.isError) {
    return (
      <div className={`${metricShellClass} border-l-4 border-l-red-300 text-sm text-red-600`}>
        Could not load {metric.title}.
      </div>
    );
  }

  const sources = {
    scorecard: continuityQuery.data?.scorecard,
    widgetSummary: widgetQuery.data,
  };
  const value = resolveMetricValue(metricId, sources);
  const tone = resolveMetricTone(metric, value);
  const hint = resolveMetricHint(metricId, sources) ?? metric.description;

  const card = (
    <div className={`${metricShellClass} border-l-4 ${getMetricBorderClass(tone)}`}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <h3 className="text-[11px] sm:text-xs font-medium text-gray-900 truncate">
          {metric.title}
        </h3>
        <BarChart3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
      <div
        className={`text-xl sm:text-2xl font-bold tabular-nums leading-none ${getMetricValueClass(tone)}`}
      >
        {formatMetricValue(value, metric.format)}
      </div>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2 flex-1">
        {hint}
      </p>
    </div>
  );

  return (
    <Link to={metric.linkTo} className="block h-full">
      {card}
    </Link>
  );
}
