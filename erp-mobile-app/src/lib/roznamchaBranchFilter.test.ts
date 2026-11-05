import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaymentBackedSkipJeIdsFromPayments,
  paymentMatchesRoznamchaBranch,
} from './roznamchaBranchFilter';

const JE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const JE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const BRANCH_X = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const BRANCH_Y = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('roznamchaBranchFilter (mobile)', () => {
  it('buildPaymentBackedSkipJeIdsFromPayments collects JE ids from manual backfill payments', () => {
    const skip = buildPaymentBackedSkipJeIdsFromPayments([
      { reference_id: JE_A },
      { reference_id: 'not-a-uuid' },
      { reference_id: JE_B },
    ]);
    assert.equal(skip.size, 2);
    assert.ok(skip.has(JE_A));
    assert.ok(skip.has(JE_B));
  });

  it('company-wide manual payment refs skip JE even when branch filter hides payment row', () => {
    const companyWideSkip = buildPaymentBackedSkipJeIdsFromPayments([
      { reference_id: JE_A },
    ]);
    const payment = {
      branch_id: BRANCH_X,
      reference_type: 'manual_payment',
      reference_id: JE_A,
    };
    const visibleInBranchY = paymentMatchesRoznamchaBranch(payment, BRANCH_Y, new Map());
    assert.equal(visibleInBranchY, false);
    assert.ok(companyWideSkip.has(JE_A), 'skip set must still include JE when payment branch mismatches viewer');
  });

  it('null payment branch_id passes any branch filter', () => {
    const payment = { branch_id: null, reference_type: 'manual_payment', reference_id: JE_A };
    assert.equal(paymentMatchesRoznamchaBranch(payment, BRANCH_Y, new Map()), true);
  });
});
