import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrencyCompact } from './formatCurrency.ts';

describe('formatCurrencyCompact', () => {
  it('uses full format below 1,000', () => {
    assert.equal(formatCurrencyCompact(999, 'PKR', 2), 'Rs. 999.00');
    assert.equal(formatCurrencyCompact(0, 'PKR', 2), 'Rs. 0.00');
  });

  it('uses K notation from 1,000 upward', () => {
    assert.equal(formatCurrencyCompact(1_000, 'PKR', 2), 'Rs. 1K');
    assert.equal(formatCurrencyCompact(150_000, 'PKR', 2), 'Rs. 150K');
  });

  it('uses M notation for millions', () => {
    assert.equal(formatCurrencyCompact(1_500_000, 'PKR', 2), 'Rs. 1.5M');
  });

  it('preserves sign for negatives', () => {
    assert.match(formatCurrencyCompact(-150_000, 'PKR', 2), /^Rs\. -150K$/);
  });

  it('uses USD symbol', () => {
    assert.equal(formatCurrencyCompact(150_000, 'USD', 2), '$ 150K');
  });
});
