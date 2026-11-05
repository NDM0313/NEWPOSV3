import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getFinancialYearRange,
  getLastFinancialYearRange,
  normalizeFiscalYearConfig,
} from './financialYear.ts';
import { formatLocalDateYYYYMMDD } from './localDate.ts';

describe('financialYear', () => {
  const anchor = new Date(2026, 5, 14); // 14 Jun 2026 local

  it('uses explicit Oct–Sep fiscal window for current FY', () => {
    const config = normalizeFiscalYearConfig('2025-10-01', '2026-09-30');
    const { start, end } = getFinancialYearRange(config, anchor);
    assert.equal(formatLocalDateYYYYMMDD(start), '2025-10-01');
    assert.equal(formatLocalDateYYYYMMDD(end), '2026-09-30');
  });

  it('computes last FY as prior Oct–Sep period', () => {
    const config = normalizeFiscalYearConfig('2025-10-01', '2026-09-30');
    const { start, end } = getLastFinancialYearRange(config, anchor);
    assert.equal(formatLocalDateYYYYMMDD(start), '2024-10-01');
    assert.equal(formatLocalDateYYYYMMDD(end), '2025-09-30');
  });

  it('falls back to calendar year when config missing', () => {
    const { start, end } = getFinancialYearRange(null, anchor);
    assert.equal(formatLocalDateYYYYMMDD(start), '2026-01-01');
    assert.equal(formatLocalDateYYYYMMDD(end), '2026-12-31');
  });

  it('supports legacy start-only string', () => {
    const { start, end } = getFinancialYearRange('2025-10-01', anchor);
    assert.equal(formatLocalDateYYYYMMDD(start), '2025-10-01');
    assert.equal(formatLocalDateYYYYMMDD(end), '2026-09-30');
  });
});
