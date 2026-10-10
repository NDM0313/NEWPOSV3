import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLiquidityPaymentAccount } from './liquidityPaymentAccount';
import {
  filterPaymentAccountsByMethod,
  mobilePaymentMethodToLabel,
} from './paymentAccountFilters';

const fhdMzLegacy = {
  id: 'a1',
  code: 'DC0108',
  name: 'FHD MZ',
  type: 'Bank',
};

const fhdMzCanonical = {
  id: 'a2',
  code: '1062',
  name: 'FHD MZ',
  type: 'bank',
};

const arAccount = {
  id: 'a3',
  code: '1100',
  name: 'Accounts Receivable',
  type: 'asset',
};

const mcbBank = {
  id: 'a4',
  code: '1061',
  name: 'MCB',
  type: 'asset',
};

test('isLiquidityPaymentAccount includes legacy FHD MZ DC0108 with Bank type', () => {
  assert.equal(isLiquidityPaymentAccount(fhdMzLegacy), true);
});

test('isLiquidityPaymentAccount includes canonical 1062 FHD MZ', () => {
  assert.equal(isLiquidityPaymentAccount(fhdMzCanonical), true);
});

test('isLiquidityPaymentAccount includes 1061 bank section child even with asset type', () => {
  assert.equal(isLiquidityPaymentAccount(mcbBank), true);
});

test('isLiquidityPaymentAccount excludes AR control account', () => {
  assert.equal(isLiquidityPaymentAccount(arAccount), false);
});

test('filterPaymentAccountsByMethod includes FHD MZ under Bank', () => {
  const bank = filterPaymentAccountsByMethod(
    [fhdMzLegacy, fhdMzCanonical, arAccount, mcbBank],
    'Bank',
  );
  assert.ok(bank.some((a) => a.code === 'DC0108'));
  assert.ok(bank.some((a) => a.code === '1062'));
  assert.ok(bank.some((a) => a.code === '1061'));
  assert.equal(bank.some((a) => a.code === '1100'), false);
});

test('mobilePaymentMethodToLabel maps card to Bank bucket', () => {
  assert.equal(mobilePaymentMethodToLabel('card'), 'Bank');
});

test('filterPaymentAccountsByMethod card bucket matches bank accounts', () => {
  const cardBucket = filterPaymentAccountsByMethod([fhdMzLegacy, arAccount], 'Bank');
  assert.ok(cardBucket.some((a) => a.code === 'DC0108'));
});
