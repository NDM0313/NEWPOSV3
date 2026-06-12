import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertUniqueCashFlowSourceKeys,
  buildCashFlowCsvRows,
  cashFlowFiltersAffectRunningBalance,
  cashFlowRunningBalanceNote,
  cashFlowStatusBadges,
  computeCashFlowSummary,
  includeCashFlowRowInNormalMode,
  inferCashFlowSourceModule,
  recomputeCashFlowRunningBalance,
  resolveCashFlowRowStatus,
} from './cashFlowReportLogic';

test('normal mode excludes JE-0168-class correction_reversal rows', () => {
  assert.equal(
    includeCashFlowRowInNormalMode({
      id: 'jel-1',
      details: 'Reversal of Receipt',
      rowType: 'Payment',
      referenceType: 'correction_reversal',
    }),
    false
  );
});

test('audit mode includes reversal rows with reversed status label', () => {
  const status = resolveCashFlowRowStatus({
    id: 'jel-1',
    details: 'Reversal of Receipt HQ-SL-0004 (Reversal — audit)',
    rowType: 'Payment',
    referenceType: 'correction_reversal',
  });
  assert.equal(status, 'reversed');
});

test('cash in/out and net movement summary', () => {
  const summary = computeCashFlowSummary(
    [
      { cashIn: 1000, cashOut: 0 },
      { cashIn: 0, cashOut: 300 },
      { cashIn: 50, cashOut: 0 },
    ],
    500
  );
  assert.equal(summary.opening, 500);
  assert.equal(summary.cashIn, 1050);
  assert.equal(summary.cashOut, 300);
  assert.equal(summary.netMovement, 750);
  assert.equal(summary.closing, 1250);
});

test('running balance recomputed for filtered account rows', () => {
  const rows = recomputeCashFlowRunningBalance(
    [
      { id: '1', cashIn: 100, cashOut: 0, runningBalance: 0 },
      { id: '2', cashIn: 0, cashOut: 40, runningBalance: 0 },
    ],
    1000
  );
  assert.equal(rows[0].runningBalance, 1100);
  assert.equal(rows[1].runningBalance, 1060);
});

test('voided payments excluded from normal mode gate', () => {
  assert.equal(
    includeCashFlowRowInNormalMode({
      id: 'pay-1',
      details: 'Customer Payment',
      rowType: 'Customer Payment',
      referenceType: 'sale',
      paymentVoidedAt: '2026-01-01T00:00:00Z',
    }),
    false
  );
});

test('no double count when payment and JE share same source payment id', () => {
  const unique = assertUniqueCashFlowSourceKeys([
    { id: 'a', sourcePaymentId: 'p1', sourceJournalEntryId: null, sourceRentalPaymentId: null },
    { id: 'b', sourcePaymentId: 'p2', sourceJournalEntryId: null, sourceRentalPaymentId: null },
  ]);
  assert.equal(unique, true);
  const dup = assertUniqueCashFlowSourceKeys([
    { id: 'a', sourcePaymentId: 'p1', sourceJournalEntryId: null, sourceRentalPaymentId: null },
    { id: 'b', sourcePaymentId: 'p1', sourceJournalEntryId: null, sourceRentalPaymentId: null },
  ]);
  assert.equal(dup, false);
});

test('source module inference for expense payment', () => {
  assert.equal(
    inferCashFlowSourceModule({ rowType: 'Shop Expense', referenceType: 'expense', rowId: 'pay-x' }),
    'expenses'
  );
  assert.equal(
    inferCashFlowSourceModule({ rowType: 'Internal transfer', referenceType: 'transfer', rowId: 'jel-x' }),
    'transfers'
  );
});

test('status badges include Audit tag for reversal rows in audit mode', () => {
  assert.deepEqual(cashFlowStatusBadges('reversed', true), ['Reversed', 'Audit']);
  assert.deepEqual(cashFlowStatusBadges('live', true), ['Live']);
});

test('CSV export rows include status and branch columns', () => {
  const rows = buildCashFlowCsvRows([
    {
      dateTime: '2026-01-01 10:00',
      reference: 'RCV-0001',
      party: 'Walk-in',
      sourceModuleLabel: 'Sales receipts',
      cashAccount: 'Cash',
      cashIn: 100,
      cashOut: 0,
      runningBalance: 1100,
      status: 'live',
      branchName: 'HQ',
      auditMode: false,
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][8], 'Live');
  assert.equal(rows[0][9], 'HQ');
});

test('running balance note when filters active', () => {
  assert.equal(
    cashFlowRunningBalanceNote(
      cashFlowFiltersAffectRunningBalance({
        sourceModuleFilter: 'expenses',
        paymentLedgerAccountId: '',
        accountFilter: 'all',
        searchTerm: '',
      })
    ),
    'Running balance is calculated on the filtered rows.'
  );
  assert.equal(
    cashFlowRunningBalanceNote(
      cashFlowFiltersAffectRunningBalance({
        sourceModuleFilter: 'all',
        paymentLedgerAccountId: '',
        accountFilter: 'all',
        searchTerm: '',
      })
    ),
    null
  );
});
