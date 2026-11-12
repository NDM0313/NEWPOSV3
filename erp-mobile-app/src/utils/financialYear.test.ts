import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLocalDateYYYYMMDD } from './localDate';
import {
  getFinancialYearRange,
  getLastFinancialYearRange,
} from './financialYear';
import { buildDateRange } from '../lib/dateRangePresets';

const OCT_SEP_CONFIG = { start: '2025-10-01', end: '2026-09-30' };
const anchor = new Date(2026, 6, 10); // 10 Jul 2026 local

test('current FY uses Oct–Sep settings for July anchor', () => {
  const { start, end } = getFinancialYearRange(OCT_SEP_CONFIG, anchor);
  assert.equal(formatLocalDateYYYYMMDD(start), '2025-10-01');
  assert.equal(formatLocalDateYYYYMMDD(end), '2026-09-30');
});

test('current FY preset caps end to today within financial year', () => {
  const range = buildDateRange('currentFinancialYear', anchor, OCT_SEP_CONFIG);
  assert.equal(range.from, '2025-10-01');
  assert.equal(range.to, '2026-07-10');
});

test('last FY uses prior Oct–Sep window', () => {
  const { start, end } = getLastFinancialYearRange(OCT_SEP_CONFIG, anchor);
  assert.equal(formatLocalDateYYYYMMDD(start), '2024-10-01');
  assert.equal(formatLocalDateYYYYMMDD(end), '2025-09-30');
});

test('last FY preset matches prior financial year', () => {
  const range = buildDateRange('lastFinancialYear', anchor, OCT_SEP_CONFIG);
  assert.equal(range.from, '2024-10-01');
  assert.equal(range.to, '2025-09-30');
});

test('null config falls back to calendar year', () => {
  const { start, end } = getFinancialYearRange(null, anchor);
  assert.equal(formatLocalDateYYYYMMDD(start), '2026-01-01');
  assert.equal(formatLocalDateYYYYMMDD(end), '2026-12-31');
});
