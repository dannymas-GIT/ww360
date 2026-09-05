import { AddWellDialog } from '@/components/wells/AddWellDialog';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/components/ui/use-toast';
import {
  fetchLatestOnboardingIngestionBatch,
  fetchWellCandidates,
  type WellCandidate,
} from '@/services/onboardingService';
import { readWizardPersisted } from '@/pages/admin/onboardingWizardSteps';
import { submitWellMatchingDecisions } from '@/services/csvImportService';
import { updateWell } from '@/services/wellApi';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

const WELL_TYPES = ['Production', 'Monitoring', 'Observation', 'Injection', 'Other'];
const WELL_STATUSES = ['Active', 'Inactive', 'Abandoned', 'Under construction'];

type EditableFields = {
  name: string;
  well_type: string;
  status: string;
};

function defaultFields(candidate: WellCandidate): EditableFields {
  return {
    name: candidate.name || candidate.sample_id,
    well_type: candidate.well_type || 'Production',
    status: candidate.status || 'Active',
  };
}

const STATUS_BADGE: Record<WellCandidate['match_status'], 'default' | 'secondary' | 'outline'> = {
  mapped: 'default',
  created: 'secondary',
  unmatched: 'outline',
};

const STATUS_LABEL: Record<WellCandidate['match_status'], string> = {
  mapped: 'Mapped',
  created: 'Created',
  unmatched: 'Unmatched',
};

interface OnboardingWellLabelStepProps {
  districtCode: string;
  batchId: number | null | undefined;
  onBack: () => void;
  onContinue: () => void;
  onRefreshStatus: () => void;
}

