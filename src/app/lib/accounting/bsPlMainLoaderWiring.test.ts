import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveBalanceSheetPreviewCompareSource } from './resolveBalanceSheetPreviewCompareSource';
import { resolveProfitLossPreviewCompareSource } from './resolveProfitLossPreviewCompareSource';
import {
  effectiveBalanceSheetMainLoaderSource,
  resolveBalanceSheetMainLoaderFromFlags,
} from './resolveBalanceSheetMainLoaderSource';
import {
  effectiveProfitLossMainLoaderSource,
  resolveProfitLossMainLoaderFromFlags,
} from './resolveProfitLossMainLoaderSource';

test('Balance Sheet preview compare flips when main loader unified', () => {
  assert.equal(resolveBalanceSheetPreviewCompareSource('legacy'), 'unified_compare');
  assert.equal(resolveBalanceSheetPreviewCompareSource('unified'), 'legacy_shadow');
});

test('P&L preview compare flips when main loader unified', () => {
  assert.equal(resolveProfitLossPreviewCompareSource('legacy'), 'unified_compare');
  assert.equal(resolveProfitLossPreviewCompareSource('unified'), 'legacy_shadow');
});

test('main loader remains legacy when any gate off', () => {
  const bs = resolveBalanceSheetMainLoaderFromFlags({
    killSwitchActive: false,
    loaderFlagEnabled: true,
    companyEngineEnabled: true,
    screenFlagEnabled: false,
  });
  assert.equal(effectiveBalanceSheetMainLoaderSource({
    source: bs,
    reason: 'legacy_screen_off',
    killSwitchActive: false,
    loaderFlagEnabled: true,
    companyEngineEnabled: true,
    screenFlagEnabled: false,
  }), 'legacy');

  const pl = resolveProfitLossMainLoaderFromFlags({
    killSwitchActive: false,
    loaderFlagEnabled: false,
    companyEngineEnabled: true,
    screenFlagEnabled: true,
  });
  assert.equal(effectiveProfitLossMainLoaderSource({
    source: pl,
    reason: 'legacy_loader_off',
    killSwitchActive: false,
    loaderFlagEnabled: false,
    companyEngineEnabled: true,
    screenFlagEnabled: true,
  }), 'legacy');
});

test('unified error fallback path uses legacy effective source', () => {
  assert.equal(
    effectiveBalanceSheetMainLoaderSource({
      source: 'legacy',
      reason: 'legacy_error_fallback',
      killSwitchActive: false,
      loaderFlagEnabled: false,
      companyEngineEnabled: false,
      screenFlagEnabled: false,
    }),
    'legacy',
  );
});
