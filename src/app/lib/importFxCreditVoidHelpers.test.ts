import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterActiveSettlementPaymentRefs,
  formatActiveSettlementBlockMessage,
} from './importFxCreditVoidHelpers';

test('filterActiveSettlementPaymentRefs skips voided payments', () => {
  const refs = filterActiveSettlementPaymentRefs([
    { reference_number: 'PAY-1', voided_at: null },
    { reference_number: 'PAY-2', voided_at: '2026-08-11T00:00:00Z' },
  ]);
  assert.deepEqual(refs, ['PAY-1']);
});

test('formatActiveSettlementBlockMessage lists refs', () => {
  const msg = formatActiveSettlementBlockMessage(['PAY-0327', 'PAY-0328']);
  assert.match(msg, /PAY-0327/);
  assert.match(msg, /void those payments first/i);
});
