/**
 * Party AP/AR GL ledgers — same RPCs as web `accountingService.getSupplierApGlJournalLedger` /
 * `getCustomerArGlJournalLedger` (`get_supplier_ap_gl_ledger_for_contact`,
 * `get_customer_ar_gl_ledger_for_contact`).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { safeRpcBranchId } from './contactBalancesRpc';
import type { LedgerLine } from './reports';

type RpcPayload = { period_opening_balance?: number; rows?: Record<string, unknown>[] };

function mapRpcRowToLedgerLine(r: Record<string, unknown>, index: number): LedgerLine {
  const jelId = r.journal_entry_line_id ?? r.jel_id;
  const jeId = r.journal_entry_id ?? r.je_id;
  const id =
    jelId != null && String(jelId).trim() !== ''
      ? String(jelId)
      : `rpc-${String(jeId ?? 'line')}-${index}`;
  const entryNo =
    r.entry_no != null && String(r.entry_no).trim() !== '' ? String(r.entry_no) : '';
  const reference =
    entryNo !== ''
      ? entryNo
      : (String(jeId ?? '').length >= 8 ? String(jeId).slice(0, 8) : '—');
  return {
    id,
    journalEntryId: String(jeId ?? ''),
    sourceReferenceId: null,
    date: String(r.entry_date ?? '').slice(0, 10),
    createdAt: r.created_at != null ? String(r.created_at) : '',
    entryNo,
    description: String(r.description ?? '—'),
    reference,
    referenceType: String(r.reference_type ?? r.ref_type ?? ''),
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    runningBalance: Number(r.running_balance ?? 0),
  };
}

function parseRpcPayload(data: unknown): RpcPayload | null {
  if (!data || typeof data !== 'object') return null;
  return data as RpcPayload;
}

/** Supplier AP on control 2000 — matches web Account Statements → Supplier (GL). */
export async function getSupplierApGlLedgerLinesForContact(
  companyId: string,
  supplierId: string,
  branchId: string | null | undefined,
  from?: string,
  to?: string,
): Promise<{ openingBalance: number; lines: LedgerLine[]; error: string | null }> {
  if (!isSupabaseConfigured) return { openingBalance: 0, lines: [], error: 'App not configured.' };

  const startStr = from ? from.slice(0, 10) : null;
  const endStr = to ? to.slice(0, 10) : null;
  const p_branch_id = safeRpcBranchId(branchId);

  const { data: rpcRaw, error: rpcError } = await supabase.rpc('get_supplier_ap_gl_ledger_for_contact', {
    p_company_id: companyId,
    p_supplier_id: supplierId,
    p_branch_id: p_branch_id,
    p_start_date: startStr,
    p_end_date: endStr,
  });

  if (rpcError) {
    console.warn('[partyGlLedger] get_supplier_ap_gl_ledger_for_contact:', rpcError.message);
    return { openingBalance: 0, lines: [], error: rpcError.message };
  }

  const payload = parseRpcPayload(rpcRaw);
  if (!payload) {
    return { openingBalance: 0, lines: [], error: 'Invalid RPC response' };
  }

  const opening = Number(payload.period_opening_balance ?? 0);
  const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
  const lines = rawRows.map((row, i) => mapRpcRowToLedgerLine(row as Record<string, unknown>, i));

  return { openingBalance: opening, lines, error: null };
}

/** Customer AR on control 1100 — matches web Account Statements → Customer (GL). */
export async function getCustomerArGlLedgerLinesForContact(
  companyId: string,
  customerId: string,
  branchId: string | null | undefined,
  from?: string,
  to?: string,
): Promise<{ openingBalance: number; lines: LedgerLine[]; error: string | null }> {
  if (!isSupabaseConfigured) return { openingBalance: 0, lines: [], error: 'App not configured.' };

  const startStr = from ? from.slice(0, 10) : null;
  const endStr = to ? to.slice(0, 10) : null;
  const p_branch_id = safeRpcBranchId(branchId);

  const { data: rpcRaw, error: rpcError } = await supabase.rpc('get_customer_ar_gl_ledger_for_contact', {
    p_company_id: companyId,
    p_customer_id: customerId,
    p_branch_id: p_branch_id,
    p_start_date: startStr,
    p_end_date: endStr,
  });

  if (rpcError) {
    console.warn('[partyGlLedger] get_customer_ar_gl_ledger_for_contact:', rpcError.message);
    return { openingBalance: 0, lines: [], error: rpcError.message };
  }

  const payload = parseRpcPayload(rpcRaw);
  if (!payload) {
    return { openingBalance: 0, lines: [], error: 'Invalid RPC response' };
  }

  const opening = Number(payload.period_opening_balance ?? 0);
  const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
  const lines = rawRows.map((row, i) => mapRpcRowToLedgerLine(row as Record<string, unknown>, i));

  return { openingBalance: opening, lines, error: null };
}
