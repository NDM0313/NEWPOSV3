import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  modeIncludesReport,
  modeIncludesTier,
  reportsVisibleInMode,
  normalizeReportHubMode,
} from './reportsHubCatalog';

describe('reportsHubCatalog', () => {
  const permissions = {
    fullAccounting: true,
    canViewCustomerLedger: true,
    canViewSupplierLedger: true,
  };

  it('normalizeReportHubMode defaults unknown to easy', () => {
    assert.equal(normalizeReportHubMode(null), 'easy');
    assert.equal(normalizeReportHubMode('bogus'), 'easy');
    assert.equal(normalizeReportHubMode('advanced'), 'advanced');
  });

  it('modeIncludesTier is cumulative', () => {
    assert.equal(modeIncludesTier('easy', 'easy'), true);
    assert.equal(modeIncludesTier('easy', 'standard'), false);
    assert.equal(modeIncludesTier('standard', 'easy'), true);
    assert.equal(modeIncludesTier('advanced', 'standard'), true);
  });

  it('easy mode shows daily ops tiles only', () => {
    const keys = reportsVisibleInMode('easy', permissions).map((r) => r.key);
    assert.ok(keys.includes('daybook'));
    assert.ok(keys.includes('customer-ledger'));
    assert.ok(keys.includes('sales-report'));
    assert.equal(keys.includes('trial-balance'), false);
    assert.equal(keys.includes('ledger-v2'), false);
  });

  it('advanced mode includes trial balance and ledger v2', () => {
    const keys = reportsVisibleInMode('advanced', permissions).map((r) => r.key);
    assert.ok(keys.includes('trial-balance'));
    assert.ok(keys.includes('ledger-v2'));
    assert.ok(keys.includes('courier-shipments'));
  });

  it('supplier ledger hidden without supplier permission', () => {
    const keys = reportsVisibleInMode('advanced', {
      ...permissions,
      canViewSupplierLedger: false,
    }).map((r) => r.key);
    assert.equal(keys.includes('supplier-ledger'), false);
    assert.equal(keys.includes('payables'), false);
  });

  it('modeIncludesReport matches catalog tiers', () => {
    assert.equal(modeIncludesReport('easy', 'daybook'), true);
    assert.equal(modeIncludesReport('easy', 'balance-sheet'), false);
    assert.equal(modeIncludesReport('standard', 'balance-sheet'), true);
    assert.equal(modeIncludesReport('standard', 'trial-balance'), false);
    assert.equal(modeIncludesReport('advanced', 'trial-balance'), true);
  });
});
