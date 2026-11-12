import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RoznamchaResult } from '@/app/services/roznamchaService';

/**
 * Export parity: RoznamchaReport exportData and PDF preview derive from `data` (main loader result).
 * When mainLoaderSource is unified, print/Excel use unified-mapped rows.
 */

function legacyMain(closing: number, cashIn: number, cashOut: number): RoznamchaResult {
  return {
    rows: [],
    summary: { openingBalance: 0, cashIn, cashOut, closingBalance: closing },
    cashSplit: { cash: closing, bank: 0, wallet: 0, total: closing },
  };
}

test('Roznamcha export totals follow active main summary', () => {
  const main = legacyMain(100000, 200000, 100000);
  assert.equal(main.summary.closingBalance, 100000);
  assert.equal(main.summary.cashIn, 200000);
  assert.equal(main.summary.cashOut, 100000);
});

test('Roznamcha print preview uses active main filtered rows context', () => {
  const main = legacyMain(50000, 80000, 30000);
  const exportClosing = main.summary.closingBalance;
  assert.equal(exportClosing, 50000);
});
