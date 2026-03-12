/**
 * Unified document engine.
 * All printable documents use this layer and read from printing_settings.
 */

export { UnifiedSalesInvoiceView } from './UnifiedSalesInvoiceView';
export { UnifiedPurchaseInvoiceView } from './UnifiedPurchaseInvoiceView';
export { UnifiedLedgerView } from './UnifiedLedgerView';
export { UnifiedReceiptView } from './UnifiedReceiptView';
export { UnifiedPackingListView } from './UnifiedPackingListView';
export { UnifiedCourierSlipView } from './UnifiedCourierSlipView';
export { UnifiedQuotationView } from './UnifiedQuotationView';
export { UnifiedProformaInvoiceView } from './UnifiedProformaInvoiceView';
export { useUnifiedDocumentSettings } from './useUnifiedDocumentSettings';
export { resolveInvoiceTemplateFromSettings, resolveDocumentOptions } from './resolveOptions';
export { purchaseToInvoiceDocument } from './adapters/purchaseToInvoiceDocument';

export type { DocumentKind, ResolvedInvoiceTemplate, ResolvedDocumentOptions, ResolvedLedgerOptions, ResolvedReceiptOptions, ResolvedPackingListOptions, ResolvedCourierSlipOptions } from './types';
export type { LedgerDocument, LedgerLine, LedgerTemplateOptions } from './templates/LedgerTemplate';
export type { ReceiptDocument, ReceiptTemplateOptions } from './templates/ReceiptTemplate';
export type { PackingListDocument, PackingListItem, PackingListTemplateOptions } from './templates/PackingListTemplate';
export type { CourierSlipDocument, CourierSlipTemplateOptions } from './templates/CourierSlipTemplate';
export type { QuotationDocument, QuotationDocumentItem, QuotationTemplateOptions } from './templates/QuotationTemplate';
