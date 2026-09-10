import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from './authService';

export interface AccessibleDistrict {
  district_code: string;
  district_name: string | null;
}

interface TenantDistrictsResponse {
  districts: Array<{ code: string; name: string | null }>;
}

/**
 * Districts the current user may access (from GET /tenant/districts).
 */
export async function fetchAccessibleDistricts(): Promise<AccessibleDistrict[]> {
  const { data } = await axios.get<TenantDistrictsResponse>(`${API_BASE_URL}/tenant/districts`, {
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
  });
  return (data.districts || []).map(d => ({
    district_code: d.code,
    district_name: d.name,
  }));
}
