import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import * as salesApi from '../../api/sales';
import { normalizeAttachments, type NormalizedAttachment } from '../../lib/normalizeAttachments';
import { SaleAttachmentEditor } from './SaleAttachmentEditor';

export interface SaleAddAttachmentsSheetProps {
  open: boolean;
  companyId: string;
  saleId: string;
  existingRaw: unknown;
  invoiceLabel?: string;
  onClose: () => void;
  onSaved: (merged: NormalizedAttachment[]) => void;
}

export function SaleAddAttachmentsSheet({
  open,
  companyId,
  saleId,
  existingRaw,
  invoiceLabel,
  onClose,
  onSaved,
}: SaleAddAttachmentsSheetProps) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = normalizeAttachments(existingRaw);

  useEffect(() => {
    if (!open) {
      setPendingFiles([]);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    if (saving) return;
    setPendingFiles([]);
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    if (!pendingFiles.length) {
      setError('Choose a photo or file first.');
      return;
    }
    if (!navigator.onLine) {
      setError('Attachments require an internet connection.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await salesApi.appendSaleAttachments(companyId, saleId, pendingFiles, existing);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPendingFiles([]);
      onSaved(res.data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title =
    existing.length > 0
      ? 'Update attachments'
      : 'Add attachments';

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full sm:max-w-lg bg-[#1F2937] sm:rounded-xl rounded-t-2xl border border-[#374151] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151]">
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {invoiceLabel ? (
              <p className="text-xs text-[#9CA3AF] truncate max-w-[240px]">{invoiceLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="p-2 rounded-lg hover:bg-[#374151] text-[#9CA3AF] disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error ? (
            <div className="p-3 rounded-lg bg-[#EF4444]/20 border border-[#EF4444] text-[#FCA5A5] text-sm">
              {error}
            </div>
          ) : null}
          <SaleAttachmentEditor
            existing={existing}
            pendingFiles={pendingFiles}
            onPendingChange={setPendingFiles}
            disabled={saving}
            compact
          />
        </div>
        <div className="p-4 border-t border-[#374151]">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || pendingFiles.length === 0}
            className="w-full h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              'Save attachments'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
