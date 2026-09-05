import { FileText, FileUp, Search } from 'lucide-react';
import type { DocSummary } from '@/services/docStudioService';
import { Input } from '@/components/ui/input';

export interface DocumentListProps {
  documents: DocSummary[];
  selectedId: string | null;
  query: string;
  loading?: boolean | undefined;
  onQueryChange: (q: string) => void;
  onSelect: (doc: DocSummary) => void;
  emptyHint?: string | undefined;
}

export function statusTone(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'archived':
      return 'bg-slate-100 text-slate-500 ring-slate-200';
    default:
      return 'bg-amber-50 text-amber-800 ring-amber-200';
  }
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function DocumentList({
  documents,
  selectedId,
  query,
  loading,
  onQueryChange,
  onSelect,
  emptyHint,
}: DocumentListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Search titles and text…"
            className="h-9 pl-8 text-sm"
            aria-label="Search documents"
          />
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2" aria-busy={loading}>
        {documents.map(doc => {
          const active = doc.id === selectedId;
          return (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => onSelect(doc)}
                aria-current={active ? 'true' : undefined}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? 'border-sky-300 bg-sky-50 shadow-sm'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  {doc.doc_type === 'imported_file' ? (
                    <FileUp className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  ) : (
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{doc.title || 'Untitled'}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                      <span className={`rounded-full px-1.5 py-px font-medium ring-1 ${statusTone(doc.status)}`}>
                        {doc.status}
                      </span>
                      <span>v{doc.version_no}</span>
                      <span>{doc.word_count.toLocaleString()} words</span>
                      <span>{relativeTime(doc.updated_at)}</span>
                    </p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {!loading && !documents.length ? (
          <li className="px-3 py-8 text-center text-sm text-slate-500">
            {emptyHint ?? (query ? 'No documents match that search.' : 'No documents here yet.')}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
