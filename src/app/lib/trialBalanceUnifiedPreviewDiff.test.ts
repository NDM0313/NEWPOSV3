import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TrialBalanceResult } from '@/app/services/accountingReportsService';
import { compareTrialBalanceUnifiedPreview } from './trialBalanceUnifiedPreviewDiff';
import type { UnifiedTrialBalanceAccount } from '@/app/services/unifiedLedgerService';

function legacyFixture(overrides?: Partial<TrialBalanceResult>): TrialBalanceResult {
  return {
    rows: [
      {
        account_id: 'a1',
        account_code: '1000',
        account_name: 'Cash',
        account_type: 'asset',
        debit: 500,
        credit: 0,
        balance: 500,
      },
      {
        account_id: 'a2',
        account_code: '3000',
        account_name: 'Equity',
        account_type: 'equity',
        debit: 0,
        credit: 500,
        balance: -500,
      },
    ],
    totalDebit: 500,
    totalCredit: 500,
    difference: 0,
    ...overrides,
  };
}

function unifiedAccounts(): UnifiedTrialBalanceAccount[] {
  return [
    {
      accountId: 'a1',
      accountCode: '1000',
      accountName: 'Cash',
      accountType: 'asset',
      totalDebit: 500,
      totalCredit: 0,
      netBalance: 500,
    },
    {
      accountId: 'a2',
      accountCode: '3000',
      accountName: 'Equity',
      accountType: 'equity',
      totalDebit: 0,
      totalCredit: 500,
      netBalance: -500,
    },
  ];
}

test('compareTrialBalanceUnifiedPreview passes on balanced matching fixture', () => {
  const diff = compareTrialBalanceUnifiedPreview({
    legacy: legacyFixture(),
    unifiedAccounts: unifiedAccounts(),
    unifiedTotalDebit: 500,
    unifiedTotalCredit: 500,
    unifiedDifference: 0,
  });
  assert.equal(diff.pass, true);
  assert.equal(diff.accountDiffs.length, 0);
  assert.equal(diff.totalsPass, true);
});

test('compareTrialBalanceUnifiedPreview fails when account net differs', () => {
  const accounts = unifiedAccounts();
  accounts[0] = { ...accounts[0], netBalance: 499 };
  const diff = compareTrialBalanceUnifiedPreview({
    legacy: legacyFixture(),
    unifiedAccounts: accounts,
    unifiedTotalDebit: 500,
    unifiedTotalCredit: 500,
    unifiedDifference: 0,
  });
  assert.equal(diff.pass, false);
  assert.ok(diff.accountDiffs.length > 0);
});

test('compareTrialBalanceUnifiedPreview fails when totals differ', () => {
  const diff = compareTrialBalanceUnifiedPreview({
    legacy: legacyFixture(),
    unifiedAccounts: unifiedAccounts(),
    unifiedTotalDebit: 501,
    unifiedTotalCredit: 500,
    unifiedDifference: 1,
  });
  assert.equal(diff.totalsPass, false);
  assert.equal(diff.pass, false);
});
