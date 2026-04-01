/**
 * Document Share: Download PDF, Share via WhatsApp, Share via Email.
 * Works with the unified document engine (caller provides the DOM element for PDF).
 */

import {
  pdfExportService,
  type DocumentType,
  type PdfExportOptions,
} from './pdfExportService';

export interface ShareOptions {
  documentType: DocumentType;
  reference?: string;
  /** For WhatsApp/Email: short description e.g. "Invoice INV-001" */
  title?: string;
  /** Optional: custom message body for email/WhatsApp */
  message?: string;
}

/**
 * Download document as PDF. Call with the printable DOM element (e.g. ref to template container).
 */
export async function downloadAsPdf(
  element: HTMLElement,
  options: ShareOptions & PdfExportOptions
): Promise<void> {
  const filename = pdfExportService.suggestedPdfFilename(
    options.documentType,
    options.reference
  );
  await pdfExportService.downloadPdf(element, filename, {
    format: options.format,
    scale: options.scale,
  });
}

/**
 * Open WhatsApp share with pre-filled text (no file attachment; user can send message + attach PDF manually if they downloaded it).
 * Uses wa.me with text query. For "Share Invoice" flow: message can say "Please find invoice INV-001 attached" and user downloads PDF then attaches in WhatsApp.
 */
export function getWhatsAppShareUrl(phone: string | null, text: string): string {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const base = 'https://wa.me/';
  if (!cleanPhone) {
    return `${base}?text=${encodeURIComponent(text)}`;
  }
  return `${base}${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Open WhatsApp in new tab with message. If phone provided, opens chat with that number.
 */
export function shareViaWhatsApp(
  text: string,
  phone?: string | null
): void {
  const url = getWhatsAppShareUrl(phone ?? null, text);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Open default email client with subject and body (mailto:). No attachment in browser mailto.
 * User can attach the PDF after downloading.
 */
export function getEmailShareUrl(subject: string, body?: string): string {
  const params = new URLSearchParams();
  params.set('subject', subject);
  if (body) params.set('body', body);
  return `mailto:?${params.toString()}`;
}

export function shareViaEmail(subject: string, body?: string): void {
  const url = getEmailShareUrl(subject, body);
  window.location.href = url;
}

/**
 * Build a short share message for invoice/quotation (for WhatsApp/Email body).
 */
export function buildShareMessage(options: ShareOptions): string {
  const title = options.title || `${options.documentType}${options.reference ? ` ${options.reference}` : ''}`;
  const message = options.message || `Please find ${title} attached.`;
  return message;
}

export const documentShareService = {
  downloadAsPdf,
  getWhatsAppShareUrl,
  shareViaWhatsApp,
  getEmailShareUrl,
  shareViaEmail,
  buildShareMessage,
};
