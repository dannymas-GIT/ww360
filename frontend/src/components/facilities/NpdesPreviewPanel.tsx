/**
 * In-app NPDES preview — surface live EPA DFR detail for one wastewater permit.
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
import type {
  NpdesPreview,
  NpdesPreviewEffluentParameter,
  NpdesPreviewFormalAction,
  NpdesPreviewNotice,
} from '@/services/npdesService';

function dash(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function flow(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} MGD`;
}

function MetaGrid({ items }: { items: { label: string; value: unknown }[] }) {
  return (
    <div className="mt-2 grid gap-1 text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(item => (
        <p key={item.label} className="break-words">
          <span className="text-slate-500">{item.label}:</span> {dash(item.value)}
        </p>
      ))}
    </div>
  );
}

function EffluentParametersTable({ rows }: { rows: NpdesPreviewEffluentParameter[] }) {
  const getValue = useCallback((row: NpdesPreviewEffluentParameter, key: string) => {
    switch (key) {
      case 'parameter':
        return row.name;
      case 'outfall':
        return row.discharge_point;
      case 'location':
        return row.monitoring_location;
      case 'measure':
        return row.measurement_type;
      case 'quarters':
        return row.quarters.length;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: NpdesPreviewEffluentParameter) =>
      [
        row.name,
        row.discharge_point,
        row.monitoring_location,
        row.measurement_type,
        ...row.quarters.map(q => `${q.label} ${q.status ?? ''} ${q.value ?? ''}`),
      ]
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
    rows,
    getValue,
    getSearchText,
    initialSortKey: 'parameter',
    initialSortDir: 'asc',
  });

  if (!rows.length) {
    return <p className="p-3 text-base text-slate-600">No effluent parameters returned.</p>;
  }

  return (
    <div className="space-y-3 p-3">
      <TableSearchFilter
        id="npdes-effluent-filter"
        value={filter}
        onChange={setFilter}
        placeholder="Filter parameters…"
        resultCount={resultCount}
        totalCount={totalCount}
      />
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[52rem] table-fixed">
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="parameter"
                label="Parameter"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[26%]"
              />
              <SortableTableHead
                column="outfall"
                label="Discharge point"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[14%]"
              />
              <SortableTableHead
                column="location"
                label="Monitoring location"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden w-[16%] lg:table-cell"
              />
              <SortableTableHead
                column="measure"
                label="Measurement"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden w-[14%] xl:table-cell"
              />
              <SortableTableHead
                column="quarters"
                label="Quarters"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[30%]"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((p, i) => (
              <TableRow key={`${p.name || 'param'}-${p.discharge_point || ''}-${i}`}>
                <TableCell className="align-top break-words pr-3 text-base font-medium">
                  {dash(p.name)}
                </TableCell>
                <TableCell className="align-top break-words text-base">
                  {dash(p.discharge_point)}
                </TableCell>
                <TableCell className="hidden align-top break-words text-base lg:table-cell">
                  {dash(p.monitoring_location)}
                </TableCell>
                <TableCell className="hidden align-top break-words text-base xl:table-cell">
                  {dash(p.measurement_type)}
                </TableCell>
                <TableCell className="align-top break-words text-base">
                  {p.quarters.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {p.quarters.map(q => (
                        <span
                          key={q.label}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-sm text-slate-800"
                        >
                          <span className="text-slate-500">{q.label}:</span>{' '}
                          {dash(q.status || q.value)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FormalActionsTable({ rows }: { rows: NpdesPreviewFormalAction[] }) {
  const getValue = useCallback((row: NpdesPreviewFormalAction, key: string) => {
    switch (key) {
      case 'date':
        return row.action_date;
      case 'type':
        return row.action_type;
      case 'description':
        return row.description;
      case 'agency':
        return row.agency;
      case 'penalty':
        return row.penalty;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: NpdesPreviewFormalAction) =>
      [row.action_id, row.action_date, row.action_type, row.description, row.agency, row.penalty]
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
    rows,
    getValue,
    getSearchText,
    initialSortKey: 'date',
    initialSortDir: 'desc',
  });

  if (!rows.length) {
    return <p className="p-3 text-base text-slate-600">No formal actions returned.</p>;
  }

  return (
    <div className="space-y-3 p-3">
      <TableSearchFilter
        id="npdes-formal-actions-filter"
        value={filter}
        onChange={setFilter}
        placeholder="Filter formal actions…"
        resultCount={resultCount}
        totalCount={totalCount}
      />
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[44rem] table-fixed">
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="date"
                label="Date"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[16%]"
              />
              <SortableTableHead
                column="type"
                label="Type"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[22%]"
              />
              <SortableTableHead
                column="description"
                label="Description"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[32%]"
              />
              <SortableTableHead
                column="agency"
                label="Agency"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[16%]"
              />
              <SortableTableHead
                column="penalty"
                label="Penalty"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[14%]"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((a, i) => (
              <TableRow key={`${a.action_id || 'action'}-${i}`}>
                <TableCell className="align-top whitespace-nowrap text-base">
                  {dash(a.action_date)}
                </TableCell>
                <TableCell className="align-top break-words text-base">
                  {dash(a.action_type)}
                </TableCell>
                <TableCell className="align-top break-words text-base">
                  {dash(a.description)}
                  {a.action_id ? (
                    <div className="mt-0.5 break-words font-mono text-sm text-slate-600">
                      {a.action_id}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="align-top break-words text-base">{dash(a.agency)}</TableCell>
                <TableCell className="align-top break-words text-base">{dash(a.penalty)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NoticesTable({ rows }: { rows: NpdesPreviewNotice[] }) {
  const getValue = useCallback((row: NpdesPreviewNotice, key: string) => {
    switch (key) {
      case 'date':
        return row.notice_date;
      case 'type':
        return row.notice_type;
      case 'description':
        return row.description;
      case 'agency':
        return row.agency;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: NpdesPreviewNotice) =>
      [row.notice_date, row.notice_type, row.description, row.agency]
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
    rows,
    getValue,
    getSearchText,
    initialSortKey: 'date',
    initialSortDir: 'desc',
  });

  if (!rows.length) {
    return <p className="p-3 text-base text-slate-600">No notices returned.</p>;
  }

  return (
    <div className="space-y-3 p-3">
      <TableSearchFilter
        id="npdes-notices-filter"
        value={filter}
        onChange={setFilter}
        placeholder="Filter notices…"
        resultCount={resultCount}
        totalCount={totalCount}
      />
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[40rem] table-fixed">
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="date"
                label="Date"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[18%]"
              />
              <SortableTableHead
                column="type"
                label="Type"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[24%]"
              />
              <SortableTableHead
                column="description"
                label="Description"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[38%]"
              />
              <SortableTableHead
                column="agency"
                label="Agency"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[20%]"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((n, i) => (
              <TableRow key={`${n.notice_date || 'notice'}-${i}`}>
                <TableCell className="align-top whitespace-nowrap text-base">
                  {dash(n.notice_date)}
                </TableCell>
                <TableCell className="align-top break-words text-base">
                  {dash(n.notice_type)}
                </TableCell>
                <TableCell className="align-top break-words text-base">
                  {dash(n.description)}
                </TableCell>
                <TableCell className="align-top break-words text-base">{dash(n.agency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function NpdesPreviewPanel({ preview }: { preview: NpdesPreview }) {
  const coordinates =
    preview.latitude != null && preview.longitude != null
      ? `${preview.latitude.toFixed(5)}, ${preview.longitude.toFixed(5)}`
      : null;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-sky-200 bg-sky-50/80 px-3 py-3 text-base leading-relaxed text-slate-800">
        <p className="break-words font-medium text-slate-900">
          <span className="font-mono">{preview.npdes_id}</span>
          {preview.facility_name ? ` — ${preview.facility_name}` : ''}
        </p>
        <MetaGrid
          items={[
            { label: 'State', value: preview.state_code },
            { label: 'County', value: preview.county },
            { label: 'EPA region', value: preview.epa_region },
            { label: 'Major/Minor', value: preview.major_minor },
            { label: 'Design flow', value: flow(preview.design_flow_mgd) },
            { label: 'Total design flow', value: flow(preview.total_design_flow) },
            { label: 'SNC', value: preview.snc },
            { label: 'Quarters in non-compliance', value: preview.qtrs_with_nc },
            { label: 'Plant class', value: preview.plant_class },
            { label: 'Permit type', value: preview.permit_type },
            { label: 'Facility type', value: preview.facility_type_code },
            { label: 'SIC code', value: preview.sic_code },
            { label: 'Owner type', value: preview.owner_type },
            { label: 'Permit effective', value: preview.permit_effective },
            { label: 'Permit expiration', value: preview.permit_expiration },
            { label: 'Coordinates', value: coordinates },
            { label: 'Data source', value: preview.source },
          ]}
        />
        {preview.address || preview.dfr_url ? (
          <div className="mt-3 border-t border-sky-200/80 pt-3 text-slate-700">
            {preview.address ? (
              <p className="break-words">
                <span className="text-slate-500">Address:</span> {preview.address}
              </p>
            ) : null}
            {preview.dfr_url ? (
              <p className="mt-1">
                <a
                  href={preview.dfr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-800 underline-offset-2 hover:underline"
                >
                  EPA Detailed Facility Report
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
        {preview.rnc_quarters.length ? (
          <div className="mt-3 border-t border-sky-200/80 pt-3">
            <p className="mb-2 font-medium text-slate-900">RNC compliance quarters</p>
            <div className="flex flex-wrap gap-2">
              {preview.rnc_quarters.map(q => (
                <span
                  key={q.label}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
                  title={q.period || undefined}
                >
                  <span className="text-slate-500">{q.label}:</span> {dash(q.status)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <p className="mt-2 text-sm text-slate-600">
          {preview.preview_only
            ? 'Session preview from EPA ECHO data — nothing is linked to a district.'
            : 'Linked facility data in WW360.'}
        </p>
        {preview.sections_present.length ? (
          <p className="mt-1 break-words text-sm text-slate-600">
            <span className="text-slate-500">DFR sections returned:</span>{' '}
            {preview.sections_present.join(', ')}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-base font-semibold text-slate-900">
          Effluent parameters ({preview.effluent_parameters.length})
        </h3>
        <div className="overflow-x-auto rounded-md border">
          <EffluentParametersTable rows={preview.effluent_parameters} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-base font-semibold text-slate-900">
            Formal actions ({preview.formal_actions.length})
          </h3>
          <div className="overflow-x-auto rounded-md border">
            <FormalActionsTable rows={preview.formal_actions} />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-base font-semibold text-slate-900">
            Notices ({preview.notices.length})
          </h3>
          <div className="overflow-x-auto rounded-md border">
            <NoticesTable rows={preview.notices} />
          </div>
        </div>
      </div>
    </div>
  );
}
