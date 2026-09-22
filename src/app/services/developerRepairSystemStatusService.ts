/**
 * Read-only probes for Developer Center repair system readiness.
 * No audit inserts, no repair applies, no data mutation.
 */

import { canApplyDeveloperRepair, canonRole } from '@/app/lib/developerAccountingAccess';
import {
  buildDeveloperRepairSystemStatus,
  isGlCorrectionRpcBusinessError,
  isMissingSchemaObjectError,
  isRelinkRpcBusinessError,
  ZERO_UUID,
  type DeveloperRepairSystemStatus,
} from '@/app/lib/developerRepairSystemStatus';
import { supabase } from '@/lib/supabase';

async function probeAuditTable(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('developer_repair_audit')
    .select('id', { head: true, count: 'exact' });

  if (!error) return { ok: true };

  const code = (error as { code?: string }).code;
  if (isMissingSchemaObjectError(error.message, code)) {
    return { ok: false, error: error.message };
  }

  // RLS deny or other errors still mean table exists
  return { ok: true };
}

async function probeRelinkRpc(companyId: string): Promise<{ ok: boolean; error?: string }> {
  const probeCompanyId = companyId || ZERO_UUID;
  const { error } = await supabase.rpc('developer_repair_relink_payment_je', {
    p_company_id: probeCompanyId,
    p_payment_id: ZERO_UUID,
    p_journal_entry_id: ZERO_UUID,
  });

  if (!error) {
    // Unexpected success on zero UUIDs — RPC exists
    return { ok: true };
  }

  const code = (error as { code?: string }).code;
  if (isRelinkRpcBusinessError(error.message)) {
    return { ok: true };
  }
  if (isMissingSchemaObjectError(error.message, code)) {
    return { ok: false, error: error.message };
  }

  // Other errors (permissions, etc.) — treat RPC as present
  return { ok: true };
}

async function probeGlCorrectionRpc(companyId: string): Promise<{ ok: boolean; error?: string }> {
  const probeCompanyId = companyId || ZERO_UUID;
  const { error } = await supabase.rpc('create_gl_correction_journal', {
    p_company_id: probeCompanyId,
    p_repair_target: '',
    p_dry_run_hash: '',
    p_confirm_phrase: '',
    p_user_id: null,
  });

  if (!error) return { ok: true };

  const code = (error as { code?: string }).code;
  if (isGlCorrectionRpcBusinessError(error.message)) return { ok: true };
  if (isMissingSchemaObjectError(error.message, code)) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function loadDeveloperRepairSystemStatus(
  companyId: string | null | undefined,
  userRole: string | null | undefined
): Promise<DeveloperRepairSystemStatus> {
  const [auditProbe, rpcProbe, glCorrectionProbe] = await Promise.all([
    probeAuditTable(),
    probeRelinkRpc(companyId || ''),
    probeGlCorrectionRpc(companyId || ''),
  ]);

  const roleLabel = canonRole(userRole) || 'unknown';
  const canApply = canApplyDeveloperRepair(userRole);

  return buildDeveloperRepairSystemStatus({
    companyIdPresent: Boolean(companyId),
    auditTableAvailable: auditProbe.ok,
    auditTableError: auditProbe.error,
    relinkRpcAvailable: rpcProbe.ok,
    relinkRpcError: rpcProbe.error,
    glCorrectionRpcAvailable: glCorrectionProbe.ok,
    glCorrectionRpcError: glCorrectionProbe.error,
    canApply,
    userRoleLabel: roleLabel,
  });
}
