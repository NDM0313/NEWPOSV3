import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { excludePaymentsByVoidedJournalIds } from './paymentVoidVisibility.ts';

describe('paymentVoidVisibility', () => {
  it('excludePaymentsByVoidedJournalIds drops voided payment ids', () => {
    const voided = new Set(['pay-void', 'pay-2']);
    const rows = [
      { id: 'pay-live', amount: 10 },
      { id: 'pay-void', amount: 20 },
      { id: 'pay-2', amount: 5 },
    ];
    const out = excludePaymentsByVoidedJournalIds(rows, voided);
    assert.deepEqual(out.map((r) => r.id), ['pay-live']);
  });

  it('excludePaymentsByVoidedJournalIds is no-op when set empty', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    assert.equal(excludePaymentsByVoidedJournalIds(rows, new Set()).length, 2);
  });

});
