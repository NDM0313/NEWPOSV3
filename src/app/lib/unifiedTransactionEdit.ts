/**
 * Source-aware resolution for “edit this journal row” — all accounting UIs should
 * resolve the real editable entity here instead of inventing per-screen edit logic.
 */

export type TransactionKind =
  | 'document_total'
  | 'payment'
  | 'discount'
  | 'commission'
  | 'shipping'
  | 'expense_component'
  | 'transfer'
  | 'manual_journal'
  | 'generic_adjustment';

export type UnifiedJournalEditResolution =
  | { kind: 'manual_journal_editor'; transactionKind: 'manual_journal' }
  | {
      kind: 'payment_editor';
      transactionKind: 'payment';
      context: 'customer' | 'supplier' | 'rental' | 'worker';
      sourceId?: string;
      paymentReferenceType?: string;
    }
  | {
      kind: 'document_editor';
      transactionKind: 'document_total';
      sourceType: 'sale' | 'purchase' | 'rental';
      sourceId: string;
    }
  | {
      kind: 'adjustment_editor';
      transactionKind: 'discount' | 'commission' | 'shipping' | 'expense_component' | 'generic_adjustment';
      sourceType?: 'sale' | 'purchase' | 'rental' | 'expense';
      sourceId?: string;
    }
  | { kind: 'transfer_editor'; transactionKind: 'transfer' }
  | { kind: 'blocked'; reason: string }
  | { kind: 'noop'; reason: string };

export interface JournalTransactionLike {
  id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  payment_id?: string | null;
  is_void?: boolean | null;
  description?: string | null;
}

export interface PaymentRowLike {
  id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  contact_id?: string | null;
  voided_at?: string | null;
}

function normPayment(p: unknown): PaymentRowLike | null {
  if (!p || typeof p !== 'object') return null;
  const x = p as PaymentRowLike;
  return x;
}

export function inferTransactionKind(transaction: JournalTransactionLike, paymentObj: unknown): TransactionKind {
  const rt = String(transaction.reference_type || '').toLowerCase();
  const desc = String(transaction.description || '').toLowerCase();
  const payment = normPayment(paymentObj);
  const prt = String(payment?.reference_type || '').toLowerCase();

  if (rt === 'journal') return 'manual_journal';
  if (rt === 'transfer') return 'transfer';

  if (
    rt === 'payment' ||
    rt === 'payment_adjustment' ||
    rt === 'manual_receipt' ||
    rt === 'manual_payment' ||
    rt === 'on_account' ||
    rt === 'worker_payment' ||
    rt === 'worker_advance_settlement' ||
    prt === 'sale' ||
    prt === 'purchase' ||
    prt === 'rental' ||
    prt === 'manual_receipt' ||
    prt === 'manual_payment' ||
    prt === 'on_account'
  ) {
    return 'payment';
  }

  if (desc.includes('discount')) return 'discount';
  if (desc.includes('commission')) return 'commission';
  if (desc.includes('shipping') || desc.includes('courier')) return 'shipping';

  if (rt === 'sale' || rt === 'purchase' || rt === 'rental') return 'document_total';

  if (rt === 'expense' || rt === 'extra_expense') return 'expense_component';

  if (rt === 'sale_adjustment' || rt === 'purchase_adjustment') return 'generic_adjustment';

  return 'generic_adjustment';
}

/**
 * Pure resolver: given a loaded journal_entries row (+ embedded payment), what should the UI open?
 */
