import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { clearWw360TourStorage } from '@/components/ww360/Ww360TourOverlay';

export const AUTH_TOKEN_KEY = 'ww360-auth-token';
export const MODULE_CORE = 'core';
export const MODULE_WORKFORCE = 'workforce';

export interface OrgMembership {
  org_code: string;
  state_code: string;
  name: string;
  role: string;
  content_pack_key?: string | null;
}

export interface WW360User {
  id: number;
  username: string;
  email?: string | null;
  full_name?: string | null;
  roles: string[];
  districts: string[];
  active_state_code?: string;
  active_org_code?: string | null;
  is_national_admin?: boolean;
  orgs?: OrgMembership[];
}

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(username: string, password: string) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
  localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  return data as { access_token: string; user: WW360User };
}

export const SSO_PENDING_KEY = 'ww360.auth.sso-pending';

export type SsoProviderId = 'microsoft_graph' | 'google_drive';

export async function fetchSsoProviders(): Promise<Array<{ id: SsoProviderId; label: string }>> {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/auth/sso/providers`);
    return (data?.providers || []) as Array<{ id: SsoProviderId; label: string }>;
  } catch {
    return [];
  }
}

export async function getSsoAuthUrl(provider: SsoProviderId, redirectUri: string, state: string) {
  const { data } = await axios.get(`${API_BASE_URL}/auth/sso/auth-url`, {
    params: { provider, redirect_uri: redirectUri, state },
  });
  return data as { auth_url: string; provider: string; redirect_uri: string };
}

export async function completeSsoCallback(params: {
  provider: SsoProviderId;
  code: string;
  redirectUri: string;
  state?: string;
}) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/sso/callback`, {
    provider: params.provider,
    code: params.code,
    redirect_uri: params.redirectUri,
    state: params.state,
  });
  localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  return data as {
    access_token: string;
    user: WW360User;
    library_provider?: string;
    library_linked?: boolean;
  };
}

export async function redeemHandoff(code: string) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/handoff`, { code });
  localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  return data as { access_token: string; user: WW360User };
}

export async function fetchMe(): Promise<WW360User> {
  const { data } = await axios.get(`${API_BASE_URL}/auth/me`, { headers: getAuthHeader() });
  return data;
}

export function logout() {
  clearWw360TourStorage();
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
