/**
 * Transfer eligible Document Studio documents to connected cloud storage.
 */
import { useEffect, useState } from 'react';
import { CloudUpload, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  createCustodyTransfer,
  fetchCustodyAcknowledgment,
  fetchCustodyPolicy,
  fetchLibraryConnections,
  isCustodyTransferEligible,
  ownerFromScope,
  recordCustodyAcknowledgment,
  type DocFolder,
  type DocSummary,
} from '@/services/docStudioService';

export interface CustodyTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studioScope: string;
  documents: DocSummary[];
  folders: DocFolder[];
  onTransferred?: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  microsoft_graph: 'OneDrive / SharePoint',
  google_drive: 'Google Drive',
  dropbox: 'Dropbox',
};

export function CustodyTransferDialog({
  open,
  onOpenChange,
  studioScope,
  documents,
  folders,
  onTransferred,
}: CustodyTransferDialogProps) {
  const { ownerType, ownerCode } = ownerFromScope(studioScope);
  const [connections, setConnections] = useState<Awaited<ReturnType<typeof fetchLibraryConnections>>>([]);
  const [connectionId, setConnectionId] = useState('');
  const [policyMarkdown, setPolicyMarkdown] = useState('');
  const [ackText, setAckText] = useState('');
  const [ackConfirmed, setAckConfirmed] = useState(false);
  const [alreadyAcked, setAlreadyAcked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folderById = new Map(folders.map(f => [f.id, f]));
  const eligible = documents.filter(d =>
    isCustodyTransferEligible(d, d.folder_id ? folderById.get(d.folder_id) : null)
  );
  const ineligibleCount = documents.length - eligible.length;

  useEffect(() => {
    if (!open) return;
    void fetchCustodyPolicy(studioScope).then(p => setPolicyMarkdown(p.markdown));
    void fetchLibraryConnections(studioScope).then(rows => {
      setConnections(rows);
      if (rows.length) setConnectionId(rows[0].id);
    });
    void fetchCustodyAcknowledgment(studioScope, ownerType, ownerCode).then(row => {
      setAlreadyAcked(!!row);
      if (row) setAckText(row.acknowledgment_text);
    });
  }, [open, studioScope, ownerType, ownerCode]);

  const handleAcknowledge = async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await recordCustodyAcknowledgment(
        studioScope,
        ownerType,
        ownerCode,
        ackConfirmed
      );
      setAckText(row.acknowledgment_text);
      setAlreadyAcked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!connectionId || eligible.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await createCustodyTransfer(studioScope, {
        document_ids: eligible.map(d => d.id),
        destination_owner_type: ownerType,
        destination_owner_code: ownerCode,
        connection_id: connectionId,
        external_folder_id:
          connections.find(c => c.id === connectionId)?.default_folder_id || 'root',
        export_format: 'pdf',
        retention_days: 30,
      });
      onTransferred?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5 text-sky-600" /> Transfer custody
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-600">
          Upload eligible documents to your connected cloud library. After verification, WW360
          purges local content after the retention window.
        </p>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-800">
            {eligible.length} document{eligible.length === 1 ? '' : 's'} eligible
          </p>
          {ineligibleCount > 0 ? (
            <p className="mt-1 text-xs text-slate-500">
              {ineligibleCount} skipped (tutorials, shift logs, templates, or already transferred).
            </p>
          ) : null}
        </div>

        {connections.length === 0 ? (
          <p className="text-sm text-amber-800">
            Connect a cloud library first (External library button in the header).
          </p>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Destination connection</span>
            <select
              className="h-10 w-full rounded-md border border-slate-200 px-3"
              value={connectionId}
              onChange={e => setConnectionId(e.target.value)}
            >
              {connections.map(c => (
                <option key={c.id} value={c.id}>
                  {PROVIDER_LABELS[c.provider] || c.provider}
                  {c.default_folder_path ? ` · ${c.default_folder_path}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="max-h-40 overflow-y-auto rounded border border-slate-200 p-2 text-xs text-slate-600 whitespace-pre-wrap">
          {policyMarkdown || 'Loading policy…'}
        </div>

        {!alreadyAcked ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={ackConfirmed}
              onChange={e => setAckConfirmed(e.target.checked)}
            />
            <span>I acknowledge the Water Workforce 360 custody policy.</span>
          </label>
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> Policy acknowledged.
          </p>
        )}

        {ackText && !alreadyAcked ? (
          <p className="text-xs text-slate-500">{ackText}</p>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2">
          {!alreadyAcked ? (
            <Button
              type="button"
              variant="outline"
              disabled={loading || !ackConfirmed}
              onClick={() => void handleAcknowledge()}
            >
              Acknowledge policy
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loading || !connectionId || eligible.length === 0}
              onClick={() => void handleTransfer()}
            >
              {loading ? 'Transferring…' : 'Transfer now'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
