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
  const [loadError, setLoadError] = useState(false);
  const isImage = isImageFileName(att.name);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    setOpenUrl(null);
    getAttachmentOpenUrl(att.url).then((url) => {
      if (!cancelled) setOpenUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [att.url]);

  const handleOpenInNewTab = () => {
    if (openUrl) window.open(openUrl, '_blank');
    else getAttachmentOpenUrl(att.url).then((url) => window.open(url, '_blank'));
  };

  return (
    <>
      <div className="rounded-lg bg-muted/50 border border-border overflow-hidden">
        <div className="p-4 flex flex-col gap-4">
          <p className="text-base font-medium text-foreground break-all" title={att.name}>
            {att.name}
          </p>
          {isImage && openUrl && !loadError && (
            <div
              className="w-full flex justify-center items-center rounded-lg overflow-hidden bg-card border border-border min-h-[220px] max-h-[50vh] cursor-zoom-in"
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
                onError={() => setLoadError(true)}
              />
            </div>
          )}
          {isImage && loadError && (
            <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              Preview nahi khuli — yeh file server pe empty / missing hai (purani UltimatePOS copy incomplete).
            </div>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="border-gray-600 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={handleOpenInNewTab}
            >
              Open in new tab
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-[95vw] max-h-[95vh] w-auto h-auto p-4 flex flex-col items-center gap-3">
          <DialogTitle className="text-foreground text-center text-base font-medium sr-only">{att.name}</DialogTitle>
          <p className="text-sm text-muted-foreground truncate max-w-full text-center" title={att.name}>
            {att.name}
          </p>
          {openUrl && !loadError && (
            <div className="flex justify-center items-center min-w-0 min-h-0 max-h-[80vh] w-full">
              <img
                src={openUrl}
                alt={att.name}
                className="max-w-full max-h-[80vh] w-auto h-auto object-contain"
                onError={() => setLoadError(true)}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-muted-foreground hover:bg-muted"
              onClick={() => setZoomOpen(false)}
            >
              Close
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 text-muted-foreground hover:bg-muted"
              onClick={() => {
                handleOpenInNewTab();
                setZoomOpen(false);
              }}
            >
              Open in new tab
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
