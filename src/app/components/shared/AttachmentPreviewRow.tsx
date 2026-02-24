import React, { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { getAttachmentOpenUrl } from '@/app/utils/paymentAttachmentUrl';

const isImageFileName = (name: string) => /\.(jpe?g|png|gif|webp|bmp)$/i.test((name || '').trim());

/** Single attachment row: name + image preview (click to zoom) + Open in new tab. Same in Payment History and Sale Details. */
export const AttachmentPreviewRow: React.FC<{ att: { url: string; name: string } }> = ({ att }) => {
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const isImage = isImageFileName(att.name);

  useEffect(() => {
    let cancelled = false;
    getAttachmentOpenUrl(att.url).then((url) => {
      if (!cancelled) setOpenUrl(url);
    });
    return () => { cancelled = true; };
  }, [att.url]);

  const handleOpenInNewTab = () => {
    if (openUrl) window.open(openUrl, '_blank');
    else getAttachmentOpenUrl(att.url).then((url) => window.open(url, '_blank'));
  };

  return (
    <>
      <div className="rounded-lg bg-gray-800/50 border border-gray-700 overflow-hidden">
        <div className="p-4 flex flex-col gap-4">
          <p className="text-base font-medium text-white break-all" title={att.name}>{att.name}</p>
          {isImage && openUrl && (
            <div
              className="w-full flex justify-center items-center rounded-lg overflow-hidden bg-gray-900 border border-gray-700 min-h-[220px] max-h-[50vh] cursor-zoom-in"
              role="button"
              tabIndex={0}
              onClick={() => setZoomOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && setZoomOpen(true)}
              title="Click to view full size"
            >
              <img
                src={openUrl}
                alt={att.name}
                className="max-w-full max-h-[50vh] w-auto h-auto object-contain pointer-events-none select-none"
                draggable={false}
              />
            </div>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
              onClick={handleOpenInNewTab}
            >
              Open in new tab
            </Button>
          </div>
        </div>
      </div>

      {/* Full-size zoom dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-[95vw] max-h-[95vh] w-auto h-auto p-4 flex flex-col items-center gap-3">
          <DialogTitle className="text-white text-center text-base font-medium sr-only">{att.name}</DialogTitle>
          <p className="text-sm text-gray-400 truncate max-w-full text-center" title={att.name}>{att.name}</p>
          {openUrl && (
            <div className="flex justify-center items-center min-w-0 min-h-0 max-h-[80vh] w-full">
              <img
                src={openUrl}
                alt={att.name}
                className="max-w-full max-h-[80vh] w-auto h-auto object-contain"
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              onClick={() => setZoomOpen(false)}
            >
              Close
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              onClick={() => { handleOpenInNewTab(); setZoomOpen(false); }}
            >
              Open in new tab
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
