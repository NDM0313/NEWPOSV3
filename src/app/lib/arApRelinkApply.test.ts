import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRelinkContactApplyPayload,
  canSaveRelinkContact,
  isJournalTraceOnlyRelinkContext,
  relinkSaveButtonLabel,
} from './arApRelinkApply.ts';

describe('arApRelinkApply', () => {
  it('treats correction_reversal as trace-only', () => {
    assert.equal(isJournalTraceOnlyRelinkContext({ reference_type: 'correction_reversal' }), true);
    assert.equal(isJournalTraceOnlyRelinkContext({ is_void: true }), true);
    assert.equal(isJournalTraceOnlyRelinkContext({ reference_type: 'payment' }), false);
  });

  it('uses Save Link for Trace label on reversal rows', () => {
    assert.equal(relinkSaveButtonLabel(true), 'Save Link for Trace');
    assert.equal(relinkSaveButtonLabel(false), 'Save Link');
  });

  it('requires selected contact and permission', () => {
    assert.equal(
      canSaveRelinkContact({
        selectedContactId: 'c1',
        canApplyRelinkMapping: true,
        journalEntryId: 'je-1',
      }),
      true
    );
    assert.equal(
      canSaveRelinkContact({
        selectedContactId: null,
        canApplyRelinkMapping: true,
        journalEntryId: 'je-1',
      }),
      false
    );
  });

  it('audit payload never includes GL line amount fields', () => {
    const p = buildRelinkContactApplyPayload({
      companyId: 'co-1',
      journalEntryId: 'je-168',
      journalLineId: 'line-1',
      partyContactId: 'contact-1',
      suggestedFrom: 'payment.contact',
      entryNo: 'JE-0168',
      beforeContactName: 'Unmapped',
      afterContactName: 'Saqib',
      traceOnly: true,
    });
    assert.equal(p.audit.reason_code, 'ar_ap_relink_contact_audit_trace');
    assert.equal(p.audit.metadata.gl_lines_unchanged, true);
    assert.equal(p.audit.metadata.trace_only, true);
    assert.equal((p.audit as Record<string, unknown>).debit, undefined);
    assert.equal((p.audit as Record<string, unknown>).credit, undefined);
    assert.ok(p.mapping.partyContactId === 'contact-1');
    assert.ok(!('debit' in p.audit.metadata));
    assert.ok(!('credit' in p.audit.metadata));
  });
});
