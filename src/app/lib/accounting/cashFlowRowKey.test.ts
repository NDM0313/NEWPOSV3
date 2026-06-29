import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCashFlowStableRowKey,
  classifyRowSide,
  classifyTransfer,
  hashDescription,
  redactExportSecrets,
} from './cashFlowRowKey';
import { normalizeLegacyCashFlowRow, normalizePreviewCashFlowRow } from './cashFlowRowNormalizer';
import { buildCashFlowRowKeyedDiff } from './cashFlowRowDiffBuckets';
import { buildCashFlowRowKeyedExport } from './cashFlowRowKeyedExport';
import type { CashFlowRow } from '@/app/services/cashFlowReportService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

test('buildCashFlowStableRowKey EXACT_KEY from journal line id', () => {
  const k = buildCashFlowStableRowKey({
    journalEntryLineId: 'abc-123',
    date: '2026-06-01',
    cashIn: 100,
    cashOut: 0,
  });
  assert.equal(k.keyConfidence, 'EXACT_KEY');
  assert.equal(k.stableRowKey, 'jel:abc-123');
});

test('buildCashFlowStableRowKey STRONG_KEY from payment id', () => {
  const k = buildCashFlowStableRowKey({
    paymentId: 'pay-1',
    date: '2026-06-01',
    cashIn: 50,
    cashOut: 0,
    referenceType: 'payment',
  });
  assert.equal(k.keyConfidence, 'STRONG_KEY');
  assert.ok(k.stableRowKey.startsWith('pay:pay-1'));
});

test('classify transfer in/out', () => {
  assert.equal(
    classifyRowSide({ referenceType: 'transfer', cashIn: 1000, cashOut: 0, sourceModule: 'transfers' }),
    'transfer_in'
  );
  assert.equal(
    classifyRowSide({ referenceType: 'transfer', cashIn: 0, cashOut: 500, sourceModule: 'transfers' }),
    'transfer_out'
  );
  assert.equal(classifyTransfer({ referenceType: 'transfer', cashIn: 0, cashOut: 1 }), 'internal_transfer_out');
});

test('classify opening balance reference', () => {
  assert.equal(
    classifyRowSide({ referenceType: 'opening_balance_account', cashIn: 100, cashOut: 0 }),
    'opening'
  );
});

test('normalize legacy row parses jel id from legacy row id', () => {
  const row: CashFlowRow = {
    id: 'jel-line-99',
    date: '2026-06-01',
    time: '12:00',
    reference: 'JE-1',
    journalEntryNo: 'JE-1',
    party: 'Test',
    sourceModule: 'transfers',
    sourceModuleLabel: 'Transfers',
    cashAccount: 'Cash',
    cashIn: 1000,
    cashOut: 0,
    runningBalance: 1000,
    status: 'live',
    branchId: null,
    branchName: null,
    details: 'Transfer',
    referenceType: 'transfer',
    sourcePaymentId: null,
    sourceJournalEntryId: 'je-1',
    sourceRentalPaymentId: null,
  };
  const n = normalizeLegacyCashFlowRow(row, 'co-1', false);
  assert.equal(n.side, 'legacy');
  assert.equal(n.journalEntryLineId, 'line-99');
  assert.equal(n.transferClass, 'internal_transfer_in');
});

test('buildCashFlowRowKeyedDiff matches exact journal line ids', () => {
  const legacy = normalizeLegacyCashFlowRow(
    {
      id: 'jel-shared',
      date: '2026-06-01',
      time: '',
      reference: 'JE-1',
      journalEntryNo: 'JE-1',
      party: null,
      sourceModule: 'sales_receipts',
      sourceModuleLabel: 'Sales',
      cashAccount: 'Cash',
      cashIn: 100,
      cashOut: 0,
      runningBalance: 100,
      status: 'live',
      branchId: null,
      branchName: null,
      details: 'Sale',
      referenceType: 'payment',
      sourcePaymentId: 'p1',
      sourceJournalEntryId: 'je-1',
      sourceRentalPaymentId: null,
    },
    'co',
    false
  );
  const preview = normalizePreviewCashFlowRow(
    {
      journalEntryLineId: 'shared',
      journalEntryId: 'je-1',
      entryDate: '2026-06-01',
      entryNo: 'JE-1',
      referenceType: 'payment',
      description: 'Sale',
      debit: 100,
      credit: 0,
      runningBalance: 100,
      periodOpeningBalance: 0,
      paymentId: 'p1',
      branchId: null,
      branchName: null,
      accountCode: '1010',
      accountName: 'Cash',
      partyResolved: null,
    },
    'co',
    false
  );
  const diff = buildCashFlowRowKeyedDiff([legacy], [preview]);
  assert.equal(diff.exactMatches.length, 1);
  assert.equal(diff.legacyOnly.length, 0);
  assert.equal(diff.previewOnly.length, 0);
});

