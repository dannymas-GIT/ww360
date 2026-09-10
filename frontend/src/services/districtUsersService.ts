/**
 * Utility-scoped user management — roles, create user, recorder grants, role catalog.
 */
import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from './authService';

export interface DistrictUser {
  id: number;
  username: string;
  email?: string | null;
  full_name?: string | null;
  roles: string[];
  district_memberships: string[];
  is_active: boolean;
  has_recorder_grant: boolean;
}

export type UtilityRoleCategory = 'administration' | 'workforce' | 'ceu' | 'operator';

export interface RoleCatalogEntry {
  key: string;
  label: string;
  tier: 'national' | 'state' | 'utility';
  description: string;
  default_enabled: boolean;
  assignable_at_utility: boolean;
  category?: UtilityRoleCategory | null;
}

export interface RoleCatalog {
  hierarchy_note: string;
  national: RoleCatalogEntry[];
  state: RoleCatalogEntry[];
  utility: RoleCatalogEntry[];
  utility_enabled: string[];
  district_code?: string | null;
  can_fine_tune: boolean;
}

export async function fetchDistrictUsers(districtCode: string): Promise<DistrictUser[]> {
  const { data } = await axios.get<DistrictUser[]>(
    `${API_BASE_URL}/districts/${encodeURIComponent(districtCode)}/users`,
    { headers: getAuthHeader() }
  );
  return data;
}

export async function createDistrictUser(
  districtCode: string,
  body: {
    username: string;
    email?: string;
    full_name?: string;
    password: string;
    roles: string[];
  }
): Promise<DistrictUser> {
  const { data } = await axios.post<DistrictUser>(
    `${API_BASE_URL}/districts/${encodeURIComponent(districtCode)}/users`,
    body,
    { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } }
  );
  return data;
}

export async function patchDistrictUser(
  districtCode: string,
  userId: number,
  body: {
    roles?: string[];
    is_active?: boolean;
    full_name?: string;
    email?: string;
    password?: string;
  }
): Promise<DistrictUser> {
  const { data } = await axios.patch<DistrictUser>(
    `${API_BASE_URL}/districts/${encodeURIComponent(districtCode)}/users/${userId}`,
    body,
    { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } }
  );
  return data;
}

export async function fetchAssignableRoles(districtCode: string): Promise<string[]> {
  const { data } = await axios.get<string[]>(
    `${API_BASE_URL}/districts/${encodeURIComponent(districtCode)}/assignable-roles`,
    { headers: getAuthHeader() }
  );
  return data;
}

export async function fetchRoleCatalog(districtCode?: string): Promise<RoleCatalog> {
  const { data } = await axios.get<RoleCatalog>(`${API_BASE_URL}/role-catalog`, {
    params: districtCode ? { district_code: districtCode } : undefined,
    headers: getAuthHeader(),
  });
  return data;
}

export async function patchDistrictRoleSettings(
  districtCode: string,
  enabledRoles: string[],
  notes?: string
): Promise<RoleCatalog> {
  const { data } = await axios.patch<RoleCatalog>(
    `${API_BASE_URL}/districts/${encodeURIComponent(districtCode)}/role-settings`,
    { enabled_roles: enabledRoles, notes },
    { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } }
  );
  return data;
}
