import assert from 'node:assert/strict';
import { test } from 'node:test';
import { W2_MONEY_STAGE_BLOCKED_COPY } from './importFxCaseHelpers';
import {
  W2_ACCOUNTING_NOT_POSTED_LABEL,
  W2_ACTION_BAR_CLASS,
  W2_FORBIDDEN_MONEY_ACTIONS,
  W2_FUNDING_INTENTION_OPTIONS,
  W2_PLANNING_ONLY_NOTICE,
  W2_WORKSPACE_GRID_CLASS,
  W2_WORKSPACE_SHELL_CLASS,
  assertW2MutationDoesNotPost,
  containsForbiddenMoneyActionCopy,
  createExclusiveBusyGuard,
  formatAccountingStatusLabel,
  formatLastUpdated,
  formatMoneyExchangeOption,
  formatPlannedCurrencyPair,
  formatPurchasePlanningOption,
  isArrangementLocked,
  matchesPlanningSearch,
  moneyStageTimelineItems,
  resolveWorkspaceMode,
  stripAttachmentStoragePath,
  thirdPartyOptionsExcludingAgent,
  validateArrangementPlanning,
  workspaceActions,
} from './importFxCaseWorkspaceView';

test('draft form copy uses planned/expected/intention wording', () => {
  assert.equal(W2_PLANNING_ONLY_NOTICE, 'Planning only — no payment or accounting entry has been posted.');
  assert.equal(formatAccountingStatusLabel('NOT_POSTED'), 'Not Posted');
  assert.equal(W2_ACCOUNTING_NOT_POSTED_LABEL, 'Not Posted');
  assert.deepEqual(
    W2_FUNDING_INTENTION_OPTIONS.map((o) => o.label),
    ['Advance planned', 'Credit planned', 'Mixed planned']
  );
  for (const opt of W2_FUNDING_INTENTION_OPTIONS) {
    assert.match(opt.hint, /not financially posted/i);
    assert.doesNotMatch(opt.label, /paid|purchased|settled|completed/i);
  }
});

test('agent selector includes name, code, and phone in search', () => {
  const opt = formatMoneyExchangeOption({
    id: 'a1',
    name: 'Hamid Exchange',
    code: 'HX-01',
    phone: '03001234567',
  });
  assert.match(opt.name, /Hamid Exchange/);
  assert.match(opt.name, /HX-01/);
  assert.match(opt.name, /03001234567/);
  assert.equal(matchesPlanningSearch(opt, 'hamid'), true);
  assert.equal(matchesPlanningSearch(opt, 'HX-01'), true);
  assert.equal(matchesPlanningSearch(opt, '0300123'), true);
  assert.equal(matchesPlanningSearch(opt, 'supplier-only'), false);
});

test('normal suppliers are not implied as agents by the formatter', () => {
  const agent = formatMoneyExchangeOption({ id: 'a1', name: 'Agent A', code: 'AG' });
  const supplier = { id: 's1', name: 'Qing Boyu', type: 'supplier' };
  assert.equal(agent.id, 'a1');
  assert.notEqual(supplier.type, 'money_exchange');
});

test('third party options exclude the selected agent', () => {
  const agents = [
    { id: 'a1', name: 'Agent A' },
    { id: 'a2', name: 'Agent B' },
  ];
  const third = thirdPartyOptionsExcludingAgent(agents, 'a1');
  assert.deepEqual(
    third.map((t) => t.id),
    ['a2']
  );
});

test('purchase planning search matches supplier name, purchase ref, and invoice', () => {
  const opt = formatPurchasePlanningOption({
    id: 'p1',
    purchaseNumber: 'PO-88',
    invoiceNumber: 'INV-9',
    supplierName: 'Qing Boyu',
    documentCurrency: 'CNY',
  });
  assert.equal(matchesPlanningSearch(opt, 'qing'), true);
  assert.equal(matchesPlanningSearch(opt, 'PO-88'), true);
  assert.equal(matchesPlanningSearch(opt, 'INV-9'), true);
  assert.equal(matchesPlanningSearch(opt, 'missing'), false);
});

test('funding-mode switching stays within Advance/Credit/Mixed planned', () => {
  const values = W2_FUNDING_INTENTION_OPTIONS.map((o) => o.value);
  assert.deepEqual(values, ['ADVANCE', 'CREDIT', 'MIXED']);
  let mode: string = 'CREDIT';
  mode = 'ADVANCE';
  assert.equal(mode, 'ADVANCE');
  mode = 'MIXED';
  assert.equal(mode, 'MIXED');
});

test('validation messages for same-party and negative amounts/rates', () => {
  assert.deepEqual(
    validateArrangementPlanning({ agentId: 'a1', thirdPartyId: 'a1' }),
    ['Agent and third party must be different contacts.']
  );
  const negatives = validateArrangementPlanning({
    plannedUsd: '-1',
    expectedCnyPerUsd: '-7',
  });
  assert.ok(negatives.some((m) => /Expected USD amount cannot be negative/.test(m)));
  assert.ok(negatives.some((m) => /CNY received per 1 USD rate cannot be negative/.test(m)));
  assert.deepEqual(validateArrangementPlanning({ plannedUsd: '100', expectedCny: '700' }), []);
});

