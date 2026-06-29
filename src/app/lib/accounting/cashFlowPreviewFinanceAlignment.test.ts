import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CASH_FLOW_APPROVED_FINANCE_RULES,
  classifyPreviewFinanceAlignment,
  excludeFromNormalPreviewPeriodTotals,
  isInternalTransferRow,
  isOpeningBalanceAccountRow,
} from './cashFlowPreviewFinanceAlignment';
import { mapUnifiedRowsToCashFlowPreview } from './cashFlowUnifiedPreviewMapper';
import { normalizePreviewCashFlowRow } from './cashFlowRowNormalizer';
import { buildCashFlowRowKeyedExport } from './cashFlowRowKeyedExport';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

function urow(partial: Partial<UnifiedLedgerRow> & Pick<UnifiedLedgerRow, 'debit' | 'credit'>): UnifiedLedgerRow {
  return {
    journalEntryLineId: partial.journalEntryLineId ?? 'jel-1',
    journalEntryId: partial.journalEntryId ?? 'je-1',
    entryDate: partial.entryDate ?? '2026-06-01',
    entryNo: partial.entryNo ?? 'JE-1',
    referenceType: partial.referenceType ?? 'payment',
    description: partial.description ?? 'test',
    debit: partial.debit,
    credit: partial.credit,
    runningBalance: partial.runningBalance ?? 0,
    periodOpeningBalance: partial.periodOpeningBalance ?? 0,
    paymentId: partial.paymentId ?? null,
    branchId: partial.branchId ?? null,
    branchName: partial.branchName ?? null,
    accountCode: partial.accountCode ?? '1010',
    accountName: partial.accountName ?? 'Cash',
    partyResolved: partial.partyResolved ?? null,
  };
}

test('approved finance rules Q4=A Q5=C Q7=B recorded', () => {
  assert.equal(CASH_FLOW_APPROVED_FINANCE_RULES.Q4, 'A');
  assert.equal(CASH_FLOW_APPROVED_FINANCE_RULES.Q5, 'C');
  assert.equal(CASH_FLOW_APPROVED_FINANCE_RULES.Q7, 'B');
  assert.equal(CASH_FLOW_APPROVED_FINANCE_RULES.loaderSwapApproved, false);
});

test('internal transfer rows excluded from normal preview period totals', () => {
  const result = mapUnifiedRowsToCashFlowPreview({
    openingBalance: 1000,
    sourceModuleFilter: 'all',
    auditMode: false,
    unifiedRows: [
      urow({ debit: 500, credit: 0, referenceType: 'payment' }),
      urow({ journalEntryLineId: 'jel-t1', debit: 0, credit: 300, referenceType: 'transfer' }),
      urow({ journalEntryLineId: 'jel-t2', debit: 200, credit: 0, referenceType: 'transfer' }),
    ],
  });
  assert.equal(result.summary.cashIn, 500);
  assert.equal(result.summary.cashOut, 0);
  assert.equal(result.excludedFromNormalTotals.internalTransferRows, 2);
  assert.equal(result.rowCount, 1);
  assert.equal(result.financeAlignmentApplied, true);
});

test('opening_balance_account rows excluded from period cash-in', () => {
  const result = mapUnifiedRowsToCashFlowPreview({
    openingBalance: 5000,
    sourceModuleFilter: 'all',
    auditMode: false,
    unifiedRows: [
      urow({ debit: 25000, credit: 0, referenceType: 'opening_balance_account' }),
      urow({ journalEntryLineId: 'jel-s', debit: 100, credit: 0, referenceType: 'payment' }),
    ],
  });
  assert.equal(result.summary.opening, 5000);
  assert.equal(result.summary.cashIn, 100);
  assert.equal(result.excludedFromNormalTotals.openingBalanceRows, 1);
});

test('audit/detail export still classifies excluded transfer and opening rows', () => {
  const transfer = normalizePreviewCashFlowRow(
    urow({ journalEntryLineId: 'jel-t', debit: 0, credit: 100, referenceType: 'transfer' }),
    'co',
    true
  );
  const opening = normalizePreviewCashFlowRow(
    urow({ journalEntryLineId: 'jel-o', debit: 80000, credit: 0, referenceType: 'opening_balance_account' }),
    'co',
    true
  );
  assert.equal(transfer.financeAlignmentExportLabel, 'internal_transfer_excluded_normal');
  assert.equal(opening.financeAlignmentExportLabel, 'opening_summary_only');
  assert.ok(excludeFromNormalPreviewPeriodTotals(transfer.financeAlignmentClass));
});

test('DIN CHINA transfer-leg classification', () => {
  assert.ok(isInternalTransferRow('transfer', 'transfers'));
  assert.equal(
    classifyPreviewFinanceAlignment({ referenceType: 'transfer', sourceModule: 'transfers' }),
    'internal_transfer_excluded_normal'
  );
});

test('DIN BRIDAL opening-balance classification', () => {
  assert.ok(isOpeningBalanceAccountRow('opening_balance_account', 'sales_receipts'));
  assert.equal(
    classifyPreviewFinanceAlignment({
      referenceType: 'opening_balance_account',
      sourceModule: 'sales_receipts',
    }),
    'opening_summary_only'
  );
});

test('export includes approved rule labels Q4=A Q5=C Q7=B', () => {
  const payload = buildCashFlowRowKeyedExport({
    companyId: 'co',
    dateFrom: '2026-01-01',
    dateTo: '2026-06-29',
    branchLabel: 'All branches',
    auditMode: false,
    previewBasis: 'effective_party',
    legacy: {
      rows: [],
      summary: { opening: 0, cashIn: 0, cashOut: 0, netMovement: 0, closing: 0 },
      auditMode: false,
    },
    loadResult: {
      preview: mapUnifiedRowsToCashFlowPreview({
        openingBalance: 0,
        sourceModuleFilter: 'all',
        auditMode: false,
        unifiedRows: [urow({ debit: 100, credit: 0, referenceType: 'payment' })],
      }),
      roznamchaPreview: {
        rows: [],
        unifiedRows: [urow({ debit: 100, credit: 0, referenceType: 'payment' })],
        closingBalance: 100,
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
    diff: null,
  });
  assert.equal(payload.phase, '3B-H');
  assert.equal(payload.financeRules.Q4, 'A');
  assert.equal(payload.financeRules.Q5, 'C');
  assert.equal(payload.financeRules.Q7, 'B');
  assert.equal(payload.financeAlignmentApplied, true);
  assert.ok(payload.accountingRuleNotes.some((n) => n.includes('Q4=A')));
});
