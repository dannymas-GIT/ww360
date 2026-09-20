/**
 * In-app SDWIS preview — surface full EPA DFR fields available from the preview API.
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
  SDWISPreview,
  SDWISPreviewEnforcement,
  SDWISPreviewViolation,
} from '@/services/sdwisService';

function dash(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function PreviewViolationsTable({ rows }: { rows: SDWISPreviewViolation[] }) {
  const getValue = useCallback((row: SDWISPreviewViolation, key: string) => {
    switch (key) {
      case 'rule':
        return row.contaminant_name || row.rule_name;
      case 'category':
        return row.category_desc || row.category_code;
      case 'measure':
        return row.violation_measure;
      case 'mcl':
        return row.federal_mcl || row.state_mcl;
      case 'period':
        return row.compliance_period_begin || row.non_compliance_begin;
      case 'status':
        return row.status;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: SDWISPreviewViolation) =>
      [
        row.contaminant_name,
        row.rule_name,
        row.category_desc,
        row.category_code,
        row.violation_measure,
        row.state_mcl,
        row.federal_mcl,
        row.status,
        row.compliance_period_begin,
        row.resolved_date,
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
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[52rem] table-fixed">
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="rule"
                label="Contaminant / rule"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[28%]"
              />
              <SortableTableHead
                column="category"
                label="Category"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[18%]"
              />
              <SortableTableHead
                column="measure"
                label="Measure"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden w-[12%] lg:table-cell"
              />
              <SortableTableHead
                column="mcl"
                label="MCL"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden w-[10%] md:table-cell"
              />
              <SortableTableHead
                column="period"
                label="Period"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden w-[16%] xl:table-cell"
              />
              <SortableTableHead
                column="status"
                label="Status"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[16%]"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map(v => (
              <TableRow key={v.violation_epa_id}>
                <TableCell className="align-top break-words pr-3 text-base">
                  <div className="font-medium">{dash(v.contaminant_name || v.rule_name)}</div>
                  {v.contaminant_name && v.rule_name && v.contaminant_name !== v.rule_name ? (
                    <div className="mt-0.5 break-words text-sm text-slate-600">{v.rule_name}</div>
                  ) : null}
                </TableCell>
                <TableCell className="align-top break-words text-base">
                  {dash(v.category_desc || v.category_code)}
                </TableCell>
                <TableCell className="hidden align-top break-words text-base lg:table-cell">
                  {dash(v.violation_measure)}
                </TableCell>
                <TableCell className="hidden align-top break-words text-base md:table-cell">
                  {dash(v.federal_mcl || v.state_mcl)}
                </TableCell>
                <TableCell className="hidden align-top text-base xl:table-cell">
                  <div>{dash(v.compliance_period_begin)}</div>
                  {v.resolved_date ? (
                    <div className="text-sm text-slate-600">Resolved {v.resolved_date}</div>
                  ) : null}
                </TableCell>
                <TableCell className="align-top whitespace-nowrap text-base">
                  {dash(v.status)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PreviewEnforcementTable({ rows }: { rows: SDWISPreviewEnforcement[] }) {
  const getValue = useCallback((row: SDWISPreviewEnforcement, key: string) => {
    switch (key) {
      case 'date':
        return row.action_date;
      case 'type':
        return row.enforcement_type;
      case 'description':
        return row.action_description;
      case 'agency':
        return row.agency;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: SDWISPreviewEnforcement) =>
      [row.action_date, row.enforcement_type, row.action_description, row.agency]
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
                className="w-[18%]"
              />
              <SortableTableHead
                column="description"
                label="Description"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="w-[44%]"
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
            {displayRows.map(e => (
              <TableRow key={e.enforcement_epa_id}>
                <TableCell className="align-top whitespace-nowrap text-base">
                  {dash(e.action_date)}
                </TableCell>
                <TableCell className="align-top break-words text-base">
                  {dash(e.enforcement_type)}
                </TableCell>
                <TableCell className="align-top break-words text-base">
                  {dash(e.action_description)}
                </TableCell>
                <TableCell className="align-top break-words text-base">{dash(e.agency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MetaGrid({ items }: { items: { label: string; value: unknown }[] }) {
  return (
    <div className="mt-2 grid gap-1 text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(item => (
        <p key={item.label}>
          <span className="text-slate-500">{item.label}:</span> {dash(item.value)}
        </p>
      ))}
    </div>
  );
}

export function PwsPreviewPanel({ preview }: { preview: SDWISPreview }) {
  const dfrUrl =
    preview.dfr_url ||
    (preview.pwsid
      ? `https://echo.epa.gov/detailed-facility-report?pwsid=${encodeURIComponent(preview.pwsid)}`
      : null);
  const address = [preview.facility_street, preview.facility_city, preview.facility_county]
    .filter(Boolean)
    .join(', ');
  const quarters = preview.compliance_quarters || [];
  const surveys = preview.sanitary_surveys || [];
  const visits = preview.site_visits || [];

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-sky-200 bg-sky-50/80 px-3 py-3 text-base leading-relaxed text-slate-800">
        <p className="font-medium text-slate-900">
          <span className="font-mono">{preview.pwsid}</span>
          {preview.pws_name ? ` — ${preview.pws_name}` : ''}
        </p>
        <MetaGrid
          items={[
            { label: 'State', value: preview.state_code },
            { label: 'EPA region', value: preview.epa_region },
            { label: 'Population', value: preview.population_served?.toLocaleString() },
            { label: 'Facility status', value: preview.facility_status },
            { label: 'SNC', value: preview.snc },
            { label: 'Health flag', value: preview.health_flag },
            { label: 'Serious violator', value: preview.serious_violator },
            { label: 'Qtrs with violation', value: preview.qtrs_with_vio },
            { label: 'Qtrs with SNC', value: preview.qtrs_with_snc },
            { label: 'Violations (all)', value: preview.violation_count },
            { label: 'Open violations', value: preview.open_violation_count },
            { label: 'Enforcement actions', value: preview.enforcement_count },
            { label: 'Data source', value: preview.source },
          ]}
        />
        <div className="mt-3 border-t border-sky-200/80 pt-3 text-slate-700">
          <p className="break-words">
            <span className="text-slate-500">Address:</span>{' '}
            {address ? `${address}${preview.facility_zip ? ` ${preview.facility_zip}` : ''}` : '—'}
          </p>
          <p className="mt-1 break-words">
            <span className="text-slate-500">Universe:</span> {dash(preview.universe_summary)}
          </p>
          <p className="mt-1">
            {dfrUrl ? (
              <a
                href={dfrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-800 underline-offset-2 hover:underline"
              >
                Open EPA Detailed Facility Report
              </a>
            ) : (
              <span className="text-slate-500">EPA Detailed Facility Report: —</span>
            )}
          </p>
        </div>
        <div className="mt-3 border-t border-sky-200/80 pt-3">
          <p className="mb-2 font-medium text-slate-900">Compliance quarters</p>
          {quarters.length ? (
            <div className="flex flex-wrap gap-2">
              {quarters.map(q => (
                <span
                  key={q.label}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
                  title={q.period || undefined}
                >
                  <span className="text-slate-500">{q.label}:</span> {dash(q.status)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No quarter strip returned for this system.</p>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {preview.preview_only
            ? 'Session preview from EPA data — not linked to your district.'
            : 'Linked system data in WW360.'}
          {preview.is_linked ? ' This PWSID is linked for a utility district.' : ''}{' '}
          Scroll for sanitary surveys, site visits, and full violation / enforcement tables.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-base font-semibold text-slate-900">
          Sanitary surveys ({surveys.length})
        </h3>
        {surveys.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table className="w-full min-w-[32rem]">
              <TableHeader>
                <TableRow>
                  <TableCell className="font-semibold">Date</TableCell>
                  <TableCell className="font-semibold">Type</TableCell>
                  <TableCell className="font-semibold">Result / notes</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surveys.map((s, i) => (
                  <TableRow key={`${s.survey_date || 's'}-${i}`}>
                    <TableCell className="align-top whitespace-nowrap text-base">
                      {dash(s.survey_date)}
                    </TableCell>
                    <TableCell className="align-top break-words text-base">
                      {dash(s.survey_type)}
                    </TableCell>
                    <TableCell className="align-top break-words text-base">
                      {dash(s.result || s.notes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-base text-slate-600">
            No sanitary surveys in the EPA report for this PWSID.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-base font-semibold text-slate-900">
          Site visits ({visits.length})
        </h3>
        {visits.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table className="w-full min-w-[28rem]">
              <TableHeader>
                <TableRow>
                  <TableCell className="font-semibold">Date</TableCell>
                  <TableCell className="font-semibold">Reason</TableCell>
                  <TableCell className="font-semibold">Agency</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((s, i) => (
                  <TableRow key={`${s.visit_date || 'v'}-${i}`}>
                    <TableCell className="align-top whitespace-nowrap text-base">
                      {dash(s.visit_date)}
                    </TableCell>
                    <TableCell className="align-top break-words text-base">
                      {dash(s.reason)}
                    </TableCell>
                    <TableCell className="align-top break-words text-base">
                      {dash(s.agency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-base text-slate-600">
            No site visits in the EPA report for this PWSID.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-base font-semibold text-slate-900">
            Violations ({preview.violations.length})
          </h3>
          <div className="overflow-x-auto rounded-md border">
            <PreviewViolationsTable rows={preview.violations} />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-base font-semibold text-slate-900">
            Enforcement ({preview.enforcement_actions.length})
          </h3>
          <div className="overflow-x-auto rounded-md border">
            <PreviewEnforcementTable rows={preview.enforcement_actions} />
          </div>
        </div>
      </div>
    </div>
  );
}
