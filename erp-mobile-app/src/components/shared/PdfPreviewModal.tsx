import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Share2, Printer, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { downloadPDF, sharePDF, printPDF } from '../../utils/pdfGenerator';

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  filename: string;
  /** Rendered into an A4-sized white container. Use plain HTML/inline styles; tailwind dark classes are fine but printed output is B&W. */
  children: ReactNode;
  /** Optional WhatsApp deeplink text used as fallback when navigator.share is unavailable. */
  whatsAppFallbackText?: string;
}

/**
 * Universal PDF/Print preview modal (mobile).
 * User sees the branded, final-looking document. Footer buttons: Share / Download / Print.
 * The on-screen preview and captured PDF are the same DOM, so WYSIWYG.
 */
export function PdfPreviewModal({
  open,
  onClose,
  title,
  filename,
  children,
  whatsAppFallbackText,
}: PdfPreviewModalProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<false | 'share' | 'download' | 'print'>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const captureToPdfBlob = async (): Promise<Blob> => {
    const el = contentRef.current;
    if (!el) throw new Error('Preview element missing');
    // useCORS:true + allowTaint:false: any image without CORS headers fails fast instead of
    // silently corrupting the canvas (which is what produced "wrong PNG signature" in jsPDF).
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 15000,
      backgroundColor: '#ffffff',
      logging: false,
    });
    if (!canvas.width || !canvas.height) {
      throw new Error('Captured canvas is empty — check that all images loaded.');
    }
    // JPEG avoids jsPDF's PNG decode path entirely; smaller PDF, immune to "wrong PNG signature".
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    if (!imgData.startsWith('data:image/jpeg;base64,')) {
      throw new Error('Could not encode preview as JPEG — try again.');
    }
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    const targetW = pageW;
    const targetH = targetW / ratio;
    if (targetH <= pageH) {
      pdf.addImage(imgData, 'JPEG', 0, 0, targetW, targetH);
    } else {
      // Multi-page slice
      const pxPerMm = canvas.width / pageW;
      const pageHeightPx = pageH * pxPerMm;
      let offsetY = 0;
      let pageIndex = 0;
      while (offsetY < canvas.height) {
        const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
        if (sliceHeight <= 0) break;
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeight;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
        if (!sliceData.startsWith('data:image/jpeg;base64,')) {
          offsetY += sliceHeight;
          pageIndex += 1;
          continue;
        }
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(sliceData, 'JPEG', 0, 0, pageW, sliceHeight / pxPerMm);
        offsetY += sliceHeight;
        pageIndex += 1;
      }
    }
    return pdf.output('blob');
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy('share');
    setToast(null);
    try {
      const blob = await captureToPdfBlob();
      const ok = await sharePDF(blob, filename, title);
      if (!ok && whatsAppFallbackText) {
        window.open(`https://wa.me/?text=${encodeURIComponent(whatsAppFallbackText)}`, '_blank', 'noopener,noreferrer');
      }
      if (!ok && !whatsAppFallbackText) {
        setToast('Could not share PDF — try again');
      }
    } catch (err) {
      console.error('[PdfPreview] share failed', err);
      setToast('Could not share PDF — try again');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy('download');
    setToast(null);
    try {
      const blob = await captureToPdfBlob();
      const ok = await downloadPDF(blob, filename);
      if (!ok) setToast('Could not save PDF — try again');
    } catch (err) {
      console.error('[PdfPreview] download failed', err);
      setToast('Could not save PDF — try again');
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async () => {
    if (busy) return;
    setBusy('print');
    setToast(null);
    try {
      const blob = await captureToPdfBlob();
      const ok = await printPDF(blob, filename);
      if (!ok) setToast('Could not open print — try Share instead');
    } catch (err) {
      console.error('[PdfPreview] print failed', err);
      setToast('Could not open print — try Share instead');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col">
      <div className="bg-[#1F2937] text-[#F9FAFB] px-4 py-3 flex items-center justify-between border-b border-[#374151] no-print">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-xs text-[#9CA3AF] truncate">Preview · A4</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#374151] rounded-lg text-[#F9FAFB]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-[#374151] p-3 sm:p-6">
        <div className="mx-auto pdf-print-root" style={{ width: 'fit-content' }}>
          <div
            ref={contentRef}
            className="pdf-document shadow-2xl"
            style={{ transform: 'scale(var(--preview-scale, 1))', transformOrigin: 'top center' }}
          >
            {children}
          </div>
        </div>
      </div>

      <div className="bg-[#1F2937] border-t border-[#374151] p-3 grid grid-cols-3 gap-2 no-print pb-[calc(0.75rem+env(safe-area-inset-bottom,0))]">
        <button
          onClick={handleShare}
          disabled={!!busy}
          className="h-11 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          Share
        </button>
        <button
          onClick={handleDownload}
          disabled={!!busy}
          className="h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          PDF
        </button>
        <button
          onClick={() => void handlePrint()}
          disabled={!!busy}
          className="h-11 rounded-lg bg-[#6B7280] hover:bg-[#4B5563] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Print
        </button>
      </div>
      {toast ? (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[101] px-4 py-2 rounded-lg bg-[#EF4444] text-white text-sm shadow-lg no-print">
          {toast}
        </div>
      ) : null}
    </div>,
    document.body
  );
}
