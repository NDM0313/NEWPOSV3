import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cashBankAmountsEquivalent,
  cashBankEconomicRowKey,
  diffCashBankLedgerRows,
  roznamchaRowKey,
  roznamchaToCompareSummary,
  unifiedCashBankRowKey,
  unifiedCashBankToCompareSummary,
} from './roznamchaCashBankCompareMappers';
import type { RoznamchaRowWithBalance } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

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
