import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unifiedPartyRowKey, unifiedPartyToCompareSummary } from './partyLedgerUnifiedCompareMappers';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

test('unifiedPartyRowKey prefers journal line id', () => {
  assert.equal(
    unifiedPartyRowKey({ journalEntryLineId: 'jel-1', journalEntryId: 'je-1' } as UnifiedLedgerRow),
    'jel-1'
  );
});

test('unifiedPartyToCompareSummary maps fields', () => {
  const s = unifiedPartyToCompareSummary({
    journalEntryId: 'je-1',
    entryNo: 'JE-1',
    entryDate: '2026-01-01',
    referenceType: 'payment',
    description: 'Receipt',
    debit: 100,
    credit: 0,
    runningBalance: 100,
  } as UnifiedLedgerRow);
  assert.equal(s.debit, 100);
  assert.equal(s.entryNo, 'JE-1');
});
