import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateReportVisibility } from './transactionTraceReportVisibility';
import { isPostedExpenseStatus } from './expenseCancelPolicy';
import { getTransactionActions } from './transactionActionRules';
import {
  isGlCorrectionReferenceType,
  shouldIncludeGlCorrectionInNormalStatement,
} from './reportVisibilityContract';

test('correction_reversal hidden in normal reports but visible in audit trace', () => {
  const v = evaluateReportVisibility({
    journalReferenceType: 'correction_reversal',
    hasLiquidityLine: true,
    hasPaymentRow: false,
    paymentVoided: true,
  });
  assert.equal(v.roznamcha.normal.included, false);
  assert.equal(v.roznamcha.audit.included, true);
  assert.equal(v.dayBook.normal.included, false);
  assert.equal(v.dayBook.audit.included, true);
  assert.ok(v.accountStatement.audit.reason.includes('correction_reversal'));
});

test('posted expense uses cancel not delete policy', () => {
  assert.equal(isPostedExpenseStatus('paid'), true);
  assert.equal(isPostedExpenseStatus('draft'), false);
});

test('phase2b: cancelled-sale gl_correction audit-visible, hidden from normal party filter', () => {
  assert.equal(
    shouldIncludeGlCorrectionInNormalStatement({
      jeReferenceType: 'gl_correction',
      jeActionFingerprint: 'developer_repair:gl_correction:hq-sl-0003-orphan-ar',
      linkedSaleStatus: 'cancelled',
    }),
    false
  );
  assert.equal(isGlCorrectionReferenceType('gl_correction'), true);
});

test('source-document JE has no cancel from accounting', () => {
  const actions = getTransactionActions(
    {
      reference_type: 'sale',
      reference_id: 'sale-1',
      payment_id: null,
      is_void: false,
    },
    'journal',
    { sourceOpenTarget: { kind: 'sale', id: 'sale-1' } }
  );
  assert.ok(!actions.some((a) => a.id === 'cancel_payment' || a.id === 'cancel_entry'));
});
