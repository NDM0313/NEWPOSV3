import { Camera, Image as ImageIcon, Upload, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface MediaSourceActionSheetProps {
  open: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  showCamera?: boolean;
  title?: string;
}

export function MediaSourceActionSheet({
  open,
  onClose,
  onCamera,
  onGallery,
  showCamera = true,
  title = 'Add attachment',
}: MediaSourceActionSheetProps) {
  if (!open) return null;

  const sheet = (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative bg-[#1F2937] border-t border-[#374151] rounded-t-2xl p-4 pb-8 safe-area-pb">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#374151]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          {showCamera && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCamera();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#111827] border border-[#374151] text-white hover:border-[#3B82F6] transition-colors"
            >
              <Camera className="w-5 h-5 text-[#3B82F6] shrink-0" />
              <span className="text-sm font-medium">Take photo</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              onGallery();
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#111827] border border-[#374151] text-white hover:border-[#3B82F6] transition-colors"
          >
            {showCamera ? (
              <ImageIcon className="w-5 h-5 text-[#10B981] shrink-0" />
            ) : (
              <Upload className="w-5 h-5 text-[#10B981] shrink-0" />
            )}
            <span className="text-sm font-medium">{showCamera ? 'Choose from gallery' : 'Upload file'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return sheet;
  return createPortal(sheet, document.body);
}
