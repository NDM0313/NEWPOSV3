import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapUnifiedRowsToCashFlowPreview } from './cashFlowUnifiedPreviewMapper';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

function row(partial: Partial<UnifiedLedgerRow> & Pick<UnifiedLedgerRow, 'debit' | 'credit'>): UnifiedLedgerRow {
  return {
    journalEntryLineId: partial.journalEntryLineId ?? 'jel-1',
    journalEntryId: partial.journalEntryId ?? 'je-1',
    entryDate: partial.entryDate ?? '2026-06-01',
    entryNo: partial.entryNo ?? 'JE-1',
    referenceType: partial.referenceType ?? 'payment',
    description: partial.description ?? 'test',
    debit: partial.debit,
    credit: partial.credit,
    runningBalance: partial.runningBalance ?? 0,
    periodOpeningBalance: partial.periodOpeningBalance ?? 0,
    paymentId: partial.paymentId ?? null,
    branchId: partial.branchId ?? null,
    branchName: partial.branchName ?? null,
    accountCode: partial.accountCode ?? '1010',
    accountName: partial.accountName ?? 'Cash',
    partyResolved: partial.partyResolved ?? null,
  };
}

test('mapUnifiedRowsToCashFlowPreview computes summary from unified rows', () => {
  const result = mapUnifiedRowsToCashFlowPreview({
    openingBalance: 1000,
    sourceModuleFilter: 'all',
    auditMode: false,
    unifiedRows: [
      row({ debit: 500, credit: 0, referenceType: 'payment' }),
      row({ journalEntryLineId: 'jel-2', debit: 0, credit: 200, referenceType: 'expense' }),
    ],
  });
  assert.equal(result.previewOnly, true);
  assert.equal(result.needsFinanceGoldenApproval, true);
  assert.equal(result.summary.opening, 1000);
  assert.equal(result.summary.cashIn, 500);
  assert.equal(result.summary.cashOut, 200);
  assert.equal(result.summary.netMovement, 300);
  assert.equal(result.summary.closing, 1300);
  assert.equal(result.rowCount, 2);
});

test('mapUnifiedRowsToCashFlowPreview applies source module filter', () => {
  const result = mapUnifiedRowsToCashFlowPreview({
    openingBalance: 0,
    sourceModuleFilter: 'expenses',
    auditMode: false,
    unifiedRows: [
      row({ debit: 500, credit: 0, referenceType: 'payment' }),
      row({ journalEntryLineId: 'jel-2', debit: 0, credit: 200, referenceType: 'expense' }),
    ],
  });
  assert.equal(result.rowCount, 1);
  assert.equal(result.summary.cashOut, 200);
  assert.equal(result.summary.cashIn, 0);
});
