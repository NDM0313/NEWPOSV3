/**
 * Map company printing_settings to document template options.
 * Single source: Settings → Printing controls what appears on all documents.
 */

import type { CompanyPrintingSettings, FieldsConfig } from '@/app/types/printingSettings';
import { mergeWithDefaults } from '@/app/types/printingSettings';
import { resolveDocumentLogoUrl } from '@/app/lib/resolveDocumentLogo';
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

function fieldsToInvoiceTemplate(
  fields: FieldsConfig,
  companyLogoUrl?: string | null
): ResolvedInvoiceTemplate {
  return {
    show_sku: fields.showSku ?? true,
    show_discount: fields.showDiscount ?? true,
    show_tax: fields.showTax ?? true,
    show_studio: fields.showStudioCost ?? true,
    show_signature: fields.showSignature ?? false,
    logo_url: resolveDocumentLogoUrl(null, companyLogoUrl),
    footer_note: fields.showTerms ? 'Terms & conditions apply.' : null,
  };
}

/**
 * Resolve invoice template (Sales/Purchase) from company printing settings.
 * Used by UnifiedSalesInvoiceView and (later) Purchase Invoice.
 */
export function resolveInvoiceTemplateFromSettings(
  settings: CompanyPrintingSettings | null | undefined,
  _documentKind: DocumentKind = 'sales_invoice',
  companyLogoUrl?: string | null
): ResolvedInvoiceTemplate {
  const merged = mergeWithDefaults(settings);
  return fieldsToInvoiceTemplate(merged.fields, companyLogoUrl);
}

function fieldsToLedgerOptions(fields: FieldsConfig, companyLogoUrl?: string | null): ResolvedLedgerOptions {
  return {
    showCompanyAddress: fields.showCompanyAddress ?? true,
    showNotes: fields.showNotes ?? true,
    showSignature: fields.showSignature ?? false,
    logoUrl: resolveDocumentLogoUrl(null, companyLogoUrl),
  };
}

function fieldsToReceiptOptions(fields: FieldsConfig, companyLogoUrl?: string | null): ResolvedReceiptOptions {
  return {
    showCompanyAddress: fields.showCompanyAddress ?? true,
    showNotes: fields.showNotes ?? true,
    showSignature: fields.showSignature ?? false,
    logoUrl: resolveDocumentLogoUrl(null, companyLogoUrl),
  };
}

function fieldsToPackingListOptions(fields: FieldsConfig, companyLogoUrl?: string | null): ResolvedPackingListOptions {
  return {
    showSku: fields.showSku ?? true,
    showCompanyAddress: fields.showCompanyAddress ?? true,
    showNotes: fields.showNotes ?? true,
    showSignature: fields.showSignature ?? false,
    logoUrl: resolveDocumentLogoUrl(null, companyLogoUrl),
  };
}

function fieldsToCourierSlipOptions(fields: FieldsConfig, companyLogoUrl?: string | null): ResolvedCourierSlipOptions {
  return {
    showCompanyAddress: fields.showCompanyAddress ?? true,
    showNotes: fields.showNotes ?? true,
    logoUrl: resolveDocumentLogoUrl(null, companyLogoUrl),
  };
}

function fieldsToQuotationOptions(fields: FieldsConfig, companyLogoUrl?: string | null): ResolvedQuotationOptions {
  return {
    showSku: fields.showSku ?? true,
    showDiscount: fields.showDiscount ?? true,
    showTax: fields.showTax ?? true,
    showSignature: fields.showSignature ?? false,
    logoUrl: resolveDocumentLogoUrl(null, companyLogoUrl),
    footerNote: fields.showTerms ? 'Terms & conditions apply.' : null,
  };
}

/**
 * Resolve options for a given document kind.
 */
export function resolveDocumentOptions(
  settings: CompanyPrintingSettings | null | undefined,
  _documentKind: DocumentKind,
  companyLogoUrl?: string | null
): ResolvedDocumentOptions {
  const merged = mergeWithDefaults(settings);
  const f = merged.fields;
  return {
    invoice: fieldsToInvoiceTemplate(f, companyLogoUrl),
    ledger: fieldsToLedgerOptions(f, companyLogoUrl),
    receipt: fieldsToReceiptOptions(f, companyLogoUrl),
    packingList: fieldsToPackingListOptions(f, companyLogoUrl),
    courierSlip: fieldsToCourierSlipOptions(f, companyLogoUrl),
    quotation: fieldsToQuotationOptions(f, companyLogoUrl),
    proforma: fieldsToInvoiceTemplate(f, companyLogoUrl),
  };
}

