import axios, { isAxiosError } from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from './authService';

const base = `${API_BASE_URL}/workforce-succession`;

function jsonHeaders() {
  return { ...getAuthHeader(), 'Content-Type': 'application/json' };
}

/** Prefer FastAPI `detail` over generic axios status text. */
export function workforceApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail)) {
      const parts = detail
        .map(item => (typeof item === 'object' && item && 'msg' in item ? String(item.msg) : ''))
        .filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

function rethrowWorkforceApiError(error: unknown): never {
  throw new Error(workforceApiErrorMessage(error));
}

export type WorkforceEntityType =
  | 'positions'
  | 'employees'
  | 'certifications'
  | 'critical_functions'
  | 'role_coverage'
  | 'succession_candidates'
  | 'knowledge_artifacts'
  | 'transition_milestones';

export interface CriticalFunctionCoverage {
  function_id: number;
  function_code: string;
  function_name: string;
  function_area: string | null;
  primary_employee_codes: string[];
  backup_employee_codes: string[];
  trainee_employee_codes: string[];
  backup_count: number;
  has_qualified_backup: boolean;
  risk_level: 'ok' | 'medium' | 'high' | 'critical';
}

export interface CertificationCliffEntry {
  certification_id: number;
  employee_code: string;
  employee_name: string | null;
  certification_type: string;
  certification_grade: string | null;
  expiration_date: string | null;
  days_until_expiration: number | null;
  is_required_for_role: boolean;
}

export interface RetirementHorizonEntry {
  employee_id: number;
  employee_code: string;
  employee_name: string;
  position_code: string | null;
  retirement_eligible_date: string | null;
  months_until_eligible: number | null;
}

export interface TransitionMilestoneSummary {
  milestone_id: number;
  position_code: string;
  title: string;
  milestone_type: string;
  toolkit_phase: string;
  target_date: string | null;
  status: string;
  is_overdue: boolean;
}

export interface WorkforceContinuityScorecard {
  district_code: string;
  as_of: string;
  total_positions: number;
  funded_positions: number;
  vacant_positions: number;
  total_employees: number;
  total_critical_functions: number;
  functions_with_qualified_backup: number;
  functions_without_backup: number;
  coverage_pct: number;
  cert_cliff_30d: number;
  cert_cliff_90d: number;
  cert_cliff_365d: number;
  employees_retirement_eligible_24mo: number;
  overdue_milestones: number;
  readiness_score: number;
  ceu_shortfall_count?: number;
  ceu_avg_completion_pct?: number;
  doh352_ready_count?: number;
}

export interface WorkforceContinuityResponse {
  scorecard: WorkforceContinuityScorecard;
  coverage: CriticalFunctionCoverage[];
  cert_cliff: CertificationCliffEntry[];
  retirement_horizon: RetirementHorizonEntry[];
  upcoming_milestones: TransitionMilestoneSummary[];
}

export interface ImportRowIssue {
  row_index: number;
  field: string | null;
  message: string;
}

export interface ImportPreview {
  entity_type: string;
  district_code: string | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  sample_rows: Record<string, unknown>[];
  issues: ImportRowIssue[];
}

export interface ImportResult {
  batch_id: number;
  entity_type: string;
  district_code: string;
  status: string;
  total_rows: number;
  rows_valid: number;
  rows_invalid: number;
  rows_promoted: number;
  issues: ImportRowIssue[];
}

export interface WorkforceImportBatch {
  id: number;
  district_code: string;
  entity_type: string;
  original_filename: string | null;
  status: string;
  total_rows: number;
  rows_valid: number;
  rows_invalid: number;
  rows_promoted: number;
  validation_summary: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchWorkforceContinuity(
  districtCode: string
): Promise<WorkforceContinuityResponse> {
  try {
    const { data } = await axios.get<WorkforceContinuityResponse>(`${base}/continuity`, {
      params: { district_code: districtCode },
      headers: jsonHeaders(),
    });
    return data;
  } catch (error) {
    rethrowWorkforceApiError(error);
  }
}

export async function fetchWorkforceScorecards(
  districtCodes?: string[]
): Promise<WorkforceContinuityScorecard[]> {
  const { data } = await axios.get<WorkforceContinuityScorecard[]>(
    `${base}/continuity/scorecards`,
    {
      params: districtCodes ? { district_codes: districtCodes } : undefined,
      paramsSerializer: { indexes: null },
      headers: jsonHeaders(),
    }
  );
  return data;
}

export async function fetchImportBatches(districtCode: string): Promise<WorkforceImportBatch[]> {
  const { data } = await axios.get<WorkforceImportBatch[]>(`${base}/import/batches`, {
    params: { district_code: districtCode },
    headers: jsonHeaders(),
  });
  return data;
}

export async function downloadCsvTemplate(entity: WorkforceEntityType): Promise<string> {
  const { data } = await axios.get<string>(`${base}/templates/${entity}`, {
    headers: { ...getAuthHeader() },
    responseType: 'text',
  });
  return data;
}

export async function previewWorkforceImport(params: {
  entity_type: WorkforceEntityType;
  target_district: string;
  file: File;
}): Promise<ImportPreview> {
  const fd = new FormData();
  fd.append('file', params.file);
  const { data } = await axios.post<ImportPreview>(`${base}/import/preview`, fd, {
    params: {
      entity_type: params.entity_type,
      target_district: params.target_district,
    },
    headers: { ...getAuthHeader() },
  });
  return data;
}

export interface WorkforceAlertScanResult {
  district_code: string;
  created: number;
  skipped_duplicate: number;
  summary: Record<string, number>;
}

export async function triggerWorkforceAlertScan(
  districtCode: string
): Promise<WorkforceAlertScanResult> {
  const { data } = await axios.post<WorkforceAlertScanResult>(`${base}/alerts/scan`, null, {
    params: { district_code: districtCode },
    headers: jsonHeaders(),
  });
  return data;
}

export async function commitWorkforceImport(params: {
  entity_type: WorkforceEntityType;
  target_district: string;
  file: File;
}): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('file', params.file);
  const { data } = await axios.post<ImportResult>(`${base}/import`, fd, {
    params: {
      entity_type: params.entity_type,
      target_district: params.target_district,
    },
    headers: { ...getAuthHeader() },
  });
  return data;
}

// ---------------------------------------------------------------------------
// Planning session (resumable wizard)
// ---------------------------------------------------------------------------

export async function validateDistrictWorkforceData(
  districtCode: string
): Promise<WorkforcePlanningSessionValidateResponse & { district_code: string }> {
  const { data } = await axios.get(`${base}/data-quality`, {
    params: { district_code: districtCode },
    headers: jsonHeaders(),
  });
  return data;
}

// Legacy planning-session types retained for any stale imports; routes removed from API.

export interface WorkforcePlanningSessionRead {
  id: number;
  district_code: string;
  created_by_user_id: number | null;
  title: string | null;
  current_step: string;
  completed_steps: string[];
  status: string;
  payload: WorkforcePlanningPayload;
  validation_summary: Record<string, unknown> | null;
  last_saved_at: string;
  submitted_at: string | null;
  published_at: string | null;
  published_batch_id: number | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors backend ``parse_session_payload``: meta + one array per entity key. */
export interface WorkforcePlanningPayload {
  meta: {
    contact_name: string;
    contact_email: string;
    planning_scope_notes: string;
  };
  positions: Record<string, unknown>[];
  employees: Record<string, unknown>[];
  certifications: Record<string, unknown>[];
  critical_functions: Record<string, unknown>[];
  role_coverage: Record<string, unknown>[];
  succession_candidates: Record<string, unknown>[];
  knowledge_artifacts: Record<string, unknown>[];
  transition_milestones: Record<string, unknown>[];
}

export interface WorkforcePlanningSessionEnsureResponse {
  session: WorkforcePlanningSessionRead;
  created: boolean;
}

export interface WorkforcePlanningSessionValidateResponse {
  ok: boolean;
  entities: Record<string, unknown>;
  issues: Record<string, unknown>[];
}

export interface WorkforcePlanningSessionPublishResponse {
  session_id: number;
  district_code: string;
  status: string;
  batch_ids: number[];
  published_batch_id: number | null;
}

export async function fetchPlanningSession(
  districtCode: string
): Promise<WorkforcePlanningSessionRead | null> {
  const { data } = await axios.get<WorkforcePlanningSessionRead | null>(
    `${base}/planning-session`,
    {
      params: { district_code: districtCode },
      headers: jsonHeaders(),
    }
  );
  return data;
}

export async function ensurePlanningSession(body: {
  district_code: string;
  title?: string | null;
}): Promise<WorkforcePlanningSessionEnsureResponse> {
  const { data } = await axios.post<WorkforcePlanningSessionEnsureResponse>(
    `${base}/planning-session`,
    body,
    { headers: jsonHeaders() }
  );
  return data;
}

export async function patchPlanningSession(
  sessionId: number,
  body: {
    payload?: Partial<WorkforcePlanningPayload>;
    current_step?: string;
    completed_steps?: string[];
    title?: string | null;
    status?: string;
  }
): Promise<WorkforcePlanningSessionRead> {
  const { data } = await axios.patch<WorkforcePlanningSessionRead>(
    `${base}/planning-session/${sessionId}`,
    body,
    { headers: jsonHeaders() }
  );
  return data;
}

export async function validatePlanningSession(
  sessionId: number
): Promise<WorkforcePlanningSessionValidateResponse> {
  const { data } = await axios.post<WorkforcePlanningSessionValidateResponse>(
    `${base}/planning-session/${sessionId}/validate`,
    {},
    { headers: jsonHeaders() }
  );
  return data;
}

export async function publishPlanningSession(
  sessionId: number
): Promise<WorkforcePlanningSessionPublishResponse> {
  const { data } = await axios.post<WorkforcePlanningSessionPublishResponse>(
    `${base}/planning-session/${sessionId}/publish`,
    {},
    { headers: jsonHeaders() }
  );
  return data;
}

export async function abandonPlanningSession(
  sessionId: number
): Promise<WorkforcePlanningSessionRead> {
  const { data } = await axios.post<WorkforcePlanningSessionRead>(
    `${base}/planning-session/${sessionId}/abandon`,
    {},
    { headers: jsonHeaders() }
  );
  return data;
}

export interface WorkforceWidgetSummary {
  district_code: string;
  readiness_score: number | null;
  cert_cliff_90d: number | null;
  retirement_24mo: number | null;
  ceu_shortfall_count: number | null;
  records_missing_vouchers: number;
  ceu_shortfall_operators: Array<{
    employee_code: string;
    employee_name: string;
    remaining_hours: number;
    days_until_cycle_end: number;
  }>;
  wizard_stage: {
    current_step: string;
    completed_steps: string[];
    status: string;
  } | null;
}

export async function fetchWorkforceWidgetSummary(
  districtCode: string
): Promise<WorkforceWidgetSummary> {
  const { data } = await axios.get<WorkforceWidgetSummary>(`${base}/widget-summary`, {
    params: { district_code: districtCode },
    headers: jsonHeaders(),
  });
  return data;
}

// ---------------------------------------------------------------------------
// Entity CRUD
// ---------------------------------------------------------------------------

export type WorkforceListFilters = {
  q?: string;
  record_status?: string;
  department?: string;
  position_code?: string;
  employee_code?: string;
  function_code?: string;
  expiring_within_days?: number;
  upcoming_only?: boolean;
};

const ENTITY_PATHS: Record<WorkforceEntityType, string> = {
  positions: 'positions',
  employees: 'employees',
  certifications: 'certifications',
  critical_functions: 'critical-functions',
  role_coverage: 'role-coverage',
  succession_candidates: 'succession-candidates',
  knowledge_artifacts: 'knowledge-artifacts',
  transition_milestones: 'transition-milestones',
};

export async function fetchWorkforceEntities(
  entityType: WorkforceEntityType,
  districtCode: string,
  filters?: WorkforceListFilters
): Promise<Record<string, unknown>[]> {
  const { data } = await axios.get<Record<string, unknown>[]>(
    `${base}/${ENTITY_PATHS[entityType]}`,
    { params: { district_code: districtCode, ...filters }, headers: jsonHeaders() }
  );
  return data;
}

export async function createWorkforceEntity(
  entityType: WorkforceEntityType,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data } = await axios.post<Record<string, unknown>>(
    `${base}/${ENTITY_PATHS[entityType]}`,
    body,
    { headers: jsonHeaders() }
  );
  return data;
}

export async function updateWorkforceEntity(
  entityType: WorkforceEntityType,
  id: number,
  districtCode: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data } = await axios.patch<Record<string, unknown>>(
    `${base}/${ENTITY_PATHS[entityType]}/${id}`,
    body,
    { params: { district_code: districtCode }, headers: jsonHeaders() }
  );
  return data;
}

