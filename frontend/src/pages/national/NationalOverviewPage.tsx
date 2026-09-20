import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, Factory, Users } from 'lucide-react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Ww360KpiTile } from '@/components/ww360/Ww360KpiTile';
import { fetchNationalOverview, fetchKpis, type NationalOverview } from '@/services/nationalService';
import { formatCompact, formatUsd } from '@/pages/oww/owwMockData';
import { useKitchenSink } from '@/context/KitchenSinkContext';
import { useAuth } from '@/context/AuthContext';
import { personaKeyFromUser, resolveWorkspaceProfile } from '@/utils/workspaceProfile';
import { SimplifiedWorkspaceDashboard } from '@/pages/workspaces/SimplifiedWorkspaceDashboard';
import { UsajobsJobListingsPanel } from '@/pages/workspaces/UsajobsJobListingsPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TableSearchFilter } from '@/components/ui/table-search-filter';
import { useTableControls } from '@/hooks/useTableControls';

type StateRow = NationalOverview['states'][number];

export default function NationalOverviewPage() {
  const { user } = useAuth();
  const { kitchenSink } = useKitchenSink();
  const personaKey = personaKeyFromUser(user);
  const profile = resolveWorkspaceProfile(user, personaKey);

  if (!kitchenSink && (profile === 'national' || profile === 'regional')) {
    return <SimplifiedWorkspaceDashboard profile={profile} personaKey={personaKey} />;
  }

  return <NationalOverviewFull />;
}

