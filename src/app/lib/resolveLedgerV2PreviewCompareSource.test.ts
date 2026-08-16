import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildLedgerV2PreviewCompareRows,
  ledgerV2PreviewCompareLabels,
  resolveLedgerV2PreviewCompareSource,
} from './resolveLedgerV2PreviewCompareSource';
import {
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from './unifiedLedgerGoldenFixtures';
import { compareLedgerV2UnifiedPreview } from './ledgerStatementV2UnifiedPreviewDiff';
import type { LedgerStatementV2Row } from '@/app/features/ledger-statement-center-v2/types';

function row(id: string, balance: number): LedgerStatementV2Row {
  return {
    id,
    date: '2026-01-15',
    referenceNo: `REF-${id}`,
    transactionType: 'sale',
    description: 'test',
    branch: 'Main',
    debit: 0,
    credit: 0,
    runningBalance: balance,
    paymentMethod: '',
    createdBy: 'test',
    hasAttachments: false,
    sourceKind: 'sale',
  };
}

test('loader OFF → main legacy, preview unified compare', () => {
  assert.equal(resolveLedgerV2PreviewCompareSource('legacy'), 'unified_compare');
  const labels = ledgerV2PreviewCompareLabels('unified_compare', {
    legacyEngineLabel: 'Legacy V2',
    unifiedBasisLabel: 'Effective party',
  });
  assert.match(labels.panelTitle, /Unified engine preview/i);
  assert.doesNotMatch(labels.panelTitle, /legacy shadow/i);
});

test('loader ON → main unified, preview legacy shadow compare', () => {
  assert.equal(resolveLedgerV2PreviewCompareSource('unified'), 'legacy_shadow');
  const labels = ledgerV2PreviewCompareLabels('legacy_shadow', {
    legacyEngineLabel: 'Legacy V2 (hybrid customer loader)',
    unifiedBasisLabel: 'Effective party',
  });
  assert.match(labels.panelTitle, /Legacy shadow compare/i);
  assert.match(labels.newEngineName, /Unified main/i);
});

test('loader rollback OFF restores unified compare labels', () => {
  const afterRollback = resolveLedgerV2PreviewCompareSource('legacy');
  assert.equal(afterRollback, 'unified_compare');
});

test('legacy shadow row mapping is not unified vs unified', () => {
  const mainUnified = [row('u-main', MR_JALIL_EXPECTED_BALANCE)];
  const shadowLegacy = [row('l-shadow', MR_JALIL_EXPECTED_BALANCE)];
  const mapped = buildLedgerV2PreviewCompareRows({
    compareSource: 'legacy_shadow',
    mainRows: mainUnified,
    shadowRows: shadowLegacy,
  });
  assert.equal(mapped.legacyRows[0].id, 'l-shadow');
  assert.equal(mapped.previewRows[0].id, 'u-main');
  assert.notEqual(mapped.legacyRows[0].id, mapped.previewRows[0].id);
});

test('unified compare row mapping keeps main as legacy side', () => {
  const mainLegacy = [row('l-main', MR_JALIL_EXPECTED_BALANCE)];
  const shadowUnified = [row('u-shadow', MR_JALIL_EXPECTED_BALANCE)];
  const mapped = buildLedgerV2PreviewCompareRows({
    compareSource: 'unified_compare',
    mainRows: mainLegacy,
    shadowRows: shadowUnified,
  });
  assert.equal(mapped.legacyRows[0].id, 'l-main');
  assert.equal(mapped.previewRows[0].id, 'u-shadow');
});

test('MR JALIL closing 216300 in both main and compare (legacy shadow)', () => {
  const mainUnified = [row('u-main', MR_JALIL_EXPECTED_BALANCE)];
  const shadowLegacy = [row('l-shadow', MR_JALIL_EXPECTED_BALANCE)];
  const { legacyRows, previewRows } = buildLedgerV2PreviewCompareRows({
    compareSource: 'legacy_shadow',
    mainRows: mainUnified,
    shadowRows: shadowLegacy,
  });
  const diff = compareLedgerV2UnifiedPreview({
    legacyRows,
    previewRows,
    statementType: 'customer',
    entityId: MR_JALIL_CONTACT_ID,
  });
  assert.equal(diff.oldClosing, MR_JALIL_EXPECTED_BALANCE);
  assert.equal(diff.newClosing, MR_JALIL_EXPECTED_BALANCE);
  assert.equal(diff.goldenPass, true);
  assert.equal(diff.pass, true);
});

test('MR JALIL closing 216300 in both main and compare (unified compare)', () => {
  const mainLegacy = [row('l-main', MR_JALIL_EXPECTED_BALANCE)];
  const shadowUnified = [row('u-shadow', MR_JALIL_EXPECTED_BALANCE)];
  const { legacyRows, previewRows } = buildLedgerV2PreviewCompareRows({
    compareSource: 'unified_compare',
    mainRows: mainLegacy,
    shadowRows: shadowUnified,
  });
  const diff = compareLedgerV2UnifiedPreview({
    legacyRows,
    previewRows,
    statementType: 'customer',
    entityId: MR_JALIL_CONTACT_ID,
  });
  assert.equal(diff.oldClosing, MR_JALIL_EXPECTED_BALANCE);
  assert.equal(diff.newClosing, MR_JALIL_EXPECTED_BALANCE);
  assert.equal(diff.goldenPass, true);
});

test('exports follow active main rows — unified main unchanged by preview invert', () => {
  const mainUnified = [row('m1', 50_000), row('m2', MR_JALIL_EXPECTED_BALANCE)];
  const exportClosing = mainUnified[mainUnified.length - 1].runningBalance;
  assert.equal(exportClosing, MR_JALIL_EXPECTED_BALANCE);
  const shadowLegacy = [row('s1', MR_JALIL_EXPECTED_BALANCE)];
  const mapped = buildLedgerV2PreviewCompareRows({
    compareSource: 'legacy_shadow',
    mainRows: mainUnified,
    shadowRows: shadowLegacy,
  });
  assert.equal(mapped.previewRows, mainUnified);
  assert.notEqual(mapped.previewRows, mapped.legacyRows);
});
