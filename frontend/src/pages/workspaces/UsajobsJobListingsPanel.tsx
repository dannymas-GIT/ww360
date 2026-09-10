import React, { useEffect, useState } from 'react';
import { ExternalLink, Briefcase } from 'lucide-react';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Ww360SourceChip } from '@/components/ww360/Ww360SourceChip';
import { Button } from '@/components/ui/button';
import { fetchFederalJobOpenings, type FederalJobsResponse } from '@/services/jobsService';
import { useJurisdiction } from '@/context/JurisdictionContext';

interface UsajobsJobListingsPanelProps {
  tourId?: string;
}

/**
 * Live USAJOBS federal openings.
 *
 * Default: nationwide. Federal water/treatment postings rarely match a single
 * primacy state (e.g. NY → 0 hits), which previously made listings look "gone".
 * Users can opt into an active-state filter; if that returns empty we fall back
 * to nationwide and say so.
 */
export const UsajobsJobListingsPanel: React.FC<UsajobsJobListingsPanelProps> = ({
  tourId = 'federal-jobs',
}) => {
  const { activeState } = useJurisdiction();
  const [filterState, setFilterState] = useState(false);
  const [data, setData] = useState<FederalJobsResponse | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFallbackNote(null);

    const stateParam = filterState ? activeState : null;

    void (async () => {
      try {
        let res = await fetchFederalJobOpenings(stateParam, 12);
        if (
          filterState &&
          res.configured &&
          res.jobs.length === 0 &&
          activeState
        ) {
          const nationwide = await fetchFederalJobOpenings(null, 12);
          if (!cancelled && nationwide.configured && nationwide.jobs.length > 0) {
            setFallbackNote(
              `No federal matches in ${activeState} right now — showing nationwide listings.`
            );
            setData(nationwide);
            return;
          }
        }
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) {
          setData(null);
          setError('Could not load USAJOBS listings. Try again in a moment.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeState, filterState]);

  const dataMode = data?.data_mode === 'live' && data.jobs.length > 0 ? 'live' : 'sample';

  return (
    <Ww360Section
      title="Federal operator openings"
      dataMode={dataMode}
      tourId={tourId}
      action={
        activeState ? (
          <Button
            type="button"
            variant={filterState ? 'default' : 'outline'}
            size="sm"
            className="min-h-[44px] text-base"
            onClick={() => setFilterState(v => !v)}
            aria-pressed={filterState}
          >
            {filterState ? `In ${activeState}` : 'Nationwide'}
          </Button>
        ) : null
      }
    >
      <div className="space-y-4 px-5 pb-5">
        <p className="text-lg leading-relaxed text-slate-600">
          Live job announcements from USAJOBS — water, wastewater, and treatment plant roles.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Ww360SourceChip id="usajobs" />
          <span className="text-sm text-slate-500">
            {filterState && activeState && !fallbackNote
              ? `Filtered to ${activeState}`
              : 'Nationwide federal postings'}
          </span>
        </div>

        {fallbackNote ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-base text-sky-900">
            {fallbackNote}
          </p>
        ) : null}

        {loading && (
          <p className="text-lg text-slate-500">Loading federal job postings…</p>
        )}

        {error ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-lg text-amber-900" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && data && !data.configured && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-lg leading-relaxed text-amber-900">
            USAJOBS API is not configured on this server. Set <code>USAJOBS_API_KEY</code> and{' '}
            <code>USAJOBS_USER_AGENT</code> in the environment to show live federal listings.
          </p>
        )}

        {!loading && data?.configured && data.message && data.jobs.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-lg text-amber-900" role="alert">
            {data.message}
          </p>
        ) : null}

        {!loading && data?.configured && data.jobs.length === 0 && !data.message && (
          <p className="text-lg text-slate-600">
            No matching federal postings right now
            {data.state_filter ? ` for ${data.state_filter}` : ''}.{' '}
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

        {!loading && data && data.jobs.length > 0 && (
          <>
            <p className="text-base text-slate-600">
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
                          <p className="text-lg font-semibold text-slate-900">{job.title}</p>
                          <p className="text-base text-slate-600">
                            {job.organization}
                            {job.location ? ` · ${job.location}` : ''}
                          </p>
                          {job.salary && (
                            <p className="text-sm text-slate-500">{job.salary}</p>
                          )}
                          {job.posted && (
                            <p className="text-sm text-slate-500">
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
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-base font-medium text-sky-700 hover:bg-sky-50"
                      >
                        View
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-500">
              These are federal announcements only. Municipal utilities often post on GovernmentJobs.com
              or state workforce boards — not included here.
            </p>
          </>
        )}
      </div>
    </Ww360Section>
  );
};
