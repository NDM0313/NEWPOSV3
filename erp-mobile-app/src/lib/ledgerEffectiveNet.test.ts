import assert from 'node:assert/strict';
import test from 'node:test';
import type { LedgerLine } from '../api/reports';
import { effectiveNetLedgerPresentation, filterEffectiveNetLedgerLines } from './ledgerEffectiveNet';

function line(partial: Partial<LedgerLine> & Pick<LedgerLine, 'debit' | 'credit'>): LedgerLine {
  return {
    id: partial.id ?? 'line-1',
    journalEntryId: 'je-1',
    sourceReferenceId: null,
    date: '2026-07-15',
    createdAt: '2026-07-15T10:00:00Z',
    entryNo: 'RCV-0326',
    description: partial.description ?? 'Receipt',
    reference: 'RCV-0326',
    referenceType: partial.referenceType ?? 'manual_receipt',
    debit: partial.debit,
    credit: partial.credit,
    runningBalance: partial.runningBalance ?? 0,
    paymentId: partial.paymentId ?? 'pay-1',
  };
}

test('effective net hides reversal pair and keeps closing balance', () => {
  const opening = 3_709_458;
  const lines = [
    line({ debit: 200_000, credit: 0, runningBalance: 3_909_458, description: 'Earlier receipt', paymentId: 'pay-0' }),
    line({ debit: 0, credit: 200_000, runningBalance: 3_709_458, description: 'Receipt RCV-0326' }),
    line({
      debit: 200_000,
      credit: 0,
      runningBalance: 3_909_458,
      description: 'Reversal of: Receipt RCV-0326',
      referenceType: 'correction_reversal',
      entryNo: 'JE-0323',
    }),
  ];
  const filtered = filterEffectiveNetLedgerLines(lines);
  assert.equal(filtered.length, 1);
  const presented = effectiveNetLedgerPresentation(lines, opening, false);
  assert.equal(presented.closingBalance, 3_909_458);
});
