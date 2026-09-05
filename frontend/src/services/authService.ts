import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';

export const AUTH_TOKEN_KEY = 'ww360-auth-token';
export const MODULE_CORE = 'core';
export const MODULE_WORKFORCE = 'workforce';

export interface WW360User {
  id: number;
  username: string;
  email?: string | null;
  full_name?: string | null;
  roles: string[];
  districts: string[];
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
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
