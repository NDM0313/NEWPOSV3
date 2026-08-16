import type { TransactionRow } from '../api/transactions';
import type { EntrySourceKind } from './cashFlowDirection';
import { isCorrectionReversalReferenceType } from './reportVisibilityContract';

export interface CopyTransactionPrefill {
  debitAccountId: string;
  creditAccountId: string;
}

export interface JournalLineForCopy {
  account_id: string;
  debit: number;
  credit: number;
}

/** Always blocked — returns, expense, rental, worker, inventory, etc. */
const ALWAYS_BLOCKED_REFERENCE_TYPES = new Set([
  'sale_return',
  'purchase_return',
  'sale_reversal',
  'purchase_reversal',
  'sale_adjustment',
  'purchase_adjustment',
  'expense',
  'expense_payment',
  'rental',
  'rental_payment',
  'worker_payment',
  'stock_movement',
  'inventory',
  'studio_production_stage',
  'studio_production_stage_reversal',
  'opening_balance',
  'opening_stock',
  'stock_adjustment',
]);

/** Sale/purchase GL document rows (journal timeline) — not payment settlements. */
const JOURNAL_DOCUMENT_REFERENCE_TYPES = new Set(['sale', 'purchase', 'purchase_order']);

const GENERAL_JOURNAL_REFERENCE_TYPES = new Set([
  'general',
  'journal',
  'transfer',
  'manual_journal',
  'general_journal',
]);

const MANUAL_PAYMENT_REFERENCE_TYPES = new Set(['manual_receipt', 'manual_payment']);

const CUSTOMER_SETTLEMENT_REFERENCE_TYPES = new Set([
  'sale',
  'payment',
  'on_account',
  'customer_payment',
  'sale_payment',
  'receipt',
]);

const SUPPLIER_SETTLEMENT_REFERENCE_TYPES = new Set(['purchase', 'purchase_order', 'payment']);

const COPYABLE_SOURCE_KINDS = new Set<EntrySourceKind>([
  'general',
  'journal_manual',
  'transfer',
  'payment_customer',
  'payment_supplier',
]);

function normalizeRefType(referenceType: string | null | undefined): string {
  return String(referenceType || '').toLowerCase().trim();
}

function resolveCopyAccountIds(tx: TransactionRow): { paymentAccountId: string; partyAccountId: string } | null {
  const paymentAccountId = String(tx.paymentAccountId ?? tx.liquidityAccountId ?? '').trim();
  const partyAccountId = String(tx.partyAccountId ?? tx.counterpartyAccountId ?? '').trim();
  if (!paymentAccountId || !partyAccountId || paymentAccountId === partyAccountId) return null;
  return { paymentAccountId, partyAccountId };
}

function hasCopyableAccountPair(tx: TransactionRow): boolean {
  return resolveCopyAccountIds(tx) !== null;
}

/** Payment row settling customer receipt or supplier payment (RCV/PAY vouchers). */
export function isPartyPaymentSettlementRow(tx: TransactionRow): boolean {
  if (tx.id.startsWith('journal-') || tx.id.startsWith('expense-')) return false;
  const rt = normalizeRefType(tx.referenceType);
  if (ALWAYS_BLOCKED_REFERENCE_TYPES.has(rt)) return false;
  if (tx.direction === 'received' && CUSTOMER_SETTLEMENT_REFERENCE_TYPES.has(rt)) return true;
  if (tx.direction === 'paid' && SUPPLIER_SETTLEMENT_REFERENCE_TYPES.has(rt)) return true;
  return false;
}

export function resolveJournalLineAccountPair(
  lines: JournalLineForCopy[] | null | undefined,
): CopyTransactionPrefill | null {
  const raw = lines ?? [];
  if (raw.length === 0) return null;

  let maxDr = 0;
  let maxCr = 0;
  let debitAccountId = '';
  let creditAccountId = '';

  for (const line of raw) {
    const dr = Number(line.debit || 0);
    const cr = Number(line.credit || 0);
    const accountId = String(line.account_id || '').trim();
    if (!accountId) continue;
    if (dr > maxDr) {
      maxDr = dr;
      debitAccountId = accountId;
    }
    if (cr > maxCr) {
      maxCr = cr;
      creditAccountId = accountId;
    }
  }

  if (!debitAccountId || !creditAccountId || debitAccountId === creditAccountId) return null;
  return { debitAccountId, creditAccountId };
}

export interface CanCopyAccountingTransactionInput {
  referenceType?: string | null;
  sourceKind?: EntrySourceKind | null;
  direction?: 'received' | 'paid' | null;
  /** When true, row is a payment settlement for a source document (sale/purchase). */
  isPaymentRowForSourceDoc?: boolean;
}

