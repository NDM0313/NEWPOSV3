/**
 * Production build stub for Transaction Detail “Payment / GL trace”.
 * Full Truth Lab workbench (deep joins, duplicate audit) can be restored from backup
 * or re-linked when those services are committed to main.
 */
export interface PaymentDeepTrace {
  errors: string[];
  payment?: unknown;
  journalEntries?: unknown[];
  journalLines?: unknown[];
  transactionMutations?: unknown[];
  allocations?: unknown[];
}

export type PaymentPostingAnalysis = { narrative: string };

export async function fetchPaymentDeepTrace(
  _companyId: string,
  _opts: { journalEntryId: string }
): Promise<PaymentDeepTrace> {
  return {
    errors: [],
    journalEntries: [],
    journalLines: [],
    transactionMutations: [],
    allocations: [],
  };
}

export function buildPaymentPostingExpectedVsActual(
  _trace: PaymentDeepTrace | null
): PaymentPostingAnalysis | null {
  return null;
}
