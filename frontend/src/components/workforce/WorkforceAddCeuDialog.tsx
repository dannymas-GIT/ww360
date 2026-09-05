import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileUp, PenLine, Search, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  WorkforceDateField,
  WorkforceFieldLabel,
  WorkforcePriorOrCustomField,
  WorkforceSelectField,
} from '@/components/workforce/WorkforceFormControls';
import { CEU_FORM_FIELDS } from '@/components/workforce/workforcePlanningFormModel';
import {
  useCreateCeuRecord,
  useScheduledTrainings,
  useTrainingCourses,
  useUploadCeuVoucher,
} from '@/hooks/useWorkforceSuccession';

const CEU_CONTACT_HOURS_PER_CEU = 10;

const EMPTY_CEU_FORM = {
  employee_code: '',
  course_title: '',
  provider: '',
  approval_number: '',
  ceu_hours: '',
  completion_date: '',
  certification_grade: '',
  category: '',
};

type PastTrainingSource = 'district' | 'catalog';

interface PastTrainingOption {
  key: string;
  source: PastTrainingSource;
  title: string;
  provider: string;
  contactHours: number | null;
  category: string | null;
  completionDate: string | null;
}

interface PriorValues {
  course_title: string[];
  provider: string[];
  approval_number: string[];
  category: string[];
  ceu_hours: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  districtCode: string;
  employeeCode: string;
  canManage: boolean;
  initialStep?: 1 | 2;
  prefillForm?: Record<string, string> | null;
  priorValues: PriorValues;
  gradeOptions: string[];
  defaultGrade?: string | null;
  onSaved?: (recordId: number) => void;
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function isPastDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value.slice(0, 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function formatContactHours(value: number | null): string {
  if (value == null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

export function WorkforceAddCeuDialog({
  open,
  onOpenChange,
  districtCode,
  employeeCode,
  canManage,
  initialStep = 1,
  prefillForm,
  priorValues,
  gradeOptions,
  defaultGrade,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [trainingSearch, setTrainingSearch] = useState('');
  const [form, setForm] = useState(EMPTY_CEU_FORM);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createMutation = useCreateCeuRecord();
  const uploadMutation = useUploadCeuVoucher();

  const scheduledQuery = useScheduledTrainings(open ? { district_code: districtCode } : undefined);
  const catalogQuery = useTrainingCourses(open ? {} : undefined);

  useEffect(() => {
    if (!open) return;
    const hasPrefill = Boolean(prefillForm && Object.keys(prefillForm).length > 0);
    setStep(hasPrefill || initialStep === 2 ? 2 : 1);
    setTrainingSearch('');
    setStagedFiles([]);
    setForm({
      ...EMPTY_CEU_FORM,
      employee_code: employeeCode,
      certification_grade: defaultGrade ?? '',
      ...prefillForm,
    });
  }, [open, employeeCode, defaultGrade, prefillForm, initialStep]);

  const pastTrainings = useMemo(() => {
    const now = new Date();
    const options: PastTrainingOption[] = [];

    for (const training of scheduledQuery.data?.trainings ?? []) {
      const start = new Date(training.start_datetime);
      const isPast =
        training.status === 'completed' || (training.status !== 'cancelled' && start < now);
      if (!isPast) continue;

      options.push({
        key: `district-${training.id}`,
        source: 'district',
        title: training.title,
        provider: training.provider,
        contactHours: training.ceu_hours ?? null,
        category: training.category ?? null,
        completionDate: toDateOnly(training.end_datetime ?? training.start_datetime),
      });
    }

    for (const course of catalogQuery.data?.courses ?? []) {
      const completionDate = course.end_date ?? course.start_date;
      if (!isPastDate(completionDate)) continue;

      options.push({
        key: `catalog-${course.id}`,
        source: 'catalog',
        title: course.course_name,
        provider: course.sponsor,
        contactHours: course.contact_hours ?? null,
        category: course.course_category ?? null,
        completionDate: toDateOnly(completionDate),
      });
    }

    const needle = trainingSearch.trim().toLowerCase();
    const filtered = needle
      ? options.filter(
          o => o.title.toLowerCase().includes(needle) || o.provider.toLowerCase().includes(needle)
        )
      : options;

    return filtered.sort((a, b) => {
      const aDate = a.completionDate ?? '';
      const bDate = b.completionDate ?? '';
      return bDate.localeCompare(aDate);
    });
  }, [scheduledQuery.data?.trainings, catalogQuery.data?.courses, trainingSearch]);

  const canSave =
    form.employee_code.trim() !== '' &&
    form.course_title.trim() !== '' &&
    form.completion_date.trim() !== '' &&
    Number(form.ceu_hours) > 0;

  const selectTraining = (option: PastTrainingOption) => {
    setForm(prev => ({
      ...prev,
      course_title: option.title,
      provider: option.provider,
      ceu_hours: option.contactHours != null ? String(option.contactHours) : prev.ceu_hours,
      completion_date: option.completionDate ?? prev.completion_date,
      category: option.category ?? prev.category,
    }));
    setStep(2);
  };

  const selectManual = () => {
    setForm(prev => ({
      ...EMPTY_CEU_FORM,
      employee_code: employeeCode,
      certification_grade: defaultGrade ?? prev.certification_grade,
    }));
    setStep(2);
  };

  const stageFiles = (files: FileList | File[]) => {
    setStagedFiles(prev => [...prev, ...Array.from(files)]);
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const saveCeu = async () => {
    const contactHours = Number(form.ceu_hours) || 0;
    try {
      const record = await createMutation.mutateAsync({
        district_code: districtCode,
        employee_code: form.employee_code,
        course_title: form.course_title,
        provider: form.provider || undefined,
        approval_number: form.approval_number || undefined,
        contact_hours: contactHours,
        ceu_hours: contactHours / CEU_CONTACT_HOURS_PER_CEU,
        completion_date: form.completion_date,
        certification_grade: form.certification_grade || undefined,
        category: form.category || undefined,
      });

      for (const file of stagedFiles) {
        await uploadMutation.mutateAsync({ recordId: record.id, districtCode, file });
      }

      toast({
        title: 'CEU record saved',
        description:
          stagedFiles.length > 0
            ? `Record saved with ${stagedFiles.length} voucher${stagedFiles.length === 1 ? '' : 's'}.`
            : undefined,
      });
      onSaved?.(record.id);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  if (!canManage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Add CEU — choose training' : 'Add CEU — review & save'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8"
                placeholder="Search past trainings…"
                value={trainingSearch}
                onChange={e => setTrainingSearch(e.target.value)}
              />
            </div>

            <Button variant="outline" className="w-full justify-start" onClick={selectManual}>
              <PenLine className="mr-2 h-4 w-4" />
              Enter manually
            </Button>

            {scheduledQuery.isLoading || catalogQuery.isLoading ? (
              <p className="text-sm text-gray-500">Loading past trainings…</p>
            ) : pastTrainings.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-gray-500">
                No past trainings found. Use &quot;Enter manually&quot; to add a CEU record.
              </p>
            ) : (
              <ul className="max-h-[20rem] space-y-2 overflow-y-auto">
                {pastTrainings.map(option => (
                  <li key={option.key}>
                    <button
                      type="button"
                      className="w-full rounded-md border p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
                      onClick={() => selectTraining(option)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{option.title}</p>
                          <p className="text-xs text-gray-600">
                            {option.provider}
                            {option.completionDate ? ` · ${option.completionDate}` : ''}
                            {option.contactHours != null
                              ? ` · ${formatContactHours(option.contactHours)} hrs`
                              : ''}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                          {option.source === 'district' ? 'District training' : 'NYSDOH catalog'}
                        </Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-1 h-3 w-3" /> Back to training list
            </Button>

            {CEU_FORM_FIELDS.filter(f => f.key !== 'employee_code').map(field => {
              const value = form[field.key as keyof typeof form];
              const fieldId = `add-ceu-${field.key}`;

              if (field.kind === 'grade') {
                return (
                  <div key={field.key}>
                    <WorkforceFieldLabel htmlFor={fieldId} label={field.label} />
                    <WorkforceSelectField
                      id={fieldId}
                      value={value}
                      emptyLabel="— none —"
                      onChange={next => setForm(prev => ({ ...prev, certification_grade: next }))}
                      options={gradeOptions.map(grade => ({ value: grade, label: grade }))}
                    />
                  </div>
                );
              }

              if (field.kind === 'date') {
                return (
                  <div key={field.key}>
                    <WorkforceFieldLabel
                      htmlFor={fieldId}
                      label={field.label}
                      required={field.required}
                    />
                    <WorkforceDateField
                      id={fieldId}
                      required={field.required}
                      value={value}
                      onChange={next => setForm(prev => ({ ...prev, completion_date: next }))}
                    />
                  </div>
                );
              }

              if (field.kind === 'hours') {
                return (
                  <div key={field.key}>
                    <WorkforceFieldLabel
                      htmlFor={fieldId}
                      label={field.label}
                      required={field.required}
                    />
                    <WorkforcePriorOrCustomField
                      id={fieldId}
                      required={field.required}
                      value={value}
                      options={priorValues.ceu_hours}
                      inputType="number"
                      inputStep="0.25"
                      placeholder="Contact hours…"
                      onChange={next => setForm(prev => ({ ...prev, ceu_hours: next }))}
                    />
                  </div>
                );
              }

              if (field.kind === 'select') {
                const options = priorValues[field.key as keyof typeof priorValues] ?? [];
                return (
                  <div key={field.key}>
                    <WorkforceFieldLabel
                      htmlFor={fieldId}
                      label={field.label}
                      required={field.required}
                    />
                    <WorkforcePriorOrCustomField
                      id={fieldId}
                      required={field.required}
                      value={value}
                      options={options}
                      onChange={next => setForm(prev => ({ ...prev, [field.key]: next }))}
                    />
                  </div>
                );
              }

              return null;
            })}

            <div>
              <WorkforceFieldLabel label="Voucher (optional)" />
              <div
                className={`mt-1 flex flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-center transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                }`}
                onDragOver={e => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files.length) stageFiles(e.dataTransfer.files);
                }}
              >
                <Upload className="mb-1 h-5 w-5 text-gray-400" />
                <p className="text-xs text-gray-600">Drag voucher files here or</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <FileUp className="mr-1 h-3 w-3" /> Choose file
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files?.length) stageFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
              {stagedFiles.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {stagedFiles.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-xs">
                      <span className="truncate text-gray-700">{file.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => removeStagedFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <Button
              onClick={() => void saveCeu()}
              disabled={!canSave || createMutation.isPending || uploadMutation.isPending}
            >
              {createMutation.isPending || uploadMutation.isPending ? 'Saving…' : 'Save CEU record'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
