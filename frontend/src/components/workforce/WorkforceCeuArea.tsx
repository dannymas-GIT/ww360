import { useEffect, useMemo, useState } from 'react';
import { Download, FileUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkforceFieldLabel } from '@/components/workforce/WorkforceFormControls';
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
import {
  useCeuSummary,
  useDistrictEmployerProfile,
  useUpdateDistrictEmployerProfile,
} from '@/hooks/useWorkforceSuccession';
import {
  CeuProgressBadge,
  CeuProgressBar,
  GradeBadge,
} from '@/components/workforce/workforceBadges';
import {
  WorkforceEmployeeCeuDialog,
  type EmployeeCeuDialogMode,
} from '@/components/workforce/WorkforceEmployeeCeuDialog';
import {
  downloadDoh352Pdf,
  type TrainingCourseFilters,
  type WorkforceCeuOperatorSummary,
} from '@/services/workforceSuccessionService';

interface Props {
  districtCode: string;
  onFindRenewalCourses?: (filters: TrainingCourseFilters) => void;
  prefillForm?: Record<string, string> | null;
  openCreateDialog?: boolean;
  onCreateDialogHandled?: () => void;
}

function certTypeForGrade(grade: string | null | undefined): string | undefined {
  if (!grade) return undefined;
  const normalized = grade.trim().toUpperCase();
  if (normalized === 'D' || normalized === 'C') return 'distribution';
  if (normalized === 'A' || normalized === 'B') return 'treatment';
  return undefined;
}

const CEU_CONTACT_HOURS_PER_CEU = 10;

function formatContactHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function voucherTallyLabel(op: WorkforceCeuOperatorSummary): string {
  const total = op.record_count ?? 0;
  if (total === 0) return '—';
  const missing = op.records_missing_vouchers ?? 0;
  const vouchered = total - missing;
  return `${vouchered} of ${total} vouchered`;
}

