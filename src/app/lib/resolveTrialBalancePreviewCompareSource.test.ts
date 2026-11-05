import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildTrialBalancePreviewCompareArgs,
  resolveTrialBalancePreviewCompareSource,
  trialBalancePreviewCompareLabels,
} from './resolveTrialBalancePreviewCompareSource';
import { compareTrialBalanceUnifiedPreview } from './trialBalanceUnifiedPreviewDiff';
import type { TrialBalanceResult } from '@/app/services/accountingReportsService';

function tb(debit: number, credit: number): TrialBalanceResult {
  return {
    rows: [],
    totalDebit: debit,
    totalCredit: credit,
    difference: debit - credit,
  };
}

test('Trial Balance loader OFF → unified_compare preview', () => {
  assert.equal(resolveTrialBalancePreviewCompareSource('legacy'), 'unified_compare');
});

test('Trial Balance loader ON → legacy_shadow preview', () => {
  assert.equal(resolveTrialBalancePreviewCompareSource('unified'), 'legacy_shadow');
  const labels = trialBalancePreviewCompareLabels('legacy_shadow', {
    legacyEngineLabel: 'Legacy TB',
    unifiedBasisLabel: 'Official GL',
  });
  assert.match(labels.panelTitle, /Legacy shadow compare/i);
});

test('Trial Balance legacy shadow compare args invert sides', () => {
  const main = tb(1000, 1000);
  const shadow = tb(900, 900);
  const args = buildTrialBalancePreviewCompareArgs({
    compareSource: 'legacy_shadow',
    mainData: main,
    mainAccounts: [],
    shadowData: shadow,
    shadowAccounts: [],
  });
  assert.equal(args.legacy.totalDebit, 900);
  assert.equal(args.unifiedTotalDebit, 1000);
});

test('Trial Balance total debit equals total credit in balanced fixture', () => {
  const balanced = tb(500_000, 500_000);
  const diff = compareTrialBalanceUnifiedPreview({
    legacy: balanced,
    unifiedAccounts: [],
    unifiedTotalDebit: 500_000,
    unifiedTotalCredit: 500_000,
    unifiedDifference: 0,
  });
  assert.equal(diff.totalsPass, true);
  assert.equal(diff.pass, true);
});

test('Trial Balance rollback restores unified_compare', () => {
  assert.equal(resolveTrialBalancePreviewCompareSource('legacy'), 'unified_compare');
});
