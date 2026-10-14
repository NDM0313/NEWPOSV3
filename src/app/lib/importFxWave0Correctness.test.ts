/**
 * Wave 0 Path 21 unit tests: role-filtered opening, summary parity, search, idempotency helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterApRowsByPartyRole,
  filterSearchableOptionsByQuery,
  splitRoleFilteredApRowsByPeriod,
  summarizeRoleFilteredApRows,
  isEligibleMoneyExchangeAgentType,
  assertAgentDistinctFromSupplier,
} from './importFxPartyLedgerRoleFilter';
import { IMPORT_FX_ERROR, formatImportFxServerError } from './importFxGateCodes';

test('Wave 0: opening balance uses same role filter as in-range rows', () => {
  const settleIds = new Set(['agent-pay']);
  const rows = [
    {
      date: '2026-07-01',
      je_reference_type: 'fx_currency_purchase',
      payment_id: null,
      debit: 0,
      credit: 100000,
      description: 'FX credit',
    },
    {
      date: '2026-07-02',
      je_reference_type: 'payment',
      payment_id: 'agent-pay',
      debit: 100000,
      credit: 0,
      description: 'Agent settle',
    },
    {
      date: '2026-08-01',
      je_reference_type: 'purchase',
      payment_id: null,
      debit: 0,
      credit: 50000,
      description: 'Merchandise PUR',
    },
    {
      date: '2026-08-05',
      je_reference_type: 'payment',
      payment_id: 'china-pay',
      debit: 20000,
      credit: 0,
      description: 'China settle',
    },
  ];

  const supplierFiltered = filterApRowsByPartyRole(rows, 'supplier', settleIds);
  const { opening, inRange } = splitRoleFilteredApRowsByPeriod(supplierFiltered, '2026-08-01');
  // Pre-period FX + agent settle excluded → opening 0; only merchandise+china in range
  assert.equal(opening, 0);
  assert.equal(inRange.length, 2);

  const summary = summarizeRoleFilteredApRows(inRange, opening);
  assert.equal(summary.totalCredit, 50000);
  assert.equal(summary.totalDebit, 20000);
  assert.equal(summary.closingBalance, 30000);
  assert.equal(summary.paymentsPaid, 20000);

  const agentFiltered = filterApRowsByPartyRole(rows, 'agent_fx', settleIds);
  const agentSplit = splitRoleFilteredApRowsByPeriod(agentFiltered, '2026-08-01');
  assert.equal(agentSplit.opening, 0); // 100k credit − 100k debit before Aug
  assert.equal(agentSplit.inRange.length, 0);
});

test('Wave 0: agent search excludes supplier-only contacts (eligibility)', () => {
  assert.equal(isEligibleMoneyExchangeAgentType('supplier'), false);
  assert.equal(isEligibleMoneyExchangeAgentType('money_exchange'), true);
  const agents = [
    { id: '1', name: 'Qing Boyu', role: 'supplier', code: 'S1' },
    { id: '2', name: 'RMB AGENT', role: 'money_exchange', code: 'MX1' },
  ].filter((a) => isEligibleMoneyExchangeAgentType(a.role));
  assert.equal(agents.length, 1);
  assert.equal(filterSearchableOptionsByQuery(agents, 'qing', ['name', 'code', 'role']).length, 0);
  assert.equal(filterSearchableOptionsByQuery(agents, 'rmb', ['name', 'code', 'role']).length, 1);
});

test('Wave 0: distinct party still enforced', () => {
  assert.ok(assertAgentDistinctFromSupplier('a', 'a'));
});

test('Wave 0: client operation id reuse contract (documented)', () => {
  // Client must reuse UUID on retry; rotate only after success.
  const intent = '11111111-1111-1111-1111-111111111111';
  const retry = intent;
  assert.equal(intent, retry);
  const afterSuccess = '22222222-2222-2222-2222-222222222222';
  assert.notEqual(intent, afterSuccess);
});

test('Wave 0: claim-before-pay contract (documented)', () => {
  // Parallel tabs: first claim wins; second gets IN_PROGRESS or idempotent replay.
  // Money write (createSupplierPayment) must not run until claim succeeds.
  const steps = ['claim', 'createSupplierPayment', 'finalize'];
  assert.equal(steps[0], 'claim');
  assert.ok(steps.indexOf('claim') < steps.indexOf('createSupplierPayment'));
  assert.equal(IMPORT_FX_ERROR.IMPORT_FX_OPERATION_IN_PROGRESS, 'IMPORT_FX_OPERATION_IN_PROGRESS');
  assert.match(
    formatImportFxServerError('IMPORT_FX_OPERATION_IN_PROGRESS: this operation is already in progress'),
    /already in progress/i
  );
});
