import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from './authService';

const base = `${API_BASE_URL}/sdwis`;

export interface SDWISWaterSystem {
  id: number;
  pwsid: string;
  district_code?: string | null;
  pws_name?: string | null;
  state_code?: string | null;
  epa_region?: string | null;
  registry_id?: string | null;
  population_served?: number | null;
  serious_violator?: string | null;
  health_flag?: string | null;
  snc?: string | null;
  qtrs_with_vio?: number | null;
  qtrs_with_snc?: number | null;
  compliance_qtrs_history?: string | null;
  contaminants_in_current_violation?: string | null;
  violation_categories?: string | null;
  dfr_url?: string | null;
  facility_status?: string | null;
  last_synced_at?: string | null;
}

export interface SDWISystemDetail {
  system: SDWISWaterSystem;
  violation_count: number;
  open_violation_count: number;
  enforcement_count: number;
  raw_compliance_status?: Record<string, string> | null;
}

export interface SDWISViolation {
  id: number;
  pwsid: string;
  violation_epa_id: string;
  rule_name?: string | null;
  contaminant_name?: string | null;
  category_code?: string | null;
  category_desc?: string | null;
  violation_measure?: string | null;
  state_mcl?: string | null;
  federal_mcl?: string | null;
  compliance_period_begin?: string | null;
  compliance_period_end?: string | null;
  non_compliance_begin?: string | null;
  non_compliance_end?: string | null;
  resolved_date?: string | null;
  status?: string | null;
  last_synced_at?: string | null;
}

export interface SDWISEnforcement {
  id: number;
  pwsid: string;
  enforcement_epa_id: string;
  enforcement_type?: string | null;
  action_description?: string | null;
  action_date?: string | null;
  agency?: string | null;
  last_synced_at?: string | null;
}

export interface SDWISComplianceSummary {
  systems_linked: number;
  total_open_violations: number;
  systems_with_health_flag: number;
  systems_in_snc: number;
  systems: SDWISWaterSystem[];
}

export interface SDWISLookupRow {
  pwsid: string;
  pws_name?: string | null;
  state_code?: string | null;
  population_served?: string | null;
  snc?: string | null;
}

/** EPA name search term from a district display name (strips trailing parenthetical codes). */
export function derivePwsSearchQuery(
  districtName: string | undefined | null,
  districtCode?: string
): string {
  const code = (districtCode || '').trim();
  let name = (districtName || '').trim();
  if (!name) return code;
  // Strip trailing "(WHWD)" style codes
  name = name.replace(/\s*\([A-Za-z0-9_-]+\)\s*$/, '').trim();
  // EPA facility names are often short ("WEST HEMPSTEAD WD"); full district
  // names like "West Hempstead Water District" return zero p_fn matches.
  name = name
    .replace(
      /\s+(water\s+district|water\s+dept(?:artment)?|water\s+company|public\s+water\s+system|municipal\s+water|pws|wd)\.?$/i,
      ''
    )
    .trim();
  name = name.replace(/\s+water\.?$/i, '').trim();
  return name.length >= 2 ? name : code;
}

function axiosDetailMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const parts = detail
        .map((d: { msg?: string } | string) =>
          typeof d === 'string' ? d : typeof d?.msg === 'string' ? d.msg : ''
        )
        .filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function pwsNameTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s\-_,./()]+/)
      .filter(t => t.length > 1)
  );
}

