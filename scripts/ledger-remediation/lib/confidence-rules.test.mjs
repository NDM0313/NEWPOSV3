import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPaymentContactRow,
  classifyBranchAttributionRow,
  classifyOpeningBalanceRiskRow,
  summarizeRows,
} from './confidence-rules.mjs';

describe('classifyPaymentContactRow', () => {
  it('marks sale customer match as safe_apply', () => {
    const row = classifyPaymentContactRow({
      payment_id: 'p1',
      proposed_contact_id: 'c1',
      allocation_customer_conflict: false,
      contact_id_already_set: false,
      reason: 'sale_customer_id_match',
    });
    assert.equal(row.safe_apply, true);
    assert.equal(row.confidence, 'high');
  });

  it('excludes allocation conflict from safe_apply', () => {
    const row = classifyPaymentContactRow({
      payment_id: 'p1',
      proposed_contact_id: 'c1',
      allocation_customer_conflict: true,
    });
    assert.equal(row.safe_apply, false);
    assert.match(row.reason, /allocation/);
  });

  it('excludes wrong-party payments', () => {
    const row = classifyPaymentContactRow(
      { payment_id: 'p1', proposed_contact_id: 'c1' },
      new Set(['p1'])
    );
    assert.equal(row.safe_apply, false);
  });
});

describe('classifyBranchAttributionRow', () => {
  it('safe_apply when linked document branch matches', () => {
    const row = classifyBranchAttributionRow({
      reference_type: 'sale',
      proposed_branch_id: 'b1',
      linked_document_branch_id: 'b1',
      resolution_confidence: 'high',
      resolution_source: 'sale_branch_id',
    });
    assert.equal(row.safe_apply, true);
  });

  it('manual_review for transfers', () => {
    const row = classifyBranchAttributionRow({
      reference_type: 'transfer',
      proposed_branch_id: 'b1',
      linked_document_branch_id: 'b1',
      resolution_confidence: 'high',
    });
    assert.equal(row.safe_apply, false);
    assert.match(row.reason, /transfer/);
  });
});

describe('classifyOpeningBalanceRiskRow', () => {
  it('never safe_apply', () => {
    const row = classifyOpeningBalanceRiskRow({ company_id: 'x' });
    assert.equal(row.safe_apply, false);
    assert.equal(row.manual_review, true);
  });
});

describe('summarizeRows', () => {
  it('aggregates safe vs manual', () => {
    const totals = summarizeRows([
      { company_name: 'A', issue_type: 'payments_missing_contact_sale_linked', safe_apply: true },
      { company_name: 'A', issue_type: 'payments_missing_contact_sale_linked', safe_apply: false },
    ]);
    assert.equal(totals.length, 1);
    assert.equal(totals[0].safe_apply, 1);
    assert.equal(totals[0].manual_review, 1);
  });
});
