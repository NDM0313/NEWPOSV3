import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parsePkr,
  withinTol,
  MR_JALIL_GOLDEN,
  ROZNAMCHA_GOLDEN,
  TB_GOLDEN,
} from './unifiedLedgerBrowserQaHelpers.mjs';

test('parsePkr handles Rs. comma formatting', () => {
  assert.equal(parsePkr('Rs. 216,299.00'), 216299);
  assert.equal(parsePkr('216,299'), 216299);
});

test('parsePkr handles negative balances', () => {
  assert.equal(parsePkr('-12,624,305.50'), -12624305.5);
});

test('parsePkr returns NaN for empty or non-numeric', () => {
  assert.ok(Number.isNaN(parsePkr('')));
  assert.ok(Number.isNaN(parsePkr('Loading…')));
});

test('parsePkr ignores label text and picks first number', () => {
  assert.equal(parsePkr('Closing balance Rs. 216,299'), 216299);
});

test('withinTol accepts MR JALIL golden', () => {
  assert.equal(withinTol(216299, MR_JALIL_GOLDEN), true);
  assert.equal(withinTol(216299.005, MR_JALIL_GOLDEN), true);
});

test('roznamcha golden components sum to closing', () => {
  assert.equal(ROZNAMCHA_GOLDEN.closing, ROZNAMCHA_GOLDEN.cashIn - ROZNAMCHA_GOLDEN.cashOut);
});

test('TB golden debit equals credit constant', () => {
  assert.equal(TB_GOLDEN, 333268801.7);
});

test('Trial Balance footer regex parses bullet-prefixed totals', () => {
  const body = '• Total Debit: Rs. 333,268,801.7 • Total Credit: Rs. 333,268,801.7';
  const debitM = body.match(/Total Debit:\s*(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  const creditM = body.match(/Total Credit:\s*(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  assert.equal(parsePkr(debitM[1]), TB_GOLDEN);
  assert.equal(parsePkr(creditM[1]), TB_GOLDEN);
});
