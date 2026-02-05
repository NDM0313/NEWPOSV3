/**
 * Ledger service for Supplier and User ledgers (ledger_master + ledger_entries).
 * Customer ledger = customerLedgerApi (sales/payments). Worker = worker_ledger_entries (studio).
 */

import { supabase } from '@/lib/supabase';

export type LedgerType = 'supplier' | 'user';

export interface LedgerMaster {
  id: string;
  company_id: string;
  ledger_type: LedgerType;
  entity_id: string;
  entity_name: string | null;
  opening_balance: number;
  created_at?: string;
  updated_at?: string;
}

export interface LedgerEntryRow {
  id: string;
  company_id: string;
  ledger_id: string;
  entry_date: string;
  debit: number;
  credit: number;
  balance_after: number | null;
  source: string;
  reference_no: string | null;
  reference_id: string | null;
  remarks: string | null;
  created_at?: string;
}

export async function getOrCreateLedger(
  companyId: string,
  type: LedgerType,
  entityId: string,
  entityName?: string
): Promise<LedgerMaster | null> {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('ledger_master')
      .select('*')
      .eq('company_id', companyId)
      .eq('ledger_type', type)
      .eq('entity_id', entityId)
      .maybeSingle();

    if (fetchError) {
      console.warn('[ledgerService] getOrCreateLedger fetch error (tables may not exist):', fetchError.message);
      return null;
    }
    if (existing) return existing as LedgerMaster;

    const { data: inserted, error } = await supabase
      .from('ledger_master')
      .insert({
        company_id: companyId,
        ledger_type: type,
        entity_id: entityId,
        entity_name: entityName ?? null,
        opening_balance: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.warn('[ledgerService] getOrCreateLedger insert error:', error.message);
      return null;
    }
    return inserted as LedgerMaster;
  } catch (e) {
    console.warn('[ledgerService] getOrCreateLedger exception:', e);
    return null;
  }
}

export interface AddLedgerEntryParams {
  companyId: string;
  ledgerId: string;
  entryDate: string;
  debit: number;
  credit: number;
  source: string;
  referenceNo?: string;
  referenceId?: string;
  remarks?: string;
}

export async function addLedgerEntry(params: AddLedgerEntryParams): Promise<LedgerEntryRow | null> {
  const { companyId, ledgerId, entryDate, debit, credit, source, referenceNo, referenceId, remarks } = params;

  try {
    const { data: prev, error: prevError } = await supabase
      .from('ledger_entries')
      .select('balance_after')
      .eq('ledger_id', ledgerId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevError) {
      console.warn('[ledgerService] addLedgerEntry fetch prev balance error:', prevError.message);
      return null;
    }

    const prevBalance = (prev as { balance_after?: number } | null)?.balance_after ?? 0;
    const balanceAfter = prevBalance + (debit - credit);

    const { data: inserted, error } = await supabase
      .from('ledger_entries')
      .insert({
      company_id: companyId,
      ledger_id: ledgerId,
      entry_date: entryDate,
      debit,
      credit,
      balance_after: balanceAfter,
      source,
      reference_no: referenceNo ?? null,
      reference_id: referenceId ?? null,
      remarks: remarks ?? null,
    })
    .select()
    .single();

    if (error) {
      console.warn('[ledgerService] addLedgerEntry error:', error.message);
      return null;
    }
    return inserted as LedgerEntryRow;
  } catch (e) {
    console.warn('[ledgerService] addLedgerEntry exception:', e);
    return null;
  }
}

export async function getLedgerEntries(
  ledgerId: string,
  fromDate?: string,
  toDate?: string
): Promise<LedgerEntryRow[]> {
  let q = supabase
    .from('ledger_entries')
    .select('*')
    .eq('ledger_id', ledgerId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (fromDate) q = q.gte('entry_date', fromDate);
  if (toDate) q = q.lte('entry_date', toDate);

  const { data, error } = await q;
  if (error) return [];
  return (data || []) as LedgerEntryRow[];
}

export async function getLedgerById(ledgerId: string): Promise<LedgerMaster | null> {
  const { data, error } = await supabase
    .from('ledger_master')
    .select('*')
    .eq('id', ledgerId)
    .maybeSingle();
  if (error || !data) return null;
  return data as LedgerMaster;
}

/** Set opening_balance on ledger_master (e.g. when adding a supplier with opening balance). */
export async function updateLedgerOpeningBalance(ledgerId: string, openingBalance: number): Promise<boolean> {
  const { error } = await supabase
    .from('ledger_master')
    .update({
      opening_balance: openingBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ledgerId);
  if (error) {
    console.warn('[ledgerService] updateLedgerOpeningBalance error:', error.message);
    return false;
  }
  return true;
}

export async function getSupplierLedgersWithBalance(companyId: string): Promise<Array<{ id: string; name: string; balance: number }>> {
  const { data: ledgers } = await supabase
    .from('ledger_master')
    .select('id, entity_id, entity_name')
    .eq('company_id', companyId)
    .eq('ledger_type', 'supplier');

  if (!ledgers?.length) return [];

  const out: Array<{ id: string; name: string; balance: number }> = [];
  for (const l of ledgers as { id: string; entity_id: string; entity_name: string | null }[]) {
    const { data: last } = await supabase
      .from('ledger_entries')
      .select('balance_after')
      .eq('ledger_id', l.id)
      .order('entry_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    const balance = (last as { balance_after?: number } | null)?.balance_after ?? 0;
    out.push({ id: l.entity_id, name: l.entity_name || 'Supplier', balance });
  }
  return out;
}

export async function getUserLedgersWithBalance(companyId: string): Promise<Array<{ id: string; name: string; balance: number }>> {
  const { data: ledgers } = await supabase
    .from('ledger_master')
    .select('id, entity_id, entity_name')
    .eq('company_id', companyId)
    .eq('ledger_type', 'user');

  if (!ledgers?.length) return [];

  const out: Array<{ id: string; name: string; balance: number }> = [];
  for (const l of ledgers as { id: string; entity_id: string; entity_name: string | null }[]) {
    const { data: last } = await supabase
      .from('ledger_entries')
      .select('balance_after')
      .eq('ledger_id', l.id)
      .order('entry_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    const balance = (last as { balance_after?: number } | null)?.balance_after ?? 0;
    out.push({ id: l.entity_id, name: l.entity_name || 'User', balance });
  }
  return out;
}
