import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  paymentMatchesRoznamchaBranch,
  rentalMatchesRoznamchaBranch,
  buildPaymentBackedSkipJeIdsFromPayments,
} from './roznamchaBranchFilter';

const HQ = '11111111-1111-4111-8111-111111111111';
const BRANCH = '22222222-2222-4222-8222-222222222222';

test('buildPaymentBackedSkipJeIdsFromPayments collects UUID reference_id only', () => {
  const jeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const skip = buildPaymentBackedSkipJeIdsFromPayments([
    { reference_id: jeId },
    { reference_id: 'not-a-uuid' },
    { reference_id: null },
  ]);
  assert.equal(skip.size, 1);
  assert.equal(skip.has(jeId), true);
});

test('paymentMatchesRoznamchaBranch includes null branch_id when branch filter active', () => {
  assert.equal(
    paymentMatchesRoznamchaBranch({ branch_id: null, reference_type: 'manual_payment' }, BRANCH, new Map()),
    true,
  );
});

test('paymentMatchesRoznamchaBranch matches explicit branch_id', () => {
  assert.equal(
    paymentMatchesRoznamchaBranch({ branch_id: BRANCH, reference_type: 'manual_payment' }, BRANCH, new Map()),
    true,
  );
  assert.equal(
    paymentMatchesRoznamchaBranch({ branch_id: HQ, reference_type: 'manual_payment' }, BRANCH, new Map()),
    false,
  );
});

test('paymentMatchesRoznamchaBranch rental fallback via rentalBranchById', () => {
  const rentalId = 'rental-1';
  const map = new Map([[rentalId, BRANCH]]);
  assert.equal(
    paymentMatchesRoznamchaBranch(
      { branch_id: null, reference_type: 'rental', reference_id: rentalId },
      BRANCH,
      map,
    ),
    true,
  );
});

test('rentalMatchesRoznamchaBranch includes null je branch when branch filter active', () => {
  assert.equal(rentalMatchesRoznamchaBranch(BRANCH, null, null), true);
  assert.equal(rentalMatchesRoznamchaBranch(BRANCH, null, BRANCH), true);
  assert.equal(rentalMatchesRoznamchaBranch(BRANCH, null, HQ), false);
});
