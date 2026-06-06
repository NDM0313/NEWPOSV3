import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canApplyDeveloperRepair } from './developerAccountingAccess';
import {
  amountsMatch,
  blockCrossCompany,
  pickSingleLiquidityLine,
} from './paymentJournalRepairEligibility';

test('canApplyDeveloperRepair allows developer and super-admin variants', () => {
  assert.equal(canApplyDeveloperRepair('developer'), true);
  assert.equal(canApplyDeveloperRepair('super_admin'), true);
  assert.equal(canApplyDeveloperRepair('superadmin'), true);
  assert.equal(canApplyDeveloperRepair('admin'), false);
  assert.equal(canApplyDeveloperRepair('accounting_auditor'), false);
});

test('pickSingleLiquidityLine requires exactly one liquidity line', () => {
  const acc = { code: '1000', type: 'cash', name: 'Cash' };
  assert.equal(
    pickSingleLiquidityLine(
      [
        { accountId: '1', debit: 100, credit: 0, amount: 100, account: acc },
        { accountId: '2', debit: 0, credit: 100, amount: 100, account: acc },
      ],
      100
    ),
    null
  );
  const one = pickSingleLiquidityLine(
    [{ accountId: '1', debit: 100, credit: 0, amount: 100, account: acc }],
    100
  );
  assert.equal(one?.accountId, '1');
});

test('blockCrossCompany rejects mismatch', () => {
  assert.match(blockCrossCompany('other-co', 'my-co') || '', /Cross-company/);
  assert.equal(blockCrossCompany('my-co', 'my-co'), null);
});

test('amountsMatch within epsilon', () => {
  assert.equal(amountsMatch(100, 100.01), true);
  assert.equal(amountsMatch(100, 50), false);
});
