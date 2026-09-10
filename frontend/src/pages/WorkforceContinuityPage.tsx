import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileWarning,
  Info,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Upload,
  CircleHelp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkforceBenchBoard } from '@/components/workforce/WorkforceBenchBoard';
import { ResponsiveTabsList } from '@/components/ui/responsive-tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WorkforceCeuArea } from '@/components/workforce/WorkforceCeuArea';
import {
  WorkforceEmployeeCeuDialog,
  type EmployeeCeuDialogMode,
} from '@/components/workforce/WorkforceEmployeeCeuDialog';
import { WorkforceCeuRequirementsPanel } from '@/components/workforce/WorkforceCeuRequirementsPanel';
import { WorkforceScheduledTrainingArea } from '@/components/workforce/WorkforceScheduledTrainingArea';
import { WorkforceMyTrainingSignupsArea } from '@/components/workforce/WorkforceMyTrainingSignupsArea';
import { WorkforceTrainingArea } from '@/components/workforce/WorkforceTrainingArea';
import { WorkforceBinderHub } from '@/components/workforce/WorkforceBinderHub';
import { WorkforceBinderSetupDialog } from '@/components/workforce/WorkforceBinderSetupDialog';
import { BinderIntakeWizard } from '@/components/workforce/binderIntake/BinderIntakeWizard';
import { WorkforceLicenseHealthStrip } from '@/components/workforce/WorkforceLicenseHealthStrip';
import { WorkforceEntityArea } from '@/components/workforce/WorkforceEntityArea';
import { WorkforceFlowOverviewDialog } from '@/components/workforce/WorkforceFlowOverviewDialog';
import { MultiDistrictOverviewTable } from '@/components/workforce/MultiDistrictOverviewTable';
import { WorkforceRecordDetailDialog } from '@/components/workforce/WorkforceRecordDetailDialog';
import { findRowByCode, findRowById } from '@/components/workforce/workforceRecordDetailUtils';
import {
  isNavigableFlowNode,
  type WorkforceFlowNodeId,
} from '@/components/workforce/workforceFlowModel';
import {
  buildCodeLabelMap,
  labelsForCodes,
} from '@/components/workforce/workforcePlanningFormModel';
import {
  loadShowSampleTemplates,
  saveShowSampleTemplates,
} from '@/components/workforce/workforceSampleTemplates';
import {
  WorkforceSuccessionWizard,
  WORKFORCE_WIZARD_EVENT,
  type WorkforceWizardActionEvent,
} from '@/components/workforce/WorkforceSuccessionWizard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  isWorkforceDistrictLocked,
  resolveWorkforceDistrictCode,
} from '@/components/dashboard/widgets/workforce/resolveWorkforceDistrictCode';
import { useAuth } from '@/context/AuthContext';
import { useImpersonation } from '@/context/ImpersonationContext';
import { useDistricts } from '@/hooks/useDistricts';
import {
  useCommitWorkforceImport,
  useCeuSummary,
  useDownloadCsvTemplate,
  useGenerateWorkforceDocPack,
  usePreviewWorkforceImport,
  useTriggerWorkforceAlertScan,
  useWorkforceBinder,
  useBinderIntakeSession,
  useWorkforceContinuity,
  useWorkforceEntityList,
  useWorkforceImportBatches,
  useWorkforcePlanningSession,
  useWorkforceScorecards,
  useSeedLearningStreamCourses,
} from '@/hooks/useWorkforceSuccession';
import type {
  CertificationCliffEntry,
  CriticalFunctionCoverage,
  ImportPreview,
  RetirementHorizonEntry,
  TransitionMilestoneSummary,
  WorkforceImportBatch,
  WorkforceEntityType,
  TrainingCourseFilters,
  WorkforceScheduledTraining,
  WorkforceCeuOperatorSummary,
} from '@/services/workforceSuccessionService';
import {
  buildWorkforceSearchParams,
  buildWorkforceTabPath,
  getLegacyWorkforceRedirect,
  getWorkspaceForPath,
  getWorkspaceForTab,
  parseTrainingSubTab,
  parseWorkforceTab,
  WORKFORCE_CONTINUITY_TABS,
  WORKFORCE_TAB_META,
  WORKFORCE_WORKSPACE_META,
  WORKFORCE_WORKSPACE_PATHS,
  type WorkforceContinuityTab,
  type WorkforceTrainingSubTab,
  type WorkforceWorkspace,
} from '@/components/workforce/workforceContinuityTabs';
import { WorkforceEmployeesHandoffCard } from '@/components/workforce/WorkforceWorkspaceSwitcher';
import {
  WorkforceTourOverlay,
  useWorkforceTourAutoOpen,
} from '@/components/workforce/tour/WorkforceTourOverlay';
import { requestOpenWorkforceTour } from '@/components/workforce/tour/workforceTourApi';
import { fetchDistrictConfig, type WorkforceAlertSettings, type WorkforceTrainingSettings } from '@/services/districtAdminService';
import { normalizeUtcIso } from '@/utils/districtTime';

const ENTITY_OPTIONS: { value: WorkforceEntityType; label: string }[] = [
  { value: 'positions', label: 'Positions' },
  { value: 'employees', label: 'Employees' },
  { value: 'certifications', label: 'Certifications' },
  { value: 'critical_functions', label: 'Critical functions' },
  { value: 'role_coverage', label: 'Role coverage' },
  { value: 'succession_candidates', label: 'Succession candidates' },
  { value: 'knowledge_artifacts', label: 'Knowledge artifacts' },
  { value: 'transition_milestones', label: 'Transition milestones' },
];

