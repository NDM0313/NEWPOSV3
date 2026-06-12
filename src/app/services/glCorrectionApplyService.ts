/**
 * GL correction draft apply — RPC wrapper (additive JE only).
 */

import { supabase } from '@/lib/supabase';

export interface GlCorrectionApplyResult {
  ok: boolean;
  journalEntryId?: string;
  entryNo?: string;
  auditId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  error?: string;
}

export async function applyGlCorrectionJournalRpc(input: {
  companyId: string;
  repairTarget: string;
  dryRunHash: string;
  confirmPhrase: string;
  userId: string | null;
}): Promise<GlCorrectionApplyResult> {
  const { data, error } = await supabase.rpc('create_gl_correction_journal', {
    p_company_id: input.companyId,
    p_repair_target: input.repairTarget,
    p_dry_run_hash: input.dryRunHash,
    p_confirm_phrase: input.confirmPhrase,
    p_user_id: input.userId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as {
    success?: boolean;
    journal_entry_id?: string;
    entry_no?: string;
    audit_id?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    error?: string;
  } | null;

  if (!row?.success) {
    return { ok: false, error: row?.error || 'GL correction apply failed' };
  }

  return {
    ok: true,
    journalEntryId: row.journal_entry_id,
    entryNo: row.entry_no,
    auditId: row.audit_id,
    before: row.before,
    after: row.after,
  };
}

/** Probe: business errors mean RPC exists. */
export function isGlCorrectionRpcBusinessError(message: string | undefined): boolean {
  const m = (message || '').toLowerCase();
  return (
    m.includes('confirm phrase') ||
    m.includes('unknown or unsupported repair target') ||
    m.includes('dry-run hash mismatch') ||
    m.includes('company_id required') ||
    m.includes('hq-sl-0003') ||
    m.includes('already applied') ||
    m.includes('je-0160') ||
    m.includes('je-0161')
  );
}
