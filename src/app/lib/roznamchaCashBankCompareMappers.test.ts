import assert from 'node:assert/strict';
import { test } from 'node:test';
import { round2 } from '@/app/lib/unifiedLedgerCompareDiff';
import {
  cashBankAmountsEquivalent,
  cashBankEconomicRowKey,
  diffCashBankLedgerRows,
  evaluateCashBankComparePass,
  normalizeCashBankEntryNo,
  supplementRoznamchaForCashBankCompare,
  roznamchaRowKey,
  roznamchaToCompareSummary,
  unifiedCashBankRowKey,
  unifiedCashBankToCompareSummary,
} from './roznamchaCashBankCompareMappers';
import type { RoznamchaRowWithBalance } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

test('normalizeCashBankEntryNo maps EP2026 slash refs to EXP dash', () => {
  assert.equal(normalizeCashBankEntryNo('EP2026/0009'), 'EXP-0009');
  assert.equal(normalizeCashBankEntryNo('EXP-0009'), 'EXP-0009');
});

test('diffCashBankLedgerRows matches expense when roznamcha uses EP2026 ref', () => {
  const result = diffCashBankLedgerRows({
    oldRows: [
      {
        id: 'exp:9',
        ref: 'EP2026/0009',
        date: '2026-02-13',
        details: 'Shop Expense',
        cashIn: 0,
        cashOut: 300000,
        type: 'Shop Expense',
        sourceJournalEntryId: 'bbdd549f-2b35-462c-9354-6df1bf05386a',
      } as RoznamchaRowWithBalance,
    ],
    newRows: [
      {
        journalEntryId: 'bbdd549f-2b35-462c-9354-6df1bf05386a',
        entryNo: 'EXP-0009',
        entryDate: '2026-02-13',
        referenceType: 'expense',
        debit: 0,
        credit: 300000,
        description: 'expense',
      } as UnifiedLedgerRow,
    ],
  });
  assert.equal(result.missingInNew.length, 0);
  assert.equal(result.extraInNew.length, 0);
});

test('cashBankEconomicRowKey uses ref date and magnitude', () => {
  assert.equal(cashBankEconomicRowKey('RCV-0001', '2025-11-03', 150000, 0), 'econ:RCV-0001|2025-11-03|150000');
  assert.equal(cashBankEconomicRowKey('JE-0254', '2025-11-11', 880000, 0), 'econ:JE-0254|2025-11-11|880000');
  assert.equal(cashBankEconomicRowKey('JE-0254', '2025-11-11', 0, 880000), 'econ:JE-0254|2025-11-11|880000');
});

test('roznamchaRowKey prefers economic key over legacy JE id', () => {
  assert.equal(
    roznamchaRowKey({
      id: 'pay:8',
      ref: 'RCV-0001',
      date: '2025-11-03',
      cashIn: 150000,
      cashOut: 0,
      sourceJournalEntryId: '070543a4-6386-4d79-8b8b-c363c6c34c64',
    } as RoznamchaRowWithBalance),
    'econ:RCV-0001|2025-11-03|150000'
  );
});

test('unifiedCashBankRowKey matches roznamcha when JE ids differ', () => {
  const oldKey = roznamchaRowKey({
    id: 'pay:8',
    ref: 'RCV-0001',
    date: '2025-11-03',
    cashIn: 150000,
    cashOut: 0,
    sourceJournalEntryId: '070543a4-6386-4d79-8b8b-c363c6c34c64',
  } as RoznamchaRowWithBalance);
  const newKey = unifiedCashBankRowKey({
    journalEntryId: 'ba0ec0d3-e923-492e-a8f8-e5b8d8275ee9',
    entryNo: 'RCV-0001',
    entryDate: '2025-11-03',
    debit: 150000,
    credit: 0,
  } as UnifiedLedgerRow);
  assert.equal(oldKey, newKey);
});

