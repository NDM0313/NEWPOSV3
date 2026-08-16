import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_SALES_REVENUE_CODE,
  FALLBACK_SALES_REVENUE_CODE,
  CanonicalSalesRevenueAccountError,
  resolveCanonicalSalesRevenueFromAccounts,
} from './canonicalSalesRevenueAccount';

test('prefers 4000 when both 4000 and 4100 exist', () => {
  const resolved = resolveCanonicalSalesRevenueFromAccounts([
    { id: 'a-4000', code: '4000' },
    { id: 'a-4100', code: '4100' },
  ]);
  assert.equal(resolved.id, 'a-4000');
  assert.equal(resolved.code, CANONICAL_SALES_REVENUE_CODE);
});

test('falls back to 4100 only when 4000 is missing', () => {
  const resolved = resolveCanonicalSalesRevenueFromAccounts([{ id: 'a-4100', code: '4100' }]);
  assert.equal(resolved.id, 'a-4100');
  assert.equal(resolved.code, FALLBACK_SALES_REVENUE_CODE);
});

test('throws when neither 4000 nor 4100 exists', () => {
  assert.throws(
    () => resolveCanonicalSalesRevenueFromAccounts([{ id: 'a-5000', code: '5000' }]),
    CanonicalSalesRevenueAccountError,
  );
});

test('historical 4100 import data is not rewritten — resolver picks 4000 for new postings', () => {
  const resolved = resolveCanonicalSalesRevenueFromAccounts([
    { id: 'hist-4000', code: '4000' },
    { id: 'hist-4100', code: '4100' },
  ]);
  assert.equal(resolved.id, 'hist-4000');
  assert.notEqual(resolved.id, 'hist-4100');
});

test('P&L double-count guard — single canonical pick per posting', () => {
  const a = resolveCanonicalSalesRevenueFromAccounts([
    { id: '1', code: '4000' },
    { id: '2', code: '4100' },
  ]);
  const b = resolveCanonicalSalesRevenueFromAccounts([
    { id: '1', code: '4000' },
    { id: '2', code: '4100' },
  ]);
  assert.equal(a.id, b.id);
});

test('sale return path uses same canonical 4000 when available', () => {
  const resolved = resolveCanonicalSalesRevenueFromAccounts([
    { id: 'rev-4000', code: '4000' },
    { id: 'rev-4100', code: '4100' },
  ]);
  assert.equal(resolved.code, '4000');
});
