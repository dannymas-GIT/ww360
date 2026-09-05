import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  confirmationTokensMatch,
  executeDataCleanup,
  previewDataCleanup,
  type DataCleanupMode,
  type DataCleanupRequest,
  type DataCleanupResponse,
  type DateColumnMode,
  type EmailLogMode,
} from '@/services/dataCleanupService';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export interface DataCleanupDistrictRow {
  district_code: string;
  district_name: string;
}

type ModeTab = DataCleanupMode;

export interface DataCleanupCardProps {
  districts: DataCleanupDistrictRow[];
  lockedDistrictCode?: string;
  tenantContextLoading?: boolean;
  readOnly?: boolean;
}

export default function DataCleanupCard({
  districts,
  lockedDistrictCode,
  tenantContextLoading = false,
  readOnly = false,
}: DataCleanupCardProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<ModeTab>('date_range');
  const [districtCode, setDistrictCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateColumn, setDateColumn] = useState<DateColumnMode>('sample_date');
  const [batchIdsText, setBatchIdsText] = useState('');

  const [targetProduction, setTargetProduction] = useState(true);
  const [targetStaging, setTargetStaging] = useState(true);
  const [targetEmailLog, setTargetEmailLog] = useState(true);
  const [emailLogMode, setEmailLogMode] = useState<EmailLogMode>('orphan_only');
  const [recallPromoted, setRecallPromoted] = useState(false);

  const [preview, setPreview] = useState<DataCleanupResponse | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tenantContextLoading) return;
    const preferred = lockedDistrictCode || districts[0]?.district_code || '';
    setDistrictCode(prev =>
      prev && districts.some(d => d.district_code === prev) ? prev : preferred
    );
  }, [lockedDistrictCode, districts, tenantContextLoading]);

  // Preview token is only valid for the exact options used in the dry run.
  useEffect(() => {
    setPreview(null);
    setConfirmation('');
  }, [
    mode,
    districtCode,
    startDate,
    endDate,
    dateColumn,
    batchIdsText,
    targetProduction,
    targetStaging,
    targetEmailLog,
    emailLogMode,
    recallPromoted,
  ]);

  const parsedBatchIds = useMemo(() => {
    return batchIdsText
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !Number.isNaN(n) && n > 0);
  }, [batchIdsText]);

  const buildRequest = (dryRun: boolean): DataCleanupRequest => ({
    mode,
    district_code: mode === 'batch_ids' ? undefined : districtCode || undefined,
    start_date: mode === 'date_range' ? startDate || undefined : undefined,
    end_date: mode === 'date_range' ? endDate || undefined : undefined,
    date_column: dateColumn,
    batch_ids: mode === 'batch_ids' ? parsedBatchIds : undefined,
    targets: {
      production: targetProduction,
      staging: targetStaging,
      email_log: targetEmailLog,
      email_log_mode: emailLogMode,
      recall_promoted_readings: recallPromoted,
    },
    confirmation: confirmation.trim(),
    dry_run: dryRun,
  });

  const runPreview = async () => {
    setBusy(true);
    try {
      const result = await previewDataCleanup(buildRequest(true));
      setPreview(result);
      setConfirmation(result.expected_confirmation ?? '');
      toast({
        title: 'Preview ready',
        description: result.expected_confirmation
          ? 'Confirmation token filled in — review counts, then execute.'
          : 'Review counts, then execute.',
      });
    } catch (e: unknown) {
      setPreview(null);
      toast({
        variant: 'destructive',
        title: 'Preview failed',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const runExecute = async () => {
    if (!preview?.expected_confirmation) {
      toast({ variant: 'destructive', title: 'Run preview first' });
      return;
    }
    if (!confirmationTokensMatch(confirmation, preview.expected_confirmation)) {
      toast({
        variant: 'destructive',
        title: 'Confirmation does not match preview token',
        description: `Expected: ${preview.expected_confirmation}`,
      });
      return;
    }
    const ok = window.confirm('This permanently deletes data. This cannot be undone. Proceed?');
    if (!ok) return;

    setBusy(true);
    try {
      const result = await executeDataCleanup(buildRequest(false));
      setPreview(result);
      toast({
        title: 'Cleanup complete',
        description: result.district_code ? `District ${result.district_code}` : 'Batches removed',
      });
      setConfirmation('');
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Cleanup failed',
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const applyWholeDistrictPreset = () => {
    setMode('whole_district');
    setTargetProduction(true);
    setTargetStaging(true);
    setTargetEmailLog(true);
    setEmailLogMode('orphan_only');
    setRecallPromoted(false);
  };

  const applyProductionOnlyPreset = () => {
    setTargetProduction(true);
    setTargetStaging(false);
    setTargetEmailLog(false);
    setRecallPromoted(false);
  };

  const applyFullReimportPreset = () => {
    setTargetProduction(true);
    setTargetStaging(true);
    setTargetEmailLog(true);
    setEmailLogMode('orphan_only');
    setRecallPromoted(false);
  };

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800">
          <Trash2 className="h-5 w-5" />
          Data cleanup (unified)
        </CardTitle>
        <CardDescription>
          Remove production readings, staging batches (email and manual upload), and email ingestion
          logs. Preview first — confirmation token is required to execute.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-950 text-sm">
            Whole-district confirmation is now{' '}
            <code className="bg-white/80 px-1 rounded">DELETE {'{code}'} ALL DATA</code> (not
            &quot;DELETE DISTRICT DATA&quot;). Use <strong>Full re-import preset</strong> before
            re-testing the same CSV files.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          {(['date_range', 'whole_district', 'batch_ids'] as ModeTab[]).map(m => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={mode === m ? 'default' : 'outline'}
              onClick={() => setMode(m)}
              disabled={readOnly}
            >
              {m === 'date_range'
                ? 'Date range'
                : m === 'whole_district'
                  ? 'Whole district'
                  : 'Batch IDs'}
            </Button>
          ))}
        </div>

        {mode !== 'batch_ids' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {!lockedDistrictCode && districts.length > 1 ? (
              <div>
                <Label>District</Label>
                <Select value={districtCode} onValueChange={setDistrictCode} disabled={readOnly}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map(d => (
                      <SelectItem key={d.district_code} value={d.district_code}>
                        {d.district_code} — {d.district_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>District</Label>
                <p className="mt-1 text-sm font-medium">{districtCode || '—'}</p>
              </div>
            )}
            {mode === 'date_range' && (
              <>
                <div>
                  <Label htmlFor="dc-start">Start date</Label>
                  <Input
                    id="dc-start"
                    type="date"
                    className="mt-1"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="dc-end">End date</Label>
                  <Input
                    id="dc-end"
                    type="date"
                    className="mt-1"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label>Date column</Label>
                  <Select
                    value={dateColumn}
                    onValueChange={v => setDateColumn(v as DateColumnMode)}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sample_date">Sample date</SelectItem>
                      <SelectItem value="created_at">Batch created at</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'batch_ids' && (
          <div>
            <Label>Staging batch IDs (comma-separated)</Label>
            <Input
              className="mt-1 font-mono"
              placeholder="e.g. 42, 43"
              value={batchIdsText}
              onChange={e => setBatchIdsText(e.target.value)}
              disabled={readOnly}
            />
          </div>
        )}

        <div className="rounded-md border p-3 space-y-2">
          <p className="text-sm font-medium">Targets</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={targetProduction}
              onChange={e => setTargetProduction(e.target.checked)}
              disabled={readOnly}
            />
            Production (readings, alerts, schedules)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={targetStaging}
              onChange={e => setTargetStaging(e.target.checked)}
              disabled={readOnly}
            />
            Staging (all batches in scope — email and manual upload)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={targetEmailLog}
              onChange={e => setTargetEmailLog(e.target.checked)}
              disabled={readOnly}
            />
            Email ingestion log
          </label>
          {targetEmailLog && (
            <Select
              value={emailLogMode}
              onValueChange={v => setEmailLogMode(v as EmailLogMode)}
              disabled={readOnly}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orphan_only">Orphan only (safe)</SelectItem>
                <SelectItem value="all_in_scope">All logs for district</SelectItem>
              </SelectContent>
            </Select>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={recallPromoted}
              onChange={e => setRecallPromoted(e.target.checked)}
              disabled={readOnly}
            />
            Recall promoted readings (delete production readings linked to staging)
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={applyFullReimportPreset}
              disabled={readOnly}
            >
              Full re-import preset
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={applyProductionOnlyPreset}
              disabled={readOnly}
            >
              Production only
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={applyWholeDistrictPreset}
              disabled={readOnly}
            >
              Whole district + all targets
            </Button>
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void runPreview()}
              disabled={busy}
            >
              Preview (dry run)
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void runExecute()}
              disabled={busy || !preview?.expected_confirmation}
            >
              Execute cleanup
            </Button>
          </div>
        )}

        {preview && (
          <div className="space-y-3 text-sm">
            {preview.expected_confirmation && (
              <div className="rounded bg-gray-100 p-2 font-mono text-xs break-all">
                Confirmation: {preview.expected_confirmation}
              </div>
            )}
            {preview.before_counts && (
              <pre className="text-xs bg-slate-50 border rounded p-2 overflow-auto max-h-32">
                {JSON.stringify(preview.before_counts, null, 2)}
              </pre>
            )}
            {preview.staging_batches_summary?.source_type_counts && (
              <p>
                Source types:{' '}
                {Object.entries(preview.staging_batches_summary.source_type_counts)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ')}
              </p>
            )}
            {preview.staging_batches_preview && preview.staging_batches_preview.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Promoted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.staging_batches_preview.map(row => (
                    <TableRow key={row.batch_id}>
                      <TableCell className="font-mono text-xs">
                        {row.batch_id}
                        <br />
                        <span className="text-gray-500">{row.display_name}</span>
                      </TableCell>
                      <TableCell>{row.source_type ?? '—'}</TableCell>
                      <TableCell>{row.staging_result_rows}</TableCell>
                      <TableCell>{row.promoted_result_rows}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {preview.cleared_counts && (
              <pre className="text-xs bg-green-50 border border-green-200 rounded p-2 overflow-auto max-h-32">
                Cleared: {JSON.stringify(preview.cleared_counts, null, 2)}
              </pre>
            )}
            {!readOnly && (
              <div>
                <Label htmlFor="dc-confirm">Confirmation token</Label>
                <Input
                  id="dc-confirm"
                  className="mt-1 font-mono"
                  value={confirmation}
                  onChange={e => setConfirmation(e.target.value)}
                  placeholder={preview.expected_confirmation ?? ''}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
