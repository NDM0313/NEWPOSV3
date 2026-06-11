import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  roznamchaLiquidityLineDirection,
  roznamchaPaymentDirection,
} from './roznamchaExpenseRules.ts';

describe('roznamcha expense direction', () => {
  it('forces expense payments to OUT even when payment_type is received', () => {
    assert.equal(roznamchaPaymentDirection('expense', 'received'), 'OUT');
    assert.equal(roznamchaPaymentDirection('expense', 'paid'), 'OUT');
  });

  it('keeps non-expense payment direction from payment_type', () => {
    assert.equal(roznamchaPaymentDirection('sale', 'received'), 'IN');
    assert.equal(roznamchaPaymentDirection('purchase', 'paid'), 'OUT');
  });

  it('maps expense JE credit on cash/wallet to OUT', () => {
    assert.equal(roznamchaLiquidityLineDirection('expense', 0, 2800), 'OUT');
  });

  it('maps expense JE debit on cash to IN (mis-posted legacy)', () => {
    assert.equal(roznamchaLiquidityLineDirection('expense', 2800, 0), 'IN');
  });

  it('maps standard journal debit/credit for non-expense', () => {
    assert.equal(roznamchaLiquidityLineDirection('manual_receipt', 500, 0), 'IN');
    assert.equal(roznamchaLiquidityLineDirection('manual_payment', 0, 500), 'OUT');
  });
});
