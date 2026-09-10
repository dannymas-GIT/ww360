/**
 * Workforce Succession Wizard — guided steps over live workforce CRUD tables.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, HelpCircle, Loader2, Sparkles, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

import { HelpChatbot } from '@/components/HelpChatbot';
import { WorkforceExpressSetup } from '@/components/workforce/WorkforceExpressSetup';
import { WorkforceEntityArea } from '@/components/workforce/WorkforceEntityArea';
import { WorkforceCeuArea } from '@/components/workforce/WorkforceCeuArea';
import {
  FORM_WIZARD_STEPS,
  COMPACT_FORM_WIZARD_STEPS,
  WORKFORCE_PHASE_COLORS,
  chatPreambleForFormStep,
  emptyWizardSetupMeta,
  loadWizardSetupMeta,
  saveWizardSetupMeta,
  welcomeMessageForFormStep,
  type WizardSetupMeta,
} from '@/components/workforce/workforcePlanningFormModel';
import {
  useEnsurePlanningSession,
  usePatchPlanningSession,
  useValidateDistrictWorkforceData,
  useWorkforceEntityList,
} from '@/hooks/useWorkforceSuccession';
import { generateWorkforceDocumentationPack } from '@/services/workforceSuccessionService';
import type { WorkforceEntityType } from '@/services/workforceSuccessionService';

const DONT_SHOW_KEY = 'aquasafe.workforce-succession-wizard.dontShow';

export const WORKFORCE_WIZARD_EVENT = 'workforce-wizard-action';

export interface WorkforceWizardActionEvent {
  actionId: string;
}

const WIZARD_STEPS = COMPACT_FORM_WIZARD_STEPS;

const ENTITY_STEPS: Record<string, WorkforceEntityType | WorkforceEntityType[]> = {
  positions: 'positions',
  employees: 'employees',
  critical_functions: 'critical_functions',
  certifications: 'certifications',
  role_coverage: 'role_coverage',
  succession_candidates: 'succession_candidates',
  knowledge_artifacts: 'knowledge_artifacts',
  transition_milestones: 'transition_milestones',
};

export function isWizardDismissed(): boolean {
  try {
    return window.localStorage.getItem(DONT_SHOW_KEY) === '1';
  } catch {
    return false;
  }
}

export function setWizardDismissed(value: boolean) {
  try {
    if (value) {
      window.localStorage.setItem(DONT_SHOW_KEY, '1');
    } else {
      window.localStorage.removeItem(DONT_SHOW_KEY);
    }
  } catch {
    /* ignore */
  }
}

function dispatchWizardEvent(actionId: string) {
  window.dispatchEvent(
    new CustomEvent<WorkforceWizardActionEvent>(WORKFORCE_WIZARD_EVENT, {
      detail: { actionId },
    })
  );
}

interface WorkforceSuccessionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  districtCode: string;
  showDontShowAgain?: boolean;
  initialStepId?: string;
}

