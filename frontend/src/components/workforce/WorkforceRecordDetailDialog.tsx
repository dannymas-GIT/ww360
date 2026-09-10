/**
 * Read-only detail dialog for any workforce entity row, with related records
 * and internal navigation stack.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  WorkforceEntityDialogFooterBar,
  WorkforceEntityDialogHeader,
} from '@/components/workforce/WorkforceEntityDialogShell';
import { DocViewerEmbed } from '@/components/doc-studio/DocViewerEmbed';
import {
  WORKFORCE_ENTITY_DETAIL_GRID_CLASS,
  WORKFORCE_ENTITY_DIALOG_MAX_WIDTH,
  workforceDetailFieldCardClass,
  workforceEntityChrome,
} from '@/components/workforce/workforceEntityDialogChrome';
import {
  CeuProgressBadge,
  CeuProgressBar,
  GradeBadge,
} from '@/components/workforce/workforceBadges';
import {
  ENTITY_SINGULAR_LABEL,
  buildRelatedSections,
  getFieldEntries,
  getFlowCopy,
  getRecordTitle,
  type WorkforceRow,
} from '@/components/workforce/workforceRecordDetailUtils';
import { useCeuSummary, useWorkforceEntityList } from '@/hooks/useWorkforceSuccession';
import type { WorkforceEntityType } from '@/services/workforceSuccessionService';

type StackEntry = { entityType: WorkforceEntityType; record: WorkforceRow };

export interface WorkforceRecordDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  districtCode: string;
  entityType: WorkforceEntityType;
  record: WorkforceRow | null;
  canManage?: boolean;
  onEdit?: (entityType: WorkforceEntityType, row: WorkforceRow) => void;
  onOpenCeuDialog?: (employeeCode: string, employeeName: string) => void;
}

export function WorkforceRecordDetailDialog({
  open,
  onOpenChange,
  districtCode,
  entityType,
  record,
  canManage = false,
  onEdit,
  onOpenCeuDialog,
}: WorkforceRecordDetailDialogProps) {
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (open && record) {
      setStack([{ entityType, record }]);
      setShowEmptyFields(false);
      setAboutOpen(false);
    }
  }, [open, entityType, record]);

  const current = stack[stack.length - 1];
  const activeType = current?.entityType ?? entityType;
  const activeRecord = current?.record ?? record;

  const positionsQ = useWorkforceEntityList(open ? districtCode : undefined, 'positions', {
    record_status: 'active',
  });
  const employeesQ = useWorkforceEntityList(open ? districtCode : undefined, 'employees', {
    record_status: 'active',
  });
  const certsQ = useWorkforceEntityList(open ? districtCode : undefined, 'certifications', {
    record_status: 'active',
  });
  const functionsQ = useWorkforceEntityList(open ? districtCode : undefined, 'critical_functions', {
    record_status: 'active',
  });
  const coverageQ = useWorkforceEntityList(open ? districtCode : undefined, 'role_coverage', {
    record_status: 'active',
  });
  const successionQ = useWorkforceEntityList(
    open ? districtCode : undefined,
    'succession_candidates',
    { record_status: 'active' }
  );
  const knowledgeQ = useWorkforceEntityList(
    open ? districtCode : undefined,
    'knowledge_artifacts',
    {
      record_status: 'active',
    }
  );
  const milestonesQ = useWorkforceEntityList(
    open ? districtCode : undefined,
    'transition_milestones',
    { record_status: 'active' }
  );
  const ceuSummaryQ = useCeuSummary(open ? districtCode : undefined);

  const lists = useMemo(
    () => ({
      positions: (positionsQ.data ?? []) as WorkforceRow[],
      employees: (employeesQ.data ?? []) as WorkforceRow[],
      certifications: (certsQ.data ?? []) as WorkforceRow[],
      critical_functions: (functionsQ.data ?? []) as WorkforceRow[],
      role_coverage: (coverageQ.data ?? []) as WorkforceRow[],
      succession_candidates: (successionQ.data ?? []) as WorkforceRow[],
      knowledge_artifacts: (knowledgeQ.data ?? []) as WorkforceRow[],
      transition_milestones: (milestonesQ.data ?? []) as WorkforceRow[],
    }),
    [
      positionsQ.data,
      employeesQ.data,
      certsQ.data,
      functionsQ.data,
      coverageQ.data,
      successionQ.data,
      knowledgeQ.data,
      milestonesQ.data,
    ]
  );

  const refRowsBySource = useMemo(
    () => ({
      positions: lists.positions,
      employees: lists.employees,
      critical_functions: lists.critical_functions,
    }),
    [lists.positions, lists.employees, lists.critical_functions]
  );

  if (!activeRecord) return null;

  const flowCopy = getFlowCopy(activeType);
  const { theme } = workforceEntityChrome(activeType);
  const title = getRecordTitle(activeType, activeRecord, refRowsBySource);
  const fieldEntries = getFieldEntries(activeType, activeRecord, refRowsBySource, showEmptyFields);
  const relatedSections = buildRelatedSections(activeType, activeRecord, lists, refRowsBySource);

  const employeeCode =
    activeType === 'employees'
      ? String(activeRecord.employee_code ?? '')
      : String(activeRecord.employee_code ?? activeRecord.source_employee_code ?? '');
  const ceuOperator =
    activeType === 'employees' && employeeCode
      ? ceuSummaryQ.data?.operators.find(o => o.employee_code === employeeCode)
      : undefined;

  const navigateRelated = (type: WorkforceEntityType, row: WorkforceRow) => {
    setStack(prev => [...prev, { entityType: type, record: row }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto p-0 gap-0 ${WORKFORCE_ENTITY_DIALOG_MAX_WIDTH}`}
      >
        <WorkforceEntityDialogHeader
          entityType={activeType}
          title={title}
          description={
            <>
              {ENTITY_SINGULAR_LABEL[activeType]}
              {activeRecord.record_status ? (
                <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                  {String(activeRecord.record_status)}
                </Badge>
              ) : null}
            </>
          }
          headerPrefix={
            stack.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-2 h-8 w-fit gap-1 px-2 text-xs"
                onClick={() => setStack(prev => prev.slice(0, -1))}
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back
              </Button>
            ) : null
          }
        />

        <div className={`space-y-4 px-6 py-4 ${theme.bodyBg}`}>
          <Collapsible open={aboutOpen} onOpenChange={setAboutOpen}>
            <CollapsibleTrigger
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm font-medium ${theme.aboutTrigger}`}
            >
              <span>About this area</span>
              {aboutOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent
              className={`mt-2 rounded-md border p-3 text-sm text-gray-700 ${theme.aboutContent}`}
            >
              <p>{flowCopy.plainLanguage}</p>
              <p className="mt-2 text-xs text-gray-600">{flowCopy.whyItMatters}</p>
            </CollapsibleContent>
          </Collapsible>

          {activeType === 'employees' && activeRecord.operator_grade ? (
            <div className="flex flex-wrap items-center gap-2">
              <GradeBadge grade={String(activeRecord.operator_grade)} />
            </div>
          ) : null}

          {ceuOperator ? (
            <section className="rounded-lg border border-green-100 bg-green-50/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-green-900">CEU renewal progress</p>
                <CeuProgressBadge
                  percentComplete={ceuOperator.percent_complete}
                  isShortfall={ceuOperator.is_shortfall}
                  daysUntilCycleEnd={ceuOperator.days_until_cycle_end}
                />
              </div>
              <CeuProgressBar
                percentComplete={ceuOperator.percent_complete}
                isShortfall={ceuOperator.is_shortfall}
                daysUntilCycleEnd={ceuOperator.days_until_cycle_end}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-green-800">
                {ceuOperator.earned_hours} / {ceuOperator.required_hours} CEUs in current cycle
              </p>
              {onOpenCeuDialog && employeeCode ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-8 text-xs"
                  onClick={() =>
                    onOpenCeuDialog(employeeCode, String(activeRecord.full_name ?? employeeCode))
                  }
                >
                  View CEU records
                </Button>
              ) : null}
            </section>
          ) : null}

          <section>
            <div
              className={`mb-2 flex items-center justify-between border-b pb-2 ${theme.sectionAccent}`}
            >
              <h3 className="text-sm font-semibold">Record details</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowEmptyFields(v => !v)}
              >
                {showEmptyFields ? 'Hide empty fields' : 'Show empty fields'}
              </Button>
            </div>
            <dl className={WORKFORCE_ENTITY_DETAIL_GRID_CLASS}>
              {fieldEntries.map(({ field, label, value }) => (
                <div key={field} className={workforceDetailFieldCardClass(activeType, field)}>
                  <dt
                    className={`text-[11px] font-medium uppercase tracking-wide ${theme.fieldLabel}`}
                  >
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-sm text-gray-900 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {activeType === 'knowledge_artifacts' && activeRecord.document_id ? (
            <section>
              <h3 className={`mb-2 border-b pb-2 text-sm font-semibold ${theme.sectionAccent}`}>
                Linked document
              </h3>
              <DocViewerEmbed
                documentId={String(activeRecord.document_id)}
                districtCode={districtCode}
                compact
              />
            </section>
          ) : null}

          {relatedSections.map(section => (
            <section key={section.title}>
              <h3 className={`mb-2 border-b pb-2 text-sm font-semibold ${theme.sectionAccent}`}>
                {section.title}
              </h3>
              <ul className="space-y-1">
                {section.links.map(link => (
                  <li key={`${link.entityType}-${String(link.row.id)}`}>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm ${theme.relatedHover}`}
                      onClick={() => navigateRelated(link.entityType, link.row)}
                    >
                      <span className="font-medium text-gray-900">{link.label}</span>
                      {link.sublabel ? (
                        <span className="text-xs text-gray-500">{link.sublabel}</span>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <WorkforceEntityDialogFooterBar entityType={activeType}>
          {canManage && onEdit ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onEdit(activeType, activeRecord)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className={theme.primaryButton}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </WorkforceEntityDialogFooterBar>
      </DialogContent>
    </Dialog>
  );
}
