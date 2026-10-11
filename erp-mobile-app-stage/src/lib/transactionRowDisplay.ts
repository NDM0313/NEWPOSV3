import type { TransactionRow } from '../api/transactions';

const CONTROL_ACCOUNT_PATTERNS = [
  /^accounts?\s+receivable$/i,
  /^accounts?\s+payable$/i,
  /^trade\s+debtors?$/i,
  /^trade\s+creditors?$/i,
];

const CONTROL_ACCOUNT_CODES = new Set(['1100', '1200', '2100', '2000']);

function isExpenseReference(refType: string): boolean {
  const rt = refType.toLowerCase();
  return rt === 'expense' || rt === 'expense_payment';
}

export function isControlAccountDisplay(name: string | null | undefined, code?: string | null): boolean {
  const n = String(name || '').trim();
  if (!n) return false;
  const c = String(code || '').trim();
  if (c && CONTROL_ACCOUNT_CODES.has(c)) return true;
  return CONTROL_ACCOUNT_PATTERNS.some((re) => re.test(n));
}

function leafAccountName(
  name: string | null | undefined,
  code?: string | null,
): string | null {
  const n = String(name || '').trim();
  if (!n || isControlAccountDisplay(n, code)) return null;
  return n;
}

/** Primary title: contact name, expense category path, or leaf account — not AR/AP parent. */
export function transactionPrimaryTitle(tx: TransactionRow): string {
  if (isExpenseReference(tx.referenceType)) {
    const cat = tx.expenseCategoryLabel?.trim();
    if (cat) return cat;
    const notes = tx.notes?.trim();
    if (notes && !isControlAccountDisplay(notes)) return notes;
  }

  const party = tx.partyName?.trim();
  if (party) return party;

  const partyAcc = leafAccountName(tx.partyAccountName);
  if (partyAcc) return partyAcc;

  const payAcc = leafAccountName(tx.paymentAccountName);
  if (payAcc) return payAcc;

  const notes = tx.notes?.trim();
  if (notes) return notes;

  return tx.referenceType.replace(/_/g, ' ');
}

function partySideLabel(tx: TransactionRow): string {
  const party = tx.partyName?.trim();
  if (party) return party;
  const acc = leafAccountName(tx.partyAccountName);
  if (acc) return acc;
  if (isExpenseReference(tx.referenceType) && tx.expenseCategoryLabel?.trim()) {
    return tx.expenseCategoryLabel.trim();
  }
  return tx.partyAccountName?.trim() || '—';
}

function paymentSideLabel(tx: TransactionRow): string {
  return tx.paymentAccountName?.trim() || '—';
}

/** From → To labels for payment rows. */
export function transactionFromToLabels(
  tx: TransactionRow,
  isReceived: boolean,
  isTransferLike: boolean,
): { from: string; to: string } {
  if (isTransferLike) {
    return {
      from: paymentSideLabel(tx),
      to: partySideLabel(tx) !== '—' ? partySideLabel(tx) : tx.partyAccountName?.trim() || '—',
    };
  }
  if (isReceived) {
    return { from: paymentSideLabel(tx), to: partySideLabel(tx) };
  }
  return { from: partySideLabel(tx), to: paymentSideLabel(tx) };
}
