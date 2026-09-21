/**
 * Binder table of contents — numbered pages, drag a row to reorder.
 * Used by DocumentStudioPage when the selected folder is a binder.
 */
import { useEffect, useState, type DragEvent } from 'react';
import { FileText, FileUp, GripVertical, Loader2 } from 'lucide-react';
import type { DocSummary } from '@/services/docStudioService';
import { relativeTime, statusTone } from '@/components/doc-studio/DocumentList';

const TOC_ROW_MIME = 'application/x-ww360-binder-toc';

export interface BinderTocProps {
  documents: DocSummary[];
  selectedId: string | null;
  loading?: boolean | undefined;
  /** Authors can drag rows to change the page order. */
  canReorder: boolean;
  onSelect: (doc: DocSummary) => void;
  /** Full ordered id list after a drag-reorder. */
  onReorder: (documentIds: string[]) => void;
}

function sortByPageOrder(docs: DocSummary[]): DocSummary[] {
  return [...docs].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
  );
}

export function BinderToc({
  documents,
  selectedId,
  loading,
  canReorder,
  onSelect,
  onReorder,
}: BinderTocProps) {
  // Local order so the list follows the drag immediately (server confirms after).
  const [order, setOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  useEffect(() => {
    setOrder(sortByPageOrder(documents).map(d => d.id));
  }, [documents]);

  const byId = new Map(documents.map(d => [d.id, d]));
  const rows = order.map(id => byId.get(id)).filter((d): d is DocSummary => !!d);

  const handleDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    setDropTargetId(null);
    const sourceId = e.dataTransfer.getData(TOC_ROW_MIME) || draggingId;
    setDraggingId(null);
    if (!sourceId || sourceId === targetId) return;
    const next = order.filter(id => id !== sourceId);
    const at = next.indexOf(targetId);
    if (at === -1) return;
    next.splice(at, 0, sourceId);
    setOrder(next);
    onReorder(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {canReorder && rows.length > 1 ? (
        <p className="px-3 pb-1.5 text-sm text-slate-500">Drag a page to reorder the binder.</p>
      ) : null}
      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2" aria-busy={loading} aria-label="Binder table of contents">
        {rows.map((doc, idx) => {
          const active = doc.id === selectedId;
          const isDropTarget = dropTargetId === doc.id && draggingId !== doc.id;
          return (
            <li key={doc.id}>
              <button
                type="button"
                draggable={canReorder}
                onDragStart={
                  canReorder
                    ? e => {
                        e.dataTransfer.setData(TOC_ROW_MIME, doc.id);
                        e.dataTransfer.setData('text/plain', doc.title);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggingId(doc.id);
                      }
                    : undefined
                }
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropTargetId(null);
                }}
                onDragOver={
                  canReorder
                    ? e => {
                        if ([...e.dataTransfer.types].includes(TOC_ROW_MIME) || draggingId) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDropTargetId(doc.id);
                        }
                      }
                    : undefined
                }
                onDragLeave={() => setDropTargetId(cur => (cur === doc.id ? null : cur))}
                onDrop={canReorder ? e => handleDrop(e, doc.id) : undefined}
                onClick={() => onSelect(doc)}
                aria-current={active ? 'true' : undefined}
                title={canReorder ? 'Drag to reorder pages' : undefined}
                className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                  canReorder ? 'cursor-grab active:cursor-grabbing' : ''
                } ${
                  isDropTarget
                    ? 'border-sky-400 bg-sky-100'
                    : active
                      ? 'border-sky-300 bg-sky-50 shadow-sm'
                      : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                } ${draggingId === doc.id ? 'opacity-50' : ''}`}
              >
                {canReorder ? (
                  <GripVertical className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                ) : null}
                <span className="w-6 shrink-0 text-right text-base font-semibold tabular-nums text-slate-400">
                  {idx + 1}.
                </span>
                {doc.doc_type === 'imported_file' ? (
                  <FileUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-slate-900">
                    {doc.title || 'Untitled'}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
                    <span className={`rounded-full px-1.5 py-px text-[11px] font-medium ring-1 ${statusTone(doc.status)}`}>
                      {doc.status}
                    </span>
                    <span className="text-[11px]">{relativeTime(doc.updated_at)}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!loading && !rows.length ? (
          <li className="px-3 py-8 text-center text-sm text-slate-500">
            This binder is empty — use “File in binder…” on a document, or drag one here from another folder.
          </li>
        ) : null}
        {loading && !rows.length ? (
          <li className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </li>
        ) : null}
      </ol>
    </div>
  );
}
