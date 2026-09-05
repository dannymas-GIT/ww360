import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface IngestionSummary {
  cutoff_days?: number;
  cutoff_date?: string;
  historical_readings?: number;
  recent_readings?: number;
  historical_completions?: number;
  recent_completions?: number;
  schedules_created?: number;
  schedules_updated?: number;
  events_created?: number;
  mcl_exceedance_count?: number;
  readings_completed_via_provision?: number;
}

export interface ImportSummaryData {
  staging_batch_id?: number;
  rows_held_for_review?: number;
  clean_rows_auto_ingested?: number;
  alerts_suppressed_historical?: number;
  ingestion_summary?: IngestionSummary | null;
  verification_summary?: {
    flagged?: number;
    passed?: number;
    mcl_exceedances?: unknown[];
  };
}

interface IngestionSummaryCardProps {
  summary: ImportSummaryData;
  title?: string;
}

export const IngestionSummaryCard: React.FC<IngestionSummaryCardProps> = ({
  summary,
  title = 'Ingestion results',
}) => {
  const ingestion = summary.ingestion_summary;
  const flagged = summary.verification_summary?.flagged ?? summary.rows_held_for_review ?? 0;
  const mclCount =
    ingestion?.mcl_exceedance_count ?? summary.verification_summary?.mcl_exceedances?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          Historical samples older than the cutoff are backfilled as completed calendar events.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
        {summary.staging_batch_id ? (
          <div>
            <span className="text-slate-500">Batch</span>
            <p className="font-medium">#{summary.staging_batch_id}</p>
          </div>
        ) : null}
        {ingestion?.cutoff_date ? (
          <div>
            <span className="text-slate-500">Cutoff date</span>
            <p className="font-medium">
              {new Date(ingestion.cutoff_date).toLocaleDateString()} ({ingestion.cutoff_days ?? '—'}{' '}
              days)
            </p>
          </div>
        ) : null}
        <div>
          <span className="text-slate-500">Auto-promoted rows</span>
          <p className="font-medium">{summary.clean_rows_auto_ingested ?? 0}</p>
        </div>
        <div>
          <span className="text-slate-500">Flagged rows remaining</span>
          <p className="font-medium">{flagged}</p>
        </div>
        {ingestion ? (
          <>
            <div>
              <span className="text-slate-500">Historical readings</span>
              <p className="font-medium">
                {ingestion.historical_readings ?? 0} ({ingestion.historical_completions ?? 0}{' '}
                completions)
              </p>
            </div>
            <div>
              <span className="text-slate-500">Recent readings</span>
              <p className="font-medium">
                {ingestion.recent_readings ?? 0} ({ingestion.recent_completions ?? 0} completions)
              </p>
            </div>
            <div>
              <span className="text-slate-500">Schedules created</span>
              <p className="font-medium">{ingestion.schedules_created ?? 0}</p>
            </div>
            <div>
              <span className="text-slate-500">MCL exceedances</span>
              <p className="font-medium">{mclCount}</p>
            </div>
          </>
        ) : null}
        {(summary.alerts_suppressed_historical ?? 0) > 0 ? (
          <div className="sm:col-span-2">
            <span className="text-slate-500">Historical alerts suppressed</span>
            <p className="font-medium">{summary.alerts_suppressed_historical}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default IngestionSummaryCard;
