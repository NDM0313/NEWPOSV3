import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Share2, Printer, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { downloadPDF, printPDF, sharePdfWithWhatsAppFallback } from '../../utils/pdfGenerator';
import type { ReportPrintOrientation } from '../../lib/reportPrintConfig';

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  filename: string;
  children: ReactNode;
  whatsAppFallbackText?: string;
  sharePhone?: string | null;
  /** Use compact sheet height for short documents (invoices) — avoids blank extra PDF page. */
  compact?: boolean;
  orientation?: ReportPrintOrientation;
  /** True while brand/settings are loading before preview opens. */
  preparing?: boolean;
}

export function PdfPreviewModal({
  open,
  onClose,
  title,
  filename,
  children,
  whatsAppFallbackText,
  sharePhone,
  compact = false,
  orientation = 'portrait',
  preparing = false,
}: PdfPreviewModalProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<false | 'share' | 'download' | 'print'>(false);
  const [toast, setToast] = useState<string | null>(null);
  const actionLockRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const captureToPdfBlob = useCallback(async (): Promise<Blob> => {
    const el = contentRef.current;
    if (!el) throw new Error('Preview element missing');
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
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    if (!imgData.startsWith('data:image/jpeg;base64,')) {
      throw new Error('Could not encode preview as JPEG — try again.');
    }
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    const targetW = pageW;
    const targetH = targetW / ratio;
    if (targetH <= pageH) {
      pdf.addImage(imgData, 'JPEG', 0, 0, targetW, targetH);
    } else {
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
  }, [orientation]);

  const runAction = useCallback(
    async (kind: 'share' | 'download' | 'print') => {
      if (preparing || busy || actionLockRef.current) return;
      actionLockRef.current = true;
      setBusy(kind);
      setToast(null);
      try {
        const blob = await captureToPdfBlob();
        if (kind === 'share') {
          const result = await sharePdfWithWhatsAppFallback(blob, filename, title, {
            sharePhone,
            whatsAppText: whatsAppFallbackText ?? title,
          });
          if (result === 'failed') setToast('Could not share PDF — try Download');
        } else if (kind === 'download') {
          const ok = await downloadPDF(blob, filename);
          if (!ok) setToast('Could not save PDF — try again');
        } else {
          const ok = await printPDF(blob, filename);
          if (!ok) setToast('Could not open print — try Share instead');
        }
      } catch (err) {
        console.error(`[PdfPreview] ${kind} failed`, err);
        setToast(
          kind === 'share'
            ? 'Could not share PDF — try again'
            : kind === 'download'
              ? 'Could not save PDF — try again'
              : 'Could not open print — try Share instead',
        );
      } finally {
        setBusy(false);
        setTimeout(() => {
          actionLockRef.current = false;
        }, 300);
      }
    },
    [busy, captureToPdfBlob, filename, preparing, sharePhone, title, whatsAppFallbackText],
  );

  if (!open) return null;

  const isBlocked = preparing || !!busy;

  const documentClass = [
    'pdf-document',
    compact ? 'pdf-document-compact' : '',
    orientation === 'landscape' ? 'pdf-document-landscape' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col">
      <div className="bg-[#1F2937] text-[#F9FAFB] px-4 py-3 flex items-center justify-between border-b border-[#374151] no-print">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-xs text-[#9CA3AF] truncate">
            {preparing ? 'Preparing report…' : `Preview · A4 ${orientation}`}
          </p>
        </div>
        <button
          onClick={onClose}
          disabled={!!busy}
          className="p-2 hover:bg-[#374151] rounded-lg text-[#F9FAFB] disabled:opacity-60"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-[#374151] p-3 sm:p-6 no-print relative">
        {preparing ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#374151]/90">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
            <p className="text-sm text-white font-medium">Preparing report…</p>
          </div>
        ) : null}
        <div className="mx-auto pdf-print-root" style={{ width: 'fit-content' }}>
          <div
            ref={contentRef}
            className={`${documentClass} shadow-2xl`}
            style={{ transform: 'scale(var(--preview-scale, 1))', transformOrigin: 'top center' }}
          >
            {children}
          </div>
        </div>
      </div>

      <div className="bg-[#1F2937] border-t border-[#374151] p-3 grid grid-cols-3 gap-2 no-print pb-[calc(0.75rem+env(safe-area-inset-bottom,0))]">
        <button
          onClick={() => void runAction('share')}
          disabled={isBlocked}
          className="h-11 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          Share
        </button>
        <button
          onClick={() => void runAction('download')}
          disabled={isBlocked}
          className="h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          PDF
        </button>
        <button
          onClick={() => void runAction('print')}
          disabled={isBlocked}
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
    document.body,
  );
}
