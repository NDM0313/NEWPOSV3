import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  partyLedgerPreviewCompareLabels,
  buildPartyLedgerPreviewCompareArgs,
  resolvePartyLedgerPreviewCompareSource,
} from './resolvePartyLedgerPreviewCompareSource';
import {
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from './unifiedLedgerGoldenFixtures';
import { comparePartyLedgerUnifiedPreview } from './partyLedgerUnifiedPreviewDiff';
import type { EffectiveLedgerResult } from '@/app/services/effectivePartyLedgerService';

function legacyFixture(closing = MR_JALIL_EXPECTED_BALANCE): EffectiveLedgerResult {
  return {
    rows: [],
    summary: {
      openingBalance: 0,
      totalDebit: 0,
      totalCredit: 0,
      closingBalance: closing,
      totalSales: 0,
      totalReceived: 0,
      totalPurchases: 0,
      totalPaid: 0,
    },
    partyName: 'MR JALIL',
    partyType: 'customer',
  };
}

test('Party Ledger loader OFF → main legacy, preview unified compare', () => {
  assert.equal(resolvePartyLedgerPreviewCompareSource('legacy'), 'unified_compare');
  const labels = partyLedgerPreviewCompareLabels('unified_compare', {
    legacyEngineLabel: 'Legacy PL',
    unifiedBasisLabel: 'Effective party',
  });
  assert.match(labels.panelTitle, /Unified engine preview/i);
});

test('Party Ledger loader ON → main unified, preview legacy shadow compare', () => {
  assert.equal(resolvePartyLedgerPreviewCompareSource('unified'), 'legacy_shadow');
  const labels = partyLedgerPreviewCompareLabels('legacy_shadow', {
    legacyEngineLabel: 'Legacy PL',
    unifiedBasisLabel: 'Effective party',
  });
  assert.match(labels.panelTitle, /Legacy shadow compare/i);
  assert.match(labels.newEngineName, /Unified main/i);
});

test('Party Ledger legacy shadow compare maps shadow as legacy side', () => {
  const mainUnified = legacyFixture(MR_JALIL_EXPECTED_BALANCE);
  const shadowLegacy = legacyFixture(200_000);
  const mapped = buildPartyLedgerPreviewCompareArgs({
    compareSource: 'legacy_shadow',
    mainResult: mainUnified,
    mainUnifiedRows: [],
    shadowLegacy,
    shadowUnifiedRows: [],
    shadowClosingBalance: 200_000,
    shadowOpeningBalance: 0,
  });
  assert.equal(mapped.legacy.summary.closingBalance, 200_000);
  assert.equal(mapped.unifiedClosingBalance, MR_JALIL_EXPECTED_BALANCE);
});

test('Party Ledger MR JALIL golden balance in unified compare', () => {
  const diff = comparePartyLedgerUnifiedPreview({
    legacy: legacyFixture(200_000),
    unifiedRows: [],
    unifiedClosingBalance: MR_JALIL_EXPECTED_BALANCE,
    unifiedOpeningBalance: 0,
    contactId: MR_JALIL_CONTACT_ID,
  });
  assert.equal(diff.newClosing, MR_JALIL_EXPECTED_BALANCE);
  assert.equal(diff.goldenPass, true);
});

test('Party Ledger rollback OFF restores unified compare source', () => {
  assert.equal(resolvePartyLedgerPreviewCompareSource('legacy'), 'unified_compare');
});
