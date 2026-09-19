import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from './authService';

const npdesBase = `${API_BASE_URL}/npdes`;
const facilitiesBase = `${API_BASE_URL}/facilities`;

export interface NpdesFacility {
  state_code: string;
  npdes_id: string;
  facility_name?: string | null;
  county?: string | null;
  facility_type_code?: string | null;
  permit_type?: string | null;
  major_minor?: string | null;
  sic_code?: string | null;
  design_flow_mgd?: number | null;
  total_design_flow?: number | null;
  permit_effective?: string | null;
  permit_expiration?: string | null;
  snc?: string | null;
  qtrs_with_nc?: number | null;
  owner_type?: string | null;
  plant_class?: string | null;
  last_refreshed?: string | null;
}

export interface NpdesLandscape {
  state_code: string;
  count: number;
  major_count: number;
  facilities: NpdesFacility[];
}

export interface ExtFacility {
  publisher?: string | null;
  facility_id?: string | null;
  district_code?: string | null;
  facility_type?: string | null;
  name?: string | null;
  state_code?: string | null;
  pwsid?: string | null;
  npdes_id?: string | null;
  spdes_id?: string | null;
  plant_class?: string | null;
  design_flow_mgd?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active?: boolean | null;
  version?: number | null;
}

export interface FacilitiesListResponse {
  count: number;
  facilities: ExtFacility[];
}

function headers() {
  return { ...getAuthHeader(), 'Content-Type': 'application/json' };
}

export async function fetchNpdesLandscape(
  state: string,
  params?: { major_only?: boolean; q?: string; limit?: number }
): Promise<NpdesLandscape> {
  const { data } = await axios.get<NpdesLandscape>(`${npdesBase}/landscape`, {
    headers: headers(),
    params: { state: state.toUpperCase().slice(0, 2), ...params },
  });
  return data;
}

export async function fetchNpdesFacility(npdesId: string): Promise<NpdesFacility> {
  const { data } = await axios.get<NpdesFacility>(
    `${npdesBase}/facilities/${encodeURIComponent(npdesId)}`,
    { headers: headers() }
  );
  return data;
}

export async function fetchFacilitiesList(params?: {
  district_code?: string;
  facility_type?: string;
  state_code?: string;
  limit?: number;
}): Promise<FacilitiesListResponse> {
  const { data } = await axios.get<FacilitiesListResponse>(facilitiesBase, {
    headers: headers(),
    params,
  });
  return data;
}
