import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildWorkforceTabPath,
  type WorkforceContinuityTab,
} from '@/components/workforce/workforceContinuityTabs';
import axios from 'axios';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { useAuth } from '@/context/AuthContext';
import {
  ENTITY_FORM_COLUMNS,
  ENTITY_INTEGER_FIELDS,
  buildFieldValueOptions,
  buildRefOptions,
  displayColumnsForEntity,
  enumOptionsFor,
  formatEntityCellValue,
  hasAllRequiredFields,
  isBooleanField,
  isDateField,
  isNullableBooleanField,
  isRequiredField,
  labelForField,
  labeledEnumOptionsFor,
  referenceFor,
  referencedSources,
  shouldUsePriorValueSelect,
  toDateInputValue,
  type ReferenceSource,
} from '@/components/workforce/workforcePlanningFormModel';
import {
  formFromSample,
  samplesByPathway,
  samplesForEntity,
  type SampleTemplateRow,
} from '@/components/workforce/workforceSampleTemplates';
import {
  WorkforceDateField,
  WorkforceFieldLabel,
  WorkforcePriorOrCustomField,
  WorkforceSelectField,
} from '@/components/workforce/WorkforceFormControls';
import { WorkforceEntityGuidanceCard } from '@/components/workforce/WorkforceEntityGuidanceCard';
import {
  WorkforceEntityDialogShell,
  WorkforceEntityFormGrid,
  WorkforceFormRequiredNote,
} from '@/components/workforce/WorkforceEntityDialogShell';
import {
  workforceFormFieldShellClass,
  WORKFORCE_FORM_MULTILINE_FIELDS,
  workforceEntityChrome,
} from '@/components/workforce/workforceEntityDialogChrome';
import { WorkforceRecordDetailDialog } from '@/components/workforce/WorkforceRecordDetailDialog';
import { WorkforceSampleTemplateCard } from '@/components/workforce/WorkforceSampleTemplateCard';
import { WORKFORCE_PATHWAY_ICONS } from '@/components/workforce/workforcePathwayIcons';
import { WORKFORCE_PATHWAY_THEMES } from '@/components/workforce/workforcePathwayThemes';
import {
  ENTITY_SINGULAR_LABEL,
  ENTITY_TO_TAB,
  getFlowCopy,
} from '@/components/workforce/workforceRecordDetailUtils';
import {
  useCreateWorkforceEntity,
  useCeuSummary,
  useDeleteWorkforceEntity,
  useUpdateWorkforceEntity,
  useWorkforceEntityList,
} from '@/hooks/useWorkforceSuccession';
import type {
  WorkforceEntityType,
  WorkforceListFilters,
} from '@/services/workforceSuccessionService';

const ENTITY_LABELS: Record<WorkforceEntityType, string> = {
  positions: 'Positions',
  employees: 'Employees',
  certifications: 'Certifications',
  critical_functions: 'Critical functions',
  role_coverage: 'Role coverage',
  succession_candidates: 'Succession candidates',
  knowledge_artifacts: 'Knowledge artifacts',
  transition_milestones: 'Transition milestones',
};

const WORKFORCE_MANAGER_ROLES = new Set([
  'district_admin',
  'district_manager',
  'ceu_admin',
  'ceu_manager',
  'global_admin',
  'system_admin',
]);

function formatWorkforceSaveError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const detail = err.response?.data?.detail;
    const detailText =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail
              .map(item =>
                typeof item === 'object' && item && 'msg' in item
                  ? String((item as { msg: unknown }).msg)
                  : String(item)
              )
              .join(' ')
          : null;
    if (status === 401) {
      return 'Your session expired or is invalid. Sign out and sign in again, then retry.';
    }
    if (status === 403) {
      return (
        detailText ??
        'You do not have permission to edit workforce data. A district admin or manager role is required.'
      );
    }
    if (detailText) return detailText;
    if (status) return `Request failed (${status})`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function canManageWorkforce(
  userRoles: string[],
  isGlobalAdmin: boolean,
  isSystemAdmin: boolean
): boolean {
  if (isGlobalAdmin || isSystemAdmin) return true;
  return userRoles.some(role => WORKFORCE_MANAGER_ROLES.has(role));
}

type Row = Record<string, unknown>;

