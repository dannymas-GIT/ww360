import React from 'react';
import {
  certProgramLabel,
  certProgramShortLabel,
  type ProgramSplitCounts,
} from '@/components/workforce/certProgramMetrics';

interface CertProgramBreakdownChipsProps {
  /** Label prefix, e.g. "CEU shortfall" or "Certs expiring (90d)" */
  metricLabel: string;
  counts: ProgramSplitCounts;
  className?: string;
}

/** Compact DW / WW split when both programs have data on the same metric. */
export const CertProgramBreakdownChips: React.FC<CertProgramBreakdownChipsProps> = ({
  metricLabel,
  counts,
  className = '',
}) => {
  if (!counts.hasBoth) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-[0.875rem] text-slate-600 ${className}`}
      aria-label={`${metricLabel} by certification program`}
    >
      <span className="font-medium text-slate-500">Program:</span>
      <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-900">
        {certProgramShortLabel('drinking_water')} {counts.drinking_water}
      </span>
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-900">
        {certProgramShortLabel('wastewater')} {counts.wastewater}
      </span>
      <span className="sr-only">
        {certProgramLabel('drinking_water')} {counts.drinking_water},{' '}
        {certProgramLabel('wastewater')} {counts.wastewater}
      </span>
    </div>
  );
};
