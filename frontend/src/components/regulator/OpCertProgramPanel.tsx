import React, { useEffect, useMemo, useState } from 'react';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { fetchStateWorkforce } from '@/services/nationalService';
import { fetchNpdesLandscape } from '@/services/npdesService';
import { formatCompact } from '@/pages/oww/owwMockData';

type ProgramTab = 'dw' | 'ww';

function ProgramTabToggle({
  tab,
  onChange,
}: {
  tab: ProgramTab;
  onChange: (next: ProgramTab) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
      role="group"
      aria-label="Operator certification program"
    >
      <button
        type="button"
        className={`min-h-[44px] rounded-md px-4 text-base font-medium transition-colors md:min-h-9 ${
          tab === 'dw' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-700 hover:bg-slate-200'
        }`}
        aria-pressed={tab === 'dw'}
        onClick={() => onChange('dw')}
      >
        NYSDOH OpCert
      </button>
      <button
        type="button"
        className={`min-h-[44px] rounded-md px-4 text-base font-medium transition-colors md:min-h-9 ${
          tab === 'ww' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-700 hover:bg-slate-200'
        }`}
        aria-pressed={tab === 'ww'}
        onClick={() => onChange('ww')}
      >
        NYSDEC Wastewater
      </button>
    </div>
  );
}

function KpiCell({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {note ? <p className="mt-1 text-[0.875rem] text-slate-500">{note}</p> : null}
    </div>
  );
}

/** OpCert program panel for NYSDOH / NYSDEC regulator persona. */
export const OpCertProgramPanel: React.FC<{ stateCode?: string }> = ({ stateCode = 'NY' }) => {
  const [tab, setTab] = useState<ProgramTab>('dw');
  const [dwData, setDwData] = useState<Record<string, unknown> | null>(null);
  const [wwLandscape, setWwLandscape] = useState<Awaited<ReturnType<typeof fetchNpdesLandscape>> | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchStateWorkforce(stateCode).catch(() => null),
      fetchNpdesLandscape(stateCode, { limit: 1 }).catch(() => null),
    ])
      .then(([workforce, landscape]) => {
        if (cancelled) return;
        setDwData(workforce);
        setWwLandscape(landscape);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stateCode]);

  const roster = (dwData?.roster || {}) as Record<string, unknown>;
  const scorecard = (dwData?.scorecard || {}) as Record<string, unknown>;
  const compliance = (scorecard.compliance || {}) as Record<string, number>;

  const potwCount = wwLandscape?.count ?? null;
  const wwOperators: number | null = null;
  const wwRenewals12mo: number | null = null;
  const potwsPerOperator = useMemo(() => {
    if (potwCount == null || wwOperators == null || wwOperators <= 0) return null;
    return (potwCount / wwOperators).toFixed(1);
  }, [potwCount, wwOperators]);

  const eyebrow =
    tab === 'dw' ? 'NYSDOH · Operator Certification' : 'NYSDEC · Wastewater Operator Certification';
  const title = tab === 'dw' ? 'OpCert program coverage' : 'Wastewater operator program coverage';

  return (
    <Ww360Section tourId="opcert-panel" eyebrow={eyebrow} title={title} dataMode="live">
      <div className="space-y-4 px-5 pb-5">
        <ProgramTabToggle tab={tab} onChange={setTab} />

        {loading ? (
          <p className="text-[1.125rem] text-slate-500">Loading program metrics…</p>
        ) : tab === 'dw' ? (
          dwData ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-[1.125rem]">
              <KpiCell
                label="Certified operators (roster)"
                value={
                  roster.total_operators != null
                    ? formatCompact(Number(roster.total_operators))
                    : '—'
                }
              />
              <KpiCell
                label="Community water systems"
                value={formatCompact(compliance.active_cws || 0)}
              />
              <KpiCell
                label="Renewals ≤ 12 mo"
                value={formatCompact(Number(roster.renewal_cliff_12mo || 0))}
              />
              <KpiCell
                label="Systems per operator"
                value={
                  scorecard.systems_per_operator != null
                    ? String(scorecard.systems_per_operator)
                    : '—'
                }
              />
            </div>
          ) : (
            <p className="text-base text-slate-600">
              Drinking-water OpCert metrics are unavailable for {stateCode} right now.
            </p>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-[1.125rem]">
            <KpiCell
              label="POTWs (NPDES inventory)"
              value={potwCount != null ? formatCompact(potwCount) : '—'}
              note={potwCount != null ? 'Live EPA ICIS-NPDES / ECHO' : 'Landscape feed pending'}
            />
            <KpiCell
              label="WW operators (roster)"
              value={wwOperators != null ? formatCompact(wwOperators) : '—'}
              note="NYSDEC roster feed not linked yet"
            />
            <KpiCell
              label="Renewals ≤ 12 mo"
              value={wwRenewals12mo != null ? formatCompact(wwRenewals12mo) : '—'}
              note="Awaiting DEC certification aggregate"
            />
            <KpiCell
              label="POTWs per operator"
              value={potwsPerOperator ?? '—'}
              note={
                potwsPerOperator != null
                  ? 'Planning ratio from live POTW count'
                  : 'Needs WW operator roster count'
              }
            />
          </div>
        )}

        <p className="text-base text-slate-600">
          {tab === 'dw' ? (
            <>
              Use Document Studio template &quot;EPA Operator Certification Annual Report (Nine
              Baseline Standards)&quot; to pre-fill metrics for EPA regional submission.
            </>
          ) : (
            <>
              Wastewater grades (1–4 and 1A–4A) follow NYSDEC Part 650 — five-year renewal cycles
              and cyber-security CE hours effective 2027. POTW counts come from the NPDES landscape;
              operator roster metrics will populate when a public DEC aggregate is connected.
            </>
          )}
        </p>
      </div>
    </Ww360Section>
  );
};
