/**
 * Document Studio — folders · documents · rich editor, for One Water Workforce content.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trackEvent } from '@/lib/ga4';
import {
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Cloud,
  CloudUpload,
  Copy,
  Download,
  FilePlus2,
  FileText,
  FileUp,
  History,
  Link2,
  Loader2,
  MoreHorizontal,
  Printer,
  Save,
  Send,
  Trash2,
  Video,
  PlayCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360TourOverlay, requestOpenTour } from '@/components/ww360/Ww360TourOverlay';
import { StudioEditor, type StudioEditorHandle } from '@/components/doc-studio/StudioEditor';
import { ALL_DOCS, FolderTree, UNFILED } from '@/components/doc-studio/FolderTree';
import { DocumentList, relativeTime, statusTone } from '@/components/doc-studio/DocumentList';
import { VersionHistoryPanel } from '@/components/doc-studio/VersionHistoryPanel';
import { NewDocumentDialog } from '@/components/doc-studio/NewDocumentDialog';
import { ExternalLibraryDialog } from '@/components/doc-studio/ExternalLibraryDialog';
import { CustodyTransferDialog } from '@/components/doc-studio/CustodyTransferDialog';
import { ApplicationStepsOverviewDialog } from '@/components/doc-studio/ApplicationStepsOverviewDialog';
import { ApplicationStepsTourOverlay } from '@/components/doc-studio/ApplicationStepsTourOverlay';
import { requestOpenApplicationStepsTour } from '@/components/doc-studio/applicationStepsTourContent';
import { TutorialPlayer } from '@/components/doc-studio/TutorialPlayer';
import { useTutorialRecorder } from '@/context/TutorialRecorderContext';
import * as api from '@/services/docStudioService';
import type { DocDetail, DocFolder, DocSummary } from '@/services/docStudioService';
import { templateById, templateAudienceFromTour, tourSampleTemplateId } from '@/config/studioTemplates';
import {
  buildStudioTourConfig,
  resolveStudioTourAudience,
  studioHeroCopy,
  STUDIO_TOUR_OPEN_EVENT,
} from './studioTourContent';
import { resolveLandingKind } from '@/utils/resolveLandingKind';
import { useImpersonation } from '@/context/ImpersonationContext';

const AUTOSAVE_MS = 2500;

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function errMessage(err: unknown): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const r = (err as { response?: { data?: { detail?: string } } }).response;
    if (r?.data?.detail) {
      if (r.data.detail === 'IMPERSONATION_READ_ONLY') {
        return 'Read-only preview cannot save. Exit preview, or use Act as (audited) to make changes.';
      }
      return r.data.detail;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

export default function DocumentStudioPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPreviewMode } = useImpersonation();
  const qc = useQueryClient();
  const { openRecorder } = useTutorialRecorder();
  const [params, setParams] = useSearchParams();
  const requestedScope = params.get('scope') ?? undefined;

  const [folderSel, setFolderSel] = useState<string>(params.get('folder') || ALL_DOCS);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('doc'));
  const [showVersions, setShowVersions] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [custodyOpen, setCustodyOpen] = useState(params.get('custody') === 'open');
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [titleDraft, setTitleDraft] = useState('');
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [editorFullscreen, setEditorFullscreen] = useState(false);

  const editorRef = useRef<StudioEditorHandle>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimer = useRef<number | null>(null);
  const pendingMarkdown = useRef<string | null>(null);
  const oauthHandledRef = useRef(false);

  // ── Queries ────────────────────────────────────────────────────────────
  const accessQ = useQuery({
    queryKey: ['studio', 'access', requestedScope ?? 'auto'],
    queryFn: () => api.fetchAccess(requestedScope),
  });
  // Preview impersonation is read-only even when the target persona can author.
  const canAuthor = !!accessQ.data?.can_author && !isPreviewMode;
  const canPublish = !!accessQ.data?.can_publish;
  // Older backends omit the flag — authors should still see the control.
  const canConnectLibrary = accessQ.data?.can_connect_library ?? canAuthor;
  const canCustodyTransfer = !!accessQ.data?.can_custody_transfer;
  const scopeLabel = accessQ.data?.scope_label ?? 'Program library';
  const studioScope = accessQ.data?.scope ?? requestedScope ?? 'program';
  const tourAudience = resolveStudioTourAudience({
    landingKind: resolveLandingKind(user),
    canAuthor: accessQ.isSuccess ? canAuthor : true,
    scope: studioScope,
  });
  const templateAudience = templateAudienceFromTour(tourAudience);
  const hero = studioHeroCopy(tourAudience);
  const tourSampleId = tourSampleTemplateId(templateAudience);

  const foldersQ = useQuery({
    queryKey: ['studio', 'folders', studioScope],
    queryFn: () => api.fetchFolders(studioScope),
    enabled: accessQ.isSuccess,
  });
  const folders: DocFolder[] = foldersQ.data ?? [];

  const listFolderParam = folderSel === ALL_DOCS ? undefined : folderSel === UNFILED ? UNFILED : folderSel;
  const docsQ = useQuery({
    queryKey: ['studio', 'documents', studioScope, listFolderParam ?? 'all', query],
    queryFn: () =>
      api.fetchDocuments(
        { folder_id: listFolderParam ?? undefined, q: query || undefined },
        studioScope
      ),
    enabled: accessQ.isSuccess,
  });
  const documents: DocSummary[] = docsQ.data ?? [];

  const allDocsQ = useQuery({
    queryKey: ['studio', 'documents', studioScope, 'all', ''],
    queryFn: () => api.fetchDocuments({}, studioScope),
    enabled: accessQ.isSuccess,
  });
  const totalCount = allDocsQ.data?.length ?? 0;
  const unfiledCount = (allDocsQ.data ?? []).filter(d => !d.folder_id).length;

  const docQ = useQuery({
    queryKey: ['studio', 'document', studioScope, selectedId],
    queryFn: () => api.fetchDocument(selectedId as string, studioScope),
    enabled: !!selectedId && accessQ.isSuccess,
  });
  const doc: DocDetail | undefined = docQ.data;

  const versionsQ = useQuery({
    queryKey: ['studio', 'versions', studioScope, selectedId],
    queryFn: () => api.fetchVersions(selectedId as string, studioScope),
    enabled: !!selectedId && showVersions,
  });

  // Deep link from Continuity binder (?scope=&doc=&folder=)
  useEffect(() => {
    const docParam = params.get('doc');
    const folderParam = params.get('folder');
    if (docParam && docParam !== selectedId) setSelectedId(docParam);
    if (folderParam && folderParam !== folderSel) setFolderSel(folderParam);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (doc) setTitleDraft(doc.title);
  }, [doc?.id, doc?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (selectedId) next.set('doc', selectedId);
    else next.delete('doc');
    if (requestedScope) next.set('scope', requestedScope);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [selectedId, requestedScope]); // eslint-disable-line react-hooks/exhaustive-deps

  // Complete OAuth return from cloud provider (?code= on /studio).
  useEffect(() => {
    if (oauthHandledRef.current || !accessQ.isSuccess) return;
    const code = params.get('code');
    if (!code) return;
    const raw = sessionStorage.getItem(api.LIBRARY_OAUTH_PENDING_KEY);
    if (!raw) return;
    oauthHandledRef.current = true;
    let pending: { provider: string; redirectUri: string; scope: string };
    try {
      pending = JSON.parse(raw) as { provider: string; redirectUri: string; scope: string };
    } catch {
      return;
    }
    sessionStorage.removeItem(api.LIBRARY_OAUTH_PENDING_KEY);
    const next = new URLSearchParams(params);
    next.delete('code');
    next.delete('state');
    setParams(next, { replace: true });
    void api
      .completeLibraryOAuthCallback({
        provider: pending.provider,
        code,
        redirectUri: pending.redirectUri,
        scope: pending.scope || studioScope,
        state: params.get('state') ?? undefined,
      })
      .then(() => {
        toast({ title: 'Cloud library connected', description: 'Browse or import files from External library.' });
        setLibraryOpen(true);
      })
      .catch(err =>
        toast({ title: 'Connection failed', description: errMessage(err), variant: 'destructive' })
      );
  }, [accessQ.isSuccess, params, setParams, studioScope, toast]);

  useEffect(() => {
    if (!editorFullscreen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditorFullscreen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [editorFullscreen]);

  const invalidateLists = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['studio', 'documents'] });
    qc.invalidateQueries({ queryKey: ['studio', 'folders'] });
  }, [qc]);

  // ── Save pipeline ──────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: (vars: {
      id: string;
      markdown: string;
      json?: Record<string, unknown> | undefined;
      autosave: boolean;
      title?: string | undefined;
      note?: string | undefined;
    }) =>
      api.saveContent(
        vars.id,
        {
          content_markdown: vars.markdown,
          content_json: vars.json,
          autosave: vars.autosave,
          title: vars.title,
          note: vars.note,
        },
        studioScope
      ),
    onSuccess: (data, vars) => {
      qc.setQueryData(['studio', 'document', studioScope, vars.id], data);
      setSaveState('saved');
      if (!vars.autosave) {
        qc.invalidateQueries({ queryKey: ['studio', 'versions', vars.id] });
        toast({ title: `Saved v${data.version_no}`, description: data.title });
      }
      invalidateLists();
    },
    onError: err => {
      setSaveState('error');
      // Avoid spamming while browsing binders in read-only preview.
      const msg = errMessage(err);
      if (msg.includes('Read-only preview')) return;
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    },
  });

  // `mutateAsync` is referentially stable; the `saveMut` object is not (new identity every render),
  // so depend on the function only — otherwise the unmount-flush effect below re-runs on every
  // render and autosaves on every keystroke.
  const saveContentAsync = saveMut.mutateAsync;

  const flushAutosave = useCallback(async () => {
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (!selectedId || pendingMarkdown.current === null || !canAuthor) return;
    const markdown = pendingMarkdown.current;
    pendingMarkdown.current = null;
    setSaveState('saving');
    try {
      await saveContentAsync({ id: selectedId, markdown, json: editorRef.current?.getJson(), autosave: true });
    } catch {
      /* toast handled in onError */
    }
  }, [canAuthor, saveContentAsync, selectedId]);
  const flushAutosaveRef = useRef(flushAutosave);
  flushAutosaveRef.current = flushAutosave;

  const handleEditorChange = useCallback(
    (markdown: string) => {
      if (!canAuthor) return;
      pendingMarkdown.current = markdown;
      setSaveState('dirty');
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => void flushAutosave(), AUTOSAVE_MS);
    },
    [canAuthor, flushAutosave]
  );

  const handleExplicitSave = useCallback(async () => {
    if (!selectedId || !canAuthor) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    pendingMarkdown.current = null;
    const markdown = editorRef.current?.getMarkdown() ?? doc?.content_markdown ?? '';
    setSaveState('saving');
    await saveContentAsync({
      id: selectedId,
      markdown,
      json: editorRef.current?.getJson(),
      autosave: false,
      title: titleDraft.trim() || undefined,
      note: 'Manual save',
    }).catch(() => undefined);
  }, [canAuthor, doc?.content_markdown, saveContentAsync, selectedId, titleDraft]);

  // Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleExplicitSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleExplicitSave]);

  // Flush pending edits on unmount only (doc switches flush explicitly in selectDocument)
  useEffect(() => () => void flushAutosaveRef.current(), []);

  const selectDocument = useCallback(
    async (id: string | null) => {
      await flushAutosave();
      setSaveState('idle');
      setSelectedId(id);
    },
    [flushAutosave]
  );

  const startTutorialRecording = useCallback(
    (existingDocumentId?: string) => {
      const folderId =
        folderSel !== ALL_DOCS && folderSel !== UNFILED ? folderSel : doc?.folder_id ?? null;
      openRecorder({
        documentTitle: existingDocumentId && doc ? doc.title : 'New tutorial',
        studioTarget: {
          scope: studioScope,
          folderId: folderId ?? undefined,
          existingDocumentId,
        },
        onPublished: async docId => {
          invalidateLists();
          await selectDocument(docId);
          toast({ title: 'Tutorial published', description: 'Saved to Document Studio.' });
        },
      });
    },
    [doc, folderSel, invalidateLists, openRecorder, selectDocument, studioScope, toast]
  );

  // ── Title ──────────────────────────────────────────────────────────────
  const titleMut = useMutation({
    mutationFn: (vars: { id: string; title: string }) => api.updateDocument(vars.id, { title: vars.title }),
    onSuccess: (data, vars) => {
      qc.setQueryData(['studio', 'document', vars.id], (prev: DocDetail | undefined) =>
        prev ? { ...prev, title: data.title, updated_at: data.updated_at } : prev
      );
      invalidateLists();
    },
    onError: err => toast({ title: 'Rename failed', description: errMessage(err), variant: 'destructive' }),
  });

  const commitTitle = () => {
    if (!doc || !canAuthor) return;
    const t = titleDraft.trim();
    if (!t || t === doc.title) {
      setTitleDraft(doc.title);
      return;
    }
    titleMut.mutate({ id: doc.id, title: t });
  };

  // ── Create / import / duplicate / delete / publish ─────────────────────
  const createMut = useMutation({
    mutationFn: (vars: { title: string; folder_id: string | null; template_id: string; markdown: string }) =>
      api.createDocument({
        title: vars.title,
        folder_id: vars.folder_id,
        template_id: vars.template_id === 'blank' || vars.template_id === 'tutorial' ? null : vars.template_id,
        doc_type: vars.template_id === 'tutorial' ? 'tutorial' : undefined,
        content_markdown: vars.markdown,
      }),
    onSuccess: async data => {
      setNewOpen(false);
      invalidateLists();
      if (data.folder_id && folderSel !== ALL_DOCS) setFolderSel(data.folder_id);
      await selectDocument(data.id);
      toast({ title: 'Document created', description: data.title });
    },
    onError: err => toast({ title: 'Could not create document', description: errMessage(err), variant: 'destructive' }),
  });

  const importMut = useMutation({
    mutationFn: (file: File) =>
      api.importDocument(file, { folder_id: folderSel !== ALL_DOCS && folderSel !== UNFILED ? folderSel : null }),
    onSuccess: async data => {
      invalidateLists();
      await selectDocument(data.id);
      toast({ title: 'Imported', description: `${data.source_filename ?? data.title} → editable document` });
    },
    onError: err => toast({ title: 'Import failed', description: errMessage(err), variant: 'destructive' }),
  });

  const publishMut = useMutation({
    mutationFn: (id: string) => api.publishDocument(id),
    onSuccess: data => {
      qc.setQueryData(['studio', 'document', data.id], data);
      qc.invalidateQueries({ queryKey: ['studio', 'versions', data.id] });
      invalidateLists();
      toast({ title: 'Published', description: `${data.title} · v${data.version_no}` });
      trackEvent('studio_published', { doc_type: data.doc_type || 'document' });
    },
    onError: err => toast({ title: 'Publish failed', description: errMessage(err), variant: 'destructive' }),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: api.DocStatus }) => api.updateDocument(vars.id, { status: vars.status }),
    onSuccess: data => {
      qc.setQueryData(['studio', 'document', data.id], data);
      invalidateLists();
    },
    onError: err => toast({ title: 'Update failed', description: errMessage(err), variant: 'destructive' }),
  });

  const moveMut = useMutation({
    mutationFn: (vars: { id: string; folder_id: string | null }) => api.updateDocument(vars.id, { folder_id: vars.folder_id }),
    onSuccess: data => {
      qc.setQueryData(['studio', 'document', data.id], data);
      invalidateLists();
      toast({ title: 'Moved', description: data.title });
    },
    onError: err => toast({ title: 'Move failed', description: errMessage(err), variant: 'destructive' }),
  });

  const handleDropDocument = useCallback(
    (targetFolderId: string | null, documentId: string) => {
      if (!canAuthor) return;
      const fromList =
        documents.find(d => d.id === documentId) ??
        (allDocsQ.data ?? []).find(d => d.id === documentId) ??
        (doc?.id === documentId ? doc : null);
      if (!fromList) {
        toast({ title: 'Move failed', description: 'Could not find that document.', variant: 'destructive' });
        return;
      }
      if ((fromList.folder_id ?? null) === targetFolderId) return;
      const targetFolder = targetFolderId ? (folders.find(f => f.id === targetFolderId) ?? null) : null;
      if (targetFolderId && !targetFolder) return;
      const fromFolder = folders.find(f => f.id === fromList.folder_id) ?? null;
      const warning = api.documentMoveWarning(fromList, fromFolder, targetFolder);
      if (warning && !window.confirm(warning)) return;
      moveMut.mutate({ id: documentId, folder_id: targetFolderId });
    },
    [allDocsQ.data, canAuthor, doc, documents, folders, moveMut, toast]
  );

  const duplicateMut = useMutation({
    mutationFn: (id: string) => api.duplicateDocument(id),
    onSuccess: async data => {
      invalidateLists();
      await selectDocument(data.id);
      toast({ title: 'Duplicated', description: data.title });
    },
    onError: err => toast({ title: 'Duplicate failed', description: errMessage(err), variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: async () => {
      invalidateLists();
      await selectDocument(null);
      toast({ title: 'Document deleted' });
    },
    onError: err => toast({ title: 'Delete failed', description: errMessage(err), variant: 'destructive' }),
  });

  const restoreMut = useMutation({
    mutationFn: (vars: { id: string; version_no: number }) => api.restoreVersion(vars.id, vars.version_no),
    onMutate: vars => setRestoringVersion(vars.version_no),
    onSettled: () => setRestoringVersion(null),
    onSuccess: data => {
      qc.setQueryData(['studio', 'document', data.id], data);
      editorRef.current?.setMarkdown(data.content_markdown || '');
      qc.invalidateQueries({ queryKey: ['studio', 'versions', data.id] });
      invalidateLists();
      toast({ title: `Restored — now v${data.version_no}` });
    },
    onError: err => toast({ title: 'Restore failed', description: errMessage(err), variant: 'destructive' }),
  });

  // ── Folders ────────────────────────────────────────────────────────────
  const folderCreateMut = useMutation({
    mutationFn: (vars: { name: string; parent_id: string | null }) => api.createFolder(vars),
    onSuccess: f => {
      qc.invalidateQueries({ queryKey: ['studio', 'folders'] });
      setFolderSel(f.id);
    },
    onError: err => toast({ title: 'Could not create folder', description: errMessage(err), variant: 'destructive' }),
  });
  const folderRenameMut = useMutation({
    mutationFn: (vars: { id: string; name: string }) => api.updateFolder(vars.id, { name: vars.name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio', 'folders'] }),
    onError: err => toast({ title: 'Rename failed', description: errMessage(err), variant: 'destructive' }),
  });
  const folderDeleteMut = useMutation({
    mutationFn: (id: string) => api.deleteFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studio', 'folders'] });
      invalidateLists();
      setFolderSel(ALL_DOCS);
    },
    onError: err => toast({ title: 'Delete failed', description: errMessage(err), variant: 'destructive' }),
  });

  // ── Export ─────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState<api.ExportFormat | null>(null);
  const doExport = async (fmt: api.ExportFormat) => {
    if (!doc) return;
    await flushAutosave();
    setExporting(fmt);
    try {
      await api.downloadExport(doc.id, fmt, doc.title, studioScope);
    } catch (err) {
      toast({ title: 'Export failed', description: errMessage(err), variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // ── Tour ───────────────────────────────────────────────────────────────
  const tourConfig = useMemo(
    () =>
      buildStudioTourConfig({
        openNewDialog: () => setNewOpen(true),
        closeNewDialog: () => setNewOpen(false),
        showVersions: () => setShowVersions(true),
        hideVersions: () => setShowVersions(false),
        ensureDocumentOpen: async () => {
          if (selectedId) return;
          const first = (allDocsQ.data ?? [])[0];
          if (first) {
            await selectDocument(first.id);
            return;
          }
          if (!canAuthor) return;
          const tpl = templateById(tourSampleId);
          try {
            const created = await api.createDocument({
              title: `Sample — ${tpl?.name ?? 'Document'}`,
              template_id: tourSampleId,
              content_markdown: tpl?.markdown ?? '',
            });
            invalidateLists();
            await selectDocument(created.id);
          } catch {
            /* ignore */
          }
        },
        ensureSampleVersions: async () => {
          const SAMPLE_PREFIX = 'Sample —';
          const waitForVersionsPanel = async () => {
            // Document switch remounts the editor pane; wait until versions is actually painted.
            for (let i = 0; i < 40; i++) {
              const panel = document.querySelector('[data-tour="studio-versions"]');
              const editor = document.querySelector('[data-tour="studio-editor"] .ProseMirror');
              if (panel && editor) return;
              await new Promise(r => window.setTimeout(r, 75));
            }
          };

          // Prefer (or create) a sample doc so we never append tour notes to a real document.
          let docId = selectedId;
          const openDoc = docId
            ? ((allDocsQ.data ?? []).find(d => d.id === docId) ?? null)
            : null;
          const isSample = !!openDoc?.title?.startsWith(SAMPLE_PREFIX);
          if (!docId || !isSample) {
            const sample = (allDocsQ.data ?? []).find(d => d.title.startsWith(SAMPLE_PREFIX));
            if (sample) {
              docId = sample.id;
              await selectDocument(sample.id);
            } else if (canAuthor) {
              const tpl = templateById(tourSampleId);
              try {
                const created = await api.createDocument({
                  title: `Sample — ${tpl?.name ?? 'Document'}`,
                  template_id: tourSampleId,
                  content_markdown: tpl?.markdown ?? '',
                });
                invalidateLists();
                docId = created.id;
                await selectDocument(created.id);
              } catch {
                setShowVersions(true);
                await waitForVersionsPanel();
                return;
              }
            }
          }

          setShowVersions(true);
          if (!docId || !canAuthor) {
            await waitForVersionsPanel();
            return;
          }

          try {
            let versions = await api.fetchVersions(docId);
            // Seed named saves so the panel shows a short history (v1, v2, v3).
            const seedNotes = ['Tour sample — first draft', 'Tour sample — revised for partners'];
            let markdown =
              (await api.fetchDocument(docId)).content_markdown ||
              templateById(tourSampleId)?.markdown ||
              '';
            for (const note of seedNotes) {
              if (versions.length >= 3) break;
              if (versions.some(v => v.note === note)) continue;
              markdown = `${markdown.trimEnd()}\n\n> ${note}\n`;
              await api.saveContent(docId, {
                content_markdown: markdown,
                autosave: false,
                note,
              });
              versions = await api.fetchVersions(docId);
            }
            qc.setQueryData(['studio', 'document', docId], await api.fetchDocument(docId));
            await qc.invalidateQueries({ queryKey: ['studio', 'versions', docId] });
            await waitForVersionsPanel();
            // Extra beat so React Query can paint the seeded rows.
            await new Promise(r => window.setTimeout(r, 200));
          } catch {
            await waitForVersionsPanel();
          }
        },
        userId: user?.id,
        audience: tourAudience,
        canAuthor,
        canPublish,
        canConnectLibrary,
        canCustodyTransfer,
        scopeLabel,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, allDocsQ.data, canAuthor, canPublish, canConnectLibrary, canCustodyTransfer, qc, user?.id, tourAudience, scopeLabel, tourSampleId]
  );

  // ── Render ─────────────────────────────────────────────────────────────
  const selectedFolder = folders.find(f => f.id === folderSel);
  const defaultFolderForNew = folderSel !== ALL_DOCS && folderSel !== UNFILED ? folderSel : null;
  const busy = createMut.isPending || importMut.isPending;
  const custodyDocs: DocSummary[] = doc
    ? [
        {
          id: doc.id,
          title: doc.title,
          folder_id: doc.folder_id,
          status: doc.status,
          doc_type: doc.doc_type,
          version_no: doc.version_no,
          word_count: doc.word_count,
          updated_at: doc.updated_at,
          custody_status: doc.custody_status,
        },
      ]
    : documents;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Document Studio"
        title={hero.title}
        description={hero.description}
        badges={
          <>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-white/15">{scopeLabel}</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-white/15">
              {totalCount} document{totalCount === 1 ? '' : 's'} · {folders.length} folder{folders.length === 1 ? '' : 's'}
            </span>
            {!canAuthor && accessQ.isSuccess ? (
              <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-xs text-amber-100 ring-1 ring-amber-300/30">Read only</span>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white md:min-h-9"
              onClick={() => requestOpenTour(STUDIO_TOUR_OPEN_EVENT, 0)}
            >
              <CircleHelp className="mr-1.5 h-4 w-4" aria-hidden /> Tour
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-tour="studio-application-steps-overview"
              className="min-h-[44px] border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white md:min-h-9"
              onClick={() => requestOpenApplicationStepsTour(0)}
            >
              <PlayCircle className="mr-1.5 h-4 w-4" aria-hidden /> Watch overview
            </Button>
            {canAuthor ? (
              <>
                {canConnectLibrary ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-tour="studio-external-library"
                    className="min-h-[44px] border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white md:min-h-9"
                    onClick={() => setLibraryOpen(true)}
                  >
                    <Cloud className="mr-1.5 h-4 w-4" aria-hidden /> Add cloud storage
                  </Button>
                ) : null}
                {canCustodyTransfer ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-tour="studio-custody-transfer"
                    className="min-h-[44px] border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white md:min-h-9"
                    onClick={() => setCustodyOpen(true)}
                  >
                    <CloudUpload className="mr-1.5 h-4 w-4" aria-hidden /> Transfer custody
                  </Button>
                ) : null}
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".docx,.pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) importMut.mutate(f);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-tour="studio-record"
                  className="min-h-[44px] border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white md:min-h-9"
                  onClick={() => startTutorialRecording()}
                >
                  <Video className="mr-1.5 h-4 w-4" aria-hidden />
                  Record tutorial
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-tour="studio-import"
                  className="min-h-[44px] border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white md:min-h-9"
                  disabled={importMut.isPending}
                  onClick={() => importInputRef.current?.click()}
                >
                  {importMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileUp className="mr-1.5 h-4 w-4" aria-hidden />}
                  Import
                </Button>
                <Button
                  type="button"
                  size="sm"
                  data-tour="studio-new-button"
                  className="min-h-[44px] bg-sky-400 text-slate-900 hover:bg-sky-300 md:min-h-9"
                  onClick={() => setNewOpen(true)}
                >
                  <FilePlus2 className="mr-1.5 h-4 w-4" aria-hidden /> New document
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {accessQ.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Document Studio is unavailable: {errMessage(accessQ.error)}
        </div>
      ) : null}

      <div
        className="grid min-h-[560px] flex-1 gap-3 lg:h-[calc(100vh-19rem)] lg:grid-cols-[230px_300px_minmax(0,1fr)]"
        data-tour="studio-workspace"
      >
        {/* Folders */}
        <aside
          data-tour="studio-folders"
          className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
          aria-label="Library folders"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FolderTree
              folders={folders}
              selectedId={folderSel}
              totalCount={totalCount}
              unfiledCount={unfiledCount}
              canManage={canAuthor}
              onSelect={setFolderSel}
              onDropDocument={canAuthor ? handleDropDocument : undefined}
              onCreate={parentId => {
                const name = window.prompt(parentId ? 'New subfolder name' : 'New folder name');
                if (name?.trim()) folderCreateMut.mutate({ name: name.trim(), parent_id: parentId });
              }}
              onRename={f => {
                const name = window.prompt('Rename folder', f.name);
                if (name?.trim() && name.trim() !== f.name) folderRenameMut.mutate({ id: f.id, name: name.trim() });
              }}
              onDelete={f => {
                if (window.confirm(`Delete folder "${f.name}"? Documents inside move up one level.`)) folderDeleteMut.mutate(f.id);
              }}
            />
          </div>
          {canConnectLibrary ? (
            <div className="mt-2 shrink-0 border-t border-slate-100 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-tour="studio-external-library-sidebar"
                className="h-9 w-full justify-start text-slate-700"
                onClick={() => setLibraryOpen(true)}
              >
                <Cloud className="mr-2 h-4 w-4 text-sky-600" aria-hidden />
                Add cloud storage
              </Button>
              <p className="mt-1 px-1 text-[10px] leading-snug text-slate-500">
                OneDrive, Google Drive, or Dropbox
              </p>
            </div>
          ) : null}
        </aside>

        {/* Documents */}
        <section
          data-tour="studio-documents"
          className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white pt-2 shadow-sm"
          aria-label="Documents"
        >
          <div className="flex items-center justify-between px-3 pb-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              {folderSel === ALL_DOCS ? 'All documents' : folderSel === UNFILED ? 'Unfiled' : selectedFolder?.name ?? 'Folder'}
            </p>
            <span className="text-[11px] text-slate-500">{documents.length}</span>
          </div>
          {selectedFolder?.description ? (
            <p className="px-3 pb-2 text-[11px] leading-snug text-slate-500">{selectedFolder.description}</p>
          ) : null}
          <DocumentList
            documents={documents}
            selectedId={selectedId}
            query={query}
            loading={docsQ.isLoading}
            onQueryChange={setQuery}
            onSelect={d => void selectDocument(d.id)}
            canDrag={canAuthor}
            emptyHint={
              canAuthor && !query
                ? 'Nothing here yet — create a document from a template or import a file.'
                : undefined
            }
          />
        </section>

        {/* Editor */}
        <section
          data-tour="studio-editor"
          className={
            editorFullscreen
              ? 'fixed inset-0 z-50 flex min-h-0 flex-col bg-white shadow-2xl'
              : 'flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm'
          }
          aria-label="Editor"
          aria-modal={editorFullscreen || undefined}
        >
          {!selectedId ? (
            <EmptyEditor canAuthor={canAuthor} onNew={() => setNewOpen(true)} recent={(allDocsQ.data ?? []).slice(0, 5)} onOpen={id => void selectDocument(id)} />
          ) : docQ.isError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-[1.125rem] font-medium text-slate-800">Could not load this document</p>
              <p className="max-w-md text-[1rem] leading-relaxed text-slate-600">
                It may belong to a different library. Utility binders live in the district scope (
                {scopeLabel}), not the statewide program library.
              </p>
              {requestedScope ? null : (
                <p className="text-[0.875rem] text-slate-500">
                  Open the binder again from Continuity, or add{' '}
                  <code className="rounded bg-slate-100 px-1">?scope=&lt;district_code&gt;</code> to
                  the URL.
                </p>
              )}
            </div>
          ) : docQ.isLoading || !doc ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading document…
            </div>
          ) : (
            <>
              <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur-sm">
                <Input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setTitleDraft(doc.title);
                  }}
                  readOnly={!canAuthor}
                  aria-label="Document title"
                  className="h-9 min-w-[200px] flex-1 border-transparent bg-transparent px-2 text-base font-semibold text-slate-900 shadow-none hover:border-slate-200 focus:border-sky-300"
                />
                <div className="flex items-center gap-2" data-tour="studio-status">
                  {doc.doc_type === 'tutorial' ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200">
                      Tutorial
                    </span>
                  ) : null}
                  {doc.external_ref ? (
                    doc.external_ref.external_web_url ? (
                      <a
                        href={doc.external_ref.external_web_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-violet-200 hover:bg-violet-100"
                        title={`Linked in ${doc.external_ref.provider}`}
                      >
                        <Link2 className="h-3 w-3" aria-hidden /> External link
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-violet-200">
                        <Link2 className="h-3 w-3" aria-hidden /> Linked ({doc.external_ref.provider})
                      </span>
                    )
                  ) : null}
                  {(doc.custody_status && doc.custody_status !== 'local') ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200">
                      {doc.custody_status.replace(/_/g, ' ')}
                    </span>
                  ) : null}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${statusTone(doc.status)}`}>{doc.status}</span>
                  <span className="text-[11px] text-slate-500">v{doc.version_no}</span>
                  <SaveIndicator state={saveState} updatedAt={doc.updated_at} />
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9"
                    data-tour="studio-fullscreen"
                    title={editorFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen editor'}
                    aria-pressed={editorFullscreen}
                    onClick={() => setEditorFullscreen(v => !v)}
                  >
                    {editorFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    <span className="ml-1 hidden sm:inline">{editorFullscreen ? 'Exit' : 'Fullscreen'}</span>
                  </Button>
                  {canAuthor && doc.doc_type === 'tutorial' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9"
                      data-tour="studio-rerecord"
                      onClick={() => startTutorialRecording(doc.id)}
                    >
                      <Video className="mr-1 h-4 w-4" /> Re-record
                    </Button>
                  ) : null}
                  {canAuthor ? (
                    <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => void handleExplicitSave()} disabled={saveMut.isPending} data-tour="studio-save">
                      {saveMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save
                    </Button>
                  ) : null}
                  {canPublish && doc.status !== 'published' ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 bg-[#07111f] text-white hover:bg-slate-800"
                      onClick={async () => {
                        await flushAutosave();
                        publishMut.mutate(doc.id);
                      }}
                      disabled={publishMut.isPending}
                      data-tour="studio-publish"
                    >
                      <Send className="mr-1 h-4 w-4" /> Publish
                    </Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="sm" variant="outline" className="h-9" data-tour="studio-export" disabled={!!exporting}>
                        {exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />} Export
                        <ChevronDown className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>Download as</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => void doExport('pdf')}>PDF (branded)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void doExport('docx')}>Word (.docx)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void doExport('markdown')}>Markdown (.md)</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => api.openPrintPreview(doc.id, studioScope)}>
                        <Printer className="mr-2 h-4 w-4" /> Print view
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    type="button"
                    size="sm"
                    variant={showVersions ? 'default' : 'outline'}
                    className="h-9"
                    aria-pressed={showVersions}
                    onClick={() => setShowVersions(v => !v)}
                    data-tour="studio-versions-toggle"
                  >
                    <History className="mr-1 h-4 w-4" /> Versions
                  </Button>
                  {canAuthor ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" size="sm" variant="outline" className="h-9 w-9 px-0" aria-label="More actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => duplicateMut.mutate(doc.id)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuLabel className="text-xs text-slate-500">Move to folder</DropdownMenuLabel>
                        <DropdownMenuItem disabled={!doc.folder_id} onClick={() => moveMut.mutate({ id: doc.id, folder_id: null })}>
                          Unfiled
                        </DropdownMenuItem>
                        {folders.map(f => (
                          <DropdownMenuItem key={f.id} disabled={f.id === doc.folder_id} onClick={() => moveMut.mutate({ id: doc.id, folder_id: f.id })}>
                            {f.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        {doc.status === 'published' ? (
                          <DropdownMenuItem onClick={() => statusMut.mutate({ id: doc.id, status: 'draft' })}>Return to draft</DropdownMenuItem>
                        ) : null}
                        {doc.status !== 'archived' ? (
                          <DropdownMenuItem onClick={() => statusMut.mutate({ id: doc.id, status: 'archived' })}>Archive</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => statusMut.mutate({ id: doc.id, status: 'draft' })}>Unarchive</DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-700 focus:text-red-700"
                          onClick={() => {
                            if (window.confirm(`Delete "${doc.title}" and all its versions? This cannot be undone.`)) deleteMut.mutate(doc.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </header>

              <div className="flex min-h-0 flex-1 flex-col">
                {doc.doc_type === 'tutorial' && doc.tutorial_data?.steps?.length ? (
                  <div className="border-b border-slate-200 px-3 py-3" data-tour="studio-tutorial-player">
                    <TutorialPlayer document={doc} scope={studioScope} compact />
                  </div>
                ) : null}
                <div className="flex min-h-0 flex-1">
                <div className="min-h-0 min-w-0 flex-1 p-2">
                  <StudioEditor
                    key={doc.id}
                    ref={editorRef}
                    initialMarkdown={doc.content_markdown || ''}
                    readOnly={!canAuthor}
                    documentId={doc.id}
                    scope={studioScope}
                    templateAudience={templateAudience}
                    pinToolbar
                    onChange={handleEditorChange}
                    onUploadError={msg => toast({ title: 'Image upload failed', description: msg, variant: 'destructive' })}
                  />
                </div>
                {showVersions ? (
                  <aside
                    data-tour="studio-versions"
                    className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-slate-50/60"
                    aria-label="Version history"
                  >
                    <div className="flex items-center justify-between px-3 py-2">
                      <p className="text-sm font-semibold text-slate-800">Version history</p>
                      <span className="text-[11px] text-slate-500">{versionsQ.data?.length ?? 0}</span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {versionsQ.isLoading ? (
                        <p className="px-3 py-4 text-sm text-slate-500">Loading…</p>
                      ) : (
                        <VersionHistoryPanel
                          versions={versionsQ.data ?? []}
                          currentVersion={doc.version_no}
                          canRestore={canAuthor}
                          busyVersion={restoringVersion}
                          onRestore={v => {
                            if (window.confirm(`Restore version ${v}? The current content is kept as a version.`)) restoreMut.mutate({ id: doc.id, version_no: v });
                          }}
                        />
                      )}
                    </div>
                  </aside>
                ) : null}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <NewDocumentDialog
        open={newOpen}
        folders={folders}
        defaultFolderId={defaultFolderForNew}
        busy={busy}
        tourActive={tourOpen}
        audience={templateAudience}
        onClose={() => setNewOpen(false)}
        onCreate={({ title, folder_id, template }) =>
          createMut.mutate({ title, folder_id, template_id: template.id, markdown: template.markdown })
        }
      />

      {canConnectLibrary ? (
        <ExternalLibraryDialog
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          studioScope={studioScope}
          folderId={defaultFolderForNew ?? undefined}
          onImported={() => invalidateLists()}
        />
      ) : null}

      {canCustodyTransfer ? (
        <CustodyTransferDialog
          open={custodyOpen}
          onOpenChange={setCustodyOpen}
          studioScope={studioScope}
          documents={custodyDocs}
          folders={folders}
          onTransferred={() => {
            invalidateLists();
            if (selectedId) qc.invalidateQueries({ queryKey: ['studio', 'document', selectedId] });
          }}
        />
      ) : null}

      <ApplicationStepsOverviewDialog open={overviewOpen} onOpenChange={setOverviewOpen} />
      <ApplicationStepsTourOverlay />
      <Ww360TourOverlay config={tourConfig} autoOpen autoOpenDelayMs={900} onOpenChange={setTourOpen} />
    </div>
  );
}

function SaveIndicator({ state, updatedAt }: { state: SaveState; updatedAt?: string | null | undefined }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === 'dirty') return <span className="text-[11px] text-amber-700">Unsaved changes</span>;
  if (state === 'error') return <span className="text-[11px] text-red-700">Save failed</span>;
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Saved
      </span>
    );
  }
  return <span className="text-[11px] text-slate-400">Updated {relativeTime(updatedAt)}</span>;
}

function EmptyEditor({
  canAuthor,
  onNew,
  recent,
  onOpen,
}: {
  canAuthor: boolean;
  onNew: () => void;
  recent: DocSummary[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center" data-tour="studio-empty">
      <div className="rounded-2xl bg-sky-50 p-4">
        <FileText className="h-8 w-8 text-sky-600" />
      </div>
      <div>
        <p className="text-base font-semibold text-slate-900">Pick a document, or start a new one</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Templates cover regional briefs, cohort plans, EPA quarterly narratives, utility invitations and newsletters.
          Type <kbd className="rounded border border-slate-300 bg-slate-50 px-1 text-[11px]">/</kbd> in the editor for blocks.
        </p>
      </div>
      {canAuthor ? (
        <Button type="button" onClick={onNew} className="bg-[#07111f] text-white hover:bg-slate-800">
          <FilePlus2 className="mr-1.5 h-4 w-4" /> New document
        </Button>
      ) : null}
      {recent.length ? (
        <div className="mt-2 w-full max-w-md text-left">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recently updated</p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {recent.map(d => (
              <li key={d.id}>
                <button type="button" onClick={() => onOpen(d.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                  <span className="truncate text-slate-800">{d.title}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">{relativeTime(d.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
