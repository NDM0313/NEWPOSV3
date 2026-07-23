import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCanonicalSalesRevenueAccountIdFromMap } from './canonicalSalesRevenueAccount';

test('mobile resolver prefers 4000 over 4100', () => {
  const id = resolveCanonicalSalesRevenueAccountIdFromMap(
    new Map([
      ['4000', 'canonical'],
      ['4100', 'import-fallback'],
    ]),
  );
  assert.equal(id, 'canonical');
});

test('mobile resolver falls back to 4100 when 4000 missing', () => {
  const id = resolveCanonicalSalesRevenueAccountIdFromMap(new Map([['4100', 'import-fallback']]));
  assert.equal(id, 'import-fallback');
});
