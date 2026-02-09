import React, { useState } from 'react';
import { X, Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { getAttachmentOpenUrl } from '@/app/utils/paymentAttachmentUrl';
import { toast } from 'sonner';
import { cn } from '@/app/components/ui/utils';

interface AttachmentViewerProps {
  attachments: { url: string; name: string }[];
  isOpen: boolean;
  onClose: () => void;
}

export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({
  attachments,
  isOpen,
  onClose,
}) => {
  const [selectedAttachment, setSelectedAttachment] = useState<{ url: string; name: string; resolvedUrl?: string } | null>(null);
  const [loadingAttachment, setLoadingAttachment] = useState(false);

  const handleAttachmentClick = async (att: { url: string; name: string }) => {
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.name || '');
    
    if (isImage) {
      setLoadingAttachment(true);
      setSelectedAttachment(att);
      try {
        const resolvedUrl = await getAttachmentOpenUrl(att.url);
        setSelectedAttachment({ ...att, resolvedUrl });
      } catch (error: any) {
        toast.error('Failed to load image');
        setSelectedAttachment(null);
      } finally {
        setLoadingAttachment(false);
      }
    }
  };

  return (
    <>
      {/* Attachments List Dialog */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white w-[90vw] max-w-md sm:max-w-lg md:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Paperclip size={20} className="text-amber-400" />
              Attachments
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] sm:max-h-[50vh] md:max-h-96 overflow-y-auto">
            {attachments.map((att, idx) => {
              const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.name || '');
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-gray-800/50 border border-gray-700",
                    isImage && "cursor-pointer hover:bg-gray-800 transition-colors"
                  )}
                  onClick={() => handleAttachmentClick(att)}
                >
                  <span className="text-xs sm:text-sm text-gray-200 truncate flex-1 min-w-0" title={att.name}>{att.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-xs sm:text-sm px-2 sm:px-3"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const openUrl = await getAttachmentOpenUrl(att.url);
                      window.open(openUrl, '_blank');
                    }}
                  >
                    {isImage ? 'View' : 'Open'}
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Modal - Consistent size across system */}
      {selectedAttachment && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedAttachment(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setSelectedAttachment(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-gray-900/80 rounded-full p-2 transition-colors"
              title="Close"
            >
              <X size={24} />
            </button>
            {selectedAttachment.name && (
              <div className="absolute top-4 left-4 right-16 z-10 bg-gray-900/80 rounded-lg px-3 py-2">
                <p className="text-sm text-white truncate">{selectedAttachment.name}</p>
              </div>
            )}
            <div className="w-full h-full flex items-center justify-center p-4">
              {loadingAttachment || !selectedAttachment.resolvedUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-blue-400" size={32} />
                  <p className="text-gray-400 text-sm">Loading image...</p>
                </div>
              ) : (
                <img 
                  src={selectedAttachment.resolvedUrl} 
                  alt={selectedAttachment.name || 'Attachment'} 
                  className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                  onError={() => {
                    toast.error('Failed to load image');
                    setSelectedAttachment(null);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