export async function deleteWorkforceEntity(
  entityType: WorkforceEntityType,
  id: number,
  districtCode: string
): Promise<Record<string, unknown>> {
  const { data } = await axios.delete<Record<string, unknown>>(
    `${base}/${ENTITY_PATHS[entityType]}/${id}`,
    { params: { district_code: districtCode }, headers: jsonHeaders() }
  );
  return data;
}

// ---------------------------------------------------------------------------
// CEU
// ---------------------------------------------------------------------------

export interface WorkforceCeuRecord {
  id: number;
  district_code: string;
  employee_code: string;
  course_title: string;
  provider: string | null;
  approval_number: string | null;
  ceu_hours: number;
  contact_hours: number | null;
  completion_date: string;
  certification_grade: string | null;
  category: string | null;
  record_status: string;
  voucher_count?: number;
}

export interface WorkforceCeuOperatorSummary {
  employee_code: string;
  employee_name: string;
  certification_grade: string | null;
  renewal_cycle_end: string;
  required_hours: number;
  earned_hours: number;
  remaining_hours: number;
  percent_complete: number;
  is_shortfall: boolean;
  days_until_cycle_end: number;
  record_count?: number;
  voucher_count?: number;
  records_missing_vouchers?: number;
  earned_contact_hours?: number;
  required_contact_hours?: number;
}

