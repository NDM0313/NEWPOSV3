import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDateRange } from './dateRangePresets';
import { getLastBusinessWeekRange, getThisBusinessWeekRange } from '../utils/businessWeek';
import { getLastFinancialYearRange } from '../utils/financialYear';
import { formatLocalDateYYYYMMDD } from '../utils/localDate';

test('this week matches business week helper', () => {
  const anchor = new Date('2026-06-05T12:00:00'); // Thursday
  const range = buildDateRange('week', anchor);
  const { startDate, endDate } = getThisBusinessWeekRange(anchor);
  assert.equal(range.from, formatLocalDateYYYYMMDD(startDate));
  assert.equal(range.to, formatLocalDateYYYYMMDD(endDate));
});

test('last week matches previous Sat–Fri window', () => {
  const anchor = new Date('2026-06-05T12:00:00');
  const range = buildDateRange('lastWeek', anchor);
  const { startDate, endDate } = getLastBusinessWeekRange(anchor);
  assert.equal(range.from, formatLocalDateYYYYMMDD(startDate));
  assert.equal(range.to, formatLocalDateYYYYMMDD(endDate));
});

test('last week ends before this week starts', () => {
  const anchor = new Date('2026-06-05T12:00:00');
  const last = buildDateRange('lastWeek', anchor);
  const current = buildDateRange('week', anchor);
  assert.ok(last.to < current.from);
});

test('current FY uses branch fiscal year start through anchor day', () => {
  const anchor = new Date('2026-06-05T12:00:00');
  const range = buildDateRange('currentFy', anchor, '2025-07-01');
  assert.equal(range.from, '2025-07-01');
  assert.equal(range.to, '2026-06-05');
});

test('last FY ends the day before current FY start', () => {
  const anchor = new Date('2026-06-05T12:00:00');
  const range = buildDateRange('lastFy', anchor, '2025-07-01');
  const { start, end } = getLastFinancialYearRange('2025-07-01', anchor);
  assert.equal(range.from, formatLocalDateYYYYMMDD(start));
  assert.equal(range.to, formatLocalDateYYYYMMDD(end));
  assert.equal(range.to, '2025-06-30');
});

test('from start matches ten-year window through anchor', () => {
  const anchor = new Date('2026-06-05T12:00:00');
  const range = buildDateRange('fromStart', anchor);
  assert.equal(range.from, '2016-01-01');
  assert.equal(range.to, '2026-06-05');
});
