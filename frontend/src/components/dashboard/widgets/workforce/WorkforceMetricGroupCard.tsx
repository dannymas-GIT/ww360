import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { useWorkforceContinuity, useWorkforceWidgetSummary } from '@/hooks/useWorkforceSuccession';
import {
  formatMetricValue,
  getWorkforceMetricById,
  getWorkforceMetricGroupById,
  resolveMetricHint,
  resolveMetricTone,
  resolveMetricValue,
  type WorkforceMetricGroupId,
  type WorkforceMetricId,
} from './workforceMetricCatalog';
import { useWorkforceDistrictCode } from './useWorkforceDistrictCode';

interface Props {
  groupId: WorkforceMetricGroupId;
  districtCode?: string;
}

function GroupTile({
  title,
  value,
  hint,
  to,
  tone = 'default',
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  to: string;
  tone?: 'default' | 'warn' | 'good';
}) {
  const toneClass =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50/60'
      : tone === 'good'
        ? 'border-green-200 bg-green-50/60'
        : 'border-slate-200 bg-white';

  return (
    <Link to={to} className="block h-full">
      <Card className={`h-full ${toneClass}`}>
        <CardContent className="flex h-full flex-col gap-2 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</div>
          <div className="text-2xl font-semibold text-gray-900">{value}</div>
          {hint ? <p className="text-xs text-gray-600">{hint}</p> : null}
        </CardContent>
      </Card>
    </Link>
  );
}

export function WorkforceMetricGroupCard({ groupId, districtCode }: Props) {
  const resolvedDistrict = useWorkforceDistrictCode(districtCode);
  const group = getWorkforceMetricGroupById(groupId);
  const continuityQuery = useWorkforceContinuity(resolvedDistrict || undefined);
  const widgetQuery = useWorkforceWidgetSummary(resolvedDistrict || undefined);

  if (!group) {
    return <div className="text-sm text-gray-500">Unknown workforce group: {groupId}</div>;
  }

  if (!resolvedDistrict) {
    return (
      <div className="text-sm text-gray-500">
        Select a district on Workforce Continuity to populate this widget.
      </div>
    );
  }

  if (continuityQuery.isLoading || widgetQuery.isLoading) {
    return <div className="text-sm text-gray-500">Loading {group.title}…</div>;
  }

  if (continuityQuery.isError) {
    return <div className="text-sm text-red-600">Could not load {group.title}.</div>;
  }

  const sources = {
    scorecard: continuityQuery.data?.scorecard,
    widgetSummary: widgetQuery.data,
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{group.title}</h3>
        <p className="text-xs text-gray-500">{group.description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {group.metricIds.map((metricId: WorkforceMetricId) => {
          const metric = getWorkforceMetricById(metricId);
          if (!metric) return null;
          const value = resolveMetricValue(metricId, sources);
          const tone = resolveMetricTone(metric, value);
          const hint = resolveMetricHint(metricId, sources);
          return (
            <GroupTile
              key={metricId}
              title={metric.title}
              value={formatMetricValue(value, metric.format)}
              hint={hint}
              to={metric.linkTo}
              tone={tone}
            />
          );
        })}
      </div>
      <Link
        to={group.linkTo}
        className="inline-block text-xs font-medium text-blue-600 hover:text-blue-800"
      >
        View in Workforce Continuity →
      </Link>
    </div>
  );
}
