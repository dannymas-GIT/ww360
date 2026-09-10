import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360Section } from '@/components/ww360/Ww360Section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCreateAnalysisSet,
  useDeleteAnalysisSet,
  useRemoveAnalysisSetItem,
  useSDWISAnalysisSet,
  useSDWISAnalysisSets,
  useUpdateAnalysisSet,
} from '@/hooks/useSDWIS';
import { Pencil, Trash2 } from 'lucide-react';

export default function SdwisAnalysisPage() {
  const { data: sets, isLoading } = useSDWISAnalysisSets();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const activeId = selectedId ?? sets?.[0]?.id ?? null;
  const { data: activeSet, isLoading: detailLoading } = useSDWISAnalysisSet(activeId);
  const createMut = useCreateAnalysisSet();
  const updateMut = useUpdateAnalysisSet();
  const deleteMut = useDeleteAnalysisSet();
  const removeItemMut = useRemoveAnalysisSetItem();
  const [newSetName, setNewSetName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameSaved, setRenameSaved] = useState(false);

  const handleCreateSet = async () => {
    const name = newSetName.trim();
    if (!name) return;
    const created = await createMut.mutateAsync(name);
    setSelectedId(created.id);
    setNewSetName('');
    setRenameOpen(false);
    setRenameSaved(false);
  };

  const handleRenameSet = async () => {
    if (!activeSet || !renameValue.trim()) return;
    await updateMut.mutateAsync({ id: activeSet.id, name: renameValue.trim() });
    setRenameSaved(true);
    setRenameOpen(false);
  };

  const popChart = useMemo(
    () =>
      (activeSet?.items || []).map(i => ({
        name: (i.pws_name || i.pwsid).slice(0, 18),
        population: i.population_served || 0,
      })),
    [activeSet]
  );

  useEffect(() => {
    if (activeSet?.name) {
      setRenameValue(activeSet.name);
      setRenameSaved(false);
    }
  }, [activeSet?.id, activeSet?.name]);

  const violationChart = useMemo(
    () =>
      (activeSet?.items || []).map(i => ({
        name: (i.pws_name || i.pwsid).slice(0, 18),
        open: i.open_violation_count ?? 0,
        enforcement: i.enforcement_count ?? 0,
      })),
    [activeSet]
  );

  return (
    <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Water Systems"
        title="Analysis sets"
        description="Save systems from lookup to compare population, SNC, and open violations — without linking them to a utility district."
        dataMode="live"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 bg-white/5 text-white hover:bg-white/15 min-h-[44px] md:min-h-9"
            asChild
          >
            <Link to="/water-systems/lookup">System lookup</Link>
          </Button>
        }
      />

      <Ww360Section tourId="analysis-sets" title="Your saved sets">
        {isLoading ? (
          <p className="text-base text-slate-600">Loading…</p>
        ) : !sets?.length ? (
          <div className="space-y-3">
            <p className="text-base text-slate-600">
              No analysis sets yet. Search a system on{' '}
              <Link to="/water-systems/lookup" className="text-primary underline">
                System lookup
              </Link>{' '}
              and choose Save for comparison.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1 min-w-[14rem] flex-1">
                <Label htmlFor="new-review-name">Review name</Label>
                <Input
                  id="new-review-name"
                  className="min-h-[44px] text-base"
                  value={newSetName}
                  onChange={e => setNewSetName(e.target.value)}
                  placeholder="e.g. Nassau County follow-up"
                />
              </div>
              <Button
                className="min-h-[44px] text-base"
                disabled={createMut.isPending || !newSetName.trim()}
                onClick={() => void handleCreateSet()}
              >
                Create review
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sets.map(s => (
              <Button
                key={s.id}
                variant={activeId === s.id ? 'default' : 'outline'}
                className="min-h-[44px] text-base"
                onClick={() => {
                  setSelectedId(s.id);
                  setRenameOpen(false);
                  setRenameSaved(false);
                }}
              >
                {s.name} ({s.items.length})
              </Button>
            ))}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Input
                className="min-h-[44px] min-w-[12rem] flex-1 text-base"
                value={newSetName}
                onChange={e => setNewSetName(e.target.value)}
                placeholder="New review name"
                aria-label="New review name"
              />
              <Button
                variant="secondary"
                className="min-h-[44px] text-base shrink-0"
                disabled={createMut.isPending || !newSetName.trim()}
                onClick={() => void handleCreateSet()}
              >
                New review
              </Button>
            </div>
          </div>
        )}
      </Ww360Section>

      {activeId && activeSet && (
        <>
          <Ww360Section
            tourId="analysis-rename"
            title="Rename this review"
            action={
              !renameOpen ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] text-base"
                  onClick={() => {
                    setRenameValue(activeSet.name);
                    setRenameOpen(true);
                    setRenameSaved(false);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Rename
                </Button>
              ) : undefined
            }
          >
            {renameOpen ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1 min-w-[14rem] flex-1">
                  <Label htmlFor="rename-review">New name</Label>
                  <Input
                    id="rename-review"
                    className="min-h-[44px] text-base"
                    value={renameValue}
                    autoFocus
                    onChange={e => {
                      setRenameValue(e.target.value);
                      setRenameSaved(false);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleRenameSet();
                      }
                      if (e.key === 'Escape') {
                        setRenameOpen(false);
                        setRenameValue(activeSet.name);
                      }
                    }}
                  />
                </div>
                <Button
                  className="min-h-[44px] text-base"
                  disabled={
                    updateMut.isPending ||
                    !renameValue.trim() ||
                    renameValue.trim() === activeSet.name
                  }
                  onClick={() => void handleRenameSet()}
                >
                  Save name
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-[44px] text-base"
                  onClick={() => {
                    setRenameOpen(false);
                    setRenameValue(activeSet.name);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <p className="text-base text-slate-700">
                Current name: <span className="font-medium text-slate-900">{activeSet.name}</span>
                {renameSaved ? (
                  <span className="ml-2 text-emerald-700">Saved.</span>
                ) : null}
              </p>
            )}
          </Ww360Section>

          <Ww360Section
            tourId="analysis-compare"
            title={activeSet.name}
            action={
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] text-base text-destructive"
                disabled={deleteMut.isPending}
                onClick={() => {
                  void deleteMut.mutateAsync(activeSet.id).then(() => setSelectedId(null));
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete review
              </Button>
            }
          >
            {detailLoading ? (
              <p className="text-base text-slate-600">Loading comparison data…</p>
            ) : !activeSet.items.length ? (
              <p className="text-base text-slate-600">This set is empty. Add systems from lookup.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PWSID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Population</TableHead>
                      <TableHead>SNC</TableHead>
                      <TableHead>Open violations</TableHead>
                      <TableHead>Enforcement</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSet.items.map(item => (
                      <TableRow key={item.pwsid}>
                        <TableCell className="font-mono text-base">{item.pwsid}</TableCell>
                        <TableCell className="text-base">{item.pws_name || '—'}</TableCell>
                        <TableCell className="text-base">{item.population_served ?? '—'}</TableCell>
                        <TableCell className="text-base">{item.snc ?? '—'}</TableCell>
                        <TableCell className="text-base">
                          {item.open_violation_count ?? '—'}
                        </TableCell>
                        <TableCell className="text-base">{item.enforcement_count ?? '—'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-[44px] text-base"
                            disabled={removeItemMut.isPending}
                            onClick={() =>
                              void removeItemMut.mutateAsync({
                                setId: activeSet.id,
                                pwsid: item.pwsid,
                              })
                            }
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Ww360Section>

          {activeSet.items.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Ww360Section tourId="analysis-pop-chart" title="Population served">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={popChart} margin={{ top: 8, right: 8, left: -8, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="population" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Ww360Section>

              <Ww360Section tourId="analysis-viol-chart" title="Open violations & enforcement">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={violationChart}
                      margin={{ top: 8, right: 8, left: -8, bottom: 32 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="open" fill="#dc2626" name="Open violations" radius={[4, 4, 0, 0]} />
                      <Bar
                        dataKey="enforcement"
                        fill="#64748b"
                        name="Enforcement"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Ww360Section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
