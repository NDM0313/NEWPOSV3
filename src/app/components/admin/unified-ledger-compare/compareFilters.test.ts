import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCompareDateRange } from './compareFilters';

test('normalizeCompareDateRange lifetime scope when From empty', () => {
  assert.deepEqual(normalizeCompareDateRange('', '2026-06-14'), {
    dateFrom: null,
    dateTo: null,
  });
  assert.deepEqual(normalizeCompareDateRange(null, '2026-06-14'), {
    dateFrom: null,
    dateTo: null,
  });
});

test('normalizeCompareDateRange preserves period when From set', () => {
  assert.deepEqual(normalizeCompareDateRange('2026-01-01', '2026-06-14'), {
    dateFrom: '2026-01-01',
    dateTo: '2026-06-14',
  });
  assert.deepEqual(normalizeCompareDateRange('2026-01-01', ''), {
    dateFrom: '2026-01-01',
    dateTo: null,
  });
});
