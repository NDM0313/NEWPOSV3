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
  /** When true, this row is superseded in a PF-14 payment chain — do not open payment editor. */
  payment_chain_is_historical?: boolean;
  /** Active PF-07 correction_reversal exists for this journal header — terminal for unified edit. */
  has_active_correction_reversal?: boolean | null;
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
  const payJeId = String(transaction.payment_id || '').trim();

  if (rt === 'journal') return 'manual_journal';
  if (rt === 'transfer') return 'transfer';
  /** Source documents — unified edit is blocked in resolveUnifiedJournalEdit; never treat as payment. */
  if (rt === 'sale_return' || rt === 'purchase_return') return 'generic_adjustment';

  // Sale/purchase customer receipts post with reference_type = sale/purchase on the JE header while payment_id links
  // the row — still a payment for PF-14 / edit routing (do not open full sale/purchase on "Edit payment").
  if (payJeId && (rt === 'sale' || rt === 'purchase')) {
    return 'payment';
  }

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
  if (transaction.has_active_correction_reversal === true) {
    return {
      kind: 'blocked',
      reason:
        'Already reversed (offsetting correction is posted). This row is view-only — do not edit amounts or post another reversal from here.',
    };
  }
  if (transaction.payment_chain_is_historical === true) {
    return {
      kind: 'blocked',
      reason:
        'This payment line is historical (a later edit or transfer exists). Open the latest journal row for this receipt to edit.',
    };
  }
  const rt = String(transaction.reference_type || '').toLowerCase();
  if (rt === 'correction_reversal') {
    return {
      kind: 'blocked',
      reason: 'This is a correction reversal. Edit the original source document or post a new adjustment.',
    };
  }

  if (rt === 'sale_return' || rt === 'purchase_return') {
    return {
      kind: 'blocked',
      reason:
        'Return postings are source-controlled. Cancel or void the return from Sales or Purchases — not from Journal Entries or this transaction dialog.',
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
    return {
      kind: 'blocked',
      reason:
        'Invoice / PO / rental totals follow document lines. Open the sale, purchase, or rental from its module — journal amount/account edit is not allowed here.',
    };
  }
  if (kind === 'payment') {
    // PF-14 adjustment voucher: always edit the underlying payment, not the sale/purchase document.
    if (rt === 'payment_adjustment') {
      const pidFromJe =
        String(transaction.payment_id || '').trim() || String(transaction.reference_id || '').trim();
      if (pidFromJe) {
        return {
          kind: 'payment_editor',
          transactionKind: 'payment',
          context: 'customer',
          sourceId: pidFromJe,
          paymentReferenceType: 'payment_adjustment',
        };
      }
    }
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
