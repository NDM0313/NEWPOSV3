/**
 * PDF Export: convert document HTML (from unified document engine) to PDF.
 * Uses html2canvas + jspdf (client-side). Supports: Sales Invoice, Purchase Invoice,
 * Quotation, Proforma, Ledger, Receipt, Packing List.
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
  /** Paper size: 'a4' | 'thermal' (80mm). Default a4. */
  format?: 'a4' | 'thermal';
  scale?: number;
}

/**
 * Capture an HTML element and return a PDF blob.
 * Call with the root element that wraps the printable content (e.g. the template div).
 */
export async function exportElementToPdfBlob(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<Blob> {
  const { scale = 2, format = 'a4' } = options;
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const isThermal = format === 'thermal';
  const pdf = new jsPDF({
    orientation: isThermal ? 'portrait' : 'portrait',
    unit: 'mm',
    format: isThermal ? [80, 297] : 'a4',
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = canvas.width;
  const imgH = canvas.height;
  const ratio = Math.min(pageW / imgW, pageH / imgH) * (isThermal ? 0.95 : 1);
  const w = imgW * ratio;
  const h = imgH * ratio;
  const x = (pageW - w) / 2;
  const y = 5;

  pdf.addImage(imgData, 'JPEG', x, y, w, h);
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
};
