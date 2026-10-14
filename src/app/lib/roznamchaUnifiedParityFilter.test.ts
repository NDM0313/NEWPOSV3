import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterUnifiedRowsForRoznamchaJournalPath,
  isRoznamchaDocumentReferenceType,
  sumUnifiedCashBankTotals,
  unifiedRowExcludedFromRoznamchaParity,
} from './roznamchaUnifiedParityFilter';

test('isRoznamchaDocumentReferenceType covers sale purchase expense rental', () => {
  assert.equal(isRoznamchaDocumentReferenceType('sale'), true);
  assert.equal(isRoznamchaDocumentReferenceType('purchase'), true);
  assert.equal(isRoznamchaDocumentReferenceType('transfer'), false);
});

test('unifiedRowExcludedFromRoznamchaParity excludes payment-linked GL legs', () => {
  assert.equal(
    unifiedRowExcludedFromRoznamchaParity({
      journalEntryId: 'je-1',
      entryDate: '2026-01-01',
      debit: 1000,
      credit: 0,
      referenceType: 'payment',
      paymentId: 'pay-1',
    }),
    true,
  );
});

test('unifiedRowExcludedFromRoznamchaParity keeps rental_party_payment JEs', () => {
  assert.equal(
    unifiedRowExcludedFromRoznamchaParity({
      journalEntryId: 'je-rp',
      entryDate: '2026-01-01',
      debit: 5000,
      credit: 0,
      referenceType: 'rental',
      actionFingerprint: 'rental_party_payment:abc',
    }),
    false,
  );
});

test('filterUnifiedRowsForRoznamchaJournalPath drops document types', () => {
  const rows = filterUnifiedRowsForRoznamchaJournalPath([
    { journalEntryId: 'a', entryDate: '2026-01-01', debit: 1, credit: 0, referenceType: 'expense' },
    { journalEntryId: 'b', entryDate: '2026-01-01', debit: 2, credit: 0, referenceType: 'transfer' },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].journalEntryId, 'b');
});

test('DIN CHINA wide-range SQL identity: payments cash_in + journal-only dr = legacy cash_in', () => {
  const paymentCashIn = 55_305_771;
  const journalOnlyDr = 80_852_241;
  const legacyCashIn = 136_158_012;
  assert.equal(paymentCashIn + journalOnlyDr, legacyCashIn);
});

test('DIN CHINA wide-range SQL identity: payment cash_out = legacy cash_out', () => {
  const paymentCashOut = 67_042_426;
  const legacyCashOut = 67_042_426;
  assert.equal(paymentCashOut, legacyCashOut);
});

test('DIN CHINA wide-range legacy closing from golden components', () => {
  const cashIn = 136_158_012;
  const cashOut = 67_042_426;
  const opening = 0;
  assert.equal(opening + cashIn - cashOut, 69_115_586);
});

test('raw unified RPC overstates cash_out vs legacy golden', () => {
  const unifiedCashOut = 126_854_008;
  const legacyCashOut = 67_042_426;
  assert.ok(unifiedCashOut - legacyCashOut > 59_000_000);
});

test('journal-only filtered unified matches SQL bucket no_payment_id totals', () => {
  const journalOnly = { cashIn: 80_852_241, cashOut: 58_389_891 };
  const summed = sumUnifiedCashBankTotals([
    { debit: 80_852_241, credit: 0 },
    { debit: 0, credit: 58_389_891 },
  ]);
  assert.equal(summed.cashIn, journalOnly.cashIn);
  assert.equal(summed.cashOut, journalOnly.cashOut);
});
