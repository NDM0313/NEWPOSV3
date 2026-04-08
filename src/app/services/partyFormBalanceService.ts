/**
 * Add Entry / receipt forms: merge GL-aligned party balances (journal subledger) with
 * operational open-document balances from get_contact_balances_summary.
 */

import { supabase } from '@/lib/supabase';
import { contactService } from '@/app/services/contactService';
import { assertCanonicalSource } from '@/app/services/accountingCanonicalGuard';

export type PartyFormBalanceRow = {
  glArReceivable: number;
  glApPayable: number;
  glWorkerPayable: number;
  opReceivable: number;
  opPayable: number;
};

function safeBranchForRpc(branchId: string | null | undefined): string | null {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const s = branchId && branchId !== 'all' ? String(branchId).trim() : '';
  return s && uuidRegex.test(s) ? s : null;
}

/**
 * One map entry per company contact: GL columns from get_contact_party_gl_balances RPC;
 * operational columns from get_contact_balances_summary (null RPC → zeros).
 */
export async function loadPartyFormBalances(
  companyId: string,
  branchId: string | null | undefined
): Promise<{
  byContactId: Map<string, PartyFormBalanceRow>;
  glRpcOk: boolean;
  operationalRpcOk: boolean;
}> {
  const b = safeBranchForRpc(branchId ?? null);
  assertCanonicalSource('partyFormBalanceService', 'get_contact_party_gl_balances', { companyId, branchId: b });
  assertCanonicalSource('partyFormBalanceService', 'get_contact_balances_summary', { companyId, branchId: b });

  const [glRpc, opRes] = await Promise.all([
    supabase.rpc('get_contact_party_gl_balances', {
      p_company_id: companyId,
      p_branch_id: b,
    }),
    contactService.getContactBalancesSummary(companyId, branchId ?? null),
  ]);

  const glRpcOk = !glRpc.error && Array.isArray(glRpc.data);
  if (glRpc.error && import.meta.env?.DEV) {
    console.warn('[partyFormBalanceService] get_contact_party_gl_balances:', glRpc.error.message);
  }

  const operationalRpcOk = !opRes.error;
  const byContactId = new Map<string, PartyFormBalanceRow>();

  if (glRpcOk) {
    for (const row of glRpc.data as {
      contact_id: string;
      gl_ar_receivable?: number | string | null;
      gl_ap_payable?: number | string | null;
      gl_worker_payable?: number | string | null;
    }[]) {
      if (!row?.contact_id) continue;
      const cur = byContactId.get(row.contact_id) ?? {
        glArReceivable: 0,
        glApPayable: 0,
        glWorkerPayable: 0,
        opReceivable: 0,
        opPayable: 0,
      };
      cur.glArReceivable = Number(row.gl_ar_receivable ?? 0) || 0;
      cur.glApPayable = Number(row.gl_ap_payable ?? 0) || 0;
      cur.glWorkerPayable = Number(row.gl_worker_payable ?? 0) || 0;
      byContactId.set(row.contact_id, cur);
    }
  }

  if (!opRes.error) {
    for (const [id, v] of opRes.map.entries()) {
      const cur = byContactId.get(id) ?? {
        glArReceivable: 0,
        glApPayable: 0,
        glWorkerPayable: 0,
        opReceivable: 0,
        opPayable: 0,
      };
      cur.opReceivable = Number(v.receivables ?? 0) || 0;
      cur.opPayable = Number(v.payables ?? 0) || 0;
      byContactId.set(id, cur);
    }
  }

  return { byContactId, glRpcOk, operationalRpcOk };
}
