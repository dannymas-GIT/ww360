import { RegulatoryPendingReview } from '@/components/RegulatoryPendingReview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useAuth } from '@/context/AuthContext';
import { useTenantAuthContext } from '@/hooks/useTenantAuthContext';
import {
  fetchMclCompareBulk,
  proposeMclChange,
  seedBaselineGuidelines,
  setDistrictMclOverride,
  type MclCompareResponse,
} from '@/services/mclCompareService';
import { getAuthHeader } from '@/services/authService';
import { Activity, Database, ExternalLink, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function formatTier(row: MclCompareResponse['epa']) {
  if (!row?.value) return '—';
  return `${row.value} ${row.unit || ''}`.trim();
}

type LimitActionMode = 'override' | 'propose';

const PROPOSE_JURISDICTIONS = ['NYS', 'NASSAU', 'SUFFOLK', 'EPA', 'ST_NJ'] as const;

export function DistrictMclMonitoringTab() {
  const { isGlobalAdmin } = useAuth();
  const { toast } = useToast();
  const { data: tenantCtx } = useTenantAuthContext();
  const districtCode = tenantCtx?.district_code || '';
  const [syncStatus, setSyncStatus] = useState<Record<string, unknown> | null>(null);
  const [comparisons, setComparisons] = useState<MclCompareResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitContaminant, setLimitContaminant] = useState('');
  const [limitValue, setLimitValue] = useState('');
  const [limitUnit, setLimitUnit] = useState('mg/L');
  const [limitMode, setLimitMode] = useState<LimitActionMode>('override');
  const [proposedJurisdiction, setProposedJurisdiction] = useState<string>('NYS');
  const [citationUrl, setCitationUrl] = useState('');
  const [proposalNotes, setProposalNotes] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  const load = useCallback(async () => {
    if (!districtCode) return;
    setLoading(true);
    try {
      const [bulk, statusRes] = await Promise.all([
        fetchMclCompareBulk(districtCode),
        fetch('/api/v1/regulatory-dashboard/monitoring-dashboard-status', {
          headers: { ...getAuthHeader() },
        }),
      ]);
      setComparisons(bulk.comparisons || []);
      if (statusRes.ok) {
        const status = await statusRes.json();
        setSyncStatus((status.structured_sync as Record<string, unknown>) || null);
      }
    } finally {
      setLoading(false);
    }
  }, [districtCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const openLimitDialog = (contaminant: string) => {
    setLimitContaminant(contaminant);
    setLimitValue('');
    setLimitUnit('mg/L');
    setLimitMode('override');
    setProposedJurisdiction('NYS');
    setCitationUrl('');
    setProposalNotes('');
    setLimitDialogOpen(true);
  };

  const handleSeedBaseline = async (apply: boolean) => {
    setSeeding(true);
    try {
      const result = await seedBaselineGuidelines(!apply);
      const c = result.counts;
      toast({
        title: apply ? 'Baseline synced to guidelines' : 'Baseline seed preview',
        description: apply
          ? `Promoted ${c.promoted}, skipped ${c.skipped}, errors ${c.errors}.`
          : `Would update ${c.preview} entries (${c.skipped} unchanged).`,
      });
      if (apply) await load();
    } catch (e) {
      toast({
        title: 'Baseline seed failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSeeding(false);
    }
  };

  const saveLimitAction = async () => {
    const val = parseFloat(limitValue);
    if (!limitContaminant || !Number.isFinite(val)) return;
    setSavingLimit(true);
    try {
      if (limitMode === 'override') {
        await setDistrictMclOverride({
          contaminant: limitContaminant,
          value: val,
          unit: limitUnit,
          district_code: districtCode,
        });
        toast({
          title: 'District override saved',
          description: 'Applied immediately for this district only.',
        });
      } else {
        const result = await proposeMclChange({
          contaminant: limitContaminant,
          value: val,
          unit: limitUnit,
          proposed_jurisdiction: proposedJurisdiction,
          district_code: districtCode,
          citation_url: citationUrl || undefined,
          notes: proposalNotes || undefined,
        });
        if (!result.success) {
          throw new Error(result.error || 'Proposal failed');
        }
        toast({
          title: 'Proposal submitted',
          description: 'Routed to pending regulatory review for central sign-off.',
        });
      }
      setLimitDialogOpen(false);
      await load();
    } catch (e) {
      toast({
        title: limitMode === 'override' ? 'Override failed' : 'Proposal failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingLimit(false);
    }
  };

  return (
    <div className="space-y-6">
      <RegulatoryPendingReview prominent />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Structured MCL sync status
          </CardTitle>
          <CardDescription>
            Daily pipeline snapshots from EPA, state, and county parsers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <Badge variant="outline">
            Last run:{' '}
            {syncStatus?.last_run_at
              ? new Date(String(syncStatus.last_run_at)).toLocaleString()
              : 'Unknown'}
          </Badge>
          <Badge variant="secondary">
            Latest batch: {String(syncStatus?.snapshots_in_latest_batch ?? 0)} snapshots
          </Badge>
          {Array.isArray(syncStatus?.parser_runs) &&
            (syncStatus.parser_runs as Array<Record<string, unknown>>).map(run => (
              <Badge
                key={String(run.parser_source_code)}
                variant={
                  run.status === 'ok'
                    ? 'outline'
                    : run.status === 'empty'
                      ? 'secondary'
                      : 'destructive'
                }
                title={String(run.error_message || run.source_url || '')}
              >
                {String(run.parser_source_code)}: {String(run.status)} (
                {String(run.rows_emitted ?? 0)})
              </Badge>
            ))}
          {!Array.isArray(syncStatus?.parser_runs) && syncStatus?.parser_counts
            ? Object.entries(syncStatus.parser_counts as Record<string, number>).map(([k, v]) => (
                <Badge key={k} variant="outline">
                  {k}: {v}
                </Badge>
              ))
            : null}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {isGlobalAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={seeding}
                onClick={() => void handleSeedBaseline(false)}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                Preview baseline seed
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={seeding}
                onClick={() => void handleSeedBaseline(true)}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                Sync curated baseline → guidelines
              </Button>
            </>
          )}
          <Link
            to="/dashboard/regulatory-sources"
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            Global regulatory dashboard
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/dashboard/admin/regulatory-config"
            className="text-sm text-blue-600 hover:underline"
          >
            Schedule config (EPA/State thresholds)
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">MCL comparison by contaminant</CardTitle>
          <CardDescription>
            EPA, state, county, and district override values for scheduling decisions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contaminant</TableHead>
                <TableHead>EPA</TableHead>
                <TableHead>State</TableHead>
                <TableHead>County</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead className="w-[1%]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisons.map(row => (
                <TableRow key={row.contaminant_name}>
                  <TableCell className="font-medium">{row.contaminant_name}</TableCell>
                  <TableCell>{formatTier(row.epa)}</TableCell>
                  <TableCell>{formatTier(row.state)}</TableCell>
                  <TableCell>{formatTier(row.county)}</TableCell>
                  <TableCell>{formatTier(row.district_override)}</TableCell>
                  <TableCell>
                    {row.effective_choice
                      ? `${row.effective_choice.value} ${row.effective_choice.unit} (${row.effective_choice.jurisdiction})`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openLimitDialog(row.contaminant_name)}
                    >
                      Set limit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Set MCL — {limitContaminant}</DialogTitle>
            <DialogDescription>
              District override applies immediately for this district only. Proposals route to
              central compliance review before becoming authoritative limits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Action</Label>
              <Select value={limitMode} onValueChange={v => setLimitMode(v as LimitActionMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="override">District override (immediate, local)</SelectItem>
                  <SelectItem value="propose">Propose to compliance (central sign-off)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Value</Label>
                <Input
                  type="number"
                  step="any"
                  value={limitValue}
                  onChange={e => setLimitValue(e.target.value)}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input value={limitUnit} onChange={e => setLimitUnit(e.target.value)} />
              </div>
            </div>
            {limitMode === 'propose' && (
              <>
                <div>
                  <Label>Jurisdiction tier</Label>
                  <Select value={proposedJurisdiction} onValueChange={setProposedJurisdiction}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPOSE_JURISDICTIONS.map(j => (
                        <SelectItem key={j} value={j}>
                          {j}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Citation URL (primacy document)</Label>
                  <Input
                    value={citationUrl}
                    onChange={e => setCitationUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>Notes for reviewer</Label>
                  <Input value={proposalNotes} onChange={e => setProposalNotes(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={savingLimit} onClick={() => void saveLimitAction()}>
              {limitMode === 'override' ? 'Save override' : 'Submit proposal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DistrictMclMonitoringTab;
