import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeDayBookPeriodBalance,
  findUnbalancedVouchers,
  dayBookLineMatchesQuery,
} from './dayBookDiagnostics';

const base = (overrides: Partial<Parameters<typeof computeDayBookPeriodBalance>[0][0]> = {}) => ({
  journalEntryId: 'je-1',
  voucher: 'JE-0001',
  entryDate: '2026-06-01',
  referenceType: 'payment',
  debit: 0,
  credit: 0,
  isVoid: false,
  accountLabel: '1000 Cash',
  ...overrides,
});

test('computeDayBookPeriodBalance excludes void lines', () => {
  const bal = computeDayBookPeriodBalance([
    base({ debit: 1000, credit: 0 }),
    base({ journalEntryId: 'je-1', debit: 0, credit: 1000 }),
    base({ journalEntryId: 'je-void', debit: 500, isVoid: true }),
  ]);
  assert.equal(bal.isBalanced, true);
  assert.equal(bal.voidLineCount, 1);
});

test('findUnbalancedVouchers detects JE-0188 pattern', () => {
  const rows = findUnbalancedVouchers([
    base({ journalEntryId: 'je-188', voucher: 'JE-0188', debit: 10000, credit: 0 }),
    base({ journalEntryId: 'je-188', voucher: 'JE-0188', debit: 0, credit: 8000 }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].voucher, 'JE-0188');
  assert.equal(rows[0].diff, 2000);
});

test('dayBookLineMatchesQuery matches voucher', () => {
  assert.equal(dayBookLineMatchesQuery(base({ voucher: 'JE-0193' }), '0193'), true);
  assert.equal(dayBookLineMatchesQuery(base({ voucher: 'JE-0001' }), '0193'), false);
});
