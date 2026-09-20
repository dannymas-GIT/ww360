import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ensureEpaOwwApplication,
  fetchEpaIwiwdAutofill,
  fetchGrantEligibility,
  fetchGrantProgram,
  type EpaIwiwdAutofill,
  type GrantEligibilityResponse,
  type GrantProgram,
} from '@/services/grantsService';

const EPA_PROGRAM_ID = 'epa-iwiwd-2026';
const STUDIO_TEMPLATE_ID = 'epa-iwiwd-2026-narrative';

function formatUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function GrantDetailPage() {
  const { programId = '' } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const [program, setProgram] = useState<GrantProgram | null>(null);
  const [eligibility, setEligibility] = useState<GrantEligibilityResponse | null>(null);
  const [autofill, setAutofill] = useState<EpaIwiwdAutofill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ensuring, setEnsuring] = useState(false);
  const [ensureError, setEnsureError] = useState<string | null>(null);

  const isEpa = programId === EPA_PROGRAM_ID;

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const detail = await fetchGrantProgram(programId);
        if (cancelled) return;
        setProgram(detail);

        try {
          const elig = await fetchGrantEligibility(programId, { scope: 'program' });
          if (!cancelled) setEligibility(elig);
        } catch {
          if (!cancelled) setEligibility(null);
        }

        if (programId === EPA_PROGRAM_ID) {
          try {
            const auto = await fetchEpaIwiwdAutofill();
            if (!cancelled) setAutofill(auto);
          } catch {
            if (!cancelled) setAutofill(null);
          }
        } else if (!cancelled) {
          setAutofill(null);
        }
      } catch (err) {
        if (!cancelled) {
          setProgram(null);
          setError(err instanceof Error ? err.message : 'Failed to load program');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [programId]);

  async function onEnsureOww() {
    setEnsuring(true);
    setEnsureError(null);
    try {
      const app = await ensureEpaOwwApplication();
      navigate(`/grants/applications/${app.id}`);
    } catch (err) {
      setEnsureError(err instanceof Error ? err.message : 'Could not create OWW application');
    } finally {
      setEnsuring(false);
    }
  }

  const fitPct = eligibility?.result?.fit_pct;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6" data-tour="grant-detail">
      <Ww360PageHero
        eyebrow="Funding program"
        title={program?.name || (loading ? 'Loading…' : 'Program')}
        description={
          program
            ? `${program.funder || 'Funder TBD'}${program.opportunity_number ? ` · ${program.opportunity_number}` : ''}`
            : 'Program detail, eligibility, and readiness for Document Studio.'
        }
        dataMode="mixed"
        actions={
          <Link to="/grants" className="text-base text-white underline">
            ← All programs
          </Link>
        }
      />

      {loading && <p className="text-[1.125rem] text-slate-500">Loading program…</p>}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-[1.125rem] text-red-800">
          {error}
        </p>
      )}

      {program && !loading && (
        <>
          <div className="flex flex-wrap gap-2">
            {program.status && (
              <Badge variant="outline" className="min-h-[28px] text-sm">
                {program.status}
              </Badge>
            )}
            {program.deadline && (
              <Badge variant="outline" className="min-h-[28px] text-sm">
                Deadline {program.deadline}
              </Badge>
            )}
            {fitPct != null && (
              <Badge
                variant="outline"
                className="min-h-[28px] border-sky-200 bg-sky-50 text-sm text-sky-900"
              >
                {Math.round(Number(fitPct))}% eligibility fit
              </Badge>
            )}
            {(program.award_min_usd != null || program.award_max_usd != null) && (
              <Badge variant="outline" className="min-h-[28px] text-sm">
                {formatUsd(program.award_min_usd)} – {formatUsd(program.award_max_usd)}
              </Badge>
            )}
          </div>

          {program.cycle_note && (
            <p className="text-[1.125rem] leading-relaxed text-slate-700">{program.cycle_note}</p>
          )}

          <div className="flex flex-wrap gap-3">
            {program.portal_url && (
              <a
                href={program.portal_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-800 hover:bg-slate-50"
              >
                Grants.gov <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}
            {program.info_url && (
              <a
                href={program.info_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-800 hover:bg-slate-50"
              >
                Program info <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}
            {isEpa && (
              <>
                <Button
                  type="button"
                  className="min-h-[44px] text-base"
                  disabled={ensuring}
                  onClick={() => void onEnsureOww()}
                >
                  {ensuring ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Creating…
                    </>
                  ) : (
                    'Ensure OWW application'
                  )}
                </Button>
                <Link
                  to={`/studio?template=${STUDIO_TEMPLATE_ID}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-sky-700 px-4 text-base font-medium text-white hover:bg-sky-800"
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  Open studio template
                </Link>
              </>
            )}
          </div>
          {ensureError && (
            <p className="text-[1.125rem] text-red-700" role="alert">
              {ensureError}
            </p>
          )}

          {(program.eligibility_rules?.length || 0) > 0 && (
            <Ww360Section
              tourId="grant-eligibility"
              title="Eligibility rules"
              dataMode="live"
            >
              <ul className="space-y-3">
                {program.eligibility_rules!.map((rule, idx) => (
                  <li
                    key={`${rule.fact}-${idx}`}
                    className="rounded-md border border-slate-100 bg-slate-50/80 p-3"
                  >
                    <p className="text-base font-medium text-slate-900">
                      {rule.reason || rule.fact}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Fact <code className="text-sm">{rule.fact}</code> {rule.op}{' '}
                      <code className="text-sm">{String(rule.value)}</code>
                      {rule.weight != null ? ` · weight ${rule.weight}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
              {eligibility?.result?.missing_facts && eligibility.result.missing_facts.length > 0 && (
                <p className="mt-4 text-[1.125rem] text-amber-800">
                  Missing facts: {eligibility.result.missing_facts.join(', ')}
                </p>
              )}
            </Ww360Section>
          )}

          {(program.nofo_outline?.length || 0) > 0 && (
            <Ww360Section tourId="grant-nofo" title="NOFO outline" dataMode="live">
              <ol className="list-decimal space-y-3 pl-5">
                {program.nofo_outline!.map(section => (
                  <li key={section.section} className="text-[1.125rem] leading-relaxed">
                    <span className="font-semibold text-slate-900">{section.section}</span>
                    {section.hint && (
                      <span className="block text-base text-slate-600">{section.hint}</span>
                    )}
                  </li>
                ))}
              </ol>
            </Ww360Section>
          )}

          {(program.readiness_checklist?.length || 0) > 0 && (
            <Ww360Section
              tourId="grant-readiness"
              title="Readiness checklist"
              dataMode="live"
            >
              <ul className="space-y-2">
                {program.readiness_checklist!.map(item => (
                  <li
                    key={item.id}
                    className="flex min-h-[44px] items-center gap-3 text-[1.125rem]"
                  >
                    <span
                      className="inline-flex h-5 w-5 shrink-0 rounded border border-slate-300"
                      aria-hidden
                    />
                    <span>
                      {item.label}
                      {item.required ? (
                        <span className="ml-2 text-sm text-slate-500">Required</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Ww360Section>
          )}

          {isEpa && (
            <Ww360Section
              tourId="grant-autofill"
              title="EPA IWIWD autofill preview"
              dataMode={
                autofill?.data_mode === 'live'
                  ? 'live'
                  : autofill?.data_mode === 'sample'
                    ? 'sample'
                    : 'mixed'
              }
            >
              {!autofill ? (
                <p className="text-[1.125rem] text-slate-600">
                  Autofill stats unavailable. Check state metrics and try again.
                </p>
              ) : (
                <div className="space-y-4">
                  <p className="text-[1.125rem] text-slate-700">
                    Applicant: <strong>{autofill.applicant || '—'}</strong>
                    {autofill.suggested_project_area
                      ? ` · Suggested area: ${autofill.suggested_project_area}`
                      : ''}
                  </p>
                  {autofill.stats && (
                    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(autofill.stats).map(([k, v]) => (
                        <div key={k} className="rounded-md border border-slate-100 p-3">
                          <dt className="text-sm text-slate-500">{k.replace(/_/g, ' ')}</dt>
                          <dd className="text-base font-semibold tabular-nums text-slate-900">
                            {v == null ? '—' : String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {(autofill.narrative_bullets?.length || 0) > 0 && (
                    <ul className="list-disc space-y-2 pl-5 text-[1.125rem] leading-relaxed text-slate-700">
                      {autofill.narrative_bullets!.map(b => (
                        <li key={b.slice(0, 48)}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Ww360Section>
          )}
        </>
      )}
    </div>
  );
}
