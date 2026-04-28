/**
 * Read-only presentation helpers: from/to flow, badges, economic meaning.
 * Does not change posting — labels and UX only.
 */

import {
  journalEntryPresentationFromHeader,
  presentationLabel,
  type JournalLinePresentationKind,
} from '@/app/lib/journalLinePresentation';

/** Product-facing badge (extends PF-14 classification with manual / repair hints). */
export type AccountFlowBadgeKind =
  | 'primary'
  | 'amount_delta'
  | 'liquidity_transfer'
  | 'reversal'
  | 'manual'
  | 'historical_repair'
  | 'journal_standard';

export type AccountFlowLineInput = {
  debit: number;
  credit: number;
  /** Name of the GL line for the viewed row (this book). */
  account_name?: string | null;
  counter_account?: string | null;
  description?: string | null;
  je_reference_type?: string | null;
  je_action_fingerprint?: string | null;
  ledger_kind?: string | null;
  document_type?: string | null;
  source_module?: string | null;
};

export function looksLikeHistoricalRepair(description: string | null | undefined): boolean {
  const d = String(description || '').toLowerCase();
  return (
    /\brepair\b/.test(d) ||
    /\blive sql\b/.test(d) ||
    /\bpf-14 repair\b/.test(d) ||
    /\bcorrective\b/.test(d)
  );
}

export function presentationKindForLine(e: AccountFlowLineInput): JournalLinePresentationKind {
  if (e.ledger_kind === 'reversal' || String(e.document_type || '').toLowerCase().includes('reversal')) {
    return 'reversal';
  }
  return journalEntryPresentationFromHeader(e.je_reference_type ?? null, e.je_action_fingerprint ?? null);
}

/** Map PF-14 / journal kind → product badge (Truth Lab + statements). */
export function classifyAccountFlowBadge(
  e: AccountFlowLineInput,
  pres: JournalLinePresentationKind
): AccountFlowBadgeKind {
  if (looksLikeHistoricalRepair(e.description)) return 'historical_repair';
  if (pres === 'reversal' || e.ledger_kind === 'reversal') return 'reversal';
  const rt = String(e.je_reference_type || '').toLowerCase();
  if (rt === 'journal' || rt === 'opening_balance' || rt.startsWith('opening_balance')) return 'manual';
  if (pres === 'liquidity_transfer') return 'liquidity_transfer';
  if (pres === 'amount_delta' || pres === 'sale_edit' || pres === 'purchase_edit') return 'amount_delta';
  if (pres === 'business_primary') return 'primary';
  return 'journal_standard';
}

export function accountFlowBadgeLabel(kind: AccountFlowBadgeKind): string {
  switch (kind) {
    case 'primary':
      return 'Primary';
    case 'amount_delta':
      return 'Amount delta (PF-14)';
    case 'liquidity_transfer':
      return 'Account transfer (PF-14)';
    case 'reversal':
      return 'Reversal';
    case 'manual':
      return 'Manual';
    case 'historical_repair':
      return 'Historical repair';
    default:
      return 'Journal';
  }
}

export function accountFlowBadgeClass(kind: AccountFlowBadgeKind): string {
  switch (kind) {
    case 'primary':
      return 'border-emerald-700/50 text-emerald-200/90 bg-emerald-950/20';
    case 'amount_delta':
      return 'border-amber-600/50 text-amber-200/90 bg-amber-950/20';
    case 'liquidity_transfer':
      return 'border-sky-600/50 text-sky-300/95 bg-sky-950/20';
    case 'reversal':
      return 'border-rose-700/50 text-rose-200/90 bg-rose-950/20';
    case 'manual':
      return 'border-violet-600/50 text-violet-200/90 bg-violet-950/20';
    case 'historical_repair':
      return 'border-orange-600/50 text-orange-200/90 bg-orange-950/20';
    default:
      return 'border-gray-700 text-gray-400 bg-gray-950/40';
  }
}

/**
 * For one ledger line on account A: debit increases A → flow from counterparty into A; credit decreases A → from A to counterparty.
 */
export function deriveFromToForLedgerLine(e: AccountFlowLineInput): { from: string; to: string } {
  const thisAcc = String(e.account_name || '').trim() || 'This account';
  const counter = String(e.counter_account || '').trim() || '—';
  const dr = Number(e.debit || 0);
  const cr = Number(e.credit || 0);
  if (dr > 0) {
    return { from: counter, to: thisAcc };
  }
  if (cr > 0) {
    return { from: thisAcc, to: counter };
  }
  return { from: thisAcc, to: counter };
}

export function netEconomicMeaning(e: AccountFlowLineInput, pres: JournalLinePresentationKind): string {
  const rt = String(e.je_reference_type || '').toLowerCase();
  const sm = String(e.source_module || '');
  if (looksLikeHistoricalRepair(e.description)) {
    return 'Historical corrective / repair posting';
  }
  if (pres === 'reversal' || e.ledger_kind === 'reversal') {
    return 'Reversal of prior posting';
  }
  if (pres === 'liquidity_transfer') {
    return 'Liquidity account changed (settlement path moved)';
  }
  if (pres === 'amount_delta') {
    return 'Amount edited (PF-14 delta)';
  }
  if (rt === 'manual_receipt') {
    return 'Receipt from customer';
  }
  if (rt === 'manual_payment') {
    return 'Supplier payment';
  }
  if (rt === 'on_account') {
    return 'Receipt from customer';
  }
  if (rt === 'sale') {
    return 'Sale / customer-side posting';
  }
  if (rt === 'purchase') {
    return 'Purchase / supplier-side posting';
  }
  if (rt === 'payment') {
    if (sm === 'Sales') return 'Receipt from customer';
    if (sm === 'Purchase' || sm === 'Purchases') return 'Supplier payment';
    return 'Payment settlement';
  }
  if (rt === 'expense' || rt === 'extra_expense') {
    return 'Expense recognition';
  }
  if (rt === 'journal') {
    return 'Manual journal';
  }
  if (pres === 'business_primary') {
    return 'Business document posting';
  }
  return 'GL movement';
}

export function editTargetTypeLabel(jeReferenceType: string | null | undefined): string {
  const t = String(jeReferenceType || '').toLowerCase();
  if (t === 'payment_adjustment' || t === 'manual_receipt' || t === 'manual_payment' || t === 'on_account') {
    return 'Payment';
  }
  if (t === 'sale' || t === 'sale_adjustment') return 'Sale';
  if (t === 'purchase' || t === 'purchase_adjustment') return 'Purchase';
  if (t === 'expense' || t === 'extra_expense') return 'Expense';
  if (t === 'rental') return 'Rental';
  if (t === 'journal') return 'Manual JE';
  if (t === 'correction_reversal') return 'Reversal';
  return t ? t.replace(/_/g, ' ') : '—';
}

export function sourceTypeDisplayModule(jeReferenceType: string | null | undefined, sourceModule?: string | null): string {
  if (sourceModule && String(sourceModule).trim()) return String(sourceModule);
  return editTargetTypeLabel(jeReferenceType);
}

export { presentationLabel };
