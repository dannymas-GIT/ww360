/**
 * Document Studio API client — `/api/v1/doc-studio`.
 */
import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import type { StepAnnotation } from '@/utils/stepAnnotations';
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
  can_connect_library?: boolean;
  can_custody_transfer?: boolean;
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
  custody_status?: string;
}

export interface TutorialStep {
  id: string;
  caption?: string;
  title?: string;
  description?: string;
  screenshot_asset_id?: string;
  screenshot_url?: string;
  order: number;
  annotations?: StepAnnotation[];
  tMs?: number;
}

export interface TutorialData {
  steps: TutorialStep[];
  video_asset_id?: string;
  mode?: string;
}

export interface TutorialGenerateResult {
  title: string;
  markdown: string;
  stepCount: number;
  usedAi: boolean;
  usedTranscript: boolean;
}

export interface DocDetail extends DocSummary {
  content_markdown: string;
  content_json?: Record<string, unknown> | null;
  tutorial_data?: TutorialData | null;
  custody_status?: string;
  external_ref?: DocExternalRef | null;
}

export interface DocExternalRef {
  id: string;
  provider: string;
  external_item_id: string;
  external_web_url?: string | null;
  external_mime_type?: string | null;
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
    review_state?: string | undefined;
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
    doc_type?: string | undefined;
    content_markdown?: string | undefined;
    summary?: string | null | undefined;
    tags?: string[] | null | undefined;
    tutorial_data?: TutorialData | null | undefined;
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
    tutorial_data?: TutorialData | null | undefined;
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

export async function setDocumentReviewState(
  id: string,
  reviewState: 'none' | 'submitted' | 'changes_requested' | 'approved',
  scope?: string
): Promise<DocDetail> {
  const params: Record<string, string> = { review_state: reviewState };
  if (scope) params.scope = scope;
  const { data } = await axios.patch(`${BASE}/documents/${id}/review-state`, null, {
    headers: getAuthHeader(),
    params,
  });
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

export async function generateStudioTutorial(
  events: Record<string, unknown>,
  audio?: Blob | null,
  baseTitle?: string,
  scope?: string
): Promise<TutorialGenerateResult> {
  const form = new FormData();
  form.append('events', JSON.stringify(events));
  if (baseTitle) form.append('base_title', baseTitle);
  if (audio) form.append('audio', audio, 'narration.webm');

  const params = new URLSearchParams();
  if (scope) params.set('scope', scope);
  const qs = params.toString();
  const url = `${BASE}/tutorials/generate${qs ? `?${qs}` : ''}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeader(),
    body: form,
  });
  if (!response.ok) {
    let detail = `Generate failed (${response.status})`;
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return response.json();
}

export async function uploadAsset(file: File, documentId?: string | null, scope?: string): Promise<DocAsset> {
  const form = new FormData();
  form.append('file', file, file.name);
  if (documentId) form.append('document_id', documentId);
  const { data } = await axios.post(`${BASE}/assets`, form, cfg({ scope }));
  return data;
}

export async function fetchAssets(
  opts: { document_id?: string | null; images_only?: boolean; limit?: number; scope?: string } = {}
): Promise<DocAsset[]> {
  const { data } = await axios.get(`${BASE}/assets`, cfg({
    scope: opts.scope,
    document_id: opts.document_id || undefined,
    images_only: opts.images_only ?? true,
    limit: opts.limit ?? 100,
  }));
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

// ── External library + custody ─────────────────────────────────────────────

export interface DocLibraryConnection {
  id: string;
  owner_type: string;
  owner_code: string;
  provider: string;
  display_name?: string | null;
  account_email?: string | null;
  default_folder_id?: string | null;
  default_folder_path?: string | null;
  is_active?: boolean;
}

export interface CustodyPolicy {
  version: string;
  markdown: string;
  default_retention_days: number;
}

export interface CustodyAcknowledgment {
  id: string;
  owner_type: string;
  owner_code: string;
  policy_version: string;
  acknowledgment_text: string;
  acknowledged_by_name: string;
  acknowledged_at: string;
}

export interface CustodyTransfer {
  id: string;
  scope: string;
  destination_owner_type: string;
  destination_owner_code: string;
  status: string;
  retention_days: number;
  purge_scheduled_at?: string | null;
  purged_at?: string | null;
  items: Array<{
    id: string;
    document_id?: string | null;
    filename: string;
    sha256_checksum: string;
  }>;
}

export const LIBRARY_OAUTH_PENDING_KEY = 'ww360.doc-studio.library-oauth';

export const CUSTODY_ELIGIBLE_FOLDER_NAMES = new Set([
  'Workforce & succession',
  'Compliance',
  'Operations',
]);

export function ownerFromScope(scope: string): { ownerType: string; ownerCode: string } {
  if (scope === 'program') return { ownerType: 'program', ownerCode: 'program' };
  return { ownerType: 'district', ownerCode: scope };
}

export function isCustodyTransferEligible(
  doc: Pick<DocSummary, 'folder_id'> & { custody_status?: string },
  folder: Pick<DocFolder, 'name'> | null | undefined
): boolean {
  if ((doc.custody_status || 'local') !== 'local') return false;
  if (!doc.folder_id || !folder?.name) return false;
  return CUSTODY_ELIGIBLE_FOLDER_NAMES.has(folder.name);
}

export async function fetchLibraryConnections(scope: string): Promise<DocLibraryConnection[]> {
  const { data } = await axios.get(`${BASE}/library/connections`, cfg({ scope }));
  return data;
}

export async function updateLibraryConnectionFolder(
  scope: string,
  connectionId: string,
  params: { defaultFolderId: string; defaultFolderPath: string }
): Promise<DocLibraryConnection> {
  const { data } = await axios.patch(
    `${BASE}/library/connections/${connectionId}`,
    {
      default_folder_id: params.defaultFolderId,
      default_folder_path: params.defaultFolderPath,
    },
    cfg({ scope, ensure_structure: true })
  );
  return data;
}

export async function disconnectLibraryConnection(
  scope: string,
  connectionId: string
): Promise<void> {
  await axios.delete(`${BASE}/library/connections/${connectionId}`, cfg({ scope }));
}

export async function getLibraryAuthUrl(
  scope: string,
  provider: string,
  redirectUri: string
): Promise<{ auth_url: string }> {
  const { data } = await axios.get(
    `${BASE}/library/auth-url`,
    cfg({ scope, provider, redirect_uri: redirectUri })
  );
  return data;
}

export async function completeLibraryOAuthCallback(params: {
  provider: string;
  code: string;
  redirectUri: string;
  scope: string;
  state?: string;
}): Promise<DocLibraryConnection> {
  const qs = new URLSearchParams({
    provider: params.provider,
    code: params.code,
    redirect_uri: params.redirectUri,
  });
  if (params.state) qs.set('state', params.state);
  const { data } = await axios.post(
    `${BASE}/library/callback?${qs.toString()}&scope=${encodeURIComponent(params.scope)}`,
    null,
    cfg({ scope: params.scope })
  );
  return data;
}

export async function fetchCustodyPolicy(scope: string): Promise<CustodyPolicy> {
  const { data } = await axios.get(`${BASE}/custody/policy`, cfg({ scope }));
  return data;
}

export async function fetchCustodyAcknowledgment(
  scope: string,
  ownerType: string,
  ownerCode: string
): Promise<CustodyAcknowledgment | null> {
  const { data } = await axios.get(
    `${BASE}/custody/acknowledgment`,
    cfg({ scope, owner_type: ownerType, owner_code: ownerCode })
  );
  return data;
}

export async function recordCustodyAcknowledgment(
  scope: string,
  ownerType: string,
  ownerCode: string,
  confirmed: boolean
): Promise<CustodyAcknowledgment> {
  const { data } = await axios.post(
    `${BASE}/custody/acknowledgment`,
    { owner_type: ownerType, owner_code: ownerCode, confirmed },
    cfg({ scope })
  );
  return data;
}

/** HTML5 DnD mime for Document Studio library moves. */
export const DOC_STUDIO_DRAG_MIME = 'application/x-ww360-doc-studio';

const ANCHORED_LIBRARY_TAGS = new Set(['workforce-pack', 'wizard-generated', 'doh352-pdf']);
const WORKFORCE_FOLDER_NAMES = new Set(['Workforce & succession', 'Workforce Continuity']);

export function isAnchoredLibraryDocument(doc: Pick<DocSummary, 'tags'>): boolean {
  return (doc.tags ?? []).some(t => ANCHORED_LIBRARY_TAGS.has(t));
}

/** Confirm message when a move may break package layout; null if no warning. */
export function documentMoveWarning(
  doc: Pick<DocSummary, 'title' | 'folder_id' | 'status' | 'tags'>,
  fromFolder: Pick<DocFolder, 'id' | 'name'> | undefined | null,
  toFolder: Pick<DocFolder, 'id' | 'name'> | null
): string | null {
  const toId = toFolder?.id ?? null;
  if ((doc.folder_id ?? null) === toId) return null;

  const toName = toFolder?.name ?? 'Unfiled';
  const leavingWorkforce =
    !!fromFolder &&
    WORKFORCE_FOLDER_NAMES.has(fromFolder.name) &&
    (!toFolder || !WORKFORCE_FOLDER_NAMES.has(toFolder.name));

  if (isAnchoredLibraryDocument(doc) || leavingWorkforce) {
    return (
      `“${doc.title}” belongs in Workforce & succession (wizard / package documentation) ` +
      `and should usually stay there. Move it to “${toName}” anyway?`
    );
  }
  if (doc.status === 'published') {
    return (
      `“${doc.title}” is published. Moving it changes where others find it. ` +
      `Move to “${toName}”?`
    );
  }
  return null;
}

export async function createCustodyTransfer(
  scope: string,
  payload: {
    document_ids: string[];
    destination_owner_type: string;
    destination_owner_code: string;
    connection_id: string;
    external_folder_id?: string;
    export_format?: string;
    retention_days?: number;
  }
): Promise<CustodyTransfer> {
  const { data } = await axios.post(`${BASE}/custody/transfers`, payload, cfg({ scope }));
  return data;
}

export async function fetchCustodyTransfers(scope: string): Promise<CustodyTransfer[]> {
  const { data } = await axios.get(`${BASE}/custody/transfers`, cfg({ scope }));
  return data;
}
