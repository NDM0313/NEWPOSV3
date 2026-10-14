/**
 * PDF Export: convert document HTML (from unified document engine) to PDF.
 * Uses html2canvas + jspdf (client-side). Supports: Sales Invoice, Purchase Invoice,
 * Quotation, Proforma, Ledger, Receipt, Packing List.
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  getThermalDimensions,
  thermalPaperSizeFromAttr,
} from '@/app/constants/thermalPrintDimensions';

export type DocumentType =
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'quotation'
  | 'proforma'
  | 'ledger'
  | 'receipt'
  | 'packing_list'
  | 'courier_slip';

export interface PdfExportOptions {
  filename?: string;
  /** Paper size: 'a4' | 'thermal' (58mm/80mm roll). Default a4. */
  format?: 'a4' | 'thermal';
  /** A4 page orientation (ignored for thermal). */
  orientation?: 'portrait' | 'landscape';
  scale?: number;
  /** When true, scale content to fit a single A4 page (default for compact reports). */
  fitSinglePage?: boolean;
  /** Stamp "Page N of M" on each A4 PDF page (default true). Set false when report footer is disabled. */
  pageNumbers?: boolean;
}

/** CSS selector for the actual printable sheet inside a preview wrapper. */
export const PRINT_SHEET_SELECTOR = '.pdf-document, .classic-print-base, .thermal-receipt-root, [data-print-sheet]';

/**
 * Resolve the inner printable element (e.g. `.pdf-document`) from a modal wrapper.
 */
export function resolvePrintableElement(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  if (root.matches(PRINT_SHEET_SELECTOR)) return root;
  const found = root.querySelector(PRINT_SHEET_SELECTOR);
  return (found as HTMLElement | null) ?? root;
}

/**
 * Capture an HTML element and return a PDF blob.
 * Call with the root element that wraps the printable content (e.g. the template div).
 */
export async function exportElementToPdfBlob(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<Blob> {
  const {
    scale = 2,
    format = 'a4',
    fitSinglePage = false,
    orientation = 'portrait',
    pageNumbers = true,
  } = options;
  const target = resolvePrintableElement(element) ?? element;

  const excludedEls = target.querySelectorAll('[data-exclude-from-pdf-capture]');
  excludedEls.forEach((el) => {
    (el as HTMLElement).style.visibility = 'hidden';
  });

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(target, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
  } finally {
    excludedEls.forEach((el) => {
      (el as HTMLElement).style.visibility = '';
    });
  }

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error('PDF capture failed: printable content has zero size. Try refreshing the preview.');
  }

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const isThermal = format === 'thermal';
  const thermalDims = isThermal
    ? getThermalDimensions(
        thermalPaperSizeFromAttr(
          target.dataset.thermalWidth ?? target.getAttribute('data-thermal-width'),
        ),
      )
    : null;
  const pdf = new jsPDF({
    orientation: isThermal ? 'portrait' : orientation,
    unit: 'mm',
    format: isThermal ? [thermalDims!.widthMm, 297] : 'a4',
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = isThermal ? thermalDims!.printMarginMm : 8;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  const pxToMm = usableW / canvas.width;
  const imgHmm = canvas.height * pxToMm;

  const stampPage = (pdf: jsPDF, pageNum: number, totalPages: number) => {
    if (!pageNumbers || isThermal) return;
    pdf.setFontSize(8);
    pdf.setTextColor(85, 85, 85);
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageW / 2, pageH - margin / 2, { align: 'center' });
  };

  if (!fitSinglePage && imgHmm > usableH) {
    let yOffset = 0;
    const pageSlicePx = Math.floor(usableH / pxToMm);
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageSlicePx));
    let pageNum = 0;
    while (yOffset < canvas.height) {
      if (yOffset > 0) pdf.addPage();
      pageNum += 1;
      const sliceH = Math.min(pageSlicePx, canvas.height - yOffset);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHmm = sliceH * pxToMm;
        pdf.addImage(sliceData, 'JPEG', margin, margin, usableW, sliceHmm);
      }
      stampPage(pdf, pageNum, totalPages);
      yOffset += sliceH;
    }
    return pdf.output('blob');
  }

  const ratioW = usableW / canvas.width;
  const ratioH = usableH / canvas.height;
  const ratio = fitSinglePage
    ? Math.min(ratioW, ratioH)
    : Math.min(ratioW, ratioH) * (isThermal ? 0.95 : 1);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  const x = (pageW - w) / 2;
  const y = margin;

  pdf.addImage(imgData, 'JPEG', x, y, w, h);
  stampPage(pdf, 1, 1);
  return pdf.output('blob');
}

/**
 * Export element to PDF and trigger browser download.
 */
export async function downloadPdf(
  element: HTMLElement,
  suggestedFilename: string,
  options: PdfExportOptions = {}
): Promise<void> {
  const blob = await exportElementToPdfBlob(element, options);
  const name = suggestedFilename.endsWith('.pdf') ? suggestedFilename : `${suggestedFilename}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Suggested filename for document type and reference (e.g. invoice no).
 */
export function suggestedPdfFilename(
  documentType: DocumentType,
  reference?: string
): string {
  const ref = reference ? `_${reference.replace(/[^a-zA-Z0-9-]/g, '_')}` : '';
  const prefix: Record<DocumentType, string> = {
    sales_invoice: 'Invoice',
    purchase_invoice: 'PurchaseInvoice',
    quotation: 'Quotation',
    proforma: 'Proforma',
    ledger: 'Ledger',
    receipt: 'Receipt',
    packing_list: 'PackingList',
    courier_slip: 'CourierSlip',
  };
  return `${prefix[documentType]}${ref}`;
}

export const pdfExportService = {
  exportElementToPdfBlob,
  downloadPdf,
  suggestedPdfFilename,
  resolvePrintableElement,
};
