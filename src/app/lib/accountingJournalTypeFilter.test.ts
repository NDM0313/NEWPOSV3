import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOpeningBalanceRef,
  matchesAccountingTypeFilter,
  normalizeJournalRefType,
} from './accountingJournalTypeFilter';

test('normalizeJournalRefType collapses spaces', () => {
  assert.equal(normalizeJournalRefType('Opening Balance Account'), 'opening_balance_account');
  assert.equal(normalizeJournalRefType('  SALE_RETURN  '), 'sale_return');
});

test('opening refs', () => {
  assert.equal(isOpeningBalanceRef('opening_balance'), true);
  assert.equal(isOpeningBalanceRef('opening_balance_account'), true);
  assert.equal(isOpeningBalanceRef('opening_balance_contact_ar'), true);
  assert.equal(isOpeningBalanceRef('coa_opening'), true);
  assert.equal(isOpeningBalanceRef('sale'), false);
});

function row(ref: string, extra?: { source?: string; paymentId?: string; root?: string }) {
  return {
    source: extra?.source,
    metadata: {
      referenceType: ref,
      rootReferenceType: extra?.root,
      paymentId: extra?.paymentId,
    },
  };
}

test('sale excludes returns and source fallback', () => {
  assert.equal(matchesAccountingTypeFilter(row('sale'), 'sale'), true);
  assert.equal(matchesAccountingTypeFilter(row('sale_adjustment'), 'sale'), true);
  assert.equal(matchesAccountingTypeFilter(row('sale_return'), 'sale'), false);
  assert.equal(matchesAccountingTypeFilter(row('sale_reversal'), 'sale'), false);
  assert.equal(matchesAccountingTypeFilter({ source: 'Sale', metadata: { referenceType: 'sale_return' } }, 'sale'), false);
});

test('sale_return excludes reversals', () => {
  assert.equal(matchesAccountingTypeFilter(row('sale_return'), 'sale_return'), true);
  assert.equal(matchesAccountingTypeFilter(row('sale_reversal'), 'sale_return'), false);
});

test('purchase excludes returns', () => {
  assert.equal(matchesAccountingTypeFilter(row('purchase'), 'purchase'), true);
  assert.equal(matchesAccountingTypeFilter(row('purchase_return', { source: 'Purchase' }), 'purchase'), false);
  assert.equal(matchesAccountingTypeFilter(row('purchase_return'), 'purchase_return'), true);
});

test('payment allowlist ignores bare paymentId on sale', () => {
  assert.equal(matchesAccountingTypeFilter(row('payment'), 'payment'), true);
  assert.equal(matchesAccountingTypeFilter(row('courier_payment'), 'payment'), true);
  assert.equal(matchesAccountingTypeFilter(row('manual_receipt'), 'payment'), true);
  assert.equal(matchesAccountingTypeFilter(row('sale', { paymentId: 'pay-1' }), 'payment'), false);
});

test('opening chip', () => {
  assert.equal(matchesAccountingTypeFilter(row('opening_balance_account'), 'opening'), true);
  assert.equal(matchesAccountingTypeFilter(row('Opening Balance Account'), 'opening'), true);
  assert.equal(matchesAccountingTypeFilter(row('coa_opening'), 'opening'), true);
  assert.equal(matchesAccountingTypeFilter(row('sale'), 'opening'), false);
});

test('adjustment excludes document and opening adjustments', () => {
  assert.equal(matchesAccountingTypeFilter(row('stock_adjustment'), 'adjustment'), true);
  assert.equal(matchesAccountingTypeFilter(row('sale_adjustment'), 'adjustment'), false);
  assert.equal(matchesAccountingTypeFilter(row('opening_balance_adjustment_ar'), 'adjustment'), false);
});

test('cancel includes reversals not returns', () => {
  assert.equal(matchesAccountingTypeFilter(row('sale_reversal'), 'cancel'), true);
  assert.equal(matchesAccountingTypeFilter(row('shipment_reversal'), 'cancel'), true);
  assert.equal(matchesAccountingTypeFilter(row('sale_return'), 'cancel'), false);
});