interface Props {
  districtCode: string;
  entityType: WorkforceEntityType;
  extraFilters?: React.ReactNode;
  listFilterOverrides?: Partial<WorkforceListFilters>;
  /** Hide search/filter toolbar (e.g. embedded in wizard step). */
  compact?: boolean;
  /** Show display-only sample templates above the entity table. */
  showSampleTemplates?: boolean;
  onOpenTour?: (tab?: WorkforceContinuityTab) => void;
  onOpenCeuDialog?: (employeeCode: string, employeeName: string) => void;
}

export function WorkforceEntityArea({
  districtCode,
  entityType,
  extraFilters,
  listFilterOverrides,
  compact = false,
  showSampleTemplates = false,
  onOpenTour,
  onOpenCeuDialog,
}: Props) {
  const { toast } = useToast();
  const { userRoles, isGlobalAdmin, isSystemAdmin } = useAuth();
  const canManage = canManageWorkforce(userRoles, isGlobalAdmin, isSystemAdmin);
  const [q, setQ] = useState('');
  const [recordStatus, setRecordStatus] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<Row | null>(null);
  const recordsRef = useRef<HTMLElement>(null);

  const filters = useMemo(
    () => ({
      q: q || undefined,
      record_status: recordStatus === 'all' ? undefined : recordStatus,
      ...listFilterOverrides,
    }),
    [q, recordStatus, listFilterOverrides]
  );

  const listQuery = useWorkforceEntityList(districtCode, entityType, filters);
  const createMutation = useCreateWorkforceEntity(entityType);
  const updateMutation = useUpdateWorkforceEntity(entityType);
  const deleteMutation = useDeleteWorkforceEntity(entityType);

  const columns = ENTITY_FORM_COLUMNS[entityType] ?? [];
  const displayColumns = displayColumnsForEntity(entityType);

  // Source entities for any reference dropdowns this entity needs. Each list is
  // fetched only when this entity actually references it (district required).
  const neededSources = useMemo(() => new Set(referencedSources(entityType)), [entityType]);
  const positionsRef = useWorkforceEntityList(
    neededSources.has('positions') ? districtCode : undefined,
    'positions',
    { record_status: 'active' }
  );
  const employeesRef = useWorkforceEntityList(
    neededSources.has('employees') ? districtCode : undefined,
    'employees',
    { record_status: 'active' }
  );
  const functionsRef = useWorkforceEntityList(
    neededSources.has('critical_functions') ? districtCode : undefined,
    'critical_functions',
    { record_status: 'active' }
  );
  const knowledgeRef = useWorkforceEntityList(
    entityType === 'role_coverage' ? districtCode : undefined,
    'knowledge_artifacts',
    { record_status: 'active' }
  );
  const ceuSummaryQuery = useCeuSummary(
    entityType === 'succession_candidates' ? districtCode : undefined
  );
  const refRowsBySource: Record<ReferenceSource, Record<string, unknown>[]> = {
    positions: positionsRef.data ?? [],
    employees: employeesRef.data ?? [],
    critical_functions: functionsRef.data ?? [],
  };
  const publishedRows = (listQuery.data ?? []) as Row[];
  const displayRows = useMemo(
    () => [...publishedRows].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)),
    [publishedRows]
  );
  const sampleTemplates = showSampleTemplates && !compact ? samplesForEntity(entityType) : [];
  const dialogTheme = workforceEntityChrome(entityType).theme;

  const crossTabHint = useMemo(() => {
    if (entityType === 'role_coverage') {
      const fnCodes = new Set(
        (functionsRef.data ?? []).map(r => String(r.function_code ?? '')).filter(Boolean)
      );
      const covered = new Set(
        (knowledgeRef.data ?? [])
          .map(r => String(r.critical_function_code ?? r.function_code ?? ''))
          .filter(Boolean)
      );
      const missing = [...fnCodes].filter(code => !covered.has(code)).length;
      if (missing > 0) {
        return (
          <>
            {missing} critical function(s) have no knowledge artifact captured.{' '}
            <Link to={buildWorkforceTabPath('knowledge')} className="text-blue-700 underline">
              Add knowledge artifacts
            </Link>
          </>
        );
      }
    }
    if (
      entityType === 'succession_candidates' &&
      (ceuSummaryQuery.data?.total_shortfall ?? 0) > 0
    ) {
      return (
        <>
          {ceuSummaryQuery.data?.total_shortfall} operator(s) are in CEU shortfall — review license
          readiness alongside succession candidates on the{' '}
          <Link to={buildWorkforceTabPath('ceu')} className="text-blue-700 underline">
            CEUs tab
          </Link>
          .
        </>
      );
    }
    if (entityType === 'transition_milestones') {
      return (
        <>
          Tag milestones with Plan / Hire / Transition / Sustain using the milestone type field.
          Group by phase when reviewing the{' '}
          <Link to={buildWorkforceTabPath('dashboard')} className="text-blue-700 underline">
            dashboard
          </Link>
          .
        </>
      );
    }
    return null;
  }, [entityType, functionsRef.data, knowledgeRef.data, ceuSummaryQuery.data?.total_shortfall]);

  const openCreate = () => {
    const empty: Record<string, string> = {};
    for (const c of columns) empty[c] = '';
    setForm(empty);
    setEditing(null);
    setDrawerOpen(true);
  };

  const openFromSample = (sample: SampleTemplateRow) => {
    setForm(formFromSample(sample, columns));
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (row: Row) => {
    const next: Record<string, string> = {};
    for (const c of columns) {
      const v = row[c];
      next[c] = v == null ? '' : String(v);
    }
    setForm(next);
    setEditing(row);
    setDrawerOpen(true);
  };

  const openDetail = (row: Row) => {
    setDetailRecord(row);
    setDetailOpen(true);
  };

  const save = async () => {
    const payload: Record<string, unknown> = { district_code: districtCode };
    for (const [k, v] of Object.entries(form)) {
      if (isNullableBooleanField(entityType, k)) {
        payload[k] = v === '' ? null : v === 'true';
        continue;
      }
      if (v === '') continue;
      if (v === 'true' || v === 'false') payload[k] = v === 'true';
      else if (!Number.isNaN(Number(v)) && ENTITY_INTEGER_FIELDS.has(k)) payload[k] = Number(v);
      else payload[k] = v;
    }
    try {
      if (editing?.id) {
        await updateMutation.mutateAsync({
          id: Number(editing.id),
          districtCode,
          body: payload,
        });
        toast({ title: 'Updated' });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Created' });
      }
      setDrawerOpen(false);
      requestAnimationFrame(() => {
        recordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: formatWorkforceSaveError(err),
        variant: 'destructive',
      });
    }
  };

  const remove = async (row: Row) => {
    if (!row.id) return;
    if (!window.confirm('Archive this record?')) return;
    try {
      await deleteMutation.mutateAsync({ id: Number(row.id), districtCode });
      toast({ title: 'Archived' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: formatWorkforceSaveError(err),
        variant: 'destructive',
      });
    }
  };

  const showGuidance = !compact && (!showSampleTemplates || displayRows.length === 0);
  const guidanceVariant = displayRows.length === 0 ? 'empty' : 'intro';

  const sampleTemplatesSection =
    sampleTemplates.length > 0 ? (
      <details open={displayRows.length === 0} className="order-2 border-t border-slate-200 pt-6">
        <summary className="cursor-pointer text-sm font-medium text-gray-900">
          Sample templates ({sampleTemplates.length} examples)
        </summary>
        <p className="mt-3 text-xs text-amber-900/80">
          Real-world scenarios to spur planning — not saved to your district. Use a template to
          pre-fill the add form, then pick your employees and positions.
        </p>
        <div className="mt-3 space-y-5">
          {samplesByPathway(sampleTemplates).map(({ pathway, samples }) => {
            const PathwayIcon = WORKFORCE_PATHWAY_ICONS[pathway.id];
            const theme = WORKFORCE_PATHWAY_THEMES[pathway.id];
            return (
              <section key={pathway.id} aria-label={pathway.title} className="space-y-3">
                <div
                  className={`rounded-lg border p-3 ${theme.sectionBorder} ${theme.sectionHeader}`}
                >
                  <h4
                    className={`flex items-center gap-2 text-sm font-semibold ${theme.sectionTitle}`}
                  >
                    <PathwayIcon className="h-4 w-4 shrink-0" aria-hidden />
                    {pathway.title}
                  </h4>
                  <p className={`mt-0.5 text-xs ${theme.sectionBody}`}>{pathway.scenario}</p>
                  <p className={`mt-1.5 text-xs font-medium italic ${theme.sectionBody}`}>
                    Ask yourself: {pathway.prompt}
                  </p>
                </div>
                <div className="space-y-2">
                  {samples.map(sample => (
                    <WorkforceSampleTemplateCard
                      key={sample.label}
                      entityType={entityType}
                      sample={sample}
                      canManage={canManage}
                      onUse={() => openFromSample(sample)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </details>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {showGuidance ? (
        <WorkforceEntityGuidanceCard
          entityType={entityType}
          variant={guidanceVariant}
          {...(onOpenTour
            ? { onOpenTour: () => onOpenTour(ENTITY_TO_TAB[entityType]) }
            : {})}
        />
      ) : null}

      {crossTabHint && !compact ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {crossTabHint}
        </div>
      ) : null}

      {!canManage && !compact ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          View-only access — saving from sample templates requires a district admin or manager role.
        </div>
      ) : null}

      <section ref={recordsRef} className="order-1 space-y-4" aria-label="District records">
        {!compact && showSampleTemplates ? (
          <h3 className="text-sm font-medium text-gray-900">Your district records</h3>
        ) : null}

        {!compact ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label className="text-xs font-medium text-gray-600">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-8"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder={`Search ${ENTITY_LABELS[entityType].toLowerCase()}…`}
                />
              </div>
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-gray-600">Status</label>
              <Select value={recordStatus} onValueChange={setRecordStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Active (default)</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="staged">Staged</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {extraFilters}
            <Button onClick={openCreate} disabled={!canManage}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button onClick={openCreate} size="sm" disabled={!canManage}>
              <Plus className="mr-1 h-4 w-4" /> Add row
            </Button>
          </div>
        )}

        {listQuery.isLoading ? (
          <div className="space-y-2 rounded-md border p-4">
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
          </div>
        ) : listQuery.isError ? (
          <p className="text-sm text-red-600">
            Failed to load {ENTITY_LABELS[entityType].toLowerCase()}:{' '}
            {(listQuery.error as Error).message}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  {displayColumns.map(c => (
                    <TableHead key={c}>{labelForField(c)}</TableHead>
                  ))}
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.length === 0 && !listQuery.isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={displayColumns.length + 1}
                      className="py-10 text-center text-sm text-gray-500"
                    >
                      {showSampleTemplates
                        ? 'Add a row with the button above, pick a sample template below, or use the guided setup wizard.'
                        : 'Add a row with the button above, use the guided setup wizard, or enable sample templates on the Import tab.'}
                    </TableCell>
                  </TableRow>
                )}
                {displayRows.map((row: Row) => (
                  <TableRow
                    key={String(row.id)}
                    className="cursor-pointer hover:bg-slate-50"
                    tabIndex={0}
                    role="button"
                    aria-label={`View ${ENTITY_LABELS[entityType].slice(0, -1)} details`}
                    onClick={() => openDetail(row)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetail(row);
                      }
                    }}
                  >
                    {displayColumns.map(c => {
                      const display = formatEntityCellValue(entityType, c, row, refRowsBySource);
                      return (
                        <TableCell key={c} className="max-w-[10rem] truncate" title={display}>
                          {display}
                        </TableCell>
                      );
                    })}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title={`View ${ENTITY_SINGULAR_LABEL[entityType]} details`}
                          onClick={e => {
                            e.stopPropagation();
                            openDetail(row);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">View details</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            void remove(row);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {sampleTemplatesSection}

      <WorkforceEntityDialogShell
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        entityType={entityType}
        title={`${editing ? 'Edit' : 'Add'} ${ENTITY_SINGULAR_LABEL[entityType]}`}
        description={getFlowCopy(entityType).plainLanguage}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              className={dialogTheme.primaryButton}
              disabled={
                !canManage ||
                createMutation.isPending ||
                updateMutation.isPending ||
                !hasAllRequiredFields(entityType, form)
              }
            >
              Save
            </Button>
          </>
        }
      >
        <WorkforceEntityFormGrid>
          <div className="md:col-span-2">
            <WorkforceFormRequiredNote entityType={entityType} />
          </div>
          {columns.map(c => {
            const required = isRequiredField(entityType, c);
            const ref = referenceFor(entityType, c);
            const labeledEnum = labeledEnumOptionsFor(entityType, c);
            const enumOrBool =
              labeledEnum ??
              enumOptionsFor(entityType, c)?.map(opt => ({ value: opt, label: opt })) ??
              (isNullableBooleanField(entityType, c)
                ? [
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                  ]
                : isBooleanField(entityType, c)
                  ? ['true', 'false'].map(v => ({ value: v, label: v }))
                  : undefined);
            const fieldId = `${entityType}-${c}`;
            const isMultiline = WORKFORCE_FORM_MULTILINE_FIELDS.has(c);

            if (ref) {
              const refOptions = buildRefOptions(refRowsBySource[ref.source], ref);
              const current = form[c] ?? '';
              const currentMissing = current !== '' && !refOptions.some(o => o.value === current);
              const sourceLabel = ref.source.replace(/_/g, ' ');
              const options =
                currentMissing && current
                  ? [...refOptions, { value: current, label: `${current} (current)` }]
                  : refOptions;
              return (
                <div key={c} className={workforceFormFieldShellClass(entityType, c)}>
                  <WorkforceFieldLabel
                    htmlFor={fieldId}
                    label={labelForField(c)}
                    required={required}
                  />
                  <WorkforceSelectField
                    id={fieldId}
                    value={current}
                    disabled={options.length === 0 && !current}
                    placeholder={required ? 'Select…' : '— none —'}
                    emptyLabel={required ? 'Select…' : '— none —'}
                    allowEmpty={!required}
                    onChange={next => setForm(prev => ({ ...prev, [c]: next }))}
                    options={options}
                  />
                  {refOptions.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      No {sourceLabel} in this district yet — add {sourceLabel} first.
                    </p>
                  )}
                </div>
              );
            }

            if (enumOrBool) {
              return (
                <div key={c} className={workforceFormFieldShellClass(entityType, c)}>
                  <WorkforceFieldLabel
                    htmlFor={fieldId}
                    label={labelForField(c)}
                    required={required}
                  />
                  <WorkforceSelectField
                    id={fieldId}
                    value={form[c] ?? ''}
                    placeholder={required ? 'Select…' : '—'}
                    emptyLabel={
                      isNullableBooleanField(entityType, c)
                        ? '— unset —'
                        : required
                          ? 'Select…'
                          : '—'
                    }
                    allowEmpty={!required || isNullableBooleanField(entityType, c)}
                    onChange={next => setForm(prev => ({ ...prev, [c]: next }))}
                    options={enumOrBool}
                  />
                </div>
              );
            }

            if (isDateField(entityType, c)) {
              return (
                <div key={c} className={workforceFormFieldShellClass(entityType, c)}>
                  <WorkforceFieldLabel
                    htmlFor={fieldId}
                    label={labelForField(c)}
                    required={required}
                  />
                  <WorkforceDateField
                    id={fieldId}
                    required={required}
                    value={toDateInputValue(form[c])}
                    onChange={next => setForm(prev => ({ ...prev, [c]: next }))}
                  />
                </div>
              );
            }

            if (shouldUsePriorValueSelect(entityType, c)) {
              const priorOptions = buildFieldValueOptions(publishedRows, c).map(o => o.value);
              return (
                <div key={c} className={workforceFormFieldShellClass(entityType, c)}>
                  <WorkforceFieldLabel
                    htmlFor={fieldId}
                    label={labelForField(c)}
                    required={required}
                  />
                  <WorkforcePriorOrCustomField
                    id={fieldId}
                    required={required}
                    value={form[c] ?? ''}
                    options={priorOptions}
                    onChange={next => setForm(prev => ({ ...prev, [c]: next }))}
                  />
                </div>
              );
            }

            return (
              <div key={c} className={workforceFormFieldShellClass(entityType, c)}>
                <WorkforceFieldLabel
                  htmlFor={fieldId}
                  label={labelForField(c)}
                  required={required}
                />
                {isMultiline ? (
                  <Textarea
                    id={fieldId}
                    className="mt-1 min-h-[4.5rem] resize-y"
                    aria-required={required}
                    value={form[c] ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, [c]: e.target.value }))}
                  />
                ) : (
                  <Input
                    id={fieldId}
                    className="mt-1"
                    aria-required={required}
                    value={form[c] ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, [c]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}
        </WorkforceEntityFormGrid>
      </WorkforceEntityDialogShell>

      {!compact ? (
        <WorkforceRecordDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          districtCode={districtCode}
          entityType={entityType}
          record={detailRecord}
          canManage={canManage}
          onEdit={(_type, row) => {
            setDetailOpen(false);
            openEdit(row);
          }}
          {...(onOpenCeuDialog ? { onOpenCeuDialog } : {})}
        />
      ) : null}
    </div>
  );
}
