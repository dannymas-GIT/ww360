import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  CircleHelp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { WorkforceDraftBanner } from '@/components/workforce/WorkforceDraftBanner';
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
import { useDistricts } from '@/hooks/useDistricts';
import {
  useCommitWorkforceImport,
  useCeuSummary,
  useDownloadCsvTemplate,
  usePreviewWorkforceImport,
  useTriggerWorkforceAlertScan,
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
      <CardContent className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs font-medium text-gray-500 lg:text-sm">
              <span className="truncate">{label}</span>
              {tooltip ? <Info className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden /> : null}
            </div>
            <div className="mt-1 text-lg font-semibold text-gray-900 sm:text-2xl lg:text-3xl">
              {value}
            </div>
            {hint && (
              <div className="mt-1 hidden truncate text-xs text-gray-400 sm:block">{hint}</div>
            )}
          </div>
          <Icon
            className={`hidden shrink-0 sm:block sm:h-7 sm:w-7 lg:h-10 lg:w-10 ${toneClasses[tone]}`}
          />
        </div>
      </CardContent>
    </Card>
  );
  if (!tooltip) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
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
  const {
    canManageWorkforce,
    isAdmin,
    isCeuAdmin,
    isWorkforceOperator,
    actingDistrictCode,
    isGlobalAdmin,
    isSystemAdmin,
  } = useAuth();
  const canManageUsers = isAdmin || isCeuAdmin;
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

  const wizardPrimaryLabel = 'Start guided setup';
  const draftSession = planningSessionQuery.data;
  const resumeWizardLabel = draftSession
    ? `Resume setup — ${draftSession.current_step.replace(/_/g, ' ')} (${draftSession.completed_steps.length} done)`
    : null;

  const showGettingStartedBanner = useMemo(() => {
    if (!canManageWorkforce || !scorecard) return false;
    return scorecard.total_employees === 0 && scorecard.total_positions === 0;
  }, [canManageWorkforce, scorecard]);

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
    const noData =
      scorecard.total_employees === 0 &&
      scorecard.total_critical_functions === 0 &&
      scorecard.total_positions === 0;
    if (noData) return 'Not assessed — add workforce data';
    if (scorecard.readiness_score >= 80) return 'Strong';
    if (scorecard.readiness_score >= 60) return 'Adequate';
    if (scorecard.readiness_score >= 40) return 'At risk';
    return 'Critical';
  }, [scorecard]);

  return (
    <TooltipProvider>
      <div className="ww360-app-shell mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6">
        <Ww360PageHero
          eyebrow={workspaceMeta.title}
          title={pageTitle}
          description={pageDescription}
          dataMode="live"
          actions={isWorkforceOperator ? tourHeaderAction : undefined}
        />

        {!isWorkforceOperator ? (
        <Card ref={districtSelectorRef}>
          <CardContent className="flex flex-wrap items-center gap-4 pt-6">
            <div className="min-w-[16rem]">
              <label className="text-sm font-medium text-gray-700">District</label>
              <Select
                value={districtCode}
                onValueChange={setDistrictCode}
                disabled={loadingDistricts || !visibleDistricts.length || districtLocked}
              >
                <SelectTrigger>
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
                <p className="mt-1 text-xs text-gray-500">
                  Scoped to your Working-in district. Change it from the header to view another
                  district.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {canManageWorkforce && resumeWizardLabel ? (
                <Button
                  variant="secondary"
                  onClick={() => openWizard({ stepId: draftSession?.current_step })}
                  disabled={!districtCode}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {resumeWizardLabel}
                </Button>
              ) : null}
              {canManageWorkforce ? (
                <Button variant="outline" onClick={() => openWizard()} disabled={!districtCode}>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {wizardPrimaryLabel}
                </Button>
              ) : null}
              {canManageWorkforce ? (
                <Button
                  variant="outline"
                  onClick={() => openWizard({ stepId: 'express_setup' })}
                  disabled={!districtCode}
                >
                  Express setup
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => openTourForTab(activeTab)}>
                <CircleHelp className="mr-1.5 h-4 w-4" />
                Tour
              </Button>
              {canManageUsers ? (
                <Button variant="outline" onClick={() => navigate('/admin/users')}>
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Add users
                </Button>
              ) : null}
              {canManageWorkforce ? (
                <Button
                  variant="outline"
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
                </Button>
              ) : null}
              {alertSettings ? (
                <span className="text-xs text-gray-500">
                  Daily scan {alertSettings.scan_daily ? 'on' : 'off'}
                  {isAdmin ? (
                    <>
                      {' · '}
                      <Link
                        to="/dashboard/district-admin/utilities?tab=alert-sched"
                        className="text-blue-600 hover:underline"
                      >
                        Alert settings
                      </Link>
                    </>
                  ) : null}
                </span>
              ) : null}
              {canManageWorkforce ? (
                <span className="text-xs text-gray-500">
                  Operator sign-up{' '}
                  {trainingSettings?.operator_self_enroll_enabled ? 'enabled' : 'disabled'}
                  {' · '}
                  <Link
                    to="/dashboard/district-admin/utilities?tab=alert-sched"
                    className="text-blue-600 hover:underline"
                  >
                    Training settings
                  </Link>
                </span>
              ) : null}
              {canManageWorkforce ? (
                <Button
                  variant="outline"
                  size="sm"
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
                </Button>
              ) : null}
            </div>
            <div className="w-full text-xs text-gray-500 sm:w-auto">
              Scans for expiring certs, coverage gaps, retirement horizon, CEU shortfalls, and
              overdue milestones.{' '}
              <Link
                to="/dashboard/alerts"
                className="inline-flex items-center text-blue-600 hover:underline"
              >
                Alerts inbox <ExternalLink className="ml-0.5 h-3 w-3" />
              </Link>
            </div>
            {scorecard && (
              <div className="ml-auto flex items-center gap-3 text-sm text-gray-600">
                <span>As of {new Date(normalizeUtcIso(scorecard.as_of)).toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
        ) : null}

        {districtCode ? (
          <WorkforceDraftBanner show={showGettingStartedBanner} onOpenWizard={() => openWizard()} />
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
                  <div className="grid grid-flow-col auto-cols-fr gap-2 sm:gap-3 lg:gap-4">
                    <MetricCard
                      icon={ShieldCheck}
                      label="Readiness score"
                      tooltip="Average of critical-function coverage, certification health, retirement risk, and CEU completion (when operators are on file)."
                      onClick={() => goToTab('dashboard')}
                      value={
                        scorecard.total_employees === 0 &&
                        scorecard.total_critical_functions === 0 &&
                        scorecard.total_positions === 0
                          ? '—'
                          : `${scorecard.readiness_score} / 100`
                      }
                      hint={readinessLabel}
                      tone={
                        scorecard.total_employees === 0 &&
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
                        scorecard.coverage_pct >= 80
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
                      tone={scorecard.cert_cliff_90d > 0 ? 'warn' : 'good'}
                    />
                    <MetricCard
                      icon={CalendarClock}
                      label="Retirement-eligible (24 mo)"
                      tooltip="Employees within 24 months of retirement eligibility — plan succession and knowledge transfer."
                      onClick={() => goToTab('succession')}
                      value={scorecard.employees_retirement_eligible_24mo}
                      hint={`${scorecard.vacant_positions} positions vacant · ${scorecard.overdue_milestones} overdue milestones`}
                      tone={
                        scorecard.employees_retirement_eligible_24mo === 0 &&
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
                        tone={scorecard.ceu_shortfall_count > 0 ? 'warn' : 'good'}
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
                        <div className="flex-1 text-sm text-gray-700">
                          <p className="font-medium">No workforce data yet for this district.</p>
                          <p>
                            Use the import panel or entity tabs to add positions, employees,
                            certifications, critical functions, and role coverage.
                          </p>
                          <div className="mt-3">
                            <Button onClick={() => openWizard()}>
                              <Sparkles className="mr-1.5 h-4 w-4" />
                              {wizardPrimaryLabel}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
                  <WorkforceEntityArea
                    {...entityAreaCallbacks}
                    districtCode={districtCode}
                    entityType="succession_candidates"
                    showSampleTemplates={showSampleTemplates}
                  />
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
                    <TabsList className="mb-4">
                      <TabsTrigger value="catalog">All courses</TabsTrigger>
                      <TabsTrigger value="sessions">District sessions</TabsTrigger>
                      {isWorkforceOperator ? (
                        <TabsTrigger value="my-signups">My sign-ups</TabsTrigger>
                      ) : null}
                    </TabsList>
                    <TabsContent value="catalog">
                      <WorkforceTrainingArea
                        districtCode={districtCode}
                        canManage={canManageWorkforce}
                        onCreatedFromCatalog={() => goToTab('training', { sub: 'sessions' })}
                        {...(trainingFilters ? { initialFilters: trainingFilters } : {})}
                      />
                    </TabsContent>
                    <TabsContent value="sessions">
                      <WorkforceScheduledTrainingArea
                        districtCode={districtCode}
                        canManage={canManageWorkforce}
                        operatorSelfEnrollEnabled={
                          trainingSettings?.operator_self_enroll_enabled ?? false
                        }
                        onRecordCeu={canManageWorkforce ? recordCeuFromTraining : undefined}
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
            canManage={canManageWorkforce}
            onOpenCeuDialog={openCeuDialogForEmployee}
          />
        ) : null}

        {pageCeuOperator ? (
          <WorkforceEmployeeCeuDialog
            open={pageCeuOpen}
            onOpenChange={setPageCeuOpen}
            districtCode={districtCode}
            operator={pageCeuOperator}
            canManage={canManageWorkforce}
            initialMode={pageCeuMode}
          />
        ) : null}

        {wizardOpen && districtCode && canManageWorkforce ? (
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
