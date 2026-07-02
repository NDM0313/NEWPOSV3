import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveBalanceSheetPreviewCompareSource } from './resolveBalanceSheetPreviewCompareSource';

test('resolveBalanceSheetPreviewCompareSource legacy main', () => {
  assert.equal(resolveBalanceSheetPreviewCompareSource('legacy'), 'unified_compare');
});

test('resolveBalanceSheetPreviewCompareSource unified main', () => {
  assert.equal(resolveBalanceSheetPreviewCompareSource('unified'), 'legacy_shadow');
});
