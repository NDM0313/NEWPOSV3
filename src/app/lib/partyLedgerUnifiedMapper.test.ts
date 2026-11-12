import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapUnifiedRowToPartyLedgerPreview } from './partyLedgerUnifiedMapper';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

test('mapUnifiedRowToPartyLedgerPreview maps balance fields', () => {
  const row = mapUnifiedRowToPartyLedgerPreview({
    journalEntryLineId: 'jel-1',
    journalEntryId: 'je-1',
    entryDate: '2026-03-01',
    entryNo: 'JE-10',
    referenceType: 'sale',
    description: 'Invoice',
    debit: 1000,
    credit: 0,
    runningBalance: 216300,
  } as UnifiedLedgerRow);
  assert.equal(row.debit, 1000);
  assert.equal(row.runningBalance, 216300);
  assert.equal(row.referenceNo, 'JE-10');
});
