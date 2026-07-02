/**
 * Phase 2A — safe metadata-only Fix Link apply helpers (no GL line mutations).
 */

export interface RelinkJournalContext {
  is_void?: boolean | null;
  reference_type?: string | null;
}

export function isJournalTraceOnlyRelinkContext(journal: RelinkJournalContext | null | undefined): boolean {
  if (!journal) return false;
  if (journal.is_void) return true;
  const rt = String(journal.reference_type || '').toLowerCase().trim();
  return rt === 'correction_reversal' || rt === 'reversal';
}

export function relinkSaveButtonLabel(traceOnly: boolean): string {
  return traceOnly ? 'Save Link for Trace' : 'Save Link';
}

export function canSaveRelinkContact(params: {
  selectedContactId: string | null | undefined;
  canApplyRelinkMapping: boolean;
  journalEntryId: string | null | undefined;
}): boolean {
  if (!params.canApplyRelinkMapping) return false;
  if (!params.journalEntryId) return false;
  if (!params.selectedContactId) return false;
  return true;
}

/** Audit + mapping payload — never includes JE line amount fields. */
export function buildRelinkContactApplyPayload(params: {
  companyId: string;
  journalEntryId: string;
  journalLineId: string | null;
  partyContactId: string;
  suggestedFrom: string;
  entryNo?: string | null;
  beforeContactName?: string | null;
  afterContactName: string;
  traceOnly: boolean;
  notes?: string;
}): {
  mapping: {
    companyId: string;
    journalEntryId: string;
    journalLineId: string | null;
    partyContactId: string;
    suggestedFrom: string;
    notes?: string;
  };
  audit: {
    company_id: string;
    table_name: string;
    row_id: string;
    column_name: string;
    old_value: string;
    new_value: string;
    reason_code: string;
    metadata: Record<string, unknown>;
  };
} {
  const reasonCode = params.traceOnly ? 'ar_ap_relink_contact_audit_trace' : 'ar_ap_relink_contact';
  return {
    mapping: {
      companyId: params.companyId,
      journalEntryId: params.journalEntryId,
      journalLineId: params.journalLineId,
      partyContactId: params.partyContactId,
      suggestedFrom: params.suggestedFrom,
      notes: params.notes,
    },
    audit: {
      company_id: params.companyId,
      table_name: 'journal_party_contact_mapping',
      row_id: params.journalEntryId,
      column_name: 'party_contact_id',
      old_value: params.beforeContactName || '',
      new_value: params.afterContactName,
      reason_code: reasonCode,
      metadata: {
        journal_entry_id: params.journalEntryId,
        journal_line_id: params.journalLineId,
        party_contact_id: params.partyContactId,
        entry_no: params.entryNo ?? null,
        trace_only: params.traceOnly,
        gl_lines_unchanged: true,
      },
    },
  };
}
