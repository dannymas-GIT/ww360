import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useTenantAuthContext, type TenantAuthContext } from '@/hooks/useTenantAuthContext';
import {
  getStagingDrasticThreshold,
  updateStagingDrasticThreshold,
} from '@/services/waterDistrictsService';
import { ClipboardCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { featureFlags } from '@/config/featureFlags';

export interface DistrictScheduleApprovalDistrictRow {
  district_code: string;
  district_name: string;
}

const POLICY_VALUES = [
  { value: 'auto_no_change', label: 'Auto-complete no-change (default)' },
  { value: 'require_changes_only', label: 'Changes only (apply needs district admin)' },
  { value: 'require_all', label: 'Require all rows in dialog' },
] as const;

function filterDistrictsForEditor(
  districts: DistrictScheduleApprovalDistrictRow[],
  ctx: TenantAuthContext | undefined
): DistrictScheduleApprovalDistrictRow[] {
  if (!ctx) return districts;
  if (ctx.is_global_admin || ctx.is_system_admin) return districts;
  const acc = ctx.accessible_districts ?? [];
  if (acc.length >= 1 && acc[0] === '*') return districts;
  const allowed = new Set(acc);
  if (ctx.district_code) allowed.add(ctx.district_code);
  return districts.filter(d => allowed.has(d.district_code));
}

export interface DistrictScheduleApprovalCardProps {
  districts: DistrictScheduleApprovalDistrictRow[];
}

export default function DistrictScheduleApprovalCard({
  districts,
}: DistrictScheduleApprovalCardProps) {
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
        policy: string;
        loading: boolean;
        saving: boolean;
      }
    >
  >({});

  useEffect(() => {
    if (tenantLoading || visibleDistricts.length === 0) return;

    visibleDistricts.forEach(d => {
      const code = d.district_code;
      setRows(prev => ({
        ...prev,
        [code]: {
          ...(prev[code] ?? { policy: 'auto_no_change', loading: true, saving: false }),
          loading: true,
        },
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
            const pol = data.schedule_approval_policy || 'auto_no_change';
            setRows(prev => ({
              ...prev,
              [code]: { policy: pol, loading: false, saving: false },
            }));
          } catch (e: unknown) {
            if (cancelled) return;
            const msg = e instanceof Error ? e.message : 'Failed to load policy';
            setRows(prev => ({
              ...prev,
              [code]: { policy: 'auto_no_change', loading: false, saving: false },
            }));
            toast({
              variant: 'destructive',
              title: `Policy load failed (${code})`,
              description: msg,
            });
          }
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantLoading, visibleDistricts, toast]);

  const handleSave = async (districtCode: string) => {
    const row = rows[districtCode];
    if (!row || row.loading || row.saving) return;
    const nextPolicy = row.policy;
    setRows(prev => ({
      ...prev,
      [districtCode]: { ...prev[districtCode], saving: true },
    }));
    try {
      await updateStagingDrasticThreshold(districtCode, {
        schedule_approval_policy: nextPolicy,
      });
      toast({
        title: 'Schedule approval policy saved',
        description: `${districtCode}: ${POLICY_VALUES.find(p => p.value === nextPolicy)?.label ?? nextPolicy}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      toast({ variant: 'destructive', title: 'Save failed', description: msg });
    } finally {
      setRows(prev => ({
        ...prev,
        [districtCode]: { ...prev[districtCode], saving: false },
      }));
    }
  };

  if (!featureFlags.scheduleAutomationEnabled || visibleDistricts.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Post-promotion schedule approval
        </CardTitle>
        <CardDescription>
          Controls whether no-change schedule rows open in the dialog after lab promotion, and
          whether matching events are auto-completed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>District</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="min-w-[280px]">Policy</TableHead>
                <TableHead className="w-[120px]">
                  <span className="sr-only">Save</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleDistricts.map(d => {
                const code = d.district_code;
                const row = rows[code];
                const policy = row?.policy ?? 'auto_no_change';
                const loading = row?.loading ?? true;
                const saving = row?.saving ?? false;
                return (
                  <TableRow key={code}>
                    <TableCell className="font-medium">{d.district_name || code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{code}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        disabled={loading || saving}
                        value={policy}
                        onValueChange={v =>
                          setRows(prev => ({
                            ...prev,
                            [code]: {
                              loading: prev[code]?.loading ?? false,
                              saving: prev[code]?.saving ?? false,
                              policy: v,
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="max-w-md">
                          <SelectValue placeholder={loading ? 'Loading…' : 'Select policy'} />
                        </SelectTrigger>
                        <SelectContent>
                          {POLICY_VALUES.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        disabled={loading || saving}
                        onClick={() => void handleSave(code)}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
