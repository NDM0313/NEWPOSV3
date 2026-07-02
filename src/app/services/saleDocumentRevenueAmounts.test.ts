import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertJournalLinesBalanced,
  computeSaleDocumentRevenueAmounts,
} from './saleDocumentRevenueAmounts.ts';

test('SL-0013 pattern: 40k total, 39k items, 1k extra — merchandise pool 39k not 38k', () => {
  const amounts = computeSaleDocumentRevenueAmounts({
    total: 40_000,
    discount: 0,
    extraExpense: 1_000,
    shippingCharges: 0,
  });
  assert.equal(amounts.arDebit, 40_000);
  assert.equal(amounts.merchandisePool, 39_000);
  assert.equal(amounts.extraAmount, 1_000);
  assert.equal(amounts.merchandisePool + amounts.extraAmount, amounts.arDebit);
});

test('subtotal must not drive revenue pool when total includes charged extra', () => {
  const wrongLegacy = 39_000 - 1_000;
  const amounts = computeSaleDocumentRevenueAmounts({
    total: 40_000,
    discount: 0,
    extraExpense: 1_000,
    shippingCharges: 0,
  });
  assert.notEqual(amounts.merchandisePool, wrongLegacy);
});

test('assertJournalLinesBalanced rejects double-subtracted extra pattern', () => {
  assert.throws(
    () =>
      assertJournalLinesBalanced(
        [
          { debit: 40_000, credit: 0 },
          { debit: 19_100, credit: 0 },
          { debit: 0, credit: 38_000 },
          { debit: 0, credit: 19_100 },
          { debit: 0, credit: 1_000 },
        ],
        'SL-0013 bad post'
      ),
    /unbalanced/i
  );
});

test('assertJournalLinesBalanced accepts correct 4120 split', () => {
  assert.doesNotThrow(() =>
    assertJournalLinesBalanced(
      [
        { debit: 40_000, credit: 0 },
        { debit: 19_100, credit: 0 },
        { debit: 0, credit: 39_000 },
        { debit: 0, credit: 19_100 },
        { debit: 0, credit: 1_000 },
      ],
      'SL-0013 good post'
    )
  );
});
