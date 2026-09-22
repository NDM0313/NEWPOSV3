import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveProfitLossPreviewCompareSource } from './resolveProfitLossPreviewCompareSource';

test('resolveProfitLossPreviewCompareSource legacy main', () => {
  assert.equal(resolveProfitLossPreviewCompareSource('legacy'), 'unified_compare');
});

test('resolveProfitLossPreviewCompareSource unified main', () => {
  assert.equal(resolveProfitLossPreviewCompareSource('unified'), 'legacy_shadow');
});
