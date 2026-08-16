import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDateRange } from './dateRangePresets';
import { getLastBusinessWeekRange, getThisBusinessWeekRange } from '../utils/businessWeek';
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