export const WorkforceSuccessionWizard: React.FC<WorkforceSuccessionWizardProps> = ({
  open,
  onOpenChange,
  districtCode,
  showDontShowAgain = true,
  initialStepId,
}) => {
  const { toast } = useToast();
  const validateMutation = useValidateDistrictWorkforceData();
  const ensureSession = useEnsurePlanningSession();
  const patchSession = usePatchPlanningSession();
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [dontShow, setDontShow] = useState(() => isWizardDismissed());
  const [setupMeta, setSetupMeta] = useState(emptyWizardSetupMeta);
  const [lastValidate, setLastValidate] = useState<Awaited<
    ReturnType<typeof validateMutation.mutateAsync>
  > | null>(null);
  const [generatingPack, setGeneratingPack] = useState(false);
  const [generatedPackCount, setGeneratedPackCount] = useState<number | null>(null);

  const updateSetupMeta = useCallback(
    (patch: Partial<WizardSetupMeta> | ((prev: WizardSetupMeta) => WizardSetupMeta)) => {
      setSetupMeta(prev => {
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
        saveWizardSetupMeta(districtCode, next);
        return next;
      });
    },
    [districtCode]
  );

  useEffect(() => {
    if (!open) return;
    setSetupMeta(loadWizardSetupMeta(districtCode));
    void ensureSession
      .mutateAsync({ district_code: districtCode })
      .then(res => setSessionId(res.session.id))
      .catch(() => {
        /* fallback to localStorage-only progress */
      });
  }, [open, districtCode]);

  const persistStepProgress = useCallback(
    (nextIndex: number) => {
      const nextStep = WIZARD_STEPS[nextIndex];
      if (!sessionId || !nextStep) return;
      const completed = WIZARD_STEPS.slice(0, nextIndex).map(s => s.id);
      void patchSession.mutateAsync({
        sessionId,
        body: {
          current_step: nextStep.id,
          completed_steps: completed,
          payload: { meta: setupMeta },
        },
      });
    },
    [patchSession, sessionId, setupMeta]
  );

  useEffect(() => {
    if (!open) return;
    const stepId = initialStepId ?? 'welcome';
    const idx = WIZARD_STEPS.findIndex(s => s.id === stepId);
    setStepIndex(idx >= 0 ? idx : 0);
    setLastValidate(null);
  }, [open, initialStepId, districtCode]);

  const step = WIZARD_STEPS[stepIndex];
  const totalSteps = WIZARD_STEPS.length;
  const progressPct = Math.round(((stepIndex + 1) / totalSteps) * 100);
  const isFirst = stepIndex === 0;

  const chatWelcome = useMemo(() => welcomeMessageForFormStep(step), [step]);
  const chatPreambleFn = useMemo(
    () => () =>
      chatPreambleForFormStep(step, districtCode, `district=${districtCode}, step=${step.id}`),
    [step, districtCode]
  );

  const goNext = () => {
    setStepIndex(i => {
      const next = Math.min(totalSteps - 1, i + 1);
      persistStepProgress(next);
      return next;
    });
  };
  const goPrev = () => {
    setStepIndex(i => {
      const next = Math.max(0, i - 1);
      persistStepProgress(next);
      return next;
    });
  };
  const goToStep = (index: number) => {
    setStepIndex(index);
    persistStepProgress(index);
  };

  const finishClose = () => {
    setWizardDismissed(dontShow);
    onOpenChange(false);
  };

  const runDataQualityCheck = async () => {
    try {
      const res = await validateMutation.mutateAsync(districtCode);
      setLastValidate(res);
      if (res.ok) {
        toast({ title: 'Data quality check passed' });
      } else {
        toast({
          title: 'Data quality issues found',
          description: `${res.issues.length} issue(s) — review below.`,
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: 'Check failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  const renderStepBody = () => {
    switch (step.id) {
      case 'welcome':
        return (
          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>{step.whatItMeans}</p>
            <ul className="list-disc pl-5 space-y-1">
              {step.whatYouNeed.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p className="text-gray-600">{step.whatAquaSafeDoes}</p>
          </div>
        );
      case 'setup':
        return (
          <div className="grid gap-4 max-w-lg">
            <div>
              <Label htmlFor="meta-contact-name">Primary contact name</Label>
              <Input
                id="meta-contact-name"
                value={setupMeta.contact_name}
                onChange={e => updateSetupMeta({ contact_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="meta-contact-email">Contact email</Label>
              <Input
                id="meta-contact-email"
                type="email"
                value={setupMeta.contact_email}
                onChange={e => updateSetupMeta({ contact_email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="meta-scope">Planning scope notes</Label>
              <Textarea
                id="meta-scope"
                rows={4}
                value={setupMeta.planning_scope_notes}
                onChange={e => updateSetupMeta({ planning_scope_notes: e.target.value })}
              />
            </div>
            <p className="text-xs text-gray-500">
              Contact notes sync to your planning session when available and are also cached in this
              browser for {districtCode}.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => dispatchWizardEvent('select-district')}
            >
              Focus district selector on page
            </Button>
          </div>
        );
      case 'express_setup':
        return (
          <WorkforceExpressSetup
            districtCode={districtCode}
            setupMeta={setupMeta}
            onSetupMetaChange={patch => updateSetupMeta(patch)}
          />
        );
      case 'review':
        return (
          <ReviewStep
            districtCode={districtCode}
            lastValidate={lastValidate}
            onRunCheck={() => void runDataQualityCheck()}
            checking={validateMutation.isPending}
          />
        );
      case 'generate_doc_pack':
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-950">
              <p className="font-medium mb-2">What you will get</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Workforce Continuity Assessment (from your positions & functions)</li>
                <li>Search committee packet, offer letter skeleton, transition roadmap</li>
                <li>Onboarding 30/60/90/180 plan and knowledge-transfer workplan</li>
                <li>DOH-352 renewal reference (export per operator from CEU & Training)</li>
              </ul>
              <p className="mt-3 text-indigo-900/80">
                Documents are saved to <strong>Document Studio → Workforce Continuity</strong> as
                drafts. They stay on AquaSafe until you transfer custody to district or NYS
                organization storage with a signed acknowledgment.
              </p>
            </div>
            {generatedPackCount != null && (
              <p className="text-sm text-green-700">
                Generated or updated {generatedPackCount} document(s). Open Document Studio to
                review and edit.
              </p>
            )}
            <Button
              type="button"
              disabled={generatingPack}
              onClick={async () => {
                setGeneratingPack(true);
                try {
                  const result = await generateWorkforceDocumentationPack(districtCode, {
                    pack_type: 'succession_binder',
                    use_live_data: true,
                  });
                  setGeneratedPackCount(result.document_count);
                  toast({
                    title: 'Succession Binder ready',
                    description: `${result.document_count} document(s) in Document Studio → Workforce & succession`,
                  });
                } catch (e) {
                  toast({
                    title: 'Generation failed',
                    description: e instanceof Error ? e.message : String(e),
                    variant: 'destructive',
                  });
                } finally {
                  setGeneratingPack(false);
                }
              }}
            >
              {generatingPack ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                'Generate documentation pack'
              )}
            </Button>
          </div>
        );
      case 'ceu_baseline':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Click an operator name to record CEUs and attach vouchers. Progress reflects employees
              and certifications entered in earlier steps.
            </p>
            <WorkforceCeuArea districtCode={districtCode} />
          </div>
        );
      default: {
        const mapping = ENTITY_STEPS[step.id];
        if (!mapping) return null;
        const types = Array.isArray(mapping) ? mapping : [mapping];
        return (
          <div className="space-y-8">
            {types.map(entityType => (
              <WorkforceEntityArea
                key={entityType}
                districtCode={districtCode}
                entityType={entityType}
                compact
              />
            ))}
          </div>
        );
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col"
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Workforce succession planning wizard</DialogTitle>
        <DialogDescription className="sr-only">
          Enter workforce continuity data directly into live tables.
        </DialogDescription>

        <div className="border-b bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 text-white shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 shrink-0" />
              <div>
                <div className="text-base font-semibold">Workforce planning wizard</div>
                <div className="text-xs text-indigo-100">
                  {districtCode} · Step {stepIndex + 1} of {totalSteps}: {step.title}
                </div>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={`capitalize ${WORKFORCE_PHASE_COLORS[step.phase].badge}`}
            >
              {step.phase}
            </Badge>
          </div>
          <div className="mt-3">
            <Progress value={progressPct} className="h-2 bg-white/30" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[13rem_1fr] flex-1 min-h-0 overflow-hidden">
          <nav className="hidden md:block border-r bg-gray-50 overflow-y-auto shrink-0">
            <ol className="divide-y">
              {WIZARD_STEPS.map((s, i) => {
                const active = i === stepIndex;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => goToStep(i)}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? `bg-white border-l-4 font-medium ${WORKFORCE_PHASE_COLORS[s.phase].active}`
                          : 'hover:bg-white text-gray-700 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="truncate">{s.title}</div>
                      <div className="text-xs text-gray-500 truncate">{s.subtitle}</div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex flex-col min-h-0 overflow-hidden">
            <div
              className={`grid flex-1 min-h-0 overflow-hidden ${showChat ? 'grid-cols-1 lg:grid-cols-[1fr_20rem]' : 'grid-cols-1'}`}
            >
              <div className="overflow-y-auto p-6 space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{step.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{step.subtitle}</p>
                </div>

                {!['welcome', 'review', 'generate_doc_pack'].includes(step.id) && (
                  <section className="rounded-lg border bg-slate-50 p-4 space-y-3 text-sm">
                    <div>
                      <h3 className="font-semibold text-gray-800">What this step is for</h3>
                      <p className="text-gray-700 mt-1">{step.whatItMeans}</p>
                    </div>
                    {step.whatYouNeed.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-800">What you need</h4>
                        <ul className="list-disc pl-5 mt-1 space-y-0.5 text-gray-700">
                          {step.whatYouNeed.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-gray-600">
                      <span className="font-medium text-gray-700">AquaSafe: </span>
                      {step.whatAquaSafeDoes}
                    </p>
                  </section>
                )}

                <div>{renderStepBody()}</div>

                {!showChat && step.id !== 'review' && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 flex justify-between gap-2 items-start">
                    <p className="text-sm text-blue-900">
                      Need help wording a row or deciding what to enter?
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowChat(true)}
                    >
                      <HelpCircle className="mr-1 h-4 w-4" />
                      Ask AquaSafe
                    </Button>
                  </div>
                )}
              </div>

              {showChat && (
                <aside className="border-t lg:border-t-0 lg:border-l bg-white flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between border-b px-3 py-2 bg-gray-50 shrink-0">
                    <span className="text-sm font-medium text-gray-700">Ask AquaSafe</span>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setShowChat(false)}
                      aria-label="Close chat"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-[18rem] overflow-hidden">
                    <HelpChatbot
                      compact
                      welcomeMessage={chatWelcome}
                      placeholder="Ask about this step…"
                      suggestedPrompts={step.suggestedPrompts}
                      messagePreamble={chatPreambleFn}
                    />
                  </div>
                </aside>
              )}
            </div>

            <div className="border-t bg-white px-4 py-3 flex flex-wrap items-center gap-3 shrink-0">
              <Button type="button" variant="ghost" onClick={goPrev} disabled={isFirst}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              {showDontShowAgain && (
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={dontShow}
                    onChange={e => setDontShow(e.target.checked)}
                  />
                  Don&apos;t auto-open wizard tip again
                </label>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={finishClose}>
                  Done
                </Button>
                {!showChat && (
                  <Button type="button" variant="outline" onClick={() => setShowChat(true)}>
                    <HelpCircle className="mr-1 h-4 w-4" />
                    Chat
                  </Button>
                )}
                {stepIndex < totalSteps - 1 ? (
                  <Button type="button" onClick={goNext}>
                    Next
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function ReviewStep({
  districtCode,
  lastValidate,
  onRunCheck,
  checking,
}: {
  districtCode: string;
  lastValidate: {
    ok: boolean;
    issues: Array<Record<string, unknown>>;
  } | null;
  onRunCheck: () => void;
  checking: boolean;
}) {
  const positionsQ = useWorkforceEntityList(districtCode, 'positions', { record_status: 'active' });
  const employeesQ = useWorkforceEntityList(districtCode, 'employees', { record_status: 'active' });
  const functionsQ = useWorkforceEntityList(districtCode, 'critical_functions', {
    record_status: 'active',
  });
  const certsQ = useWorkforceEntityList(districtCode, 'certifications', {
    record_status: 'active',
  });
  const coverageQ = useWorkforceEntityList(districtCode, 'role_coverage', {
    record_status: 'active',
  });
  const successionQ = useWorkforceEntityList(districtCode, 'succession_candidates', {
    record_status: 'active',
  });
  const artifactsQ = useWorkforceEntityList(districtCode, 'knowledge_artifacts', {
    record_status: 'active',
  });
  const milestonesQ = useWorkforceEntityList(districtCode, 'transition_milestones', {
    record_status: 'active',
  });

  const counts: Array<{ label: string; total: number | string }> = [
    { label: 'positions', total: positionsQ.data?.length ?? '—' },
    { label: 'employees', total: employeesQ.data?.length ?? '—' },
    { label: 'critical functions', total: functionsQ.data?.length ?? '—' },
    { label: 'certifications', total: certsQ.data?.length ?? '—' },
    { label: 'role coverage', total: coverageQ.data?.length ?? '—' },
    { label: 'succession candidates', total: successionQ.data?.length ?? '—' },
    { label: 'knowledge artifacts', total: artifactsQ.data?.length ?? '—' },
    { label: 'transition milestones', total: milestonesQ.data?.length ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Your entries are saved live as you add them. Use this summary to confirm coverage, then run
        an optional data-quality check.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map(({ label, total }) => (
          <div key={label} className="rounded-lg border p-3">
            <p className="text-xs text-gray-500 capitalize">{label}</p>
            <p className="text-2xl font-semibold">{total}</p>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" onClick={onRunCheck} disabled={checking}>
        {checking ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking…
          </>
        ) : (
          'Run data quality check'
        )}
      </Button>
      {lastValidate && (
        <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
          <div className="font-medium mb-2">
            {lastValidate.ok ? 'All checks passed' : 'Issues found'}
          </div>
          {lastValidate.issues.length > 0 && (
            <ul className="max-h-48 overflow-auto list-disc pl-5 space-y-1">
              {lastValidate.issues.slice(0, 40).map((issue, idx) => (
                <li key={idx}>
                  {(issue.entity_type as string) || 'row'} row {(issue.row_index as number) ?? '?'}:{' '}
                  {String(issue.message)}
                  {issue.field ? ` (${issue.field})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkforceSuccessionWizard;
