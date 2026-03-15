/**
 * FALLBACK ONLY: Prefer documentNumberService.getNextDocumentNumber(companyId, branchId, 'payment')
 * which uses erp_document_sequences (canonical). Use this only when RPC fails to avoid blocking the user.
 * Do not use for new payment flows; canonical path = generate_document_number → erp_document_sequences.
 */
export function generatePaymentReference(existing?: string | null): string {
  if (existing != null && String(existing).trim() !== '') return String(existing).trim();
  return `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
