/**
 * Connect, browse, and import/link files from OneDrive, Google Drive, or Dropbox.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Cloud,
  FileText,
  Folder,
  Link2,
  Plug,
  Trash2,
  Upload,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { API_BASE_URL } from '@/lib/constants';
import { getAuthHeader } from '@/services/authService';
import {
  disconnectLibraryConnection,
  fetchLibraryConnections,
  getLibraryAuthUrl,
  LIBRARY_OAUTH_PENDING_KEY,
  updateLibraryConnectionFolder,
  type DocLibraryConnection,
} from '@/services/docStudioService';

interface ExternalItem {
  id: string;
  name: string;
  is_folder: boolean;
  mime_type?: string;
  web_url?: string;
}

interface FolderCrumb {
  id: string;
  name: string;
}

export interface ExternalLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studioScope: string;
  folderId?: string;
  onImported?: () => void;
}

const PROVIDERS = [
  { id: 'microsoft_graph', label: 'OneDrive / SharePoint' },
  { id: 'google_drive', label: 'Google Drive' },
  { id: 'dropbox', label: 'Dropbox (App Folder)' },
];

const API = `${API_BASE_URL}/doc-studio`;

export function ExternalLibraryDialog({
  open,
  onOpenChange,
  studioScope,
  folderId,
  onImported,
}: ExternalLibraryDialogProps) {
  const [tab, setTab] = useState<'connect' | 'browse'>('browse');
  const [provider, setProvider] = useState('microsoft_graph');
  const [connections, setConnections] = useState<DocLibraryConnection[]>([]);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [items, setItems] = useState<ExternalItem[]>([]);
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [savingFolder, setSavingFolder] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [folderSavedMsg, setFolderSavedMsg] = useState<string | null>(null);

  const currentFolder = folderStack.length ? folderStack[folderStack.length - 1] : null;

  const reloadConnections = useCallback(async () => {
    const rows = await fetchLibraryConnections(studioScope);
    setConnections(rows);
    if (rows.length)
      setConnectionId(prev => (prev && rows.some(r => r.id === prev) ? prev : rows[0].id));
    else setConnectionId(null);
  }, [studioScope]);

  useEffect(() => {
    if (!open) return;
    void reloadConnections();
  }, [open, reloadConnections]);

  useEffect(() => {
    if (!connectionId || !open || tab !== 'browse') return;
    setLoading(true);
    setBrowseError(null);
    const params = new URLSearchParams({
      scope: studioScope,
      connection_id: connectionId,
    });
    if (currentFolder) params.set('folder_id', currentFolder.id);
    fetch(`${API}/library/browse?${params}`, { headers: getAuthHeader() })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(
            typeof data?.detail === 'string' ? data.detail : `Browse failed (${r.status})`
          );
        }
        if (!Array.isArray(data)) throw new Error('Unexpected browse response');
        setItems(data);
      })
      .catch(e => {
        setItems([]);
        setBrowseError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [connectionId, currentFolder, open, studioScope, tab]);

  const startConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const redirectUri = `${window.location.origin}/studio`;
      sessionStorage.setItem(
        LIBRARY_OAUTH_PENDING_KEY,
        JSON.stringify({ provider, redirectUri, scope: studioScope })
      );
      const { auth_url } = await getLibraryAuthUrl(studioScope, provider, redirectUri);
      if (!auth_url || auth_url.includes('client_id=&') || /client_id=(?:&|$)/.test(auth_url)) {
        throw new Error('OAuth client_id is missing. Ask an admin to configure Document Studio cloud credentials.');
      }
      window.location.href = auth_url;
    } catch (e) {
      sessionStorage.removeItem(LIBRARY_OAUTH_PENDING_KEY);
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e instanceof Error ? e.message : 'Could not start OAuth');
      setConnectError(typeof detail === 'string' ? detail : 'Could not start OAuth');
    } finally {
      setConnecting(false);
    }
  };

  const importItem = async (item: ExternalItem, mode: 'import' | 'link') => {
    if (!connectionId) return;
    const res = await fetch(`${API}/library/import?scope=${encodeURIComponent(studioScope)}`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connection_id: connectionId,
        item_id: item.id,
        folder_id: folderId,
        mode,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Import failed (${res.status})`);
    }
    onImported?.();
    onOpenChange(false);
  };

  const handleUseCurrentFolder = async () => {
    if (!connectionId) return;
    setSavingFolder(true);
    setFolderSavedMsg(null);
    try {
      const path = folderStack.length === 0 ? '/' : `/${folderStack.map(f => f.name).join('/')}`;
      const updated = await updateLibraryConnectionFolder(studioScope, connectionId, {
        defaultFolderId: currentFolder?.id || 'root',
        defaultFolderPath: path,
      });
      setConnections(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      setFolderSavedMsg(
        `Custody transfers use ${updated.default_folder_path || path}. WW360 ensures Workforce & succession, Compliance, Operations, and Imported under your WW360 Document Studio root.`
      );
    } finally {
      setSavingFolder(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    setDisconnectingId(id);
    try {
      await disconnectLibraryConnection(studioScope, id);
      await reloadConnections();
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-sky-600" /> External library
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <Button
            type="button"
            size="sm"
            variant={tab === 'browse' ? 'default' : 'outline'}
            onClick={() => setTab('browse')}
          >
            Browse
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === 'connect' ? 'default' : 'outline'}
            onClick={() => setTab('connect')}
          >
            Connect
          </Button>
        </div>

        {tab === 'connect' ? (
          <div className="space-y-4 py-2">
            <Label className="text-sm">Provider</Label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={provider}
              onChange={e => setProvider(e.target.value)}
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <Button type="button" onClick={() => void startConnect()} disabled={connecting}>
              <Plug className="mr-2 h-4 w-4" />
              {connecting ? 'Redirecting…' : 'Connect account'}
            </Button>
            {connectError ? <p className="text-sm text-red-600">{connectError}</p> : null}
            {connections.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {connections.map(c => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span>
                      {PROVIDERS.find(p => p.id === c.provider)?.label || c.provider}
                      {c.display_name?.includes('SSO') ? ' · via sign-in' : ''}
                      {c.account_email ? ` · ${c.account_email}` : ''}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={disconnectingId === c.id}
                      onClick={() => void handleDisconnect(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {connections.length === 0 ? (
              <p className="text-sm text-slate-600">
                No cloud connection yet. Switch to Connect and link OneDrive, Google Drive, or Dropbox.
              </p>
            ) : (
              <>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                  value={connectionId || ''}
                  onChange={e => {
                    setConnectionId(e.target.value);
                    setFolderStack([]);
                  }}
                >
                  {connections.map(c => (
                    <option key={c.id} value={c.id}>
                      {PROVIDERS.find(p => p.id === c.provider)?.label || c.provider}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {folderStack.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setFolderStack(s => s.slice(0, -1))}
                    >
                      <ArrowLeft className="mr-1 h-3 w-3" /> Up
                    </Button>
                  ) : null}
                  <span>{currentFolder?.name || 'Root'}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingFolder}
                    onClick={() => void handleUseCurrentFolder()}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Use this folder for transfers
                  </Button>
                </div>
                {folderSavedMsg ? (
                  <p className="text-xs text-emerald-700">{folderSavedMsg}</p>
                ) : null}
                {browseError ? <p className="text-sm text-red-600">{browseError}</p> : null}
                {loading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {items.map(item => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1.5 text-sm"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-sky-700"
                          onClick={() => {
                            if (item.is_folder) {
                              setFolderStack(s => [...s, { id: item.id, name: item.name }]);
                            }
                          }}
                        >
                          {item.is_folder ? (
                            <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                          ) : (
                            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          )}
                          <span className="truncate">{item.name}</span>
                        </button>
                        {!item.is_folder ? (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              title="Import copy"
                              onClick={() => void importItem(item, 'import').catch(console.error)}
                            >
                              <Upload className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              title="Link only"
                              onClick={() => void importItem(item, 'link').catch(console.error)}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
