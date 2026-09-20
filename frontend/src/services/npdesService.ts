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

export interface NpdesPreviewQuarter {
  label: string;
  period?: string | null;
  status?: string | null;
}

export interface NpdesPreviewEffluentQuarter {
  label: string;
  status?: string | null;
  value?: string | null;
}

export interface NpdesPreviewEffluentParameter {
  name?: string | null;
  discharge_point?: string | null;
  monitoring_location?: string | null;
  measurement_type?: string | null;
  quarters: NpdesPreviewEffluentQuarter[];
}

export interface NpdesPreviewFormalAction {
  action_id?: string | null;
  action_date?: string | null;
  action_type?: string | null;
  description?: string | null;
  agency?: string | null;
  penalty?: string | null;
}

export interface NpdesPreviewNotice {
  notice_date?: string | null;
  notice_type?: string | null;
  description?: string | null;
  agency?: string | null;
}

export interface NpdesPreview {
  npdes_id: string;
  facility_name?: string | null;
  address?: string | null;
  county?: string | null;
  state_code?: string | null;
  epa_region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  major_minor?: string | null;
  design_flow_mgd?: number | null;
  total_design_flow?: number | null;
  snc?: string | null;
  qtrs_with_nc?: number | null;
  plant_class?: string | null;
  permit_type?: string | null;
  facility_type_code?: string | null;
  sic_code?: string | null;
  owner_type?: string | null;
  permit_effective?: string | null;
  permit_expiration?: string | null;
  dfr_url?: string | null;
  rnc_quarters: NpdesPreviewQuarter[];
  effluent_parameters: NpdesPreviewEffluentParameter[];
  formal_actions: NpdesPreviewFormalAction[];
  notices: NpdesPreviewNotice[];
  sections_present: string[];
  source: string;
  preview_only: boolean;
}

/** Live EPA DFR preview for one NPDES permit (session only — nothing is linked). */
export async function fetchNpdesPreview(
  npdesId: string,
  state?: string
): Promise<NpdesPreview> {
  const { data } = await axios.get<NpdesPreview>(
    `${npdesBase}/preview/${encodeURIComponent(npdesId)}`,
    {
      headers: headers(),
      params: state ? { state: state.toUpperCase().slice(0, 2) } : undefined,
      timeout: 45000,
    }
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