export function resolveUnifiedJournalEdit(
  transaction: JournalTransactionLike,
  paymentObj: unknown
): UnifiedJournalEditResolution {
  if (transaction.is_void === true) {
    return { kind: 'blocked', reason: 'This journal entry is voided.' };
  }
  const rt = String(transaction.reference_type || '').toLowerCase();
  if (rt === 'correction_reversal') {
    return {
      kind: 'blocked',
      reason: 'This is a correction reversal. Edit the original source document or post a new adjustment.',
    };
  }

  const payment = normPayment(paymentObj);
  const kind = inferTransactionKind(transaction, paymentObj);
  const prid = payment?.reference_id ? String(payment.reference_id) : '';
  const prt = String(payment?.reference_type || '').toLowerCase();

  if (kind === 'manual_journal') {
    return { kind: 'manual_journal_editor', transactionKind: 'manual_journal' };
  }
  if (kind === 'transfer') {
    return { kind: 'transfer_editor', transactionKind: 'transfer' };
  }
  if (kind === 'document_total') {
    if (!transaction.reference_id) return { kind: 'noop', reason: 'Missing document reference on this journal.' };
    if (rt === 'sale') return { kind: 'document_editor', transactionKind: 'document_total', sourceType: 'sale', sourceId: String(transaction.reference_id) };
    if (rt === 'purchase') return { kind: 'document_editor', transactionKind: 'document_total', sourceType: 'purchase', sourceId: String(transaction.reference_id) };
    if (rt === 'rental') return { kind: 'document_editor', transactionKind: 'document_total', sourceType: 'rental', sourceId: String(transaction.reference_id) };
    return { kind: 'noop', reason: 'Unsupported document-level source type.' };
  }
  if (kind === 'payment') {
    if (rt === 'manual_receipt') {
      return { kind: 'payment_editor', transactionKind: 'payment', context: 'customer', sourceId: String(transaction.reference_id || '') };
    }
    if (rt === 'manual_payment' || rt === 'on_account') {
      return { kind: 'payment_editor', transactionKind: 'payment', context: 'supplier', sourceId: String(transaction.reference_id || '') };
    }
    if (prt === 'rental') {
      return { kind: 'payment_editor', transactionKind: 'payment', context: 'rental', sourceId: prid, paymentReferenceType: prt };
    }
    if (prt === 'purchase' || prt === 'manual_payment' || prt === 'on_account') {
      return { kind: 'payment_editor', transactionKind: 'payment', context: 'supplier', sourceId: prid, paymentReferenceType: prt };
    }
    if (prt === 'worker_payment' || prt === 'worker_advance_settlement') {
      return { kind: 'payment_editor', transactionKind: 'payment', context: 'worker', sourceId: prid, paymentReferenceType: prt };
    }
    return {
      kind: 'payment_editor',
      transactionKind: 'payment',
      context: 'customer',
      sourceId: prid || String(transaction.reference_id || ''),
      paymentReferenceType: prt,
    };
  }

  return {
    kind: 'adjustment_editor',
    transactionKind: kind,
    sourceType: rt === 'sale_adjustment' ? 'sale' : rt === 'purchase_adjustment' ? 'purchase' : rt === 'expense' || rt === 'extra_expense' ? 'expense' : undefined,
    sourceId: transaction.reference_id ? String(transaction.reference_id) : undefined,
  };
}

export function unifiedEditButtonLabel(resolution: UnifiedJournalEditResolution): string {
  switch (resolution.kind) {
    case 'manual_journal_editor':
      return 'Edit journal';
    case 'payment_editor':
      return 'Edit payment';
    case 'document_editor':
      return resolution.sourceType === 'sale' ? 'Edit sale' : resolution.sourceType === 'purchase' ? 'Edit purchase' : 'Edit rental';
    case 'adjustment_editor':
      return 'Edit adjustment';
    case 'transfer_editor':
      return 'Edit transfer';
    case 'blocked':
    case 'noop':
      return 'Edit';
  }
}

/** After a successful save, broadcast so lists / ledger / statements reload. */
export function dispatchAccountingEditCommitted(extra?: { customerId?: string; supplierId?: string }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
  window.dispatchEvent(new CustomEvent('paymentAdded'));
  if (extra?.customerId) {
    window.dispatchEvent(
      new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: extra.customerId } })
    );
  }
  if (extra?.supplierId) {
    window.dispatchEvent(
      new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: extra.supplierId } })
    );
  }
}
