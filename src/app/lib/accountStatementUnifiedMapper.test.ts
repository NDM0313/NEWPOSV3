import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapUnifiedRowToAccountStatement } from './accountStatementUnifiedMapper';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

test('mapUnifiedRowToAccountStatement maps core fields', () => {
  const unified: UnifiedLedgerRow = {
    journalEntryLineId: 'line-1',
    journalEntryId: 'je-1',
    entryDate: '2026-01-15',
    entryNo: 'JE-100',
    referenceType: 'sale_invoice',
    description: 'Test sale',
    debit: 0,
    credit: 5000,
    runningBalance: 216300,
    periodOpeningBalance: 0,
    paymentId: null,
    branchId: null,
    branchName: 'Main',
    accountCode: '1100',
    accountName: 'Cash',
    partyResolved: null,
  };
  const row = mapUnifiedRowToAccountStatement(unified);
  assert.equal(row.journal_entry_id, 'je-1');
  assert.equal(row.journal_line_id, 'line-1');
  assert.equal(row.date, '2026-01-15');
  assert.equal(row.reference_number, 'JE-100');
  assert.equal(row.running_balance, 216300);
  assert.equal(row.je_reference_type, 'sale_invoice');
});
