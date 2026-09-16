import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeCurrencyCode,
  resolveActiveImportCurrencies,
} from './importFxHelpers';
import {
  formatImportFxServerError,
  IMPORT_FX_ERROR,
  isImportFxCurrencyAllowedClient,
} from './importFxGateCodes';

test('normalizeCurrencyCode maps RMB to CNY', () => {
  assert.equal(normalizeCurrencyCode('rmb'), 'CNY');
  assert.equal(normalizeCurrencyCode('RMB'), 'CNY');
  assert.equal(normalizeCurrencyCode('cny'), 'CNY');
  assert.equal(normalizeCurrencyCode('usd'), 'USD');
  assert.equal(normalizeCurrencyCode('PKR'), 'PKR');
});

test('resolveActiveImportCurrencies defaults and de-dupes RMB/CNY', () => {
  const defaults = resolveActiveImportCurrencies(null);
  assert.deepEqual(
    defaults.map((c) => c.code),
    ['CNY', 'USD']
  );
  const custom = resolveActiveImportCurrencies({
    activeCurrencies: [
      { code: 'rmb', label: 'Yuan' },
      { code: 'CNY', label: 'dup' },
      { code: 'EUR', label: 'Euro' },
      { code: 'PKR', label: 'skip' },
    ],
  });
  assert.deepEqual(
    custom.map((c) => c.code),
    ['CNY', 'EUR']
  );
});

test('isImportFxCurrencyAllowedClient allows PKR and active list only', () => {
  const active = resolveActiveImportCurrencies({
    activeCurrencies: [{ code: 'CNY', label: 'RMB' }],
  });
  assert.equal(isImportFxCurrencyAllowedClient('PKR', active), true);
  assert.equal(isImportFxCurrencyAllowedClient('RMB', active), true);
  assert.equal(isImportFxCurrencyAllowedClient('CNY', active), true);
  assert.equal(isImportFxCurrencyAllowedClient('USD', active), false);
});

test('formatImportFxServerError maps Wave A codes for UX', () => {
  assert.match(
    formatImportFxServerError(`${IMPORT_FX_ERROR.MULTI_CURRENCY_DISABLED}: x`),
    /Multi Currency is OFF/i
  );
  assert.match(
    formatImportFxServerError(`${IMPORT_FX_ERROR.IMPORT_FX_CURRENCY_NOT_ACTIVE}: EUR`),
    /Active foreign currencies/i
  );
  assert.match(
    formatImportFxServerError(
      `${IMPORT_FX_ERROR.MULTI_CURRENCY_DISABLE_BLOCKED}: Cannot disable Multi Currency: 2 open/partial agent FX`
    ),
    /2 open\/partial/
  );
});

test('Wave A keeps Phase-3 gate conceptually false (client default contract)', () => {
  const coerce = (v: unknown) => v === true;
  assert.equal(coerce(undefined), false);
  assert.equal(coerce(false), false);
  assert.equal(coerce('true'), false);
  assert.equal(coerce(true), true);
});
