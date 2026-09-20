import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Briefcase, RefreshCw } from 'lucide-react';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Ww360SourceChip } from '@/components/ww360/Ww360SourceChip';
import { fetchFederalJobOpenings, type FederalJobsResponse } from '@/services/jobsService';
import { useJurisdiction } from '@/context/JurisdictionContext';
import { Button } from '@/components/ui/button';

interface UsajobsJobListingsPanelProps {
  tourId?: string;
}

export const UsajobsJobListingsPanel: React.FC<UsajobsJobListingsPanelProps> = ({
  tourId = 'federal-jobs',
}) => {
  const { activeState } = useJurisdiction();
  const [data, setData] = useState<FederalJobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken(t => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        let res = await fetchFederalJobOpenings(activeState, 12);
        // Staging may still lack server-side statewide fallback — broaden here so
        // NY (and other empty states) do not look like a connectivity outage.
        if (
          res.configured &&
          res.data_mode !== 'error' &&
          (!res.jobs || res.jobs.length === 0) &&
          activeState &&
          !res.state_filter_relaxed
        ) {
          const nationwide = await fetchFederalJobOpenings(null, 12);
          if (nationwide.jobs?.length) {
            res = {
              ...nationwide,
              state_filter: activeState,
              state_filter_relaxed: true,
              message:
                nationwide.message ||
                `No federal water/wastewater operator postings currently list ${activeState} as the duty location — showing nationwide openings instead.`,
            };
          }
        }
        if (cancelled) return;
        setData(res);
        if (res.data_mode === 'error') {
          setError(res.message || 'USAJOBS request failed');
        }
      } catch (err) {
        if (cancelled) return;
        setData(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Could not reach the federal jobs service'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeState, reloadToken]);

  const hasJobs = Boolean(data?.jobs?.length);
  const dataMode =
    data?.data_mode === 'live' && hasJobs
      ? 'live'
      : data?.data_mode === 'error' || error
        ? 'sample'
        : data?.configured === false
          ? 'sample'
          : 'sample';

  return (
    <Ww360Section
      title="Federal operator openings"
      description="Live job announcements from USAJOBS — water and wastewater treatment plant operators (BLS SOC 51-8031)."
      dataMode={dataMode}
      tourId={tourId}
    >
      <div className="space-y-4 px-5 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Ww360SourceChip id="usajobs" />
          {activeState && (
            <span className="text-[0.875rem] text-slate-500">
              Prefers {activeState} duty locations when postings exist
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto min-h-[44px] text-base"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
        </div>

        {loading && (
          <p className="text-[1.125rem] text-slate-500">Loading federal job postings…</p>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[1.125rem] leading-relaxed text-amber-950">
            <p className="font-medium">Federal listings unavailable right now</p>
            <p className="mt-1 text-base text-amber-900">{error}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="min-h-[44px] text-base" onClick={reload}>
                Try again
              </Button>
              <a
                className="inline-flex min-h-[44px] items-center font-medium text-sky-800 underline"
                href="https://www.usajobs.gov/Search/Results?k=water%20treatment%20operator"
                target="_blank"
                rel="noreferrer"
              >
                Search USAJOBS directly
              </a>
            </div>
          </div>
        )}

        {!loading && !error && data && !data.configured && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[1.125rem] leading-relaxed text-amber-900">
            USAJOBS API is not configured on this server. Set <code>USAJOBS_API_KEY</code> and{' '}
            <code>USAJOBS_USER_AGENT</code> in the environment to show live federal listings.
          </p>
        )}

        {!loading && !error && data?.configured && data.state_filter_relaxed && hasJobs && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-[1rem] leading-relaxed text-sky-950">
            {data.message ||
              `No federal postings currently list ${data.state_filter || activeState} as the duty location — showing nationwide openings.`}
          </p>
        )}

        {!loading && !error && data?.configured && !hasJobs && (
          <p className="text-[1.125rem] text-slate-600">
            {data.message ||
              `No matching federal postings right now${
                data.state_filter ? ` for ${data.state_filter}` : ''
              }.`}{' '}
            <a
              className="font-medium text-sky-700 underline"
              href="https://www.usajobs.gov/Search/Results?k=water%20treatment%20operator"
              target="_blank"
              rel="noreferrer"
            >
              Search USAJOBS directly
            </a>
          </p>
        )}

        {!loading && !error && data && hasJobs && (
          <>
            <p className="text-[1rem] text-slate-600">
              {data.total.toLocaleString()} federal matches · synced{' '}
              {new Date(data.as_of).toLocaleString()}
            </p>
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {data.jobs.map(job => (
                <li key={job.id || job.url} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <Briefcase className="mt-1 h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
                        <div>
                          <p className="text-[1.125rem] font-semibold text-slate-900">{job.title}</p>
                          <p className="text-[1rem] text-slate-600">
                            {job.organization}
                            {job.location ? ` · ${job.location}` : ''}
                          </p>
                          {job.salary && (
                            <p className="text-[0.875rem] text-slate-500">{job.salary}</p>
                          )}
                          {job.posted && (
                            <p className="text-[0.875rem] text-slate-500">
                              Posted {job.posted.slice(0, 10)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[1rem] font-medium text-sky-700 hover:bg-sky-50"
                      >
                        View
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-[0.875rem] text-slate-500">
              Searches include water treatment and wastewater operator titles (BLS SOC 51-8031).
              These are federal announcements only — municipal utilities often post on
              GovernmentJobs.com or state workforce boards.
            </p>
          </>
        )}
      </div>
    </Ww360Section>
  );
};
