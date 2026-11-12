import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accountStatementPreviewCompareLabels,
  buildAccountStatementPreviewCompareRows,
  resolveAccountStatementPreviewCompareSource,
} from './resolveAccountStatementPreviewCompareSource';
import {
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from './unifiedLedgerGoldenFixtures';
import { compareAccountStatementUnifiedPreview } from './accountStatementUnifiedPreviewDiff';
import type { AccountLedgerEntry } from '@/app/services/accountingService';

function entry(id: string, balance: number): AccountLedgerEntry {
  return {
    date: '2026-01-15',
    reference_number: `REF-${id}`,
    description: 'test',
    debit: 0,
    credit: 0,
    running_balance: balance,
  };
}

test('Account Statement loader OFF → main legacy, preview unified compare', () => {
  assert.equal(resolveAccountStatementPreviewCompareSource('legacy'), 'unified_compare');
  const labels = accountStatementPreviewCompareLabels('unified_compare', {
    legacyEngineLabel: 'Legacy AS',
    unifiedBasisLabel: 'Effective party',
  });
  assert.match(labels.panelTitle, /Unified engine preview/i);
});

test('Account Statement loader ON → main unified, preview legacy shadow compare', () => {
  assert.equal(resolveAccountStatementPreviewCompareSource('unified'), 'legacy_shadow');
  const labels = accountStatementPreviewCompareLabels('legacy_shadow', {
    legacyEngineLabel: 'Legacy AS (hybrid customer loader)',
    unifiedBasisLabel: 'Effective party',
  });
  assert.match(labels.panelTitle, /Legacy shadow compare/i);
  assert.match(labels.newEngineName, /Unified main/i);
});

test('Account Statement legacy shadow row mapping is not unified vs unified', () => {
  const mainUnified = [entry('u-main', MR_JALIL_EXPECTED_BALANCE)];
  const shadowLegacy = [entry('l-shadow', MR_JALIL_EXPECTED_BALANCE)];
  const mapped = buildAccountStatementPreviewCompareRows({
    compareSource: 'legacy_shadow',
    mainEntries: mainUnified,
    shadowEntries: shadowLegacy,
  });
  assert.equal(mapped.legacyEntries[0].reference_number, 'REF-l-shadow');
  assert.equal(mapped.previewEntries[0].reference_number, 'REF-u-main');
});

test('Account Statement MR JALIL golden balance in unified compare', () => {
  const diff = compareAccountStatementUnifiedPreview({
    legacyEntries: [entry('l1', 200_000)],
    previewEntries: [entry('u1', MR_JALIL_EXPECTED_BALANCE)],
    statementType: 'customer',
    partyId: MR_JALIL_CONTACT_ID,
  });
  assert.equal(diff.newClosing, MR_JALIL_EXPECTED_BALANCE);
  assert.equal(diff.goldenPass, true);
});

test('Account Statement rollback OFF restores unified compare labels', () => {
  assert.equal(resolveAccountStatementPreviewCompareSource('legacy'), 'unified_compare');
});
