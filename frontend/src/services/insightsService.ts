import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from '@/services/authService';

const insightsBase = `${API_BASE_URL}/insights`;

export type InsightsPersona = 'jenny' | 'regulator' | 'utility';

export interface InsightsCorrelationCard {
  id: string;
  title: string;
  summary: string;
  data_mode?: string;
  persona_relevance?: string[];
  persona_match?: boolean;
  notes?: string[];
  counties?: Array<Record<string, unknown>>;
  rows?: Array<Record<string, unknown>>;
  strength?: number | null;
  metrics?: Array<{ label: string; value: string }>;
  sources?: string[];
  href?: string | null;
}

export interface InsightsPersonaBrief {
  id: string;
  label?: string;
  audience?: string;
  focus?: string[];
  default_correlations?: string[];
}

export interface InsightsOverview {
  state_code?: string;
  persona?: string;
  persona_brief?: InsightsPersonaBrief;
  as_of?: string | null;
  headline?: string | null;
  correlations: InsightsCorrelationCard[];
  correlation_ids?: string[];
  data_mode?: string;
  message?: string;
}

function headers() {
  return { ...getAuthHeader(), 'Content-Type': 'application/json' };
}

export async function fetchInsightsOverview(params?: {
  state?: string;
  persona?: InsightsPersona | string;
}): Promise<InsightsOverview> {
  const { data } = await axios.get<InsightsOverview>(`${insightsBase}/overview`, {
    headers: headers(),
    params,
  });
  return {
    ...data,
    correlations: Array.isArray(data?.correlations) ? data.correlations : [],
  };
}
