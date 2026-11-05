import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isLiquidityBackedPayment,
  isCoaAccountTransfer,
  resolveJournalLiquidityPresentation,
  resolveTimelinePresentation,
} from './transactionTimelinePresentation';

test('manual_receipt COA transfer titles destination account', () => {
  const row = {
    direction: 'received' as const,
    referenceType: 'manual_receipt',
    paymentAccountName: 'WALI T/T',
    paymentAccountCode: '1063',
    paymentAccountType: 'bank',
    partyAccountName: 'FHD MZ',
    partyAccountCode: '1062',
    partyAccountType: 'bank',
  };
  assert.equal(isCoaAccountTransfer(row), true);
  const pres = resolveTimelinePresentation(row);
  assert.equal(pres.title, 'WALI T/T');
  assert.equal(pres.variant, 'in');
  assert.equal(pres.signPrefix, '+');
  assert.equal(pres.from, 'FHD MZ');
  assert.equal(pres.to, 'WALI T/T');
});

test('manual_payment COA transfer titles destination account (FHD → WALI)', () => {
  const row = {
    direction: 'paid' as const,
    referenceType: 'manual_payment',
    paymentAccountName: 'FHD MZ',
    paymentAccountCode: '1062',
    paymentAccountType: 'bank',
    partyAccountName: 'WALI T/T',
    partyAccountCode: '1063',
    partyAccountType: 'bank',
  };
  assert.equal(isCoaAccountTransfer(row), true);
  const pres = resolveTimelinePresentation(row);
  assert.equal(pres.title, 'WALI T/T');
  assert.equal(pres.variant, 'out');
  assert.equal(pres.from, 'FHD MZ');
  assert.equal(pres.to, 'WALI T/T');
  assert.equal(pres.signPrefix, '−');
});

test('party receipt keeps party name as title', () => {
  const row = {
    direction: 'received' as const,
    referenceType: 'manual_receipt',
    paymentAccountName: 'WALI T/T',
    paymentAccountCode: '1063',
    paymentAccountType: 'bank',
    partyAccountName: 'Accounts Receivable',
    partyAccountCode: '1100',
    partyName: 'HASSAN MARDAN',
  };
  assert.equal(isCoaAccountTransfer(row), false);
  const pres = resolveTimelinePresentation(row);
  assert.equal(pres.title, 'HASSAN MARDAN');
  assert.equal(pres.variant, 'in');
});

test('resolveJournalLiquidityPresentation for manual_payment', () => {
  const pres = resolveJournalLiquidityPresentation({
    referenceType: 'journal',
    linkedPaymentReferenceType: 'manual_payment',
    paymentType: 'paid',
    paymentAccountName: 'WALI T/T',
    paymentAccountCode: '1063',
    counterpartyAccountName: 'FHD MZ',
    counterpartyAccountCode: '1062',
  });
  assert.ok(pres);
  assert.equal(pres!.typeLabel, 'Liquidity out');
  assert.match(pres!.amountClass, /red/i);
});

test('isLiquidityBackedPayment', () => {
  assert.equal(isLiquidityBackedPayment('manual_receipt'), true);
  assert.equal(isLiquidityBackedPayment('sale'), false);
});
