import React, { useEffect, useState } from 'react';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { fetchStateWorkforce } from '@/services/nationalService';
import { formatCompact } from '@/pages/oww/owwMockData';

/** OpCert program panel for NYSDOH regulator persona. */
export const OpCertProgramPanel: React.FC<{ stateCode?: string }> = ({ stateCode = 'NY' }) => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void fetchStateWorkforce(stateCode)
      .then(setData)
      .catch(() => setData(null));
  }, [stateCode]);

  const roster = (data?.roster || {}) as Record<string, unknown>;
  const scorecard = (data?.scorecard || {}) as Record<string, unknown>;
  const compliance = (scorecard.compliance || {}) as Record<string, number>;

  if (!data) return null;

  return (
    <Ww360Section
      tourId="opcert-panel"
      eyebrow="NYSDOH · Operator Certification"
      title="OpCert program coverage"
      dataMode="live"
    >
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4 text-[1.125rem]">
        <div>
          <p className="text-sm text-slate-500">Certified operators (roster)</p>
          <p className="text-2xl font-semibold tabular-nums">
            {roster.total_operators != null ? formatCompact(Number(roster.total_operators)) : '—'}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Community water systems</p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatCompact(compliance.active_cws || 0)}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Renewals ≤ 12 mo</p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatCompact(Number(roster.renewal_cliff_12mo || 0))}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Systems per operator</p>
          <p className="text-2xl font-semibold tabular-nums">
            {scorecard.systems_per_operator != null ? String(scorecard.systems_per_operator) : '—'}
          </p>
        </div>
      </div>
      <p className="px-5 pb-5 text-base text-slate-600">
        Use Document Studio template &quot;EPA Operator Certification Annual Report (Nine Baseline Standards)&quot;
        to pre-fill metrics for EPA regional submission.
      </p>
    </Ww360Section>
  );
};
