import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from '@/services/authService';

export interface NationalOverview {
  as_of: string;
  headline_kpis: Record<string, Record<string, unknown>>;
  states: Array<{
    state_code: string;
    active_cws: number;
    health_violations: number;
    snc_count: number;
    population_served: number;
    dwsrf_allotment_usd?: number | null;
    operator_annual_openings?: number | null;
    certified_operators?: number | null;
    systems_per_operator?: number | null;
  }>;
  program_adoption: { live_state_orgs: number; enrolled_districts: number };
  sources_freshness: Array<{ source: string; last_fetched?: string | null; metric_count?: number }>;
}

export async function fetchNationalOverview(): Promise<NationalOverview> {
  const { data } = await axios.get(`${API_BASE_URL}/national/overview`, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function fetchStateScorecard(stateCode: string) {
  const { data } = await axios.get(`${API_BASE_URL}/national/states/${stateCode}`, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function fetchStateWorkforce(stateCode: string) {
  const { data } = await axios.get(`${API_BASE_URL}/state/${stateCode}/workforce`, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function fetchKpis(ownerScope?: string, ownerCode?: string) {
  const { data } = await axios.get(`${API_BASE_URL}/kpis`, {
    headers: getAuthHeader(),
    params: { owner_scope: ownerScope, owner_code: ownerCode },
  });
  return data;
}
