import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapUnifiedRowsToCashFlowMain } from './cashFlowUnifiedMainMapper';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

function row(partial: Partial<UnifiedLedgerRow> & Pick<UnifiedLedgerRow, 'journalEntryLineId'>): UnifiedLedgerRow {
  return {
    journalEntryId: partial.journalEntryId ?? 'je-1',
    entryDate: partial.entryDate ?? '2026-01-15',
    entryNo: partial.entryNo ?? 'JE-1',
    referenceType: partial.referenceType ?? 'payment',
    description: partial.description ?? 'Test',
    debit: partial.debit ?? 0,
    credit: partial.credit ?? 0,
    runningBalance: partial.runningBalance ?? 0,
    periodOpeningBalance: partial.periodOpeningBalance ?? 0,
    paymentId: partial.paymentId ?? null,
    branchId: partial.branchId ?? null,
    branchName: partial.branchName ?? null,
    accountCode: partial.accountCode ?? '1001',
    accountName: partial.accountName ?? 'Cash',
    partyResolved: partial.partyResolved ?? null,
    journalEntryLineId: partial.journalEntryLineId,
  };
}

test('mapUnifiedRowsToCashFlowMain computes finance-aligned summary', () => {
  const result = mapUnifiedRowsToCashFlowMain({
    unifiedRows: [
      row({ journalEntryLineId: 'l1', debit: 1000, credit: 0 }),
      row({ journalEntryLineId: 'l2', debit: 0, credit: 200, referenceType: 'transfer' }),
    ],
    openingBalance: 500,
    sourceModuleFilter: 'all',
    auditMode: false,
  });
  assert.equal(result.unifiedMain, true);
  assert.equal(result.summary.opening, 500);
  assert.equal(result.summary.cashIn, 1000);
  assert.equal(result.summary.cashOut, 0);
  assert.equal(result.summary.closing, 1500);
  assert.equal(result.rows.length, 1);
});

test('mapUnifiedRowsToCashFlowMain audit mode includes transfer rows', () => {
  const result = mapUnifiedRowsToCashFlowMain({
    unifiedRows: [
      row({ journalEntryLineId: 'l1', debit: 1000, credit: 0 }),
      row({ journalEntryLineId: 'l2', debit: 0, credit: 200, referenceType: 'transfer' }),
    ],
    openingBalance: 0,
    sourceModuleFilter: 'all',
    auditMode: true,
  });
  assert.equal(result.rows.length, 2);
  assert.equal(result.summary.cashOut, 200);
});
