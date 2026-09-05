import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { CeuRecordCard } from '@/components/workforce/CeuRecordCard';
import { WorkforceAddCeuDialog } from '@/components/workforce/WorkforceAddCeuDialog';
import {
  CEU_CERTIFICATION_GRADES,
  uniqueNonEmpty,
} from '@/components/workforce/workforcePlanningFormModel';
import {
  CeuProgressBadge,
  CeuProgressBar,
  GradeBadge,
} from '@/components/workforce/workforceBadges';
import {
  useCeuRecords,
  useCeuRequirements,
  useWorkforceEntityList,
} from '@/hooks/useWorkforceSuccession';
import {
  downloadDoh352Pdf,
  fetchDoh352Preview,
  type Doh352PreviewResponse,
  type WorkforceCeuOperatorSummary,
} from '@/services/workforceSuccessionService';

const CEU_CONTACT_HOURS_PER_CEU = 10;

function formatContactHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

export type EmployeeCeuDialogMode = 'default' | 'addVoucher' | 'addCeu';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  districtCode: string;
  operator: WorkforceCeuOperatorSummary | null;
  canManage: boolean;
  initialMode?: EmployeeCeuDialogMode;
  prefillForm?: Record<string, string> | null;
}

export function WorkforceEmployeeCeuDialog({
  open,
  onOpenChange,
  districtCode,
  operator,
  canManage,
  initialMode = 'default',
  prefillForm,
}: Props) {
  const { toast } = useToast();
  const [recordSearch, setRecordSearch] = useState('');
  const [addCeuOpen, setAddCeuOpen] = useState(false);
  const [addCeuInitialStep, setAddCeuInitialStep] = useState<1 | 2>(1);
  const [addCeuPrefill, setAddCeuPrefill] = useState<Record<string, string> | null>(null);
  const [dohPreview, setDohPreview] = useState<Doh352PreviewResponse | null>(null);
  const [dohLoading, setDohLoading] = useState(false);
  const [highlightRecordId, setHighlightRecordId] = useState<number | null>(null);
  const voucherSectionRef = useRef<HTMLDivElement>(null);

  const employeeCode = operator?.employee_code ?? '';
  const recordsQuery = useCeuRecords(districtCode, {
    employee_code: employeeCode || undefined,
    q: recordSearch || undefined,
  });
  const priorRecordsQuery = useCeuRecords(districtCode, {
    employee_code: employeeCode || undefined,
  });
  const requirementsQuery = useCeuRequirements();
  const certificationsQuery = useWorkforceEntityList(districtCode, 'certifications', {
    record_status: 'active',
  });

  const sortedRecords = useMemo(() => {
    const records = [...(recordsQuery.data ?? [])];
    return records.sort((a, b) => b.completion_date.localeCompare(a.completion_date));
  }, [recordsQuery.data]);

  useEffect(() => {
    if (!open || !employeeCode) {
      setDohPreview(null);
      return;
    }
    setDohLoading(true);
    void fetchDoh352Preview(districtCode, employeeCode)
      .then(setDohPreview)
      .catch(() => setDohPreview(null))
      .finally(() => setDohLoading(false));
  }, [open, districtCode, employeeCode]);

  useEffect(() => {
    if (!open) {
      setHighlightRecordId(null);
      return;
    }
    if (initialMode === 'addCeu' || prefillForm) {
      setAddCeuPrefill({
        employee_code: employeeCode,
        ...prefillForm,
      });
      setAddCeuInitialStep(2);
      setAddCeuOpen(true);
    } else if (initialMode === 'addVoucher') {
      queueMicrotask(() => voucherSectionRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }
  }, [open, initialMode, prefillForm, employeeCode]);

  const priorValues = useMemo(() => {
    const records = priorRecordsQuery.data ?? [];
    return {
      course_title: uniqueNonEmpty(records.map(r => r.course_title)),
      provider: uniqueNonEmpty(records.map(r => r.provider)),
      approval_number: uniqueNonEmpty(records.map(r => r.approval_number)),
      category: uniqueNonEmpty(records.map(r => r.category)),
      ceu_hours: uniqueNonEmpty(records.map(r => String(r.contact_hours ?? r.ceu_hours))),
    };
  }, [priorRecordsQuery.data]);

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>(CEU_CERTIFICATION_GRADES);
    if (operator?.certification_grade) grades.add(operator.certification_grade);
    for (const cert of certificationsQuery.data ?? []) {
      if (String(cert.employee_code ?? '') === employeeCode && cert.certification_grade) {
        grades.add(String(cert.certification_grade));
      }
    }
    return Array.from(grades).sort((a, b) => a.localeCompare(b));
  }, [certificationsQuery.data, employeeCode, operator?.certification_grade]);

  const labHint = useMemo(() => {
    const grade = (operator?.certification_grade ?? '').trim().toUpperCase();
    if (!grade || !requirementsQuery.data) return null;
    for (const role of requirementsQuery.data.roles) {
      for (const g of role.grades) {
        if (g.grade.toUpperCase() === grade && g.mandatory_categories.length > 0) {
          return g.mandatory_categories
            .map(m => `${m.minimum_ceu} CEU in ${m.category}`)
            .join('; ');
        }
      }
    }
    return null;
  }, [operator?.certification_grade, requirementsQuery.data]);

  const openAddCeuDialog = () => {
    setAddCeuPrefill(null);
    setAddCeuInitialStep(1);
    setAddCeuOpen(true);
  };

  const generateDoh352 = async () => {
    if (!employeeCode) return;
    try {
      await downloadDoh352Pdf(districtCode, employeeCode);
    } catch (err) {
      toast({
        title: 'DOH-352 generation failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  if (!operator) return null;

  const voucheredCount = (operator.record_count ?? 0) - (operator.records_missing_vouchers ?? 0);
  const recordsMissingVouchers = operator.records_missing_vouchers ?? 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {operator.employee_name}
              <GradeBadge grade={operator.certification_grade} />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CeuProgressBar
                  percentComplete={operator.percent_complete}
                  isShortfall={operator.is_shortfall}
                  daysUntilCycleEnd={operator.days_until_cycle_end}
                  className="flex-1 min-w-[8rem]"
                />
                <CeuProgressBadge
                  percentComplete={operator.percent_complete}
                  isShortfall={operator.is_shortfall}
                  daysUntilCycleEnd={operator.days_until_cycle_end}
                />
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {formatContactHours(
                  operator.earned_contact_hours ?? operator.earned_hours * CEU_CONTACT_HOURS_PER_CEU
                )}
                /
                {formatContactHours(
                  operator.required_contact_hours ??
                    operator.required_hours * CEU_CONTACT_HOURS_PER_CEU
                )}{' '}
                contact hrs · Cycle ends {operator.renewal_cycle_end}
              </p>
              <p className="text-xs text-gray-500">
                Vouchers: {voucheredCount} of {operator.record_count ?? 0} records attached
                {recordsMissingVouchers > 0 ? (
                  <span className="ml-1 text-amber-700">({recordsMissingVouchers} missing)</span>
                ) : null}
              </p>
              {labHint ? (
                <p className="mt-2 text-xs text-amber-800">Mandatory category: {labHint}</p>
              ) : null}
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">DOH-352 readiness</h3>
                <Button size="sm" variant="outline" onClick={() => void generateDoh352()}>
                  <Download className="mr-1 h-3 w-3" /> Download DOH-352
                </Button>
              </div>
              {dohLoading ? (
                <p className="mt-2 text-xs text-gray-500">Checking form readiness…</p>
              ) : dohPreview ? (
                <div className="mt-2 space-y-2">
                  {dohPreview.missing_fields.length === 0 ? (
                    <p className="flex items-center gap-1 text-xs text-green-700">
                      <CheckCircle2 className="h-3 w-3" /> Ready to generate —{' '}
                      {dohPreview.voucher_count} voucher{dohPreview.voucher_count === 1 ? '' : 's'}{' '}
                      will attach
                    </p>
                  ) : (
                    <div className="text-xs text-amber-800">
                      <p className="flex items-center gap-1 font-medium">
                        <AlertTriangle className="h-3 w-3" /> Missing fields before export:
                      </p>
                      <ul className="mt-1 list-disc pl-4">
                        {dohPreview.missing_fields.map(f => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">Could not load readiness preview.</p>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-8"
                  placeholder="Search courses in this cycle…"
                  value={recordSearch}
                  onChange={e => setRecordSearch(e.target.value)}
                />
              </div>
              {canManage ? (
                <Button size="sm" onClick={openAddCeuDialog}>
                  <Plus className="mr-1 h-4 w-4" /> Add CEU
                </Button>
              ) : null}
            </div>

            <div ref={voucherSectionRef} className="space-y-3">
              {sortedRecords.map(r => (
                <CeuRecordCard
                  key={r.id}
                  districtCode={districtCode}
                  record={r}
                  canManage={canManage}
                  highlight={highlightRecordId === r.id}
                  defaultExpanded={
                    highlightRecordId === r.id ||
                    (initialMode === 'addVoucher' && (r.voucher_count ?? 0) === 0)
                  }
                />
              ))}
              {!recordsQuery.isLoading && sortedRecords.length === 0 ? (
                <p className="text-center text-sm text-gray-500">
                  No CEU records for this employee yet.
                </p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <WorkforceAddCeuDialog
        open={addCeuOpen}
        onOpenChange={setAddCeuOpen}
        districtCode={districtCode}
        employeeCode={employeeCode}
        canManage={canManage}
        initialStep={addCeuInitialStep}
        prefillForm={addCeuPrefill}
        priorValues={priorValues}
        gradeOptions={gradeOptions}
        defaultGrade={operator.certification_grade}
        onSaved={recordId => setHighlightRecordId(recordId)}
      />
    </>
  );
}
