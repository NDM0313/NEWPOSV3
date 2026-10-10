import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  rankProductSearchHit,
  matchesProductSku,
  preferExactSkuHits,
  hasWordBoundaryDigitMatch,
} from './productSearchRank.ts';

describe('productSearchRank', () => {
  it('ranks exact SKU numeric first', () => {
    assert.equal(rankProductSearchHit({ name: 'Shirt', sku: 'PRD-1296' }, '1296'), 0);
    assert.equal(rankProductSearchHit({ name: 'Shirt', sku: 'PRD-1296' }, 'PRD-1296'), 0);
  });

  it('does not match short reverse-substring SKUs for 1296', () => {
    assert.equal(rankProductSearchHit({ name: 'X', sku: 'PRD-12' }, '1296'), 99);
    assert.equal(rankProductSearchHit({ name: 'X', sku: 'PRD-129' }, '1296'), 99);
    assert.equal(matchesProductSku('PRD-12', '1296'), false);
  });

  it('matches title whole-number after exact SKU', () => {
    assert.equal(rankProductSearchHit({ name: 'Size 1296 Shirt', sku: 'PRD-9999' }, '1296'), 3);
    assert.equal(hasWordBoundaryDigitMatch('Size 1296 Shirt', '1296'), true);
    assert.equal(hasWordBoundaryDigitMatch('Size 12960 Shirt', '1296'), false);
  });

  it('preferExactSkuHits drops name-only when exact SKU exists', () => {
    const items = [
      { name: 'Other 1296', sku: 'ABC-1' },
      { name: 'Shirt', sku: 'PRD-1296' },
    ];
    const filtered = preferExactSkuHits(
      items.filter((p) => rankProductSearchHit(p, '1296') < 99),
      '1296',
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].sku, 'PRD-1296');
  });

  it('does not treat 12960 as a match for 1296', () => {
    assert.equal(rankProductSearchHit({ name: 'X', sku: 'PRD-12960' }, '1296'), 99);
  });

  it('matches any prefix when SKU digits equal query', () => {
    assert.equal(rankProductSearchHit({ name: 'X', sku: 'CUSTOM-1296' }, '1296'), 0);
  });
});
