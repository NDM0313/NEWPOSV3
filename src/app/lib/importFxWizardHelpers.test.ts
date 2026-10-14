import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suggestedChinaSettleAmountPkr } from './importFxWizardHelpers';

test('suggestedChinaSettleAmountPkr: credit 86250 vs full purchase due → 86250', () => {
  assert.equal(
    suggestedChinaSettleAmountPkr({ creditAmountPkr: 86250, purchaseDue: 8669795.88 }),
    86250
  );
});

test('suggestedChinaSettleAmountPkr: credit > due → due', () => {
  assert.equal(
    suggestedChinaSettleAmountPkr({ creditAmountPkr: 100000, purchaseDue: 50000 }),
    50000
  );
});

test('suggestedChinaSettleAmountPkr: zero credit falls back to due', () => {
  assert.equal(suggestedChinaSettleAmountPkr({ creditAmountPkr: 0, purchaseDue: 1000 }), 1000);
});

test('suggestedChinaSettleAmountPkr: both zero → 0', () => {
  assert.equal(suggestedChinaSettleAmountPkr({ creditAmountPkr: 0, purchaseDue: 0 }), 0);
});