const RISK_COLOR: Record<string, string> = {
  ok: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  onClick,
  tooltip,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'warn' | 'danger' | 'good';
  onClick?: () => void;
  tooltip?: string;
}) {
  const toneClasses: Record<string, string> = {
    default: 'text-blue-600',
    warn: 'text-yellow-600',
    danger: 'text-red-600',
    good: 'text-green-600',
  };
  const card = (
    <Card
      className={
        onClick
          ? 'cursor-pointer transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-indigo-400'
          : undefined
      }
      onClick={onClick}
      onKeyDown={
        onClick
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[0.875rem] font-medium leading-snug text-slate-600">
              <span className="whitespace-normal">{label}</span>
              {tooltip ? <Info className="h-4 w-4 shrink-0 text-slate-400" aria-hidden /> : null}
            </div>
            <div className="mt-1.5 text-[1.5rem] font-semibold leading-tight text-slate-900 sm:text-[1.75rem]">
              {value}
            </div>
            {hint && (
              <div className="mt-1.5 text-[0.875rem] leading-snug text-slate-500">{hint}</div>
            )}
          </div>
          <Icon className={`mt-0.5 h-7 w-7 shrink-0 ${toneClasses[tone]}`} aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
  if (!tooltip) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-[0.875rem] leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function CoverageTable({
  rows,
  employeeNameByCode,
  onRowClick,
}: {
  rows: CriticalFunctionCoverage[];
  employeeNameByCode: Map<string, string>;
  onRowClick?: (row: CriticalFunctionCoverage) => void;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-gray-500">No critical functions defined yet for this district.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Function</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Primary</TableHead>
            <TableHead>Backups</TableHead>
            <TableHead>Trainees</TableHead>
            <TableHead>Risk</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow
              key={r.function_id}
              className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              <TableCell className="font-medium">{r.function_name}</TableCell>
              <TableCell>{r.function_area || '—'}</TableCell>
              <TableCell>{labelsForCodes(r.primary_employee_codes, employeeNameByCode)}</TableCell>
              <TableCell>{labelsForCodes(r.backup_employee_codes, employeeNameByCode)}</TableCell>
              <TableCell>{labelsForCodes(r.trainee_employee_codes, employeeNameByCode)}</TableCell>
              <TableCell>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${RISK_COLOR[r.risk_level]}`}
                >
                  {r.risk_level.toUpperCase()}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CertCliffTable({
  rows,
  onRowClick,
}: {
  rows: CertificationCliffEntry[];
  onRowClick?: (row: CertificationCliffEntry) => void;
}) {
  if (!rows.length) {
    return <p className="text-sm text-gray-500">No certifications expiring within 12 months.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Certification</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Days</TableHead>
            <TableHead>Required</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow
              key={r.certification_id}
              className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              <TableCell className="font-medium">{r.employee_name || '—'}</TableCell>
              <TableCell>
                {r.certification_type}
                {r.certification_grade ? ` (${r.certification_grade})` : ''}
              </TableCell>
              <TableCell>{r.expiration_date || '—'}</TableCell>
              <TableCell
                className={
                  r.days_until_expiration !== null && r.days_until_expiration <= 90
                    ? 'text-red-600 font-medium'
                    : ''
                }
              >
                {r.days_until_expiration ?? '—'}
              </TableCell>
              <TableCell>{r.is_required_for_role ? 'Yes' : 'No'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RetirementTable({
  rows,
  positionTitleByCode,
  onRowClick,
}: {
  rows: RetirementHorizonEntry[];
  positionTitleByCode: Map<string, string>;
  onRowClick?: (row: RetirementHorizonEntry) => void;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-gray-500">
        No employees within five years of retirement eligibility on file.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Eligible</TableHead>
            <TableHead>Months out</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow
              key={r.employee_id}
              className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              <TableCell className="font-medium">{r.employee_name}</TableCell>
              <TableCell>
                {r.position_code
                  ? (positionTitleByCode.get(r.position_code) ?? r.position_code)
                  : '—'}
              </TableCell>
              <TableCell>{r.retirement_eligible_date || '—'}</TableCell>
              <TableCell
                className={
                  r.months_until_eligible !== null && r.months_until_eligible <= 24
                    ? 'text-red-600 font-medium'
                    : ''
                }
              >
                {r.months_until_eligible ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MilestonesTable({
  rows,
  positionTitleByCode,
  onRowClick,
}: {
  rows: TransitionMilestoneSummary[];
  positionTitleByCode: Map<string, string>;
  onRowClick?: (row: TransitionMilestoneSummary) => void;
}) {
  if (!rows.length) {
    return <p className="text-sm text-gray-500">No upcoming transition milestones.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Position</TableHead>
            <TableHead>Milestone</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow
              key={r.milestone_id}
              className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              <TableCell className="font-medium">
                {positionTitleByCode.get(r.position_code) ?? r.position_code}
              </TableCell>
              <TableCell>
                <div>{r.title}</div>
                <div className="text-xs text-gray-500">{r.milestone_type}</div>
              </TableCell>
              <TableCell className="capitalize">{r.toolkit_phase}</TableCell>
              <TableCell className={r.is_overdue ? 'text-red-600 font-medium' : ''}>
                {r.target_date || '—'}
                {r.is_overdue ? ' (overdue)' : ''}
              </TableCell>
              <TableCell className="capitalize">{r.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ImportPanel({
  districtCode,
  showSampleTemplates,
  onShowSampleTemplatesChange,
}: {
  districtCode: string;
  showSampleTemplates: boolean;
  onShowSampleTemplatesChange: (on: boolean) => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [entityType, setEntityType] = useState<WorkforceEntityType>('positions');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const previewMutation = usePreviewWorkforceImport();
  const commitMutation = useCommitWorkforceImport();
  const downloadMutation = useDownloadCsvTemplate();

  const batchesQuery = useWorkforceImportBatches(districtCode);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    try {
      const p = await previewMutation.mutateAsync({
        entity_type: entityType,
        target_district: districtCode,
        file,
      });
      setPreview(p);
    } catch (err) {
      toast({
        title: 'Preview failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const onCommit = async () => {
    if (!pendingFile) return;
    try {
      const result = await commitMutation.mutateAsync({
        entity_type: entityType,
        target_district: districtCode,
        file: pendingFile,
      });
      toast({
        title: `Import ${result.status}`,
        description: `${result.rows_promoted} of ${result.total_rows} rows promoted.`,
      });
      setPreview(null);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const onDownloadTemplate = async () => {
    try {
      const csv = await downloadMutation.mutateAsync(entityType);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityType}_template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: 'Template download failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" /> Workforce intake
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-blue-100 bg-blue-50/80 p-3 text-xs text-blue-900">
          <p className="font-medium">Recommended import order</p>
          <ol className="mt-1 list-decimal pl-4 space-y-0.5">
            <li>Positions</li>
            <li>Employees</li>
            <li>Certifications</li>
            <li>Critical functions</li>
            <li>Role coverage</li>
            <li>Succession candidates, knowledge artifacts, milestones (optional)</li>
          </ol>
          <p className="mt-2 text-blue-800/90">
            CEU records are added on the CEUs tab after employees and certifications exist.
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              id="show-sample-templates"
              checked={showSampleTemplates}
              onCheckedChange={checked => onShowSampleTemplatesChange(checked === true)}
              className="mt-0.5"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-gray-900">
                Show sample templates in the planning tabs
              </span>
              <span className="block text-xs text-gray-600">
                Populates Critical functions, Coverage, Succession, Knowledge, and Milestones with
                examples you can adopt or ignore. Nothing is saved until you use a template and
                click Save.
              </span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Entity type</label>
            <Select
              value={entityType}
              onValueChange={v => {
                setEntityType(v as WorkforceEntityType);
                setPreview(null);
                setPendingFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={onDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Template
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:text-blue-700"
            />
          </div>
          <div className="flex items-end justify-end">
            <Button
              onClick={onCommit}
              disabled={!preview || commitMutation.isPending || preview.invalid_rows > 0}
            >
              {commitMutation.isPending ? 'Importing…' : 'Commit import'}
            </Button>
          </div>
        </div>

        {preview && (
          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="mb-2 flex flex-wrap gap-4">
              <span>Total rows: {preview.total_rows}</span>
              <span className="text-green-700">Valid: {preview.valid_rows}</span>
              <span className={preview.invalid_rows ? 'text-red-700' : ''}>
                Invalid: {preview.invalid_rows}
              </span>
            </div>
            {preview.issues.length > 0 && (
              <details>
                <summary className="cursor-pointer">
                  {preview.issues.length} validation issue
                  {preview.issues.length === 1 ? '' : 's'}
                </summary>
                <ul className="mt-2 max-h-40 list-disc overflow-auto pl-6">
                  {preview.issues.map((issue, idx) => (
                    <li key={idx}>
                      Row {issue.row_index + 1}
                      {issue.field ? ` · ${issue.field}` : ''}: {issue.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {preview.invalid_rows > 0 && (
              <p className="mt-2 text-xs text-red-700">
                Fix the issues above and re-upload before committing.
              </p>
            )}
          </div>
        )}

        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">Recent batches</h4>
          {batchesQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : batchesQuery.data?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rows (valid / invalid / promoted)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchesQuery.data.map((b: WorkforceImportBatch) => (
                    <TableRow key={b.id}>
                      <TableCell>{new Date(b.created_at).toLocaleString()}</TableCell>
                      <TableCell>{b.entity_type}</TableCell>
                      <TableCell
                        className="max-w-[12rem] truncate"
                        title={b.original_filename || ''}
                      >
                        {b.original_filename || '—'}
                      </TableCell>
                      <TableCell className="capitalize">{b.status}</TableCell>
                      <TableCell>
                        {b.rows_valid} / {b.rows_invalid} / {b.rows_promoted}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No imports yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const WorkforceContinuityPage: React.FC<{ workspace?: WorkforceWorkspace }> = ({
  workspace: workspaceProp,
}) => {
  const { toast } = useToast();
  const { isPreviewMode } = useImpersonation();
  const {
    canManageWorkforce,
    isAdmin,
    isCeuAdmin,
    isWorkforceOperator,
    actingDistrictCode,
    isGlobalAdmin,
    isSystemAdmin,
    user,
    hasAnyRole,
    isOwwPartner,
    isPlatformAdmin,
  } = useAuth();
  const canAuthorWorkforceDocs = canManageWorkforce && !isPreviewMode;
  const isWorkforceOversight =
    !canManageWorkforce && !isWorkforceOperator && (isOwwPartner || isPlatformAdmin);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = workspaceProp ?? getWorkspaceForPath(location.pathname);
  const workspaceMeta = WORKFORCE_WORKSPACE_META[workspace];
  const { data: districts, isLoading: loadingDistricts } = useDistricts();
  const [districtCode, setDistrictCode] = useState<string>('');
  const [showSampleTemplates, setShowSampleTemplates] = useState(false);
  const [alertSettings, setAlertSettings] = useState<WorkforceAlertSettings | null>(null);
  const [trainingSettings, setTrainingSettings] = useState<WorkforceTrainingSettings | null>(null);
  const seedLearningStreamMutation = useSeedLearningStreamCourses();

  useEffect(() => {
    if (isWorkforceOperator && workspace === 'continuity') {
      navigate('/continuity/ceu-training?tab=certifications', { replace: true });
    }
  }, [isWorkforceOperator, workspace, navigate]);

  // Map legacy hash shortcuts (#ceu / #training) onto ?tab=
  useEffect(() => {
    const hash = (location.hash || '').replace(/^#/, '');
    if (!hash) return;
    if ((WORKFORCE_CONTINUITY_TABS as readonly string[]).includes(hash)) {
      const tab = hash as WorkforceContinuityTab;
      const targetWorkspace = getWorkspaceForTab(tab);
      const params = buildWorkforceSearchParams(tab);
      navigate(`${WORKFORCE_WORKSPACE_PATHS[targetWorkspace]}?${params.toString()}`, {
        replace: true,
      });
    }
  }, [location.hash, navigate]);

  const districtLocked = isWorkforceDistrictLocked(
    actingDistrictCode,
    isGlobalAdmin,
    isSystemAdmin
  );

  const visibleDistricts = useMemo(() => {
    if (!districts?.length) return [];
    if (districtLocked && actingDistrictCode) {
      return districts.filter(d => d.district_code === actingDistrictCode);
    }
    return districts;
  }, [districts, districtLocked, actingDistrictCode]);

  useEffect(() => {
    if (!districts || districts.length === 0) return;
    const next = resolveWorkforceDistrictCode(districts, {
      actingDistrictCode,
      currentDistrictCode: districtLocked ? undefined : districtCode,
    });
    if (next && next !== districtCode) {
      setDistrictCode(next);
    }
  }, [districts, actingDistrictCode, districtLocked, districtCode]);

  useEffect(() => {
    if (!districtCode) return;
    setShowSampleTemplates(loadShowSampleTemplates(districtCode));
  }, [districtCode]);

  const onShowSampleTemplatesChange = useCallback(
    (on: boolean) => {
      setShowSampleTemplates(on);
      if (districtCode) {
        saveShowSampleTemplates(districtCode, on);
      }
    },
    [districtCode]
  );

  const continuity = useWorkforceContinuity(districtCode);
  const binderQuery = useWorkforceBinder(districtCode || undefined);
  const binderIntakeQuery = useBinderIntakeSession(
    canAuthorWorkforceDocs ? districtCode || undefined : undefined
  );
  const generateDocPackMutation = useGenerateWorkforceDocPack();
  const [binderSetupOpen, setBinderSetupOpen] = useState(false);
  const [binderIntakeOpen, setBinderIntakeOpen] = useState(false);
  const planningSessionQuery = useWorkforcePlanningSession(districtCode || undefined);
  const scorecardsQuery = useWorkforceScorecards();
  const alertScanMutation = useTriggerWorkforceAlertScan();
  const employeesForLabels = useWorkforceEntityList(districtCode || undefined, 'employees', {
    record_status: 'active',
  });
  const positionsForLabels = useWorkforceEntityList(districtCode || undefined, 'positions', {
    record_status: 'active',
  });
  const certificationsForDetail = useWorkforceEntityList(
    districtCode || undefined,
    'certifications',
    { record_status: 'active' }
  );
  const functionsForDetail = useWorkforceEntityList(
    districtCode || undefined,
    'critical_functions',
    { record_status: 'active' }
  );
  const milestonesForDetail = useWorkforceEntityList(
    districtCode || undefined,
    'transition_milestones',
    { record_status: 'active' }
  );
  const ceuSummaryQuery = useCeuSummary(districtCode || undefined);
  const employeeNameByCode = useMemo(
    () => buildCodeLabelMap(employeesForLabels.data, 'employee_code', 'full_name'),
    [employeesForLabels.data]
  );
  const positionTitleByCode = useMemo(
    () => buildCodeLabelMap(positionsForLabels.data, 'position_code', 'title'),
    [positionsForLabels.data]
  );

  const scorecard = continuity.data?.scorecard;
  const coverage = continuity.data?.coverage ?? [];
  const certCliff = continuity.data?.cert_cliff ?? [];
  const retirementHorizon = continuity.data?.retirement_horizon ?? [];
  const milestones = continuity.data?.upcoming_milestones ?? [];
  const continuityDataMode = continuity.data?.data_mode === 'sample' ? 'sample' : 'live';
  const sampleNotice = continuity.data?.sample_notice ?? null;

  // Wizard state ----------------------------------------------------------
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialStepId, setWizardInitialStepId] = useState<string | undefined>();
  // Suppresses auto-open re-fires within a single page load (the user has
  // already seen the wizard for this district once even if they close it).
  const districtSelectorRef = useRef<HTMLDivElement | null>(null);
  const importPanelRef = useRef<HTMLDivElement | null>(null);
  const coverageCardRef = useRef<HTMLDivElement | null>(null);
  const certCardRef = useRef<HTMLDivElement | null>(null);
  const retirementCardRef = useRef<HTMLDivElement | null>(null);
  const milestonesCardRef = useRef<HTMLDivElement | null>(null);
  const activeTab = parseWorkforceTab(searchParams.get('tab'), workspace);
  const tabMeta = WORKFORCE_TAB_META[activeTab];
  const pageTitle = tabMeta.label;
  const pageDescription = workspaceMeta.description;
  const trainingSubTab = parseTrainingSubTab(searchParams.get('sub'));
  const certExpiringDays = useMemo(() => {
    const raw = searchParams.get('cert_expiring');
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [searchParams]);

  const [trainingFilters, setTrainingFilters] = useState<TrainingCourseFilters | undefined>();
  const [ceuPrefill, setCeuPrefill] = useState<Record<string, string> | null>(null);
  const [ceuOpenCreate, setCeuOpenCreate] = useState(false);
  const [flowOverviewOpen, setFlowOverviewOpen] = useState(false);
  const [dashboardDetail, setDashboardDetail] = useState<{
    entityType: WorkforceEntityType;
    record: Record<string, unknown>;
  } | null>(null);
  const [pageCeuOperator, setPageCeuOperator] = useState<WorkforceCeuOperatorSummary | null>(null);
  const [pageCeuOpen, setPageCeuOpen] = useState(false);
  const [pageCeuMode, setPageCeuMode] = useState<EmployeeCeuDialogMode>('default');

  // Deep link (used by docs/screenshots): ?flow_map=open opens the overview.
  useEffect(() => {
    if (searchParams.get('flow_map') === 'open') {
      setFlowOverviewOpen(true);
    }
  }, [searchParams]);

  // Redirect legacy CEU & Training tabs on the continuity route.
  useEffect(() => {
    const tab = searchParams.get('tab');
    const redirect = getLegacyWorkforceRedirect(location.pathname, location.search, tab);
    if (redirect) {
      navigate(redirect, { replace: true });
    }
  }, [location.pathname, location.search, searchParams, navigate]);

  const goToTab = useCallback(
    (
      tab: WorkforceContinuityTab,
      opts?: {
        sub?: WorkforceTrainingSubTab;
        certExpiring?: number;
        clearCertExpiring?: boolean;
      }
    ) => {
      const targetWorkspace = getWorkspaceForTab(tab);
      const params = buildWorkforceSearchParams(tab, opts);
      if (targetWorkspace !== workspace) {
        navigate(`${WORKFORCE_WORKSPACE_PATHS[targetWorkspace]}?${params.toString()}`);
        return;
      }
      setSearchParams(params, { replace: false });
    },
    [navigate, setSearchParams, workspace]
  );

  const navigateFlowNode = useCallback(
    (nodeId: WorkforceFlowNodeId) => {
      if (nodeId === 'alerts') {
        navigate('/admin/settings');
        return;
      }
      if (nodeId === 'readiness' || nodeId === 'doh352') {
        goToTab(nodeId === 'doh352' ? 'ceu' : 'dashboard');
        return;
      }
      if (isNavigableFlowNode(nodeId)) {
        goToTab(nodeId);
      }
    },
    [goToTab, navigate]
  );

  const openTourForTab = useCallback(
    (tab: WorkforceContinuityTab = activeTab) => {
      requestOpenWorkforceTour(tab);
    },
    [activeTab]
  );


  const openCeuDialogForEmployee = useCallback(
    (employeeCode: string, _employeeName: string) => {
      const op = ceuSummaryQuery.data?.operators.find(o => o.employee_code === employeeCode);
      if (op) {
        setPageCeuOperator(op);
        setPageCeuMode('default');
        setPageCeuOpen(true);
      } else {
        goToTab('ceu');
      }
    },
    [ceuSummaryQuery.data?.operators, goToTab]
  );

  const entityAreaCallbacks = useMemo(
    () => ({
      onOpenTour: openTourForTab,
      onOpenCeuDialog: openCeuDialogForEmployee,
    }),
    [openTourForTab, openCeuDialogForEmployee]
  );

  useWorkforceTourAutoOpen(
    activeTab,
    isWorkforceOperator,
    Boolean(districtCode && scorecard && !continuity.isLoading)
  );

  const openDashboardDetail = useCallback(
    (entityType: WorkforceEntityType, record: Record<string, unknown> | undefined) => {
      if (record) setDashboardDetail({ entityType, record });
    },
    []
  );

  const navigateToTraining = useCallback(
    (filters: TrainingCourseFilters) => {
      setTrainingFilters(filters);
      goToTab('training', { sub: 'catalog' });
    },
    [goToTab]
  );

  const recordCeuFromTraining = useCallback(
    (training: WorkforceScheduledTraining) => {
      const grade = training.target_grades?.split(',')[0]?.trim() ?? '';
      const completionDate = training.end_datetime ?? training.start_datetime;
      setCeuPrefill({
        course_title: training.title,
        provider: training.provider,
        ceu_hours: training.ceu_hours != null ? String(training.ceu_hours) : '',
        certification_grade: grade,
        category: training.category ?? 'renewal',
        completion_date: completionDate ? new Date(completionDate).toISOString().slice(0, 10) : '',
        employee_code: '',
        approval_number: '',
      });
      setCeuOpenCreate(true);
      goToTab('ceu');
    },
    [goToTab]
  );

  useEffect(() => {
    void fetchDistrictConfig()
      .then(cfg => {
        setAlertSettings(cfg.workforce_alerts ?? null);
        setTrainingSettings(cfg.workforce_training ?? null);
      })
      .catch(() => {
        setAlertSettings(null);
        setTrainingSettings(null);
      });
  }, [districtCode]);

  const openWizard = useCallback(
    (options?: { stepId?: string }) => {
      if (!districtCode) return;
      setWizardInitialStepId(options?.stepId);
      setWizardOpen(true);
    },
    [districtCode]
  );

  const onWizardOpenChange = useCallback((open: boolean) => {
    setWizardOpen(open);
    if (!open) {
      setWizardInitialStepId(undefined);
    }
  }, []);

  useEffect(() => {
    setWizardOpen(false);
    setWizardInitialStepId(undefined);
  }, [districtCode]);

  // Setup wizard opens only via Express / Resume buttons (managers). Tour owns first visit.

  // Wizard "go to..." action dispatcher: navigates to matching tab.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WorkforceWizardActionEvent>).detail;
      if (!detail) return;
      const tabByAction: Partial<Record<string, WorkforceContinuityTab>> = {
        'select-district': 'dashboard',
        'open-import-panel': 'import',
        'open-coverage-card': 'coverage',
        'open-certification-card': 'certifications',
        'open-retirement-card': 'succession',
        'open-milestones-card': 'milestones',
      };
      const tab = tabByAction[detail.actionId];
      if (tab) {
        goToTab(tab, tab === 'certifications' ? { certExpiring: 365 } : undefined);
        return;
      }
      const targetMap: Partial<Record<string, React.RefObject<HTMLDivElement>>> = {
        'select-district': districtSelectorRef,
        'open-import-panel': importPanelRef,
        'open-coverage-card': coverageCardRef,
        'open-certification-card': certCardRef,
        'open-retirement-card': retirementCardRef,
        'open-milestones-card': milestonesCardRef,
      };
      const target = targetMap[detail.actionId];
      if (target?.current) {
        target.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener(WORKFORCE_WIZARD_EVENT, handler as EventListener);
    return () => window.removeEventListener(WORKFORCE_WIZARD_EVENT, handler as EventListener);
  }, [goToTab]);

  const wizardPrimaryLabel = 'Advanced roster setup';
  const districtLabel = useMemo(
    () => visibleDistricts.find(d => d.district_code === districtCode)?.district_name ?? districtCode,
    [visibleDistricts, districtCode]
  );

  const openStudioDoc = useCallback(
    (docId: string | null | undefined, folderId?: string | null, scope?: string | null) => {
      const next = new URLSearchParams();
      if (scope) next.set('scope', scope);
      if (docId) next.set('doc', docId);
      if (folderId) next.set('folder', folderId);
      navigate(`/studio?${next.toString()}`);
    },
    [navigate]
  );

  const handleCreateBinder = useCallback(
    async (values: {
      profile: 'small_system' | 'multi_plant' | 'district_trainees';
      contact_name: string;
      contact_email: string;
      use_live_data: boolean;
    }) => {
      if (!districtCode || !canAuthorWorkforceDocs) return;
      try {
        const result = await generateDocPackMutation.mutateAsync({
          districtCode,
          body: {
            pack_type: 'succession_binder',
            profile: values.profile,
            contact_name: values.contact_name || undefined,
            contact_email: values.contact_email || undefined,
            use_live_data: values.use_live_data,
          },
        });
        toast({
          title: 'Succession Binder created',
          description: `${result.document_count} section(s) in Document Studio — edit, export, or transfer custody when ready.`,
        });
        openStudioDoc(result.cover_document_id, result.folder_id, districtCode);
      } catch (err: unknown) {
        const detail = axios.isAxiosError(err)
          ? String(err.response?.data?.detail ?? err.message)
          : err instanceof Error
            ? err.message
            : 'Could not create binder';
        toast({
          title: 'Binder not created',
          description:
            detail === 'IMPERSONATION_READ_ONLY'
              ? 'Read-only preview cannot save binders. Exit preview and use Act as (audited), or ask the utility to sign in and create it.'
              : detail,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [districtCode, canAuthorWorkforceDocs, generateDocPackMutation, openStudioDoc, toast]
  );

  const handleRefreshCeuPack = useCallback(async () => {
    if (!districtCode) return;
    const result = await generateDocPackMutation.mutateAsync({
      districtCode,
      body: {
        pack_type: 'ceu_tracker_pack',
        use_live_data: true,
        contact_name: user?.full_name ?? undefined,
        contact_email: user?.email ?? undefined,
      },
    });
    toast({
      title: 'CEU Tracker pack refreshed',
      description: `Dated snapshot with ${result.document_count} document(s) in Training & CE.`,
    });
    openStudioDoc(result.cover_document_id, result.folder_id, districtCode);
  }, [districtCode, generateDocPackMutation, openStudioDoc, toast, user?.email, user?.full_name]);
  const draftSession = planningSessionQuery.data;
  const resumeWizardLabel = draftSession
    ? `Resume setup — ${draftSession.current_step.replace(/_/g, ' ')} (${draftSession.completed_steps.length} done)`
    : null;

  const showGettingStartedBanner = useMemo(() => {
    if (!canAuthorWorkforceDocs || !scorecard) return false;
    if (continuityDataMode === 'sample') return true;
    return scorecard.total_employees === 0 && scorecard.total_positions === 0;
  }, [canAuthorWorkforceDocs, continuityDataMode, scorecard]);

  const tourHeaderAction = (
    <Button
      variant="secondary"
      size="sm"
      className="border-white/30 bg-white/15 text-white hover:bg-white/25"
      onClick={() => openTourForTab(activeTab)}
    >
      <CircleHelp className="mr-1.5 h-4 w-4" />
      Tour
    </Button>
  );

  const readinessLabel = useMemo(() => {
    if (!scorecard) return '—';
    if (continuityDataMode === 'sample') return 'Sample (illustrative)';
    const noData =
      scorecard.total_employees === 0 &&
      scorecard.total_critical_functions === 0 &&
      scorecard.total_positions === 0;
    if (noData) return 'Not assessed — add workforce data';
    if (scorecard.readiness_score >= 80) return 'Strong';
    if (scorecard.readiness_score >= 60) return 'Adequate';
    if (scorecard.readiness_score >= 40) return 'At risk';
    return 'Critical';
  }, [scorecard, continuityDataMode]);

  return (
    <TooltipProvider>
      <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
        <Ww360PageHero
          eyebrow={workspaceMeta.title}
          title={pageTitle}
          description={pageDescription}
          dataMode={continuityDataMode}
          actions={isWorkforceOperator ? tourHeaderAction : undefined}
        />

        {continuityDataMode === 'sample' && sampleNotice ? (
          <div
            role="status"
            className="flex flex-wrap items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[1rem] leading-relaxed text-sky-950"
          >
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden />
            <p className="min-w-0 flex-1 text-sky-950">{sampleNotice}</p>
          </div>
        ) : null}

        {isPreviewMode && canManageWorkforce && workspace === 'continuity' ? (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[1rem] leading-relaxed text-amber-950"
          >
            <p className="font-semibold">Read-only role preview</p>
            <p className="mt-0.5">
              Explore Continuity and open binders here; creating or editing needs{' '}
              <strong className="font-semibold">Act as (audited)</strong> or a direct utility sign-in.
            </p>
          </div>
        ) : null}

        {isWorkforceOversight && workspace === 'continuity' ? (
          <div
            role="status"
            className="rounded-lg border border-sky-200 bg-sky-50/80 px-4 py-3 text-[1rem] leading-relaxed text-sky-950"
          >
            <p className="font-semibold">Section oversight</p>
            <p className="mt-0.5">
              Pick a member utility to review scorecards and open binders read-only. Utility
              superintendents and managers author Succession Binders — use{' '}
              <strong className="font-semibold">View as role</strong> to walk those perspectives.
            </p>
          </div>
        ) : null}

        {!isWorkforceOperator ? (
        <Card ref={districtSelectorRef}>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] flex-1">
                <label className="text-[1rem] font-medium text-gray-700">District</label>
                <Select
                  value={districtCode}
                  onValueChange={setDistrictCode}
                  disabled={loadingDistricts || !visibleDistricts.length || districtLocked}
                >
                  <SelectTrigger className="mt-1 min-h-[44px] text-[1rem]">
                    <SelectValue placeholder="Select a district" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleDistricts.map(d => (
                      <SelectItem key={d.district_code} value={d.district_code}>
                        {d.district_name || d.district_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {districtLocked ? (
                  <p className="mt-1 text-[0.875rem] text-gray-500">
                    Scoped to your Working-in district. Change it from the header to view another.
                  </p>
                ) : null}
              </div>
              <Button
                variant="outline"
                className="min-h-[44px] text-[1rem]"
                onClick={() => openTourForTab(activeTab)}
              >
                <CircleHelp className="mr-1.5 h-4 w-4" />
                Tour
              </Button>
              {canAuthorWorkforceDocs ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-h-[44px] text-[1rem]">
                      <MoreHorizontal className="mr-1.5 h-4 w-4" />
                      More
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[16rem]">
                    <DropdownMenuLabel className="text-[1rem]">Roster &amp; scans</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="min-h-[44px] text-[1rem]"
                      onClick={() => openWizard()}
                      disabled={!districtCode}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {wizardPrimaryLabel}
                    </DropdownMenuItem>
                    {resumeWizardLabel ? (
                      <DropdownMenuItem
                        className="min-h-[44px] text-[1rem]"
                        onClick={() => openWizard({ stepId: draftSession?.current_step })}
                        disabled={!districtCode}
                      >
                        Resume roster setup
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      className="min-h-[44px] text-[1rem]"
                      disabled={!districtCode || alertScanMutation.isPending}
                      onClick={() => {
                        if (!districtCode) return;
                        void alertScanMutation.mutateAsync(districtCode).then(res => {
                          toast({
                            title: 'Alert scan complete',
                            description: `${res.created} workforce alert(s) created. View them in Alerts.`,
                          });
                        });
                      }}
                    >
                      Run alert scan
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-[44px] text-[1rem]"
                      disabled={!districtCode || seedLearningStreamMutation.isPending}
                      onClick={() => {
                        if (!districtCode) return;
                        void seedLearningStreamMutation.mutateAsync(districtCode).then(res => {
                          toast({
                            title: 'Learning Stream courses imported',
                            description: `${res.catalog_added} added, ${res.catalog_updated} updated, ${res.district_sessions_created} district session(s) created.`,
                          });
                        });
                      }}
                    >
                      Import Learning Stream
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[1rem]">Settings</DropdownMenuLabel>
                    {isAdmin ? (
                      <DropdownMenuItem
                        className="min-h-[44px] text-[1rem]"
                        onClick={() => navigate('/dashboard/district-admin/utilities?tab=alert-sched')}
                      >
                        Alert settings
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      className="min-h-[44px] text-[1rem]"
                      onClick={() => navigate('/dashboard/district-admin/utilities?tab=alert-sched')}
                    >
                      Training settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-[44px] text-[1rem]"
                      onClick={() => navigate('/dashboard/alerts')}
                    >
                      Alerts inbox
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {scorecard ? (
                <p className="ml-auto text-[0.875rem] text-gray-600">
                  As of {new Date(normalizeUtcIso(scorecard.as_of)).toLocaleString()}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        ) : null}

        {canAuthorWorkforceDocs && districtCode ? (
          <WorkforceBinderHub
            districtCode={districtCode}
            existingBinder={binderQuery.data}
            binderLoading={binderQuery.isLoading}
            mode="author"
            emphasizeCreate={showGettingStartedBanner}
            sampleMode={continuityDataMode === 'sample'}
            intakeDraftStep={
              binderIntakeQuery.data?.status === 'draft'
                ? binderIntakeQuery.data.current_step
                : null
            }
            onStartGuidedIntake={() => setBinderIntakeOpen(true)}
            onResumeGuidedIntake={() => setBinderIntakeOpen(true)}
            onQuickCreate={() => setBinderSetupOpen(true)}
            onRefreshCeuPack={() => void handleRefreshCeuPack()}
            ceuRefreshing={generateDocPackMutation.isPending}
          />
        ) : (isWorkforceOversight || (isPreviewMode && canManageWorkforce)) && districtCode ? (
          <WorkforceBinderHub
            districtCode={districtCode}
            existingBinder={binderQuery.data}
            binderLoading={binderQuery.isLoading}
            mode="oversight"
            previewReadOnly={isPreviewMode}
            sampleMode={continuityDataMode === 'sample'}
            onStartGuidedIntake={() => {}}
            onQuickCreate={() => {}}
            onRefreshCeuPack={() => {}}
          />
        ) : null}

        {canAuthorWorkforceDocs && districtCode ? (
          <BinderIntakeWizard
            open={binderIntakeOpen}
            onOpenChange={setBinderIntakeOpen}
            districtCode={districtCode}
            districtLabel={districtLabel}
            defaultContactName={user?.full_name ?? ''}
            defaultContactEmail={user?.email ?? ''}
            continuity={continuity.data ?? null}
            initialSession={
              binderIntakeQuery.data?.status === 'draft' ? binderIntakeQuery.data : null
            }
            readOnly={isPreviewMode}
            onComplete={({ coverId, folderId }) => {
              openStudioDoc(coverId, folderId, districtCode);
            }}
          />
        ) : null}

        {canAuthorWorkforceDocs ? (
          <WorkforceBinderSetupDialog
            open={binderSetupOpen}
            onOpenChange={setBinderSetupOpen}
            districtLabel={districtLabel}
            defaultContactName={user?.full_name ?? ''}
            defaultContactEmail={user?.email ?? ''}
            onSubmit={handleCreateBinder}
          />
        ) : null}

        {!districtCode ? (
          <p className="text-sm text-gray-500">
            Select a district to load the continuity scorecard.
          </p>
        ) : continuity.isLoading ? (
          <p className="text-sm text-gray-500">Loading workforce continuity…</p>
        ) : continuity.isError ? (
          <p className="text-sm text-red-600">
            Failed to load continuity data: {(continuity.error as Error).message}
          </p>
        ) : scorecard ? (
          <Tabs
            value={activeTab}
            onValueChange={v => goToTab(parseWorkforceTab(v, workspace))}
            className="space-y-4"
          >
            {workspace === 'ceu_training' ? <WorkforceLicenseHealthStrip scorecard={scorecard} /> : null}

            {workspace === 'continuity' ? (
              <>
                <TabsContent value="dashboard" className="space-y-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <MetricCard
                      icon={ShieldCheck}
                      label="Readiness score"
                      tooltip="Average of critical-function coverage, certification health, retirement risk, and CEU completion (when operators are on file)."
                      onClick={() => goToTab('dashboard')}
                      value={
                        continuityDataMode === 'sample'
                          ? `${scorecard.readiness_score} / 100`
                          : scorecard.total_employees === 0 &&
                              scorecard.total_critical_functions === 0 &&
                              scorecard.total_positions === 0
                            ? '—'
                            : `${scorecard.readiness_score} / 100`
                      }
                      hint={readinessLabel}
                      tone={
                        continuityDataMode === 'sample'
                          ? 'default'
                          : scorecard.total_employees === 0 &&
                              scorecard.total_critical_functions === 0 &&
                              scorecard.total_positions === 0
                            ? 'default'
                            : scorecard.readiness_score >= 80
                              ? 'good'
                              : scorecard.readiness_score >= 60
                                ? 'default'
                                : scorecard.readiness_score >= 40
                                  ? 'warn'
                                  : 'danger'
                      }
                    />
                    <MetricCard
                      icon={CheckCircle2}
                      label="Critical-function coverage"
                      tooltip="Share of critical functions with at least one qualified backup operator."
                      onClick={() => goToTab('coverage')}
                      value={`${scorecard.coverage_pct}%`}
                      hint={`${scorecard.functions_with_qualified_backup} / ${scorecard.total_critical_functions} have a qualified backup`}
                      tone={
                        continuityDataMode === 'sample'
                          ? 'default'
                          : scorecard.coverage_pct >= 80
                            ? 'good'
                            : scorecard.coverage_pct >= 60
                              ? 'warn'
                              : 'danger'
                      }
                    />
                    <MetricCard
                      icon={FileWarning}
                      label="Certs expiring (90 days)"
                      tooltip="Operator certifications expiring within 90 days. Click to review and renew."
                      onClick={() => goToTab('certifications', { certExpiring: 90 })}
                      value={scorecard.cert_cliff_90d}
                      hint={`${scorecard.cert_cliff_30d} within 30 days · ${scorecard.cert_cliff_365d} within 12 months`}
                      tone={
                        continuityDataMode === 'sample'
                          ? 'default'
                          : scorecard.cert_cliff_90d > 0
                            ? 'warn'
                            : 'good'
                      }
                    />
                    <MetricCard
                      icon={CalendarClock}
                      label="Retirement-eligible (24 mo)"
                      tooltip="Employees within 24 months of retirement eligibility — plan succession and knowledge transfer."
                      onClick={() => goToTab('succession')}
                      value={scorecard.employees_retirement_eligible_24mo}
                      hint={`${scorecard.vacant_positions} positions vacant · ${scorecard.overdue_milestones} overdue milestones`}
                      tone={
                        continuityDataMode === 'sample'
                          ? 'default'
                          : scorecard.employees_retirement_eligible_24mo === 0 &&
                              scorecard.overdue_milestones === 0
                            ? 'good'
                            : 'warn'
                      }
                    />
                    {scorecard.ceu_shortfall_count != null && (
                      <MetricCard
                        icon={FileWarning}
                        label="CEU shortfall"
                        tooltip="Operators behind on NYS renewal CEU hours for the current cycle."
                        onClick={() => goToTab('ceu')}
                        value={scorecard.ceu_shortfall_count}
                        hint={`${scorecard.ceu_avg_completion_pct ?? 0}% avg completion · ${scorecard.doh352_ready_count ?? 0} DOH-352 ready`}
                        tone={
                          continuityDataMode === 'sample'
                            ? 'default'
                            : scorecard.ceu_shortfall_count > 0
                              ? 'warn'
                              : 'good'
                        }
                      />
                    )}
                  </div>

                  {!districtLocked && scorecardsQuery.data && scorecardsQuery.data.length > 1 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Multi-district overview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MultiDistrictOverviewTable
                          scorecards={scorecardsQuery.data}
                          onRowClick={setDistrictCode}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {continuityDataMode === 'sample' ? (
                    <Card className="border-dashed border-slate-300 bg-slate-50/80">
                      <CardContent className="space-y-2 pt-6 text-[1rem] leading-relaxed text-slate-700">
                        <p className="font-semibold text-[1.125rem] text-slate-900">
                          Detail tables stay hidden for sample data
                        </p>
                        <p>
                          Coverage, certification cliff, retirement, and milestone lists appear here
                          once a live roster is imported or entered. Use the Succession Binder card
                          above for documents while you build the roster.
                        </p>
                        {canAuthorWorkforceDocs ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              type="button"
                              className="min-h-[44px] text-[1rem]"
                              onClick={() => setBinderIntakeOpen(true)}
                            >
                              <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                              Guided binder walkthrough
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-[44px] text-[1rem]"
                              onClick={() => openWizard()}
                            >
                              Start roster setup
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : (
                  <>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card ref={coverageCardRef}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5" /> Critical-function coverage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CoverageTable
                          rows={coverage}
                          employeeNameByCode={employeeNameByCode}
                          onRowClick={row =>
                            openDashboardDetail(
                              'critical_functions',
                              findRowById(functionsForDetail.data ?? [], row.function_id) ??
                                findRowByCode(
                                  functionsForDetail.data ?? [],
                                  'function_code',
                                  row.function_code
                                )
                            )
                          }
                        />
                      </CardContent>
                    </Card>

                    <Card ref={certCardRef}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileWarning className="h-5 w-5" /> Certification cliff
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CertCliffTable
                          rows={certCliff}
                          onRowClick={row =>
                            openDashboardDetail(
                              'certifications',
                              findRowById(certificationsForDetail.data ?? [], row.certification_id)
                            )
                          }
                        />
                      </CardContent>
                    </Card>

                    <Card ref={retirementCardRef}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CalendarClock className="h-5 w-5" /> Retirement horizon
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RetirementTable
                          rows={retirementHorizon}
                          positionTitleByCode={positionTitleByCode}
                          onRowClick={row =>
                            openDashboardDetail(
                              'employees',
                              findRowById(employeesForLabels.data ?? [], row.employee_id) ??
                                findRowByCode(
                                  employeesForLabels.data ?? [],
                                  'employee_code',
                                  row.employee_code
                                )
                            )
                          }
                        />
                      </CardContent>
                    </Card>

                    <Card ref={milestonesCardRef}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardList className="h-5 w-5" /> Upcoming milestones
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MilestonesTable
                          rows={milestones}
                          positionTitleByCode={positionTitleByCode}
                          onRowClick={row =>
                            openDashboardDetail(
                              'transition_milestones',
                              findRowById(milestonesForDetail.data ?? [], row.milestone_id)
                            )
                          }
                        />
                      </CardContent>
                    </Card>
                  </div>

                  {scorecard.total_critical_functions === 0 && (
                    <Card>
                      <CardContent className="flex items-start gap-3 pt-6">
                        <AlertTriangle className="h-6 w-6 text-yellow-600" />
                        <div className="flex-1 text-[1rem] leading-relaxed text-slate-700">
                          <p className="font-medium text-slate-900">No workforce data yet for this district.</p>
                          <p>
                            Use the import panel or entity tabs to add positions, employees,
                            certifications, critical functions, and role coverage.
                          </p>
                          <div className="mt-3">
                            <Button className="min-h-[44px] text-[1rem]" onClick={() => openWizard()}>
                              <Sparkles className="mr-1.5 h-4 w-4" />
                              {wizardPrimaryLabel}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  </>
                  )}
                </TabsContent>

                <TabsContent value="positions">
                  <WorkforceEntityArea
                    {...entityAreaCallbacks}
                    districtCode={districtCode}
                    entityType="positions"
                  />
                </TabsContent>
                <TabsContent value="employees">
                  <WorkforceEntityArea
                    {...entityAreaCallbacks}
                    districtCode={districtCode}
                    entityType="employees"
                  />
                  <WorkforceEmployeesHandoffCard />
                </TabsContent>
                <TabsContent value="functions">
                  <WorkforceEntityArea
                    {...entityAreaCallbacks}
                    districtCode={districtCode}
                    entityType="critical_functions"
                    showSampleTemplates={showSampleTemplates}
                  />
                </TabsContent>
                <TabsContent value="coverage">
                  <WorkforceEntityArea
                    {...entityAreaCallbacks}
                    districtCode={districtCode}
                    entityType="role_coverage"
                    showSampleTemplates={showSampleTemplates}
                  />
                </TabsContent>
                <TabsContent value="succession">
                  {retirementHorizon.length > 0 ? (
                    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
                      {retirementHorizon.length} employee(s) approaching retirement eligibility —
                      add succession candidates and knowledge artifacts for their roles.{' '}
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-amber-900 underline"
                        onClick={() => goToTab('knowledge')}
                      >
                        Knowledge tab
                      </Button>
                    </div>
                  ) : null}
                  <WorkforceBenchBoard
                    districtCode={districtCode}
                    canManage={canAuthorWorkforceDocs}
                    onAssign={() => goToTab('coverage')}
                  />
                  <div className="mt-6">
                    <WorkforceEntityArea
                      {...entityAreaCallbacks}
                      districtCode={districtCode}
                      entityType="succession_candidates"
                      showSampleTemplates={showSampleTemplates}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="knowledge">
                  <WorkforceEntityArea
                    {...entityAreaCallbacks}
                    districtCode={districtCode}
                    entityType="knowledge_artifacts"
                    showSampleTemplates={showSampleTemplates}
                  />
                </TabsContent>
                <TabsContent value="milestones">
                  <WorkforceEntityArea
                    {...entityAreaCallbacks}
                    districtCode={districtCode}
                    entityType="transition_milestones"
                    showSampleTemplates={showSampleTemplates}
                  />
                </TabsContent>
                <TabsContent value="import">
                  <div ref={importPanelRef}>
                    <p className="mb-3 text-sm text-gray-600">
                      Certification rows imported here appear under{' '}
                      <Link
                        to={buildWorkforceTabPath('certifications')}
                        className="text-blue-700 underline"
                      >
                        CEU & Training → Certifications
                      </Link>
                      .
                    </p>
                    <ImportPanel
                      districtCode={districtCode}
                      showSampleTemplates={showSampleTemplates}
                      onShowSampleTemplatesChange={onShowSampleTemplatesChange}
                    />
                  </div>
                </TabsContent>
              </>
            ) : null}

            {workspace === 'ceu_training' ? (
              <>
                <TabsContent value="certifications">
                  {scorecard.total_employees === 0 ? (
                    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-900">
                      Add employees in{' '}
                      <Link
                        to={`${WORKFORCE_WORKSPACE_PATHS.continuity}?tab=employees`}
                        className="font-medium underline hover:text-blue-950"
                      >
                        Workforce Continuity → Employees
                      </Link>{' '}
                      before recording certifications.
                    </div>
                  ) : null}
                  <WorkforceEntityArea
                    {...entityAreaCallbacks}
                    districtCode={districtCode}
                    entityType="certifications"
                    {...(certExpiringDays != null
                      ? { listFilterOverrides: { expiring_within_days: certExpiringDays } }
                      : {})}
                    extraFilters={
                      certExpiringDays != null ? (
                        <div className="flex items-end gap-2 pb-0.5">
                          <span className="text-xs text-amber-800">
                            Showing certs expiring within {certExpiringDays} days
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => goToTab('certifications', { clearCertExpiring: true })}
                          >
                            Show all
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9"
                          onClick={() => goToTab('certifications', { certExpiring: 90 })}
                        >
                          Expiring in 90 days
                        </Button>
                      )
                    }
                  />
                </TabsContent>
                <TabsContent value="ceu">
                  <div className="space-y-6">
                    <WorkforceCeuArea
                      districtCode={districtCode}
                      onFindRenewalCourses={navigateToTraining}
                      prefillForm={ceuPrefill}
                      openCreateDialog={ceuOpenCreate}
                      onCreateDialogHandled={() => {
                        setCeuOpenCreate(false);
                        setCeuPrefill(null);
                      }}
                    />
                    <WorkforceCeuRequirementsPanel />
                  </div>
                </TabsContent>
                <TabsContent value="training">
                  <Tabs
                    value={trainingSubTab}
                    onValueChange={v => goToTab('training', { sub: parseTrainingSubTab(v) })}
                  >
                    <ResponsiveTabsList
                      items={[
                        { value: 'catalog', label: 'All courses' },
                        { value: 'sessions', label: 'District sessions' },
                        ...(isWorkforceOperator
                          ? [{ value: 'my-signups', label: 'My sign-ups' }]
                          : []),
                      ]}
                      value={trainingSubTab}
                      onValueChange={v => goToTab('training', { sub: parseTrainingSubTab(v) })}
                      selectLabel="Training section"
                    />
                    <TabsContent value="catalog">
                      <WorkforceTrainingArea
                        districtCode={districtCode}
                        canManage={canAuthorWorkforceDocs}
                        onCreatedFromCatalog={() => goToTab('training', { sub: 'sessions' })}
                        {...(trainingFilters ? { initialFilters: trainingFilters } : {})}
                      />
                    </TabsContent>
                    <TabsContent value="sessions">
                      <WorkforceScheduledTrainingArea
                        districtCode={districtCode}
                        canManage={canAuthorWorkforceDocs}
                        operatorSelfEnrollEnabled={
                          trainingSettings?.operator_self_enroll_enabled ?? false
                        }
                        onRecordCeu={canAuthorWorkforceDocs ? recordCeuFromTraining : undefined}
                      />
                    </TabsContent>
                    {isWorkforceOperator ? (
                      <TabsContent value="my-signups">
                        <WorkforceMyTrainingSignupsArea districtCode={districtCode} />
                      </TabsContent>
                    ) : null}
                  </Tabs>
                </TabsContent>
              </>
            ) : null}
          </Tabs>
        ) : null}

        <WorkforceFlowOverviewDialog
          open={flowOverviewOpen}
          onOpenChange={setFlowOverviewOpen}
          scorecard={scorecard ?? null}
          onNavigate={navigateFlowNode}
        />

        {dashboardDetail ? (
          <WorkforceRecordDetailDialog
            open={Boolean(dashboardDetail)}
            onOpenChange={open => {
              if (!open) setDashboardDetail(null);
            }}
            districtCode={districtCode}
            entityType={dashboardDetail.entityType}
            record={dashboardDetail.record}
            canManage={canAuthorWorkforceDocs}
            onOpenCeuDialog={openCeuDialogForEmployee}
          />
        ) : null}

        {pageCeuOperator ? (
          <WorkforceEmployeeCeuDialog
            open={pageCeuOpen}
            onOpenChange={setPageCeuOpen}
            districtCode={districtCode}
            operator={pageCeuOperator}
            canManage={canAuthorWorkforceDocs}
            initialMode={pageCeuMode}
          />
        ) : null}

        {wizardOpen && districtCode && canAuthorWorkforceDocs ? (
          <WorkforceSuccessionWizard
            open={wizardOpen}
            onOpenChange={onWizardOpenChange}
            districtCode={districtCode}
            {...(wizardInitialStepId ? { initialStepId: wizardInitialStepId } : {})}
          />
        ) : null}

        <WorkforceTourOverlay isWorkforceOperator={isWorkforceOperator} />
      </div>
    </TooltipProvider>
  );
};

export default WorkforceContinuityPage;
