import { useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { MAX_FILE_SIZE_BYTES, ACCEPT_TYPES } from '../../api/paymentAttachments';
import { prepareAttachmentFilesForUpload } from '../../utils/imageCompression';
import { MediaSourcePicker } from './MediaSourcePicker';

export interface AttachmentFilePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  onError?: (message: string) => void;
  onInfo?: (message: string) => void;
  label?: string;
  description?: string;
  /** When 1, picker replaces the selection and disallows multi-select. */
  maxFiles?: number;
}

export function AttachmentFilePicker({
  files,
  onChange,
  onError,
  onInfo,
  label = 'Attachments (Optional)',
  description = 'PDF, PNG, JPG up to 10MB',
  maxFiles,
}: AttachmentFilePickerProps) {
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const singleFile = maxFiles === 1;

  const processFiles = async (picked: File[]) => {
    if (!picked.length) return;
    setIsProcessingFiles(true);
    try {
      const toProcess = singleFile ? picked.slice(0, 1) : picked;
      const { files: processed, compressionMessages, skippedMessages } =
        await prepareAttachmentFilesForUpload(toProcess, MAX_FILE_SIZE_BYTES);
      skippedMessages.forEach((msg) => onError?.(msg));
      compressionMessages.forEach((msg) => onInfo?.(msg));
      if (processed.length > 0) {
        onChange(singleFile ? processed : [...files, ...processed]);
      }
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const removeAttachment = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-[#9CA3AF] mb-1">{label}</label>
      <MediaSourcePicker
        accept={ACCEPT_TYPES}
        multiple={!singleFile}
        disabled={isProcessingFiles}
        onFiles={(picked) => void processFiles(picked)}
        onError={onError}
        sheetTitle="Add attachment"
      >
        {(open) => (
          <button
            type="button"
            disabled={isProcessingFiles}
            onClick={open}
            className="w-full border border-dashed border-[#374151] rounded-lg p-4 text-center text-[#6B7280] text-sm hover:border-[#4B5563] hover:bg-[#374151]/30 transition-colors flex flex-col items-center gap-2 disabled:opacity-60"
          >
            {isProcessingFiles ? (
              <>
                <Loader2 className="w-5 h-5 text-[#9CA3AF] animate-spin" />
                <span>Compressing…</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-[#9CA3AF]" />
                <span>Camera or upload</span>
                <span className="text-xs">{description}</span>
              </>
            )}
          </button>
        )}
      </MediaSourcePicker>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="flex items-center gap-2 py-1.5 px-2 rounded bg-[#111827] border border-[#374151] text-sm text-white"
            >
              <FileText className="w-4 h-4 shrink-0 text-[#9CA3AF]" />
              <span className="truncate flex-1 min-w-0">{file.name}</span>
              <span className="text-xs text-[#6B7280] shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="p-1 rounded text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#374151]"
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
