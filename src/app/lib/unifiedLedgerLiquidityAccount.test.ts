import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUnifiedLiquidityAccount,
  liquidityKindMatchesAccount,
} from '@/app/lib/unifiedLedgerLiquidityAccount.ts';

test('detects cash account by type', () => {
  assert.equal(isUnifiedLiquidityAccount({ code: '1099', name: 'Petty', type: 'cash' }), true);
});

test('detects bank by code 1010', () => {
  assert.equal(isUnifiedLiquidityAccount({ code: '1010', name: 'Main Bank', type: 'bank' }), true);
});

test('detects wallet by 102x digits', () => {
  assert.equal(isUnifiedLiquidityAccount({ code: '10201', name: 'JazzCash', type: 'mobile_wallet' }), true);
});

test('rejects AR control account', () => {
  assert.equal(isUnifiedLiquidityAccount({ code: '1100', name: 'AR', type: 'asset' }), false);
});

test('liquidityKind cash vs bank', () => {
  const bank = { code: '1010', name: 'Bank', type: 'bank' };
  const cash = { code: '1000', name: 'Cash', type: 'cash' };
  assert.equal(liquidityKindMatchesAccount('bank', bank), true);
  assert.equal(liquidityKindMatchesAccount('bank', cash), false);
  assert.equal(liquidityKindMatchesAccount('cash', cash), true);
});
