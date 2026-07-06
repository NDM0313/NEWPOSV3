import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCounterpartyByDirectionFromJeLines,
  buildExpenseCounterpartyByDirectionFromJeLines,
  counterpartyForPaymentDirection,
  formatJvRoznamchaSubtitle,
  isGenericRoznamchaPartyLabel,
  isGeneralLiquidityJournalRef,
  isJvBoilerplatePaymentNote,
  isJvJournalEntryNo,
  resolveCounterpartyLabelFromJeLines,
  resolveExpenseCounterpartyFromJeLines,
  resolveJvLinkedCounterpartyLabel,
  seedManualJournalPaymentJeMaps,
} from './roznamchaCounterpartyLabel';

test('OUT payment resolves debit-side expense account', () => {
  const lines = [
    {
      debit: 5000,
      credit: 0,
      account: { name: 'Miscellaneous Expense', type: 'expense', code: '6000' },
    },
    {
      debit: 0,
      credit: 5000,
      account: { name: 'CASH IN HAND', type: 'cash', code: '1000' },
    },
  ];
  assert.equal(
    resolveExpenseCounterpartyFromJeLines(lines, 'OUT'),
    'Miscellaneous Expense (6000)'
  );
});

test('HOME EXPENSES 3003 equity type resolves on OUT', () => {
  const lines = [
    {
      debit: 5000,
      credit: 0,
      account: { name: 'HOME EXPENSES', type: 'equity', code: '3003' },
    },
    {
      debit: 0,
      credit: 5000,
      account: { name: 'CASH IN HAND', type: 'cash', code: '1000' },
    },
  ];
  assert.equal(
    resolveExpenseCounterpartyFromJeLines(lines, 'OUT'),
    'HOME EXPENSES (3003)'
  );
});

test('expense resolver ignores AR sub-ledger legs', () => {
  const lines = [
    {
      debit: 2500,
      credit: 0,
      account: { name: 'CASH IN HAND', type: 'cash', code: '1000' },
    },
    {
      debit: 0,
      credit: 2500,
      account: { name: 'Receivable - Inayat', type: 'asset', code: 'AR-CUS0001' },
    },
  ];
  assert.equal(resolveExpenseCounterpartyFromJeLines(lines, 'IN'), null);
  assert.equal(resolveCounterpartyLabelFromJeLines(lines, 'IN'), 'Receivable - Inayat (AR-CUS0001)');
});

test('IN receipt resolves credit-side revenue account for broad resolver only', () => {
  const lines = [
    {
      debit: 2500,
      credit: 0,
      account: { name: 'NDM MZ', type: 'bank', code: '1012' },
    },
    {
      debit: 0,
      credit: 2500,
      account: { name: 'Sales Income', type: 'revenue', code: '4100' },
    },
  ];
  assert.equal(resolveCounterpartyLabelFromJeLines(lines, 'IN'), 'Sales Income (4100)');
  assert.equal(resolveExpenseCounterpartyFromJeLines(lines, 'IN'), null);
});

test('internal cash transfer returns null counterparty', () => {
  const lines = [
    {
      debit: 1000,
      credit: 0,
      account: { name: 'CASH IN HAND', type: 'cash', code: '1000' },
    },
    {
      debit: 0,
      credit: 1000,
      account: { name: 'NDM MZ', type: 'bank', code: '1012' },
    },
  ];
  assert.equal(resolveCounterpartyLabelFromJeLines(lines, 'OUT'), null);
  assert.equal(resolveCounterpartyLabelFromJeLines(lines, 'IN'), null);
});

test('generic party labels are detected', () => {
  assert.equal(isGenericRoznamchaPartyLabel('Supplier Payment'), true);
  assert.equal(isGenericRoznamchaPartyLabel('Customer Receipt'), true);
  assert.equal(isGenericRoznamchaPartyLabel('HOME EXPENSES (3003)'), false);
  assert.equal(isGenericRoznamchaPartyLabel('Supplier Payment (voided)'), true);
});

test('buildExpenseCounterpartyByDirectionFromJeLines maps expense OUT only', () => {
  const lines = [
    {
      debit: 100,
      credit: 0,
      account: { name: 'HOME EXPENSES', type: 'expense', code: '3003' },
    },
    {
      debit: 0,
      credit: 100,
      account: { name: 'CASH IN HAND', type: 'cash', code: '1000' },
    },
  ];
  const map = buildExpenseCounterpartyByDirectionFromJeLines(lines);
  assert.equal(counterpartyForPaymentDirection(map, 'OUT'), 'HOME EXPENSES (3003)');
  assert.equal(counterpartyForPaymentDirection(map, 'IN'), null);
});

test('buildCounterpartyByDirectionFromJeLines still maps any non-liquidity leg', () => {
  const lines = [
    {
      debit: 100,
      credit: 0,
      account: { name: 'HOME EXPENSES', type: 'expense', code: '3003' },
    },
    {
      debit: 0,
      credit: 100,
      account: { name: 'CASH IN HAND', type: 'cash', code: '1000' },
    },
  ];
  const map = buildCounterpartyByDirectionFromJeLines(lines);
  assert.equal(counterpartyForPaymentDirection(map, 'OUT'), 'HOME EXPENSES (3003)');
});

