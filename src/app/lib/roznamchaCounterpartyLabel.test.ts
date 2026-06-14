import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCounterpartyByDirectionFromJeLines,
  buildExpenseCounterpartyByDirectionFromJeLines,
  counterpartyForPaymentDirection,
  isGenericRoznamchaPartyLabel,
  resolveCounterpartyLabelFromJeLines,
  resolveExpenseCounterpartyFromJeLines,
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
