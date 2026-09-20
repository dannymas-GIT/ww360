import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Ww360StatTile } from '@/components/ww360/Ww360KpiTile';
import {
  fetchStateSystemsByCounty,
  type SDWISStateSystem,
} from '@/services/sdwisService';

function flagYes(v: string | null | undefined): boolean {
  const s = String(v || '')
    .trim()
    .toLowerCase();
  return s === 'y' || s === 'yes' || s === 'true' || s === '1';
}

/** Align with backend SIZE_TIERS in sdwis_workforce_insights. */
function tierForPopulation(pop: number | null | undefined): string {
  const p = pop ?? 0;
  if (p < 500) return 'very_small';
  if (p < 3300) return 'small';
  if (p < 10000) return 'medium';
  if (p < 100000) return 'large';
  return 'very_large';
}

const GRADE_FROM_TIER: Record<string, Record<string, number>> = {
  very_small: { D: 1 },
  small: { C: 1, D: 1 },
  medium: { B: 1, C: 1 },
  large: { A: 1, B: 1 },
  very_large: { A: 2, B: 1 },
};

export interface CountyUtilitiesCardProps {
  county: string;
  stateCode: string;
  regionLabel?: string | null;
  /** Seed metrics from the pressure row while systems load. */
  summary?: {
    systems?: number | null;
    health?: number | null;
    snc?: number | null;
  };
  onBack: () => void;
}

/**
 * County-scoped utilities card. KPIs / size tiers / grade demand are computed
 * from systems returned for this county only — never statewide totals.
 */