function NationalOverviewFull() {
  const [data, setData] = useState<NationalOverview | null>(null);
  const [kpis, setKpis] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([fetchNationalOverview(), fetchKpis('us', 'US')])
      .then(([overview, kpiRows]) => {
        setData(overview);
        setKpis(kpiRows);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const headline = data?.headline_kpis;

  const potwTotals = useMemo(() => {
    const rows = data?.states || [];
    const hasPotw = rows.some(s => s.active_potws != null);
    if (!hasPotw) return null;
    return rows.reduce(
      (acc, s) => ({
        active: acc.active + (s.active_potws ?? 0),
        major: acc.major + (s.major_potws ?? 0),
      }),
      { active: 0, major: 0 }
    );
  }, [data]);

  const getValue = useCallback((row: StateRow, key: string) => {
    switch (key) {
      case 'state':
        return row.state_code;
      case 'cws':
        return row.active_cws;
      case 'potws':
        return row.active_potws;
      case 'major_potws':
        return row.major_potws;
      case 'health':
        return row.health_violations;
      case 'operators':
        return row.certified_operators;
      case 'dwsrf':
        return row.dwsrf_allotment_usd;
      default:
        return null;
    }
  }, []);

  const getSearchText = useCallback(
    (row: StateRow) =>
      [
        row.state_code,
        row.active_cws,
        row.active_potws,
        row.major_potws,
        row.health_violations,
        row.certified_operators,
        row.dwsrf_allotment_usd,
      ]
        .filter(v => v != null && v !== '')
        .join(' '),
    []
  );

  const stateTable = useTableControls({
    rows: data?.states ?? [],
    getValue,
    getSearchText,
    initialSortKey: 'cws',
    initialSortDir: 'desc',
  });

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="United States"
        title="National workforce & compliance overview"
        description="Five headline KPIs for EPA, ASDWA, and AWWA leadership — sourced from public federal data with provenance on every tile."
        dataMode="mixed"
      />

      {loading && <p className="text-[1.125rem] text-slate-500">Loading national metrics…</p>}

      {potwTotals && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Ww360KpiTile
            label="Active POTWs"
            value={formatCompact(potwTotals.active)}
            sub="EPA ICIS-NPDES cached inventory"
            dataMode="live"
            icon={<Factory className="h-4 w-4" />}
          />
          <Ww360KpiTile
            label="Major POTWs"
            value={formatCompact(potwTotals.major)}
            sub="Major NPDES facilities nationwide"
            dataMode="live"
            icon={<Factory className="h-4 w-4" />}
          />
        </div>
      )}

      {headline && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Ww360KpiTile
            label="Projected annual openings (BLS)"
            value={String(headline.workforce_replacement_gap?.annual_openings ?? '—')}
            sub={`${formatCompact(Number(headline.workforce_replacement_gap?.employment_2024))} → ${formatCompact(Number(headline.workforce_replacement_gap?.employment_2034))} (BLS projections — not live job postings)`}
            sources={['bls']}
            dataMode="live"
            icon={<Users className="h-4 w-4" />}
          />
          <Ww360KpiTile
            label="Systems per certified operator"
            value={String(headline.systems_per_certified_operator?.national_value ?? '—')}
            sub={`Roster: ${(headline.systems_per_certified_operator?.roster_states as string[])?.join(', ') || 'NY'}`}
            dataMode="mixed"
            icon={<Users className="h-4 w-4" />}
          />
          <Ww360KpiTile
            label="Compliance pressure"
            value={formatCompact(Number(headline.compliance_pressure?.health_violation_systems))}
            sub={`${formatCompact(Number(headline.compliance_pressure?.snc_systems))} SNC systems`}
            sources={['sdwis']}
            dataMode="live"
            icon={<Droplets className="h-4 w-4" />}
          />
          <Ww360KpiTile
            label="Regulatory workload (LSL)"
            value={formatCompact(Number(headline.regulatory_workload?.estimated_lead_service_lines))}
            sub="Estimated lead service lines (EPA LCRR)"
            dataMode="mixed"
            icon={<Droplets className="h-4 w-4" />}
          />
          <Ww360KpiTile
            label="Workforce grant pipeline"
            value={String(headline.investment_pipeline?.workforce_grant_opportunities ?? '—')}
            sub="Active Grants.gov opportunities"
            dataMode="live"
            icon={<Users className="h-4 w-4" />}
          />
        </div>
      )}

      {kpis.length > 0 && (
        <Ww360Section title="My KPIs" dataMode="live">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 px-5 pb-5">
            {kpis.map(k => (
              <div key={String(k.id)} className="rounded-lg border border-slate-200 p-4">
                <p className="text-base font-semibold text-slate-900">{String(k.label)}</p>
                <p className="text-[1.125rem] tabular-nums">
                  {k.current_value != null ? String(k.current_value) : '—'}
                  {k.target_value != null ? ` / target ${k.target_value}` : ''}
                </p>
              </div>
            ))}
          </div>
        </Ww360Section>
      )}

      <Ww360Section title="State comparison" dataMode="mixed">
        <div className="space-y-3 px-5 pb-5">
          <TableSearchFilter
            id="national-states-filter"
            value={stateTable.filter}
            onChange={stateTable.setFilter}
            placeholder="Filter states…"
            resultCount={stateTable.resultCount}
            totalCount={stateTable.totalCount}
          />
          <div className="overflow-x-auto">
            <Table className="min-w-[720px] text-base">
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    column="state"
                    label="State"
                    sortKey={stateTable.sortKey}
                    sortDir={stateTable.sortDir}
                    onSort={stateTable.toggleSort}
                  />
                  <SortableTableHead
                    column="cws"
                    label="CWS"
                    align="right"
                    sortKey={stateTable.sortKey}
                    sortDir={stateTable.sortDir}
                    onSort={stateTable.toggleSort}
                  />
                  <SortableTableHead
                    column="potws"
                    label="POTWs"
                    align="right"
                    sortKey={stateTable.sortKey}
                    sortDir={stateTable.sortDir}
                    onSort={stateTable.toggleSort}
                  />
                  <SortableTableHead
                    column="major_potws"
                    label="Major POTWs"
                    align="right"
                    sortKey={stateTable.sortKey}
                    sortDir={stateTable.sortDir}
                    onSort={stateTable.toggleSort}
                  />
                  <SortableTableHead
                    column="health"
                    label="Health violations"
                    align="right"
                    sortKey={stateTable.sortKey}
                    sortDir={stateTable.sortDir}
                    onSort={stateTable.toggleSort}
                  />
                  <SortableTableHead
                    column="operators"
                    label="Certified ops"
                    align="right"
                    sortKey={stateTable.sortKey}
                    sortDir={stateTable.sortDir}
                    onSort={stateTable.toggleSort}
                  />
                  <SortableTableHead
                    column="dwsrf"
                    label="DWSRF allotment"
                    align="right"
                    sortKey={stateTable.sortKey}
                    sortDir={stateTable.sortDir}
                    onSort={stateTable.toggleSort}
                  />
                  <TableHead className="w-[6rem]"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stateTable.rows.map(s => (
                  <TableRow key={s.state_code}>
                    <TableCell className="font-medium">{s.state_code}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCompact(s.active_cws)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.active_potws != null ? formatCompact(s.active_potws) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.major_potws != null ? formatCompact(s.major_potws) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCompact(s.health_violations)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.certified_operators != null ? formatCompact(s.certified_operators) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.dwsrf_allotment_usd ? formatUsd(s.dwsrf_allotment_usd) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link className="text-sky-700 underline" to={`/national/states/${s.state_code}`}>
                        Scorecard
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {!stateTable.rows.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-base text-slate-500">
                      No states match your filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Ww360Section>

      <UsajobsJobListingsPanel tourId="national-federal-jobs" />

      {data?.sources_freshness && (
        <Ww360Section title="Sources & freshness" dataMode="live">
          <ul className="space-y-2 px-5 pb-5 text-[1rem] text-slate-600">
            {data.sources_freshness.map(s => (
              <li key={s.source}>
                <strong>{s.source}</strong>
                {s.last_fetched ? ` — last fetched ${s.last_fetched}` : ''}
                {s.metric_count != null ? ` (${s.metric_count} metrics)` : ''}
              </li>
            ))}
          </ul>
        </Ww360Section>
      )}
    </div>
  );
}
