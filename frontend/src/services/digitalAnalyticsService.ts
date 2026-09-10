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

/** Download EPA Area 3 quarterly package PDF (blob). */
export async function downloadEpaQuarterlyPackagePdf(): Promise<void> {
  const { data } = await axios.get(`${base}/epa-quarterly-package.pdf`, {
    headers: getAuthHeader(),
    responseType: 'blob',
  });
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `epa-area3-quarterly-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
