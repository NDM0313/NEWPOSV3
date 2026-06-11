import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { paymentMatchesRoznamchaBranch } from './roznamchaBranchMatch.ts';

const HQ = 'df93b9e4-feea-4b8b-8103-e630c185261b';
const OTHER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const JE_ID = '11111111-2222-3333-4444-555555555555';

describe('paymentMatchesRoznamchaBranch', () => {
  const emptyMaps = {
    rentalBranchById: new Map<string, string>(),
    journalBranchById: new Map<string, string>(),
    saleBranchById: new Map<string, string>(),
  };

  it('allows all rows when branch filter is null', () => {
    assert.equal(
      paymentMatchesRoznamchaBranch({ branch_id: null, reference_type: 'manual_receipt' }, null, emptyMaps),
      true
    );
  });

  it('matches payment.branch_id directly', () => {
    assert.equal(
      paymentMatchesRoznamchaBranch({ branch_id: HQ, reference_type: 'manual_receipt' }, HQ, emptyMaps),
      true
    );
  });

  it('falls back to journal_entries.branch_id for manual_receipt with null payment branch', () => {
    const maps = {
      ...emptyMaps,
      journalBranchById: new Map([[JE_ID, HQ]]),
    };
    assert.equal(
      paymentMatchesRoznamchaBranch(
        { branch_id: null, reference_type: 'manual_receipt', reference_id: JE_ID },
        HQ,
        maps
      ),
      true
    );
    assert.equal(
      paymentMatchesRoznamchaBranch(
        { branch_id: null, reference_type: 'manual_receipt', reference_id: JE_ID },
        OTHER,
        maps
      ),
      false
    );
  });
});
