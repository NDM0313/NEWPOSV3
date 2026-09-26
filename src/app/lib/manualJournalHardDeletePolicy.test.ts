import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isManualJournalHardDeleteEligible,
  isPaymentHardDeleteTarget,
  isValidHardDeleteConfirmPhrase,
  manualJournalHardDeleteBlockedReason,
  manualJournalHardDeleteConfirmMessage,
  MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE,
  MANUAL_JE_HARD_DELETE_LABEL,
} from './manualJournalHardDeletePolicy.ts';
import { getTransactionActions } from './transactionActionRules.ts';

describe('manualJournalHardDeletePolicy', () => {
  it('manual JE is eligible for complete delete', () => {
    assert.equal(
      isManualJournalHardDeleteEligible({
        reference_type: 'journal',
        reference_id: null,
        payment_id: null,
        is_void: false,
      }),
      true
    );
  });

  it('correction_reversal is eligible for complete delete', () => {
    assert.equal(
      isManualJournalHardDeleteEligible({
        reference_type: 'correction_reversal',
        reference_id: 'src',
        payment_id: null,
        is_void: false,
      }),
      true
    );
  });

  it('voided manual JE remains eligible', () => {
    assert.equal(
      isManualJournalHardDeleteEligible({
        reference_type: 'journal',
        payment_id: null,
        is_void: true,
      }),
      true
    );
  });

  it('payment-linked JE is eligible for complete delete', () => {
    assert.equal(
      isManualJournalHardDeleteEligible({
        reference_type: 'payment',
        payment_id: 'pay-1',
        is_void: false,
      }),
      true
    );
    assert.equal(
      isPaymentHardDeleteTarget({
        reference_type: 'manual_receipt',
        payment_id: 'pay-1',
      }),
      true
    );
    assert.equal(
      manualJournalHardDeleteBlockedReason({
        reference_type: 'payment',
        payment_id: 'pay-1',
      }),
      null
    );
  });

  it('sale-linked receive (payment_id + sale rt) is eligible', () => {
    assert.equal(
      isManualJournalHardDeleteEligible({
        reference_type: 'sale',
        reference_id: 's1',
        payment_id: 'pay-sale',
        is_void: false,
      }),
      true
    );
    assert.equal(
      isPaymentHardDeleteTarget({
        reference_type: 'sale',
        payment_id: 'pay-sale',
      }),
      true
    );
  });

  it('source-document sale JE is blocked', () => {
    assert.equal(
      isManualJournalHardDeleteEligible({
        reference_type: 'sale',
        reference_id: 's1',
        payment_id: null,
        is_void: false,
      }),
      false
    );
    assert.match(
      manualJournalHardDeleteBlockedReason({
        reference_type: 'sale',
        reference_id: 's1',
        payment_id: null,
      }) || '',
      /Source-document/i
    );
  });

  it('confirm message warns hard delete and requires phrase', () => {
    const msg = manualJournalHardDeleteConfirmMessage('JE-6741');
    assert.match(msg, /JE-6741/);
    assert.match(msg, /HARD DELETE/);
    assert.match(msg, /permanently/i);
    const payMsg = manualJournalHardDeleteConfirmMessage('JE-100', { isPayment: true });
    assert.match(payMsg, /payment record/i);
    assert.match(payMsg, /allocations/i);
    assert.equal(isValidHardDeleteConfirmPhrase('HARD DELETE'), true);
    assert.equal(isValidHardDeleteConfirmPhrase('hard delete'), false);
    assert.equal(isValidHardDeleteConfirmPhrase(''), false);
    assert.equal(MANUAL_JE_HARD_DELETE_CONFIRM_PHRASE, 'HARD DELETE');
  });

  it('detail modal exposes Complete Delete for manual JE', () => {
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
    const hard = actions.find((a) => a.id === 'complete_delete');
    assert.ok(hard);
    assert.equal(hard!.label, MANUAL_JE_HARD_DELETE_LABEL);
    assert.ok(actions.some((a) => a.id === 'cancel_entry'));
  });

  it('detail modal exposes Complete Delete for receive/pay', () => {
    const actions = getTransactionActions(
      {
        reference_type: 'on_account',
        reference_id: 'c1',
        payment_id: 'pay-1',
        is_void: false,
        journal_line_count: 2,
        payment_obj: { id: 'pay-1', reference_type: 'on_account', payment_type: 'paid' },
      },
      'detail_modal',
      { includeViewAction: false }
    );
    assert.ok(actions.some((a) => a.id === 'complete_delete'));
    assert.ok(actions.some((a) => a.id === 'cancel_payment'));
  });

  it('detail modal exposes Complete Delete for correction_reversal', () => {
    const actions = getTransactionActions(
      {
        reference_type: 'correction_reversal',
        reference_id: 'src',
        payment_id: null,
        is_void: false,
      },
      'detail_modal',
      { includeViewAction: false }
    );
    assert.ok(actions.some((a) => a.id === 'complete_delete'));
    assert.ok(!actions.some((a) => a.id === 'cancel_entry'));
  });

  it('sale source document does not get Complete Delete', () => {
    const actions = getTransactionActions(
      {
        reference_type: 'sale',
        reference_id: 's1',
        payment_id: null,
        is_void: false,
      },
      'detail_modal',
      { includeViewAction: false }
    );
    assert.ok(!actions.some((a) => a.id === 'complete_delete'));
  });
});
