import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleHelp, MapPin, RefreshCw } from 'lucide-react';
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
import { formatCompact } from '@/lib/format';
import { trackEvent } from '@/lib/ga4';
import { useJurisdiction } from '@/context/JurisdictionContext';
import { fetchWorkforceInsights, type SDWISWorkforceInsights } from '@/services/sdwisService';
import { LandscapeTourOverlay, requestOpenLandscapeTour } from './LandscapeTourOverlay';

export default function SdwisLandscapePage() {
  const { activeState, pack } = useJurisdiction();
  const [insights, setInsights] = useState<SDWISWorkforceInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countyFilter, setCountyFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  const regions = pack?.economic_regions ?? [];

  const selectedRegion = useMemo(
    () => regions.find(r => r.id === regionFilter) ?? null,
    [regions, regionFilter]
  );

  const regionCountySet = useMemo(() => {
    if (!selectedRegion?.counties?.length) return null;
    return new Set(selectedRegion.counties.map(c => c.trim().toLowerCase()));
  }, [selectedRegion]);

  const load = () => {
    setLoading(true);
    setError(null);
    void fetchWorkforceInsights(activeState)
      .then(data => {
        setInsights(data);
        trackEvent('sdwis_viewed', { surface: 'landscape', state: activeState });
      })
      .catch(() => setError('Could not load SDWIS landscape.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setCountyFilter('all');
    setRegionFilter('all');
    load();
  }, [activeState]);

  const allCounties = insights?.compliance_pressure_by_county || [];
  const sizeTiers = insights?.size_tiers || {};
  const gradeDemand = insights?.grade_demand_estimate || {};

  const countyOptions = useMemo(() => {
    let rows = [...allCounties];
    if (regionFilter !== 'all') {
      rows = rows.filter(r => String(r.economic_region_id || '') === regionFilter);
    }
    return rows
      .map(r => String(r.county || ''))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [allCounties, regionFilter]);

  const counties = useMemo(() => {
    let rows = [...allCounties];
    if (regionFilter !== 'all') {
      rows = rows.filter(r => String(r.economic_region_id || '') === regionFilter);
    } else if (regionCountySet) {
      // Fallback if API hasn't stamped region ids yet
      rows = rows.filter(r =>
        regionCountySet.has(String(r.county || '').trim().toLowerCase())
      );
    }
    if (countyFilter !== 'all') {
      rows = rows.filter(r => String(r.county || '') === countyFilter);
    }
    // Statewide default: top pressure; region/county filters show the full set.
    if (countyFilter === 'all' && regionFilter === 'all') {
      return rows.slice(0, 25);
    }
    return rows;
  }, [allCounties, countyFilter, regionFilter, regionCountySet]);

  // If county filter falls outside selected region, reset it.
  useEffect(() => {
    if (countyFilter === 'all' || regionFilter === 'all') return;
    const inRegion = allCounties.some(
      r =>
        String(r.county || '') === countyFilter &&
        String(r.economic_region_id || '') === regionFilter
    );
    if (!inRegion && regionCountySet && !regionCountySet.has(countyFilter.trim().toLowerCase())) {
      setCountyFilter('all');
    } else if (!inRegion && !regionCountySet) {
      setCountyFilter('all');
    }
  }, [countyFilter, regionFilter, allCounties, regionCountySet]);

  const isEmpty =
    insights &&
    insights.active_cws_count === 0 &&
    !Object.keys(sizeTiers).length &&
    !allCounties.length;

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <LandscapeTourOverlay autoOpen />
      <Ww360PageHero
        eyebrow="EPA SDWIS · ECHO"
        title="Water system landscape"
        description={
          pack?.landscape_description ??
          `State view for ${activeState} — live system inventory and compliance pressure, plus planning estimates for operator grade demand.`
        }
        dataMode="mixed"
        lastSynced={insights?.last_refreshed}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] border-white/20 bg-white/5 text-base text-white hover:bg-white/15 md:min-h-9"
              onClick={() => requestOpenLandscapeTour(0)}
            >
              <CircleHelp className="mr-1 h-4 w-4" />
              How to use this
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] border-white/20 bg-white/5 text-base text-white hover:bg-white/15 md:min-h-9"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] border-white/20 bg-white/5 text-base text-white hover:bg-white/15 md:min-h-9"
              asChild
            >
              <Link to="/water-systems/watchlist">Watchlist</Link>
            </Button>
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

      {loading ? (
        <p className="text-[1.125rem] text-slate-500">Loading state landscape…</p>
      ) : error ? (
        <Ww360EmptyState
          title={error}
          description="Run a state refresh from Administration → Settings if the cache is empty."
          actionLabel="Open Settings"
          actionHref="/admin/settings"
        />
      ) : isEmpty ? (
        <Ww360EmptyState
          title="Landscape cache is empty"
          description={`Refresh the ${activeState} SDWIS inventory from EPA ECHO to populate KPIs and county pressure.`}
          actionLabel="Refresh landscape"
          actionHref="/admin/settings"
        />
      ) : insights ? (
        <>
          <div className="space-y-2" data-tour="landscape-kpis">
            <div className="flex flex-wrap items-center gap-2">
              <Ww360DataModeBadgeLight
                mode="live"
                lastSynced={insights.last_refreshed}
              />
              <span className="text-[0.875rem] leading-relaxed text-slate-600">
                EPA SDWIS / ECHO · {activeState} inventory — not sample or demo metrics.
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Ww360StatTile
                label="Active CWS"
                value={insights.active_cws_count.toLocaleString()}
              />
              <Ww360StatTile
                label="Population served"
                value={formatCompact(insights.total_population_served)}
              />
              <Ww360StatTile
                label="Health-based violations"
                value={insights.health_violation_systems.toLocaleString()}
              />
              <Ww360StatTile
                label="Serious / SNC"
                value={insights.snc_count.toLocaleString()}
              />
            </div>
          </div>

          <p
            className="text-[0.875rem] leading-relaxed text-slate-600"
            data-tour="landscape-coverage"
          >
            Member coverage: {String(insights.coverage?.member_utilities ?? '—')} utilities ·{' '}
            {String(insights.coverage?.coverage_pct_population ?? '—')}% of state population.
            Link member PWSIDs to turn this from federal inventory into your section story.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <Ww360Section
              tourId="size-tiers"
              title="Size tiers"
              eyebrow="Live from population served"
              dataMode="live"
              sources={['sdwis']}
            >
              <p className="mb-3 px-1 text-[0.875rem] leading-relaxed text-slate-600">
                From live SDWIS population served — most systems are very small.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Systems</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(sizeTiers).map(([tier, count]) => (
                    <TableRow key={tier}>
                      <TableCell>{tier}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(count).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!Object.keys(sizeTiers).length && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-[1rem] text-slate-500">
                        No size-tier data yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Ww360Section>

            <Ww360Section
              tourId="grade-demand"
              title="Grade demand estimate"
              eyebrow="Planning estimate — not OpCert roster"
              dataMode="sample"
              sources={['ww360']}
            >
              <p className="mb-3 px-1 text-[0.875rem] leading-relaxed text-slate-600">
                Very small → Grade D seat; small → C+D; medium → B+C; large → A+B. Use for training
                pathway planning, not as “licensed operators today.”
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Est. demand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(gradeDemand).map(([grade, count]) => (
                    <TableRow key={grade}>
                      <TableCell>{grade}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(count).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!Object.keys(gradeDemand).length && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-[1rem] text-slate-500">
                        No grade-demand data yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Ww360Section>
          </div>

          <Ww360Section
            tourId="county-pressure"
            title="Compliance pressure by county"
            eyebrow="Targeting view · live SDWIS"
            dataMode="live"
            sources={['sdwis']}
          >
            <div
              className="mb-4 flex flex-wrap items-end gap-3"
              data-tour="landscape-region-filter"
            >
              <label className="flex min-w-[12rem] flex-col gap-1 text-[1rem] text-slate-700">
                County
                <select
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-base"
                  value={countyFilter}
                  onChange={e => setCountyFilter(e.target.value)}
                >
                  <option value="all">
                    {regionCountySet ? 'All counties in region' : 'All counties (top pressure)'}
                  </option>
                  {countyOptions.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              {regions.length > 0 && (
                <label className="flex min-w-[12rem] flex-col gap-1 text-[1rem] text-slate-700">
                  Economic region
                  <select
                    className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 text-base"
                    value={regionFilter}
                    onChange={e => {
                      setRegionFilter(e.target.value);
                      setCountyFilter('all');
                    }}
                  >
                    <option value="all">All regions</option>
                    {regions.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                        {r.counties?.length ? ` (${r.counties.length} counties)` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selectedRegion?.counties?.length ? (
                <p className="flex items-center gap-1 text-[0.875rem] text-slate-600">
                  <MapPin className="h-4 w-4" aria-hidden />
                  {selectedRegion.label} (REDC): {selectedRegion.counties.join(', ')}
                </p>
              ) : (
                <p className="text-[0.875rem] leading-relaxed text-slate-600">
                  Showing top 25 counties by compliance pressure. Pick an economic region to see
                  every county in that REDC geography.
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Systems</TableHead>
                    <TableHead className="text-right">Health violations</TableHead>
                    <TableHead className="text-right">SNC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counties.map((row, idx) => (
                    <TableRow key={String(row.county || idx)}>
                      <TableCell className="font-medium">{String(row.county || '—')}</TableCell>
                      <TableCell className="text-[1rem] text-slate-600">
                        {String(row.economic_region_label || '—')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {String(
                          row.linked_systems_count ?? row.systems ?? row.system_count ?? '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {String(
                          row.health_flag_count ??
                            row.health_violations ??
                            row.health_violation_systems ??
                            '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {String(row.snc_count ?? row.snc ?? '—')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!counties.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-[1rem] text-slate-500">
                        {`No county pressure rows yet — refresh the ${activeState} landscape from Settings.`}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Ww360Section>
        </>
      ) : null}
    </div>
  );
}
