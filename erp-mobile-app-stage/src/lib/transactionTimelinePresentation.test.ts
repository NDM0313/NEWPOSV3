import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInternalLiquidityTransferRow,
  isLiquidityBackedPayment,
  isCoaAccountTransfer,
  resolveTimelinePresentation,
  type TransactionRowLike,
} from './transactionTimelinePresentation';

function baseRow(overrides: Partial<TransactionRowLike> = {}): TransactionRowLike {
  return {
    direction: 'received',
    referenceType: 'manual_receipt',
    paymentAccountId: 'pay-acc',
    paymentAccountName: 'WALI T/T',
    paymentAccountCode: '1063',
    paymentAccountType: 'bank',
    partyAccountId: 'party-acc',
    partyAccountName: 'FHD MZ',
    partyAccountCode: '1062',
    partyAccountType: 'bank',
    partyName: null,
    notes: null,
    expenseCategoryLabel: null,
    ...overrides,
  };
}

describe('transactionTimelinePresentation', () => {
  it('isLiquidityBackedPayment detects manual receipt/payment', () => {
    assert.equal(isLiquidityBackedPayment('manual_receipt'), true);
    assert.equal(isLiquidityBackedPayment('manual_payment'), true);
    assert.equal(isLiquidityBackedPayment('sale'), false);
  });

  it('manual_receipt COA transfer titles destination account (IN leg)', () => {
    const pres = resolveTimelinePresentation(baseRow({ direction: 'received', referenceType: 'manual_receipt' }));
    assert.equal(pres.title, 'WALI T/T');
    assert.equal(pres.variant, 'in');
    assert.equal(pres.signPrefix, '+');
    assert.equal(pres.from, 'FHD MZ');
    assert.equal(pres.to, 'WALI T/T');
    assert.match(pres.amountClass, /10B981/i);
  });

  it('manual_payment COA transfer titles destination account (OUT leg, FHD → WALI)', () => {
    const pres = resolveTimelinePresentation(
      baseRow({
        direction: 'paid',
        referenceType: 'manual_payment',
        paymentAccountName: 'FHD MZ',
        paymentAccountCode: '1062',
        partyAccountName: 'WALI T/T',
        partyAccountCode: '1063',
      }),
    );
    assert.equal(pres.title, 'WALI T/T');
    assert.equal(pres.variant, 'out');
    assert.equal(pres.from, 'FHD MZ');
    assert.equal(pres.to, 'WALI T/T');
    assert.equal(pres.signPrefix, '−');
  });

  it('isCoaAccountTransfer is false when partyName is set', () => {
    const row = baseRow({ partyName: 'HASSAN MARDAN', partyAccountName: 'Accounts Receivable', partyAccountCode: '1100' });
    assert.equal(isCoaAccountTransfer(row), false);
    const pres = resolveTimelinePresentation(row);
    assert.equal(pres.title, 'HASSAN MARDAN');
    assert.equal(pres.variant, 'in');
  });

  it('internal transfer between two roznamcha liquidity accounts uses indigo transfer variant', () => {
    const pres = resolveTimelinePresentation(
      baseRow({
        direction: 'received',
        referenceType: 'manual_receipt',
        paymentAccountName: 'MCB DIN',
        paymentAccountCode: '1061',
        partyAccountName: 'FHD MZ',
        partyAccountCode: '1062',
      }),
    );
    assert.equal(pres.variant, 'transfer');
    assert.equal(pres.title, 'MCB DIN');
    assert.equal(pres.signPrefix, '↔');
    assert.match(pres.amountClass, /818CF8/i);
  });

  it('customer receipt on liquidity without liquidity counterparty stays green IN', () => {
    const pres = resolveTimelinePresentation(
      baseRow({
        referenceType: 'manual_receipt',
        partyAccountName: 'Accounts Receivable',
        partyAccountCode: '1100',
        partyAccountType: 'asset',
        isInternalLiquidityTransfer: false,
      }),
    );
    assert.equal(pres.variant, 'in');
    assert.equal(pres.signPrefix, '+');
    assert.equal(pres.title, 'WALI T/T');
    assert.equal(pres.from, 'Accounts Receivable');
    assert.equal(pres.to, 'WALI T/T');
  });

  it('isInternalLiquidityTransferRow respects explicit flag', () => {
    assert.equal(
      isInternalLiquidityTransferRow(
        baseRow({ isInternalLiquidityTransfer: true, partyAccountName: 'Some Expense', partyAccountCode: '5000' }),
      ),
      true,
    );
  });

  it('sale payment keeps party-first title', () => {
    const pres = resolveTimelinePresentation(
      baseRow({
        referenceType: 'sale',
        direction: 'received',
        partyName: 'MR ALMAS',
        paymentAccountName: 'DIN CHINA BANK',
      }),
    );
    assert.equal(pres.variant, 'party');
    assert.equal(pres.title, 'MR ALMAS');
    assert.equal(pres.signPrefix, '+');
  });
});
