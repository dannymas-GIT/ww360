import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from './authService';

const base = `${API_BASE_URL}/documentation-tasks`;

function headers() {
  return { ...getAuthHeader(), 'Content-Type': 'application/json' };
}

export type DocumentationTaskStatus =
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'changes_requested'
  | 'approved'
  | 'published'
  | 'overdue';

export interface DocumentationTaskNote {
  id: number;
  task_id: number;
  author_id?: number | null;
  body: string;
  progress_pct?: number | null;
  created_at: string;
}

export interface DocumentationTask {
  id: number;
  district_code: string;
  assignee_user_id: number;
  assigned_by?: number | null;
  critical_function_id?: number | null;
  title: string;
  instructions?: string | null;
  capture_mode?: string | null;
  due_at?: string | null;
  status: DocumentationTaskStatus;
  document_id?: string | null;
  created_at: string;
  updated_at: string;
  notes?: DocumentationTaskNote[];
}

export interface DocumentationTaskSummary {
  open: number;
  due_soon: number;
  overdue: number;
  review_queue: number;
}

export interface RecorderAccess {
  can_record: boolean;
  reason?: string | null;
  open_task_ids: number[];
}

export async function fetchTaskSummary(districtCode: string): Promise<DocumentationTaskSummary> {
  const { data } = await axios.get<DocumentationTaskSummary>(`${base}/summary`, {
    params: { district_code: districtCode },
    headers: headers(),
  });
  return data;
}

export async function fetchDistrictTasks(districtCode: string): Promise<DocumentationTask[]> {
  const { data } = await axios.get<DocumentationTask[]>(base, {
    params: { district_code: districtCode },
    headers: headers(),
  });
  return data;
}

export async function fetchMyTasks(): Promise<DocumentationTask[]> {
  const { data } = await axios.get<DocumentationTask[]>(`${base}/my`, { headers: headers() });
  return data;
}

export async function addTaskNote(
  taskId: number,
  body: string,
  progressPct?: number
): Promise<DocumentationTaskNote> {
  const { data } = await axios.post<DocumentationTaskNote>(`${base}/${taskId}/notes`, {
    body,
    progress_pct: progressPct,
  }, { headers: headers() });
  return data;
}

export async function submitTaskForReview(
  taskId: number,
  documentId: string
): Promise<DocumentationTask> {
  const { data } = await axios.post<DocumentationTask>(`${base}/${taskId}/submit`, {
    document_id: documentId,
  }, { headers: headers() });
  return data;
}

export async function requestTaskChanges(
  taskId: number,
  body: string
): Promise<DocumentationTask> {
  const { data } = await axios.post<DocumentationTask>(
    `${base}/${taskId}/request-changes`,
    { body },
    { headers: headers() }
  );
  return data;
}

export async function approveTask(taskId: number): Promise<DocumentationTask> {
  const { data } = await axios.post<DocumentationTask>(`${base}/${taskId}/approve`, undefined, {
    headers: headers(),
  });
  return data;
}

export async function fetchRecorderAccess(districtCode: string): Promise<RecorderAccess> {
  const { data } = await axios.get<RecorderAccess>(`${base}/recorder-access`, {
    params: { district_code: districtCode },
    headers: headers(),
  });
  return data;
}
