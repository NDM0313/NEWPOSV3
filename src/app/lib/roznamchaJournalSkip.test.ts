import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRoznamchaLiquidityAccount } from './liquidityPaymentAccount';
import { buildPaymentBackedSkipJeIdsFromPayments } from './roznamchaBranchFilter';

const JE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const WALI_ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const BANK_ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';

const accountById = new Map([
  [
    WALI_ACCOUNT_ID,
    { code: '1015', type: 'bank', name: 'WALI T/T', linked_contact_id: null },
  ],
  [
    BANK_ACCOUNT_ID,
    { code: '1201', type: 'asset', name: 'USD TT Agent Clearing', linked_contact_id: null },
  ],
]);

type PaymentStub = {
  reference_id?: string | null;
  payment_account_id: string;
  payment_method?: string;
};

/** Mirrors fetchPaymentRows roznamchaBackingPayments collection (no account filter). */
function collectRoznamchaBackingPaymentsForSkip(payments: PaymentStub[]) {
  const out: Array<{ reference_id?: string | null }> = [];
  for (const p of payments) {
    const meta = accountById.get(p.payment_account_id);
    if (!meta || !isRoznamchaLiquidityAccount(meta)) continue;
    out.push({ reference_id: p.reference_id ?? null });
  }
  return out;
}

test('JE with only party T/T payment is not skipped (journal fallback allowed)', () => {
  const allPayments = [
    {
      reference_id: JE_ID,
      payment_account_id: WALI_ACCOUNT_ID,
      payment_method: 'bank',
    },
  ];
  const legacySkip = buildPaymentBackedSkipJeIdsFromPayments(allPayments);
  assert.equal(legacySkip.has(JE_ID), true, 'legacy: raw payment list incorrectly skips JE');

  const backing = collectRoznamchaBackingPaymentsForSkip(allPayments);
  assert.equal(backing.length, 0);
  const fixedSkip = buildPaymentBackedSkipJeIdsFromPayments(backing);
  assert.equal(fixedSkip.has(JE_ID), false);
});

test('JE with roznamcha-visible bank payment is skipped (no duplicate journal row)', () => {
  const payments = [
    {
      reference_id: JE_ID,
      payment_account_id: BANK_ACCOUNT_ID,
      payment_method: 'bank',
    },
  ];
  const backing = collectRoznamchaBackingPaymentsForSkip(payments);
  assert.equal(backing.length, 1);
  const skip = buildPaymentBackedSkipJeIdsFromPayments(backing);
  assert.equal(skip.has(JE_ID), true);
});

test('mixed WALI + bank payments: only bank backs journal skip', () => {
  const payments = [
    {
      reference_id: JE_ID,
      payment_account_id: WALI_ACCOUNT_ID,
      payment_method: 'bank',
    },
    {
      reference_id: JE_ID,
      payment_account_id: BANK_ACCOUNT_ID,
      payment_method: 'bank',
    },
  ];
  const backing = collectRoznamchaBackingPaymentsForSkip(payments);
  assert.equal(backing.length, 1);
  assert.equal(backing[0].reference_id, JE_ID);
  const skip = buildPaymentBackedSkipJeIdsFromPayments(backing);
  assert.equal(skip.has(JE_ID), true);
});
