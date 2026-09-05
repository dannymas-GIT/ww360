/**
 * Admin tab for resolving legacy ``(var1)`` well duplicates.
 *
 * Lists wells in the operator's district that share a canonical display name
 * with another well, where at least one member carries a ``(var*)`` suffix.
 * For each group the admin can merge a duplicate into the canonical row.
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  fetchWellDuplicateGroups,
  mergeWellDuplicate,
  type WellDuplicateGroup,
  type WellDuplicateRow,
} from '@/services/wellDuplicatesService';
import { Loader2, GitMerge, AlertTriangle, RefreshCcw, Search } from 'lucide-react';

function wellLabel(w: WellDuplicateRow): string {
  return w.name || w.well_number || `Well ${w.id}`;
}

function UsageBadges({ usage }: { usage: WellDuplicateRow['usage'] }) {
  const items: Array<{ label: string; value: number }> = [
    { label: 'readings', value: usage.readings },
    { label: 'schedules', value: usage.schedules },
    { label: 'first-detect', value: usage.first_detect_events },
  ].filter(x => x.value > 0);
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">no readings</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(it => (
        <Badge key={it.label} variant="secondary" className="text-[10px] px-1.5 py-0">
          {it.value} {it.label}
        </Badge>
      ))}
    </div>
  );
}

interface PendingMerge {
  group: WellDuplicateGroup;
  duplicate: WellDuplicateRow;
}

export const DistrictWellDuplicatesTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<PendingMerge | null>(null);

  const {
    data: groups,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['district', 'well-duplicates'],
    queryFn: fetchWellDuplicateGroups,
    staleTime: 30_000,
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ group, duplicate }: PendingMerge) =>
      mergeWellDuplicate(group.canonical.id, duplicate.id),
    onSuccess: (report, vars) => {
      toast({
        title: 'Duplicate merged',
        description: `Merged "${wellLabel(vars.duplicate)}" into "${wellLabel(
          vars.group.canonical
        )}"${
          report.deleted_conflicting_readings
            ? ` (dropped ${report.deleted_conflicting_readings} duplicate readings)`
            : ''
        }.`,
      });
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ['district', 'well-duplicates'] });
      void queryClient.invalidateQueries({ queryKey: ['wells'] });
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Merge failed',
        description: msg,
      });
    },
  });

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => {
      const all = [g.canonical, ...g.duplicates];
      return all.some(
        w =>
          (w.name || '').toLowerCase().includes(q) ||
          (w.well_number || '').toLowerCase().includes(q)
      );
    });
  }, [groups, search]);

  const totalGroups = groups?.length ?? 0;
  const totalDuplicateRows = groups?.reduce((acc, g) => acc + g.duplicates.length, 0) ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              Resolve well duplicates
            </CardTitle>
            <CardDescription>
              Legacy wells with <code>(var1)</code>-style names that share a canonical display name
              within this district. Merging re-points all readings, schedules, and audit references
              to the canonical record and deletes the duplicate row.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Merges are <strong>destructive and irreversible</strong>. Readings that collide on the
            same date and contaminant with the canonical record are dropped; everything else is
            moved over. The duplicate well row is deleted.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or well number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {totalGroups} group{totalGroups === 1 ? '' : 's'} · {totalDuplicateRows} duplicate row
            {totalDuplicateRows === 1 ? '' : 's'}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Scanning for duplicates…
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load duplicates: {error instanceof Error ? error.message : 'unknown error'}
            </AlertDescription>
          </Alert>
        ) : filteredGroups.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {totalGroups === 0
              ? 'No `(var1)`-style well duplicates found in this district.'
              : 'No groups match your search.'}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map(group => (
              <div
                key={`${group.district_id ?? ''}-${group.canonical_key}`}
                className="rounded-md border bg-card"
              >
                <div className="px-3 py-2 border-b bg-muted/40 flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Display name:
                  </span>
                  <span className="text-sm font-semibold">
                    {group.canonical.name || group.canonical_key}
                  </span>
                  {group.district_id && (
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      District {group.district_id}
                    </Badge>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Role</TableHead>
                      <TableHead>Well name</TableHead>
                      <TableHead>Lab #</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-32 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-emerald-50/40">
                      <TableCell>
                        <Badge variant="default" className="bg-emerald-600">
                          Canonical
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{wellLabel(group.canonical)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {group.canonical.well_number || '—'}
                      </TableCell>
                      <TableCell>
                        <UsageBadges usage={group.canonical.usage} />
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        kept
                      </TableCell>
                    </TableRow>
                    {group.duplicates.map(dup => (
                      <TableRow key={dup.id}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-amber-300 text-amber-800 bg-amber-50"
                          >
                            Duplicate
                          </Badge>
                        </TableCell>
                        <TableCell>{wellLabel(dup)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {dup.well_number || '—'}
                        </TableCell>
                        <TableCell>
                          <UsageBadges usage={dup.usage} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPending({ group, duplicate: dup })}
                            disabled={mergeMutation.isPending}
                          >
                            <GitMerge className="h-3.5 w-3.5 mr-1" />
                            Merge
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={pending !== null}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Merge well duplicate?
            </DialogTitle>
            <DialogDescription>
              This will re-point every reading, schedule, and audit row attached to{' '}
              <strong>{pending ? wellLabel(pending.duplicate) : ''}</strong> onto{' '}
              <strong>{pending ? wellLabel(pending.group.canonical) : ''}</strong>, then delete the
              duplicate well row. Readings that collide on the same date and contaminant will be
              dropped from the duplicate (the canonical value wins). This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">Duplicate:</span>{' '}
                <span className="font-medium">{wellLabel(pending.duplicate)}</span>{' '}
                <span className="font-mono text-muted-foreground">
                  ({pending.duplicate.well_number || 'no #'})
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Canonical:</span>{' '}
                <span className="font-medium">{wellLabel(pending.group.canonical)}</span>{' '}
                <span className="font-mono text-muted-foreground">
                  ({pending.group.canonical.well_number || 'no #'})
                </span>
              </div>
              <div className="text-muted-foreground pt-1">
                Duplicate has {pending.duplicate.usage.readings} reading
                {pending.duplicate.usage.readings === 1 ? '' : 's'},{' '}
                {pending.duplicate.usage.schedules} schedule
                {pending.duplicate.usage.schedules === 1 ? '' : 's'},{' '}
                {pending.duplicate.usage.first_detect_events} first-detect event
                {pending.duplicate.usage.first_detect_events === 1 ? '' : 's'}.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPending(null)}
              disabled={mergeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pending) mergeMutation.mutate(pending);
              }}
              disabled={mergeMutation.isPending}
            >
              {mergeMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Merging…
                </>
              ) : (
                <>
                  <GitMerge className="h-3.5 w-3.5 mr-1" />
                  Merge & delete duplicate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DistrictWellDuplicatesTab;
