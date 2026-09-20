/**
 * In-app SDWIS preview — violations and enforcement without external EPA links.
 */
import { useCallback } from 'react';
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
import type { SDWISPreview } from '@/services/sdwisService';

type PreviewViolation = SDWISPreview['violations'][number];
type PreviewEnforcement = SDWISPreview['enforcement_actions'][number];

function PreviewViolationsTable({ rows }: { rows: PreviewViolation[] }) {
  const getValue = useCallback((row: PreviewViolation, key: string) => {
    switch (key) {
      case 'rule':
        return row.contaminant_name || row.rule_name;
      case 'category':
        return row.category_desc || row.category_code;
      case 'status':
        return row.status;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: PreviewViolation) =>
      [row.contaminant_name, row.rule_name, row.category_desc, row.category_code, row.status]
        .filter(v => v != null && v !== '')
        .join(' '),
    []
  );

  const {
    rows: displayRows,
    sortKey,
    sortDir,
    toggleSort,
    filter,
    setFilter,
    resultCount,
    totalCount,
  } = useTableControls({
    rows: rows.slice(0, 50),
    getValue,
    getSearchText,
    initialSortKey: 'rule',
    initialSortDir: 'asc',
  });

  if (!rows.length) {
    return <p className="p-3 text-base text-slate-600">No violations returned.</p>;
  }

  return (
    <div className="space-y-3 p-3">
      <TableSearchFilter
        id="preview-violations-filter"
        value={filter}
        onChange={setFilter}
        placeholder="Filter violations…"
        resultCount={resultCount}
        totalCount={totalCount}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column="rule"
              label="Contaminant / rule"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              className="min-w-[120px]"
            />
            <SortableTableHead
              column="category"
              label="Category"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              className="hidden md:table-cell"
            />
            <SortableTableHead
              column="status"
              label="Status"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map(v => (
            <TableRow key={v.violation_epa_id}>
              <TableCell className="max-w-[220px] align-top text-base">
                {v.contaminant_name || v.rule_name || '—'}
              </TableCell>
              <TableCell className="hidden md:table-cell text-base">
                {v.category_desc || v.category_code || '—'}
              </TableCell>
              <TableCell className="text-base">{v.status || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PreviewEnforcementTable({ rows }: { rows: PreviewEnforcement[] }) {
  const getValue = useCallback((row: PreviewEnforcement, key: string) => {
    switch (key) {
      case 'date':
        return row.action_date;
      case 'type':
        return row.enforcement_type;
      case 'description':
        return row.action_description;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: PreviewEnforcement) =>
      [row.action_date, row.enforcement_type, row.action_description]
        .filter(v => v != null && v !== '')
        .join(' '),
    []
  );

  const {
    rows: displayRows,
    sortKey,
    sortDir,
    toggleSort,
    filter,
    setFilter,
    resultCount,
    totalCount,
  } = useTableControls({
    rows: rows.slice(0, 50),
    getValue,
    getSearchText,
    initialSortKey: 'date',
    initialSortDir: 'desc',
  });

  if (!rows.length) {
    return <p className="p-3 text-base text-slate-600">No enforcement actions returned.</p>;
  }

  return (
    <div className="space-y-3 p-3">
      <TableSearchFilter
        id="preview-enforcement-filter"
        value={filter}
        onChange={setFilter}
        placeholder="Filter enforcement…"
        resultCount={resultCount}
        totalCount={totalCount}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column="date"
              label="Date"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
            <SortableTableHead
              column="type"
              label="Type"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
            <SortableTableHead
              column="description"
              label="Description"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map(e => (
            <TableRow key={e.enforcement_epa_id}>
              <TableCell className="whitespace-nowrap text-base">
                {e.action_date || '—'}
              </TableCell>
              <TableCell className="text-base">{e.enforcement_type || '—'}</TableCell>
              <TableCell className="max-w-[220px] text-base">
                {e.action_description || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PwsPreviewPanel({ preview }: { preview: SDWISPreview }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-sky-200 bg-sky-50/80 px-3 py-3 text-base leading-relaxed text-slate-800">
        <p className="font-medium text-slate-900">
          <span className="font-mono">{preview.pwsid}</span>
          {preview.pws_name ? ` — ${preview.pws_name}` : ''}
        </p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3 text-slate-700">
          <p>State: {preview.state_code || '—'}</p>
          <p>Population: {preview.population_served ?? '—'}</p>
          <p>SNC: {preview.snc ?? '—'}</p>
          <p>Health flag: {preview.health_flag ?? '—'}</p>
          <p>Facility status: {preview.facility_status ?? '—'}</p>
          <p>Open violations: {preview.open_violation_count}</p>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {preview.preview_only
            ? 'Session preview from EPA data — not linked to your district.'
            : 'Linked system data in WW360.'}
          {preview.is_linked ? ' This PWSID is linked for a utility district.' : ''}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-base font-semibold text-slate-900">Violations</h3>
          <div className="overflow-x-auto rounded-md border">
            <PreviewViolationsTable rows={preview.violations} />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-base font-semibold text-slate-900">Enforcement</h3>
          <div className="overflow-x-auto rounded-md border">
            <PreviewEnforcementTable rows={preview.enforcement_actions} />
          </div>
        </div>
      </div>
    </div>
  );
}
