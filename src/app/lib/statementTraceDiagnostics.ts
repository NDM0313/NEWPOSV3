/**
 * Pure Statement Trace helpers (Phase C3) — read-only, no repairs.
 */
import type { Transaction } from '@/app/services/customerLedgerTypes';
import { defaultRoznamchaTraceDateRange } from '@/app/lib/roznamchaTraceDiagnostics';

export type StatementTraceSource =
  | 'statement_row'
  | 'payment'
  | 'rental_payment'
  | 'rental'
  | 'sale'
  | 'excluded_probe';

export interface StatementTraceCandidateView {
  rowId: string;
  source: StatementTraceSource;
  ref: string;
  date: string;
  documentType: string;
  debit: number;
  credit: number;
  included: boolean;
  reason: string;
  contactId?: string;
  contactName?: string;
}

export function defaultStatementTraceDateRange(todayIso?: string): { dateFrom: string; dateTo: string } {
  return defaultRoznamchaTraceDateRange(todayIso);
}

export function statementRowMatchesQuery(
  row: Pick<Transaction, 'referenceNo' | 'description' | 'notes' | 'documentType'> & {
    linkedPayments?: string[];
    linkedInvoices?: string[];
  },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.referenceNo,
    row.description,
    row.notes,
    row.documentType,
    ...(row.linkedPayments || []),
    ...(row.linkedInvoices || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function mapStatementTransactionToCandidate(
  tx: Transaction,
  contactId: string,
  contactName: string
): StatementTraceCandidateView {
  return {
    rowId: `stmt-${tx.id}`,
    source: 'statement_row',
    ref: tx.referenceNo || '—',
    date: tx.date || '',
    documentType: tx.documentType,
    debit: Number(tx.debit) || 0,
    credit: Number(tx.credit) || 0,
    included: true,
    reason: inclusionReasonForDocumentType(tx.documentType, tx.ledgerPaymentLifecycle),
    contactId,
    contactName,
  };
}

function inclusionReasonForDocumentType(
  documentType: string,
  lifecycle?: Transaction['ledgerPaymentLifecycle']
): string {
  if (lifecycle === 'voided') {
    return 'Shown in audit scope only — live statement excludes voided payments';
  }
  switch (documentType) {
    case 'Rental Payment':
      return 'Included — rental_payments row without GL duplicate (no journal_entry_id skip)';
    case 'Payment':
    case 'On-account Payment':
      return 'Included — payments stream (sale-linked, on_account, or manual_receipt)';
    case 'Rental':
      return 'Included — rental charge debit from customer rentals';
    case 'Sale':
    case 'Studio Sale':
      return 'Included — final sale debit in statement period';
    case 'Opening Balance':
      return 'Included — contact opening balance seed at period start';
    default:
      return `Included — ${documentType} in customerLedgerAPI.getTransactions (live scope)`;
  }
}

export function buildExcludedRentalPaymentCandidate(opts: {
  id: string;
  ref: string;
  date: string;
  amount: number;
  contactId: string;
  contactName: string;
  journalEntryId?: string | null;
  inDateRange: boolean;
}): StatementTraceCandidateView {
  let reason = 'Excluded from party statement';
  if (opts.journalEntryId) {
    reason = 'Excluded — rental_payments.journal_entry_id set; GL-linked receipt (ledger skips duplicate)';
  } else if (!opts.inDateRange) {
    reason = 'Excluded — payment_date outside selected statement range';
  }
  return {
    rowId: `rp-excl-${opts.id}`,
    source: 'excluded_probe',
    ref: opts.ref,
    date: opts.date,
    documentType: 'Rental Payment (probe)',
    debit: 0,
    credit: Number(opts.amount) || 0,
    included: false,
    reason,
    contactId: opts.contactId,
    contactName: opts.contactName,
  };
}

export function buildExcludedVoidPaymentCandidate(opts: {
  id: string;
  ref: string;
  date: string;
  amount: number;
  contactId: string;
  contactName: string;
}): StatementTraceCandidateView {
  return {
    rowId: `pay-void-${opts.id}`,
    source: 'excluded_probe',
    ref: opts.ref,
    date: opts.date,
    documentType: 'Payment (voided)',
    debit: 0,
    credit: Number(opts.amount) || 0,
    included: false,
    reason: 'Excluded — payments.voided_at set; live statement scope hides voided rows',
    contactId: opts.contactId,
    contactName: opts.contactName,
  };
}

export function mergeStatementCandidates(
  included: StatementTraceCandidateView[],
  excluded: StatementTraceCandidateView[]
): StatementTraceCandidateView[] {
  const seen = new Set(included.map((c) => `${c.ref}|${c.date}|${c.credit}|${c.debit}`));
  const out = [...included];
  for (const ex of excluded) {
    const key = `${ex.ref}|${ex.date}|${ex.credit}|${ex.debit}`;
    if (seen.has(key)) continue;
    out.push(ex);
    seen.add(key);
  }
  return out;
}
