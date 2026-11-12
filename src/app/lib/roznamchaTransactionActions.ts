import type { AccountingEntry } from '@/app/context/AccountingContext';
import { allowsGenericAccountingUnifiedEdit } from '@/app/lib/journalEntryEditPolicy';
import type { RoznamchaRow } from '@/app/services/roznamchaService';
import type { TransactionActionRowInput } from '@/app/lib/transactionActionRules';

export function roznamchaRowHasActionTarget(row: RoznamchaRow): boolean {
  return Boolean(
    row.sourceJournalEntryId ||
      row.sourcePaymentId ||
      row.sourceRentalPaymentId ||
      row.paymentIdOnJournal,
  );
}

export function roznamchaRowDetailReference(row: RoznamchaRow): {
  reference: string;
  journalEntryIdHint?: string;
} {
  const jeId = row.sourceJournalEntryId ? String(row.sourceJournalEntryId) : '';
  if (jeId) {
    return { reference: jeId, journalEntryIdHint: jeId };
  }
  const ref = String(row.ref || '').trim();
  if (ref) return { reference: ref };
  if (row.sourcePaymentId) return { reference: row.sourcePaymentId };
  return { reference: row.id };
}

export function buildSyntheticAccountingEntryFromRoznamchaRow(row: RoznamchaRow): AccountingEntry {
  const paymentId = row.sourcePaymentId ?? row.paymentIdOnJournal ?? undefined;
  return {
    id: row.sourceJournalEntryId ?? row.id,
    date: row.date,
    description: row.details,
    amount: row.amount,
    type: row.direction === 'IN' ? 'credit' : 'debit',
    source: 'Roznamcha',
    metadata: {
      referenceType: row.referenceType ?? undefined,
      referenceId: row.referenceId ?? undefined,
      paymentId,
      journalEntryVoid: row.journalIsVoid === true,
      isOrphanReceipt: false,
    },
  };
}

export function buildTransactionActionRowFromRoznamchaRow(row: RoznamchaRow): TransactionActionRowInput {
  const paymentId = row.sourcePaymentId ?? row.paymentIdOnJournal ?? null;
  return {
    id: row.sourceJournalEntryId ?? row.id,
    reference_type: row.referenceType ?? null,
    reference_id: row.referenceId ?? null,
    payment_id: paymentId,
    is_void: row.journalIsVoid === true || row.isVoided === true,
    payment_chain_member_count: 1,
    description: row.details,
  };
}

export function roznamchaAllowsUnifiedEdit(row: RoznamchaRow): boolean {
  return allowsGenericAccountingUnifiedEdit(buildSyntheticAccountingEntryFromRoznamchaRow(row));
}
