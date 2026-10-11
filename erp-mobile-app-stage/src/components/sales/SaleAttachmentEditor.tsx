import { useState } from 'react';
import { Loader2, Paperclip, Upload, X } from 'lucide-react';
import { MediaSourcePicker } from '../shared/MediaSourcePicker';
import { prepareAttachmentFilesForUpload } from '../../utils/imageCompression';
import { MAX_SALE_ATTACHMENT_BYTES, MAX_SALE_ATTACHMENTS_COUNT } from '../../api/sales';
import type { NormalizedAttachment } from '../../lib/normalizeAttachments';

export interface SaleAttachmentEditorProps {
  existing: NormalizedAttachment[];
  pendingFiles: File[];
  onPendingChange: (files: File[]) => void;
  onOpenExisting?: (items: NormalizedAttachment[], startIndex: number) => void;
  disabled?: boolean;
  maxTotal?: number;
  compact?: boolean;
}

export function SaleAttachmentEditor({
  existing,
  pendingFiles,
  onPendingChange,
  onOpenExisting,
  disabled = false,
  maxTotal = MAX_SALE_ATTACHMENTS_COUNT,
  compact = false,
}: SaleAttachmentEditorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const totalCount = existing.length + pendingFiles.length;
  const slotsLeft = Math.max(0, maxTotal - totalCount);
  const canAdd = !disabled && slotsLeft > 0;

  const handlePick = async (picked: File[]) => {
    if (!picked.length || !canAdd) return;
    setIsProcessing(true);
    setNotice(null);
    try {
      const { files: processed, skippedMessages, compressionMessages } =
        await prepareAttachmentFilesForUpload(picked, MAX_SALE_ATTACHMENT_BYTES);
      const noticeParts = [...skippedMessages, ...compressionMessages].filter(Boolean);
      if (noticeParts.length) setNotice(noticeParts.join(' · '));
      const room = maxTotal - existing.length;
      if (room <= 0) return;
      onPendingChange([...pendingFiles, ...processed].slice(0, room));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={compact ? 'space-y-2' : 'bg-[#1F2937] border border-[#374151] rounded-xl p-4'}>
      {!compact && (
        <label className="text-sm font-medium text-[#9CA3AF] mb-2 block">Attachments</label>
      )}
      {compact && (
        <label className="block text-xs text-[#9CA3AF] mb-1">Attachments</label>
      )}

      {existing.length > 0 && (
        <ul className="space-y-1 mb-2">
          {existing.map((a, idx) => (
            <li key={`${a.url}-${idx}`}>
              <button
                type="button"
                disabled={disabled || !onOpenExisting}
                onClick={() => onOpenExisting?.(existing, idx)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-[#60A5FA] hover:bg-[#374151] disabled:opacity-60"
              >
                <Paperclip className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF]" aria-hidden />
                <span className="min-w-0 truncate">{a.name || `Attachment ${idx + 1}`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pendingFiles.length > 0 && (
        <div className="space-y-1 mb-2">
          {pendingFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between text-xs text-[#D1D5DB] bg-[#111827] rounded px-2 py-1"
            >
              <span className="truncate">{file.name} (new)</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPendingChange(pendingFiles.filter((_, i) => i !== index))}
                className="text-[#EF4444] shrink-0 ml-2 disabled:opacity-50"
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {canAdd ? (
        <MediaSourcePicker
          accept="image/*,.pdf"
          multiple
          disabled={disabled || isProcessing}
          sheetTitle="Add attachment"
          onFiles={(picked) => void handlePick(picked)}
        >
          {(open) => (
            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={open}
              className="w-full border-2 border-dashed border-[#374151] rounded-lg p-3 flex items-center justify-center gap-2 text-[#9CA3AF] hover:bg-[#374151]/30 hover:border-[#3B82F6]/50 disabled:opacity-60 text-xs"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Compressing…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Camera or upload ({totalCount}/{maxTotal})
                </>
              )}
            </button>
          )}
        </MediaSourcePicker>
      ) : (
        <p className="text-xs text-[#6B7280]">Maximum {maxTotal} attachments reached.</p>
      )}

      {notice && <p className="mt-2 text-xs text-[#9CA3AF]">{notice}</p>}
    </div>
  );
}
