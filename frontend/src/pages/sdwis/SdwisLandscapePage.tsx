import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, RefreshCw } from 'lucide-react';
import { Ww360EmptyState } from '@/components/ww360/Ww360EmptyState';
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
import { fetchWorkforceInsights, type SDWISWorkforceInsights } from '@/services/sdwisService';

export default function SdwisLandscapePage() {
  const [insights, setInsights] = useState<SDWISWorkforceInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    void fetchWorkforceInsights('NY')
      .then(setInsights)
      .catch(() => setError('Could not load SDWIS landscape.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const counties = (insights?.compliance_pressure_by_county || []).slice(0, 25);
  const sizeTiers = insights?.size_tiers || {};
  const gradeDemand = insights?.grade_demand_estimate || {};
  const isEmpty =
    insights &&
    insights.active_cws_count === 0 &&
    !Object.keys(sizeTiers).length &&
    !counties.length;

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="EPA SDWIS · ECHO"
        title="Water system landscape"
        description="State view for New York — active community water systems, compliance pressure, and grade demand estimates."
        dataMode="live"
        lastSynced={insights?.last_refreshed}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              asChild
            >
              <Link to="/water-systems/watchlist">Watchlist</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
              asChild
            >
              <Link to="/water-systems/lookup">System lookup</Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-slate-500">Loading state landscape…</p>
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
          description="Refresh the NY SDWIS inventory from EPA ECHO to populate KPIs and county pressure."
          actionLabel="Refresh landscape"
          actionHref="/admin/settings"
        />
      ) : insights ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Ww360StatTile label="Active CWS" value={insights.active_cws_count.toLocaleString()} />
            <Ww360StatTile
              label="Population served"
              value={formatCompact(insights.total_population_served)}
            />
            <Ww360StatTile
              label="Health-based violations"
              value={insights.health_violation_systems.toLocaleString()}
            />
            <Ww360StatTile label="Serious / SNC" value={insights.snc_count.toLocaleString()} />
          </div>

          <p className="text-xs text-slate-500">
            Member coverage: {String(insights.coverage?.member_utilities ?? '—')} utilities ·{' '}
            {String(insights.coverage?.coverage_pct_population ?? '—')}% of state population
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <Ww360Section tourId="size-tiers" title="Size tiers" sources={['ww360']}>
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
                      <TableCell colSpan={2} className="text-slate-500 text-sm">
                        No size-tier data yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Ww360Section>

            <Ww360Section tourId="grade-demand" title="Grade demand estimate" sources={['ww360']}>
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
                      <TableCell colSpan={2} className="text-slate-500 text-sm">
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
            eyebrow="Regional view"
            sources={['ww360']}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead className="text-right">Systems</TableHead>
                    <TableHead className="text-right">Health violations</TableHead>
                    <TableHead className="text-right">SNC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counties.map((row, idx) => (
                    <TableRow key={String(row.county || idx)}>
                      <TableCell className="font-medium">{String(row.county || '—')}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {String(row.systems ?? row.system_count ?? '—')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {String(row.health_violations ?? row.health_violation_systems ?? '—')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {String(row.snc ?? row.snc_count ?? '—')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!counties.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-slate-500 text-sm">
                        No county pressure rows yet — refresh the NY landscape from Settings.
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
