import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canOpenOrphanAdjustmentInJournalEditor,
  canUpdateViaManualJournalEditor,
  SOURCE_CONTROLLED_REFERENCE_TYPES,
} from './journalEntryEditPolicy';
import { resolveUnifiedJournalEdit } from './unifiedTransactionEdit';

test('orphan deposit JE opens as journal editor candidate', () => {
  assert.equal(
    canOpenOrphanAdjustmentInJournalEditor('deposit', {}),
    true,
  );
  const resolution = resolveUnifiedJournalEdit(
    { id: 'je-6717', reference_type: 'deposit', reference_id: null, payment_id: null, is_void: false },
    null,
  );
  assert.equal(resolution.kind, 'adjustment_editor');
  if (resolution.kind === 'adjustment_editor') {
    assert.equal(
      canOpenOrphanAdjustmentInJournalEditor('deposit', {
        sourceType: resolution.sourceType,
        sourceId: resolution.sourceId,
      }),
      true,
    );
  }
});

test('source-controlled types and linked adjustments stay closed', () => {
  assert.equal(canOpenOrphanAdjustmentInJournalEditor('sale', {}), false);
  assert.ok(SOURCE_CONTROLLED_REFERENCE_TYPES.has('sale_adjustment'));
  assert.equal(
    canOpenOrphanAdjustmentInJournalEditor('sale_adjustment', {
      sourceType: 'sale',
      sourceId: 'sale-1',
    }),
    false,
  );
  assert.equal(
    canOpenOrphanAdjustmentInJournalEditor('deposit', {
      sourceType: 'expense',
      sourceId: 'exp-1',
    }),
    false,
  );
});

test('canUpdateViaManualJournalEditor allows orphan deposit and pure manual', () => {
  assert.equal(canUpdateViaManualJournalEditor('deposit', { referenceId: null, paymentId: null }), true);
  assert.equal(canUpdateViaManualJournalEditor('journal', {}), true);
  assert.equal(canUpdateViaManualJournalEditor('general', {}), true);
  assert.equal(canUpdateViaManualJournalEditor('transfer', {}), true);
  assert.equal(canUpdateViaManualJournalEditor('sale', {}), false);
  assert.equal(
    canUpdateViaManualJournalEditor('expense', { referenceId: 'exp-1', paymentId: null }),
    false,
  );
  assert.equal(
    canUpdateViaManualJournalEditor('deposit', { referenceId: null, paymentId: 'pay-1' }),
    false,
  );
});
