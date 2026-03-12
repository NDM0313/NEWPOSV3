/**
 * Map company printing_settings to document template options.
 * Single source: Settings → Printing controls what appears on all documents.
 */

import type { CompanyPrintingSettings, FieldsConfig } from '@/app/types/printingSettings';
import { mergeWithDefaults } from '@/app/types/printingSettings';
import type {
  DocumentKind,
  ResolvedDocumentOptions,
  ResolvedInvoiceTemplate,
  ResolvedLedgerOptions,
  ResolvedReceiptOptions,
  ResolvedPackingListOptions,
  ResolvedCourierSlipOptions,
  ResolvedQuotationOptions,
  ResolvedProformaOptions,
} from './types';

function fieldsToInvoiceTemplate(fields: FieldsConfig): ResolvedInvoiceTemplate {
  return {
    show_sku: fields.showSku ?? true,
    show_discount: fields.showDiscount ?? true,
    show_tax: fields.showTax ?? true,
    show_studio: fields.showStudioCost ?? true,
    show_signature: fields.showSignature ?? false,
    logo_url: null, // Logo URL comes from company/settings elsewhere; engine can inject later
    footer_note: fields.showTerms ? 'Terms & conditions apply.' : null,
  };
}

/**
 * Resolve invoice template (Sales/Purchase) from company printing settings.
 * Used by UnifiedSalesInvoiceView and (later) Purchase Invoice.
 */
export function resolveInvoiceTemplateFromSettings(
  settings: CompanyPrintingSettings | null | undefined,
  _documentKind: DocumentKind = 'sales_invoice'
): ResolvedInvoiceTemplate {
  const merged = mergeWithDefaults(settings);
  return fieldsToInvoiceTemplate(merged.fields);
}

function fieldsToLedgerOptions(fields: FieldsConfig): ResolvedLedgerOptions {
  return {
    showCompanyAddress: fields.showCompanyAddress ?? true,
    showNotes: fields.showNotes ?? true,
    showSignature: fields.showSignature ?? false,
    logoUrl: null,
  };
}

function fieldsToReceiptOptions(fields: FieldsConfig): ResolvedReceiptOptions {
  return {
    showCompanyAddress: fields.showCompanyAddress ?? true,
    showNotes: fields.showNotes ?? true,
    showSignature: fields.showSignature ?? false,
    logoUrl: null,
  };
}

function fieldsToPackingListOptions(fields: FieldsConfig): ResolvedPackingListOptions {
  return {
    showSku: fields.showSku ?? true,
    showCompanyAddress: fields.showCompanyAddress ?? true,
    showNotes: fields.showNotes ?? true,
    showSignature: fields.showSignature ?? false,
    logoUrl: null,
  };
}

function fieldsToCourierSlipOptions(fields: FieldsConfig): ResolvedCourierSlipOptions {
  return {
    showCompanyAddress: fields.showCompanyAddress ?? true,
    showNotes: fields.showNotes ?? true,
    logoUrl: null,
  };
}

function fieldsToQuotationOptions(fields: FieldsConfig): ResolvedQuotationOptions {
  return {
    showSku: fields.showSku ?? true,
    showDiscount: fields.showDiscount ?? true,
    showTax: fields.showTax ?? true,
    showSignature: fields.showSignature ?? false,
    logoUrl: null,
    footerNote: fields.showTerms ? 'Terms & conditions apply.' : null,
  };
}

/**
 * Resolve options for a given document kind.
 */
export function resolveDocumentOptions(
  settings: CompanyPrintingSettings | null | undefined,
  _documentKind: DocumentKind
): ResolvedDocumentOptions {
  const merged = mergeWithDefaults(settings);
  const f = merged.fields;
  return {
    invoice: fieldsToInvoiceTemplate(f),
    ledger: fieldsToLedgerOptions(f),
    receipt: fieldsToReceiptOptions(f),
    packingList: fieldsToPackingListOptions(f),
    courierSlip: fieldsToCourierSlipOptions(f),
    quotation: fieldsToQuotationOptions(f),
    proforma: fieldsToInvoiceTemplate(f),
  };
}

