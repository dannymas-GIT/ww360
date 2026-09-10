import React, { useMemo, useState } from 'react';
import { FilePlus2, Sparkles } from 'lucide-react';
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
import {
  STUDIO_TEMPLATE_CATEGORIES,
  groupedTemplatesForAudience,
  newDocumentDialogBlurb,
  type StudioTemplate,
  type StudioTemplateAudience,
} from '@/config/studioTemplates';
import type { DocFolder } from '@/services/docStudioService';

export interface NewDocumentDialogProps {
  open: boolean;
  folders: DocFolder[];
  defaultFolderId: string | null;
  busy?: boolean | undefined;
  /**
   * While the guided tour is showing, render non-modal so the tour card stays
   * clickable and outside clicks don't dismiss the gallery.
   */
  tourActive?: boolean | undefined;
  /** Filters the gallery to program / district / operator starters. */
  audience?: StudioTemplateAudience;
  onClose: () => void;
  onCreate: (payload: { title: string; folder_id: string | null; template: StudioTemplate }) => void;
}

export function NewDocumentDialog({
  open,
  folders,
  defaultFolderId,
  busy,
  tourActive = false,
  audience = 'program',
  onClose,
  onCreate,
}: NewDocumentDialogProps) {
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [templateId, setTemplateId] = useState<string>('blank');

  React.useEffect(() => {
    if (open) {
      setTitle('');
      setFolderId(defaultFolderId);
      setTemplateId('blank');
    }
  }, [open, defaultFolderId]);

  const grouped = useMemo(() => groupedTemplatesForAudience(audience), [audience]);

  const template = useMemo(() => {
    const flat = grouped.flatMap(g => g.items);
    return flat.find(t => t.id === templateId) ?? flat[0];
  }, [grouped, templateId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;
    const finalTitle = title.trim() || (template.id === 'blank' ? 'Untitled document' : template.name);
    onCreate({ title: finalTitle, folder_id: folderId, template });
  };

  return (
    <Dialog open={open} modal={!tourActive} onOpenChange={v => (!v ? onClose() : null)}>
      <DialogContent
        className="max-w-3xl"
        data-tour="studio-new-dialog"
        {...(tourActive
          ? {
              onInteractOutside: (e: Event) => e.preventDefault(),
              onPointerDownOutside: (e: Event) => e.preventDefault(),
            }
          : {})}
      >
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus2 className="h-5 w-5 text-sky-600" /> New document
            </DialogTitle>
            <DialogDescription>{newDocumentDialogBlurb(audience)}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
            <div className="max-h-[52vh] overflow-y-auto pr-1" data-tour="studio-template-gallery">
              {grouped.map(group => (
                <div key={group.category} className="mb-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {STUDIO_TEMPLATE_CATEGORIES[group.category]}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.items.map(t => {
                      const active = t.id === templateId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTemplateId(t.id)}
                          aria-pressed={active}
                          className={`rounded-lg border p-3 text-left transition ${
                            active
                              ? 'border-sky-400 bg-sky-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                            {t.id !== 'blank' ? <Sparkles className="h-3.5 w-3.5 text-sky-500" /> : null}
                            {t.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{t.preview}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Title</span>
                <Input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={template?.id === 'blank' ? 'Untitled document' : template?.name}
                  maxLength={200}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Folder</span>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={folderId ?? ''}
                  onChange={e => setFolderId(e.target.value || null)}
                >
                  <option value="">Unfiled</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              {template ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">{template.name}</p>
                  <p className="mt-1">{template.description}</p>
                  {template.markdown ? (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-500">
                      {template.markdown.slice(0, 600)}
                      {template.markdown.length > 600 ? '…' : ''}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !template} className="bg-[#07111f] text-white hover:bg-slate-800">
              {busy ? 'Creating…' : 'Create document'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
