/**
 * Friendly labels for erp_document_sequences / erp_document_number_audit document_type values.
 */

const LABELS: Record<string, string> = {
  PAYMENT: 'Outgoing payment (PAY)',
  CUSTOMER_RECEIPT: 'Customer receipt (RCV)',
  EXPENSE: 'Expense (EXP)',
  SUPPLIER_PAYMENT: 'Supplier payment — legacy counter',
  WORKER_PAYMENT: 'Worker payment — legacy (WPY)',
  MANUAL_JOURNAL: 'Manual journal (JV)',
  FUND_TRANSFER: 'Fund transfer (FT)',
  SALE: 'Sale',
  PURCHASE: 'Purchase',
  RENTAL: 'Rental',
  STUDIO: 'Studio',
  POS: 'POS',
  PRODUCT: 'Product',
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  WORKER: 'Worker',
  JOB: 'Studio job',
};

export function friendlyNumberingDocumentType(documentType: string | null | undefined): string {
  const key = String(documentType || '')
    .trim()
    .toUpperCase();
  if (!key) return '—';
  return LABELS[key] ?? key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
