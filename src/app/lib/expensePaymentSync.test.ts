import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  amountsClose,
  detectExpensePaymentAmountMismatch,
  expensePaymentRepairPassesMinMismatch,
  expensePaymentRepairSearchIsTargeted,
  expensePaymentMismatchAmount,
} from './expensePaymentSyncLogic.ts';

describe('expensePaymentSync', () => {
  it('detects stale payment when JE and expense match (EXP-0021 class)', () => {
    const r = detectExpensePaymentAmountMismatch({
      expenseAmount: 7000,
      paymentAmount: 13500,
      jeLiquidityAmount: 7000,
    });
    assert.equal(r.hasMismatch, true);
    assert.equal(r.expenseAmount, 7000);
    assert.equal(r.paymentAmount, 13500);
    assert.equal(r.jeLiquidityAmount, 7000);
    assert.equal(r.roznamchaAmount, 13500);
    assert.equal(r.proposedAfterAmount, 7000);
    assert.equal(r.canApplyRepair, true);
  });

  it('blocks repair when JE does not match expense', () => {
    const r = detectExpensePaymentAmountMismatch({
      expenseAmount: 7000,
      paymentAmount: 13500,
      jeLiquidityAmount: 13500,
    });
    assert.equal(r.canApplyRepair, false);
    assert.match(String(r.blockReason), /GL is reviewed/i);
  });

  it('reports no repair when payment already matches', () => {
    const r = detectExpensePaymentAmountMismatch({
      expenseAmount: 7000,
      paymentAmount: 7000,
      jeLiquidityAmount: 7000,
    });
    assert.equal(r.hasMismatch, false);
    assert.equal(r.canApplyRepair, false);
  });

  it('amountsClose uses epsilon', () => {
    assert.equal(amountsClose(7000, 7000.01), true);
    assert.equal(amountsClose(7000, 7001), false);
  });

  it('targeted search detects explicit filters beyond recent scan', () => {
    assert.equal(expensePaymentRepairSearchIsTargeted({}), false);
    assert.equal(expensePaymentRepairSearchIsTargeted({ expenseNo: 'EXP-0001' }), true);
    assert.equal(expensePaymentRepairSearchIsTargeted({ paymentRef: 'PAY-99' }), true);
    assert.equal(expensePaymentRepairSearchIsTargeted({ dateFrom: '2024-01-01' }), true);
    assert.equal(expensePaymentRepairSearchIsTargeted({ minMismatchAmount: 50 }), true);
  });

  it('min mismatch filter allows older large drift only', () => {
    assert.equal(expensePaymentRepairPassesMinMismatch(7000, 13500, 100), true);
    assert.equal(expensePaymentRepairPassesMinMismatch(7000, 7050, 100), false);
    assert.equal(expensePaymentMismatchAmount(7000, 13500), 6500);
  });
});