test('isGeneralLiquidityJournalRef matches JE- and JV- prefixes', () => {
  assert.equal(isGeneralLiquidityJournalRef('JE-0006'), true);
  assert.equal(isGeneralLiquidityJournalRef('JV-000237'), true);
  assert.equal(isGeneralLiquidityJournalRef('FT-00012'), false);
  assert.equal(isGeneralLiquidityJournalRef('RCV-0095'), false);
  assert.equal(isJvJournalEntryNo('JE-0006'), true);
});

test('resolveJvLinkedCounterpartyLabel uses full counterparty for JV rows', () => {
  const lines = [
    {
      debit: 5000,
      credit: 0,
      account: { name: 'Miscellaneous Expense', type: 'expense', code: '6000' },
    },
    {
      debit: 0,
      credit: 5000,
      account: { name: 'CASH IN HAND', type: 'cash', code: '1000' },
    },
  ];
  const jeId = 'je-uuid-1';
  const payId = 'pay-uuid-1';
  const counterpartyByJeId = new Map([[jeId, buildCounterpartyByDirectionFromJeLines(lines)]]);
  const journalEntryIdByPaymentId = new Map([[payId, jeId]]);
  assert.equal(
    resolveJvLinkedCounterpartyLabel(
      payId,
      'OUT',
      'JV-000237',
      journalEntryIdByPaymentId,
      counterpartyByJeId
    ),
    'Miscellaneous Expense (6000)'
  );
  assert.equal(
    resolveJvLinkedCounterpartyLabel(payId, 'IN', 'FT-0001', journalEntryIdByPaymentId, counterpartyByJeId),
    null
  );
});

test('resolveJvLinkedCounterpartyLabel works when journalEntryNo null but ref is JV', () => {
  const lines = [
    {
      debit: 5000,
      credit: 0,
      account: { name: 'Bank', type: 'bank', code: '1010' },
    },
    {
      debit: 0,
      credit: 5000,
      account: { name: 'Accounts Payable', type: 'liability', code: '2000' },
    },
  ];
  const jeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const payId = 'pay-uuid-2';
  const counterpartyByJeId = new Map([[jeId, buildCounterpartyByDirectionFromJeLines(lines)]]);
  const journalEntryIdByPaymentId = new Map<string, string>();
  assert.equal(
    resolveJvLinkedCounterpartyLabel(
      payId,
      'IN',
      'JV-000237',
      journalEntryIdByPaymentId,
      counterpartyByJeId,
      jeId,
    ),
    'Accounts Payable (2000)',
  );
});

test('resolveJvLinkedCounterpartyLabel works with JE- ref and reference_id fallback', () => {
  const lines = [
    {
      debit: 5000,
      credit: 0,
      account: { name: 'M. Ullah Committee', type: 'equity', code: '1172' },
    },
    {
      debit: 0,
      credit: 5000,
      account: { name: 'CASH IN HAND', type: 'cash', code: '1000' },
    },
  ];
  const jeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const payId = 'pay-uuid-je';
  const counterpartyByJeId = new Map([[jeId, buildCounterpartyByDirectionFromJeLines(lines)]]);
  const journalEntryIdByPaymentId = new Map<string, string>();
  assert.equal(
    resolveJvLinkedCounterpartyLabel(
      payId,
      'OUT',
      'JE-0006',
      journalEntryIdByPaymentId,
      counterpartyByJeId,
      jeId,
    ),
    'M. Ullah Committee (1172)',
  );
});

test('seedManualJournalPaymentJeMaps fills JE id and JE number', () => {
  const jeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const noMap = new Map<string, string>();
  const idMap = new Map<string, string>();
  seedManualJournalPaymentJeMaps(
    [
      {
        id: 'pay-2',
        reference_type: 'manual_receipt',
        reference_id: jeId,
        reference_number: 'JE-0006',
      },
    ],
    noMap,
    idMap,
  );
  assert.equal(noMap.get('pay-2'), 'JE-0006');
  assert.equal(idMap.get('pay-2'), jeId);
});

test('seedManualJournalPaymentJeMaps fills JE id and JV number', () => {
  const jeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const noMap = new Map<string, string>();
  const idMap = new Map<string, string>();
  seedManualJournalPaymentJeMaps(
    [
      {
        id: 'pay-1',
        reference_type: 'manual_receipt',
        reference_id: jeId,
        reference_number: 'JV-000237',
      },
    ],
    noMap,
    idMap,
  );
  assert.equal(noMap.get('pay-1'), 'JV-000237');
  assert.equal(idMap.get('pay-1'), jeId);
});

test('formatJvRoznamchaSubtitle joins OUT and IN legs', () => {
  const map = buildCounterpartyByDirectionFromJeLines([
    { debit: 100, credit: 0, account: { name: 'Misc Expense', type: 'expense', code: '6000' } },
    { debit: 0, credit: 100, account: { name: 'Accounts Payable', type: 'liability', code: '2000' } },
  ]);
  assert.equal(formatJvRoznamchaSubtitle(map), 'Misc Expense (6000) → Accounts Payable (2000)');
});

test('isJvBoilerplatePaymentNote flags receipt JV/JE boilerplate', () => {
  assert.equal(isJvBoilerplatePaymentNote('Receipt JV-000237 (Walk-in Customer)'), true);
  assert.equal(isJvBoilerplatePaymentNote('Receipt JE-0006 (Walk-in Customer)'), true);
  assert.equal(isJvBoilerplatePaymentNote('COMETTE NO 03 AB'), false);
});
