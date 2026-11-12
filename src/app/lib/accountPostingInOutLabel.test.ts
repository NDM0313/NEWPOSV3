import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAccountSelectOptionLabel,
  formatPostingFieldLabel,
  getAccountNormalBalanceSide,
  getPostingInOutForSide,
  POSTING_FIELD_TITLES,
} from './accountPostingInOutLabel.ts';

describe('accountPostingInOutLabel', () => {
  it('classifies AP as credit-normal', () => {
    assert.equal(
      getAccountNormalBalanceSide({ code: '2000', name: 'Accounts Payable', type: 'liability' }),
      'credit',
    );
  });

  it('classifies cash as debit-normal', () => {
    assert.equal(
      getAccountNormalBalanceSide({ code: '1050', name: 'Cash', type: 'cash' }),
      'debit',
    );
  });

  it('debit cash → IN, credit cash → OUT', () => {
    const ap = { code: '2000', name: 'Accounts Payable', type: 'liability' };
    const cash = { code: '1050', name: 'Cash', type: 'cash' };
    assert.equal(getPostingInOutForSide(ap, 'debit'), 'OUT');
    assert.equal(getPostingInOutForSide(cash, 'debit'), 'IN');
    assert.equal(getPostingInOutForSide(cash, 'credit'), 'OUT');
  });

  it('debit expense → IN, credit revenue → IN', () => {
    const expense = { code: '5200', name: 'Discount', type: 'expense' };
    const revenue = { code: '4000', name: 'Sales', type: 'revenue' };
    assert.equal(getPostingInOutForSide(expense, 'debit'), 'IN');
    assert.equal(getPostingInOutForSide(revenue, 'credit'), 'IN');
  });

  it('formats option label with code, IN/OUT, and GL', () => {
    const label = formatAccountSelectOptionLabel(
      { code: '1100', name: 'Accounts Receivable', type: 'asset' },
      {
        postingSide: 'credit',
        balance: -136500,
        formatBalance: (n) => `Rs. ${n.toFixed(2)}`,
        includeGlBalance: true,
      },
    );
    assert.match(label, /1100 – Accounts Receivable/);
    assert.match(label, /OUT/);
    assert.match(label, /GL: Rs\. -136500\.00/);
  });

  it('supports forced IN/OUT for transfers', () => {
    const cash = { code: '1050', name: 'Cash', type: 'cash' };
    assert.equal(getPostingInOutForSide(cash, 'debit', 'OUT'), 'OUT');
    assert.equal(getPostingInOutForSide(cash, 'credit', 'IN'), 'IN');
  });

  it('formats field titles with Dr/Cr and IN/OUT', () => {
    assert.equal(
      formatPostingFieldLabel('From account', { drCr: 'Cr', inOut: 'OUT' }),
      'From account (Cr · OUT)',
    );
    assert.equal(
      formatPostingFieldLabel('Debit account', { drCr: 'Dr', inOut: 'IN/OUT' }),
      'Debit account (Dr · IN/OUT)',
    );
  });

  it('exposes preset field titles for transfer and payment', () => {
    assert.equal(POSTING_FIELD_TITLES.transferFrom, 'From account (Cr · OUT)');
    assert.equal(POSTING_FIELD_TITLES.transferTo, 'To account (Dr · IN)');
    assert.equal(POSTING_FIELD_TITLES.paymentReceipt, 'Payment account (Dr · IN)');
    assert.equal(POSTING_FIELD_TITLES.selectAccountOut, 'Select account (OUT)');
  });
});
