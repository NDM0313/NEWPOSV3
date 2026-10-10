import { describe, expect, it } from 'vitest';
import {
  extractPureJournalFormFromLines,
  journalEntryDateTimeFromRow,
} from './pureJournalFormFromEntry';

describe('pureJournalFormFromEntry', () => {
  it('maps debit/credit lines to form fields', () => {
    const form = extractPureJournalFormFromLines([
      { account_id: 'debit-id', debit: 500000, credit: 0 },
      { account_id: 'credit-id', debit: 0, credit: 500000 },
    ]);
    expect(form).toEqual({
      debitAccountId: 'debit-id',
      creditAccountId: 'credit-id',
      amount: 500000,
    });
  });

  it('maps internal transfer lines (to=debit, from=credit)', () => {
    const form = extractPureJournalFormFromLines([
      { account_id: 'wali-tt-id', debit: 1200000, credit: 0 },
      { account_id: 'fhd-mz-id', debit: 0, credit: 1200000 },
    ]);
    expect(form).toEqual({
      debitAccountId: 'wali-tt-id',
      creditAccountId: 'fhd-mz-id',
      amount: 1200000,
    });
  });

  it('returns null for unbalanced or missing lines', () => {
    expect(extractPureJournalFormFromLines([{ account_id: 'a', debit: 100, credit: 0 }])).toBeNull();
    expect(extractPureJournalFormFromLines([])).toBeNull();
  });

  it('builds picker datetime from entry_date and created_at on same day', () => {
    const value = journalEntryDateTimeFromRow({
      entry_date: '2026-07-04',
      created_at: '2026-07-04T14:30:00+05:00',
    });
    expect(value.startsWith('2026-07-04T')).toBe(true);
    expect(value).toContain('14:30');
  });
});