export interface Doh352PreviewResponse {
  fields: Record<string, unknown>;
  missing_fields: string[];
  fill_method?: string | null;
  voucher_count: number;
  voucher_manifest: Array<Record<string, unknown>>;
}

export interface WorkforceCeuVoucher {
  id: number;
  district_code: string;
  ceu_record_id: number;
  filename: string;
  content_type: string | null;
  file_extension: string;
  size_bytes: number;
  description: string | null;
  storage_kind: string;
  uploaded_by_user_id: number | null;
  created_at: string;
}

export interface WorkforceDistrictEmployerProfile {
  district_code: string;
  district_name: string | null;
  mailing_address_line1: string | null;
  mailing_address_line2: string | null;
}

export interface WorkforceCeuSummaryResponse {
  district_code: string;
  operators: WorkforceCeuOperatorSummary[];
  total_shortfall: number;
  total_operators: number;
}

export async function fetchCeuRecords(
  districtCode: string,
  filters?: { employee_code?: string; q?: string }
): Promise<WorkforceCeuRecord[]> {
  const { data } = await axios.get<WorkforceCeuRecord[]>(`${base}/ceu/records`, {
    params: { district_code: districtCode, ...filters },
    headers: jsonHeaders(),
  });
  return data;
}

export async function createCeuRecord(body: Record<string, unknown>): Promise<WorkforceCeuRecord> {
  const { data } = await axios.post<WorkforceCeuRecord>(`${base}/ceu/records`, body, {
    headers: jsonHeaders(),
  });
  return data;
}

