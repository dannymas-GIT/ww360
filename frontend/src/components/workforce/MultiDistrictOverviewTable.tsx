import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TableSearchFilter } from '@/components/ui/table-search-filter';
import { useTableControls } from '@/hooks/useTableControls';
import type { WorkforceContinuityScorecard } from '@/services/workforceSuccessionService';
import React, { useCallback } from 'react';

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

  const getValue = useCallback(
    (row: WorkforceContinuityScorecard, key: string) => {
      switch (key) {
        case 'utility':
          return districtNames?.[row.district_code] || row.district_code;
        case 'readiness':
          return row.readiness_score;
        case 'coverage':
          return row.coverage_pct;
        case 'staff':
          return row.total_employees;
        case 'vacancies':
          return row.vacant_positions;
        case 'cert_cliff':
          return row.cert_cliff_90d;
        case 'retirement':
          return row.employees_retirement_eligible_24mo;
        default:
          return null;
      }
    },
    [districtNames]
  );

  const getSearchText = useCallback(
    (row: WorkforceContinuityScorecard) =>
      [
        districtNames?.[row.district_code] || row.district_code,
        row.district_code,
        row.readiness_score,
        row.coverage_pct,
        row.total_employees,
        row.vacant_positions,
        row.cert_cliff_90d,
        row.employees_retirement_eligible_24mo,
      ]
        .filter(v => v != null && v !== '')
        .join(' '),
    [districtNames]
  );

  const {
    rows,
    sortKey,
    sortDir,
    toggleSort,
    filter,
    setFilter,
    resultCount,
    totalCount,
  } = useTableControls({
    rows: scorecards,
    getValue,
    getSearchText,
    initialSortKey: 'utility',
    initialSortDir: 'asc',
  });

  if (!scorecards.length) {
    return (
      <p className="text-[1.125rem] text-slate-600">
        No utility scorecards available yet for this state.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <TableSearchFilter
        id="multi-district-overview-filter"
        value={filter}
        onChange={setFilter}
        placeholder="Filter utilities…"
        resultCount={resultCount}
        totalCount={totalCount}
      />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="utility"
                label="Utility"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className={headClass}
              />
              <SortableTableHead
                column="readiness"
                label="Readiness"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className={headClass}
              />
              <SortableTableHead
                column="coverage"
                label="Coverage"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className={headClass}
              />
              <SortableTableHead
                column="staff"
                label="Staff"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className={headClass}
              />
              <SortableTableHead
                column="vacancies"
                label="Vacancies"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className={headClass}
              />
              <SortableTableHead
                column="cert_cliff"
                label="Cert cliff (90d)"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className={headClass}
              />
              <SortableTableHead
                column="retirement"
                label="Retirement (24mo)"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className={headClass}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(s => {
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
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-base text-slate-500">
                  No utilities match your filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
