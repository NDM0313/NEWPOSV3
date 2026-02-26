import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSignedUrlForAttachment } from '../../api/attachmentSignedUrl';

const SWIPE_THRESHOLD_PX = 80;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const PINCH_SCALE_SENSITIVITY = 0.01;

export interface AttachmentPreviewModalProps {
  /** List of attachments (one or more). Opens at initialIndex. */
  attachments: Array<{ url: string; name: string }>;
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

const isImageType = (name: string) => /\.(png|jpe?g|gif|webp)$/i.test(name);
const isPdfType = (name: string) => /\.pdf$/i.test(name);

function getDistance(touches: React.TouchList): number {
  if (touches.length < 2) return 0;
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

export function AttachmentPreviewModal({
  attachments,
  initialIndex = 0,
  isOpen,
  onClose,
}: AttachmentPreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [mounted, setMounted] = useState(false);
  const touchStartY = useRef(0);
  const pinchStartDistance = useRef(0);
  const pinchStartScale = useRef(1);
  const lastTap = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const list = attachments?.length ? attachments : [];
  const current = list[currentIndex] ?? null;
  const fileName = current?.name ?? '';
  const fileUrl = current?.url ?? '';
  const hasMultiple = list.length > 1;
  const typeImage = isImageType(fileName);
  const typePdf = isPdfType(fileName);
  const typeOther = !typeImage && !typePdf;

  useEffect(() => {
    setCurrentIndex(Math.min(initialIndex, Math.max(0, list.length - 1)));
  }, [initialIndex, list.length, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const t = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(t);
    }
    setMounted(false);
  }, [isOpen]);

  useEffect(() => {
    setImageScale(1);
  }, [currentIndex, fileUrl]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !typeImage) return;
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2) e.preventDefault();
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, [typeImage, signedUrl]);

  useEffect(() => {
    if (!isOpen || !fileUrl) {
      setSignedUrl(null);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    getSignedUrlForAttachment(fileUrl)
      .then((url) => {
        setSignedUrl(url);
        if (!url) setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isOpen, fileUrl, currentIndex]);

  if (!isOpen) return null;
  if (!current) return null;

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex((i) => Math.min(list.length - 1, i + 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    if (e.touches.length === 2) {
      pinchStartDistance.current = getDistance(e.touches);
      pinchStartScale.current = imageScale;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && typeImage) {
      e.preventDefault();
      const d = getDistance(e.touches);
      if (pinchStartDistance.current > 0) {
        const delta = (d - pinchStartDistance.current) * PINCH_SCALE_SENSITIVITY;
        setImageScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScale.current + delta)));
      }
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStartDistance.current = 0;
    }
    if (e.changedTouches.length === 1) {
      const endY = e.changedTouches[0].clientY;
      if (endY - touchStartY.current > SWIPE_THRESHOLD_PX) onClose();
    }
  };
  const handleImageTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setImageScale(1);
    }
    lastTap.current = now;
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col bg-black/95 backdrop-blur-md transition-all duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Attachment preview"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar: Close + Download */}
      <div className="flex items-center justify-between p-3 safe-area-inset-top bg-black/50 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="text-sm text-white/80 truncate max-w-[40%]">{fileName}</span>
        {signedUrl ? (
          <a
            href={signedUrl}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label="Download"
          >
            <Download className="w-6 h-6" />
          </a>
        ) : (
          <span className="w-10 h-10" />
        )}
      </div>

      {/* Prev/Next when multiple */}
      {hasMultiple && (
        <div className="absolute inset-y-0 left-0 flex items-center pl-2 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Previous"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
      {hasMultiple && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={goNext}
              disabled={currentIndex === list.length - 1}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 overflow-hidden">
        {loading && (
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 className="w-10 h-10 animate-spin" />
            <span className="text-sm text-white/80">Loading…</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-white text-center max-w-sm">
            <FileText className="w-12 h-12 text-white/50" />
            <p className="text-sm">Could not load preview</p>
            <p className="text-xs text-white/70 truncate w-full">{fileName}</p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#3B82F6] underline"
            >
              Open in new tab
            </a>
          </div>
        )}

        {!loading && !error && signedUrl && typeImage && (
          <div className="w-full flex-1 min-h-0 overflow-auto flex items-center justify-center p-2 bg-black/50">
            <img
              src={signedUrl}
              alt={fileName}
              className="max-w-full min-w-0 w-auto h-auto object-contain select-none transition-transform duration-100"
              style={{ transform: `scale(${imageScale})`, transformOrigin: 'center center' }}
              draggable={false}
              onClick={handleImageTap}
            />
          </div>
        )}

        {!loading && !error && signedUrl && typePdf && (
          <iframe
            src={signedUrl}
            title={fileName}
            className="w-full flex-1 min-h-[70vh] rounded-lg bg-[#1F2937] border-0 overflow-auto"
          />
        )}

        {!loading && !error && signedUrl && typeOther && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-20 h-20 rounded-2xl bg-[#374151] flex items-center justify-center">
              <FileText className="w-10 h-10 text-[#9CA3AF]" />
            </div>
            <p className="text-white font-medium text-center truncate max-w-[280px]">{fileName}</p>
            <a
              href={signedUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B82F6] text-white font-medium"
            >
              <Download className="w-5 h-5" />
              Download
            </a>
          </div>
        )}
      </div>

      {hasMultiple && (
        <div className="flex justify-center gap-1.5 py-2 bg-black/40 shrink-0">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/40'}`}
              aria-label={`Go to attachment ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
