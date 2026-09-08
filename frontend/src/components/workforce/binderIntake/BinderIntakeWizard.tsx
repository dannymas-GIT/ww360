import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Check, ChevronLeft, ChevronRight, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { ConceptArtForBinderStep } from '@/components/workforce/workforceConceptArt';
import {
  BINDER_INTAKE_STEP_IDS,
  BINDER_INTAKE_STEPS,
  GAP_CHIP_OPTIONS,
  stepIndex,
  stepLabel,
} from '@/components/workforce/binderIntake/binderIntakeSteps';
import {
  useCompleteBinderIntake,
  useEnsureBinderIntake,
  usePatchBinderIntake,
} from '@/hooks/useWorkforceSuccession';
import type {
  BinderIntakeAnswers,
  BinderIntakeStepId,
  WorkforceBinderIntakeSession,
} from '@/services/workforceSuccessionService';
import {
  DEFAULT_BINDER_INTAKE_ANSWERS,
  type WorkforceContinuityResponse,
} from '@/services/workforceSuccessionService';

const PROFILE_OPTIONS = [
  { id: 'small_system', label: 'Small system (single plant)' },
  { id: 'multi_plant', label: 'Multi-plant utility' },
  { id: 'district_trainees', label: 'District with trainees' },
] as const;

export interface BinderIntakeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  districtCode: string;
  districtLabel?: string;
  defaultContactName?: string;
  defaultContactEmail?: string;
  continuity?: WorkforceContinuityResponse | null;
  initialSession?: WorkforceBinderIntakeSession | null;
  onComplete: (result: { coverId?: string | null; folderId: string }) => void;
  /** When true (read-only preview), refuse to open / persist. */
  readOnly?: boolean;
}

function mergeAnswers(
  base: BinderIntakeAnswers,
  patch: Partial<BinderIntakeAnswers>
): BinderIntakeAnswers {
  return { ...base, ...patch };
}

function impersonationReadOnlyMessage(err: unknown): string | null {
  if (axios.isAxiosError(err) && err.response?.data?.detail === 'IMPERSONATION_READ_ONLY') {
    return 'Read-only preview cannot save. Exit preview, or use Act as (audited) to make changes.';
  }
  return null;
}

function errorDetail(err: unknown): string {
  return (
    impersonationReadOnlyMessage(err) ??
    (axios.isAxiosError(err)
      ? String(err.response?.data?.detail ?? err.message)
      : err instanceof Error
        ? err.message
        : String(err))
  );
}

