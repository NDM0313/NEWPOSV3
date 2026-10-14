import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import {
  assertUnifiedMainLoaderSource,
  R8_R2_LEGACY_MAIN_RETIRED_MESSAGE,
} from './r8R2LegacyMainRetired';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

function readRepo(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

const DELETED_WRAPPERS = [
  'src/app/services/accountStatementLegacyMainService.ts',
  'src/app/services/trialBalanceLegacyMainService.ts',
  'src/app/services/partyLedgerLegacyMainService.ts',
  'src/app/services/roznamchaLegacyMainService.ts',
] as const;

const PAGES = [
  'src/app/components/reports/AccountLedgerReportPage.tsx',
  'src/app/components/reports/TrialBalancePage.tsx',
  'src/app/components/accounting/EffectivePartyLedgerPage.tsx',
  'src/app/components/reports/RoznamchaReport.tsx',
  'src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx',
  'src/app/components/reports/CashFlowReportPage.tsx',
] as const;

test('assertUnifiedMainLoaderSource allows unified and rejects legacy', () => {
  assert.doesNotThrow(() => assertUnifiedMainLoaderSource('unified'));
  assert.throws(
    () => assertUnifiedMainLoaderSource('legacy'),
    (err: unknown) => err instanceof Error && err.message === R8_R2_LEGACY_MAIN_RETIRED_MESSAGE,
  );
});

test('thin LegacyMainService wrappers are deleted', () => {
  for (const rel of DELETED_WRAPPERS) {
    assert.equal(existsSync(path.join(repoRoot, rel)), false, rel);
  }
});

test('approved report pages assert unified main and do not import deleted wrappers', () => {
  for (const rel of PAGES) {
    const src = readRepo(rel);
    assert.match(src, /assertUnifiedMainLoaderSource/);
    assert.doesNotMatch(src, /LegacyMainService/);
    assert.doesNotMatch(src, /loadAccountStatementLegacyMain|loadTrialBalanceLegacyMain|loadPartyLedgerLegacyMain|loadRoznamchaLegacyMain/);
  }
});

test('shadow compare services retained and no longer import LegacyMain wrappers', () => {
  const shadows = [
    'src/app/services/accountStatementLegacyShadowPreviewService.ts',
    'src/app/services/trialBalanceLegacyShadowPreviewService.ts',
    'src/app/services/partyLedgerLegacyShadowPreviewService.ts',
    'src/app/services/roznamchaLegacyShadowPreviewService.ts',
    'src/app/services/ledgerStatementCenterV2LegacyShadowPreviewService.ts',
  ];
  for (const rel of shadows) {
    const src = readRepo(rel);
    assert.doesNotMatch(src, /LegacyMainService/);
    assert.match(src, /legacy_shadow|LegacyShadow|getLedgerStatementV2/);
  }
});

test('BS/P&L error fallback pages still reference legacy getBalanceSheet/getProfitLoss', () => {
  const bs = readRepo('src/app/components/reports/BalanceSheetPage.tsx');
  const pl = readRepo('src/app/components/reports/ProfitLossPage.tsx');
  assert.match(bs, /getBalanceSheet/);
  assert.match(pl, /getProfitLoss/);
  assert.match(bs, /falling back to legacy/);
  assert.match(pl, /falling back to legacy/);
});
