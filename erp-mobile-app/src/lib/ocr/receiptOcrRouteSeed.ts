/** Shared seed when routing from Scan Receipt hub into an existing flow. */

export type ReceiptOcrRouteKind =
  | 'client-payment'
  | 'supplier-payment'
  | 'worker-payment'
  | 'courier-payment'
  | 'expense-entry'
  | 'account-transfer'
  | 'general-entry';

export interface ReceiptOcrRouteSeed {
  amount?: number;
  /** YYYY-MM-DD */
  date?: string;
  /** HH:mm for payment datetime */
  time?: string;
  reference?: string;
  notes?: string;
  /** Prefill supplier search (suggestions only) */
  supplierHint?: string;
  attachmentFiles: File[];
}

export function emptyReceiptOcrRouteSeed(): ReceiptOcrRouteSeed {
  return { attachmentFiles: [] };
}