test('cashBankAmountsEquivalent accepts transfer Dr/Cr flip', () => {
  const old = roznamchaToCompareSummary({
    id: 'x',
    ref: 'JE-0254',
    date: '2025-11-11',
    details: 'transfer',
    cashIn: 880000,
    cashOut: 0,
    type: 'Internal Transfer',
  } as RoznamchaRowWithBalance);
  const neu = unifiedCashBankToCompareSummary({
    journalEntryId: '6b958753-9ed9-43f6-8f0d-c3ccbf26922e',
    entryNo: 'JE-0254',
    entryDate: '2025-11-11',
    referenceType: 'transfer',
    debit: 0,
    credit: 880000,
    description: 'transfer',
  } as UnifiedLedgerRow);
  assert.equal(cashBankAmountsEquivalent(old, neu), true);
});

test('diffCashBankLedgerRows matches reposted receipt with different JE ids', () => {
  const result = diffCashBankLedgerRows({
    oldRows: [
      {
        id: 'pay:8',
        ref: 'RCV-0001',
        date: '2025-11-03',
        details: 'LAL MOHAMMAD',
        cashIn: 150000,
        cashOut: 0,
        type: 'Customer Payment',
        sourceJournalEntryId: '070543a4-6386-4d79-8b8b-c363c6c34c64',
      } as RoznamchaRowWithBalance,
    ],
    newRows: [
      {
        journalEntryId: 'ba0ec0d3-e923-492e-a8f8-e5b8d8275ee9',
        entryNo: 'RCV-0001',
        entryDate: '2025-11-03',
        referenceType: 'payment',
        debit: 150000,
        credit: 0,
        description: 'Receipt',
      } as UnifiedLedgerRow,
    ],
  });
  assert.equal(result.missingInNew.length, 0);
  assert.equal(result.extraInNew.length, 0);
  assert.equal(result.amountMismatches.length, 0);
});

test('roznamchaToCompareSummary maps cash in/out to debit/credit', () => {
  const s = roznamchaToCompareSummary({
    id: 'pay:1',
    date: '2026-01-15',
    ref: 'RCV-1',
    details: 'Cash Sale',
    referenceDisplay: '',
    cashIn: 500,
    cashOut: 0,
    type: 'Cash Sale',
  } as RoznamchaRowWithBalance);
  assert.equal(s.debit, 500);
  assert.equal(s.credit, 0);
  assert.equal(s.entryDate, '2026-01-15');
});

test('unifiedCashBankRowKey falls back to journal entry id without ref', () => {
  assert.equal(
    unifiedCashBankRowKey({
      journalEntryLineId: 'jel-1',
      journalEntryId: 'je-1',
      entryNo: null,
      entryDate: '2026-01-15',
      debit: 0,
      credit: 0,
    } as UnifiedLedgerRow),
    'je-1'
  );
});

test('unifiedCashBankToCompareSummary maps unified row fields', () => {
  const s = unifiedCashBankToCompareSummary({
    journalEntryId: 'je-1',
    journalEntryLineId: 'jel-1',
    entryDate: '2026-01-15',
    entryNo: 'JE-100',
    referenceType: 'payment',
    description: 'Receipt',
    debit: 500,
    credit: 0,
    runningBalance: 500,
  } as UnifiedLedgerRow);
  assert.equal(s.debit, 500);
  assert.equal(s.entryNo, 'JE-100');
});

test('supplementRoznamchaForCashBankCompare adds manual_receipt unified rows', () => {
  const legacy = [
    {
      id: 'pay:1',
      ref: 'RCV-1',
      date: '2026-01-01',
      cashIn: 100,
      cashOut: 0,
      sourceJournalEntryId: 'je-1',
    } as RoznamchaRowWithBalance,
  ];
  const unified = [
    {
      journalEntryId: 'je-1',
      entryNo: 'RCV-1',
      entryDate: '2026-01-01',
      debit: 100,
      credit: 0,
      referenceType: 'payment',
    },
    {
      journalEntryId: 'je-mr',
      journalEntryLineId: 'jel-mr',
      entryNo: 'JE-0287',
      entryDate: '2026-04-24',
      debit: 13000000,
      credit: 0,
      referenceType: 'manual_receipt',
      description: 'manual',
      runningBalance: 0,
    },
  ] as UnifiedLedgerRow[];
  const supplemented = supplementRoznamchaForCashBankCompare(legacy, unified);
  assert.equal(supplemented.length, 2);
});