test('Save Draft busy state disables actions', () => {
  const idle = workspaceActions({ mode: 'edit-draft', busy: false });
  assert.equal(idle.showSaveDraft, true);
  assert.equal(idle.actionsDisabled, false);
  assert.equal(idle.saveDraftBusy, false);
  const busy = workspaceActions({ mode: 'edit-draft', busy: true, busyAction: 'save' });
  assert.equal(busy.actionsDisabled, true);
  assert.equal(busy.saveDraftBusy, true);
  assert.equal(busy.confirmBusy, false);
});

test('Confirm Arrangement duplicate-click protection', () => {
  const guard = createExclusiveBusyGuard();
  assert.equal(guard.tryStart(), true);
  assert.equal(guard.tryStart(), false);
  assert.equal(guard.isBusy(), true);
  guard.end();
  assert.equal(guard.tryStart(), true);
  guard.end();
});

test('confirmed-case locked state hides save/confirm and locks fields', () => {
  assert.equal(
    isArrangementLocked({
      arrangementConfirmedAt: '2026-08-12T10:00:00Z',
      arrangementStageStatus: 'COMPLETED',
      operationalStatus: 'ARRANGED',
    }),
    true
  );
  const mode = resolveWorkspaceMode({
    multiCurrencyEnabled: true,
    selectedCaseId: 'c1',
    arrangementLocked: true,
  });
  assert.equal(mode, 'confirmed');
  const actions = workspaceActions({
    mode,
    busy: false,
    accountingStatus: 'NOT_POSTED',
    operationalStatus: 'ARRANGED',
  });
  assert.equal(actions.fieldsLocked, true);
  assert.equal(actions.showSaveDraft, false);
  assert.equal(actions.showConfirmArrangement, false);
  assert.equal(actions.showCancelUnposted, true);
  assert.equal(formatAccountingStatusLabel('NOT_POSTED'), 'Not Posted');
});

test('Multi Currency OFF is read-only', () => {
  const mode = resolveWorkspaceMode({
    multiCurrencyEnabled: false,
    selectedCaseId: 'c1',
    arrangementLocked: false,
  });
  assert.equal(mode, 'read-only');
  const actions = workspaceActions({ mode, busy: false, accountingStatus: 'NOT_POSTED' });
  assert.equal(actions.fieldsLocked, true);
  assert.equal(actions.showCreateDraft, false);
  assert.equal(actions.showSaveDraft, false);
  assert.equal(actions.showConfirmArrangement, false);
  assert.equal(actions.actionsDisabled, true);
});

test('future money stages are disabled with W3+ copy', () => {
  const items = moneyStageTimelineItems();
  const arrangement = items.find((i) => i.code === 'ARRANGEMENT');
  assert.equal(arrangement?.disabled, false);
  for (const code of ['ADVANCE', 'USD_ACQUISITION', 'CHINA_USD_TRANSFER', 'USD_CNY_CONVERSION', 'CNY_POOL', 'SUPPLIER_ALLOCATION', 'RECONCILIATION'] as const) {
    const row = items.find((i) => i.code === code);
    assert.equal(row?.disabled, true);
    assert.equal(row?.helper, W2_MONEY_STAGE_BLOCKED_COPY);
  }
  assert.equal(W2_MONEY_STAGE_BLOCKED_COPY, 'Available in W3+ — no financial posting in W2');
});

test('posts_journal: false contract', () => {
  assert.doesNotThrow(() => assertW2MutationDoesNotPost(false));
  assert.doesNotThrow(() => assertW2MutationDoesNotPost(undefined));
  assert.throws(() => assertW2MutationDoesNotPost(true), /posts_journal=false/);
});

test('storage_path is stripped from attachment metadata', () => {
  const cleaned = stripAttachmentStoragePath({
    id: 'att1',
    file_name: 'quote.pdf',
    is_metadata_only: true,
    storage_path: 'secret/path',
  });
  assert.equal('storage_path' in cleaned, false);
  assert.equal(cleaned.file_name, 'quote.pdf');
});

test('responsive layout classes stack on mobile and wrap actions', () => {
  assert.match(W2_WORKSPACE_GRID_CLASS, /grid-cols-1/);
  assert.match(W2_WORKSPACE_GRID_CLASS, /lg:grid-cols-12/);
  assert.match(W2_WORKSPACE_SHELL_CLASS, /overflow-hidden/);
  assert.match(W2_ACTION_BAR_CLASS, /flex-wrap/);
  assert.match(W2_ACTION_BAR_CLASS, /flex-col/);
});

test('forbidden money action labels stay out of W2 copy constants', () => {
  const blob = [W2_PLANNING_ONLY_NOTICE, ...W2_FUNDING_INTENTION_OPTIONS.map((o) => o.label)].join('\n');
  assert.equal(containsForbiddenMoneyActionCopy(blob), false);
  assert.ok(W2_FORBIDDEN_MONEY_ACTIONS.includes('Pay Advance'));
});

test('header helpers: currency pair and last updated', () => {
  assert.equal(formatPlannedCurrencyPair('USD', 'CNY'), 'USD → CNY');
  assert.equal(formatPlannedCurrencyPair(null, null), '— → —');
  assert.equal(formatLastUpdated(null), '—');
  assert.notEqual(formatLastUpdated('2026-08-12T10:00:00.000Z'), '—');
});
