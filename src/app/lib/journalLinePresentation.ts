/**
 * Phase 4: How a journal row should read in Effective vs Audit UX.
 * Does not change GL math — labels and grouping hints only.
 */

export type JournalLinePresentationKind =
  | 'business_primary'
  | 'liquidity_transfer'
  | 'amount_delta'
  | 'sale_edit'
  | 'purchase_edit'
  | 'reversal'
  | 'standard';

export function presentationLabel(kind: JournalLinePresentationKind): string {
  switch (kind) {
    case 'liquidity_transfer':
      return 'Transfer (PF-14)';
    case 'amount_delta':
      return 'Amount delta (PF-14)';
    case 'sale_edit':
      return 'Sale edit (delta)';
    case 'purchase_edit':
      return 'Purchase edit (delta)';
    case 'reversal':
      return 'Reversal';
    case 'business_primary':
      return 'Document';
    default:
      return 'Journal';
  }
}

/** Classify a journal entry (header) for list/badge display. */
export function journalEntryPresentationFromHeader(
  referenceType: string | null | undefined,
  actionFingerprint: string | null | undefined
): JournalLinePresentationKind {
  const rt = String(referenceType || '').toLowerCase();
  const fp = String(actionFingerprint || '');

  if (rt === 'correction_reversal' || rt === 'purchase_reversal' || rt === 'sale_reversal') return 'reversal';
  if (rt === 'sale_adjustment') return 'sale_edit';
  if (rt === 'purchase_adjustment') return 'purchase_edit';
  if (rt === 'payment_adjustment') {
    if (fp.startsWith('payment_adjustment_account:')) return 'liquidity_transfer';
    if (fp.startsWith('payment_adjustment_amount:')) return 'amount_delta';
    return 'amount_delta';
  }
  if (
    ['manual_receipt', 'sale', 'purchase', 'payment', 'expense', 'rental', 'worker_payment', 'manual_payment'].includes(
      rt
    )
  ) {
    return 'business_primary';
  }
  return 'standard';
}
