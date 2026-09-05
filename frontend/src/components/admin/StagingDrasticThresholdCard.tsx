import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useTenantAuthContext, type TenantAuthContext } from '@/hooks/useTenantAuthContext';
import {
  getStagingDrasticThreshold,
  updateStagingDrasticThreshold,
  type StagingDrasticThreshold,
} from '@/services/waterDistrictsService';
import { Activity } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export interface StagingDrasticDistrictRow {
  district_code: string;
  district_name: string;
}

type DraftTriplet = { far: string; near: string; ratio: string };

function filterDistrictsForEditor(
  districts: StagingDrasticDistrictRow[],
  ctx: TenantAuthContext | undefined
): StagingDrasticDistrictRow[] {
  if (!ctx) return districts;
  if (ctx.is_global_admin || ctx.is_system_admin) return districts;
  const acc = ctx.accessible_districts ?? [];
  if (acc.length >= 1 && acc[0] === '*') return districts;
  const allowed = new Set(acc);
  if (ctx.district_code) allowed.add(ctx.district_code);
  return districts.filter(d => allowed.has(d.district_code));
}

function draftsFromServer(data: StagingDrasticThreshold): DraftTriplet {
  return {
    far: data.drastic_change_pct_threshold != null ? String(data.drastic_change_pct_threshold) : '',
    near:
      data.drastic_pct_threshold_near_mcl != null
        ? String(data.drastic_pct_threshold_near_mcl)
        : '',
    ratio: data.drastic_near_mcl_fraction != null ? String(data.drastic_near_mcl_fraction) : '',
  };
}

function parseOptionalPct(raw: string): number | null | 'invalid' {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return 'invalid';
  return n;
}

function parseOptionalRatio(raw: string): number | null | 'invalid' {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || n > 1) return 'invalid';
  return n;
}

export interface StagingDrasticThresholdCardProps {
  districts: StagingDrasticDistrictRow[];
}

