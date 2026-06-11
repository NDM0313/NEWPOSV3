import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTransactionActions,
  isSourceControlledAccountingDocument,
} from './transactionActionRules.ts';

describe('transactionActionRules', () => {
  it('treats document-root sale JE as source-controlled', () => {
    assert.equal(
      isSourceControlledAccountingDocument({
        reference_type: 'sale',
        reference_id: 'sale-1',
        payment_id: null,
      }),
      true
    );
  });

  it('allows payment settlement on sale reference_type when payment_id is set', () => {
    assert.equal(
      isSourceControlledAccountingDocument({
        reference_type: 'sale',
        reference_id: 'sale-1',
        payment_id: 'pay-1',
      }),
      false
    );
  });

  it('source document row exposes open source + audit only (no cancel)', () => {
    const actions = getTransactionActions(
      {
        reference_type: 'purchase',
        reference_id: 'po-1',
        payment_id: null,
        is_void: false,
      },
      'journal',
      { sourceOpenTarget: { kind: 'purchase', id: 'po-1' } }
    );
    assert.deepEqual(
      actions.map((a) => a.id),
      ['view', 'open_source_document', 'view_trace', 'view_audit']
    );
    assert.ok(!actions.some((a) => a.id === 'cancel_payment' || a.id === 'cancel_entry'));
  });

  it('payment row exposes edit + cancel payment in detail modal', () => {
    const actions = getTransactionActions(
      {
        reference_type: 'sale',
        reference_id: 'sale-1',
        payment_id: 'pay-1',
        is_void: false,
      },
      'detail_modal',
      { includeViewAction: false }
    );
    const ids = actions.map((a) => a.id);
    assert.ok(ids.includes('edit'));
    assert.ok(ids.includes('cancel_payment'));
    assert.ok(ids.includes('view_trace'));
    assert.ok(!ids.includes('open_source_document'));
  });
});
