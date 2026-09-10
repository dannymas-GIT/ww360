import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { AUTH_TOKEN_KEY, getAuthHeader, type WW360User } from '@/services/authService';

export const ACTOR_TOKEN_KEY = 'ww360_actor_token';

export interface DemoPersona {
  persona_key: string;
  tier: string;
  label: string;
  subtitle?: string | null;
  narrative_bullets: string[];
  catalog_group?: string | null;
  target_user_id: number;
  username: string;
  roles: string[];
  districts: string[];
  state_code?: string | null;
  org_code?: string | null;
}

export interface ImpersonationSession {
  id: string;
  actor_user_id: number;
  target_user_id: number;
  persona_key?: string | null;
  mode: string;
  reason?: string | null;
  started_at: string;
  ended_at?: string | null;
  expires_at: string;
}

export async function fetchPersonas(): Promise<DemoPersona[]> {
  const { data } = await axios.get(`${API_BASE_URL}/impersonation/personas`, {
    headers: getAuthHeader(),
  });
  return data as DemoPersona[];
}

export async function startImpersonation(params: {
  persona_key?: string;
  target_user_id?: number;
  mode: 'preview' | 'act';
  reason?: string;
}): Promise<{ access_token: string; user: WW360User }> {
  const current = localStorage.getItem(AUTH_TOKEN_KEY);
  if (current && !localStorage.getItem(ACTOR_TOKEN_KEY)) {
    localStorage.setItem(ACTOR_TOKEN_KEY, current);
  }
  const { data } = await axios.post(`${API_BASE_URL}/impersonation/start`, params, {
    headers: getAuthHeader(),
  });
  localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  return data as { access_token: string; user: WW360User };
}

export async function stopImpersonation(): Promise<{ access_token: string; user: WW360User }> {
  const { data } = await axios.post(
    `${API_BASE_URL}/impersonation/stop`,
    {},
    { headers: getAuthHeader() }
  );
  const actorToken = localStorage.getItem(ACTOR_TOKEN_KEY);
  if (actorToken) {
    localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
    localStorage.removeItem(ACTOR_TOKEN_KEY);
  } else {
    localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  }
  return data as { access_token: string; user: WW360User };
}

export async function fetchImpersonationSessions(limit = 100): Promise<ImpersonationSession[]> {
  const { data } = await axios.get(`${API_BASE_URL}/impersonation/sessions`, {
    headers: getAuthHeader(),
    params: { limit },
  });
  return data as ImpersonationSession[];
}

export function isPreviewImpersonation(user: WW360User | null): boolean {
  return Boolean(user?.impersonation?.active && user.impersonation.mode === 'preview');
}
