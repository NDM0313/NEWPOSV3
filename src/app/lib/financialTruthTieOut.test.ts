import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  balanceSheetTiesToTrialBalance,
  buildStandardTieOutDifferences,
  explainArCus0000TieOut,
  trialBalanceBalanced,
  tieOutDifference,
} from './financialTruthTieOut';

test('trial balance balanced within penny tolerance', () => {
  assert.equal(trialBalanceBalanced(1000, 1000), true);
  assert.equal(trialBalanceBalanced(1000.005, 1000), true);
  assert.equal(trialBalanceBalanced(1000, 999), false);
});

test('balance sheet difference ties to TB imbalance field', () => {
  assert.equal(balanceSheetTiesToTrialBalance(50, 50), true);
  assert.equal(balanceSheetTiesToTrialBalance(50, 40), false);
});

test('AR-CUS0000 fixture: effective 0 vs official 1 explained', () => {
  const row = explainArCus0000TieOut({
    rawGlBalance: 1,
    effectiveBalance: 0,
    auditOnlyNet: 1,
  });
  assert.equal(row.difference, 1);
  assert.equal(row.reasonCategory, 'cancelled_audit_hidden_from_effective');
  assert.match(row.recommendedAction, /JE-0168/i);
});

test('buildStandardTieOutDifferences includes AR raw vs effective when they diverge', () => {
  const rows = buildStandardTieOutDifferences({
    tbDifference: 0,
    bsDifference: 0,
    arControlGl: 100,
    arSubledgerRaw: 101,
    arSubledgerEffective: 100,
    operationalReceivables: 100,
    effectiveVarianceReceivables: 0,
    auditOnlyArNet: 1,
    apControlGl: 0,
    apSubledgerRaw: null,
    operationalPayables: 0,
    effectiveVariancePayables: null,
    auditOnlyApNet: 0,
    cashGlNet: 500,
    cashOperationalClosing: 500,
  });
  assert.ok(rows.some((r) => r.id === 'ar-raw-vs-effective'));
  assert.equal(tieOutDifference(101, 100), 1);
});

test('Inayat-style timing: zero diff is valid timing', () => {
  const rows = buildStandardTieOutDifferences({
    tbDifference: 0,
    bsDifference: 0,
    arControlGl: 0,
    arSubledgerRaw: 0,
    arSubledgerEffective: 0,
    operationalReceivables: 0,
    effectiveVarianceReceivables: 0,
    auditOnlyArNet: 0,
    apControlGl: 0,
    apSubledgerRaw: null,
    operationalPayables: 0,
    effectiveVariancePayables: null,
    auditOnlyApNet: 0,
    cashGlNet: 0,
    cashOperationalClosing: 0,
  });
  assert.equal(rows.length, 0);
});
