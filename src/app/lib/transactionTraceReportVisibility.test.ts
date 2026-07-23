import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateReportVisibility } from './transactionTraceReportVisibility';

test('payment row included in Roznamcha normal mode', () => {
  const v = evaluateReportVisibility({
    hasPaymentRow: true,
    paymentReferenceType: 'sale',
    paymentContactId: 'contact-1',
    hasLiquidityLine: true,
  });
  assert.equal(v.roznamcha.normal.included, true);
  assert.equal(v.customerSupplierStatement.normal.included, true);
});

test('document sale JE excluded from Roznamcha without payment stream', () => {
  const v = evaluateReportVisibility({
    journalReferenceType: 'sale',
    hasLiquidityLine: false,
    saleStatus: 'final',
  });
  assert.equal(v.roznamcha.normal.included, false);
  assert.ok(v.roznamcha.normal.reason.includes('Document JE'));
  assert.equal(v.customerSupplierStatement.normal.included, true);
});

test('voided payment excluded from normal statement', () => {
  const v = evaluateReportVisibility({
    hasPaymentRow: true,
    paymentVoided: true,
    journalIsVoid: true,
    paymentContactId: 'c1',
  });
  assert.equal(v.customerSupplierStatement.normal.included, false);
  assert.ok(v.customerSupplierStatement.normal.reason.includes('Voided'));
});