export async function deleteCeuRecord(
  recordId: number,
  districtCode: string
): Promise<WorkforceCeuRecord> {
  const { data } = await axios.delete<WorkforceCeuRecord>(`${base}/ceu/records/${recordId}`, {
    params: { district_code: districtCode },
    headers: jsonHeaders(),
  });
  return data;
}

export async function fetchCeuSummary(districtCode: string): Promise<WorkforceCeuSummaryResponse> {
  const { data } = await axios.get<WorkforceCeuSummaryResponse>(`${base}/ceu/summary`, {
    params: { district_code: districtCode },
    headers: jsonHeaders(),
  });
  return data;
}

export async function uploadCeuVoucher(params: {
  recordId: number;
  districtCode: string;
  file: File;
  description?: string;
}): Promise<WorkforceCeuVoucher> {
  const fd = new FormData();
  fd.append('file', params.file);
  const { data } = await axios.post<WorkforceCeuVoucher>(
    `${base}/ceu/records/${params.recordId}/vouchers`,
    fd,
    {
      params: { district_code: params.districtCode, description: params.description },
      headers: { ...getAuthHeader() },
    }
  );
  return data;
}

export async function fetchCeuVouchers(
  recordId: number,
  districtCode: string
): Promise<WorkforceCeuVoucher[]> {
  const { data } = await axios.get<WorkforceCeuVoucher[]>(
    `${base}/ceu/records/${recordId}/vouchers`,
    {
      params: { district_code: districtCode },
      headers: jsonHeaders(),
    }
  );
  return data;
}

