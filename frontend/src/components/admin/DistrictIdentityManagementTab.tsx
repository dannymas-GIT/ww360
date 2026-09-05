/**
 * District admin: well & contaminant identity management (alias, rename, merge).
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import {
  addContaminantAlias,
  addWellAlias,
  fetchContaminantIdentityCandidates,
  fetchWellIdentityCandidates,
  mergeContaminants,
  mergeWellsIdentity,
  renameContaminant,
  renameWell,
  type ContaminantIdentityRow,
  type IdentityActionResult,
  type TablesUpdated,
  type WellCandidatePair,
  type WellIdentityRow,
} from '@/services/identityManagementService';
import { Loader2, RefreshCcw, AlertTriangle } from 'lucide-react';

type DuplicateSuggestion = {
  otherId: number;
  otherLabel: string;
  score: number;
};

function PreviewTable({ tables }: { tables?: TablesUpdated }) {
  const entries = Object.entries(tables || {}).filter(
    ([k, v]) => !k.includes('collision') && !k.includes('deduped') && v > 0
  );
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No row updates predicted.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Surface</TableHead>
          <TableHead className="text-right">Rows</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(([k, v]) => (
          <TableRow key={k}>
            <TableCell className="font-mono text-xs">{k}</TableCell>
            <TableCell className="text-right">{v}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function matchesSearch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function wellLabel(w: Pick<WellIdentityRow, 'id' | 'name' | 'well_number'>): string {
  return w.name || w.well_number || `Well #${w.id}`;
}

function buildWellSuggestions(pairs: WellCandidatePair[]): Map<number, DuplicateSuggestion> {
  const map = new Map<number, DuplicateSuggestion>();
  for (const row of pairs) {
    const a = row.well_a;
    const b = row.well_b;
    const existingA = map.get(a.id);
    if (!existingA || row.score > existingA.score) {
      map.set(a.id, { otherId: b.id, otherLabel: wellLabel(b), score: row.score });
    }
    const existingB = map.get(b.id);
    if (!existingB || row.score > existingB.score) {
      map.set(b.id, { otherId: a.id, otherLabel: wellLabel(a), score: row.score });
    }
  }
  return map;
}

function buildContaminantSuggestions(
  pairs: Array<{
    contaminant_a: ContaminantIdentityRow;
    contaminant_b: ContaminantIdentityRow;
    score: number;
  }>
): Map<number, DuplicateSuggestion> {
  const map = new Map<number, DuplicateSuggestion>();
  for (const row of pairs) {
    const a = row.contaminant_a;
    const b = row.contaminant_b;
    const existingA = map.get(a.id);
    if (!existingA || row.score > existingA.score) {
      map.set(a.id, { otherId: b.id, otherLabel: b.name, score: row.score });
    }
    const existingB = map.get(b.id);
    if (!existingB || row.score > existingB.score) {
      map.set(b.id, { otherId: a.id, otherLabel: a.name, score: row.score });
    }
  }
  return map;
}

export const DistrictIdentityManagementTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isGlobalAdmin, isSystemAdmin } = useAuth();
  const canManageContaminantIdentity = isGlobalAdmin || isSystemAdmin;

  const [wellSearch, setWellSearch] = useState('');
  const [contamSearch, setContamSearch] = useState('');
  const [aliasDialog, setAliasDialog] = useState<{
    type: 'well' | 'contaminant';
    id: number;
    label: string;
    defaultAlias: string;
  } | null>(null);
  const [aliasValue, setAliasValue] = useState('');
  const [renameDialog, setRenameDialog] = useState<{
    type: 'well' | 'contaminant';
    id: number;
    name: string;
    wellNumber?: string;
  } | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameWellNumber, setRenameWellNumber] = useState('');
  const [renamePreviewLoading, setRenamePreviewLoading] = useState(false);
  const [mergeDialog, setMergeDialog] = useState<{
    type: 'well' | 'contaminant';
    sourceId: number;
    sourceLabel: string;
    suggestedTargetId?: number;
    suggestedTargetLabel?: string;
    suggestedScore?: number;
  } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [mergeTargetSearch, setMergeTargetSearch] = useState('');
  const [mergePreviewLoading, setMergePreviewLoading] = useState(false);
  const [preview, setPreview] = useState<IdentityActionResult | null>(null);
  const [previewTitle, setPreviewTitle] = useState('Confirm identity change');
  const [previewSummary, setPreviewSummary] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);

  const wellsQuery = useQuery({
    queryKey: ['identity', 'well-candidates'],
    queryFn: fetchWellIdentityCandidates,
    staleTime: 30_000,
  });

  const contamQuery = useQuery({
    queryKey: ['identity', 'contaminant-candidates'],
    queryFn: fetchContaminantIdentityCandidates,
    staleTime: 30_000,
  });

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['identity'] });
    await queryClient.invalidateQueries({ queryKey: ['wells'] });
    await queryClient.invalidateQueries({ queryKey: ['district', 'well-duplicates'] });
  };

  const runPreviewThenConfirm = async (
    previewFn: () => Promise<IdentityActionResult>,
    applyFn: () => Promise<void>,
    title: string,
    summary?: string
  ) => {
    try {
      const result = await previewFn();
      setPreview(result);
      setPreviewTitle(`Confirm ${title.toLowerCase()}`);
      setPreviewSummary(summary || null);
      setConfirmAction(() => applyFn);
      toast({ title: `${title} preview ready`, description: 'Review impact and confirm.' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Preview failed',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const wellSuggestions = useMemo(
    () => buildWellSuggestions(wellsQuery.data?.candidates || []),
    [wellsQuery.data?.candidates]
  );

  const contamSuggestions = useMemo(
    () => buildContaminantSuggestions(contamQuery.data?.fuzzy_pairs || []),
    [contamQuery.data?.fuzzy_pairs]
  );

  const filteredWells = useMemo(() => {
    const wells = (wellsQuery.data?.wells || []).filter(w =>
      matchesSearch(
        `${w.name || ''} ${w.well_number || ''} ${w.id} ${(w.historical_names || []).join(' ')}`,
        wellSearch
      )
    );
    return [...wells].sort((a, b) => {
      const sa = wellSuggestions.get(a.id)?.score || 0;
      const sb = wellSuggestions.get(b.id)?.score || 0;
      if (sb !== sa) return sb - sa;
      return wellLabel(a).localeCompare(wellLabel(b));
    });
  }, [wellsQuery.data?.wells, wellSearch, wellSuggestions]);

  const filteredContaminants = useMemo(() => {
    const rows = (contamQuery.data?.contaminants || []).filter(c =>
      matchesSearch(
        `${c.name || ''} ${c.cas_number || ''} ${(c.common_names || []).join(' ')}`,
        contamSearch
      )
    );
    return [...rows].sort((a, b) => {
      const sa = contamSuggestions.get(a.id)?.score || 0;
      const sb = contamSuggestions.get(b.id)?.score || 0;
      if (sb !== sa) return sb - sa;
      return a.name.localeCompare(b.name);
    });
  }, [contamQuery.data?.contaminants, contamSearch, contamSuggestions]);

  const mergeTargetWells = useMemo(() => {
    const wells = (wellsQuery.data?.wells || []).filter(
      w =>
        w.id !== mergeDialog?.sourceId &&
        matchesSearch(`${w.name || ''} ${w.well_number || ''} ${w.id}`, mergeTargetSearch)
    );
    const suggestedId = mergeDialog?.suggestedTargetId;
    const scored = wells.map(w => {
      const score =
        w.id === suggestedId
          ? (mergeDialog?.suggestedScore ?? 100)
          : wellSuggestions.get(mergeDialog?.sourceId || -1)?.otherId === w.id
            ? wellSuggestions.get(mergeDialog!.sourceId)!.score
            : 0;
      // Also surface any pair score involving source↔this well
      let pairScore = score;
      for (const pair of wellsQuery.data?.candidates || []) {
        if (
          (pair.well_a.id === mergeDialog?.sourceId && pair.well_b.id === w.id) ||
          (pair.well_b.id === mergeDialog?.sourceId && pair.well_a.id === w.id)
        ) {
          pairScore = Math.max(pairScore, pair.score);
        }
      }
      return { item: w, score: pairScore };
    });
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return wellLabel(a.item).localeCompare(wellLabel(b.item));
    });
    return scored;
  }, [
    wellsQuery.data?.wells,
    wellsQuery.data?.candidates,
    mergeDialog,
    mergeTargetSearch,
    wellSuggestions,
  ]);

  const mergeTargetContaminants = useMemo(() => {
    const rows = (contamQuery.data?.contaminants || []).filter(
      c =>
        c.id !== mergeDialog?.sourceId &&
        matchesSearch(`${c.name || ''} ${c.cas_number || ''} ${c.id}`, mergeTargetSearch)
    );
    const scored = rows.map(c => {
      let pairScore =
        c.id === mergeDialog?.suggestedTargetId ? (mergeDialog?.suggestedScore ?? 100) : 0;
      for (const pair of contamQuery.data?.fuzzy_pairs || []) {
        if (
          (pair.contaminant_a.id === mergeDialog?.sourceId && pair.contaminant_b.id === c.id) ||
          (pair.contaminant_b.id === mergeDialog?.sourceId && pair.contaminant_a.id === c.id)
        ) {
          pairScore = Math.max(pairScore, pair.score);
        }
      }
      return { item: c, score: pairScore };
    });
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.name.localeCompare(b.item.name);
    });
    return scored;
  }, [
    contamQuery.data?.contaminants,
    contamQuery.data?.fuzzy_pairs,
    mergeDialog,
    mergeTargetSearch,
  ]);

  const openRenameWell = (well: WellIdentityRow) => {
    setRenameDialog({
      type: 'well',
      id: well.id,
      name: well.name || '',
      wellNumber: well.well_number || '',
    });
    setRenameName(well.name || '');
    setRenameWellNumber(well.well_number || '');
  };

  const openRenameContaminant = (row: ContaminantIdentityRow) => {
    setRenameDialog({ type: 'contaminant', id: row.id, name: row.name });
    setRenameName(row.name);
    setRenameWellNumber('');
  };

  const openWellAlias = (well: WellIdentityRow, defaultAlias = '') => {
    setAliasDialog({
      type: 'well',
      id: well.id,
      label: wellLabel(well),
      defaultAlias,
    });
    setAliasValue(defaultAlias);
  };

  const openContaminantAlias = (row: ContaminantIdentityRow, defaultAlias = '') => {
    setAliasDialog({ type: 'contaminant', id: row.id, label: row.name, defaultAlias });
    setAliasValue(defaultAlias);
  };

  const openWellMerge = (well: WellIdentityRow) => {
    const suggestion = wellSuggestions.get(well.id);
    setMergeDialog({
      type: 'well',
      sourceId: well.id,
      sourceLabel: wellLabel(well),
      suggestedTargetId: suggestion?.otherId,
      suggestedTargetLabel: suggestion?.otherLabel,
      suggestedScore: suggestion?.score,
    });
    setMergeTargetId(suggestion?.otherId ?? null);
    setMergeTargetSearch('');
  };

  const openContaminantMerge = (row: ContaminantIdentityRow) => {
    const suggestion = contamSuggestions.get(row.id);
    setMergeDialog({
      type: 'contaminant',
      sourceId: row.id,
      sourceLabel: row.name,
      suggestedTargetId: suggestion?.otherId,
      suggestedTargetLabel: suggestion?.otherLabel,
      suggestedScore: suggestion?.score,
    });
    setMergeTargetId(suggestion?.otherId ?? null);
    setMergeTargetSearch('');
  };

  const buildWellRenamePayload = (): { new_name?: string; new_well_number?: string } | null => {
    if (!renameDialog || renameDialog.type !== 'well') return null;
    const newName = renameName.trim();
    const newWellNumber = renameWellNumber.trim();
    if (!newName && !newWellNumber) {
      toast({
        variant: 'destructive',
        title: 'Rename requires a value',
        description: 'Provide a new display name and/or well number.',
      });
      return null;
    }
    const nameChanged = newName !== renameDialog.name.trim();
    const numberChanged = newWellNumber !== (renameDialog.wellNumber || '').trim();
    if (!nameChanged && !numberChanged) {
      toast({
        variant: 'destructive',
        title: 'No changes to apply',
        description: 'Update the display name or well number before previewing.',
      });
      return null;
    }
    return {
      new_name: nameChanged ? newName : undefined,
      new_well_number: numberChanged ? newWellNumber : undefined,
    };
  };

  const runRenamePreview = async () => {
    if (!renameDialog) return;
    setRenamePreviewLoading(true);
    try {
      if (renameDialog.type === 'well') {
        const payload = buildWellRenamePayload();
        if (!payload) return;
        await runPreviewThenConfirm(
          () => renameWell(renameDialog.id, { ...payload, dry_run: true }),
          async () => {
            await renameWell(renameDialog.id, { ...payload, dry_run: false });
            await invalidateAll();
            setPreview(null);
            setConfirmAction(null);
            setRenameDialog(null);
            toast({ title: 'Well renamed' });
          },
          'Well rename'
        );
      } else {
        const newName = renameName.trim();
        if (!newName || newName === renameDialog.name.trim()) {
          toast({
            variant: 'destructive',
            title: 'No changes to apply',
            description: 'Enter a new contaminant name.',
          });
          return;
        }
        await runPreviewThenConfirm(
          () => renameContaminant(renameDialog.id, newName, true),
          async () => {
            await renameContaminant(renameDialog.id, newName, false);
            await invalidateAll();
            setPreview(null);
            setConfirmAction(null);
            setRenameDialog(null);
            toast({ title: 'Contaminant renamed' });
          },
          'Contaminant rename'
        );
      }
    } finally {
      setRenamePreviewLoading(false);
    }
  };

  const runMergePreview = async () => {
    if (!mergeDialog || !mergeTargetId) {
      toast({
        variant: 'destructive',
        title: 'Select merge target',
        description: 'Choose the record to keep (keeper).',
      });
      return;
    }
    if (mergeTargetId === mergeDialog.sourceId) {
      toast({
        variant: 'destructive',
        title: 'Invalid merge',
        description: 'Source and target must differ.',
      });
      return;
    }

    const keeperLabel =
      mergeDialog.type === 'well'
        ? wellLabel(
            (wellsQuery.data?.wells || []).find(w => w.id === mergeTargetId) || {
              id: mergeTargetId,
              name: '',
              well_number: '',
            }
          )
        : (contamQuery.data?.contaminants || []).find(c => c.id === mergeTargetId)?.name ||
          `Contaminant #${mergeTargetId}`;
    const summary = `Merge “${mergeDialog.sourceLabel}” → keep “${keeperLabel}”`;

    setMergePreviewLoading(true);
    try {
      if (mergeDialog.type === 'well') {
        await runPreviewThenConfirm(
          () => mergeWellsIdentity(mergeTargetId, mergeDialog.sourceId, true),
          async () => {
            await mergeWellsIdentity(mergeTargetId, mergeDialog.sourceId, false);
            await invalidateAll();
            setPreview(null);
            setConfirmAction(null);
            setPreviewSummary(null);
            setMergeDialog(null);
            toast({ title: 'Wells merged', description: summary });
          },
          'Well merge',
          summary
        );
      } else {
        await runPreviewThenConfirm(
          () => mergeContaminants(mergeTargetId, mergeDialog.sourceId, true),
          async () => {
            await mergeContaminants(mergeTargetId, mergeDialog.sourceId, false);
            await invalidateAll();
            setPreview(null);
            setConfirmAction(null);
            setPreviewSummary(null);
            setMergeDialog(null);
            toast({ title: 'Contaminants merged', description: summary });
          },
          'Contaminant merge',
          summary
        );
      }
    } finally {
      setMergePreviewLoading(false);
    }
  };

  const aliasMutation = useMutation({
    mutationFn: async () => {
      if (!aliasDialog) return;
      if (aliasDialog.type === 'well') {
        await addWellAlias(aliasDialog.id, aliasValue, false);
      } else {
        await addContaminantAlias(aliasDialog.id, aliasValue, false);
      }
    },
    onSuccess: async () => {
      toast({ title: 'Alias added' });
      setAliasDialog(null);
      setAliasValue('');
      await invalidateAll();
    },
    onError: (err: unknown) => {
      toast({
        variant: 'destructive',
        title: 'Alias failed',
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const unmatched = contamQuery.data?.unmatched_schedule_strings || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Identity management</CardTitle>
          <CardDescription>
            Rename, alias, or merge wells and contaminants. Dry-run previews show schedule, alert,
            and linkage updates. Sent notifications and audit snapshots are not rewritten.
            {wellsQuery.data?.district ? (
              <>
                {' '}
                Scoped to <strong>{wellsQuery.data.district}</strong>.
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="wells">
        <TabsList>
          <TabsTrigger value="wells">Wells</TabsTrigger>
          <TabsTrigger value="contaminants">Contaminants</TabsTrigger>
        </TabsList>

        <TabsContent value="wells" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              className="max-w-sm"
              placeholder="Search wells…"
              value={wellSearch}
              onChange={e => setWellSearch(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => wellsQuery.refetch()}
              disabled={wellsQuery.isFetching}
            >
              {wellsQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>

          {wellsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading wells…
            </div>
          ) : wellsQuery.isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {wellsQuery.error instanceof Error
                  ? wellsQuery.error.message
                  : 'Failed to load wells'}
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  District wells ({filteredWells.length}
                  {wellSearch ? ` of ${wellsQuery.data?.wells.length || 0}` : ''})
                </CardTitle>
                <CardDescription>
                  Rename, alias, or merge any well. Suggested duplicates appear when fuzzy match
                  score is high.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredWells.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No wells found for this district.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Number</TableHead>
                        <TableHead>Suggested duplicate</TableHead>
                        <TableHead>Aliases</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWells.slice(0, 200).map(well => {
                        const suggestion = wellSuggestions.get(well.id);
                        return (
                          <TableRow key={well.id}>
                            <TableCell>
                              <div className="font-medium">{well.name || '—'}</div>
                              <div className="text-xs text-muted-foreground">#{well.id}</div>
                            </TableCell>
                            <TableCell>{well.well_number || '—'}</TableCell>
                            <TableCell className="text-xs">
                              {suggestion ? (
                                <Badge variant="secondary" title={suggestion.otherLabel}>
                                  {suggestion.score}% → {suggestion.otherLabel}
                                </Badge>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                              {(well.historical_names || []).join(', ') || '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2 min-w-[140px]">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRenameWell(well)}
                                >
                                  Rename
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openWellAlias(well, suggestion?.otherLabel || '')}
                                >
                                  Alias
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openWellMerge(well)}
                                >
                                  Merge…
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contaminants" className="space-y-4">
          {!canManageContaminantIdentity && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Contaminant rename/merge requires global admin. You can still add aliases below.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              className="max-w-sm"
              placeholder="Search contaminants…"
              value={contamSearch}
              onChange={e => setContamSearch(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => contamQuery.refetch()}
              disabled={contamQuery.isFetching}
            >
              {contamQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>

          {contamQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading contaminants…
            </div>
          ) : contamQuery.isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {contamQuery.error instanceof Error
                  ? contamQuery.error.message
                  : 'Failed to load contaminants'}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {unmatched.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Unmatched schedule strings ({unmatched.length})
                    </CardTitle>
                    <CardDescription>
                      Use Alias on a contaminant row with the string below as the alias value.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Schedule</TableHead>
                          <TableHead>String</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unmatched.map(u => (
                          <TableRow key={`${u.schedule_id}-${u.unmatched_name}`}>
                            <TableCell className="text-xs">{u.schedule_name}</TableCell>
                            <TableCell>{u.unmatched_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Contaminants ({filteredContaminants.length}
                    {contamSearch ? ` of ${contamQuery.data?.contaminants.length || 0}` : ''})
                  </CardTitle>
                  <CardDescription>
                    CAS is the canonical chemical identifier on the master record. Aliases (
                    common_names) match alternate lab labels without renaming.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredContaminants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No contaminants found.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>CAS</TableHead>
                          <TableHead>Suggested duplicate</TableHead>
                          <TableHead>Aliases</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredContaminants.slice(0, 200).map(row => {
                          const suggestion = contamSuggestions.get(row.id);
                          return (
                            <TableRow key={row.id}>
                              <TableCell>
                                <div className="font-medium">{row.name}</div>
                                <div className="text-xs text-muted-foreground">#{row.id}</div>
                              </TableCell>
                              <TableCell className="text-xs">{row.cas_number || '—'}</TableCell>
                              <TableCell className="text-xs">
                                {suggestion ? (
                                  <Badge variant="secondary" title={suggestion.otherLabel}>
                                    {suggestion.score}% → {suggestion.otherLabel}
                                  </Badge>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                                {(row.common_names || []).join(', ') || '—'}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2 min-w-[140px]">
                                  {canManageContaminantIdentity && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openRenameContaminant(row)}
                                    >
                                      Rename
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openContaminantAlias(row, suggestion?.otherLabel || '')
                                    }
                                  >
                                    Alias
                                  </Button>
                                  {canManageContaminantIdentity && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openContaminantMerge(row)}
                                    >
                                      Merge…
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!aliasDialog} onOpenChange={open => !open && setAliasDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add alias</DialogTitle>
            <DialogDescription>
              Record a lab label on {aliasDialog?.label} so future imports auto-match.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="alias">Alias</Label>
            <Input id="alias" value={aliasValue} onChange={e => setAliasValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAliasDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => aliasMutation.mutate()}
              disabled={aliasMutation.isPending || !aliasValue.trim() || aliasDialog?.id === 0}
            >
              {aliasMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add alias'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renameDialog}
        onOpenChange={open => {
          if (!open) {
            setRenameDialog(null);
            setRenameName('');
            setRenameWellNumber('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {renameDialog?.type === 'well' ? 'Rename well' : 'Rename contaminant'}
            </DialogTitle>
            <DialogDescription>
              {renameDialog?.type === 'well'
                ? `Update display name and/or well number for well #${renameDialog?.id}. Schedules, alerts, and linkages are updated on apply. Previous labels become aliases.`
                : `Update canonical name for contaminant #${renameDialog?.id}. Schedules, alerts, thresholds, and string surfaces are rewritten on apply.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-name">
                {renameDialog?.type === 'well' ? 'Display name' : 'Canonical name'}
              </Label>
              <Input
                id="rename-name"
                value={renameName}
                onChange={e => setRenameName(e.target.value)}
              />
            </div>
            {renameDialog?.type === 'well' ? (
              <div className="space-y-2">
                <Label htmlFor="rename-number">Well number</Label>
                <Input
                  id="rename-number"
                  value={renameWellNumber}
                  onChange={e => setRenameWellNumber(e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(null)}>
              Cancel
            </Button>
            <Button onClick={() => void runRenamePreview()} disabled={renamePreviewLoading}>
              {renamePreviewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Preview impact'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!mergeDialog}
        onOpenChange={open => {
          if (!open) {
            setMergeDialog(null);
            setMergeTargetId(null);
            setMergeTargetSearch('');
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Merge into keeper</DialogTitle>
            <DialogDescription>
              Choose the record to keep. Close matches are listed first.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Merging away
            </div>
            <div className="text-base font-semibold leading-tight">{mergeDialog?.sourceLabel}</div>
            <div className="text-xs text-muted-foreground">#{mergeDialog?.sourceId}</div>
          </div>
          <div className="space-y-2">
            <Label>Keep this record (keeper)</Label>
            <Input
              placeholder="Search by name…"
              value={mergeTargetSearch}
              onChange={e => setMergeTargetSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {(mergeDialog?.type === 'well' ? mergeTargetWells : mergeTargetContaminants)
                .slice(0, 50)
                .map(({ item, score }) => {
                  const id = item.id;
                  const label =
                    mergeDialog?.type === 'well'
                      ? wellLabel(item as WellIdentityRow)
                      : (item as ContaminantIdentityRow).name;
                  const secondary =
                    mergeDialog?.type === 'well'
                      ? (item as WellIdentityRow).well_number
                      : (item as ContaminantIdentityRow).cas_number;
                  const selected = mergeTargetId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`w-full px-3 py-2.5 text-left hover:bg-muted ${
                        selected ? 'bg-muted ring-1 ring-inset ring-slate-400' : ''
                      }`}
                      onClick={() => setMergeTargetId(id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{label}</div>
                          <div className="text-xs text-muted-foreground">
                            #{id}
                            {secondary ? ` · ${secondary}` : ''}
                          </div>
                        </div>
                        {score >= 75 ? (
                          <Badge variant="secondary" className="shrink-0">
                            {score}% match
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
            </div>
            {mergeTargetId ? (
              <p className="text-sm">
                Result:{' '}
                <span className="font-medium text-muted-foreground line-through">
                  {mergeDialog?.sourceLabel}
                </span>{' '}
                →{' '}
                <span className="font-semibold">
                  {mergeDialog?.type === 'well'
                    ? wellLabel(
                        (wellsQuery.data?.wells || []).find(w => w.id === mergeTargetId) || {
                          id: mergeTargetId,
                          name: '',
                          well_number: '',
                        }
                      )
                    : (contamQuery.data?.contaminants || []).find(c => c.id === mergeTargetId)
                        ?.name || `#${mergeTargetId}`}
                </span>
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void runMergePreview()}
              disabled={mergePreviewLoading || !mergeTargetId}
            >
              {mergePreviewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Preview impact'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!preview}
        onOpenChange={open => {
          if (!open && !applyLoading) {
            setPreview(null);
            setConfirmAction(null);
            setPreviewSummary(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
            <DialogDescription>
              Dry-run impact preview. Sent notification bodies and immutable audit snapshots are not
              rewritten.
            </DialogDescription>
          </DialogHeader>
          {previewSummary ? (
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-base font-semibold leading-snug">{previewSummary}</div>
            </div>
          ) : null}
          <PreviewTable tables={preview?.tables_updated} />
          {preview?.duplicate_reading_collisions ? (
            <Alert variant="destructive">
              <AlertDescription>
                {preview.duplicate_reading_collisions} duplicate reading collision(s) — matching
                readings on the keeper will be kept; duplicate-side colliding readings are removed
                (staging links are re-pointed first).
              </AlertDescription>
            </Alert>
          ) : null}
          {preview?.affected_districts != null && preview.affected_districts > 0 && (
            <Alert>
              <AlertDescription>
                Global contaminant change affects {preview.affected_districts} district(s) with
                readings.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={applyLoading}
              onClick={() => {
                setPreview(null);
                setConfirmAction(null);
                setPreviewSummary(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={applyLoading}
              onClick={async () => {
                if (!confirmAction) return;
                setApplyLoading(true);
                try {
                  await confirmAction();
                } catch (err) {
                  toast({
                    variant: 'destructive',
                    title: 'Apply failed',
                    description: err instanceof Error ? err.message : String(err),
                  });
                } finally {
                  setApplyLoading(false);
                }
              }}
            >
              {applyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DistrictIdentityManagementTab;