test('evaluateCashBankComparePass passes on row parity even when native closings differ', () => {
  const legacyRows = [
    {
      id: 'pay:1',
      ref: 'RCV-1',
      date: '2026-01-01',
      cashIn: 1000,
      cashOut: 0,
      sourceJournalEntryId: 'je-1',
    },
  ] as RoznamchaRowWithBalance[];
  const unifiedRows = [
    {
      journalEntryId: 'je-1',
      entryNo: 'RCV-1',
      entryDate: '2026-01-01',
      debit: 1000,
      credit: 0,
      referenceType: 'payment',
      runningBalance: 5000,
    },
  ] as UnifiedLedgerRow[];
  const result = evaluateCashBankComparePass({
    legacyRows,
    unifiedRows,
    legacyClosing: 90313,
    unifiedClosing: -8540887,
  });
  assert.equal(result.rowParityPass, true);
  assert.equal(result.pass, true);
  assert.equal(result.difference, round2(90313 - -8540887));
});

test('evaluateCashBankComparePass passes on transfer Dr/Cr flip row parity', () => {
  const legacyRows = [
    {
      id: 'xfer:1',
      ref: 'TR-001',
      date: '2026-02-01',
      cashIn: 5000,
      cashOut: 0,
      sourceJournalEntryId: 'je-xfer',
    },
  ] as RoznamchaRowWithBalance[];
  const unifiedRows = [
    {
      journalEntryId: 'je-xfer',
      entryNo: 'TR-001',
      entryDate: '2026-02-01',
      debit: 0,
      credit: 5000,
      referenceType: 'transfer',
      runningBalance: 0,
    },
  ] as UnifiedLedgerRow[];
  const result = evaluateCashBankComparePass({
    legacyRows,
    unifiedRows,
    legacyClosing: 100,
    unifiedClosing: -4900,
  });
  assert.equal(result.rowParityPass, true);
  assert.equal(result.amountMismatches.length, 0);
  assert.equal(result.periodMovementPass, false);
  assert.equal(result.pass, true);
});

test('evaluateCashBankComparePass passes when manual_receipt supplement aligns rows', () => {
  const legacyRows = [] as RoznamchaRowWithBalance[];
  const unifiedRows = [
    {
      journalEntryId: 'je-mr',
      journalEntryLineId: 'jel-mr',
      entryNo: 'JE-0287',
      entryDate: '2026-04-24',
      debit: 1000,
      credit: 0,
      referenceType: 'manual_receipt',
      description: 'manual',
      runningBalance: 1000,
    },
  ] as UnifiedLedgerRow[];
  const result = evaluateCashBankComparePass({
    legacyRows,
    unifiedRows,
    legacyClosing: 0,
    unifiedClosing: 1000,
  });
  assert.equal(result.manualReceiptSupplementCount, 1);
  assert.equal(result.pass, true);
  assert.equal(result.extraInNew.length, 0);
});

test('DIN CHINA RCV-0092 matches on economic key not payment id vs journal line id', () => {
  const legacyRow = {
    id: 'pay:127',
    ref: 'RCV-0092',
    date: '2026-01-02',
    cashIn: 200000,
    cashOut: 0,
    sourceJournalEntryId: '51958c11-3022-46a8-856b-360720f5b6a3',
    type: 'Customer Payment',
  } as RoznamchaRowWithBalance;
  const unifiedRow = {
    journalEntryId: '51958c11-3022-46a8-856b-360720f5b6a3',
    journalEntryLineId: 'jel-rcv-0092-line',
    entryNo: 'RCV-0092',
    entryDate: '2026-01-02',
    debit: 200000,
    credit: 0,
    referenceType: 'payment',
  } as UnifiedLedgerRow;
  assert.notEqual(legacyRow.id, unifiedCashBankRowKey(unifiedRow));
  assert.equal(roznamchaRowKey(legacyRow), unifiedCashBankRowKey(unifiedRow));
  const result = diffCashBankLedgerRows({ oldRows: [legacyRow], newRows: [unifiedRow] });
  assert.equal(result.missingInNew.length, 0);
  assert.equal(result.extraInNew.length, 0);
});
