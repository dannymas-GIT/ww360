import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import { useJurisdiction } from '@/context/JurisdictionContext';
import {
  fetchInsightsOverview,
  type InsightsOverview,
  type InsightsPersona,
} from '@/services/insightsService';
import { InsightsCorrelationCards } from '@/pages/insights/InsightsCorrelationCards';
import { InsightsTourOverlay, requestOpenInsightsTour } from '@/pages/insights/InsightsTourOverlay';

const PERSONAS: Array<{ id: InsightsPersona; label: string; blurb: string }> = [
  {
    id: 'jenny',
    label: 'Jenny',
    blurb: 'OWW program lens — grant fit, workforce pipeline, and partner utility need.',
  },
  {
    id: 'regulator',
    label: 'Regulator',
    blurb: 'State / EPA compliance pressure correlated with operator capacity.',
  },
  {
    id: 'utility',
    label: 'Utility',
    blurb: 'District readiness — vacancies, renewals, and funding opportunities.',
  },
];

export default function InsightsPage() {
  const { activeState } = useJurisdiction();
  const state = (activeState || 'NY').toUpperCase().slice(0, 2);
  const [persona, setPersona] = useState<InsightsPersona>('jenny');
  const [data, setData] = useState<InsightsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchInsightsOverview({ state, persona })
      .then(overview => {
        if (!cancelled) setData(overview);
      })
      .catch(err => {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof Error
              ? err.message
              : 'Insights API unavailable — correlations will appear when the service is online.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state, persona]);

  const activeBlurb = PERSONAS.find(p => p.id === persona)?.blurb;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6" data-tour="insights-page">
      <InsightsTourOverlay autoOpen />
      <Ww360PageHero
        eyebrow="Funding · Insights"
        title={`${state} workforce & funding correlations`}
        description="Persona-tuned cards linking compliance pressure, operator capacity, and grant opportunity fit."
        dataMode={data?.data_mode === 'live' ? 'live' : 'mixed'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] border-white/20 bg-white/5 text-base text-white hover:bg-white/15 md:min-h-9"
              onClick={() => requestOpenInsightsTour(0)}
            >
              <CircleHelp className="mr-1 h-4 w-4" aria-hidden />
              How to use this
            </Button>
            <Link
              to="/grants"
              data-tour="insights-grants-link"
              className="inline-flex min-h-[44px] items-center text-base text-white underline"
            >
              Grants catalog →
            </Link>
          </div>
        }
      />

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Insights persona"
        data-tour="insights-personas"
      >
        {PERSONAS.map(p => (
          <Button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={persona === p.id}
            variant={persona === p.id ? 'default' : 'outline'}
            className="min-h-[44px] text-base"
            onClick={() => setPersona(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {activeBlurb && (
        <p className="text-[1.125rem] leading-relaxed text-slate-600" data-tour="insights-persona-blurb">
          {activeBlurb}
        </p>
      )}

      {loading && (
        <p className="text-[1.125rem] text-slate-500">Loading insights…</p>
      )}

      {error && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[1.125rem] text-amber-950"
        >
          <p className="font-semibold">Insights temporarily unavailable</p>
          <p className="mt-1 leading-relaxed">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <Ww360Section
          tourId="insights-correlations"
          title={data?.headline || 'Correlation cards'}
          dataMode={
            data?.data_mode === 'live' ? 'live' : data?.data_mode === 'sample' ? 'sample' : 'mixed'
          }
        >
          <InsightsCorrelationCards
            cards={data?.correlations || []}
            preferredOnly
            emptyMessage={
              data?.data_mode === 'stub'
                ? 'Insights engine is stubbed — cards will populate as correlations are wired for this state.'
                : 'No correlation insights yet for this persona and state.'
            }
          />
        </Ww360Section>
      )}
    </div>
  );
}