export function CountyUtilitiesCard({
  county,
  stateCode,
  regionLabel,
  summary,
  onBack,
}: CountyUtilitiesCardProps) {
  const [systems, setSystems] = useState<SDWISStateSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSystems([]);
    void fetchStateSystemsByCounty(county, stateCode)
      .then(rows => {
        if (!cancelled) setSystems(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined;
        if (status === 404) {
          setError(
            'Utilities API is not available on this server yet (missing /sdwis/state-systems). Redeploy the backend to pick up the county drill-down endpoint.'
          );
        } else if (status === 401 || status === 403) {
          setError('Not authorized to load county utilities. Sign in again and retry.');
        } else {
          setError('Could not load utilities for this county.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [county, stateCode]);

  const getValue = useCallback((row: SDWISStateSystem, key: string) => {
    switch (key) {
      case 'pwsid':
        return row.pwsid;
      case 'name':
        return row.pws_name || '';
      case 'population':
        return row.population_served ?? 0;
      case 'health':
        return flagYes(row.health_flag) ? 1 : 0;
      case 'snc':
        return flagYes(row.snc) ? 1 : 0;
      default:
        return '';
    }
  }, []);

  const getSearchText = useCallback(
    (row: SDWISStateSystem) =>
      `${row.pwsid} ${row.pws_name || ''} ${row.population_served ?? ''}`,
    []
  );

  const table = useTableControls({
    rows: systems,
    getValue,
    getSearchText,
    initialSortKey: 'population',
    initialSortDir: 'desc',
  });

  const liveHealth = useMemo(
    () => systems.filter(s => flagYes(s.health_flag)).length,
    [systems]
  );
  const liveSnc = useMemo(() => systems.filter(s => flagYes(s.snc)).length, [systems]);
  const populationServed = useMemo(
    () => systems.reduce((sum, s) => sum + (s.population_served ?? 0), 0),
    [systems]
  );

  const sizeTiers = useMemo(() => {
    const counts: Record<string, number> = {
      very_small: 0,
      small: 0,
      medium: 0,
      large: 0,
      very_large: 0,
    };
    for (const s of systems) {
      counts[tierForPopulation(s.population_served)] += 1;
    }
    return Object.entries(counts).filter(([, n]) => n > 0);
  }, [systems]);

  const gradeDemand = useMemo(() => {
    const grades: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const s of systems) {
      const tier = tierForPopulation(s.population_served);
      for (const [grade, n] of Object.entries(GRADE_FROM_TIER[tier] || {})) {
        grades[grade] = (grades[grade] || 0) + n;
      }
    }
    return Object.entries(grades).filter(([, n]) => n > 0);
  }, [systems]);

  const systemsCount = loading ? (summary?.systems ?? 0) : systems.length;
  const healthCount = loading ? (summary?.health ?? 0) : liveHealth;
  const sncCount = loading ? (summary?.snc ?? 0) : liveSnc;

  return (
    <Ww360Section
      tourId="county-utilities-card"
      title={`${county} utilities`}
      eyebrow={
        regionLabel
          ? `${regionLabel} · live SDWIS inventory`
          : 'County utilities · live SDWIS inventory'
      }
      dataMode="live"
      sources={['sdwis']}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] text-base"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Back to counties
        </Button>
        <p className="text-[1rem] text-slate-600">
          Showing systems in {county} County ({stateCode}) only — not statewide totals.
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Ww360StatTile label="Systems" value={systemsCount.toLocaleString()} />
        <Ww360StatTile
          label="Population served"
          value={loading ? '…' : populationServed.toLocaleString()}
        />
        <Ww360StatTile label="Health flags" value={healthCount.toLocaleString()} />
        <Ww360StatTile label="SNC" value={sncCount.toLocaleString()} />
      </div>

      {!loading && !error && systems.length > 0 ? (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[1rem] font-semibold text-slate-800">Size tiers</h3>
            <p className="mb-2 text-[0.875rem] text-slate-600">
              From this county&apos;s population served.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell className="font-medium">Tier</TableCell>
                  <TableCell className="text-right font-medium">Systems</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sizeTiers.map(([tier, count]) => (
                  <TableRow key={tier}>
                    <TableCell>{tier}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <h3 className="mb-2 text-[1rem] font-semibold text-slate-800">
              Grade demand estimate
            </h3>
            <p className="mb-2 text-[0.875rem] text-slate-600">
              Planning estimate for this county only.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell className="font-medium">Grade</TableCell>
                  <TableCell className="text-right font-medium">Est. demand</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeDemand.map(([grade, count]) => (
                  <TableRow key={grade}>
                    <TableCell>{grade}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-[1.125rem] text-slate-500">Loading utilities…</p>
      ) : error ? (
        <p className="text-[1.125rem] text-red-600">{error}</p>
      ) : (
        <>
          <TableSearchFilter
            id={`county-utilities-filter-${county}`}
            className="mb-3"
            value={table.filter}
            onChange={table.setFilter}
            placeholder="Filter by name or PWSID…"
            resultCount={table.resultCount}
            totalCount={table.totalCount}
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    column="pwsid"
                    label="PWSID"
                    sortKey={table.sortKey}
                    sortDir={table.sortDir}
                    onSort={table.toggleSort}
                  />
                  <SortableTableHead
                    column="name"
                    label="System"
                    sortKey={table.sortKey}
                    sortDir={table.sortDir}
                    onSort={table.toggleSort}
                  />
                  <SortableTableHead
                    column="population"
                    label="Population"
                    align="right"
                    sortKey={table.sortKey}
                    sortDir={table.sortDir}
                    onSort={table.toggleSort}
                  />
                  <SortableTableHead
                    column="health"
                    label="Health"
                    align="right"
                    sortKey={table.sortKey}
                    sortDir={table.sortDir}
                    onSort={table.toggleSort}
                  />
                  <SortableTableHead
                    column="snc"
                    label="SNC"
                    align="right"
                    sortKey={table.sortKey}
                    sortDir={table.sortDir}
                    onSort={table.toggleSort}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map(row => (
                  <TableRow key={row.pwsid}>
                    <TableCell className="font-mono text-base">
                      <Link
                        to={`/water-systems/lookup?pwsid=${encodeURIComponent(row.pwsid)}`}
                        className="text-sky-800 underline-offset-2 hover:underline"
                      >
                        {row.pwsid}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{row.pws_name || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.population_served != null
                        ? row.population_served.toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {flagYes(row.health_flag) ? 'Yes' : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {flagYes(row.snc) ? 'Yes' : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!table.rows.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-[1rem] text-slate-500">
                      No cached systems found for {county}. Refresh the {stateCode} landscape from
                      Settings if the inventory is empty.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Ww360Section>
  );
}
