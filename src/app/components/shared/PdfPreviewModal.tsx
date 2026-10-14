'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Share2, Printer, Loader2, Mail } from 'lucide-react';
import {
  exportElementToPdfBlob,
  resolvePrintableElement,
  suggestedPdfFilename,
  type DocumentType,
} from '@/app/services/pdfExportService';
import { documentShareService } from '@/app/services/documentShareService';
import { toast } from 'sonner';
import { useThermalPrint } from '@/app/hooks/useThermalPrint';
import { getThermalDimensions } from '@/app/constants/thermalPrintDimensions';
import type { ThermalPaperSize } from '@/app/constants/thermalPrintDimensions';

export type PdfPreviewOrientation = 'portrait' | 'landscape';

export interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Document type used to name downloads and form share links. */
  documentType?: DocumentType;
  /** Optional document reference (e.g. INV-001). */
  reference?: string;
  /** A4 or thermal PDF format. */
  format?: 'a4' | 'thermal';
  /** A4 page orientation for print and PDF download. */
  orientation?: PdfPreviewOrientation;
  /** When set, shows Portrait/Landscape selector in the toolbar. */
  showOrientationToggle?: boolean;
  onOrientationChange?: (orientation: PdfPreviewOrientation) => void;
  /** Optional WhatsApp destination (customer/supplier phone). */
  sharePhone?: string | null;
  /**
   * Printable content. Either provide `children` (preferred: same component is rendered)
   * OR `cloneFromRef` — a ref to a DOM node whose innerHTML we deep-clone into the modal.
   */
  children?: React.ReactNode;
  /** Alternative to `children`: clone an already-rendered element (e.g. an invoice view). */
  cloneFromRef?: React.RefObject<HTMLElement | null>;
  /** When set, PDF capture fits content on one A4 page (compact tabular reports). */
  fitSinglePage?: boolean;
  /** Stamp page numbers on PDF pages (default true; false for thermal). */
  pageNumbers?: boolean;
  /** Roll width when format is thermal. */
  thermalPaperSize?: ThermalPaperSize;
}

/**
 * Universal PDF/Print preview modal for the web ERP.
 * The same DOM tree is shown to the user and captured into PDF — WYSIWYG.
 * Footer exposes Share / Download / Print actions with WhatsApp & email options.
 */
