import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RoznamchaResult } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import { compareRoznamchaUnifiedPreview } from './roznamchaUnifiedPreviewDiff';

function legacyFixture(): RoznamchaResult {
  return {
    rows: [
      {
        id: 'pay:1',
        date: '2026-01-10',
        time: '10:00',
        ref: 'RCV-1',
        details: 'Sale',
        referenceDisplay: '',
        createdBy: null,
        cashIn: 1000,
        cashOut: 0,
        direction: 'IN',
        amount: 1000,
        accountType: 'cash',
        accountLabel: 'Cash',
        branchId: null,
        type: 'Cash Sale',
        runningBalance: 1000,
      },
    ],
    summary: {
      openingBalance: 0,
      cashIn: 1000,
      cashOut: 0,
      closingBalance: 1000,
    },
    cashSplit: { cash: 1000, bank: 0, wallet: 0, total: 1000 },
  };
}

function unifiedRows(): UnifiedLedgerRow[] {
  return [
    {
      journalEntryLineId: 'jel-1',
      journalEntryId: 'je-1',
      entryDate: '2026-01-10',
      entryNo: 'JE-1',
      referenceType: 'payment',
      description: 'Sale',
      debit: 1000,
      credit: 0,
      runningBalance: 1000,
      periodOpeningBalance: 0,
      branchId: null,
      branchName: null,
      accountCode: '1000',
      accountName: 'Cash',
      partyResolved: null,
      paymentId: null,
    },
  ];
}

test('compareRoznamchaUnifiedPreview passes when closing and totals match', () => {
  const diff = compareRoznamchaUnifiedPreview({
    legacy: legacyFixture(),
    unifiedRows: unifiedRows(),
    unifiedClosingBalance: 1000,
    unifiedOpeningBalance: 0,
  });
  assert.equal(diff.pass, false);
  assert.equal(diff.totalsPass, true);
  assert.equal(diff.oldClosing, 1000);
  assert.equal(diff.newClosing, 1000);
});

test('compareRoznamchaUnifiedPreview fails when closing differs', () => {
  const diff = compareRoznamchaUnifiedPreview({
    legacy: legacyFixture(),
    unifiedRows: unifiedRows(),
    unifiedClosingBalance: 999,
    unifiedOpeningBalance: 0,
  });
  assert.equal(diff.pass, false);
  assert.equal(diff.totalsPass, false);
});
