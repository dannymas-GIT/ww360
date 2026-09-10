import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { ww360ChartTooltipStyle } from '@/components/ww360/ww360ChartTooltip';
import type { ResolvedChart } from '@/services/metricResolver';

interface WorkspaceChartPanelProps {
  chart: ResolvedChart;
  color?: string;
  tourId?: string;
}

export const WorkspaceChartPanel: React.FC<WorkspaceChartPanelProps> = ({
  chart,
  color = '#2563eb',
  tourId,
}) => {
  const data = chart.points.map(p => ({ name: p.label, value: p.value }));

  return (
    <Ww360Section
      title={chart.title}
      description={chart.subtitle}
      dataMode={chart.resolvedMode}
      tourId={tourId}
    >
      <p className="mb-3 text-[0.875rem] text-slate-500">{chart.sourceNote}</p>
      <p className="mb-2 text-[0.875rem] font-medium text-slate-600">Source: {chart.source}</p>
      <div className="h-64 w-full" data-tour={tourId ? `${tourId}-chart` : undefined}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 14 }} />
            <YAxis tick={{ fontSize: 14 }} />
            <Tooltip contentStyle={ww360ChartTooltipStyle} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Ww360Section>
  );
};
