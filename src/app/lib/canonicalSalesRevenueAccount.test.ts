import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_SALES_REVENUE_CODE,
  FALLBACK_SALES_REVENUE_CODE,
  CanonicalSalesRevenueAccountError,
  resolveCanonicalSalesRevenueFromAccounts,
} from './canonicalSalesRevenueAccount';

test('prefers 4100 when both 4100 and 4000 exist', () => {
  const resolved = resolveCanonicalSalesRevenueFromAccounts([
    { id: 'a-4000', code: '4000' },
    { id: 'a-4100', code: '4100' },
  ]);
  assert.equal(resolved.id, 'a-4100');
  assert.equal(resolved.code, CANONICAL_SALES_REVENUE_CODE);
});

test('falls back to 4000 only when 4100 is missing', () => {
  const resolved = resolveCanonicalSalesRevenueFromAccounts([{ id: 'a-4000', code: '4000' }]);
  assert.equal(resolved.id, 'a-4000');
  assert.equal(resolved.code, FALLBACK_SALES_REVENUE_CODE);
});

test('throws when neither 4100 nor 4000 exists', () => {
  assert.throws(
    () => resolveCanonicalSalesRevenueFromAccounts([{ id: 'a-5000', code: '5000' }]),
    CanonicalSalesRevenueAccountError,
  );
});

test('historical split does not merge balances — resolver picks one account only', () => {
  const resolved = resolveCanonicalSalesRevenueFromAccounts([
    { id: 'hist-4000', code: '4000' },
    { id: 'hist-4100', code: '4100' },
  ]);
  assert.equal(resolved.id, 'hist-4100');
  assert.notEqual(resolved.id, 'hist-4000');
});

test('P&L double-count guard — single canonical pick per posting', () => {
  const a = resolveCanonicalSalesRevenueFromAccounts([
    { id: '1', code: '4100' },
    { id: '2', code: '4000' },
  ]);
  const b = resolveCanonicalSalesRevenueFromAccounts([
    { id: '1', code: '4100' },
    { id: '2', code: '4000' },
  ]);
  assert.equal(a.id, b.id);
});
