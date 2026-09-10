import { History, RotateCcw } from 'lucide-react';
import type { DocVersion } from '@/services/docStudioService';
import { Button } from '@/components/ui/button';

export interface VersionHistoryPanelProps {
  versions: DocVersion[];
  currentVersion: number;
  canRestore: boolean;
  busyVersion?: number | null | undefined;
  onRestore: (versionNo: number) => void;
}

const KIND_LABEL: Record<string, string> = {
  save: 'Saved',
  publish: 'Published',
  restore: 'Restored',
  import: 'Imported',
};

export function VersionHistoryPanel({
  versions,
  currentVersion,
  canRestore,
  busyVersion,
  onRestore,
}: VersionHistoryPanelProps) {
  if (!versions.length) {
    return <p className="px-3 py-4 text-sm text-slate-500">No saved versions yet.</p>;
  }
  return (
    <ol className="space-y-1 px-2 pb-2" aria-label="Version history">
      {versions.map(v => {
        const isCurrent = v.version_no === currentVersion;
        return (
          <li
            key={v.id}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${
              isCurrent ? 'border-sky-200 bg-sky-50' : 'border-slate-100 bg-white'
            }`}
          >
            <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">
                v{v.version_no}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {KIND_LABEL[v.kind] ?? v.kind}
                  {isCurrent ? ' · current' : ''}
                </span>
              </p>
              <p className="text-[11px] text-slate-500">
                {new Date(v.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {v.note ? ` · ${v.note}` : ''}
              </p>
            </div>
            {canRestore && !isCurrent ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={busyVersion === v.version_no}
                onClick={() => onRestore(v.version_no)}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
              </Button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
