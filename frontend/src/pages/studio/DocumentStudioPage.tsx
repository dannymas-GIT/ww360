/**
 * Document Studio — folders · documents · rich editor, for One Water Workforce content.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Copy,
  Download,
  FilePlus2,
  FileText,
  FileUp,
  History,
  Loader2,
  MoreHorizontal,
  Printer,
  Save,
  Send,
  Trash2,
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
import { Ww360PageHero } from '@/components/ww360/Ww360PageHero';
import { Ww360TourOverlay, requestOpenTour } from '@/components/ww360/Ww360TourOverlay';
import { StudioEditor, type StudioEditorHandle } from '@/components/doc-studio/StudioEditor';
import { ALL_DOCS, FolderTree, UNFILED } from '@/components/doc-studio/FolderTree';
import { DocumentList, relativeTime, statusTone } from '@/components/doc-studio/DocumentList';
import { VersionHistoryPanel } from '@/components/doc-studio/VersionHistoryPanel';
import { NewDocumentDialog } from '@/components/doc-studio/NewDocumentDialog';
import * as api from '@/services/docStudioService';
import type { DocDetail, DocFolder, DocSummary } from '@/services/docStudioService';
import { templateById } from '@/config/studioTemplates';
import { buildStudioTourConfig, STUDIO_TOUR_OPEN_EVENT } from './studioTourContent';

const AUTOSAVE_MS = 2500;

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function errMessage(err: unknown): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const r = (err as { response?: { data?: { detail?: string } } }).response;
    if (r?.data?.detail) return r.data.detail;
  }
  return err instanceof Error ? err.message : String(err);
}

export default function DocumentStudioPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();

  const [folderSel, setFolderSel] = useState<string>(ALL_DOCS);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('doc'));
  const [showVersions, setShowVersions] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [titleDraft, setTitleDraft] = useState('');
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);

  const editorRef = useRef<StudioEditorHandle>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimer = useRef<number | null>(null);
  const pendingMarkdown = useRef<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────
  const accessQ = useQuery({ queryKey: ['studio', 'access'], queryFn: () => api.fetchAccess() });
  const canAuthor = !!accessQ.data?.can_author;
  const canPublish = !!accessQ.data?.can_publish;
  const scopeLabel = accessQ.data?.scope_label ?? 'Program library';

  const foldersQ = useQuery({
    queryKey: ['studio', 'folders'],
    queryFn: () => api.fetchFolders(),
    enabled: accessQ.isSuccess,
  });
  const folders: DocFolder[] = foldersQ.data ?? [];

  const listFolderParam = folderSel === ALL_DOCS ? undefined : folderSel === UNFILED ? UNFILED : folderSel;
  const docsQ = useQuery({
    queryKey: ['studio', 'documents', listFolderParam ?? 'all', query],
    queryFn: () => api.fetchDocuments({ folder_id: listFolderParam ?? undefined, q: query || undefined }),
    enabled: accessQ.isSuccess,
  });
  const documents: DocSummary[] = docsQ.data ?? [];

  const allDocsQ = useQuery({
    queryKey: ['studio', 'documents', 'all', ''],
    queryFn: () => api.fetchDocuments({}),
    enabled: accessQ.isSuccess,
  });
  const totalCount = allDocsQ.data?.length ?? 0;
  const unfiledCount = (allDocsQ.data ?? []).filter(d => !d.folder_id).length;

  const docQ = useQuery({
    queryKey: ['studio', 'document', selectedId],
    queryFn: () => api.fetchDocument(selectedId as string),
    enabled: !!selectedId && accessQ.isSuccess,
  });
  const doc: DocDetail | undefined = docQ.data;

  const versionsQ = useQuery({
    queryKey: ['studio', 'versions', selectedId],
    queryFn: () => api.fetchVersions(selectedId as string),
    enabled: !!selectedId && showVersions,
  });

  useEffect(() => {
    if (doc) setTitleDraft(doc.title);
  }, [doc?.id, doc?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (selectedId) next.set('doc', selectedId);
    else next.delete('doc');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      api.saveContent(vars.id, {
        content_markdown: vars.markdown,
        content_json: vars.json,
        autosave: vars.autosave,
        title: vars.title,
        note: vars.note,
      }),
    onSuccess: (data, vars) => {
      qc.setQueryData(['studio', 'document', vars.id], data);
      setSaveState('saved');
      if (!vars.autosave) {
        qc.invalidateQueries({ queryKey: ['studio', 'versions', vars.id] });
        toast({ title: `Saved v${data.version_no}`, description: data.title });
      }
      invalidateLists();
    },
    onError: err => {
      setSaveState('error');
      toast({ title: 'Save failed', description: errMessage(err), variant: 'destructive' });
    },
  });

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
      await saveMut.mutateAsync({ id: selectedId, markdown, json: editorRef.current?.getJson(), autosave: true });
    } catch {
      /* toast handled in onError */
    }
  }, [canAuthor, saveMut, selectedId]);

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
    await saveMut
      .mutateAsync({
        id: selectedId,
        markdown,
        json: editorRef.current?.getJson(),
        autosave: false,
        title: titleDraft.trim() || undefined,
        note: 'Manual save',
      })
      .catch(() => undefined);
  }, [canAuthor, doc?.content_markdown, saveMut, selectedId, titleDraft]);

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

  // Flush on unmount / doc switch
  useEffect(() => () => void flushAutosave(), [flushAutosave]);

  const selectDocument = useCallback(
    async (id: string | null) => {
      await flushAutosave();
      setSaveState('idle');
      setSelectedId(id);
    },
    [flushAutosave]
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
        template_id: vars.template_id === 'blank' ? null : vars.template_id,
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
      await api.downloadExport(doc.id, fmt, doc.title);
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
          const tpl = templateById('regional-brief');
          try {
            const created = await api.createDocument({
              title: 'Sample — Regional workforce brief',
              template_id: 'regional-brief',
              content_markdown: tpl?.markdown ?? '',
            });
            invalidateLists();
            await selectDocument(created.id);
          } catch {
            /* ignore */
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, allDocsQ.data, canAuthor]
  );

  // ── Render ─────────────────────────────────────────────────────────────
  const selectedFolder = folders.find(f => f.id === folderSel);
  const defaultFolderForNew = folderSel !== ALL_DOCS && folderSel !== UNFILED ? folderSel : null;
  const busy = createMut.isPending || importMut.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <Ww360PageHero
        eyebrow="Document Studio"
        title="Create rich content for the One Water Workforce program"
        description="Briefs, cohort plans, grant narratives, invitations and newsletters — written once, versioned, and exported to PDF or Word with Water Workforce 360 branding."
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
            {canAuthor ? (
              <>
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
          <FolderTree
            folders={folders}
            selectedId={folderSel}
            totalCount={totalCount}
            unfiledCount={unfiledCount}
            canManage={canAuthor}
            onSelect={setFolderSel}
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
          className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
          aria-label="Editor"
        >
          {!selectedId ? (
            <EmptyEditor canAuthor={canAuthor} onNew={() => setNewOpen(true)} recent={(allDocsQ.data ?? []).slice(0, 5)} onOpen={id => void selectDocument(id)} />
          ) : docQ.isLoading || !doc ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading document…
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
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
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${statusTone(doc.status)}`}>{doc.status}</span>
                  <span className="text-[11px] text-slate-500">v{doc.version_no}</span>
                  <SaveIndicator state={saveState} updatedAt={doc.updated_at} />
                </div>
                <div className="ml-auto flex items-center gap-1">
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
                      <DropdownMenuItem onClick={() => api.openPrintPreview(doc.id)}>
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

              <div className="flex min-h-0 flex-1">
                <div className="min-h-0 min-w-0 flex-1 p-2">
                  <StudioEditor
                    key={doc.id}
                    ref={editorRef}
                    initialMarkdown={doc.content_markdown || ''}
                    readOnly={!canAuthor}
                    documentId={doc.id}
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
            </>
          )}
        </section>
      </div>

      <NewDocumentDialog
        open={newOpen}
        folders={folders}
        defaultFolderId={defaultFolderForNew}
        busy={busy}
        onClose={() => setNewOpen(false)}
        onCreate={({ title, folder_id, template }) =>
          createMut.mutate({ title, folder_id, template_id: template.id, markdown: template.markdown })
        }
      />

      <Ww360TourOverlay config={tourConfig} autoOpen autoOpenDelayMs={900} />
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
