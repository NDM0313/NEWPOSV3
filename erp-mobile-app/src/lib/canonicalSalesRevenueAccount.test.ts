import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCanonicalSalesRevenueAccountIdFromMap } from './canonicalSalesRevenueAccount';

test('mobile resolver prefers 4100 over 4000', () => {
  const id = resolveCanonicalSalesRevenueAccountIdFromMap(
    new Map([
      ['4000', 'legacy'],
      ['4100', 'canonical'],
    ]),
  );
  assert.equal(id, 'canonical');
});

test('mobile resolver falls back to 4000 when 4100 missing', () => {
  const id = resolveCanonicalSalesRevenueAccountIdFromMap(new Map([['4000', 'legacy']]));
  assert.equal(id, 'legacy');
});
