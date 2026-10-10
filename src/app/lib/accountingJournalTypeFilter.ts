/**
 * Accounting dashboard journal type-chip filters.
 * Pure predicates over AccountingEntry-like rows (metadata.referenceType + source).
 */

export type AccountingJournalTypeFilterKey =
  | 'all'
  | 'sale'
  | 'sale_return'
  | 'purchase'
  | 'purchase_return'
  | 'payment'
  | 'opening'
  | 'shipment'
  | 'adjustment'
  | 'cancel'
  | 'expense';

const PAYMENT_REFS = new Set([
  'payment',
  'payment_adjustment',
  'manual_receipt',
  'manual_payment',
  'on_account',
  'worker_payment',
  'worker_advance_settlement',
  'courier_payment',
]);

/** Document value adjustments that belong under Sales / Purchases / Payments chips, not Adjustments. */
const DOCUMENT_ADJUSTMENT_REFS = new Set([
  'sale_adjustment',
  'purchase_adjustment',
  'payment_adjustment',
]);

export function normalizeJournalRefType(raw: string | null | undefined): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

export function entryJournalRefTypes(entry: {
  metadata?: {
    referenceType?: string | null;
    rootReferenceType?: string | null;
  } | null;
}): { ref: string; rootRef: string } {
  const ref = normalizeJournalRefType(entry.metadata?.referenceType);
  const rootRef = normalizeJournalRefType(entry.metadata?.rootReferenceType) || ref;
  return { ref, rootRef };
}

export function isOpeningBalanceRef(ref: string): boolean {
  if (!ref) return false;
  if (ref === 'opening_balance' || ref.startsWith('opening_balance_')) return true;
  if (ref === 'coa_opening' || ref === 'system_seed') return true;
  return false;
}

/**
 * Exclusive chip allowlists — see plan journal_type_filters_fix.
 */
export function matchesAccountingTypeFilter(
  entry: {
    source?: string | null;
    metadata?: {
      referenceType?: string | null;
      rootReferenceType?: string | null;
      paymentId?: string | null;
    } | null;
  },
  filterKey: string,
): boolean {
  if (!filterKey || filterKey === 'all') return true;

  const { ref, rootRef } = entryJournalRefTypes(entry);
  const check = (r: string) => {
    switch (filterKey) {
      case 'sale':
        return r === 'sale' || r === 'sale_adjustment';
      case 'sale_return':
        return r === 'sale_return';
      case 'purchase':
        return r === 'purchase' || r === 'purchase_adjustment';
      case 'purchase_return':
        return r === 'purchase_return';
      case 'payment':
        return PAYMENT_REFS.has(r);
      case 'opening':
        return isOpeningBalanceRef(r);
      case 'shipment':
        return r === 'shipment' || r === 'shipment_reversal';
      case 'adjustment':
        if (DOCUMENT_ADJUSTMENT_REFS.has(r)) return false;
        if (isOpeningBalanceRef(r)) return false;
        return r === 'stock_adjustment' || r.endsWith('_adjustment') || r.includes('_adjustment_');
      case 'cancel':
        if (r === 'sale_return' || r === 'purchase_return') return false;
        return (
          r === 'sale_reversal' ||
          r === 'purchase_reversal' ||
          r === 'shipment_reversal' ||
          r.includes('cancel') ||
          (r.endsWith('_reversal') && r !== 'correction_reversal')
        );
      case 'expense':
        return r === 'expense' || r === 'expense_payment' || entry.source === 'Expense';
      default:
        return true;
    }
  };

  if (check(ref)) return true;
  // Opening / cancel / shipment: also honor root when row is a linked adjustment on same root
  if (filterKey === 'opening' && check(rootRef)) return true;
  return false;
}

export function accountingTypeFilterEmptyMessage(filterKey: string): { title: string; hint: string } {
  if (filterKey === 'opening') {
    return {
      title: 'No opening balance journals found',
      hint: 'Create or edit an account opening balance, or check that opening JEs were posted to the ledger.',
    };
  }
  return {
    title: 'No journal entries match your filters',
    hint: 'Try a different keyword, clear search, or switch transaction type.',
  };
}