export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  open,
  onClose,
  title,
  documentType,
  reference,
  format = 'a4',
  orientation = 'portrait',
  showOrientationToggle = false,
  onOrientationChange,
  sharePhone,
  children,
  cloneFromRef,
  fitSinglePage = false,
  pageNumbers = true,
  thermalPaperSize = '58mm',
}) => {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<false | 'download' | 'share' | 'print'>(false);
  const { printThermal } = useThermalPrint();
  const thermalDims = format === 'thermal' ? getThermalDimensions(thermalPaperSize) : null;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // When using `cloneFromRef`, copy the source DOM into our contentRef on open.
  useLayoutEffect(() => {
    if (!open || !cloneFromRef?.current || !contentRef.current) return;
    const src = cloneFromRef.current;
    const dst = contentRef.current;
    dst.innerHTML = '';
    const clone = src.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print').forEach((n) => n.remove());
    clone.querySelectorAll('button').forEach((n) => n.remove());
    dst.appendChild(clone);
  }, [open, cloneFromRef]);

  if (!open) return null;

  const filenameBase = documentType ? suggestedPdfFilename(documentType, reference) : title.replace(/\s+/g, '_');
  const orientationClass = orientation === 'landscape' ? 'pdf-print-orientation-landscape' : 'pdf-print-orientation-portrait';

  const getPrintableElement = (): HTMLElement | null => {
    if (!contentRef.current) return null;
    return resolvePrintableElement(contentRef.current);
  };

  const handleDownload = async () => {
    const printable = getPrintableElement();
    if (!printable || busy) return;
    setBusy('download');
    try {
      const blob = await exportElementToPdfBlob(printable, {
        format,
        fitSinglePage: format === 'thermal' ? true : fitSinglePage,
        orientation: format === 'a4' ? orientation : 'portrait',
        pageNumbers: format === 'thermal' ? false : pageNumbers,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PDF download failed';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleShareWhatsApp = () => {
    documentShareService.shareViaWhatsApp(
      documentShareService.buildShareMessage({
        documentType: documentType ?? 'ledger',
        reference,
        title: reference ? `${title} ${reference}` : title,
      }),
      sharePhone ?? undefined,
    );
  };

  const handleShareEmail = () => {
    documentShareService.shareViaEmail(
      reference ? `${title} ${reference}` : title,
      documentShareService.buildShareMessage({
        documentType: documentType ?? 'ledger',
        reference,
        title,
      }),
    );
  };

  const handlePrint = () => {
    if (busy) return;
    if (format === 'thermal') {
      printThermal(thermalPaperSize);
      return;
    }
    window.print();
  };

  const node = (
    <div className={`fixed inset-0 z-[120] bg-black/70 flex flex-col ${orientationClass}`}>
      {format === 'a4' ? (
        <style>{`
          @media print {
            @page {
              size: A4 ${orientation};
              margin: 10mm;
            }
          }
        `}</style>
      ) : (
        <style>{`
          @media print {
            @page {
              size: ${thermalPaperSize} auto;
              margin: ${thermalDims?.printMarginMm ?? 1}mm;
            }
          }
        `}</style>
      )}

      <div className="bg-slate-900 text-foreground px-4 py-3 flex items-center justify-between border-b border-slate-700 no-print gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-xs text-slate-400 truncate">
            Preview · {format === 'a4' ? 'A4' : 'Thermal'}
            {format === 'a4' ? ` · ${orientation === 'landscape' ? 'Landscape' : 'Portrait'}` : ''}
          </p>
        </div>
        {showOrientationToggle && format === 'a4' ? (
          <select
            value={orientation}
            onChange={(e) => onOrientationChange?.(e.target.value as PdfPreviewOrientation)}
            className="h-8 px-2 rounded bg-slate-800 border border-slate-600 text-foreground text-sm shrink-0"
            aria-label="Page orientation"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        ) : null}
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-800 rounded-lg shrink-0"
          aria-label="Close preview"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-700 p-4 sm:p-8">
        <div
          className={`mx-auto pdf-print-root ${orientationClass}`}
          style={{
            width: 'fit-content',
            maxWidth: format === 'thermal' ? thermalDims?.modalMaxPx : undefined,
          }}
        >
          <div ref={contentRef}>{cloneFromRef ? null : children}</div>
        </div>
      </div>

      <div className="bg-slate-900 border-t border-slate-700 p-3 flex flex-wrap gap-2 justify-center no-print">
        <button
          onClick={handleShareWhatsApp}
          disabled={!!busy}
          className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-foreground font-medium flex items-center gap-2 disabled:opacity-60"
          type="button"
        >
          {busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          WhatsApp
        </button>
        <button
          onClick={handleShareEmail}
          disabled={!!busy}
          className="h-10 px-4 rounded-lg bg-slate-600 hover:bg-slate-700 text-foreground font-medium flex items-center gap-2 disabled:opacity-60"
          type="button"
        >
          <Mail className="w-4 h-4" />
          Email
        </button>
        <button
          onClick={handleDownload}
          disabled={!!busy}
          className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 disabled:opacity-60"
          type="button"
        >
          {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download PDF
        </button>
        <button
          onClick={handlePrint}
          disabled={!!busy}
          className="h-10 px-4 rounded-lg bg-slate-500 hover:bg-slate-600 text-foreground font-medium flex items-center gap-2 disabled:opacity-60"
          type="button"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>
    </div>
  );

  return createPortal(node, document.body);
};

export default PdfPreviewModal;
