/**
 * Document Studio API client — `/api/v1/doc-studio`.
 */
import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from './authService';

const BASE = `${API_BASE_URL}/doc-studio`;

export type DocStatus = 'draft' | 'published' | 'archived';

export interface DocStudioAccess {
  scope: string;
  scope_label: string;
  can_view: boolean;
  can_author: boolean;
  can_publish: boolean;
  can_manage_folders: boolean;
  roles: string[];
}

export interface DocFolder {
  id: string;
  scope: string;
  parent_id: string | null;
  name: string;
  description?: string | null;
  sort_order: number;
  is_system: boolean;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocSummary {
  id: string;
  title: string;
  scope: string | null;
  folder_id: string | null;
  doc_type: 'document' | 'imported_file' | string;
  status: DocStatus | string;
  summary?: string | null;
  tags?: string[] | null;
  template_id?: string | null;
  version_no: number;
  word_count: number;
  source_filename?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
}

export interface DocDetail extends DocSummary {
  content_markdown: string;
  content_json?: Record<string, unknown> | null;
}

export interface DocVersion {
  id: string;
  document_id: string;
  version_no: number;
  title?: string | null;
  note?: string | null;
  kind: 'save' | 'publish' | 'restore' | 'import' | string;
  created_by?: number | null;
  created_at: string;
}

export interface DocVersionDetail extends DocVersion {
  content_markdown: string;
  content_json?: Record<string, unknown> | null;
}

export interface DocAsset {
  id: string;
  document_id: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string;
  created_at: string;
}

export interface DocStudioStats {
  folders: number;
  documents: number;
  drafts: number;
  published: number;
  words: number;
  recent: DocSummary[];
}

const cfg = (params?: Record<string, unknown>) => ({ headers: getAuthHeader(), params });

export async function fetchAccess(scope?: string): Promise<DocStudioAccess> {
  const { data } = await axios.get(`${BASE}/access`, cfg({ scope }));
  return data;
}

export async function fetchStats(scope?: string): Promise<DocStudioStats> {
  const { data } = await axios.get(`${BASE}/stats`, cfg({ scope }));
  return data;
}

export async function fetchFolders(scope?: string): Promise<DocFolder[]> {
  const { data } = await axios.get(`${BASE}/folders`, cfg({ scope }));
  return data;
}

export async function createFolder(
  payload: { name: string; parent_id?: string | null; description?: string | null },
  scope?: string
): Promise<DocFolder> {
  const { data } = await axios.post(`${BASE}/folders`, payload, cfg({ scope }));
  return data;
}

export async function updateFolder(
  id: string,
  payload: Partial<Pick<DocFolder, 'name' | 'parent_id' | 'description' | 'sort_order'>>,
  scope?: string
): Promise<DocFolder> {
  const { data } = await axios.patch(`${BASE}/folders/${id}`, payload, cfg({ scope }));
  return data;
}

export async function deleteFolder(id: string, scope?: string): Promise<void> {
  await axios.delete(`${BASE}/folders/${id}`, cfg({ scope }));
}

export async function fetchDocuments(
  opts: {
    folder_id?: string | null | undefined;
    q?: string | undefined;
    status?: DocStatus | undefined;
    include_archived?: boolean | undefined;
  } = {},
  scope?: string
): Promise<DocSummary[]> {
  const { data } = await axios.get(`${BASE}/documents`, cfg({ scope, ...opts }));
  return data;
}

export async function fetchDocument(id: string, scope?: string): Promise<DocDetail> {
  const { data } = await axios.get(`${BASE}/documents/${id}`, cfg({ scope }));
  return data;
}

export async function createDocument(
  payload: {
    title: string;
    folder_id?: string | null | undefined;
    template_id?: string | null | undefined;
    content_markdown?: string | undefined;
    summary?: string | null | undefined;
    tags?: string[] | null | undefined;
  },
  scope?: string
): Promise<DocDetail> {
  const { data } = await axios.post(`${BASE}/documents`, payload, cfg({ scope }));
  return data;
}

export async function importDocument(
  file: File,
  opts: { folder_id?: string | null | undefined; title?: string | undefined } = {},
  scope?: string
): Promise<DocDetail> {
  const form = new FormData();
  form.append('file', file, file.name);
  if (opts.folder_id) form.append('folder_id', opts.folder_id);
  if (opts.title) form.append('title', opts.title);
  const { data } = await axios.post(`${BASE}/documents/import`, form, cfg({ scope }));
  return data;
}

export async function updateDocument(
  id: string,
  payload: { title?: string; folder_id?: string | null; summary?: string | null; tags?: string[] | null; status?: DocStatus },
  scope?: string
): Promise<DocDetail> {
  const { data } = await axios.patch(`${BASE}/documents/${id}`, payload, cfg({ scope }));
  return data;
}

export async function saveContent(
  id: string,
  payload: {
    content_markdown: string;
    content_json?: Record<string, unknown> | null | undefined;
    title?: string | undefined;
    note?: string | undefined;
    force_version?: boolean | undefined;
    autosave?: boolean | undefined;
  },
  scope?: string
): Promise<DocDetail> {
  const { data } = await axios.put(`${BASE}/documents/${id}/content`, payload, cfg({ scope }));
  return data;
}

export async function publishDocument(id: string, scope?: string): Promise<DocDetail> {
  const { data } = await axios.post(`${BASE}/documents/${id}/publish`, null, cfg({ scope }));
  return data;
}

export async function duplicateDocument(id: string, scope?: string): Promise<DocDetail> {
  const { data } = await axios.post(`${BASE}/documents/${id}/duplicate`, null, cfg({ scope }));
  return data;
}

export async function deleteDocument(id: string, scope?: string): Promise<void> {
  await axios.delete(`${BASE}/documents/${id}`, cfg({ scope }));
}

export async function fetchVersions(id: string, scope?: string): Promise<DocVersion[]> {
  const { data } = await axios.get(`${BASE}/documents/${id}/versions`, cfg({ scope }));
  return data;
}

export async function fetchVersion(id: string, versionNo: number, scope?: string): Promise<DocVersionDetail> {
  const { data } = await axios.get(`${BASE}/documents/${id}/versions/${versionNo}`, cfg({ scope }));
  return data;
}

export async function restoreVersion(id: string, versionNo: number, scope?: string): Promise<DocDetail> {
  const { data } = await axios.post(`${BASE}/documents/${id}/versions/${versionNo}/restore`, null, cfg({ scope }));
  return data;
}

export async function uploadAsset(file: File, documentId?: string | null, scope?: string): Promise<DocAsset> {
  const form = new FormData();
  form.append('file', file, file.name);
  if (documentId) form.append('document_id', documentId);
  const { data } = await axios.post(`${BASE}/assets`, form, cfg({ scope }));
  return data;
}

export type ExportFormat = 'pdf' | 'docx' | 'markdown' | 'html';

/** Download an export via fetch so the bearer header is included. */
export async function downloadExport(id: string, fmt: ExportFormat, title: string, scope?: string): Promise<void> {
  const params = new URLSearchParams();
  if (scope) params.set('scope', scope);
  const url = `${BASE}/documents/${id}/export/${fmt}${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) {
    let detail = `Export failed (${res.status})`;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const ext = fmt === 'markdown' ? 'md' : fmt;
  const safe = (title || 'document').replace(/[^\w\s-]+/g, '').trim() || 'document';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safe}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Open the HTML print view in a new tab (token passed as query for the new window). */
export function openPrintPreview(id: string, scope?: string): void {
  const auth = getAuthHeader().Authorization;
  const token = auth ? auth.replace(/^Bearer\s+/i, '') : '';
  const params = new URLSearchParams();
  if (scope) params.set('scope', scope);
  if (token) params.set('access_token', token);
  window.open(`${BASE}/documents/${id}/export/html?${params}`, '_blank', 'noopener');
}
