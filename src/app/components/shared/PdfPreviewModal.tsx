'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Share2, Printer, Loader2, Mail } from 'lucide-react';
import { exportElementToPdfBlob, suggestedPdfFilename, type DocumentType } from '@/app/services/pdfExportService';
import { documentShareService } from '@/app/services/documentShareService';

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
  /** Optional WhatsApp destination (customer/supplier phone). */
  sharePhone?: string | null;
  /**
   * Printable content. Either provide `children` (preferred: same component is rendered)
   * OR `cloneFromRef` — a ref to a DOM node whose innerHTML we deep-clone into the modal.
   */
  children?: React.ReactNode;
  /** Alternative to `children`: clone an already-rendered element (e.g. an invoice view). */
  cloneFromRef?: React.RefObject<HTMLElement | null>;
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
  sharePhone,
  children,
  cloneFromRef,
}) => {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<false | 'download' | 'share' | 'print'>(false);

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
    // Remove control widgets that should never appear in the preview/PDF.
    clone.querySelectorAll('.no-print').forEach((n) => n.remove());
    clone.querySelectorAll('button').forEach((n) => n.remove());
    dst.appendChild(clone);
  }, [open, cloneFromRef]);

  if (!open) return null;

  const filenameBase = documentType ? suggestedPdfFilename(documentType, reference) : title.replace(/\s+/g, '_');

  const handleDownload = async () => {
    if (!contentRef.current || busy) return;
    setBusy('download');
    try {
      const blob = await exportElementToPdfBlob(contentRef.current, { format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
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
    window.print();
  };

  const node = (
    <div className="fixed inset-0 z-[120] bg-black/70 flex flex-col">
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-700 no-print">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-xs text-slate-400 truncate">Preview · {format === 'a4' ? 'A4' : 'Thermal'}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-800 rounded-lg"
          aria-label="Close preview"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-700 p-4 sm:p-8">
        <div className="mx-auto pdf-print-root" style={{ width: 'fit-content' }}>
          <div ref={contentRef} className="pdf-document shadow-2xl">
            {cloneFromRef ? null : children}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border-t border-slate-700 p-3 flex flex-wrap gap-2 justify-center no-print">
        <button
          onClick={handleShareWhatsApp}
          disabled={!!busy}
          className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2 disabled:opacity-60"
          type="button"
        >
          {busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          WhatsApp
        </button>
        <button
          onClick={handleShareEmail}
          disabled={!!busy}
          className="h-10 px-4 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-medium flex items-center gap-2 disabled:opacity-60"
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
          className="h-10 px-4 rounded-lg bg-slate-500 hover:bg-slate-600 text-white font-medium flex items-center gap-2 disabled:opacity-60"
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
