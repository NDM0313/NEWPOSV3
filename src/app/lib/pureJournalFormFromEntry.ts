import { paymentPickerValueFromRow } from '@/app/utils/transactionEventDateTime';

export type PureJournalFormFields = {
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
};

export type JournalEntryLineLike = {
  account_id?: string | null;
  debit?: number | null;
  credit?: number | null;
};

/** Map two-line manual journal → Add Entry V2 pure_journal form fields. */
export function extractPureJournalFormFromLines(
  lines: JournalEntryLineLike[] | null | undefined,
): PureJournalFormFields | null {
  if (!lines || lines.length < 2) return null;
  const debitLine = lines.find((l) => Number(l.debit) > 0);
  const creditLine = lines.find((l) => Number(l.credit) > 0);
  if (!debitLine?.account_id || !creditLine?.account_id) return null;
  const amount = Number(debitLine.debit) || Number(creditLine.credit) || 0;
  if (amount <= 0) return null;
  return {
    debitAccountId: String(debitLine.account_id),
    creditAccountId: String(creditLine.account_id),
    amount,
  };
}

/** DateTimePicker value from journal_entries.entry_date + created_at. */
export function journalEntryDateTimeFromRow(entry: {
  entry_date?: string | null;
  created_at?: string | null;
}): string {
  return paymentPickerValueFromRow(entry.entry_date, entry.created_at);
}
