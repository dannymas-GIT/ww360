/**
 * Browse and re-insert images previously uploaded to Document Studio.
 */
import { useQuery } from '@tanstack/react-query';
import { Image as ImageIcon, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchAssets, type DocAsset } from '@/services/docStudioService';

export interface MediaLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string | null | undefined;
  scope?: string | undefined;
  onInsert: (url: string, filename: string) => void;
}

export function MediaLibraryModal({
  open,
  onOpenChange,
  documentId,
  scope,
  onInsert,
}: MediaLibraryModalProps) {
  const assetsQ = useQuery({
    queryKey: ['studio', 'assets', scope ?? 'default', documentId ?? 'all'],
    queryFn: () =>
      fetchAssets({
        ...(documentId ? { document_id: documentId } : {}),
        ...(scope ? { scope } : {}),
        images_only: true,
      }),
    enabled: open,
  });

  if (!open) return null;

  const assets: DocAsset[] = assetsQ.data ?? [];

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Media library"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Media library</h2>
            <p className="text-xs text-slate-500">Reuse images already uploaded to this library</p>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {assetsQ.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading images…
            </div>
          ) : assetsQ.isError ? (
            <p className="py-12 text-center text-sm text-red-600">Could not load media library.</p>
          ) : !assets.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
              <ImageIcon className="h-10 w-10 opacity-40" />
              <p className="text-sm">No images yet — upload, paste, or capture a screenshot first.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {assets.map(asset => (
                <li key={asset.id}>
                  <button
                    type="button"
                    className="group flex w-full flex-col overflow-hidden rounded-lg border border-slate-200 text-left transition hover:border-sky-300 hover:shadow-sm"
                    onClick={() => {
                      onInsert(asset.url, asset.filename);
                      onOpenChange(false);
                    }}
                    title={`Insert ${asset.filename}`}
                  >
                    <div className="aspect-square bg-slate-50">
                      <img
                        src={asset.url}
                        alt={asset.filename}
                        className="h-full w-full object-contain p-1"
                        loading="lazy"
                      />
                    </div>
                    <span className="truncate px-2 py-1.5 text-[11px] text-slate-600 group-hover:text-sky-800">
                      {asset.filename}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
