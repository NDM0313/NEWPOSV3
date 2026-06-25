import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  balancePasses,
  compareTrialBalancePayloads,
  diffLedgerRows,
  diffTrialBalanceAccounts,
  round2,
} from './unifiedLedgerCompareDiff';

test('balancePasses within tolerance', () => {
  assert.equal(balancePasses(0), true);
  assert.equal(balancePasses(0.01), true);
  assert.equal(balancePasses(0.02), false);
});

test('diffLedgerRows finds missing and extra rows', () => {
  const result = diffLedgerRows({
    oldRows: [{ id: 'a1', je: 'je1' }],
    newRows: [{ id: 'b1', je: 'je2' }],
    oldKey: (r) => r.id,
    newKey: (r) => r.id,
    oldToSummary: (r) => ({
      journalEntryId: r.je,
      entryNo: null,
      entryDate: '2026-01-01',
      referenceType: null,
      debit: 100,
      credit: 0,
      description: 'old',
    }),
    newToSummary: (r) => ({
      journalEntryId: r.je,
      entryNo: null,
      entryDate: '2026-01-01',
      referenceType: null,
      debit: 50,
      credit: 0,
      description: 'new',
    }),
  });
  assert.equal(result.missingInNew.length, 1);
  assert.equal(result.extraInNew.length, 1);
});

test('diffTrialBalanceAccounts detects net mismatch', () => {
  const diffs = diffTrialBalanceAccounts(
    [
      {
        account_id: 'acc-1',
        account_code: '1100',
        account_name: 'AR',
        account_type: 'asset',
        debit: 100,
        credit: 0,
        balance: 100,
      },
    ],
    [
      {
        accountId: 'acc-1',
        accountCode: '1100',
        accountName: 'AR',
        accountType: 'asset',
        totalDebit: 100,
        totalCredit: 0,
        netBalance: 99,
      },
    ]
  );
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].kind, 'net_mismatch');
  assert.equal(round2(diffs[0].difference), 1);
});

test('diffTrialBalanceAccounts passes when nets match', () => {
  const diffs = diffTrialBalanceAccounts(
    [
      {
        account_id: 'acc-1',
        account_code: '1100',
        account_name: 'AR',
        account_type: 'asset',
        debit: 216300,
        credit: 0,
        balance: 216300,
      },
    ],
    [
      {
        accountId: 'acc-1',
        accountCode: '1100',
        accountName: 'AR',
        accountType: 'asset',
        totalDebit: 216300,
        totalCredit: 0,
        netBalance: 216300,
      },
    ]
  );
  assert.equal(diffs.length, 0);
});

test('compareTrialBalancePayloads passes when totals and accounts match', () => {
  const result = compareTrialBalancePayloads({
    oldRows: [
      {
        account_id: 'a1',
        account_code: '1100',
        account_name: 'AR',
        balance: 100,
        debit: 100,
        credit: 0,
      },
    ],
    newAccounts: [
      {
        accountId: 'a1',
        accountCode: '1100',
        accountName: 'AR',
        netBalance: 100,
        totalDebit: 100,
        totalCredit: 0,
      },
    ],
    oldTotals: { totalDebit: 100, totalCredit: 100, difference: 0 },
    newTotals: { totalDebit: 100, totalCredit: 100, difference: 0 },
  });
  assert.equal(result.accountDiffCount, 0);
  assert.equal(result.totalsPass, true);
});
