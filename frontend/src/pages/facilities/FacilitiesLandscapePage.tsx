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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trackEvent } from '@/lib/ga4';
import { useJurisdiction } from '@/context/JurisdictionContext';
import { fetchNpdesLandscape, type NpdesFacility } from '@/services/npdesService';
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

          <Ww360Section
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

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NPDES ID</TableHead>
                    <TableHead>Facility name</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>Major/Minor</TableHead>
                    <TableHead className="text-right">Design flow</TableHead>
                    <TableHead>Plant class</TableHead>
                    <TableHead>SNC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(row => (
                    <TableRow key={row.npdes_id}>
                      <TableCell className="font-mono text-[1rem]">{row.npdes_id}</TableCell>
                      <TableCell className="font-medium">{row.facility_name || '—'}</TableCell>
                      <TableCell>{row.county || '—'}</TableCell>
                      <TableCell>{formatMajorMinor(row.major_minor)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDesignFlow(row.design_flow_mgd ?? row.total_design_flow)}
                      </TableCell>
                      <TableCell>{row.plant_class || '—'}</TableCell>
                      <TableCell>{formatSnc(row.snc)}</TableCell>
                    </TableRow>
                  ))}
                  {!filteredRows.length && (
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
              Showing {filteredRows.length.toLocaleString()} of{' '}
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
