/**
 * Transaction Detail Modal — nested editor close guard (Batch A.1).
 * Prevents parent Radix Dialog from dismissing when a child editor is open or opening.
 */

export interface TransactionDetailNestedEditorFlags {
  journalQuickEditOpen?: boolean;
  manualReceiptEditorOpen?: boolean;
  supplierManualEditorOpen?: boolean;
  rentalPaymentEditorOpen?: boolean;
  genericPaymentEditorOpen?: boolean;
  editingAccounts?: boolean;
  paymentTraceOpen?: boolean;
  nestedEditorPending?: boolean;
}

export function isTransactionDetailNestedEditorOpen(
  flags: TransactionDetailNestedEditorFlags
): boolean {
  return Boolean(
    flags.journalQuickEditOpen ||
      flags.manualReceiptEditorOpen ||
      flags.supplierManualEditorOpen ||
      flags.rentalPaymentEditorOpen ||
      flags.genericPaymentEditorOpen ||
      flags.editingAccounts ||
      flags.paymentTraceOpen ||
      flags.nestedEditorPending
  );
}

/** When false, parent Transaction Detail may close. */
export function shouldAllowTransactionDetailClose(
  requestOpen: boolean,
  flags: TransactionDetailNestedEditorFlags
): boolean {
  if (requestOpen) return true;
  return !isTransactionDetailNestedEditorOpen(flags);
}
