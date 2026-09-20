import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Factory, RefreshCw } from 'lucide-react';
import { Ww360EmptyState } from '@/components/ww360/Ww360EmptyState';
import { Ww360DataModeBadgeLight } from '@/components/ww360/Ww360DataModeBadge';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Ww360StatTile } from '@/components/ww360/Ww360KpiTile';
import { Button } from '@/components/ui/button';
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
import { trackEvent } from '@/lib/ga4';
import { useJurisdiction } from '@/context/JurisdictionContext';
import { NpdesPreviewPanel } from '@/components/facilities/NpdesPreviewPanel';
import {
  fetchNpdesLandscape,
  fetchNpdesPreview,
  type NpdesFacility,
  type NpdesPreview,
} from '@/services/npdesService';
import SdwisLandscapePage from '@/pages/sdwis/SdwisLandscapePage';

type FacilityProgram = 'dw' | 'ww';

function formatDesignFlow(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} MGD`;
}

function formatMajorMinor(value: string | null | undefined): string {
  if (!value) return '—';
  const v = value.trim().toUpperCase();
  if (v === 'MAJOR') return 'Major';
  if (v === 'MINOR') return 'Minor';
  return value;
}

function formatSnc(value: string | null | undefined): string {
  if (!value) return '—';
  const v = value.trim().toLowerCase();
  if (v === 'no' || v === 'n') return 'No';
  if (v === 'yes' || v === 'y') return 'Yes';
  return value;
}

function facilitySortValue(row: NpdesFacility, key: string): unknown {
  switch (key) {
    case 'npdes_id':
      return row.npdes_id;
    case 'name':
      return row.facility_name || '';
    case 'county':
      return row.county || '';
    case 'major_minor':
      return formatMajorMinor(row.major_minor);
    case 'design_flow':
      return row.design_flow_mgd ?? row.total_design_flow ?? null;
    case 'plant_class':
      return row.plant_class || '';
    case 'snc':
      return formatSnc(row.snc);
    default:
      return null;
  }
}

function facilitySearchText(row: NpdesFacility): string {
  return [row.npdes_id, row.facility_name, row.county, row.plant_class]
    .filter(Boolean)
    .join(' ');
}

function ProgramToggle({
  program,
  onChange,
  variant = 'light',
}: {
  program: FacilityProgram;
  onChange: (next: FacilityProgram) => void;
  variant?: 'light' | 'dark';
}) {
  const shell =
    variant === 'dark'
      ? 'border-slate-300 bg-slate-50'
      : 'border-white/25 bg-white/10';
  const active = 'bg-white text-slate-900';
  const inactive =
    variant === 'dark'
      ? 'text-slate-700 hover:bg-slate-200'
      : 'text-white hover:bg-white/15';

  return (
    <div
      className={`inline-flex rounded-lg border p-1 ${shell}`}
      role="group"
      aria-label="Facility program"
    >
      <button
        type="button"
        className={`min-h-[44px] rounded-md px-4 text-base font-medium transition-colors md:min-h-9 ${
          program === 'dw' ? active : inactive
        }`}
        aria-pressed={program === 'dw'}
        onClick={() => onChange('dw')}
      >
        Drinking water
      </button>
      <button
        type="button"
        className={`min-h-[44px] rounded-md px-4 text-base font-medium transition-colors md:min-h-9 ${
          program === 'ww' ? active : inactive
        }`}
        aria-pressed={program === 'ww'}
        onClick={() => onChange('ww')}
      >
        Wastewater
      </button>
    </div>
  );
}

function WastewaterLandscape({ stateCode }: { stateCode: string }) {
  const [landscape, setLandscape] = useState<Awaited<ReturnType<typeof fetchNpdesLandscape>> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [majorOnly, setMajorOnly] = useState(false);
  const [countyFilter, setCountyFilter] = useState('all');
  const [selected, setSelected] = useState<NpdesFacility | null>(null);
  const [preview, setPreview] = useState<NpdesPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const clearPreview = () => {
    setSelected(null);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  const openPreview = (row: NpdesFacility) => {
    setSelected(row);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    void fetchNpdesPreview(row.npdes_id, row.state_code || stateCode)
      .then(data => {
        setPreview(data);
        trackEvent('npdes_viewed', { surface: 'preview', state: row.state_code || stateCode });
      })
      .catch(() => setPreviewError(`Could not load the EPA report for ${row.npdes_id}.`))
      .finally(() => setPreviewLoading(false));
  };

  const load = () => {
    setLoading(true);
    setError(null);
    void fetchNpdesLandscape(stateCode, {
      major_only: majorOnly,
      q: search.trim() || undefined,
      limit: 2000,
    })
      .then(data => {
        setLandscape(data);
        trackEvent('npdes_viewed', { surface: 'landscape', state: stateCode });
      })
      .catch(() => setError('Could not load NPDES wastewater landscape.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setCountyFilter('all');
    clearPreview();
    load();
  }, [stateCode, majorOnly]);

  const facilities = landscape?.facilities ?? [];

  const countyOptions = useMemo(() => {
    const counties = new Set<string>();
    for (const row of facilities) {
      const c = (row.county || '').trim();
      if (c) counties.add(c);
    }
    return [...counties].sort((a, b) => a.localeCompare(b));
  }, [facilities]);

  const filteredRows: NpdesFacility[] = useMemo(() => {
    let rows = [...facilities];
    if (countyFilter !== 'all') {
      rows = rows.filter(r => (r.county || '') === countyFilter);
    }
    return rows;
  }, [facilities, countyFilter]);

  const facilityTable = useTableControls<NpdesFacility>({
    rows: filteredRows,
    getValue: facilitySortValue,
    getSearchText: facilitySearchText,
  });

  const isEmpty = landscape && landscape.count === 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] border-slate-300 text-base md:min-h-9"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-[1.125rem] text-slate-500">Loading wastewater landscape…</p>
      ) : error ? (
        <Ww360EmptyState
          title={error}
          description="Run an NPDES state refresh from Administration → Settings if the cache is empty."
          actionLabel="Open Settings"
          actionHref="/admin/settings"
        />
      ) : isEmpty ? (
        <Ww360EmptyState
          title="NPDES landscape cache is empty"
          description={`Refresh the ${stateCode} POTW inventory from EPA ECHO to populate facility rows.`}
          actionLabel="Refresh landscape"
          actionHref="/admin/settings"
        />
      ) : landscape ? (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Ww360DataModeBadgeLight mode="live" />
              <span className="text-[0.875rem] leading-relaxed text-slate-600">
                EPA ICIS-NPDES · {stateCode} POTW inventory — not sample or demo metrics.
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Ww360StatTile label="Active POTWs" value={landscape.count.toLocaleString()} />
              <Ww360StatTile label="Major POTWs" value={landscape.major_count.toLocaleString()} />
              <Ww360StatTile
                label="Counties represented"
                value={countyOptions.length.toLocaleString()}
              />
            </div>
          </div>

          {selected ? (
            <Ww360Section
              tourId="npdes-preview"
              title={`Facility preview — ${selected.facility_name || selected.npdes_id}`}
              eyebrow="EPA ECHO · Detailed Facility Report"
              dataMode="live"
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] text-base md:min-h-9"
                  onClick={clearPreview}
                >
                  Back to facility list
                </Button>
              }
            >
              <div className="mb-4 grid gap-1 text-[1rem] text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
                <p className="break-words">
                  <span className="text-slate-500">Cached county:</span>{' '}
                  {selected.county || '—'}
                </p>
                <p className="break-words">
                  <span className="text-slate-500">Cached permit type:</span>{' '}
                  {selected.permit_type || '—'}
                </p>
                <p className="break-words">
                  <span className="text-slate-500">Cached facility type:</span>{' '}
                  {selected.facility_type_code || '—'}
                </p>
                <p className="break-words">
                  <span className="text-slate-500">Cached SIC code:</span>{' '}
                  {selected.sic_code || '—'}
                </p>
                <p className="break-words">
                  <span className="text-slate-500">Cached owner type:</span>{' '}
                  {selected.owner_type || '—'}
                </p>
                <p className="break-words">
                  <span className="text-slate-500">Cached permit window:</span>{' '}
                  {selected.permit_effective || '—'} → {selected.permit_expiration || '—'}
                </p>
                <p className="break-words">
                  <span className="text-slate-500">Cache refreshed:</span>{' '}
                  {selected.last_refreshed || '—'}
                </p>
              </div>
              {previewLoading ? (
                <p className="text-[1.125rem] text-slate-500">
                  Loading EPA report for {selected.npdes_id}…
                </p>
              ) : previewError ? (
                <div className="space-y-3">
                  <p className="text-[1rem] text-rose-700">{previewError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] text-base md:min-h-9"
                    onClick={() => openPreview(selected)}
                  >
                    Retry preview
                  </Button>
                </div>
              ) : preview ? (
                <NpdesPreviewPanel preview={preview} />
              ) : null}
            </Ww360Section>
          ) : null}

          <Ww360Section
            tourId="npdes-facilities"
            title="POTW facilities"
            eyebrow="EPA ICIS-NPDES · state cache"
            dataMode="live"
          >
            <div className="mb-4 flex flex-wrap items-end gap-3 px-1">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[1rem] text-slate-700">
                Search name or NPDES ID
                <input
                  type="search"
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-base"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') load();
                  }}
                  placeholder="Facility name or NPDES ID"
                />
              </label>
              <label className="flex min-w-[12rem] flex-col gap-1 text-[1rem] text-slate-700">
                County
                <select
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-base"
                  value={countyFilter}
                  onChange={e => setCountyFilter(e.target.value)}
                >
                  <option value="all">All counties</option>
                  {countyOptions.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-[1rem] text-slate-700 md:min-h-9">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={majorOnly}
                  onChange={e => setMajorOnly(e.target.checked)}
                />
                Major POTWs only
              </label>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] text-base md:min-h-9"
                onClick={load}
                disabled={loading}
              >
                Apply filters
              </Button>
            </div>

            <TableSearchFilter
              id="potw-table-filter"
              className="mb-3 px-1"
              value={facilityTable.filter}
              onChange={facilityTable.setFilter}
              placeholder="Filter loaded facilities…"
              resultCount={facilityTable.resultCount}
              totalCount={facilityTable.totalCount}
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      column="npdes_id"
                      label="NPDES ID"
                      sortKey={facilityTable.sortKey}
                      sortDir={facilityTable.sortDir}
                      onSort={facilityTable.toggleSort}
                    />
                    <SortableTableHead
                      column="name"
                      label="Facility name"
                      sortKey={facilityTable.sortKey}
                      sortDir={facilityTable.sortDir}
                      onSort={facilityTable.toggleSort}
                    />
                    <SortableTableHead
                      column="county"
                      label="County"
                      sortKey={facilityTable.sortKey}
                      sortDir={facilityTable.sortDir}
                      onSort={facilityTable.toggleSort}
                    />
                    <SortableTableHead
                      column="major_minor"
                      label="Major/Minor"
                      sortKey={facilityTable.sortKey}
                      sortDir={facilityTable.sortDir}
                      onSort={facilityTable.toggleSort}
                    />
                    <SortableTableHead
                      column="design_flow"
                      label="Design flow"
                      align="right"
                      sortKey={facilityTable.sortKey}
                      sortDir={facilityTable.sortDir}
                      onSort={facilityTable.toggleSort}
                    />
                    <SortableTableHead
                      column="plant_class"
                      label="Plant class"
                      sortKey={facilityTable.sortKey}
                      sortDir={facilityTable.sortDir}
                      onSort={facilityTable.toggleSort}
                    />
                    <SortableTableHead
                      column="snc"
                      label="SNC"
                      sortKey={facilityTable.sortKey}
                      sortDir={facilityTable.sortDir}
                      onSort={facilityTable.toggleSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facilityTable.rows.map(row => (
                    <TableRow
                      key={row.npdes_id}
                      onClick={() => openPreview(row)}
                      aria-selected={selected?.npdes_id === row.npdes_id}
                      className={`cursor-pointer hover:bg-sky-50 ${
                        selected?.npdes_id === row.npdes_id ? 'bg-sky-50' : ''
                      }`}
                    >
                      <TableCell className="font-mono text-[1rem]">
                        <button
                          type="button"
                          className="min-h-[44px] rounded px-1 text-left font-mono text-[1rem] text-sky-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 md:min-h-9"
                          onClick={e => {
                            e.stopPropagation();
                            openPreview(row);
                          }}
                          aria-label={`Preview EPA report for ${row.npdes_id}`}
                        >
                          {row.npdes_id}
                        </button>
                      </TableCell>
                      <TableCell className="break-words font-medium">
                        {row.facility_name || '—'}
                      </TableCell>
                      <TableCell className="break-words">{row.county || '—'}</TableCell>
                      <TableCell>{formatMajorMinor(row.major_minor)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDesignFlow(row.design_flow_mgd ?? row.total_design_flow)}
                      </TableCell>
                      <TableCell>{row.plant_class || '—'}</TableCell>
                      <TableCell>{formatSnc(row.snc)}</TableCell>
                    </TableRow>
                  ))}
                  {!facilityTable.rows.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-[1rem] text-slate-500">
                        No POTW facilities match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 px-1 text-[0.875rem] leading-relaxed text-slate-600">
              Showing {facilityTable.resultCount.toLocaleString()} of{' '}
              {landscape.count.toLocaleString()} cached POTWs for {stateCode}.
            </p>
          </Ww360Section>
        </>
      ) : null}
    </>
  );
}

export default function FacilitiesLandscapePage() {
  const { activeState, pack } = useJurisdiction();
  const [searchParams, setSearchParams] = useSearchParams();
  const program: FacilityProgram = searchParams.get('program') === 'ww' ? 'ww' : 'dw';

  const setProgram = (next: FacilityProgram) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'dw') {
      params.delete('program');
    } else {
      params.set('program', 'ww');
    }
    setSearchParams(params, { replace: true });
  };

  if (program === 'dw') {
    return (
      <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-[1rem] text-slate-700">
            <Factory className="h-5 w-5" aria-hidden />
            <span className="font-medium">Facilities program</span>
          </div>
          <ProgramToggle program={program} onChange={setProgram} variant="dark" />
        </div>
        <SdwisLandscapePage embedded />
      </div>
    );
  }

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="EPA ICIS-NPDES · ECHO"
        title="Facilities landscape"
        description={
          pack?.landscape_description_wastewater ??
          `State view for ${activeState} — POTW inventory from EPA NPDES with major/minor status, design flow, and SNC flags.`
        }
        dataMode="live"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ProgramToggle program={program} onChange={setProgram} />
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] border-white/20 bg-white/5 text-base text-white hover:bg-white/15 md:min-h-9"
              asChild
            >
              <Link to="/water-systems/lookup">System lookup</Link>
            </Button>
          </div>
        }
      />

      <WastewaterLandscape stateCode={activeState} />
    </div>
  );
}
