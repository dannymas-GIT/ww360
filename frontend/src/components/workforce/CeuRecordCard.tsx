import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileUp, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/components/ui/use-toast';
import {
  useCeuVouchers,
  useDeleteCeuRecord,
  useDeleteCeuVoucher,
  useUploadCeuVoucher,
} from '@/hooks/useWorkforceSuccession';
import { downloadCeuVoucher, type WorkforceCeuRecord } from '@/services/workforceSuccessionService';

const CEU_CONTACT_HOURS_PER_CEU = 10;

function formatContactHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

interface Props {
  districtCode: string;
  record: WorkforceCeuRecord;
  canManage: boolean;
  highlight?: boolean;
  defaultExpanded?: boolean;
}

export function CeuRecordCard({
  districtCode,
  record,
  canManage,
  highlight = false,
  defaultExpanded = false,
}: Props) {
  const { toast } = useToast();
  const vouchersQuery = useCeuVouchers(districtCode, record.id);
  const uploadMutation = useUploadCeuVoucher();
  const deleteVoucherMutation = useDeleteCeuVoucher();
  const deleteRecordMutation = useDeleteCeuRecord();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const vouchers = vouchersQuery.data ?? [];
  const voucherCount = record.voucher_count ?? vouchers.length;
  const hasVoucher = voucherCount > 0;
  const contactHours =
    record.contact_hours ?? (record.ceu_hours ? record.ceu_hours * CEU_CONTACT_HOURS_PER_CEU : 0);

  useEffect(() => {
    if (defaultExpanded) setExpanded(true);
  }, [defaultExpanded]);

  const uploadFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      try {
        await uploadMutation.mutateAsync({ recordId: record.id, districtCode, file });
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
        return;
      }
    }
    toast({ title: files.length > 1 ? 'Vouchers uploaded' : 'Voucher uploaded' });
  };

  const removeVoucher = async (voucherId: number) => {
    if (!window.confirm('Remove this voucher?')) return;
    try {
      await deleteVoucherMutation.mutateAsync({ voucherId, districtCode });
      toast({ title: 'Voucher removed' });
    } catch (err) {
      toast({
        title: 'Could not remove voucher',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const removeRecord = async () => {
    if (!window.confirm(`Remove CEU record "${record.course_title}"?`)) return;
    try {
      await deleteRecordMutation.mutateAsync({ recordId: record.id, districtCode });
      toast({ title: 'CEU record removed' });
    } catch (err) {
      toast({
        title: 'Could not remove CEU record',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className={`rounded-lg border bg-white ${highlight ? 'border-amber-300 bg-amber-50/40' : ''}`}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          <CollapsibleTrigger className="flex-1 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-gray-900">{record.course_title}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                  <span>{formatContactHours(contactHours)} contact hrs</span>
                  <span>{record.completion_date}</span>
                  {record.provider ? <span>{record.provider}</span> : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {record.category ? (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {record.category}
                    </Badge>
                  ) : null}
                  {record.certification_grade ? (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      Grade {record.certification_grade}
                    </Badge>
                  ) : null}
                  {record.approval_number ? (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      #{record.approval_number}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant={hasVoucher ? 'default' : 'outline'}
                  className={
                    hasVoucher
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }
                >
                  {hasVoucher
                    ? `${voucherCount} voucher${voucherCount === 1 ? '' : 's'}`
                    : 'No voucher'}
                </Badge>
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 transition-transform ${
                    expanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </CollapsibleTrigger>
          {canManage ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 text-gray-400 hover:text-red-600"
              onClick={() => void removeRecord()}
              disabled={deleteRecordMutation.isPending}
              aria-label="Remove CEU record"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>

        <CollapsibleContent className="mt-3 space-y-2 border-t pt-3">
          {canManage ? (
            <div
              className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-3 text-center transition-colors ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              }`}
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
              }}
            >
              <Upload className="mb-1 h-4 w-4 text-gray-400" />
              <p className="text-xs text-gray-600">Drag vouchers here or</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => fileRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                <FileUp className="mr-1 h-3 w-3" /> Attach voucher
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files?.length) void uploadFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          ) : null}
          {vouchers.length > 0 ? (
            <ul className="space-y-1">
              {vouchers.map(v => (
                <li key={v.id} className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    className="truncate text-blue-700 underline"
                    onClick={() => void downloadCeuVoucher(v.id, districtCode)}
                  >
                    {v.filename}
                  </button>
                  {canManage ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => void removeVoucher(v.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-amber-700">No voucher attached yet.</p>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
