import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from '@/services/authService';

const grantsBase = `${API_BASE_URL}/grants`;

function headers() {
  return { ...getAuthHeader(), 'Content-Type': 'application/json' };
}

export interface GrantEligibilityRule {
  fact: string;
  op: string;
  value: unknown;
  weight?: number;
  reason?: string;
}

export interface GrantChecklistItem {
  id: string;
  label: string;
  required?: boolean;
  /** Document Studio template to open for this checklist item. */
  studio_template_id?: string;
}

export interface GrantNofoSection {
  section: string;
  hint?: string;
}

export interface GrantProgramArea {
  id: string;
  name: string;
  award_range?: string;
}

export interface GrantProgram {
  id: string;
  name: string;
  short_name?: string;
  funder?: string;
  level?: string;
  water_focus?: string;
  opportunity_number?: string;
  status?: string;
  applicant_types?: string[];
  award_min_usd?: number | null;
  award_max_usd?: number | null;
  total_funding_usd?: number | null;
  award_share_pct?: number | null;
  deadline?: string | null;
  cycle_note?: string | null;
  portal_url?: string | null;
  info_url?: string | null;
  program_areas?: GrantProgramArea[];
  application_components?: string[];
  eligibility_rules?: GrantEligibilityRule[];
  readiness_checklist?: GrantChecklistItem[];
  nofo_outline?: GrantNofoSection[];
}

export interface GrantsCatalogResponse {
  meta: Record<string, unknown>;
  count: number;
  programs: GrantProgram[];
}

export interface GrantMatchResult {
  program_id?: string;
  fit_pct?: number;
  matched?: unknown[];
  failed?: unknown[];
  missing_facts?: string[];
  [key: string]: unknown;
}

export interface GrantsMatchResponse {
  facts: Record<string, unknown>;
  matches: GrantMatchResult[];
}

export interface GrantEligibilityResponse {
  program: GrantProgram;
  facts: Record<string, unknown>;
  result: GrantMatchResult;
}

export interface EpaIwiwdAutofill {
  template_id?: string;
  opportunity_number?: string;
  deadline?: string;
  state_code?: string;
  applicant?: string;
  stats?: Record<string, unknown>;
  suggested_project_area?: string;
  narrative_bullets?: string[];
  data_mode?: string;
}

export type GrantApplicationChecklist = Record<
  string,
  {
    label?: string;
    required?: boolean;
    done?: boolean;
  }
>;

export interface GrantApplication {
  id: string;
  program_id: string;
  owner_scope: string;
  owner_code: string;
  cycle_key: string;
  status: string;
  fit_score?: number | null;
  fit_reasons?: Record<string, unknown> | null;
  missing_facts?: string[] | null;
  checklist?: GrantApplicationChecklist | null;
  auto_fill?: Record<string, unknown> | null;
  notes?: string | null;
  due_date?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GrantApplicationsResponse {
  count: number;
  applications: GrantApplication[];
}

export interface GrantApplicationCreate {
  program_id: string;
  owner_scope: 'district' | 'program' | 'state';
  owner_code: string;
  cycle_key?: string;
  status?: string;
  notes?: string | null;
  due_date?: string | null;
}

export interface GrantApplicationPatch {
  status?: string;
  notes?: string | null;
  checklist?: GrantApplicationChecklist;
  auto_fill?: Record<string, unknown>;
  due_date?: string | null;
}

export async function fetchGrantPrograms(params?: {
  water_focus?: string;
  status?: string;
  level?: string;
}): Promise<GrantsCatalogResponse> {
  const { data } = await axios.get<GrantsCatalogResponse>(`${grantsBase}/programs`, {
    headers: headers(),
    params,
  });
  return data;
}

export async function fetchGrantProgram(programId: string): Promise<GrantProgram> {
  const { data } = await axios.get<GrantProgram>(
    `${grantsBase}/programs/${encodeURIComponent(programId)}`,
    { headers: headers() }
  );
  return data;
}

export async function fetchGrantMatch(params: {
  scope?: 'program' | 'district';
  district_code?: string;
  state_code?: string;
}): Promise<GrantsMatchResponse> {
  const { data } = await axios.get<GrantsMatchResponse>(`${grantsBase}/match`, {
    headers: headers(),
    params,
  });
  return data;
}

export async function fetchGrantEligibility(
  programId: string,
  params?: {
    scope?: 'program' | 'district';
    district_code?: string;
    state_code?: string;
  }
): Promise<GrantEligibilityResponse> {
  const { data } = await axios.get<GrantEligibilityResponse>(
    `${grantsBase}/programs/${encodeURIComponent(programId)}/eligibility`,
    { headers: headers(), params }
  );
  return data;
}

export async function fetchEpaIwiwdAutofill(params?: {
  state_code?: string;
  district_code?: string;
}): Promise<EpaIwiwdAutofill> {
  const { data } = await axios.get<EpaIwiwdAutofill>(`${grantsBase}/autofill/epa-iwiwd`, {
    headers: headers(),
    params,
  });
  return data;
}

export async function fetchGrantApplications(params?: {
  owner_scope?: string;
  owner_code?: string;
  program_id?: string;
}): Promise<GrantApplicationsResponse> {
  const { data } = await axios.get<GrantApplicationsResponse>(`${grantsBase}/applications`, {
    headers: headers(),
    params,
  });
  return data;
}

export async function fetchGrantApplication(applicationId: string): Promise<GrantApplication> {
  const { data } = await axios.get<GrantApplication>(
    `${grantsBase}/applications/${encodeURIComponent(applicationId)}`,
    { headers: headers() }
  );
  return data;
}

export async function createGrantApplication(
  body: GrantApplicationCreate
): Promise<GrantApplication> {
  const { data } = await axios.post<GrantApplication>(`${grantsBase}/applications`, body, {
    headers: headers(),
  });
  return data;
}

export async function patchGrantApplication(
  applicationId: string,
  body: GrantApplicationPatch
): Promise<GrantApplication> {
  const { data } = await axios.patch<GrantApplication>(
    `${grantsBase}/applications/${encodeURIComponent(applicationId)}`,
    body,
    { headers: headers() }
  );
  return data;
}

export async function ensureEpaOwwApplication(): Promise<GrantApplication> {
  const { data } = await axios.post<GrantApplication>(
    `${grantsBase}/applications/ensure-epa-oww`,
    {},
    { headers: headers() }
  );
  return data;
}
