import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPaidExpenseEdit } from './accountingEditClassification.ts';

describe('classifyPaidExpenseEdit', () => {
  const base = {
    status: 'paid' as const,
    amount: 13500,
    paymentMethod: 'cash',
    date: '2026-06-01',
    location: 'branch-1',
    paymentAccountId: 'acc-cash',
    category: 'Rent',
    description: 'Office rent',
    notes: null,
    payeeName: 'Landlord',
  };

  it('sets paymentsTouch on amount DELTA_ADJUSTMENT', () => {
    const c = classifyPaidExpenseEdit(base, { amount: 7000 }, 'company-1');
    assert.equal(c.kind, 'DELTA_ADJUSTMENT');
    assert.equal(c.actionPlan.touchPayments, true);
    assert.equal(c.domains.payments, true);
  });

  it('sets paymentsTouch when paid-from account changes', () => {
    const c = classifyPaidExpenseEdit(base, { paymentAccountId: 'acc-bank' }, 'company-1');
    assert.equal(c.kind, 'DELTA_ADJUSTMENT');
    assert.equal(c.actionPlan.touchPayments, true);
  });

  it('does not touch payments on header-only date change', () => {
    const c = classifyPaidExpenseEdit(base, { date: '2026-06-15' }, 'company-1');
    assert.equal(c.kind, 'HEADER_ONLY_CHANGE');
    assert.equal(c.actionPlan.touchPayments, false);
  });
});
