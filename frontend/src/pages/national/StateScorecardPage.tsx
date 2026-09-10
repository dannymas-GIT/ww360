import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Ww360KpiTile } from '@/components/ww360/Ww360KpiTile';
import { fetchStateScorecard, fetchStateWorkforce } from '@/services/nationalService';
import { formatCompact, formatUsd } from '@/pages/oww/owwMockData';

export default function StateScorecardPage() {
  const { st } = useParams<{ st: string }>();
  const stateCode = (st || 'NY').toUpperCase().slice(0, 2);
  const [scorecard, setScorecard] = useState<Record<string, unknown> | null>(null);
  const [workforce, setWorkforce] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void Promise.all([fetchStateScorecard(stateCode), fetchStateWorkforce(stateCode)])
      .then(([sc, wf]) => {
        setScorecard(sc);
        setWorkforce(wf);
      })
      .catch(() => {
        setScorecard(null);
        setWorkforce(null);
      });
  }, [stateCode]);

  const compliance = (scorecard?.compliance || {}) as Record<string, number>;
  const roster = (workforce?.roster || {}) as Record<string, unknown>;
  const continuity = (workforce?.continuity_rollup || {}) as Record<string, unknown>;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="State scorecard"
        title={`${stateCode} workforce readiness`}
        description="Composite view across compliance, operator certification, and enrolled utility continuity."
        dataMode="mixed"
        actions={
          <Link to="/national" className="text-base text-white underline">
            ← National overview
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Ww360KpiTile
          label="Workforce readiness index"
          value={String(scorecard?.workforce_readiness_index ?? '—')}
          sublabel="Composite 0–100"
          source="ww360"
        />
        <Ww360KpiTile
          label="Active CWS"
          value={formatCompact(compliance.active_cws || 0)}
          source="epa_echo_sdwis"
        />
        <Ww360KpiTile
          label="Certified operators"
          value={roster.total_operators != null ? formatCompact(Number(roster.total_operators)) : '—'}
          sublabel={roster.roster_published ? 'Published roster' : 'Roster not published'}
          source="state_roster"
        />
        <Ww360KpiTile
          label="DWSRF allotment"
          value={
            scorecard?.dwsrf_allotment_usd
              ? formatUsd(Number(scorecard.dwsrf_allotment_usd))
              : '—'
          }
          source="epa_dwsrf"
        />
      </div>

      {Boolean(roster.by_grade) && (
        <Ww360Section title="Operators by grade" dataMode="live">
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            {Object.entries(roster.by_grade as Record<string, number>).map(([g, n]) => (
              <span key={g} className="rounded-full border px-3 py-1 text-base">
                {g}: {n}
              </span>
            ))}
          </div>
        </Ww360Section>
      )}

      {(roster.renewal_cliff_12mo != null || roster.renewal_cliff_24mo != null) && (
        <Ww360Section title="Renewal cliff" dataMode="live">
          <p className="px-5 pb-5 text-[1.125rem]">
            {formatCompact(Number(roster.renewal_cliff_12mo))} certifications expiring within 12 months;{' '}
            {formatCompact(Number(roster.renewal_cliff_24mo))} within 24 months.
          </p>
        </Ww360Section>
      )}

      {continuity.district_count != null && Number(continuity.district_count) > 0 && (
        <Ww360Section title="Continuity roll-up (enrolled districts)" dataMode="live">
          <p className="px-5 pb-5 text-[1.125rem]">
            {String(continuity.district_count)} districts · avg readiness{' '}
            {(continuity.averages as Record<string, number>)?.readiness_score ?? '—'} · avg coverage{' '}
            {(continuity.averages as Record<string, number>)?.coverage_pct ?? '—'}%
          </p>
        </Ww360Section>
      )}
    </div>
  );
}
