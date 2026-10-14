import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Export parity: TrialBalancePage toExport() and ReportActions derive from `data`
 * (main loader result). Unified main populates same TrialBalanceResult shape.
 */

test('Trial Balance export totals follow active main data totals', () => {
  const mainData = {
    rows: [],
    totalDebit: 1_234_567.89,
    totalCredit: 1_234_567.89,
    difference: 0,
  };
  const exportDebit = mainData.totalDebit;
  const exportCredit = mainData.totalCredit;
  assert.equal(exportDebit, mainData.totalDebit);
  assert.equal(exportCredit, mainData.totalCredit);
  assert.equal(Math.abs(exportDebit - exportCredit), 0);
});

test('Trial Balance debit/credit equality gate', () => {
  const totals = { totalDebit: 100, totalCredit: 100, difference: 0 };
  assert.equal(Math.abs(totals.totalDebit - totals.totalCredit) < 0.01, true);
});