export const OnboardingWellLabelStep: React.FC<OnboardingWellLabelStepProps> = ({
  districtCode,
  batchId,
  onBack,
  onContinue,
  onRefreshStatus,
}) => {
  const { toast } = useToast();
  const [resolvedBatchId, setResolvedBatchId] = useState<number | null>(null);
  const [resolvingBatch, setResolvingBatch] = useState(true);
  const [batchLabel, setBatchLabel] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<WellCandidate[]>([]);
  const [fields, setFields] = useState<Record<string, EditableFields>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [wellDialogOpen, setWellDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const resolveBatch = async () => {
      setResolvingBatch(true);
      try {
        if (batchId) {
          if (!cancelled) {
            setResolvedBatchId(batchId);
            setBatchLabel(`batch #${batchId}`);
          }
          return;
        }
        const saved = readWizardPersisted();
        if (
          saved?.staging_batch_id &&
          saved.district.toUpperCase() === districtCode.toUpperCase()
        ) {
          if (!cancelled) {
            setResolvedBatchId(saved.staging_batch_id);
            setBatchLabel(`batch #${saved.staging_batch_id} (saved session)`);
          }
          return;
        }
        const latest = await fetchLatestOnboardingIngestionBatch(districtCode);
        if (!cancelled && latest.batch_id) {
          setResolvedBatchId(latest.batch_id);
          const fileHint = latest.original_filename ? ` · ${latest.original_filename}` : '';
          setBatchLabel(`batch #${latest.batch_id}${fileHint}`);
        } else if (!cancelled) {
          setResolvedBatchId(null);
          setBatchLabel(null);
        }
      } catch (err) {
        if (!cancelled) {
          setResolvedBatchId(null);
          setBatchLabel(null);
          toast({
            title: 'Could not find import batch',
            description: err instanceof Error ? err.message : 'Unknown error',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setResolvingBatch(false);
      }
    };
    void resolveBatch();
    return () => {
      cancelled = true;
    };
  }, [batchId, districtCode, toast]);

  const loadCandidates = useCallback(async () => {
    if (!resolvedBatchId || !districtCode) {
      setCandidates([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchWellCandidates(districtCode, resolvedBatchId);
      setCandidates(rows);
      setFields(
        Object.fromEntries(rows.map(row => [row.sample_id, defaultFields(row)]))
      );
    } catch (err) {
      toast({
        title: 'Could not load well candidates',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [resolvedBatchId, districtCode, toast]);

  useEffect(() => {
    if (!resolvingBatch) {
      void loadCandidates();
    }
  }, [loadCandidates, resolvingBatch]);

  const updateField = (sampleId: string, key: keyof EditableFields, value: string) => {
    setFields(prev => ({
      ...prev,
      [sampleId]: { ...defaultFields({ sample_id: sampleId } as WellCandidate), ...prev[sampleId], [key]: value },
    }));
  };

  const handleSave = async (candidate: WellCandidate) => {
    if (!candidate.well_id) return;
    const edit = fields[candidate.sample_id] ?? defaultFields(candidate);
    setSavingId(candidate.sample_id);
    try {
      await updateWell(candidate.well_id, {
        name: edit.name.trim() || candidate.sample_id,
        well_type: edit.well_type,
        status: edit.status,
      });
      toast({
        title: 'Well updated',
        description: `${candidate.sample_id} tags saved.`,
      });
      await loadCandidates();
      onRefreshStatus();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async (candidate: WellCandidate) => {
    if (!resolvedBatchId) return;
    const edit = fields[candidate.sample_id] ?? defaultFields(candidate);
    setCreatingId(candidate.sample_id);
    try {
      const response = await submitWellMatchingDecisions(
        [
          {
            csv_id: candidate.sample_id,
            action: 'create',
            district: districtCode,
          },
        ],
        resolvedBatchId
      );
      const mappedId = response.well_mapping?.[candidate.sample_id];
      const wellId =
        typeof mappedId === 'number'
          ? mappedId
          : mappedId != null
            ? Number(mappedId)
            : null;
      if (wellId) {
        await updateWell(wellId, {
          name: edit.name.trim() || candidate.sample_id,
          well_type: edit.well_type,
          status: edit.status,
        });
      }
      toast({
        title: 'Well created',
        description: `${candidate.sample_id} linked to import batch.`,
      });
      await loadCandidates();
      onRefreshStatus();
    } catch (err) {
      toast({
        title: 'Create failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setCreatingId(null);
    }
  };

  if (resolvingBatch) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-8 flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Looking up your latest ingestion import…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!resolvedBatchId) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Label wells from import</CardTitle>
            <CardDescription>
              Complete the ingestion import on the previous step first. Wells discovered in your
              CSV will appear here for naming and tagging.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to ingestion
            </Button>
            <Button variant="outline" onClick={() => setWellDialogOpen(true)}>
              Add well manually
            </Button>
          </CardContent>
        </Card>
        <AddWellDialog
          open={wellDialogOpen}
          onOpenChange={setWellDialogOpen}
          onCreated={onRefreshStatus}
        />
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onContinue}>
            Continue to finish
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Label wells from import</CardTitle>
          <CardDescription>
            Review sample IDs from {batchLabel ?? `batch #${resolvedBatchId}`}. Set display names,
            well type, and status before finishing onboarding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading wells from import…
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-slate-600">
              No sample IDs found in this batch. You can add wells manually or continue to finish.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="py-2 pr-3 font-medium">Sample ID</th>
                    <th className="py-2 pr-3 font-medium">Match</th>
                    <th className="py-2 pr-3 font-medium">Rows</th>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(candidate => {
                    const edit = fields[candidate.sample_id] ?? defaultFields(candidate);
                    const isUnmatched = candidate.match_status === 'unmatched';
                    return (
                      <tr key={candidate.sample_id} className="border-b align-top">
                        <td className="py-3 pr-3 font-mono text-xs">{candidate.sample_id}</td>
                        <td className="py-3 pr-3">
                          <Badge variant={STATUS_BADGE[candidate.match_status]}>
                            {STATUS_LABEL[candidate.match_status]}
                          </Badge>
                          {candidate.well_number ? (
                            <p className="text-xs text-slate-500 mt-1">{candidate.well_number}</p>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3">{candidate.row_count}</td>
                        <td className="py-3 pr-3 min-w-[10rem]">
                          <Label className="sr-only" htmlFor={`name-${candidate.sample_id}`}>
                            Name
                          </Label>
                          <Input
                            id={`name-${candidate.sample_id}`}
                            value={edit.name}
                            onChange={e => updateField(candidate.sample_id, 'name', e.target.value)}
                          />
                        </td>
                        <td className="py-3 pr-3 min-w-[8rem]">
                          <Select
                            value={edit.well_type}
                            onValueChange={v => updateField(candidate.sample_id, 'well_type', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WELL_TYPES.map(t => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 pr-3 min-w-[8rem]">
                          <Select
                            value={edit.status}
                            onValueChange={v => updateField(candidate.sample_id, 'status', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WELL_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            {isUnmatched ? (
                              <Button
                                size="sm"
                                onClick={() => void handleCreate(candidate)}
                                disabled={creatingId === candidate.sample_id}
                              >
                                {creatingId === candidate.sample_id ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : null}
                                Create well
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleSave(candidate)}
                                disabled={savingId === candidate.sample_id || !candidate.well_id}
                              >
                                {savingId === candidate.sample_id ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : null}
                                Save tags
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={() => setWellDialogOpen(true)}>
              Add well
            </Button>
          </div>
        </CardContent>
      </Card>
      <AddWellDialog
        open={wellDialogOpen}
        onOpenChange={setWellDialogOpen}
        onCreated={() => {
          onRefreshStatus();
          void loadCandidates();
        }}
      />
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue}>
          Continue to finish
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};