export function canCopyAccountingTransaction(input: CanCopyAccountingTransactionInput): boolean {
  const rt = normalizeRefType(input.referenceType);
  if (isCorrectionReversalReferenceType(rt)) return false;
  if (ALWAYS_BLOCKED_REFERENCE_TYPES.has(rt)) return false;
  if (JOURNAL_DOCUMENT_REFERENCE_TYPES.has(rt)) return false;
  if (input.isPaymentRowForSourceDoc) return false;

  if (GENERAL_JOURNAL_REFERENCE_TYPES.has(rt)) return true;
  if (MANUAL_PAYMENT_REFERENCE_TYPES.has(rt)) return true;

  if (input.sourceKind && COPYABLE_SOURCE_KINDS.has(input.sourceKind)) {
    return true;
  }

  if (rt === 'payment' || rt === 'on_account') {
    return input.direction === 'received' || input.direction === 'paid';
  }

  return false;
}

export interface AccountEntryCopyInput {
  referenceType?: string | null;
  sourceKind?: EntrySourceKind | null;
  paymentType?: 'received' | 'paid' | null;
  debitAccountId?: string | null;
  creditAccountId?: string | null;
  lineCount?: number;
}

export function canCopyAccountEntry(entry: AccountEntryCopyInput): boolean {
  const rt = normalizeRefType(entry.referenceType);
  const sourceKind = entry.sourceKind ?? null;

  if (sourceKind === 'payment_worker' || sourceKind === 'expense') {
    return false;
  }
  if (
    sourceKind === 'sale' ||
    sourceKind === 'purchase' ||
    sourceKind === 'sale_return' ||
    sourceKind === 'purchase_reversal'
  ) {
    return false;
  }

  if (sourceKind === 'payment_customer' || sourceKind === 'payment_supplier') {
    return Boolean(entry.debitAccountId?.trim() && entry.creditAccountId?.trim());
  }

  if (
    !canCopyAccountingTransaction({
      referenceType: rt,
      sourceKind,
      direction: entry.paymentType ?? null,
    })
  ) {
    return false;
  }

  return Boolean(entry.debitAccountId?.trim() && entry.creditAccountId?.trim());
}

export function resolveCopyPrefillFromAccountEntry(
  entry: AccountEntryCopyInput,
): CopyTransactionPrefill | null {
  if (!canCopyAccountEntry(entry)) return null;
  const debitAccountId = String(entry.debitAccountId || '').trim();
  const creditAccountId = String(entry.creditAccountId || '').trim();
  if (!debitAccountId || !creditAccountId || debitAccountId === creditAccountId) return null;
  return { debitAccountId, creditAccountId };
}

function isPaymentRowBlockedForCopy(tx: TransactionRow): boolean {
  const rt = normalizeRefType(tx.referenceType);

  if (tx.id.startsWith('journal-')) {
    return (
      ALWAYS_BLOCKED_REFERENCE_TYPES.has(rt) || JOURNAL_DOCUMENT_REFERENCE_TYPES.has(rt)
    );
  }

  if (ALWAYS_BLOCKED_REFERENCE_TYPES.has(rt)) return true;
  if (isPartyPaymentSettlementRow(tx)) return false;
  if (JOURNAL_DOCUMENT_REFERENCE_TYPES.has(rt)) return true;
  return false;
}

export function canCopyTransactionRow(tx: TransactionRow): boolean {
  if (tx.id.startsWith('expense-')) return false;
  if (isPaymentRowBlockedForCopy(tx)) return false;

  const rt = normalizeRefType(tx.referenceType);
  const isJournalTimeline = tx.id.startsWith('journal-') || GENERAL_JOURNAL_REFERENCE_TYPES.has(rt);

  if (isJournalTimeline) {
    return canCopyAccountingTransaction({ referenceType: rt });
  }

  if (isPartyPaymentSettlementRow(tx)) {
    return hasCopyableAccountPair(tx);
  }

  if (MANUAL_PAYMENT_REFERENCE_TYPES.has(rt)) {
    return canCopyAccountingTransaction({ referenceType: rt, direction: tx.direction });
  }

  if (rt === 'payment' || rt === 'on_account') {
    return canCopyAccountingTransaction({
      referenceType: rt,
      direction: tx.direction,
      isPaymentRowForSourceDoc: false,
    });
  }

  return false;
}

export function resolveCopyPrefillFromTransactionRow(tx: TransactionRow): CopyTransactionPrefill | null {
  if (!canCopyTransactionRow(tx)) return null;

  const ids = resolveCopyAccountIds(tx);
  if (!ids) return null;

  if (tx.direction === 'received') {
    return { debitAccountId: ids.paymentAccountId, creditAccountId: ids.partyAccountId };
  }
  return { debitAccountId: ids.partyAccountId, creditAccountId: ids.paymentAccountId };
}
