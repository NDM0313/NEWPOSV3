import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mapUnifiedLedgerToRoznamchaResult,
  mapUnifiedRowToRoznamchaPreview,
} from './roznamchaUnifiedMapper';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

test('mapUnifiedRowToRoznamchaPreview maps cash in/out from debit/credit', () => {
  const row = mapUnifiedRowToRoznamchaPreview({
    journalEntryLineId: 'jel-1',
    journalEntryId: 'je-1',
    entryDate: '2026-03-01',
    entryNo: 'JE-50',
    referenceType: 'payment',
    description: 'Customer receipt',
    debit: 1000,
    credit: 0,
    runningBalance: 5000,
    accountCode: '1010',
    accountName: 'HBL Main',
  } as UnifiedLedgerRow);
  assert.equal(row.cashIn, 1000);
  assert.equal(row.cashOut, 0);
  assert.equal(row.accountLabel, 'HBL Main');
  assert.equal(row.runningBalance, 5000);
});

test('mapUnifiedLedgerToRoznamchaResult returns rows key for main table', () => {
  const result = mapUnifiedLedgerToRoznamchaResult([
    {
      journalEntryLineId: 'jel-1',
      journalEntryId: 'je-1',
      entryDate: '2026-03-01',
      entryNo: 'JE-50',
      referenceType: 'payment',
      description: 'Customer receipt',
      debit: 1000,
      credit: 0,
      runningBalance: 1500,
      periodOpeningBalance: 500,
      paymentId: 'pay-1',
      branchId: null,
      branchName: null,
      accountCode: '1010',
      accountName: 'HBL Main',
      partyResolved: 'Ahmed',
    },
  ] as UnifiedLedgerRow[], 500);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.runningBalance, 1500);
  assert.equal(result.summary.openingBalance, 500);
  assert.equal(result.summary.cashIn, 1000);
  assert.equal(result.summary.cashOut, 0);
  assert.equal(result.summary.closingBalance, 1500);
});
