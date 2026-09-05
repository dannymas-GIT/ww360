/**
 * Condensed workforce intake for documentation pack generation.
 */
import { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createWorkforceEntity } from '@/services/workforceSuccessionService';
import type { WizardSetupMeta } from '@/components/workforce/workforcePlanningFormModel';

interface WorkforceExpressSetupProps {
  districtCode: string;
  setupMeta: WizardSetupMeta;
  onSetupMetaChange: (patch: Partial<WizardSetupMeta>) => void;
}

type QuickPosition = { title: string; is_vacant: boolean; civil_service_grade: string };
type QuickEmployee = {
  full_name: string;
  operator_grade: string;
  retirement_eligible_date: string;
};
type QuickFunction = { function_name: string; required_certification_type: string };

export function WorkforceExpressSetup({
  districtCode,
  setupMeta,
  onSetupMetaChange,
}: WorkforceExpressSetupProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [positions, setPositions] = useState<QuickPosition[]>([
    { title: '', is_vacant: false, civil_service_grade: '' },
  ]);
  const [employees, setEmployees] = useState<QuickEmployee[]>([
    { full_name: '', operator_grade: '', retirement_eligible_date: '' },
  ]);
  const [functions, setFunctions] = useState<QuickFunction[]>([
    { function_name: '', required_certification_type: '' },
  ]);

  const saveAll = async () => {
    setSaving(true);
    try {
      let created = 0;
      for (const row of positions.filter(p => p.title.trim())) {
        await createWorkforceEntity('positions', {
          district_code: districtCode,
          title: row.title.trim(),
          is_vacant: row.is_vacant,
          civil_service_grade: row.civil_service_grade || undefined,
          record_status: 'active',
        });
        created += 1;
      }
      for (const row of employees.filter(e => e.full_name.trim())) {
        await createWorkforceEntity('employees', {
          district_code: districtCode,
          full_name: row.full_name.trim(),
          operator_grade: row.operator_grade || undefined,
          retirement_eligible_date: row.retirement_eligible_date || undefined,
          record_status: 'active',
        });
        created += 1;
      }
      for (const row of functions.filter(f => f.function_name.trim())) {
        await createWorkforceEntity('critical_functions', {
          district_code: districtCode,
          function_name: row.function_name.trim(),
          required_certification_type: row.required_certification_type || undefined,
          record_status: 'active',
        });
        created += 1;
      }
      toast({
        title: 'Express intake saved',
        description: `${created} row(s) added to live workforce tables.`,
      });
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Express setup collects the minimum data needed for the documentation pack. Rows save
        immediately to the same tables used by the full wizard. Use CSV import on the Workforce page
        for bulk roster upload.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>PWSID (optional)</Label>
          <Input
            value={setupMeta.pwsid || ''}
            onChange={e => onSetupMetaChange({ pwsid: e.target.value })}
            placeholder="NY1234567"
          />
        </div>
        <div>
          <Label>Primary contact</Label>
          <Input
            value={setupMeta.contact_name}
            onChange={e => onSetupMetaChange({ contact_name: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Contact email</Label>
          <Input
            type="email"
            value={setupMeta.contact_email}
            onChange={e => onSetupMetaChange({ contact_email: e.target.value })}
          />
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Positions (title, vacant?, grade)</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setPositions(prev => [
                ...prev,
                { title: '', is_vacant: false, civil_service_grade: '' },
              ])
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Row
          </Button>
        </div>
        {positions.map((row, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder="Title"
              value={row.title}
              onChange={e =>
                setPositions(prev =>
                  prev.map((r, j) => (j === i ? { ...r, title: e.target.value } : r))
                )
              }
            />
            <Input
              placeholder="Grade"
              value={row.civil_service_grade}
              onChange={e =>
                setPositions(prev =>
                  prev.map((r, j) => (j === i ? { ...r, civil_service_grade: e.target.value } : r))
                )
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.is_vacant}
                onChange={e =>
                  setPositions(prev =>
                    prev.map((r, j) => (j === i ? { ...r, is_vacant: e.target.checked } : r))
                  )
                }
              />
              Vacant
            </label>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Employees (name, grade, retirement date)</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setEmployees(prev => [
                ...prev,
                { full_name: '', operator_grade: '', retirement_eligible_date: '' },
              ])
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Row
          </Button>
        </div>
        {employees.map((row, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder="Full name"
              value={row.full_name}
              onChange={e =>
                setEmployees(prev =>
                  prev.map((r, j) => (j === i ? { ...r, full_name: e.target.value } : r))
                )
              }
            />
            <Input
              placeholder="Grade A/B/C/D"
              value={row.operator_grade}
              onChange={e =>
                setEmployees(prev =>
                  prev.map((r, j) => (j === i ? { ...r, operator_grade: e.target.value } : r))
                )
              }
            />
            <Input
              type="date"
              value={row.retirement_eligible_date}
              onChange={e =>
                setEmployees(prev =>
                  prev.map((r, j) =>
                    j === i ? { ...r, retirement_eligible_date: e.target.value } : r
                  )
                )
              }
            />
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Critical functions (name, required cert)</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setFunctions(prev => [
                ...prev,
                { function_name: '', required_certification_type: '' },
              ])
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Row
          </Button>
        </div>
        {functions.map((row, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Function name"
              value={row.function_name}
              onChange={e =>
                setFunctions(prev =>
                  prev.map((r, j) => (j === i ? { ...r, function_name: e.target.value } : r))
                )
              }
            />
            <Input
              placeholder="Required certification"
              value={row.required_certification_type}
              onChange={e =>
                setFunctions(prev =>
                  prev.map((r, j) =>
                    j === i ? { ...r, required_certification_type: e.target.value } : r
                  )
                )
              }
            />
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={() => void saveAll()}>
          Save express intake
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={`/dashboard/workforce-continuity?district=${encodeURIComponent(districtCode)}`}>
            <Upload className="h-3 w-3 mr-1" />
            Bulk CSV import on Workforce page
          </a>
        </Button>
      </div>
    </div>
  );
}
