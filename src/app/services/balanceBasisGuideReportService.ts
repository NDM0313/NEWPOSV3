/**
 * Balance Basis Guide — operational clamp vs party GL signed vs control GL.
 * Read-only; uses existing RPCs (no migrations).
 */

import { supabase } from '@/lib/supabase';
import { contactService } from '@/app/services/contactService';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import {
  buildBalanceBasisGuideRow,
  mergeControlTotals,
  sumBalanceBasisGuideTotals,
  type BalanceBasisGuideRow,
  type BalanceBasisGuideTotals,
} from '@/app/lib/balanceBasisGuideLogic';
import { safeBranchForFilter } from '@/app/services/arApReconciliationCenterService';

export type BalanceBasisGuideReportResult = {
  rows: BalanceBasisGuideRow[];
  totals: BalanceBasisGuideTotals;
  controlAccounts: {
    ar1100: { code: string; name: string; balanceDrMinusCr: number | null };
    ap2000: { code: string; name: string; balanceCrMinusDr: number | null };
    wp2010: { code: string; name: string; balanceCrMinusDr: number | null };
  };
  asOfDate: string;
  error: string | null;
};

function pickSnapshotRow(data: unknown): {
  gl_ar_net_dr_minus_cr: number | null;
  gl_ap_net_credit: number | null;
} | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    const row = data[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      gl_ar_net_dr_minus_cr: row.gl_ar_net_dr_minus_cr != null ? Number(row.gl_ar_net_dr_minus_cr) : null,
      gl_ap_net_credit: row.gl_ap_net_credit != null ? Number(row.gl_ap_net_credit) : null,
    };
  }
  const row = data as Record<string, unknown>;
  return {
    gl_ar_net_dr_minus_cr: row.gl_ar_net_dr_minus_cr != null ? Number(row.gl_ar_net_dr_minus_cr) : null,
    gl_ap_net_credit: row.gl_ap_net_credit != null ? Number(row.gl_ap_net_credit) : null,
  };
}

