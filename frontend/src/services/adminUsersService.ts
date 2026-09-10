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