test('redactExportSecrets removes secret field names', () => {
  const out = redactExportSecrets({
    companyId: 'x',
    apiKey: 'secret',
    nested: { password: 'p', safe: 1 },
  });
  assert.equal((out as { apiKey?: string }).apiKey, undefined);
  assert.equal((out as { nested: { password?: string; safe: number } }).nested.safe, 1);
  assert.equal((out as { nested: { password?: string } }).nested.password, undefined);
});

test('buildCashFlowRowKeyedExport preserves summary diff unchanged', () => {
  const legacy = {
    rows: [
      {
        id: 'jel-a',
        date: '2026-06-01',
        time: '',
        reference: 'R',
        journalEntryNo: null,
        party: null,
        sourceModule: 'other' as const,
        sourceModuleLabel: 'Other',
        cashAccount: 'Cash',
        cashIn: 100,
        cashOut: 0,
        runningBalance: 100,
        status: 'live' as const,
        branchId: null,
        branchName: null,
        details: 'x',
        referenceType: 'payment',
        sourcePaymentId: null,
        sourceJournalEntryId: null,
        sourceRentalPaymentId: null,
      },
    ],
    summary: { opening: 0, cashIn: 100, cashOut: 0, netMovement: 100, closing: 100 },
    auditMode: false,
  };
  const unified: UnifiedLedgerRow = {
    journalEntryLineId: 'a',
    journalEntryId: 'je',
    entryDate: '2026-06-01',
    entryNo: null,
    referenceType: 'payment',
    description: 'x',
    debit: 200,
    credit: 0,
    runningBalance: 200,
    periodOpeningBalance: 0,
    paymentId: null,
    branchId: null,
    branchName: null,
    accountCode: null,
    accountName: 'Cash',
    partyResolved: null,
  };
  const payload = buildCashFlowRowKeyedExport({
    companyId: 'co',
    dateFrom: '2026-01-01',
    dateTo: '2026-06-29',
    branchLabel: 'All branches',
    auditMode: false,
    previewBasis: 'effective_party',
    legacy,
    loadResult: {
      preview: {
        previewOnly: true,
        needsFinanceGoldenApproval: true,
        summary: { opening: 0, cashIn: 200, cashOut: 0, netMovement: 200, closing: 200 },
        rowCount: 1,
        sourceModuleFilter: 'all',
        auditMode: false,
        accountingRuleNotes: [],
        financeAlignmentApplied: true,
        financeRules: {
          phase: '3B-H',
          Q4: 'A',
          Q5: 'C',
          Q7: 'B',
          reviewer: 'Nadeem Khan',
          reviewDate: '2026-06-29',
          loaderSwapApproved: false,
          officialCashFlowBehaviorChanged: false,
          previewAlignmentOnly: true,
        },
        excludedFromNormalTotals: {
          internalTransferRows: 0,
          openingBalanceRows: 0,
          auditDetailRows: 0,
        },
        totalUnifiedRows: 1,
      },
      roznamchaPreview: {
        rows: [],
        unifiedRows: [unified],
        closingBalance: 200,
        openingBalance: 0,
        meta: {
          engine: 'unified_shadow',
          basis: 'effective_party',
          featureFlagEnabled: true,
          shadowForce: true,
          queryDurationMs: 1,
          rowCount: 1,
          periodOpeningBalance: 0,
          message: 'test',
        },
        basis: 'effective_party',
        rpcScope: {
          branchId: null,
          dateFrom: '2026-01-01',
          dateTo: '2026-06-29',
          liquidity: 'all',
          includeVoidedReversed: false,
        },
        paymentAccountFilterApplied: false,
      },
      basis: 'effective_party',
    },
    diff: {
      legacyOpening: 0,
      previewOpening: 0,
      openingDelta: 0,
      legacyCashIn: 100,
      previewCashIn: 200,
      cashInDelta: -100,
      legacyCashOut: 0,
      previewCashOut: 0,
      cashOutDelta: 0,
      legacyNetMovement: 100,
      previewNetMovement: 200,
      netMovementDelta: -100,
      legacyClosing: 100,
      previewClosing: 200,
      closingDelta: -100,
      legacyRowCount: 1,
      previewRowCount: 1,
      rowCountDelta: 0,
      pass: false,
      previewOnly: true,
      needsFinanceGoldenApproval: true,
    },
  });
  assert.equal(payload.phase, '3B-H');
  assert.equal(payload.diff?.legacyCashIn, 100);
  assert.equal(payload.legacyRowsNormalized.length, 1);
  assert.equal(payload.previewRowsNormalized.length, 1);
  assert.ok(payload.rowKeyedDiff.thematicBuckets.length >= 0);
  assert.equal(hashDescription('test'), hashDescription('test'));
});
