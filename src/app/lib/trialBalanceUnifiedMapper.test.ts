import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapUnifiedAccountToTrialBalanceRow } from './trialBalanceUnifiedMapper';
import type { UnifiedTrialBalanceAccount } from '@/app/services/unifiedLedgerService';

test('mapUnifiedAccountToTrialBalanceRow maps unified fields to TB row', () => {
  const acc: UnifiedTrialBalanceAccount = {
    accountId: 'a1',
    accountCode: '1100',
    accountName: 'Accounts Receivable',
    accountType: 'asset',
    totalDebit: 1000,
    totalCredit: 200,
    netBalance: 800,
  };
  const row = mapUnifiedAccountToTrialBalanceRow(acc);
  assert.equal(row.account_id, 'a1');
  assert.equal(row.account_code, '1100');
  assert.equal(row.account_name, 'Accounts Receivable');
  assert.equal(row.account_type, 'asset');
  assert.equal(row.debit, 1000);
  assert.equal(row.credit, 200);
  assert.equal(row.balance, 800);
});
