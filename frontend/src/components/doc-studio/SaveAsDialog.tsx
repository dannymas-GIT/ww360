import { useEffect, useMemo, useState } from 'react';
import { Folder as FolderIcon, Inbox, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DocFolder } from '@/services/docStudioService';
import { isBinderFolder, isBindersRootFolder } from '@/services/docStudioService';
import { BinderIcon } from '@/components/doc-studio/BinderIcon';

export type SaveAsDest = 'folder' | 'new_binder' | 'new_folder' | 'unfiled';

export interface SaveAsPayload {
  title: string;
  mode: SaveAsDest;
  folderId?: string | null;
  newName?: string;
}

/** `saveAs` copies into the destination; `file` moves the existing document. */
export type SaveAsIntent = 'saveAs' | 'file';

export interface SaveAsDialogProps {
  open: boolean;
  folders: DocFolder[];
  defaultTitle: string;
  defaultFolderId?: string | null;
  busy?: boolean;
  intent?: SaveAsIntent;
  onClose: () => void;
  onSave: (payload: SaveAsPayload) => void;
}

export function SaveAsDialog({
  open,
  folders,
  defaultTitle,
  defaultFolderId = null,
  busy = false,
  intent = 'saveAs',
  onClose,
  onSave,
}: SaveAsDialogProps) {
  const bindersRoot = useMemo(() => folders.find(isBindersRootFolder) ?? null, [folders]);
  const binders = useMemo(
    () =>
      folders.filter(
        f =>
          !isBindersRootFolder(f) &&
          (isBinderFolder(f) || (bindersRoot ? f.parent_id === bindersRoot.id : false))
      ),
    [folders, bindersRoot]
  );
  const otherFolders = useMemo(
    () => folders.filter(f => !isBindersRootFolder(f) && !binders.includes(f)),
    [folders, binders]
  );
  const isFile = intent === 'file';

  const [title, setTitle] = useState(defaultTitle);
  const [mode, setMode] = useState<SaveAsDest>('folder');
  const [folderId, setFolderId] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setNewName('');

    const pre = defaultFolderId;
    if (pre && [...binders, ...otherFolders].some(f => f.id === pre)) {
      setMode('folder');
      setFolderId(pre);
      return;
    }
    if (binders[0]) {
      setMode('folder');
      setFolderId(binders[0].id);
      return;
    }
    if (otherFolders[0]) {
      setMode('folder');
      setFolderId(otherFolders[0].id);
      return;
    }
    setMode('new_binder');
    setFolderId('');
  }, [open, defaultTitle, defaultFolderId, folders, binders, otherFolders]);

  const canSubmit = (() => {
    if (!title.trim()) return false;
    if (mode === 'folder') return !!folderId;
    if (mode === 'new_binder' || mode === 'new_folder') return !!newName.trim();
    return true;
  })();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    const payload: SaveAsPayload = { title: title.trim(), mode };
    if (mode === 'folder') payload.folderId = folderId;
    else if (mode === 'new_binder' || mode === 'new_folder') payload.newName = newName.trim();
    else payload.folderId = null;
    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg" data-tour="studio-save-as-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {isFile ? <BinderIcon className="h-5 w-5" /> : <Save className="h-5 w-5" aria-hidden />}
            {isFile ? 'File in binder' : 'Save As'}
          </DialogTitle>
          <DialogDescription className="text-base text-slate-600">
            {isFile
              ? 'Pick the binder this document belongs in. It moves there — no copy is made.'
              : 'Choose a title and where to put your editable copy. The original sample stays read-only.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {!isFile ? (
            <label className="block text-base">
              <span className="mb-1.5 block font-medium text-slate-800">Title</span>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-11 text-base"
                maxLength={500}
                required
                autoFocus
                aria-label="Document title"
              />
            </label>
          ) : (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-base text-slate-700">
              <span className="font-medium">{defaultTitle}</span>
            </p>
          )}

          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-base font-medium text-slate-800">
              {isFile ? 'File to' : 'Save to'}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { id: 'folder' as const, label: 'Existing binder / folder', icon: BinderIcon },
                  { id: 'new_binder' as const, label: 'New binder', icon: BinderIcon },
                  { id: 'new_folder' as const, label: 'New folder', icon: FolderIcon },
                  { id: 'unfiled' as const, label: 'Unfiled', icon: Inbox },
                ] as const
              ).map(opt => {
                const Icon = opt.icon;
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`flex min-h-[44px] items-center gap-2 rounded-md border px-3 py-2 text-left text-base transition ${
                      active
                        ? 'border-sky-400 bg-sky-50 text-sky-950 ring-1 ring-sky-300'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                    }`}
                    onClick={() => setMode(opt.id)}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {mode === 'folder' ? (
            <label className="block text-base">
              <span className="mb-1.5 block font-medium text-slate-800">Destination</span>
              <select
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-base"
                value={folderId}
                onChange={e => setFolderId(e.target.value)}
                aria-label="Destination folder or binder"
                required
              >
                {binders.length ? (
                  <optgroup label="Binders">
                    {binders.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {otherFolders.length ? (
                  <optgroup label="Folders">
                    {otherFolders.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {!folders.length ? <option value="">No folders yet — create a binder</option> : null}
              </select>
            </label>
          ) : null}

          {mode === 'new_binder' ? (
            <label className="block text-base">
              <span className="mb-1.5 block font-medium text-slate-800">Binder name</span>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-11 text-base"
                placeholder="e.g. Plant A — SOPs"
                maxLength={200}
                required
                aria-label="Binder name"
              />
              <span className="mt-1 block text-sm text-slate-500">
                Creates a working binder folder for this document and related copies.
              </span>
            </label>
          ) : null}

          {mode === 'new_folder' ? (
            <label className="block text-base">
              <span className="mb-1.5 block font-medium text-slate-800">Folder name</span>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-11 text-base"
                placeholder="e.g. Training plans"
                maxLength={200}
                required
                aria-label="Folder name"
              />
            </label>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="min-h-[44px] text-base" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-[44px] bg-[#07111f] text-base text-white hover:bg-slate-800"
              disabled={!canSubmit || busy}
              data-tour="studio-save-as-confirm"
            >
              {busy ? (isFile ? 'Filing…' : 'Saving…') : isFile ? 'File in binder' : 'Save As'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