export async function loadBalanceBasisGuideReport(
  companyId: string,
  opts: { branchId?: string | null; asOfDate?: string }
): Promise<BalanceBasisGuideReportResult> {
  const asOfDate = (opts.asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const branchId = safeBranchForFilter(opts.branchId);
  const branchForTb = branchId ?? undefined;

  const emptyResult = (error: string | null): BalanceBasisGuideReportResult => ({
    rows: [],
    totals: mergeControlTotals(sumBalanceBasisGuideTotals([]), {
      receivablesControl: null,
      payablesControl: null,
      workerPayablesControl: null,
    }),
    controlAccounts: {
      ar1100: { code: '1100', name: 'Accounts Receivable', balanceDrMinusCr: null },
      ap2000: { code: '2000', name: 'Accounts Payable', balanceCrMinusDr: null },
      wp2010: { code: '2010', name: 'Worker Payable', balanceCrMinusDr: null },
    },
    asOfDate,
    error,
  });

  const [contactsRes, partyMap, docRpc, snapRpc, glSnap, accountsRes] = await Promise.all([
    supabase.from('contacts').select('id, name, code, type').eq('company_id', companyId).order('name'),
    contactService.getContactPartyGlBalancesMap(companyId, branchId, asOfDate),
    supabase.rpc('get_contact_balances_summary', {
      p_company_id: companyId,
      p_branch_id: branchId,
    }),
    supabase.rpc('ar_ap_integrity_lab_snapshot', {
      p_company_id: companyId,
      p_branch_id: branchId,
      p_as_of_date: asOfDate,
    }),
    accountingReportsService.getArApGlSnapshot(companyId, asOfDate, branchForTb),
    supabase
      .from('accounts')
      .select('code, linked_contact_id')
      .eq('company_id', companyId)
      .not('linked_contact_id', 'is', null),
  ]);

  if (contactsRes.error) {
    return emptyResult(contactsRes.error.message);
  }

  const docMap = new Map<string, { receivables: number; payables: number }>();
  if (!docRpc.error) {
    for (const row of docRpc.data || []) {
      const id = String((row as { contact_id: string }).contact_id);
      docMap.set(id, {
        receivables: Number((row as { receivables?: number }).receivables) || 0,
        payables: Number((row as { payables?: number }).payables) || 0,
      });
    }
  }

  const subledgerByContact = new Map<string, string>();
  for (const acc of accountsRes.data || []) {
    const cid = String((acc as { linked_contact_id?: string }).linked_contact_id || '');
    const code = String((acc as { code?: string }).code || '').trim();
    if (cid && code && !subledgerByContact.has(cid)) {
      subledgerByContact.set(cid, code);
    }
  }

  const rows: BalanceBasisGuideRow[] = (contactsRes.data || []).map((c) => {
    const id = String((c as { id: string }).id);
    const party = partyMap?.get(id);
    const doc = docMap.get(id);
    return buildBalanceBasisGuideRow({
      contactId: id,
      contactName: String((c as { name?: string }).name || id),
      contactCode: (c as { code?: string | null }).code ?? null,
      contactType: String((c as { type?: string }).type || ''),
      subledgerAccountHint: subledgerByContact.get(id) ?? null,
      glArSigned: party?.glArReceivable ?? 0,
      glApSigned: party?.glApPayable ?? 0,
      glWorkerSigned: party?.glWorkerPayable ?? 0,
      documentDueReceivable: doc?.receivables ?? 0,
      documentDuePayable: doc?.payables ?? 0,
    });
  });

  const snap = pickSnapshotRow(snapRpc.data);
  const receivablesControl =
    snap?.gl_ar_net_dr_minus_cr ??
    (glSnap.ar ? glSnap.ar.balance : null);
  const payablesControl =
    snap?.gl_ap_net_credit ?? glSnap.apNetCredit ?? null;
  const workerPayablesControl = glSnap.wpNetCredit ?? null;

  const rowSums = sumBalanceBasisGuideTotals(rows);
  const totals = mergeControlTotals(rowSums, {
    receivablesControl,
    payablesControl,
    workerPayablesControl,
  });

  return {
    rows,
    totals,
    controlAccounts: {
      ar1100: {
        code: glSnap.ar?.account_code?.trim() || '1100',
        name: glSnap.ar?.account_name || 'Accounts Receivable',
        balanceDrMinusCr: glSnap.ar?.balance ?? receivablesControl,
      },
      ap2000: {
        code: glSnap.ap?.account_code?.trim() || '2000',
        name: glSnap.ap?.account_name || 'Accounts Payable',
        balanceCrMinusDr: payablesControl,
      },
      wp2010: {
        code: glSnap.wp?.account_code?.trim() || '2010',
        name: glSnap.wp?.account_name || 'Worker Payable',
        balanceCrMinusDr: workerPayablesControl,
      },
    },
    asOfDate,
    error: partyMap ? null : 'get_contact_party_gl_balances unavailable — party GL columns may be empty',
  };
}

export function balanceBasisGuideToCsv(rows: BalanceBasisGuideRow[]): string {
  const header = [
    'Contact',
    'Code',
    'Type',
    'Sub-ledger Account',
    'AR Signed GL',
    'AP Signed GL',
    'Worker Signed GL',
    'Operational Receivable',
    'Operational Payable',
    'Hidden Credit AR',
    'Hidden Credit AP',
    'Document Due Receivable',
    'Document Due Payable',
  ];
  const lines = rows.map((r) =>
    [
      `"${r.contactName.replace(/"/g, '""')}"`,
      r.contactCode || '',
      r.contactType,
      r.subledgerAccountHint || '',
      r.glArSigned.toFixed(2),
      r.glApSigned.toFixed(2),
      r.glWorkerSigned.toFixed(2),
      r.operationalReceivable.toFixed(2),
      r.operationalPayable.toFixed(2),
      r.hiddenCreditAr.toFixed(2),
      r.hiddenCreditAp.toFixed(2),
      r.documentDueReceivable.toFixed(2),
      r.documentDuePayable.toFixed(2),
    ].join(',')
  );
  return [header.join(','), ...lines].join('\n');
}
