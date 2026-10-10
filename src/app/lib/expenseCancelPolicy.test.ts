import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  expenseDeleteOrCancelLabel,
  isPostedExpenseStatus,
} from './expenseCancelPolicy';

test('draft expense uses Delete label', () => {
  assert.equal(isPostedExpenseStatus('draft'), false);
  assert.equal(isPostedExpenseStatus('pending'), false);
  assert.equal(expenseDeleteOrCancelLabel('draft'), 'Delete Expense');
});

test('posted expense uses Cancel label', () => {
  assert.equal(isPostedExpenseStatus('paid'), true);
  assert.equal(isPostedExpenseStatus('approved'), true);
  assert.equal(isPostedExpenseStatus('submitted'), true);
  assert.equal(expenseDeleteOrCancelLabel('paid'), 'Cancel Expense');
});
