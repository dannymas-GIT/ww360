import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WorkforceContinuityScorecard } from '@/services/workforceSuccessionService';
import React from 'react';

export interface MultiDistrictOverviewTableProps {
  scorecards: WorkforceContinuityScorecard[];
  onRowClick?: (districtCode: string) => void;
  compact?: boolean;
}

export const MultiDistrictOverviewTable: React.FC<MultiDistrictOverviewTableProps> = ({
  scorecards,
  onRowClick,
  compact = false,
}) => {
  const cellClass = compact ? 'py-2 text-xs' : undefined;
  const headClass = compact ? 'text-xs' : undefined;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={headClass}>District</TableHead>
          <TableHead className={headClass}>Readiness</TableHead>
          <TableHead className={headClass}>Coverage</TableHead>
          <TableHead className={headClass}>Cert cliff (90d)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {scorecards.map(s => (
          <TableRow
            key={s.district_code}
            className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : undefined}
            onClick={onRowClick ? () => onRowClick(s.district_code) : undefined}
          >
            <TableCell className={cellClass}>{s.district_code}</TableCell>
            <TableCell className={cellClass}>{s.readiness_score}</TableCell>
            <TableCell className={cellClass}>{s.coverage_pct}%</TableCell>
            <TableCell className={cellClass}>{s.cert_cliff_90d}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