export function WorkforceCeuArea({
  districtCode,
  onFindRenewalCourses,
  prefillForm,
  openCreateDialog,
  onCreateDialogHandled,
}: Props) {
  const { toast } = useToast();
  const { canManageWorkforce } = useAuth();
  const canManage = canManageWorkforce;
  const [nameFilter, setNameFilter] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<WorkforceCeuOperatorSummary | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<EmployeeCeuDialogMode>('default');
  const [dialogPrefill, setDialogPrefill] = useState<Record<string, string> | null>(null);

  const summaryQuery = useCeuSummary(districtCode);
  const employerProfileQuery = useDistrictEmployerProfile(districtCode);
  const updateEmployerProfile = useUpdateDistrictEmployerProfile();
  const [employerLine1, setEmployerLine1] = useState('');
  const [employerLine2, setEmployerLine2] = useState('');

  useEffect(() => {
    if (!employerProfileQuery.data) return;
    setEmployerLine1(employerProfileQuery.data.mailing_address_line1 ?? '');
    setEmployerLine2(employerProfileQuery.data.mailing_address_line2 ?? '');
  }, [employerProfileQuery.data]);

  useEffect(() => {
    if (!openCreateDialog || !prefillForm) return;
    const employeeCode = prefillForm.employee_code;
    const operator =
      summaryQuery.data?.operators.find(o => o.employee_code === employeeCode) ?? null;
    if (operator) {
      openEmployeeDialog(operator, 'addCeu', prefillForm);
    }
    queueMicrotask(() => onCreateDialogHandled?.());
  }, [openCreateDialog, prefillForm, onCreateDialogHandled, summaryQuery.data?.operators]);

  const filteredOperators = useMemo(() => {
    const ops = summaryQuery.data?.operators ?? [];
    const needle = nameFilter.trim().toLowerCase();
    if (!needle) return ops;
    return ops.filter(
      o =>
        o.employee_name.toLowerCase().includes(needle) ||
        o.employee_code.toLowerCase().includes(needle)
    );
  }, [summaryQuery.data?.operators, nameFilter]);

  const openEmployeeDialog = (
    op: WorkforceCeuOperatorSummary,
    mode: EmployeeCeuDialogMode = 'default',
    prefill?: Record<string, string> | null
  ) => {
    setSelectedOperator(op);
    setDialogMode(mode);
    setDialogPrefill(prefill ?? null);
    setDialogOpen(true);
  };

  const generateDoh352 = async (employeeCode: string) => {
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

  const saveEmployerProfile = async () => {
    try {
      await updateEmployerProfile.mutateAsync({
        districtCode,
        body: {
          mailing_address_line1: employerLine1 || null,
          mailing_address_line2: employerLine2 || null,
        },
      });
      toast({ title: 'Employer address saved' });
    } catch (err) {
      toast({
        title: 'Could not save employer address',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const hasGrade = (op: WorkforceCeuOperatorSummary) => Boolean(op.certification_grade?.trim());

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-800">Employer address for DOH-352</h3>
        <p className="mt-1 text-xs text-gray-500">
          Used as the employer address on operator renewal forms. Employee home contact and county
          are set on each employee record.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <WorkforceFieldLabel htmlFor="employer-line1" label="Employer address line 1" />
            <Input
              id="employer-line1"
              className="mt-1"
              value={employerLine1}
              onChange={e => setEmployerLine1(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <div>
            <WorkforceFieldLabel htmlFor="employer-line2" label="Employer address line 2" />
            <Input
              id="employer-line2"
              className="mt-1"
              value={employerLine2}
              onChange={e => setEmployerLine2(e.target.value)}
              disabled={!canManage}
            />
          </div>
        </div>
        {canManage ? (
          <Button
            size="sm"
            className="mt-3"
            onClick={() => void saveEmployerProfile()}
            disabled={updateEmployerProfile.isPending}
          >
            {updateEmployerProfile.isPending ? 'Saving…' : 'Save employer address'}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Operators tracked</p>
          <p className="text-2xl font-semibold">{summaryQuery.data?.total_operators ?? '—'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">CEU shortfall</p>
          <p className="text-2xl font-semibold text-amber-700">
            {summaryQuery.data?.total_shortfall ?? '—'}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Avg completion</p>
          <p className="text-2xl font-semibold">
            {summaryQuery.data?.operators?.length
              ? `${Math.round(
                  summaryQuery.data.operators.reduce((a, o) => a + o.percent_complete, 0) /
                    summaryQuery.data.operators.length
                )}%`
              : '—'}
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          className="pl-8"
          placeholder="Filter by operator name…"
          value={nameFilter}
          onChange={e => setNameFilter(e.target.value)}
        />
      </div>

      {filteredOperators.length ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operator</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Vouchers</TableHead>
                <TableHead>Cycle end</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOperators.map(op => {
                const missingVouchers = (op.records_missing_vouchers ?? 0) > 0;
                return (
                  <TableRow key={op.employee_code}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-blue-700 hover:underline"
                        onClick={() => openEmployeeDialog(op)}
                      >
                        {op.employee_name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <GradeBadge grade={op.certification_grade} />
                    </TableCell>
                    <TableCell className="min-w-[10rem]">
                      {hasGrade(op) ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CeuProgressBar
                              percentComplete={op.percent_complete}
                              isShortfall={op.is_shortfall}
                              daysUntilCycleEnd={op.days_until_cycle_end}
                              className="flex-1"
                            />
                            <CeuProgressBadge
                              percentComplete={op.percent_complete}
                              isShortfall={op.is_shortfall}
                              daysUntilCycleEnd={op.days_until_cycle_end}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatContactHours(
                              op.earned_contact_hours ?? op.earned_hours * CEU_CONTACT_HOURS_PER_CEU
                            )}
                            /
                            {formatContactHours(
                              op.required_contact_hours ??
                                op.required_hours * CEU_CONTACT_HOURS_PER_CEU
                            )}{' '}
                            hrs
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {(op.record_count ?? 0) > 0
                            ? `${op.record_count} CEU record(s) — set grade for cycle progress`
                            : 'No grade on file'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-sm ${missingVouchers ? 'font-medium text-amber-700' : 'text-gray-600'}`}
                      >
                        {voucherTallyLabel(op)}
                      </span>
                    </TableCell>
                    <TableCell>{op.renewal_cycle_end}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void generateDoh352(op.employee_code)}
                        >
                          <Download className="mr-1 h-3 w-3" /> DOH-352
                        </Button>
                        {canManage ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEmployeeDialog(op, 'addVoucher')}
                          >
                            <FileUp className="mr-1 h-3 w-3" /> Add Voucher
                          </Button>
                        ) : null}
                        {op.is_shortfall && onFindRenewalCourses ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              onFindRenewalCourses({
                                course_category: 'renewal',
                                grade: op.certification_grade ?? undefined,
                                cert_type: certTypeForGrade(op.certification_grade),
                                upcoming_only: true,
                              })
                            }
                          >
                            Find renewal courses
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
          No operators match your filter. Add employees and certifications, then record CEU
          completions from an operator row.
        </div>
      )}

      <WorkforceEmployeeCeuDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        districtCode={districtCode}
        operator={selectedOperator}
        canManage={canManage}
        initialMode={dialogMode}
        prefillForm={dialogPrefill}
      />
    </div>
  );
}