export default function StagingDrasticThresholdCard({
  districts,
}: StagingDrasticThresholdCardProps) {
  const { toast } = useToast();
  const { data: tenantCtx, isLoading: tenantLoading } = useTenantAuthContext();

  const visibleDistricts = useMemo(
    () => filterDistrictsForEditor(districts, tenantCtx),
    [districts, tenantCtx]
  );

  const [rows, setRows] = useState<
    Record<
      string,
      {
        data: StagingDrasticThreshold | null;
        draft: DraftTriplet;
        loading: boolean;
        saving: boolean;
      }
    >
  >({});

  useEffect(() => {
    if (tenantLoading || visibleDistricts.length === 0) return;

    const emptyRow = {
      data: null,
      draft: { far: '', near: '', ratio: '' },
      loading: true,
      saving: false,
    };
    visibleDistricts.forEach(d => {
      const code = d.district_code;
      setRows(prev => ({
        ...prev,
        [code]: { ...(prev[code] ?? emptyRow), loading: true },
      }));
    });

    let cancelled = false;
    void (async () => {
      await Promise.all(
        visibleDistricts.map(async d => {
          const code = d.district_code;
          try {
            const data = await getStagingDrasticThreshold(code);
            if (cancelled) return;
            setRows(prev => ({
              ...prev,
              [code]: {
                data,
                draft: draftsFromServer(data),
                loading: false,
                saving: false,
              },
            }));
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to load threshold';
            if (cancelled) return;
            setRows(prev => ({
              ...prev,
              [code]: {
                ...(prev[code] ?? {
                  data: null,
                  draft: { far: '', near: '', ratio: '' },
                  loading: false,
                  saving: false,
                }),
                loading: false,
                saving: false,
              },
            }));
            toast({ title: 'Load failed', description: `${code}: ${msg}`, variant: 'destructive' });
          }
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantLoading, visibleDistricts, toast]);

  const handleSave = async (code: string) => {
    const row = rows[code] ?? {
      data: null,
      draft: { far: '', near: '', ratio: '' },
      loading: false,
      saving: false,
    };
    const far = parseOptionalPct(row.draft.far);
    const near = parseOptionalPct(row.draft.near);
    const ratio = parseOptionalRatio(row.draft.ratio);
    if (far === 'invalid' || near === 'invalid' || ratio === 'invalid') {
      toast({
        title: 'Invalid value',
        description:
          'Far/Near must be positive percentages (≤ 1,000,000). Ratio must be between 0 and 1 (exclusive of 0). Leave blank to use server default for that field.',
        variant: 'destructive',
      });
      return;
    }

    setRows(prev => ({
      ...prev,
      [code]: { ...(prev[code] ?? row), saving: true },
    }));
    try {
      const data = await updateStagingDrasticThreshold(code, {
        drastic_change_pct_threshold: far,
        drastic_pct_threshold_near_mcl: near,
        drastic_near_mcl_fraction: ratio,
      });
      setRows(prev => ({
        ...prev,
        [code]: {
          data,
          draft: draftsFromServer(data),
          loading: false,
          saving: false,
        },
      }));
      toast({ title: 'Saved', description: `Drastic thresholds updated for ${code}.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      setRows(prev => ({
        ...prev,
        [code]: { ...(prev[code] ?? row), saving: false },
      }));
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    }
  };

  const handleReset = async (code: string) => {
    const base = {
      data: null,
      draft: { far: '', near: '', ratio: '' },
      loading: false,
      saving: false,
    };
    setRows(prev => ({
      ...prev,
      [code]: {
        ...(prev[code] ?? base),
        saving: true,
      },
    }));
    try {
      const data = await updateStagingDrasticThreshold(code, {
        drastic_change_pct_threshold: null,
        drastic_pct_threshold_near_mcl: null,
        drastic_near_mcl_fraction: null,
      });
      setRows(prev => ({
        ...prev,
        [code]: {
          data,
          draft: draftsFromServer(data),
          loading: false,
          saving: false,
        },
      }));
      toast({
        title: 'Reset',
        description: `${code} now uses global defaults for all three settings.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reset failed';
      setRows(prev => ({
        ...prev,
        [code]: { ...(prev[code] ?? base), saving: false },
      }));
      toast({ title: 'Reset failed', description: msg, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Staging verification thresholds
        </CardTitle>
        <CardDescription>
          Drastic change flags when{' '}
          <strong>absolute percent change vs the most recent reading</strong> exceeds a threshold.
          Two caps apply: a relaxed cap when the normalized reading is <em>below</em> a fraction of
          the MCL, and a tighter cap when it is at or above that fraction (near MCL). Leave a field
          blank and save to clear that district override and use the server default. Z-score logic
          is unchanged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tenantLoading ? (
          <p className="text-sm text-muted-foreground">Loading access context…</p>
        ) : visibleDistricts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No districts available for your account to edit.
          </p>
        ) : (
          <div className="max-h-[28rem] overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">District</TableHead>
                  <TableHead className="min-w-[200px]">Effective</TableHead>
                  <TableHead className="min-w-[260px]">Overrides</TableHead>
                  <TableHead className="min-w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDistricts.map(d => {
                  const code = d.district_code;
                  const row = rows[code];
                  const data = row?.data;
                  const gFar = data?.global_default_pct_threshold_far;
                  const gNear = data?.global_default_pct_threshold_near_mcl;
                  const gRatio = data?.global_default_near_mcl_fraction;

                  const usesAllDefaults =
                    data != null &&
                    data.drastic_change_pct_threshold == null &&
                    data.drastic_pct_threshold_near_mcl == null &&
                    data.drastic_near_mcl_fraction == null;

                  return (
                    <TableRow key={code}>
                      <TableCell>
                        <div className="font-medium text-sm">{code}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {d.district_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row?.loading ? (
                          <span className="text-xs text-muted-foreground">Loading…</span>
                        ) : data ? (
                          <div className="flex flex-col gap-1 text-xs">
                            <Badge variant="secondary" className="w-fit">
                              Far: {data.effective_pct_threshold_far}%
                            </Badge>
                            <Badge variant="secondary" className="w-fit">
                              Near MCL: {data.effective_pct_threshold_near_mcl}%
                            </Badge>
                            <Badge variant="outline" className="w-fit font-mono">
                              Ratio ≥ {data.effective_near_mcl_fraction}
                            </Badge>
                            {usesAllDefaults ? (
                              <Badge variant="outline" className="w-fit">
                                all defaults
                              </Badge>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2 max-w-[260px]">
                          <label className="text-[10px] uppercase text-muted-foreground tracking-wide">
                            Far % (placeholder default {gFar ?? '—'}%)
                          </label>
                          <Input
                            className="h-8 text-xs font-mono"
                            type="number"
                            min={0.01}
                            step={1}
                            placeholder={gFar != null ? `Default (${gFar}%)` : 'Server default'}
                            disabled={row?.loading || row?.saving}
                            value={row?.draft.far ?? ''}
                            onChange={e =>
                              setRows(prev => {
                                const cur = prev[code] ?? {
                                  data: null,
                                  draft: { far: '', near: '', ratio: '' },
                                  loading: false,
                                  saving: false,
                                };
                                return {
                                  ...prev,
                                  [code]: {
                                    ...cur,
                                    draft: { ...cur.draft, far: e.target.value },
                                  },
                                };
                              })
                            }
                          />
                          <label className="text-[10px] uppercase text-muted-foreground tracking-wide">
                            Near MCL % (default {gNear ?? '—'}%)
                          </label>
                          <Input
                            className="h-8 text-xs font-mono"
                            type="number"
                            min={0.01}
                            step={1}
                            placeholder={gNear != null ? `Default (${gNear}%)` : 'Server default'}
                            disabled={row?.loading || row?.saving}
                            value={row?.draft.near ?? ''}
                            onChange={e =>
                              setRows(prev => {
                                const cur = prev[code] ?? {
                                  data: null,
                                  draft: { far: '', near: '', ratio: '' },
                                  loading: false,
                                  saving: false,
                                };
                                return {
                                  ...prev,
                                  [code]: {
                                    ...cur,
                                    draft: { ...cur.draft, near: e.target.value },
                                  },
                                };
                              })
                            }
                          />
                          <label className="text-[10px] uppercase text-muted-foreground tracking-wide">
                            Near cutoff lab/MCL (default {gRatio ?? '—'})
                          </label>
                          <Input
                            className="h-8 text-xs font-mono"
                            type="number"
                            min={0.01}
                            max={1}
                            step={0.05}
                            placeholder={gRatio != null ? `Default (${gRatio})` : 'Server default'}
                            disabled={row?.loading || row?.saving}
                            value={row?.draft.ratio ?? ''}
                            onChange={e =>
                              setRows(prev => {
                                const cur = prev[code] ?? {
                                  data: null,
                                  draft: { far: '', near: '', ratio: '' },
                                  loading: false,
                                  saving: false,
                                };
                                return {
                                  ...prev,
                                  [code]: {
                                    ...cur,
                                    draft: { ...cur.draft, ratio: e.target.value },
                                  },
                                };
                              })
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs px-2"
                            disabled={row?.loading || row?.saving}
                            onClick={() => void handleSave(code)}
                          >
                            {row?.saving ? 'Saving…' : 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            disabled={row?.loading || row?.saving}
                            onClick={() => void handleReset(code)}
                          >
                            Reset all defaults
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
