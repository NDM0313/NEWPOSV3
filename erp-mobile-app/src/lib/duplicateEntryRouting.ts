import type { EntrySourceKind } from './cashFlowDirection';

/** Avoid importing React components into this pure routing helper. */
export type GeneralEntrySeedShape = {
  debitAccountId?: string;
  debitAccountName?: string;
  creditAccountId?: string;
  creditAccountName?: string;
  amount?: number;
  date?: string;
  userNotes?: string;
  reference?: string;
  startAtDetails?: boolean;
};

export type DuplicateTargetView =
  | 'general-entry'
  | 'account-transfer'
  | 'supplier-payment'
  | 'client-payment'
  | 'worker-payment'
  | 'expense-entry';

/** Map journal sourceKind → create flow. Never use coarse AccountEntry.type. */
export function duplicateViewForSourceKind(
  kind: EntrySourceKind | undefined | null,
): DuplicateTargetView | null {
  switch (kind) {
    case 'payment_customer':
      return 'client-payment';
    case 'payment_supplier':
      return 'supplier-payment';
    case 'journal_manual':
    case 'general':
      return 'general-entry';
    case 'transfer':
      return 'account-transfer';
    case 'payment_worker':
      return 'worker-payment';
    case 'expense':
      return 'expense-entry';
    default:
      return null;
  }
}

export interface JournalLineLike {
  account_id?: string | null;
  debit?: number | null;
  credit?: number | null;
  account?: { name?: string | null; code?: string | null } | null;
}

export function buildGeneralEntrySeedFromJournalLines(
  lines: JournalLineLike[] | undefined | null,
  opts?: { amount?: number; date?: string },
): GeneralEntrySeedShape | null {
  const raw = lines ?? [];
  const debitLine = raw.find((l) => Number(l.debit || 0) > 0);
  const creditLine = raw.find((l) => Number(l.credit || 0) > 0);
  if (!debitLine?.account_id || !creditLine?.account_id) return null;
  const debitAmt = Number(debitLine.debit || 0);
  const creditAmt = Number(creditLine.credit || 0);
  const amount = opts?.amount && opts.amount > 0 ? opts.amount : Math.max(debitAmt, creditAmt);
  return {
    debitAccountId: String(debitLine.account_id),
    debitAccountName: String(debitLine.account?.name ?? '').trim() || 'Account',
    creditAccountId: String(creditLine.account_id),
    creditAccountName: String(creditLine.account?.name ?? '').trim() || 'Account',
    amount: amount > 0 ? amount : 0,
    date: opts?.date,
    startAtDetails: true,
  };
}

/** Transfer: credit = from (OUT), debit = to (IN). */
export function buildTransferSeedFromJournalLines(
  lines: JournalLineLike[] | undefined | null,
  opts?: { amount?: number; date?: string },
): {
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  date?: string;
} | null {
  const seed = buildGeneralEntrySeedFromJournalLines(lines, opts);
  if (!seed?.debitAccountId || !seed.creditAccountId) return null;
  return {
    fromAccountId: seed.creditAccountId,
    fromAccountName: seed.creditAccountName ?? '',
    toAccountId: seed.debitAccountId,
    toAccountName: seed.debitAccountName ?? '',
    amount: seed.amount ?? 0,
    date: opts?.date,
  };
}
