import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from './authService';
import type { DigitalPropertyId, DigitalPropertyReport, DigitalRange } from '@/pages/analytics/digitalAnalyticsTypes';

const base = `${API_BASE_URL}/analytics`;

export async function fetchDigitalPropertyReport(
  property: DigitalPropertyId,
  range: DigitalRange
): Promise<DigitalPropertyReport> {
  const { data } = await axios.get<DigitalPropertyReport>(`${base}/digital`, {
    headers: getAuthHeader(),
    params: { property, range },
  });
  return data;
}

export interface DigitalTeaser {
  ww360Sessions30d: number;
  owwOrganicClicks30d: number;
  lsCatalogSessions30d: number;
  blendedSeoImpressions30d: number;
}

export async function fetchDigitalTeaser(): Promise<DigitalTeaser> {
  const { data } = await axios.get<DigitalTeaser>(`${base}/digital/teaser`, {
    headers: getAuthHeader(),
  });
  return data;
}
