import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from '@/services/authService';

export interface FederalJobListing {
  id: string;
  title: string;
  organization: string;
  location: string;
  salary?: string | null;
  posted: string;
  url: string;
  department?: string;
}

export interface FederalJobsResponse {
  configured: boolean;
  data_mode: 'live' | 'unavailable';
  source: string;
  source_label: string;
  provenance_url: string;
  message?: string;
  as_of: string;
  total: number;
  jobs: FederalJobListing[];
  state_filter?: string | null;
}

export async function fetchFederalJobOpenings(
  state?: string | null,
  limit = 12
): Promise<FederalJobsResponse> {
  const { data } = await axios.get(`${API_BASE_URL}/jobs/federal`, {
    headers: getAuthHeader(),
    params: { state: state || undefined, limit },
  });
  return data as FederalJobsResponse;
}
