import { describe, expect, it } from 'vitest';
import { realignAccountLedgerRunningBalances } from '@/app/lib/ledgerStatementV2UnifiedMapper';
import type { LedgerStatementV2Row } from '@/app/features/ledger-statement-center-v2/types';

function v2Row(partial: Partial<LedgerStatementV2Row>): LedgerStatementV2Row {
  return {
    id: partial.id || 'row-1',
    journalEntryId: partial.journalEntryId || 'je-1',
    date: partial.date || '2026-07-01',
    referenceNo: partial.referenceNo || 'JE-1',
    transactionType: partial.transactionType || 'journal',
    description: partial.description || '—',
    branch: partial.branch || '—',
    debit: partial.debit ?? 0,
    credit: partial.credit ?? 0,
    runningBalance: partial.runningBalance ?? 0,
    paymentMethod: partial.paymentMethod || '—',
    createdBy: partial.createdBy || '—',
    hasAttachments: partial.hasAttachments ?? false,
    sourceKind: partial.sourceKind || 'journal',
  };
}

describe('realignAccountLedgerRunningBalances', () => {
  it('recomputes running balance from period opening and movements', () => {
    const rows = [
      v2Row({ id: 'a', debit: 500000, credit: 0, runningBalance: 999 }),
      v2Row({ id: 'b', debit: 500000, credit: 0, runningBalance: 999 }),
      v2Row({ id: 'c', debit: 0, credit: 500000, runningBalance: 999 }),
    ];
    const aligned = realignAccountLedgerRunningBalances(rows, 0);
    expect(aligned.map((r) => r.runningBalance)).toEqual([500000, 1000000, 500000]);
  });
});
