import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  roznamchaPreviewCompareLabels,
  buildRoznamchaPreviewCompareArgs,
  resolveRoznamchaPreviewCompareSource,
} from './resolveRoznamchaPreviewCompareSource';
import { compareRoznamchaUnifiedPreview } from './roznamchaUnifiedPreviewDiff';
import type { RoznamchaResult } from '@/app/services/roznamchaService';

function legacyFixture(closing = 50000): RoznamchaResult {
  return {
    rows: [],
    summary: {
      openingBalance: 0,
      cashIn: 100000,
      cashOut: 50000,
      closingBalance: closing,
    },
    cashSplit: { cash: closing, bank: 0, wallet: 0, total: closing },
  };
}

test('Roznamcha loader OFF → main legacy, preview unified compare', () => {
  assert.equal(resolveRoznamchaPreviewCompareSource('legacy'), 'unified_compare');
  const labels = roznamchaPreviewCompareLabels('unified_compare', {
    legacyEngineLabel: 'Legacy Roznamcha',
    unifiedBasisLabel: 'Effective party',
  });
  assert.match(labels.panelTitle, /Unified engine preview/i);
});

test('Roznamcha loader ON → main unified, preview legacy shadow compare', () => {
  assert.equal(resolveRoznamchaPreviewCompareSource('unified'), 'legacy_shadow');
  const labels = roznamchaPreviewCompareLabels('legacy_shadow', {
    legacyEngineLabel: 'Legacy Roznamcha',
    unifiedBasisLabel: 'Effective party',
  });
  assert.match(labels.panelTitle, /Legacy shadow compare/i);
});

test('Roznamcha legacy shadow compare maps shadow as legacy side', () => {
  const mainUnified = legacyFixture(75000);
  const shadowLegacy = legacyFixture(50000);
  const mapped = buildRoznamchaPreviewCompareArgs({
    compareSource: 'legacy_shadow',
    mainResult: mainUnified,
    mainUnifiedRows: [],
    shadowLegacy,
    shadowUnifiedRows: [],
    shadowClosingBalance: 50000,
    shadowOpeningBalance: 0,
  });
  assert.equal(mapped.legacy.summary.closingBalance, 50000);
  assert.equal(mapped.unifiedClosingBalance, 75000);
});

test('Roznamcha golden totals pass when closing matches', () => {
  const diff = compareRoznamchaUnifiedPreview({
    legacy: {
      rows: [],
      summary: { openingBalance: 0, cashIn: 0, cashOut: 0, closingBalance: 100000 },
      cashSplit: { cash: 100000, bank: 0, wallet: 0, total: 100000 },
    },
    unifiedRows: [],
    unifiedClosingBalance: 100000,
    unifiedOpeningBalance: 0,
  });
  assert.equal(diff.totalsPass, true);
  assert.equal(diff.difference, 0);
});

test('Roznamcha rollback OFF restores unified compare source', () => {
  assert.equal(resolveRoznamchaPreviewCompareSource('legacy'), 'unified_compare');
});
