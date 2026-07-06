import { describe, expect, it } from 'vitest';
import {
  inferTransactionKind,
  isPureManualJournalReferenceType,
  resolveUnifiedJournalEdit,
} from './unifiedTransactionEdit';

describe('unifiedTransactionEdit', () => {
  it('treats journal and manual as pure manual journal ref types', () => {
    expect(isPureManualJournalReferenceType('journal')).toBe(true);
    expect(isPureManualJournalReferenceType('manual')).toBe(true);
    expect(isPureManualJournalReferenceType('sale')).toBe(false);
  });

  it('resolves bare journal entry to manual_journal_editor', () => {
    const resolution = resolveUnifiedJournalEdit(
      { id: 'je-1', reference_type: 'journal', is_void: false },
      null,
    );
    expect(resolution.kind).toBe('manual_journal_editor');
  });

  it('infers payment kind for manual_receipt journal header', () => {
    expect(
      inferTransactionKind(
        { reference_type: 'manual_receipt', payment_id: 'pay-1' },
        { id: 'pay-1', reference_type: 'manual_receipt', contact_id: 'cust-1' },
      ),
    ).toBe('payment');
  });

  it('resolves customer manual receipt to payment_editor', () => {
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
    expect(resolution.kind).toBe('payment_editor');
    if (resolution.kind === 'payment_editor') {
      expect(resolution.context).toBe('customer');
    }
  });

  it('blocks sale document totals from unified edit', () => {
    const resolution = resolveUnifiedJournalEdit(
      { id: 'je-3', reference_type: 'sale', reference_id: 'sale-1', is_void: false },
      null,
    );
    expect(resolution.kind).toBe('blocked');
  });
});