export async function downloadCeuVoucher(voucherId: number, districtCode: string): Promise<void> {
  const { data } = await axios.get<Blob>(`${base}/ceu/vouchers/${voucherId}`, {
    params: { district_code: districtCode },
    headers: { ...getAuthHeader() },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `voucher-${voucherId}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteCeuVoucher(voucherId: number, districtCode: string): Promise<void> {
  await axios.delete(`${base}/ceu/vouchers/${voucherId}`, {
    params: { district_code: districtCode },
    headers: jsonHeaders(),
  });
}

export async function fetchDistrictEmployerProfile(
  districtCode: string
): Promise<WorkforceDistrictEmployerProfile> {
  const { data } = await axios.get<WorkforceDistrictEmployerProfile>(
    `${base}/district-employer-profile`,
    {
      params: { district_code: districtCode },
      headers: jsonHeaders(),
    }
  );
  return data;
}

export async function updateDistrictEmployerProfile(
  districtCode: string,
  body: { mailing_address_line1?: string | null; mailing_address_line2?: string | null }
): Promise<WorkforceDistrictEmployerProfile> {
  const { data } = await axios.patch<WorkforceDistrictEmployerProfile>(
    `${base}/district-employer-profile`,
    body,
    {
      params: { district_code: districtCode },
      headers: jsonHeaders(),
    }
  );
  return data;
}

export async function fetchDoh352Preview(
  districtCode: string,
  employeeCode: string
): Promise<Doh352PreviewResponse> {
  const { data } = await axios.get<Doh352PreviewResponse>(
    `${base}/doh352/${employeeCode}/preview`,
    {
      params: { district_code: districtCode },
      headers: jsonHeaders(),
    }
  );
  return data;
}

export async function downloadDoh352Pdf(districtCode: string, employeeCode: string): Promise<void> {
  const { data } = await axios.get<Blob>(`${base}/doh352/${employeeCode}`, {
    params: { district_code: districtCode },
    headers: { ...getAuthHeader() },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DOH-352_${employeeCode}_${districtCode}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Training courses (statewide catalog)
// ---------------------------------------------------------------------------

export interface TrainingCourseFilters {
  cert_program?: string;
  cert_type?: string;
  course_category?: string;
  grade?: string;
  source?: string;
  upcoming_only?: boolean;
  local_metro_only?: boolean;
  q?: string;
}

export interface WorkforceTrainingCourse {
  id: number;
  state: string;
  source: string;
  cert_program: string;
  cert_type: string;
  course_category: string;
  sponsor: string;
  course_name: string;
  grade: string | null;
  start_date: string | null;
  end_date: string | null;
  cost_text: string | null;
  cost_amount: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  county: string | null;
  city: string | null;
  location_text: string | null;
  delivery_mode: string | null;
  delivery_type_label: string | null;
  contact_hours: number | null;
  description: string | null;
  source_url: string | null;
  source_anchor: string | null;
  is_active: boolean;
  last_seen_at: string;
}

export interface WorkforceTrainingCourseListResponse {
  courses: WorkforceTrainingCourse[];
  total: number;
  last_synced_at: string | null;
}

export interface WorkforceTrainingScrapeResult {
  source_url: string;
  page_content_hash: string;
  courses_parsed: number;
  courses_added: number;
  courses_updated: number;
  courses_deactivated: number;
  skipped_unchanged: boolean;
  last_synced_at: string;
}

export async function fetchTrainingCourses(
  filters?: TrainingCourseFilters
): Promise<WorkforceTrainingCourseListResponse> {
  const { data } = await axios.get<WorkforceTrainingCourseListResponse>(
    `${base}/training-courses`,
    {
      params: filters,
      headers: jsonHeaders(),
    }
  );
  return data;
}

export async function triggerTrainingScrape(): Promise<WorkforceTrainingScrapeResult> {
  const { data } = await axios.post<WorkforceTrainingScrapeResult>(
    `${base}/training-courses/scrape`,
    {},
    { headers: jsonHeaders() }
  );
  return data;
}

// ---------------------------------------------------------------------------
// CEU requirements reference
// ---------------------------------------------------------------------------

export interface CeuMandatoryCategoryRule {
  category: string;
  minimum_ceu: number;
  notes: string | null;
}

export interface CeuGradeRequirement {
  grade: string;
  role_title: string;
  cert_type: string;
  cert_program: string;
  required_ceu: number;
  renewal_cycle_years: number;
  mandatory_categories: CeuMandatoryCategoryRule[];
  acceptable_categories: string[];
  notes: string | null;
}

export interface CeuRoleRequirement {
  role_key: string;
  role_title: string;
  description: string;
  issuing_authority: string;
  cert_program: string;
  federal_citation: string;
  state_citation: string;
  grades: CeuGradeRequirement[];
}

export interface CeuRequirementsResponse {
  renewal_cycle_years: number;
  federal_citation: string;
  state_citation: string;
  regulation_sources: Record<string, string>;
  scope_notes: string[];
  default_ceu_by_grade: Record<string, number>;
  roles: CeuRoleRequirement[];
}

export async function fetchCeuRequirements(): Promise<CeuRequirementsResponse> {
  const { data } = await axios.get<CeuRequirementsResponse>(`${base}/ceu/requirements`, {
    headers: jsonHeaders(),
  });
  return data;
}

// ---------------------------------------------------------------------------
// District scheduled training
// ---------------------------------------------------------------------------

export interface ScheduledTrainingFilters {
  district_code: string;
  upcoming_only?: boolean;
  cert_type?: string;
  status?: string;
}

export interface WorkforceScheduledTraining {
  id: number;
  district_code: string;
  title: string;
  provider: string;
  location: string | null;
  delivery_mode: string;
  start_datetime: string;
  end_datetime: string | null;
  ceu_hours: number | null;
  cert_program: string;
  cert_type: string;
  target_grades: string | null;
  category: string | null;
  cost_text: string | null;
  registration_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  capacity: number | null;
  source_course_id: number | null;
  status: string;
  notes: string | null;
  record_status: string;
  created_at: string;
  updated_at: string;
  enrollment_count?: number;
  is_enrolled?: boolean;
  spots_remaining?: number | null;
  catalog_source?: string | null;
}

export interface WorkforceScheduledTrainingListResponse {
  trainings: WorkforceScheduledTraining[];
  total: number;
}

export type WorkforceScheduledTrainingCreate = Omit<
  WorkforceScheduledTraining,
  'id' | 'record_status' | 'created_at' | 'updated_at'
>;

export type WorkforceScheduledTrainingUpdate = Partial<
  Omit<WorkforceScheduledTrainingCreate, 'district_code'>
>;

export async function fetchScheduledTrainings(
  filters: ScheduledTrainingFilters
): Promise<WorkforceScheduledTrainingListResponse> {
  const { data } = await axios.get<WorkforceScheduledTrainingListResponse>(
    `${base}/scheduled-training`,
    {
      params: filters,
      headers: jsonHeaders(),
    }
  );
  return data;
}

export async function createScheduledTraining(
  body: WorkforceScheduledTrainingCreate
): Promise<WorkforceScheduledTraining> {
  const { data } = await axios.post<WorkforceScheduledTraining>(
    `${base}/scheduled-training`,
    body,
    { headers: jsonHeaders() }
  );
  return data;
}

export async function createTrainingFromCourse(
  districtCode: string,
  courseId: number
): Promise<WorkforceScheduledTraining> {
  const { data } = await axios.post<WorkforceScheduledTraining>(
    `${base}/scheduled-training/from-course/${courseId}`,
    {},
    { params: { district_code: districtCode }, headers: jsonHeaders() }
  );
  return data;
}

export async function updateScheduledTraining(
  id: number,
  districtCode: string,
  body: WorkforceScheduledTrainingUpdate
): Promise<WorkforceScheduledTraining> {
  const { data } = await axios.patch<WorkforceScheduledTraining>(
    `${base}/scheduled-training/${id}`,
    body,
    { params: { district_code: districtCode }, headers: jsonHeaders() }
  );
  return data;
}

export async function deleteScheduledTraining(
  id: number,
  districtCode: string
): Promise<WorkforceScheduledTraining> {
  const { data } = await axios.delete<WorkforceScheduledTraining>(
    `${base}/scheduled-training/${id}`,
    { params: { district_code: districtCode }, headers: jsonHeaders() }
  );
  return data;
}

export interface WorkforceTrainingEnrollment {
  id: number;
  district_code: string;
  scheduled_training_id: number;
  employee_code: string;
  status: string;
  enrolled_at: string;
  training?: WorkforceScheduledTraining | null;
}

export interface WorkforceTrainingEnrollmentListResponse {
  enrollments: WorkforceTrainingEnrollment[];
  total: number;
}

export async function enrollInScheduledTraining(
  trainingId: number,
  districtCode: string
): Promise<WorkforceTrainingEnrollment> {
  const { data } = await axios.post<WorkforceTrainingEnrollment>(
    `${base}/scheduled-training/${trainingId}/enroll`,
    {},
    { params: { district_code: districtCode }, headers: jsonHeaders() }
  );
  return data;
}

export async function cancelTrainingEnrollment(
  trainingId: number,
  districtCode: string
): Promise<WorkforceTrainingEnrollment> {
  const { data } = await axios.delete<WorkforceTrainingEnrollment>(
    `${base}/scheduled-training/${trainingId}/enroll`,
    { params: { district_code: districtCode }, headers: jsonHeaders() }
  );
  return data;
}

export async function fetchMyTrainingEnrollments(
  districtCode: string
): Promise<WorkforceTrainingEnrollmentListResponse> {
  const { data } = await axios.get<WorkforceTrainingEnrollmentListResponse>(
    `${base}/my-training-enrollments`,
    { params: { district_code: districtCode }, headers: jsonHeaders() }
  );
  return data;
}

export interface LearningStreamSeedResult {
  catalog_added: number;
  catalog_updated: number;
  district_sessions_created: number;
}

export async function seedLearningStreamCourses(
  districtCode?: string
): Promise<LearningStreamSeedResult> {
  const { data } = await axios.post<LearningStreamSeedResult>(
    `${base}/training-courses/seed-learning-stream`,
    {},
    {
      params: districtCode ? { district_code: districtCode } : undefined,
      headers: jsonHeaders(),
    }
  );
  return data;
}

export interface GeneratedDocStudioDocument {
  id: string;
  title: string;
  custody_status?: string;
  folder_id?: string | null;
}

export async function generateWorkforceDocumentationPack(
  districtCode: string
): Promise<GeneratedDocStudioDocument[]> {
  const { data } = await axios.post<GeneratedDocStudioDocument[]>(
    `${base}/districts/${encodeURIComponent(districtCode)}/generate-documentation-pack`,
    {},
    { params: { district_code: districtCode }, headers: jsonHeaders() }
  );
  return data;
}
