import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  inferTransactionKind,
  isPureManualJournalReferenceType,
  resolveUnifiedJournalEdit,
} from './unifiedTransactionEdit';

test('treats journal, manual, and general as pure manual journal ref types', () => {
  assert.equal(isPureManualJournalReferenceType('journal'), true);
  assert.equal(isPureManualJournalReferenceType('manual'), true);
  assert.equal(isPureManualJournalReferenceType('general'), true);
  assert.equal(isPureManualJournalReferenceType('sale'), false);
});

test('resolves bare journal entry to manual_journal_editor', () => {
  const resolution = resolveUnifiedJournalEdit(
    { id: 'je-1', reference_type: 'journal', is_void: false },
    null,
  );
  assert.equal(resolution.kind, 'manual_journal_editor');
});

test('resolves mobile general entry to manual_journal_editor', () => {
  const resolution = resolveUnifiedJournalEdit(
    { id: 'je-mobile', reference_type: 'general', payment_id: 'pay-1', is_void: false },
    { id: 'pay-1', reference_type: 'manual_receipt' },
  );
  assert.equal(resolution.kind, 'manual_journal_editor');
  assert.equal(inferTransactionKind({ reference_type: 'general' }, null), 'manual_journal');
});

test('infers payment kind for manual_receipt journal header', () => {
  assert.equal(
    inferTransactionKind(
      { reference_type: 'manual_receipt', payment_id: 'pay-1' },
      { id: 'pay-1', reference_type: 'manual_receipt', contact_id: 'cust-1' },
    ),
    'payment',
  );
});

test('resolves customer manual receipt to payment_editor', () => {
  const resolution = resolveUnifiedJournalEdit(
    {
      id: 'je-2',
      reference_type: 'manual_receipt',
      reference_id: 'cust-1',
      payment_id: 'pay-1',
      is_void: false,
    },
    { id: 'pay-1', reference_type: 'manual_receipt', contact_id: 'cust-1' },
  );
  assert.equal(resolution.kind, 'payment_editor');
  if (resolution.kind === 'payment_editor') {
    assert.equal(resolution.context, 'customer');
  }
});

test('blocks sale document totals from unified edit', () => {
  const resolution = resolveUnifiedJournalEdit(
    { id: 'je-3', reference_type: 'sale', reference_id: 'sale-1', is_void: false },
    null,
  );
  assert.equal(resolution.kind, 'blocked');
});
