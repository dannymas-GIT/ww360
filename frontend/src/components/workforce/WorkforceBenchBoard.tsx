import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkforceEntityList } from '@/hooks/useWorkforceSuccession';
import type { WorkforceRow } from '@/services/workforceSuccessionService';

interface Props {
  districtCode: string;
  canManage: boolean;
  onAssign?: (functionId: number) => void;
}

function readinessBadge(level?: string | null) {
  if (!level) return <Badge variant="outline">—</Badge>;
  if (level === 'now' || level === '0-12mo') return <Badge className="bg-emerald-600">Ready</Badge>;
  if (level === '12-24mo') return <Badge className="bg-amber-500">Developing</Badge>;
  return <Badge variant="secondary">{level}</Badge>;
}

export function WorkforceBenchBoard({ districtCode, canManage, onAssign }: Props) {
  const functionsQ = useWorkforceEntityList(districtCode, 'critical_functions');
  const coverageQ = useWorkforceEntityList(districtCode, 'role_coverage');
  const candidatesQ = useWorkforceEntityList(districtCode, 'succession_candidates');
  const employeesQ = useWorkforceEntityList(districtCode, 'employees');

  const functions = (functionsQ.data ?? []) as WorkforceRow[];
  const coverage = (coverageQ.data ?? []) as WorkforceRow[];
  const candidates = (candidatesQ.data ?? []) as WorkforceRow[];
  const employees = (employeesQ.data ?? []) as WorkforceRow[];

  const employeeName = (id: unknown) =>
    employees.find(e => e.id === id)?.full_name ?? String(id ?? '—');

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Critical functions × coverage (primary / backup / trainee) with bench readiness. Assigning
        primary or backup to a linked operator auto-creates a documentation task.
      </p>
      <div className="grid gap-4">
        {functions.map(fn => {
          const rows = coverage.filter(c => c.function_id === fn.id);
          const primary = rows.find(r => r.coverage_role === 'primary');
          const backup = rows.find(r => r.coverage_role === 'backup');
          const trainee = rows.find(r => r.coverage_role === 'trainee');
          const bench = candidates.filter(
            c => c.target_position_code === fn.function_code || c.target_position_id === fn.id
          );
          return (
            <Card key={String(fn.id)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  {String(fn.function_name ?? fn.function_code)}
                  <Badge variant="outline">{String(fn.function_area ?? 'Function')}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div className="grid sm:grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Primary</p>
                    <p>{primary ? employeeName(primary.employee_id) : 'Uncovered'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Backup</p>
                    <p>{backup ? employeeName(backup.employee_id) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Trainee</p>
                    <p>{trainee ? employeeName(trainee.employee_id) : '—'}</p>
                  </div>
                </div>
                {bench.length ? (
                  <div className="flex flex-wrap gap-2">
                    {bench.map(b => (
                      <span key={String(b.id)} className="inline-flex items-center gap-1">
                        {employeeName(b.employee_id)} {readinessBadge(String(b.readiness_level ?? ''))}
                      </span>
                    ))}
                  </div>
                ) : null}
                {canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAssign?.(Number(fn.id))}
                  >
                    Assign coverage
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
