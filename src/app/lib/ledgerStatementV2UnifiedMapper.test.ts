import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mapGlReferenceTypeToSourceKind,
  mapUnifiedRowToLedgerV2,
} from './ledgerStatementV2UnifiedMapper';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

test('mapGlReferenceTypeToSourceKind maps sale payment types', () => {
  assert.equal(mapGlReferenceTypeToSourceKind('sale_invoice'), 'sale');
  assert.equal(mapGlReferenceTypeToSourceKind('payment_received'), 'payment');
  assert.equal(mapGlReferenceTypeToSourceKind('opening_balance'), 'opening');
  assert.equal(mapGlReferenceTypeToSourceKind('manual_journal'), 'journal');
});

test('mapUnifiedRowToLedgerV2 maps core fields', () => {
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
  const row = mapUnifiedRowToLedgerV2(unified);
  assert.equal(row.id, 'line-1');
  assert.equal(row.journalEntryId, 'je-1');
  assert.equal(row.date, '2026-01-15');
  assert.equal(row.referenceNo, 'JE-100');
  assert.equal(row.transactionType, 'sale_invoice');
  assert.equal(row.sourceKind, 'sale');
  assert.equal(row.branch, 'Main');
  assert.equal(row.paymentMethod, 'Cash');
  assert.equal(row.runningBalance, 216300);
  assert.equal(row.hasAttachments, false);
  assert.equal(row.createdBy, '—');
});
