import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isManualJournalCancelEligible,
  MANUAL_JE_CANCEL_LABEL,
} from './manualJournalCancelPolicy.ts';
import { getTransactionActions } from './transactionActionRules.ts';

describe('manualJournalCancelPolicy', () => {
  it('manual JE is eligible for cancel entry void path', () => {
    assert.equal(
      isManualJournalCancelEligible({
        reference_type: 'journal',
        reference_id: null,
        payment_id: null,
        is_void: false,
      }),
      true
    );
  });

  it('source-document sale JE is not eligible', () => {
    assert.equal(
      isManualJournalCancelEligible({
        reference_type: 'sale',
        reference_id: 's1',
        payment_id: null,
        is_void: false,
      }),
      false
    );
  });

  it('manual JE action label is Cancel Entry not Delete', () => {
    const actions = getTransactionActions(
      {
        reference_type: 'journal',
        reference_id: null,
        payment_id: null,
        is_void: false,
      },
      'detail_modal',
      { includeViewAction: false }
    );
    const cancel = actions.find((a) => a.id === 'cancel_entry');
    assert.ok(cancel);
    assert.equal(cancel!.label, MANUAL_JE_CANCEL_LABEL);
    assert.ok(!actions.some((a) => a.label.toLowerCase().includes('delete')));
  });
});
