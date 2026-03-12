/**
 * Unified document engine types.
 * All printable documents (Sales Invoice, Purchase Invoice, Ledger, Receipt, Packing List)
 * use the same options resolved from printing_settings.
 */

import type { DocumentTemplateId } from '@/app/types/printingSettings';

export type DocumentKind = DocumentTemplateId;

/** Resolved options for invoice-type documents (Sales, Purchase). Matches InvoiceTemplate shape. */
export interface ResolvedInvoiceTemplate {
  show_sku: boolean;
  show_discount: boolean;
  show_tax: boolean;
  show_studio: boolean;
  show_signature: boolean;
  logo_url: string | null;
  footer_note: string | null;
}

/** Options for ledger statement (from printing_settings.fields). */
export interface ResolvedLedgerOptions {
  showCompanyAddress: boolean;
  showNotes: boolean;
  showSignature: boolean;
  logoUrl: string | null;
}

/** Options for payment receipt. */
export interface ResolvedReceiptOptions {
  showCompanyAddress: boolean;
  showNotes: boolean;
  showSignature: boolean;
  logoUrl: string | null;
}

/** Options for packing list. */
export interface ResolvedPackingListOptions {
  showSku: boolean;
  showCompanyAddress: boolean;
  showNotes: boolean;
  showSignature: boolean;
  logoUrl: string | null;
}

/** Options for courier slip. */
export interface ResolvedCourierSlipOptions {
  showCompanyAddress: boolean;
  showNotes: boolean;
  logoUrl: string | null;
}

/** Options for quotation (same as invoice layout). */
export interface ResolvedQuotationOptions {
  showSku: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showSignature: boolean;
  logoUrl: string | null;
  footerNote: string | null;
}

/** Options for proforma invoice (same as sales invoice). */
export type ResolvedProformaOptions = ResolvedInvoiceTemplate;

export interface ResolvedDocumentOptions {
  invoice: ResolvedInvoiceTemplate;
  ledger: ResolvedLedgerOptions;
  receipt: ResolvedReceiptOptions;
  packingList: ResolvedPackingListOptions;
  courierSlip: ResolvedCourierSlipOptions;
  quotation: ResolvedQuotationOptions;
  proforma: ResolvedProformaOptions;
}
