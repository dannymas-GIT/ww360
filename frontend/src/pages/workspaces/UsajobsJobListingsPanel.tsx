import React, { useEffect, useState } from 'react';
import { ExternalLink, Briefcase } from 'lucide-react';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Ww360SourceChip } from '@/components/ww360/Ww360SourceChip';
import { fetchFederalJobOpenings, type FederalJobsResponse } from '@/services/jobsService';
import { useJurisdiction } from '@/context/JurisdictionContext';

interface UsajobsJobListingsPanelProps {
  tourId?: string;
}

export const UsajobsJobListingsPanel: React.FC<UsajobsJobListingsPanelProps> = ({
  tourId = 'federal-jobs',
}) => {
  const { activeState } = useJurisdiction();
  const [data, setData] = useState<FederalJobsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchFederalJobOpenings(activeState, 12)
      .then(res => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeState]);

  const dataMode = data?.data_mode === 'live' && data.jobs.length > 0 ? 'live' : 'sample';

  return (
    <Ww360Section
      title="Federal operator openings"
      description="Live job announcements from USAJOBS — water, wastewater, and treatment plant roles."
      dataMode={dataMode}
      tourId={tourId}
    >
      <div className="space-y-4 px-5 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Ww360SourceChip id="usajobs" />
          {activeState && (
            <span className="text-[0.875rem] text-slate-500">
              Filtered to {activeState} when location matches
            </span>
          )}
        </div>

        {loading && (
          <p className="text-[1.125rem] text-slate-500">Loading federal job postings…</p>
        )}

        {!loading && data && !data.configured && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[1.125rem] leading-relaxed text-amber-900">
            USAJOBS API is not configured on this server. Set <code>USAJOBS_API_KEY</code> and{' '}
            <code>USAJOBS_USER_AGENT</code> in the environment to show live federal listings.
          </p>
        )}

        {!loading && data?.configured && data.jobs.length === 0 && (
          <p className="text-[1.125rem] text-slate-600">
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
              These are federal announcements only. Municipal utilities often post on GovernmentJobs.com
              or state workforce boards — not included here.
            </p>
          </>
        )}
      </div>
    </Ww360Section>
  );
};