export function BinderIntakeWizard({
  open,
  onOpenChange,
  districtCode,
  districtLabel,
  defaultContactName = '',
  defaultContactEmail = '',
  continuity,
  initialSession,
  onComplete,
  readOnly = false,
}: BinderIntakeWizardProps) {
  const { toast } = useToast();
  const ensureMutation = useEnsureBinderIntake();
  const patchMutation = usePatchBinderIntake();
  const completeMutation = useCompleteBinderIntake();

  const [session, setSession] = useState<WorkforceBinderIntakeSession | null>(initialSession ?? null);
  const [stepId, setStepId] = useState<BinderIntakeStepId>('welcome');
  const [answers, setAnswers] = useState<BinderIntakeAnswers>({
    ...DEFAULT_BINDER_INTAKE_ANSWERS,
    contact_name: defaultContactName,
    contact_email: defaultContactEmail,
  });
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [continuityPrefilled, setContinuityPrefilled] = useState(false);
  const bootstrappedRef = useRef(false);

  const stepMeta = useMemo(
    () => BINDER_INTAKE_STEPS.find(s => s.id === stepId) ?? BINDER_INTAKE_STEPS[0],
    [stepId]
  );

  const stepIdx = stepIndex(stepId);

  useEffect(() => {
    if (!open) {
      bootstrappedRef.current = false;
      return;
    }
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    if (readOnly) {
      toast({
        title: 'Read-only preview',
        description:
          'Walkthrough progress cannot be saved in preview. Exit preview and use Act as (audited), or ask the utility to sign in.',
      });
      onOpenChange(false);
      return;
    }

    if (initialSession) {
      setSession(initialSession);
      setStepId(initialSession.current_step);
      setAnswers({ ...DEFAULT_BINDER_INTAKE_ANSWERS, ...initialSession.answers });
      setCompletedSteps(initialSession.completed_steps ?? []);
      return;
    }
    setBusy(true);
    void ensureMutation
      .mutateAsync(districtCode)
      .then(res => {
        setSession(res.session);
        setStepId(res.session.current_step);
        setAnswers({
          ...DEFAULT_BINDER_INTAKE_ANSWERS,
          ...res.session.answers,
          contact_name: res.session.answers.contact_name || defaultContactName,
          contact_email: res.session.answers.contact_email || defaultContactEmail,
        });
        setCompletedSteps(res.session.completed_steps ?? []);
      })
      .catch(err => {
        toast({
          title: 'Could not start walkthrough',
          description: errorDetail(err),
          variant: 'destructive',
        });
        onOpenChange(false);
      })
      .finally(() => setBusy(false));
    // Bootstrap once per open — avoid re-running when mutation/toast identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, districtCode, readOnly]);

  useEffect(() => {
    if (!open || continuityPrefilled || !continuity || readOnly) return;
    const coverage = continuity.coverage ?? [];
    if (coverage.length && answers.critical_roles.length === 0) {
      setAnswers(prev => ({
        ...prev,
        critical_roles: coverage.slice(0, 6).map(c => ({
          role_name: c.function_name || c.function_code || '',
          primary_name: (c.primary_employee_codes ?? []).join(', ') || '',
          backup_name: (c.backup_employee_codes ?? []).join(', ') || '',
          notes: c.has_qualified_backup ? 'OK' : 'Needs backup',
        })),
      }));
    }
    const retirement = continuity.retirement_horizon ?? [];
    if (retirement.length && answers.retirement_entries.length === 0) {
      setAnswers(prev => ({
        ...prev,
        retirement_entries: retirement.slice(0, 6).map(r => ({
          employee_name: r.employee_name || r.employee_code || '',
          position: r.position_code || '',
          timeline: r.retirement_eligible_date || `${r.months_until_eligible ?? '—'} mo`,
          notes: '',
        })),
      }));
    }
    setContinuityPrefilled(true);
  }, [open, continuity, continuityPrefilled, answers.critical_roles.length, answers.retirement_entries.length]);

  const persist = useCallback(
    async (nextStep: BinderIntakeStepId, nextCompleted: string[], nextAnswers: BinderIntakeAnswers) => {
      if (!session || readOnly) return;
      const updated = await patchMutation.mutateAsync({
        sessionId: session.id,
        districtCode,
        body: {
          answers: nextAnswers,
          current_step: nextStep,
          completed_steps: nextCompleted,
        },
      });
      setSession(updated);
    },
    [session, districtCode, patchMutation, readOnly]
  );

  const goNext = async () => {
    if (stepIdx >= BINDER_INTAKE_STEP_IDS.length - 1 || readOnly) return;
    const nextId = BINDER_INTAKE_STEP_IDS[stepIdx + 1];
    const nextCompleted = completedSteps.includes(stepId)
      ? completedSteps
      : [...completedSteps, stepId];
    setCompletedSteps(nextCompleted);
    setStepId(nextId);
    setBusy(true);
    try {
      await persist(nextId, nextCompleted, answers);
    } catch (err) {
      toast({
        title: 'Could not save progress',
        description: errorDetail(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (stepIdx <= 0) return;
    setStepId(BINDER_INTAKE_STEP_IDS[stepIdx - 1]);
  };

  const saveAndExit = async () => {
    if (!session || readOnly) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await persist(stepId, completedSteps, answers);
      toast({ title: 'Progress saved', description: 'Resume this walkthrough anytime from Continuity.' });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: errorDetail(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!session || readOnly) return;
    setBusy(true);
    try {
      await persist('review', [...new Set([...completedSteps, 'review'])], answers);
      const result = await completeMutation.mutateAsync({
        sessionId: session.id,
        districtCode,
      });
      toast({
        title: 'Succession Binder ready',
        description: `${result.pack.document_count} section(s) in Document Studio.`,
      });
      onComplete({
        coverId: result.pack.cover_document_id,
        folderId: result.pack.folder_id,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Binder not generated',
        description: errorDetail(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleGap = (gap: string) => {
    setAnswers(prev => ({
      ...prev,
      largest_gaps: prev.largest_gaps.includes(gap)
        ? prev.largest_gaps.filter(g => g !== gap)
        : [...prev.largest_gaps, gap],
    }));
  };

  const renderStepBody = () => {
    switch (stepId) {
      case 'welcome':
        return (
          <div className="space-y-4 text-[1.125rem] leading-relaxed text-slate-700">
            <p>
              This optional walkthrough asks structured questions and writes answers into your{' '}
              <strong className="font-semibold">Succession Binder</strong> in Document Studio.
            </p>
            <ul className="list-disc space-y-2 pl-5 text-[1rem]">
              <li>Save and return anytime — progress is stored for {districtLabel ?? districtCode}.</li>
              <li>Prefer another path? Use quick create, Studio templates, or upload existing files.</li>
              <li>Continuity data can prefill tables when you accept suggested answers.</li>
            </ul>
          </div>
        );
      case 'utility_profile':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[1rem]">Utility template</Label>
              <Select
                value={answers.profile}
                onValueChange={v =>
                  setAnswers(prev => mergeAnswers(prev, { profile: v as BinderIntakeAnswers['profile'] }))
                }
              >
                <SelectTrigger className="min-h-[44px] text-[1rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFILE_OPTIONS.map(opt => (
                    <SelectItem key={opt.id} value={opt.id} className="text-[1rem]">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bi-contact-name" className="text-[1rem]">
                  Prepared by
                </Label>
                <Input
                  id="bi-contact-name"
                  className="min-h-[44px] text-[1rem]"
                  value={answers.contact_name}
                  onChange={e => setAnswers(prev => ({ ...prev, contact_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bi-contact-email" className="text-[1rem]">
                  Contact email
                </Label>
                <Input
                  id="bi-contact-email"
                  type="email"
                  className="min-h-[44px] text-[1rem]"
                  value={answers.contact_email}
                  onChange={e => setAnswers(prev => ({ ...prev, contact_email: e.target.value }))}
                />
              </div>
            </div>
          </div>
        );
      case 'operations_snapshot':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bi-plants" className="text-[1rem]">
                Plants / sites
              </Label>
              <Input
                id="bi-plants"
                type="number"
                min={1}
                className="min-h-[44px] max-w-[8rem] text-[1rem]"
                value={answers.plant_count}
                onChange={e =>
                  setAnswers(prev => ({
                    ...prev,
                    plant_count: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[1rem]">Largest workforce gaps</Label>
              <div className="flex flex-wrap gap-2">
                {GAP_CHIP_OPTIONS.map(gap => (
                  <button
                    key={gap}
                    type="button"
                    className={`min-h-[44px] rounded-md border px-3 text-[1rem] ${
                      answers.largest_gaps.includes(gap)
                        ? 'border-sky-600 bg-sky-50 text-sky-950'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                    onClick={() => toggleGap(gap)}
                  >
                    {gap}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bi-gap-notes" className="text-[1rem]">
                Additional context
              </Label>
              <Textarea
                id="bi-gap-notes"
                className="min-h-[100px] text-[1rem]"
                value={answers.gap_notes}
                onChange={e => setAnswers(prev => ({ ...prev, gap_notes: e.target.value }))}
              />
            </div>
          </div>
        );
      case 'critical_roles':
        return (
          <div className="space-y-3">
            <label className="flex min-h-[44px] items-center gap-2 text-[1rem]">
              <Checkbox
                checked={answers.use_continuity_coverage}
                onCheckedChange={c =>
                  setAnswers(prev => ({ ...prev, use_continuity_coverage: Boolean(c) }))
                }
              />
              Merge Continuity coverage where rows are blank
            </label>
            {answers.critical_roles.map((row, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
                <Input
                  placeholder="Role / function"
                  className="text-[1rem]"
                  value={row.role_name}
                  onChange={e => {
                    const next = [...answers.critical_roles];
                    next[i] = { ...row, role_name: e.target.value };
                    setAnswers(prev => ({ ...prev, critical_roles: next }));
                  }}
                />
                <Input
                  placeholder="Primary"
                  className="text-[1rem]"
                  value={row.primary_name}
                  onChange={e => {
                    const next = [...answers.critical_roles];
                    next[i] = { ...row, primary_name: e.target.value };
                    setAnswers(prev => ({ ...prev, critical_roles: next }));
                  }}
                />
                <Input
                  placeholder="Backup"
                  className="text-[1rem]"
                  value={row.backup_name}
                  onChange={e => {
                    const next = [...answers.critical_roles];
                    next[i] = { ...row, backup_name: e.target.value };
                    setAnswers(prev => ({ ...prev, critical_roles: next }));
                  }}
                />
                <Input
                  placeholder="Notes"
                  className="text-[1rem]"
                  value={row.notes ?? ''}
                  onChange={e => {
                    const next = [...answers.critical_roles];
                    next[i] = { ...row, notes: e.target.value };
                    setAnswers(prev => ({ ...prev, critical_roles: next }));
                  }}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] text-[1rem]"
              onClick={() =>
                setAnswers(prev => ({
                  ...prev,
                  critical_roles: [
                    ...prev.critical_roles,
                    { role_name: '', primary_name: '', backup_name: '', notes: '' },
                  ],
                }))
              }
            >
              Add role row
            </Button>
          </div>
        );
      case 'retirement_risk':
        return (
          <div className="space-y-3">
            <label className="flex min-h-[44px] items-center gap-2 text-[1rem]">
              <Checkbox
                checked={answers.use_continuity_retirement}
                onCheckedChange={c =>
                  setAnswers(prev => ({ ...prev, use_continuity_retirement: Boolean(c) }))
                }
              />
              Include Continuity retirement horizon where rows are blank
            </label>
            {answers.retirement_entries.map((row, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
                {(['employee_name', 'position', 'timeline', 'notes'] as const).map(field => (
                  <Input
                    key={field}
                    placeholder={field.replace('_', ' ')}
                    className="text-[1rem] capitalize"
                    value={row[field] ?? ''}
                    onChange={e => {
                      const next = [...answers.retirement_entries];
                      next[i] = { ...row, [field]: e.target.value };
                      setAnswers(prev => ({ ...prev, retirement_entries: next }));
                    }}
                  />
                ))}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] text-[1rem]"
              onClick={() =>
                setAnswers(prev => ({
                  ...prev,
                  retirement_entries: [
                    ...prev.retirement_entries,
                    { employee_name: '', position: '', timeline: '', notes: '' },
                  ],
                }))
              }
            >
              Add retirement row
            </Button>
          </div>
        );
      case 'succession_bench':
        return (
          <div className="space-y-3">
            <label className="flex min-h-[44px] items-center gap-2 text-[1rem]">
              <Checkbox
                checked={answers.use_continuity_bench}
                onCheckedChange={c =>
                  setAnswers(prev => ({ ...prev, use_continuity_bench: Boolean(c) }))
                }
              />
              Merge Continuity succession candidates where rows are blank
            </label>
            {answers.succession_candidates.map((row, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-5">
                {(['candidate_name', 'target_role', 'readiness', 'target_date', 'notes'] as const).map(
                  field => (
                    <Input
                      key={field}
                      placeholder={field.replace('_', ' ')}
                      className="text-[1rem]"
                      value={row[field] ?? ''}
                      onChange={e => {
                        const next = [...answers.succession_candidates];
                        next[i] = { ...row, [field]: e.target.value };
                        setAnswers(prev => ({ ...prev, succession_candidates: next }));
                      }}
                    />
                  )
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] text-[1rem]"
              onClick={() =>
                setAnswers(prev => ({
                  ...prev,
                  succession_candidates: [
                    ...prev.succession_candidates,
                    {
                      candidate_name: '',
                      target_role: '',
                      readiness: '',
                      target_date: '',
                      notes: '',
                    },
                  ],
                }))
              }
            >
              Add candidate row
            </Button>
          </div>
        );
      case 'knowledge_transfer':
        return (
          <div className="space-y-3">
            {answers.knowledge_items.map((row, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
                <Input
                  placeholder="Title / SOP"
                  className="text-[1rem]"
                  value={row.title}
                  onChange={e => {
                    const next = [...answers.knowledge_items];
                    next[i] = { ...row, title: e.target.value };
                    setAnswers(prev => ({ ...prev, knowledge_items: next }));
                  }}
                />
                <Input
                  placeholder="Type"
                  className="text-[1rem]"
                  value={row.item_type}
                  onChange={e => {
                    const next = [...answers.knowledge_items];
                    next[i] = { ...row, item_type: e.target.value };
                    setAnswers(prev => ({ ...prev, knowledge_items: next }));
                  }}
                />
                <Input
                  placeholder="Status"
                  className="text-[1rem]"
                  value={row.status}
                  onChange={e => {
                    const next = [...answers.knowledge_items];
                    next[i] = { ...row, status: e.target.value };
                    setAnswers(prev => ({ ...prev, knowledge_items: next }));
                  }}
                />
                <Input
                  placeholder="Notes"
                  className="text-[1rem]"
                  value={row.notes ?? ''}
                  onChange={e => {
                    const next = [...answers.knowledge_items];
                    next[i] = { ...row, notes: e.target.value };
                    setAnswers(prev => ({ ...prev, knowledge_items: next }));
                  }}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] text-[1rem]"
              onClick={() =>
                setAnswers(prev => ({
                  ...prev,
                  knowledge_items: [
                    ...prev.knowledge_items,
                    { title: '', item_type: 'SOP', status: 'planned', notes: '' },
                  ],
                }))
              }
            >
              Add knowledge item
            </Button>
          </div>
        );
      case 'review':
        return (
          <div className="space-y-4 text-[1rem] leading-relaxed text-slate-700">
            <label className="flex min-h-[44px] items-center gap-2">
              <Checkbox
                checked={answers.use_live_data}
                onCheckedChange={c => setAnswers(prev => ({ ...prev, use_live_data: Boolean(c) }))}
              />
              Prefill empty tables from live Continuity data
            </label>
            <ul className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <li>
                <strong>Profile:</strong>{' '}
                {PROFILE_OPTIONS.find(p => p.id === answers.profile)?.label ?? answers.profile}
              </li>
              <li>
                <strong>Critical roles:</strong> {answers.critical_roles.length} row(s)
              </li>
              <li>
                <strong>Retirement entries:</strong> {answers.retirement_entries.length} row(s)
              </li>
              <li>
                <strong>Succession candidates:</strong> {answers.succession_candidates.length} row(s)
              </li>
              <li>
                <strong>Knowledge items:</strong> {answers.knowledge_items.length} row(s)
              </li>
            </ul>
            <p className="text-slate-600">
              Generate creates or updates all binder sections in Document Studio. You can still edit,
              export, or transfer custody afterward.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <DialogTitle className="text-[1.375rem] text-slate-900">
            Succession Binder walkthrough
          </DialogTitle>
          <DialogDescription className="text-[1.125rem] text-slate-600">
            {districtLabel ?? districtCode} — optional guided intake
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <nav
            className="hidden shrink-0 border-r border-slate-200 bg-white p-4 lg:block lg:w-56"
            aria-label="Walkthrough steps"
          >
            <ol className="space-y-1">
              {BINDER_INTAKE_STEPS.map((s, i) => {
                const done = completedSteps.includes(s.id);
                const current = s.id === stepId;
                return (
                  <li key={s.id}>
                    <div
                      className={`flex items-center gap-2 rounded-md px-2 py-2 text-[1rem] ${
                        current ? 'bg-sky-50 font-semibold text-sky-950' : 'text-slate-600'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[0.875rem] ${
                          done
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : current
                              ? 'border-sky-500 bg-sky-100 text-sky-800'
                              : 'border-slate-300'
                        }`}
                      >
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <span>{s.label}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_minmax(10rem,12rem)]">
              <div className="space-y-4">
                <div>
                  <p className="text-[0.875rem] font-semibold uppercase tracking-wide text-sky-800">
                    Step {stepIdx + 1} of {BINDER_INTAKE_STEPS.length} — {stepMeta.label}
                  </p>
                  <p className="mt-1 text-[1.125rem] leading-relaxed text-slate-800">{stepMeta.caption}</p>
                </div>
                {busy && !session ? (
                  <p className="flex items-center gap-2 text-[1rem] text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading session…
                  </p>
                ) : (
                  renderStepBody()
                )}
              </div>
              <aside className="flex flex-col items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                <ConceptArtForBinderStep stepId={stepId} className="h-28 w-36 lg:h-32 lg:w-44" />
                <p className="text-center text-[0.875rem] leading-relaxed text-sky-950">
                  <span className="font-semibold">Fills:</span> {stepMeta.fills}
                </p>
              </aside>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px] text-[1rem]"
                disabled={stepIdx === 0 || busy}
                onClick={goBack}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] text-[1rem]"
                  disabled={busy || !session}
                  onClick={() => void saveAndExit()}
                >
                  <Save className="mr-1 h-4 w-4" />
                  Save &amp; exit
                </Button>
                {stepId === 'review' ? (
                  <Button
                    type="button"
                    className="min-h-[44px] text-[1rem]"
                    disabled={busy || !session}
                    onClick={() => void handleComplete()}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Generate / update binder
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="min-h-[44px] text-[1rem]"
                    disabled={busy || !session}
                    onClick={() => void goNext()}
                  >
                    Continue
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { stepLabel as binderIntakeStepLabel };
