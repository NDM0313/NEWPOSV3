import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPaymentContactRow,
  classifyBranchAttributionRow,
  classifyOpeningBalanceRiskRow,
} from './confidence-rules.mjs';

describe('classifyPaymentContactRow', () => {
  it('marks sale customer match as safe_apply', () => {
    const r = classifyPaymentContactRow({
      payment_id: 'p1',
      sale_id: 's1',
      proposed_contact_id: 'c1',
      sale_status: 'final',
    });
    assert.equal(r.safe_apply, true);
    assert.equal(r.confidence, 'high');
  });

  it('flags allocation conflict as manual_review', () => {
    const r = classifyPaymentContactRow({
      payment_id: 'p1',
      sale_id: 's1',
      proposed_contact_id: 'c1',
      allocation_customer_conflict: true,
    });
    assert.equal(r.safe_apply, false);
    assert.equal(r.manual_review, true);
  });
});

describe('classifyBranchAttributionRow', () => {
  it('marks transfer as manual_review', () => {
    const r = classifyBranchAttributionRow({
      reference_type: 'transfer',
      proposed_branch_id: 'b1',
    });
    assert.equal(r.safe_apply, false);
  });

  it('marks document branch match as safe_apply', () => {
    const r = classifyBranchAttributionRow({
      reference_type: 'sale',
      linked_document_branch_id: 'b1',
      proposed_branch_id: 'b1',
    });
    assert.equal(r.safe_apply, true);
  });
});

describe('classifyOpeningBalanceRiskRow', () => {
  it('always manual_review', () => {
    const r = classifyOpeningBalanceRiskRow({ journal_entry_id: 'je1' });
    assert.equal(r.safe_apply, false);
  });
});
