import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateReportVisibility } from './transactionTraceReportVisibility';

test('payment row included in Roznamcha', () => {
  const v = evaluateReportVisibility({
    hasPaymentRow: true,
    paymentReferenceType: 'sale',
    paymentContactId: 'contact-1',
    hasLiquidityLine: true,
  });
  assert.equal(v.roznamcha.included, true);
  assert.equal(v.accountStatement.included, true);
});

test('document sale JE excluded from Roznamcha without payment stream', () => {
  const v = evaluateReportVisibility({
    journalReferenceType: 'sale',
    hasLiquidityLine: false,
    saleStatus: 'final',
  });
  assert.equal(v.roznamcha.included, false);
  assert.ok(v.roznamcha.reason.includes('Document JE'));
  assert.equal(v.accountStatement.included, true);
});

test('voided payment excluded from statement', () => {
  const v = evaluateReportVisibility({
    hasPaymentRow: true,
    paymentVoided: true,
    journalIsVoid: true,
    paymentContactId: 'c1',
  });
  assert.equal(v.accountStatement.included, false);
  assert.ok(v.accountStatement.reason.includes('Voided'));
});
