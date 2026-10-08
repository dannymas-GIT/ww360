import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from './authService';

export interface AdminUser {
  id: number;
  username: string;
  email?: string | null;
  full_name?: string | null;
  roles: string[];
  is_active: boolean;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data } = await axios.get<AdminUser[]>(`${API_BASE_URL}/admin/users`, {
    headers: getAuthHeader(),
  });
  return data;
}

/** Utility administrator org roster (OWW-linked memberships). */
export async function fetchOrgMembers(): Promise<AdminUser[]> {
  const { data } = await axios.get<AdminUser[]>(`${API_BASE_URL}/admin/users/org-members`, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function patchAdminUser(
  userId: number,
  body: Partial<Pick<AdminUser, 'roles' | 'is_active' | 'full_name' | 'email'>>
): Promise<AdminUser> {
  const { data } = await axios.patch<AdminUser>(`${API_BASE_URL}/admin/users/${userId}`, body, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function resetAdminUserPassword(
  userId: number,
  password: string
): Promise<{ id: number; username: string; ok: boolean }> {
  const { data } = await axios.post<{ id: number; username: string; ok: boolean }>(
    `${API_BASE_URL}/admin/users/${userId}/reset-password`,
    { password },
    { headers: getAuthHeader() }
  );
  return data;
}

export async function inviteAdminUser(body: {
  email: string;
  full_name?: string;
  roles?: string[];
}): Promise<{ id: string; email: string; invite_url: string; expires_at: string }> {
  const { data } = await axios.post(`${API_BASE_URL}/admin/users/invite`, body, {
    headers: getAuthHeader(),
  });
  return data;
}