/** Sort EPA lookup rows so the closest name matches appear first. */
export function rankPwsLookupRows(rows: SDWISLookupRow[], query: string): SDWISLookupRow[] {
  const q = query.trim().toLowerCase();
  if (!q || rows.length <= 1) return rows;

  const qTokens = pwsNameTokens(q);
  const scored = rows.map(row => {
    const name = (row.pws_name || '').toLowerCase();
    let score = 0;
    if (name === q) score = 1000;
    else if (name.startsWith(q)) score = 800;
    else if (name.includes(q)) score = 600;
    else {
      const nameTokens = pwsNameTokens(name);
      for (const t of qTokens) {
        if (nameTokens.has(t)) score += 100;
      }
    }
    return { row, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || (a.row.pws_name || '').localeCompare(b.row.pws_name || ''))
    .map(s => s.row);
}

function headers() {
  return { ...getAuthHeader(), 'Content-Type': 'application/json' };
}

export async function fetchLinkedSystems(): Promise<SDWISWaterSystem[]> {
  const { data } = await axios.get<SDWISWaterSystem[]>(`${base}/systems`, { headers: headers() });
  return data;
}

export async function fetchSystemDetail(pwsid: string): Promise<SDWISystemDetail> {
  const { data } = await axios.get<SDWISystemDetail>(
    `${base}/systems/${encodeURIComponent(pwsid)}`,
    {
      headers: headers(),
    }
  );
  return data;
}

export async function fetchViolations(
  pwsid: string,
  params?: { skip?: number; limit?: number }
): Promise<SDWISViolation[]> {
  const { data } = await axios.get<SDWISViolation[]>(
    `${base}/systems/${encodeURIComponent(pwsid)}/violations`,
    { headers: headers(), params }
  );
  return data;
}

export async function fetchEnforcement(
  pwsid: string,
  params?: { skip?: number; limit?: number }
): Promise<SDWISEnforcement[]> {
  const { data } = await axios.get<SDWISEnforcement[]>(
    `${base}/systems/${encodeURIComponent(pwsid)}/enforcement-actions`,
    { headers: headers(), params }
  );
  return data;
}

export async function linkSystem(
  pwsid: string,
  districtCode?: string
): Promise<{
  success: boolean;
  pwsid: string;
  message: string;
  violations_synced: number;
  enforcement_synced: number;
}> {
  try {
    const { data } = await axios.post(
      `${base}/systems/link`,
      { pwsid, district_code: districtCode || null },
      { headers: headers() }
    );
    return data;
  } catch (err) {
    throw new Error(axiosDetailMessage(err, 'Link failed'));
  }
}

export async function syncSystem(pwsid: string): Promise<{
  success: boolean;
  pwsid: string;
  violations_synced: number;
  enforcement_synced: number;
  last_synced_at?: string | null;
}> {
  const { data } = await axios.post(
    `${base}/systems/${encodeURIComponent(pwsid)}/sync`,
    {},
    { headers: headers() }
  );
  return data;
}

export async function fetchComplianceSummary(): Promise<SDWISComplianceSummary> {
  const { data } = await axios.get<SDWISComplianceSummary>(`${base}/compliance-summary`, {
    headers: headers(),
  });
  return data;
}

export async function lookupSystems(state: string, q?: string): Promise<SDWISLookupRow[]> {
  try {
    const { data } = await axios.get<SDWISLookupRow[]>(`${base}/lookup`, {
      headers: headers(),
      params: { state: state.toUpperCase().slice(0, 2), q: q || undefined },
    });
    return data;
  } catch (err) {
    throw new Error(axiosDetailMessage(err, 'EPA search failed'));
  }
}

export interface SDWISDistrictRememberedPwsid {
  district_code: string;
  pwsid: string;
  updated_at: string;
}

export async function fetchDistrictRememberedPwsids(): Promise<SDWISDistrictRememberedPwsid[]> {
  const { data } = await axios.get<SDWISDistrictRememberedPwsid[]>(
    `${base}/district-remembered-pwsids`,
    { headers: headers() }
  );
  return data;
}

export async function saveDistrictRememberedPwsid(
  districtCode: string,
  pwsid: string
): Promise<SDWISDistrictRememberedPwsid> {
  const { data } = await axios.put<SDWISDistrictRememberedPwsid>(
    `${base}/district-remembered-pwsids/${encodeURIComponent(districtCode)}`,
    { pwsid: pwsid.trim().toUpperCase() },
    { headers: headers() }
  );
  return data;
}

export interface SDWISWorkforceInsights {
  state_code: string;
  active_cws_count: number;
  total_population_served: number;
  health_violation_systems: number;
  serious_violator_count: number;
  snc_count: number;
  size_tiers: Record<string, number>;
  grade_demand_estimate: Record<string, number>;
  compliance_pressure_by_county: Array<Record<string, unknown>>;
  member_watchlist: Array<Record<string, unknown>>;
  coverage: Record<string, unknown>;
  last_refreshed?: string | null;
}

export async function fetchWorkforceInsights(state = 'NY'): Promise<SDWISWorkforceInsights> {
  const { data } = await axios.get<SDWISWorkforceInsights>(`${base}/workforce-insights`, {
    headers: headers(),
    params: { state },
  });
  return data;
}
