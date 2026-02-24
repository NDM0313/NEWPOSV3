import React from 'react';
import { Paperclip } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { AttachmentPreviewRow } from '@/app/components/shared/AttachmentPreviewRow';

interface AttachmentViewerProps {
  attachments: { url: string; name: string }[];
  isOpen: boolean;
  onClose: () => void;
}

/** Same design as Payment History attachments: size, preview, click to zoom, Open in new tab */
export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({
  attachments,
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white w-full max-w-2xl min-h-[320px] max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Paperclip size={20} className="text-amber-400" />
            Attachments
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
          {attachments.map((att, idx) => (
            <AttachmentPreviewRow key={idx} att={att} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
