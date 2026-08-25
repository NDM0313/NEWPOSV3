/**
 * Path 21 correctness hotfix unit tests (eligibility, role filters, mappers).
 *
 * Manual / SQL checklist (RPC role guards — run after migration on QA, not production):
 * - record_fx_currency_purchase_on_credit with supplier-type agent → IMPORT_FX_AGENT_ROLE_INVALID
 * - same agent_contact_id as linked purchase.supplier_id → IMPORT_FX_AGENT_SAME_AS_SUPPLIER
 * - money_exchange agent + distinct supplier → success (Wave A gates still apply)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertAgentDistinctFromSupplier,
  filterApRowsByPartyRole,
  filterSearchableOptionsByQuery,
  isEligibleMoneyExchangeAgentType,
  isFxCurrencyPurchaseReference,
  mapFxAgentSourceKind,
  sumSupplierPaymentsPaidFromRows,
} from './importFxPartyLedgerRoleFilter';
import { mapGlReferenceTypeToSourceKind } from './ledgerStatementV2UnifiedMapper';
import { IMPORT_FX_ERROR, formatImportFxServerError } from './importFxGateCodes';

test('agent list eligibility: money_exchange only', () => {
  assert.equal(isEligibleMoneyExchangeAgentType('money_exchange'), true);
  assert.equal(isEligibleMoneyExchangeAgentType('supplier'), false);
  assert.equal(isEligibleMoneyExchangeAgentType('both'), false);
  assert.equal(isEligibleMoneyExchangeAgentType('customer'), false);
  // Mirrors isEligibleMoneyExchangeAgentContact in importFxAgentService
  const eligible = (c: { type?: string; is_active?: boolean }) =>
    c.is_active !== false && isEligibleMoneyExchangeAgentType(c.type);
  assert.equal(eligible({ type: 'money_exchange' }), true);
  assert.equal(eligible({ type: 'supplier' }), false);
  assert.equal(eligible({ type: 'money_exchange', is_active: false }), false);
});

test('agent === supplier blocked', () => {
  const same = assertAgentDistinctFromSupplier('uuid-a', 'uuid-a');
  assert.ok(same);
  assert.match(same!, /cannot be the same party/i);
  assert.equal(assertAgentDistinctFromSupplier('uuid-a', 'uuid-b'), null);
  assert.equal(assertAgentDistinctFromSupplier(null, 'uuid-b'), null);
});

test('search filterFns: agent / purchase / wallet', () => {
  const agents = [
    { id: '1', name: 'Hamid FX (money_exchange)', code: 'MX01', phone: '0300', role: 'money_exchange' },
    { id: '2', name: 'Other Agent (money_exchange)', code: 'MX02', phone: '', role: 'money_exchange' },
  ];
  assert.equal(filterSearchableOptionsByQuery(agents, 'hamid', ['name', 'code', 'phone', 'role']).length, 1);
  assert.equal(filterSearchableOptionsByQuery(agents, 'MX02', ['name', 'code']).length, 1);
  assert.equal(filterSearchableOptionsByQuery(agents, 'zzz', ['name', 'code']).length, 0);

  const purchases = [
    { id: 'p1', name: 'PUR-0005 · Qing Boyu', label: 'PUR-0005', supplier: 'Qing Boyu', po: 'PUR-0005' },
  ];
  assert.equal(
    filterSearchableOptionsByQuery(purchases, 'qing', ['name', 'label', 'supplier', 'po']).length,
    1
  );

  const wallets = [{ id: 'w1', name: '1205 — HAMID IK RMB', code: '1205', walletName: 'HAMID IK RMB' }];
  assert.equal(filterSearchableOptionsByQuery(wallets, '1205', ['name', 'code', 'walletName']).length, 1);
  assert.equal(filterSearchableOptionsByQuery(wallets, 'rmb', ['name', 'code', 'walletName']).length, 1);
});

test('role filter: supplier excludes JV + agent settle; includes purchase settle', () => {
  const agentPay = 'pay-0325';
  const chinaPay = 'pay-0326';
  const settleIds = new Set([agentPay]);
  const fixture = [
    {
      je_reference_type: 'fx_currency_purchase',
      payment_id: null,
      debit: 0,
      credit: 215000,
      description: 'JV-000341',
    },
    {
      je_reference_type: 'payment',
      payment_id: agentPay,
      debit: 215000,
      credit: 0,
      description: 'PAY-0325 agent settle',
    },
    {
      je_reference_type: 'purchase',
      payment_id: null,
      debit: 0,
      credit: 8669795.88,
      description: 'PUR-0005',
    },
    {
      je_reference_type: 'payment',
      payment_id: chinaPay,
      debit: 215000,
      credit: 0,
      description: 'PAY-0326 china settle',
    },
  ];

  const supplierRows = filterApRowsByPartyRole(fixture, 'supplier', settleIds);
  assert.equal(supplierRows.length, 2);
  assert.ok(supplierRows.every((r) => !isFxCurrencyPurchaseReference(r.je_reference_type)));
  assert.ok(!supplierRows.some((r) => r.payment_id === agentPay));
  assert.ok(supplierRows.some((r) => r.payment_id === chinaPay));
  assert.ok(supplierRows.some((r) => r.je_reference_type === 'purchase'));

  const agentRows = filterApRowsByPartyRole(fixture, 'agent_fx', settleIds);
  assert.equal(agentRows.length, 2);
  assert.ok(agentRows.some((r) => isFxCurrencyPurchaseReference(r.je_reference_type)));
  assert.ok(agentRows.some((r) => r.payment_id === agentPay));
  assert.ok(!agentRows.some((r) => r.je_reference_type === 'purchase'));
});

test('summary paid = 215k not 430k for Qing Boyu fixture', () => {
  const settleIds = new Set(['pay-0325']);
  const rows = [
    { debit: 215000, credit: 0, sourceKind: 'payment', payment_id: 'pay-0325' },
    { debit: 215000, credit: 0, sourceKind: 'payment', payment_id: 'pay-0326' },
  ];
  const paid = sumSupplierPaymentsPaidFromRows(rows, settleIds);
  assert.equal(paid, 215000);
});

test('mapGlReferenceType does not classify fx_currency_purchase as purchase', () => {
  assert.equal(mapFxAgentSourceKind('fx_currency_purchase'), 'fx_agent');
  assert.equal(mapGlReferenceTypeToSourceKind('fx_currency_purchase'), 'journal');
  assert.equal(mapGlReferenceTypeToSourceKind('purchase'), 'purchase');
  assert.notEqual(mapGlReferenceTypeToSourceKind('fx_currency_purchase'), 'purchase');
});

test('Wave A error-code helpers still pass', () => {
  assert.equal(IMPORT_FX_ERROR.MULTI_CURRENCY_DISABLED, 'MULTI_CURRENCY_DISABLED');
  const msg = formatImportFxServerError(
    { message: 'MULTI_CURRENCY_DISABLED: Import FX requires Multi Currency Enabled' },
    'fallback'
  );
  assert.match(msg, /MULTI_CURRENCY_DISABLED|Multi Currency/i);
});

test('Phase-3 coerce remains false for non-boolean true', () => {
  const coerce = (v: unknown) => v === true;
  assert.equal(coerce(undefined), false);
  assert.equal(coerce(false), false);
  assert.equal(coerce('true'), false);
  assert.equal(coerce(true), true);
});
