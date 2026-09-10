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
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface DistrictDateRangePurgeDistrictRow {
  district_code: string;
  district_name: string;
}

type DateColumnMode = 'sample_date' | 'created_at';

interface StagingBatchPreviewRow {
  batch_id: number;
  display_name: string;
  batch_status: string | null;
  source_type: string | null;
  staging_result_rows: number;
  promoted_result_rows: number;
}

interface StagingBatchesSummary {
  batch_count: number;
  total_staging_result_rows: number;
  total_promoted_result_rows: number;
}

interface PurgeApiResponse {
  success?: boolean;
  dry_run?: boolean;
  district_code?: string;
  district_name?: string;
  before_counts?: Record<string, number>;
  cleared_counts?: Record<string, number>;
  expected_confirmation?: string;
  reading_ids_count?: number;
  staging_batch_ids_count?: number;
  staging_batches_preview?: StagingBatchPreviewRow[];
  staging_batches_summary?: StagingBatchesSummary;
  fk_cleanup?: Record<string, unknown>;
  detail?: string;
}

export interface DistrictDateRangePurgeCardProps {
  districts: DistrictDateRangePurgeDistrictRow[];
  /** When set, district is fixed (district admin / manager — own district only). */
  lockedDistrictCode?: string;
  /** While tenant context is loading, disable actions that need a locked district. */
  tenantContextLoading?: boolean;
}

