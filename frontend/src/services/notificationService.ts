import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from './authService';

const base = `${API_BASE_URL}/notifications`;

function headers() {
  return { ...getAuthHeader(), 'Content-Type': 'application/json' };
}

export interface NotificationItem {
  id: number;
  user_id: number;
  district_code?: string | null;
  category: string;
  title: string;
  body?: string | null;
  link_path?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationSummary {
  unread: number;
}

export async function fetchNotificationSummary(): Promise<NotificationSummary> {
  const { data } = await axios.get<NotificationSummary>(`${base}/summary`, { headers: headers() });
  return data;
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const { data } = await axios.get<NotificationItem[]>(base, { headers: headers() });
  return data;
}

export async function markNotificationRead(id: number): Promise<NotificationItem> {
  const { data } = await axios.post<NotificationItem>(`${base}/${id}/read`, undefined, {
    headers: headers(),
  });
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await axios.post(`${base}/read-all`, undefined, { headers: headers() });
}
