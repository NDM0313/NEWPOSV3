import { useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { MAX_FILE_SIZE_BYTES, ACCEPT_TYPES } from '../../api/paymentAttachments';

export interface AttachmentFilePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  onError?: (message: string) => void;
  label?: string;
  description?: string;
}

export function AttachmentFilePicker({
  files,
  onChange,
  onError,
  label = 'Attachments (Optional)',
  description = 'PDF, PNG, JPG up to 10MB',
}: AttachmentFilePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    const next: File[] = [];
    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      if (f.size <= MAX_FILE_SIZE_BYTES) next.push(f);
      else onError?.(`${f.name} exceeds 10MB. Skipped.`);
    }
    onChange([...files, ...next]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-[#9CA3AF] mb-1">{label}</label>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_TYPES}
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full border border-dashed border-[#374151] rounded-lg p-4 text-center text-[#6B7280] text-sm hover:border-[#4B5563] hover:bg-[#374151]/30 transition-colors flex flex-col items-center gap-2"
      >
        <Upload className="w-5 h-5 text-[#9CA3AF]" />
        <span>Click to upload or drag and drop</span>
        <span className="text-xs">{description}</span>
      </button>
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