export default function DistrictDateRangePurgeCard({
  districts,
  lockedDistrictCode,
  tenantContextLoading = false,
}: DistrictDateRangePurgeCardProps) {
  const { toast } = useToast();
  const [districtCode, setDistrictCode] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateColumn, setDateColumn] = useState<DateColumnMode>('sample_date');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastPreview, setLastPreview] = useState<PurgeApiResponse | null>(null);
  const [lastExecute, setLastExecute] = useState<PurgeApiResponse | null>(null);

  useEffect(() => {
    if (lockedDistrictCode) {
      setDistrictCode(lockedDistrictCode);
    }
  }, [lockedDistrictCode]);

  const effectiveDistrictCode = lockedDistrictCode ?? districtCode;
  const canSubmit = Boolean(effectiveDistrictCode && startDate && endDate);

  const callApi = async (dryRun: boolean) => {
    if (!canSubmit) {
      toast({
        title: 'Missing fields',
        description: 'Select district and both dates.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      const token = dryRun ? '' : confirmation.trim();
      const res = await fetch('/api/v1/admin-utilities/clear-district-sample-data-range', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          district_code: effectiveDistrictCode,
          start_date: startDate,
          end_date: endDate,
          date_column: dateColumn,
          confirmation: token,
          dry_run: dryRun,
        }),
      });
      const data = (await res.json()) as PurgeApiResponse;
      if (!res.ok) {
        const msg =
          typeof data.detail === 'string'
            ? data.detail
            : Array.isArray(data.detail)
              ? JSON.stringify(data.detail)
              : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      if (dryRun) {
        setLastPreview(data);
        setLastExecute(null);
        toast({
          title: 'Preview ready',
          description: 'Review batch list, counts, and copy the confirmation token below.',
        });
      } else {
        setLastExecute(data);
        toast({
          title: 'Purge complete',
          description: 'You can re-import the same CSV (hash dedup cleared for removed batches).',
        });
      }
    } catch (e) {
      toast({
        title: dryRun ? 'Preview failed' : 'Purge failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const renderStagingBatchesPreview = (preview: PurgeApiResponse) => {
    const rows = preview.staging_batches_preview;
    const summary = preview.staging_batches_summary;
    if (!rows || rows.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No staging lab batches fall in this range for the selected filter mode.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Staging batches in range</p>
        {summary ? (
          <p className="text-xs text-muted-foreground">
            {summary.batch_count} batch{summary.batch_count === 1 ? '' : 'es'} —{' '}
            {summary.total_staging_result_rows} staging row
            {summary.total_staging_result_rows === 1 ? '' : 's'} total
            {summary.total_promoted_result_rows > 0
              ? ` (${summary.total_promoted_result_rows} with promoted readings)`
              : ''}
            .
          </p>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch name</TableHead>
              <TableHead className="text-right">ID</TableHead>
              <TableHead className="text-right">Staging rows</TableHead>
              <TableHead className="text-right">Promoted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.batch_id}>
                <TableCell
                  className="max-w-[220px] truncate font-mono text-xs"
                  title={r.display_name}
                >
                  {r.display_name}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.batch_id}</TableCell>
                <TableCell className="text-right tabular-nums">{r.staging_result_rows}</TableCell>
                <TableCell className="text-right tabular-nums">{r.promoted_result_rows}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.batch_status ?? '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.source_type ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderCounts = (label: string, counts?: Record<string, number>) => {
    if (!counts || Object.keys(counts).length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead className="text-right">Rows</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(counts).map(([k, v]) => (
              <TableRow key={k}>
                <TableCell className="font-mono text-xs">{k}</TableCell>
                <TableCell className="text-right">{v}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Trash2 className="w-5 h-5" />
          District date-range purge (testing)
        </CardTitle>
        <CardDescription>
          Removes readings (FK-safe), staging batches/results, chain of custody, and orphan email
          ingestion logs for one district in a date range so you can re-import the same CSV
          repeatedly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-700" />
          <AlertDescription className="text-orange-900">
            {lockedDistrictCode
              ? 'Deletes data for your district only in the selected range. Run Preview first, then paste the exact confirmation token before executing.'
              : 'System / platform admins: pick any district. Run Preview first, then paste the exact confirmation token before executing.'}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>District</Label>
            {lockedDistrictCode ? (
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <span className="font-mono font-medium">{lockedDistrictCode}</span>
                {districts.find(d => d.district_code === lockedDistrictCode)?.district_name ? (
                  <span className="text-muted-foreground">
                    {' '}
                    — {districts.find(d => d.district_code === lockedDistrictCode)?.district_name}
                  </span>
                ) : null}
              </div>
            ) : (
              <Select value={districtCode} onValueChange={setDistrictCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select district…" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map(d => (
                    <SelectItem key={d.district_code} value={d.district_code}>
                      {d.district_code} — {d.district_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Date filter mode</Label>
            <Select value={dateColumn} onValueChange={v => setDateColumn(v as DateColumnMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sample_date">Sample date (lab collection)</SelectItem>
                <SelectItem value="created_at">
                  Ingestion time (batch / reading created_at)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="purge-start">Start date (inclusive)</Label>
            <Input
              id="purge-start"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purge-end">End date (inclusive)</Label>
            <Input
              id="purge-end"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy || !canSubmit || tenantContextLoading}
            onClick={() => void callApi(true)}
          >
            Preview (dry run)
          </Button>
        </div>

        {lastPreview && (
          <div className="space-y-4 rounded-md border border-dashed p-4">
            {renderStagingBatchesPreview(lastPreview)}
            {renderCounts(
              'Aggregate row counts (readings + staging + custody + email log)',
              lastPreview.before_counts
            )}
          </div>
        )}

        {lastPreview?.expected_confirmation && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <Label htmlFor="purge-confirm">Confirmation token (exact match)</Label>
            <Input
              id="purge-confirm"
              className="font-mono text-sm"
              placeholder={lastPreview.expected_confirmation}
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required token:{' '}
              <code className="rounded bg-muted px-1 py-0.5">
                {lastPreview.expected_confirmation}
              </code>
            </p>
            <Button
              variant="destructive"
              disabled={
                busy ||
                tenantContextLoading ||
                !canSubmit ||
                confirmation.trim() !== (lastPreview.expected_confirmation ?? '')
              }
              onClick={() => void callApi(false)}
            >
              Execute purge
            </Button>
          </div>
        )}

        {lastExecute?.cleared_counts && (
          <>
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
              <AlertDescription className="text-green-900">
                Purge finished. Re-import the same CSV file; staging hash dedup should accept it if
                those batches/logs were removed.
              </AlertDescription>
            </Alert>
            {lastExecute.staging_batches_preview &&
            lastExecute.staging_batches_preview.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Batches removed (snapshot before delete)</p>
                {renderStagingBatchesPreview(lastExecute)}
              </div>
            ) : null}
            {renderCounts('Deleted / updated rows', lastExecute.cleared_counts)}
          </>
        )}
      </CardContent>
    </Card>
  );
}
