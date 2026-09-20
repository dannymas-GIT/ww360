import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WorkforceContinuityScorecard } from '@/services/workforceSuccessionService';
import React, { useMemo } from 'react';

export interface MultiDistrictOverviewTableProps {
  scorecards: WorkforceContinuityScorecard[];
  /** Optional code → display name map (falls back to district_code). */
  districtNames?: Record<string, string>;
  onRowClick?: (districtCode: string) => void;
  compact?: boolean;
  /** Highlight the currently selected district row. */
  selectedDistrictCode?: string | null;
}

function readinessTone(score: number): string {
  if (score >= 80) return 'text-emerald-700';
  if (score >= 60) return 'text-slate-800';
  if (score >= 40) return 'text-amber-700';
  return 'text-red-700';
}

export const MultiDistrictOverviewTable: React.FC<MultiDistrictOverviewTableProps> = ({
  scorecards,
  districtNames,
  onRowClick,
  compact = false,
  selectedDistrictCode,
}) => {
  const cellClass = compact ? 'py-2 text-base' : 'text-base';
  const headClass = compact ? 'text-base' : 'text-base';

  const sorted = useMemo(
    () =>
      [...scorecards].sort((a, b) => {
        const na = (districtNames?.[a.district_code] || a.district_code).toLowerCase();
        const nb = (districtNames?.[b.district_code] || b.district_code).toLowerCase();
        return na.localeCompare(nb);
      }),
    [scorecards, districtNames]
  );

  if (!sorted.length) {
    return (
      <p className="text-[1.125rem] text-slate-600">
        No utility scorecards available yet for this state.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={headClass}>Utility</TableHead>
            <TableHead className={headClass}>Readiness</TableHead>
            <TableHead className={headClass}>Coverage</TableHead>
            <TableHead className={headClass}>Staff</TableHead>
            <TableHead className={headClass}>Vacancies</TableHead>
            <TableHead className={headClass}>Cert cliff (90d)</TableHead>
            <TableHead className={headClass}>Retirement (24mo)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(s => {
            const selected = selectedDistrictCode === s.district_code;
            return (
              <TableRow
                key={s.district_code}
                className={
                  onRowClick
                    ? `cursor-pointer hover:bg-sky-50 ${selected ? 'bg-sky-50/80' : ''}`
                    : selected
                      ? 'bg-sky-50/80'
                      : undefined
                }
                onClick={onRowClick ? () => onRowClick(s.district_code) : undefined}
              >
                <TableCell className={`${cellClass} font-medium text-slate-900`}>
                  <div>{districtNames?.[s.district_code] || s.district_code}</div>
                  {districtNames?.[s.district_code] ? (
                    <div className="text-[0.875rem] font-normal text-slate-500">
                      {s.district_code}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell
                  className={`${cellClass} font-semibold tabular-nums ${readinessTone(
                    Number(s.readiness_score) || 0
                  )}`}
                >
                  {s.readiness_score}
                </TableCell>
                <TableCell className={`${cellClass} tabular-nums`}>{s.coverage_pct}%</TableCell>
                <TableCell className={`${cellClass} tabular-nums`}>
                  {s.total_employees}
                </TableCell>
                <TableCell className={`${cellClass} tabular-nums`}>
                  {s.vacant_positions}
                </TableCell>
                <TableCell className={`${cellClass} tabular-nums`}>{s.cert_cliff_90d}</TableCell>
                <TableCell className={`${cellClass} tabular-nums`}>
                  {s.employees_retirement_eligible_24mo}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
