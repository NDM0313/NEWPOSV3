/** Derived from journal_entries.reference_type (+ payment) for badges and cash flow. */
export type EntrySourceKind =
  | 'sale'
  | 'sale_reversal'
  | 'purchase'
  | 'purchase_reversal'
  | 'payment_supplier'
  | 'payment_worker'
  | 'payment_customer'
  | 'studio_stage'
  | 'studio_stage_reversal'
  | 'rental'
  | 'expense'
  | 'transfer'
  | 'opening_balance'
  | 'sale_return'
  | 'journal_manual'
  | 'general';

export type PaymentType = 'received' | 'paid';

export type CashFlowDirection = 'in' | 'out' | 'neutral';

export function sourceLabel(kind: EntrySourceKind): string {
  const labels: Record<EntrySourceKind, string> = {
    sale: 'Sale',
    sale_reversal: 'Sale cancel',
    purchase: 'Purchase',
    purchase_reversal: 'Purchase cancel',
    payment_supplier: 'Supplier payment',
    payment_worker: 'Worker payment',
    payment_customer: 'Customer receipt',
    studio_stage: 'Studio stage',
    studio_stage_reversal: 'Studio reversal',
    rental: 'Rental',
    expense: 'Expense',
    transfer: 'Transfer',
    opening_balance: 'Opening balance',
    sale_return: 'Sale return',
    journal_manual: 'Manual JE',
    general: 'Journal',
  };
  return labels[kind] ?? 'Journal';
}

function normalizePaymentType(raw: string | null | undefined): PaymentType | null {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'received') return 'received';
  if (v === 'paid') return 'paid';
  return null;
}

function voucherPrefix(refNo: string | null | undefined): string {
  const t = String(refNo || '').trim().toUpperCase();
  const dash = t.indexOf('-');
  return dash > 0 ? t.slice(0, dash + 1) : t;
}

export interface ClassifyJournalSourceInput {
  referenceType: string;
  paymentId?: string | null;
  paymentType?: string | null;
  paymentReferenceNumber?: string | null;
}

/** Classify JE source using payments.payment_type (RCV vs PAY) when linked. */
export function classifyJournalSource(input: ClassifyJournalSourceInput): EntrySourceKind {
  const r = (input.referenceType || '').toLowerCase();
  const hasPay = Boolean(input.paymentId);
  const payType = normalizePaymentType(input.paymentType);
  const refPrefix = voucherPrefix(input.paymentReferenceNumber);

  if (r === 'sale') return 'sale';
  if (r === 'sale_reversal') return 'sale_reversal';
  if (r === 'purchase' || r === 'purchase_order') return 'purchase';
  if (r === 'purchase_reversal' || r === 'purchase_cancel') return 'purchase_reversal';
  if (r === 'worker_payment') return 'payment_worker';
  if (r === 'customer_payment' || r === 'receipt' || r === 'sale_payment') return 'payment_customer';
  if (r === 'studio_production_stage') return 'studio_stage';
  if (r === 'studio_production_stage_reversal') return 'studio_stage_reversal';
  if (r === 'rental' || r === 'rental_payment') return 'rental';
  if (r === 'expense' || r === 'expense_payment') return 'expense';
  if (r === 'transfer') return 'transfer';
  if (r === 'opening_balance' || r === 'opening_stock') return 'opening_balance';
  if (r === 'sale_return') return 'sale_return';
  if (r === 'journal' || r === 'manual_journal' || r === 'general_journal') return 'journal_manual';

  if (hasPay || refPrefix === 'RCV-' || refPrefix === 'PAY-' || refPrefix === 'WPY-') {
    if (payType === 'received' || refPrefix === 'RCV-') return 'payment_customer';
    if (r === 'worker_payment' || refPrefix === 'WPY-') return 'payment_worker';
    if (payType === 'paid' || refPrefix === 'PAY-') return 'payment_supplier';
  }

  if (r === 'payment' || r === 'manual_payment' || r === 'supplier_payment') {
    return hasPay ? 'payment_supplier' : 'general';
  }

  return 'general';
}

export interface ResolveCashFlowInput {
  paymentType?: string | null;
  sourceKind?: EntrySourceKind;
}

/** Cash-in (green) vs cash-out (red) — aligned with transactions.ts payment_type. */
export function resolveCashFlowDirection(input: ResolveCashFlowInput): CashFlowDirection {
  const payType = normalizePaymentType(input.paymentType);
  const k = input.sourceKind;

  if (payType === 'received') return 'in';
  if (payType === 'paid') return 'out';

  if (k === 'sale_reversal' || k === 'purchase_reversal' || k === 'studio_stage_reversal') {
    return 'neutral';
  }
  if (k === 'payment_customer' || k === 'sale') return 'in';
  if (k === 'payment_supplier' || k === 'payment_worker' || k === 'expense' || k === 'purchase') {
    return 'out';
  }
  if (k === 'transfer' || k === 'opening_balance' || k === 'journal_manual' || k === 'general') {
    return 'neutral';
  }
  return 'neutral';
}

export function cashFlowDirectionLabel(direction: CashFlowDirection): string {
  if (direction === 'in') return 'In';
  if (direction === 'out') return 'Out';
  return 'Net';
}
