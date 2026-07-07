import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isLiquidityPaymentAccount,
  isPartyTtAgentWalletAccount,
  isPartyTtRoutingAccount,
  isRoznamchaLiquidityAccount,
  paymentMethodForLiquidityAccount,
} from './liquidityPaymentAccount';

test('1002 and 1003 cash type accounts are liquidity', () => {
  assert.equal(isLiquidityPaymentAccount({ code: '1002', type: 'cash', name: 'CASH G140' }), true);
  assert.equal(isLiquidityPaymentAccount({ code: '1003', type: 'cash', name: 'Cash in NDM' }), true);
});

test('AR line is not liquidity', () => {
  assert.equal(isLiquidityPaymentAccount({ code: 'AR-CUS0001', type: 'asset', name: 'Receivable' }), false);
});

test('bank type is liquidity without canonical code', () => {
  assert.equal(isLiquidityPaymentAccount({ code: '1012', type: 'bank', name: 'FHD MZ' }), true);
});

test('USD TT Agent Clearing 1201 is liquidity (bank clearing)', () => {
  assert.equal(
    isLiquidityPaymentAccount({ code: '1201', type: 'asset', name: 'USD TT Agent Clearing' }),
    true,
  );
  assert.equal(
    isRoznamchaLiquidityAccount({ code: '1201', type: 'asset', name: 'USD TT Agent Clearing' }),
    true,
  );
});

test('101x bank sub-account code is liquidity', () => {
  assert.equal(isLiquidityPaymentAccount({ code: '1011', type: 'asset', name: 'HBL Main' }), true);
});

test('party payee WALI T/T is liquidity for payments but excluded from roznamcha', () => {
  const wali = { code: '1015', type: 'bank', name: 'WALI T/T' };
  assert.equal(isLiquidityPaymentAccount(wali), true);
  assert.equal(isPartyTtRoutingAccount(wali), true);
  assert.equal(isRoznamchaLiquidityAccount(wali), false);
});

test('HAMID IK RMB TT agent wallet is liquidity for transfers but excluded from roznamcha', () => {
  const hamid = { code: '1205', type: 'asset', name: 'HAMID IK RMB' };
  assert.equal(isPartyTtAgentWalletAccount(hamid), true);
  assert.equal(isLiquidityPaymentAccount(hamid), true);
  assert.equal(isRoznamchaLiquidityAccount(hamid), false);
});

test('internal bank to own wallet both remain roznamcha liquidity', () => {
  assert.equal(isRoznamchaLiquidityAccount({ code: '1012', type: 'bank', name: 'FHD MZ' }), true);
  assert.equal(isRoznamchaLiquidityAccount({ code: '1021', type: 'wallet', name: 'NDM Easy' }), true);
});

test('inactive imported pseudo-bank is excluded from liquidity', () => {
  assert.equal(
    isLiquidityPaymentAccount({ code: '1204', type: 'bank', name: 'YAQOOB', is_active: false }),
    false,
  );
  assert.equal(
    isRoznamchaLiquidityAccount({ code: '1204', type: 'bank', name: 'YAQOOB', is_active: false }),
    false,
  );
});

test('inactive account without is_active field stays eligible (backward compatible)', () => {
  assert.equal(isLiquidityPaymentAccount({ code: '1012', type: 'bank', name: 'FHD MZ' }), true);
});

test('USD TT Agent Clearing maps to bank for roznamcha sign', () => {
  const clearing = { code: '1201', type: 'asset', name: 'USD TT Agent Clearing' };
  assert.equal(paymentMethodForLiquidityAccount(clearing), 'bank');
  assert.equal(isRoznamchaLiquidityAccount(clearing), true);
});
