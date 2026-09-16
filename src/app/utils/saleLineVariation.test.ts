import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coerceUuidOrNull } from './uuidCoerce';
import {
  formatSaleLineVariationText,
  normalizeVariationIdForPersist,
  shouldShowSaleLineVariations,
} from './saleLineVariation';

const SAMPLE_UUID = '71c8a39d-b31f-458b-801f-34c964fb9cb1';

test('coerceUuidOrNull rejects object without valid id', () => {
  assert.equal(coerceUuidOrNull({ foo: 'bar' }), null);
  assert.equal(coerceUuidOrNull('[object Object]'), null);
});

test('coerceUuidOrNull extracts id from contact-like object', () => {
  assert.equal(coerceUuidOrNull({ id: SAMPLE_UUID }), SAMPLE_UUID);
});

test('shouldShowSaleLineVariations hides single empty sentinel variation', () => {
  assert.equal(
    shouldShowSaleLineVariations(undefined, [
      { id: 'v1', attributes: { __erp_purchase_price: '0' } },
    ]),
    false,
  );
});

test('shouldShowSaleLineVariations shows multi-variation products', () => {
  assert.equal(
    shouldShowSaleLineVariations(undefined, [
      { id: 'a', size: 'BLUE' },
      { id: 'b', size: 'WHITE' },
    ]),
    true,
  );
});

test('normalizeVariationIdForPersist strips sentinel-only metadata', () => {
  assert.equal(
    normalizeVariationIdForPersist(SAMPLE_UUID, undefined, [
      { id: SAMPLE_UUID, attributes: {} },
    ]),
    undefined,
  );
});

test('normalizeVariationIdForPersist keeps id when catalog not loaded', () => {
  assert.equal(normalizeVariationIdForPersist(SAMPLE_UUID, undefined, []), SAMPLE_UUID);
});

test('formatSaleLineVariationText hides internal erp keys', () => {
  assert.equal(
    formatSaleLineVariationText({ attributes: { __erp_purchase_price: '0' } }),
    null,
  );
  assert.equal(formatSaleLineVariationText({ size: 'BLUE', color: 'WHITE' }), 'BLUE / WHITE');
});
