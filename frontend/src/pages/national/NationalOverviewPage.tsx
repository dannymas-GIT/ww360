import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, Users } from 'lucide-react';
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

  const sortedStates = useMemo(
    () => [...(data?.states || [])].sort((a, b) => b.active_cws - a.active_cws),
    [data]
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="United States"
        title="National workforce & compliance overview"
        description="Five headline KPIs for EPA, ASDWA, and AWWA leadership — sourced from public federal data with provenance on every tile."
        dataMode="mixed"
      />

      {loading && <p className="text-[1.125rem] text-slate-500">Loading national metrics…</p>}

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
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[720px] text-base">
            <thead>
              <tr className="border-b text-left text-sm uppercase text-slate-500">
                <th className="py-2">State</th>
                <th className="py-2 text-right">CWS</th>
                <th className="py-2 text-right">Health violations</th>
                <th className="py-2 text-right">Certified ops</th>
                <th className="py-2 text-right">DWSRF allotment</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {sortedStates.map(s => (
                <tr key={s.state_code} className="border-b border-slate-100">
                  <td className="py-2 font-medium">{s.state_code}</td>
                  <td className="py-2 text-right tabular-nums">{formatCompact(s.active_cws)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCompact(s.health_violations)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {s.certified_operators != null ? formatCompact(s.certified_operators) : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {s.dwsrf_allotment_usd ? formatUsd(s.dwsrf_allotment_usd) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <Link className="text-sky-700 underline" to={`/national/states/${s.state_code}`}>
                      Scorecard
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
