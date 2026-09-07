import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from '@/services/authService';

export interface EconomicRegion {
  id: string;
  label: string;
}

export interface ExecTourCopy {
  intro: string;
  sources: string;
  sdwis: string;
}

export interface JurisdictionPack {
  state_code: string;
  partner_name: string;
  section_eyebrow: string;
  geography_phrase: string;
  landing_tagline: string;
  landing_headline_accent: string;
  exec_description: string;
  landscape_description: string;
  sdwis_default_state: string;
  economic_regions: EconomicRegion[];
  exec_tour: ExecTourCopy;
  analytics_geo_hints: string[];
}

export interface JurisdictionOrg {
  org_code: string;
  name: string;
  state_code: string;
  partner_label?: string | null;
  section_label?: string | null;
  content_pack_key: string;
  is_active: boolean;
}

export interface AdminJurisdiction {
  org_code: string;
  name: string;
  state_code: string;
  partner_label?: string | null;
  section_label?: string | null;
  logo_url?: string | null;
  content_pack_key: string;
  website_url?: string | null;
  is_active: boolean;
  member_count: number;
  district_count: number;
}

export interface OrgMember {
  id: string;
  user_id: number;
  username: string;
  org_code: string;
  role: string;
}

export async function fetchPublicJurisdictionPack(state: string): Promise<JurisdictionPack> {
  const code = state.trim().toUpperCase().slice(0, 2);
  const { data } = await axios.get(`${API_BASE_URL}/public/ww360/jurisdictions/${code}/pack`);
  return data;
}

export async function fetchJurisdictionPack(state: string): Promise<JurisdictionPack> {
  const code = state.trim().toUpperCase().slice(0, 2);
  const { data } = await axios.get(`${API_BASE_URL}/jurisdictions/${code}/pack`, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function fetchJurisdictionList(): Promise<{
  states: string[];
  organizations: JurisdictionOrg[];
}> {
  const { data } = await axios.get(`${API_BASE_URL}/jurisdictions`, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function fetchAdminJurisdictions(): Promise<AdminJurisdiction[]> {
  const { data } = await axios.get(`${API_BASE_URL}/admin/jurisdictions`, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function patchAdminJurisdiction(
  orgCode: string,
  body: Partial<Pick<AdminJurisdiction, 'name' | 'partner_label' | 'section_label' | 'is_active'>>
): Promise<AdminJurisdiction> {
  const { data } = await axios.patch(`${API_BASE_URL}/admin/jurisdictions/${orgCode}`, body, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function fetchOrgMembers(orgCode: string): Promise<OrgMember[]> {
  const { data } = await axios.get(`${API_BASE_URL}/admin/jurisdictions/${orgCode}/members`, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function addOrgMember(
  orgCode: string,
  userId: number,
  role = 'state_admin'
): Promise<OrgMember> {
  const { data } = await axios.post(
    `${API_BASE_URL}/admin/jurisdictions/${orgCode}/members`,
    { user_id: userId, role },
    { headers: getAuthHeader() }
  );
  return data;
}

export async function setActiveState(stateCode: string): Promise<{
  access_token: string;
  user: import('@/services/authService').WW360User;
}> {
  const { data } = await axios.post(
    `${API_BASE_URL}/auth/active-state`,
    { state_code: stateCode.trim().toUpperCase().slice(0, 2) },
    { headers: getAuthHeader() }
  );
  return data;
}

export const ACTIVE_STATE_KEY = 'ww360-active-state';

export function getStateHeader(state: string | null | undefined): Record<string, string> {
  if (!state) return {};
  return { 'X-WW360-State': state.trim().toUpperCase().slice(0, 2) };
}
