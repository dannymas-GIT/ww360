import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CircleHelp, Landmark } from 'lucide-react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  fetchGrantMatch,
  fetchGrantPrograms,
  type GrantMatchResult,
  type GrantProgram,
} from '@/services/grantsService';
import { GrantsTourOverlay, requestOpenGrantsTour } from './GrantsTourOverlay';

const EPA_PROGRAM_ID = 'epa-iwiwd-2026';
const DEADLINE_BANNER_DAYS = 60;

function daysUntil(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const d = new Date(`${deadline}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function statusBadgeClass(status?: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'open') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (s === 'closed') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-amber-50 text-amber-900 border-amber-200';
}

function fitLabel(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return '—';
  return `${Math.round(pct)}% fit`;
}

export default function GrantsListPage() {
  const [programs, setPrograms] = useState<GrantProgram[]>([]);
  const [matchById, setMatchById] = useState<Record<string, GrantMatchResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const catalog = await fetchGrantPrograms();
        if (cancelled) return;
        setPrograms(catalog.programs || []);

        try {
          const match = await fetchGrantMatch({ scope: 'program' });
          if (cancelled) return;
          const map: Record<string, GrantMatchResult> = {};
          for (const m of match.matches || []) {
            const id = String(m.program_id || m.id || '');
            if (id) map[id] = m;
          }
          setMatchById(map);
        } catch {
          // Match is optional — catalog still useful without fit scores.
          setMatchById({});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load grant programs');
          setPrograms([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const epaProgram = useMemo(
    () => programs.find(p => p.id === EPA_PROGRAM_ID),
    [programs]
  );
  const epaDays = daysUntil(epaProgram?.deadline);
  const showEpaBanner =
    epaProgram != null && epaDays != null && epaDays >= 0 && epaDays <= DEADLINE_BANNER_DAYS;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6" data-tour="grants-list">
      <GrantsTourOverlay view="list" autoOpen />
      <Ww360PageHero
        eyebrow="Funding"
        title="Grants Studio"
        description="Browse water and wastewater funding programs, check eligibility fit, and open application packets for Document Studio."
        dataMode="mixed"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] border-white/20 bg-white/5 text-base text-white hover:bg-white/15 md:min-h-9"
            onClick={() => requestOpenGrantsTour(0)}
          >
            <CircleHelp className="mr-1 h-4 w-4" aria-hidden />
            How to use this
          </Button>
        }
      />

      {showEpaBanner && (
        <div
          role="status"
          data-tour="grants-deadline-banner"
          className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="text-base font-semibold text-amber-950">
                EPA IWIWD deadline in {epaDays} day{epaDays === 1 ? '' : 's'}
              </p>
              <p className="text-[1.125rem] leading-relaxed text-amber-900">
                {epaProgram?.name} closes {epaProgram?.deadline} (EPA-OW-OWM-26-03).
              </p>
            </div>
          </div>
          <Link
            to={`/grants/${EPA_PROGRAM_ID}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-amber-800 px-4 text-base font-medium text-white hover:bg-amber-900"
          >
            Open EPA program
          </Link>
        </div>
      )}

      {loading && (
        <p className="text-[1.125rem] text-slate-500">Loading funding catalog…</p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-[1.125rem] text-red-800">
          {error}
        </p>
      )}

      {!loading && !error && (
        <Ww360Section tourId="grants-catalog" title={`Programs (${programs.length})`} dataMode="live">
          {programs.length === 0 ? (
            <p className="text-[1.125rem] text-slate-600">No programs in the catalog yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {programs.map(program => {
                const days = daysUntil(program.deadline);
                const match = matchById[program.id];
                const fit =
                  typeof match?.fit_pct === 'number'
                    ? match.fit_pct
                    : typeof match?.fit_score === 'number'
                      ? Number(match.fit_score)
                      : null;

                return (
                  <li key={program.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3 max-[900px]:gap-2 min-[900px]:flex-row min-[900px]:items-start min-[900px]:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Landmark className="h-4 w-4 text-slate-500" aria-hidden />
                          <Link
                            to={`/grants/${program.id}`}
                            className="text-base font-semibold text-sky-800 underline-offset-2 hover:underline"
                          >
                            {program.name}
                          </Link>
                          {program.short_name && (
                            <span className="text-sm text-slate-500">{program.short_name}</span>
                          )}
                        </div>
                        <p className="text-[1.125rem] leading-relaxed text-slate-700">
                          {program.funder || 'Funder TBD'}
                          {program.level ? ` · ${program.level}` : ''}
                          {program.water_focus ? ` · ${program.water_focus.replace(/_/g, ' ')}` : ''}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className={`min-h-[28px] text-sm ${statusBadgeClass(program.status)}`}
                          >
                            {program.status || 'unknown'}
                          </Badge>
                          {program.deadline && (
                            <Badge
                              variant="outline"
                              className={`min-h-[28px] text-sm ${
                                days != null && days <= DEADLINE_BANNER_DAYS && days >= 0
                                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                              }`}
                            >
                              Deadline {program.deadline}
                              {days != null && days >= 0 ? ` · ${days}d` : ''}
                            </Badge>
                          )}
                          {fit != null && (
                            <Badge
                              variant="outline"
                              className="min-h-[28px] border-sky-200 bg-sky-50 text-sm text-sky-900"
                            >
                              {fitLabel(fit)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Link
                        to={`/grants/${program.id}`}
                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-800 hover:bg-slate-50"
                      >
                        View details
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Ww360Section>
      )}
    </div>
  );
}
