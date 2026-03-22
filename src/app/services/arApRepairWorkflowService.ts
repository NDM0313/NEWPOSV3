/**
 * Reconciliation Center — explicit repair actions (posting, void, rebuild, party mapping).
 * Never mutates journals silently; callers must show confirmation UI.
 */

import { supabase } from '@/lib/supabase';
import {
  canPostAccountingForPurchaseStatus,
  canPostAccountingForSaleStatus,
} from '@/app/lib/postingStatusGate';
import {
  postPurchaseDocumentAccounting,
  postSaleDocumentAccounting,
  rebuildPurchaseDocumentAccounting,
  rebuildSaleDocumentAccounting,
} from '@/app/services/documentPostingEngine';
import type { UnmappedJournalRow, UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface UnpostedValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  sale?: Record<string, unknown>;
  purchase?: Record<string, unknown>;
}

export interface JournalLineDetail {
  id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
  account_code?: string | null;
  account_name?: string | null;
}

export interface JournalDetailForLab {
  id: string;
  company_id: string;
  branch_id: string | null;
  entry_no: string | null;
  entry_date: string | null;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string | null;
  is_void: boolean;
  lines: JournalLineDetail[];
}

function branchMatches(expected: string | null | undefined, actual: string | null | undefined, strict: boolean): boolean {
  if (!strict || !expected || expected === 'all') return true;
  return (actual || '') === expected;
}

/**
 * Validate unposted sale/purchase before calling document posting engine.
 */
export async function validateUnpostedDocumentForPosting(params: {
  row: UnpostedDocumentRow;
  contextCompanyId: string;
  contextBranchId?: string | null;
  strictBranch?: boolean;
}): Promise<UnpostedValidationResult> {
  const { row, contextCompanyId, contextBranchId, strictBranch } = params;
  const issues: ValidationIssue[] = [];

  if (row.company_id !== contextCompanyId) {
    issues.push({ code: 'company', message: 'Document company does not match current company.' });
  }
  if (!branchMatches(contextBranchId, row.branch_id, !!strictBranch)) {
    issues.push({
      code: 'branch',
      message: 'Document branch differs from current filter (posting still allowed if you disable strict branch).',
    });
  }

  if (row.source_type === 'sale') {
    const { data: sale, error } = await supabase
      .from('sales')
      .select(
        'id, company_id, branch_id, status, total, paid_amount, due_amount, invoice_no, customer_id, customer_name'
      )
      .eq('id', row.source_id)
      .maybeSingle();
    if (error || !sale) {
      issues.push({ code: 'missing', message: 'Sale not found.' });
      return { ok: false, issues };
    }
    if ((sale as { company_id: string }).company_id !== contextCompanyId) {
      issues.push({ code: 'company', message: 'Sale company mismatch.' });
    }
    const st = (sale as { status?: string }).status;
    if (String(st || '').toLowerCase() === 'cancelled') {
      issues.push({ code: 'cancelled', message: 'Sale is cancelled — do not post.' });
    }
    if (!canPostAccountingForSaleStatus(st)) {
      issues.push({
        code: 'status',
        message: `Sale status "${st}" is not eligible for GL posting (requires final/posted sale).`,
      });
    }
    const total = Number((sale as { total?: number }).total) || 0;
    if (total <= 0) issues.push({ code: 'total', message: 'Sale total is zero.' });
    return { ok: issues.length === 0, issues, sale: sale as Record<string, unknown> };
  }

  if (row.source_type === 'purchase') {
    const { data: purchase, error } = await supabase
      .from('purchases')
      .select(
        'id, company_id, branch_id, status, total, paid_amount, due_amount, po_no, supplier_id, supplier_name'
      )
      .eq('id', row.source_id)
      .maybeSingle();
    if (error || !purchase) {
      issues.push({ code: 'missing', message: 'Purchase not found.' });
      return { ok: false, issues };
    }
    if ((purchase as { company_id: string }).company_id !== contextCompanyId) {
      issues.push({ code: 'company', message: 'Purchase company mismatch.' });
    }
    const st = (purchase as { status?: string }).status;
    if (!canPostAccountingForPurchaseStatus(st)) {
      issues.push({
        code: 'status',
        message: `Purchase status "${st}" is not eligible for GL posting (requires final/received/completed).`,
      });
    }
    const total = Number((purchase as { total?: number }).total) || 0;
    if (total <= 0) issues.push({ code: 'total', message: 'Purchase total is zero.' });
    return { ok: issues.length === 0, issues, purchase: purchase as Record<string, unknown> };
  }

  issues.push({ code: 'type', message: `Unknown source_type: ${row.source_type}` });
  return { ok: false, issues };
}

/**
 * Validate then post; branch mismatch is blocking only when strictBranch is true.
 */
export async function validateAndPostUnpostedDocument(params: {
  row: UnpostedDocumentRow;
  contextCompanyId: string;
  contextBranchId?: string | null;
  strictBranch?: boolean;
}): Promise<{
  ok: boolean;
  journalEntryId?: string | null;
  error?: string;
  validation: UnpostedValidationResult;
}> {
  const validation = await validateUnpostedDocumentForPosting({
    row: params.row,
    contextCompanyId: params.contextCompanyId,
    contextBranchId: params.contextBranchId,
    strictBranch: params.strictBranch ?? false,
  });
  const branchOnly =
    validation.issues.length === 1 && validation.issues[0]?.code === 'branch';
  const hardIssues = validation.issues.filter((i) => i.code !== 'branch');
  if (hardIssues.length > 0) {
    return {
      ok: false,
      validation,
      error: hardIssues.map((i) => i.message).join(' '),
    };
  }
  if (params.strictBranch && branchOnly) {
    return {
      ok: false,
      validation,
      error: validation.issues[0]?.message ?? 'Branch mismatch',
    };
  }
  if (!validation.ok && !branchOnly) {
    return {
      ok: false,
      validation,
      error: validation.issues.map((i) => i.message).join(' '),
    };
  }
  const post = await createMissingPostingForUnpostedRow(params.row);
  return { ...post, validation };
}

export async function createMissingPostingForUnpostedRow(row: UnpostedDocumentRow): Promise<{
  ok: boolean;
  journalEntryId?: string | null;
  error?: string;
}> {
  try {
    if (row.source_type === 'sale') {
      const jeId = await postSaleDocumentAccounting(row.source_id);
      return jeId ? { ok: true, journalEntryId: jeId } : { ok: false, error: 'Posting returned no journal (check status/total).' };
    }
    if (row.source_type === 'purchase') {
      const jeId = await postPurchaseDocumentAccounting(row.source_id);
      return jeId ? { ok: true, journalEntryId: jeId } : { ok: false, error: 'Posting returned no journal (check status/total).' };
    }
    return { ok: false, error: 'Unsupported document type.' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function fetchJournalDetailForLab(journalEntryId: string): Promise<JournalDetailForLab | null> {
  const { data: je, error } = await supabase
    .from('journal_entries')
    .select(
      'id, company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, created_by, created_at, is_void'
    )
    .eq('id', journalEntryId)
    .maybeSingle();
  if (error || !je) return null;

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('id, account_id, debit, credit, description')
    .eq('journal_entry_id', journalEntryId);

  const rawLines = (lines || []) as JournalLineDetail[];
  const accountIds = [...new Set(rawLines.map((l) => l.account_id).filter(Boolean))];
  let codeById: Record<string, { code?: string; name?: string }> = {};
  if (accountIds.length > 0) {
    const { data: accs } = await supabase.from('accounts').select('id, code, name').in('id', accountIds);
    (accs || []).forEach((a: { id: string; code?: string; name?: string }) => {
      codeById[a.id] = { code: a.code, name: a.name };
    });
  }

  const enriched: JournalLineDetail[] = rawLines.map((l) => ({
    ...l,
    account_code: codeById[l.account_id]?.code ?? null,
    account_name: codeById[l.account_id]?.name ?? null,
  }));

  return { ...(je as Omit<JournalDetailForLab, 'lines'>), lines: enriched };
}

export type ReverseRepostStrategy = 'rebuild_sale' | 'rebuild_purchase' | 'void_only';

export async function executeReverseRepostWizard(params: {
  journalEntryId: string;
  companyId: string;
  strategy: ReverseRepostStrategy;
  voidReason: string;
}): Promise<{ ok: boolean; error?: string; newJournalId?: string | null }> {
  const detail = await fetchJournalDetailForLab(params.journalEntryId);
  if (!detail || detail.company_id !== params.companyId) return { ok: false, error: 'Journal not found.' };
  if (detail.is_void) return { ok: false, error: 'Journal is already void.' };

  const refType = (detail.reference_type || '').toLowerCase().trim();
  const refId = detail.reference_id;

  if (params.strategy === 'rebuild_sale') {
    if (refType !== 'sale' || !refId) return { ok: false, error: 'Journal reference is not a sale document.' };
    const jeId = await rebuildSaleDocumentAccounting(refId);
    return jeId ? { ok: true, newJournalId: jeId } : { ok: false, error: 'Rebuild sale did not return a journal id.' };
  }

  if (params.strategy === 'rebuild_purchase') {
    if (refType !== 'purchase' || !refId) return { ok: false, error: 'Journal reference is not a purchase document.' };
    const jeId = await rebuildPurchaseDocumentAccounting(refId);
    return jeId ? { ok: true, newJournalId: jeId } : { ok: false, error: 'Rebuild purchase did not return a journal id.' };
  }

  const reason = (params.voidReason || 'ar_ap_reconciliation_void').slice(0, 500);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('journal_entries')
    .update({
      is_void: true,
      void_reason: reason,
      voided_at: now,
    })
    .eq('id', params.journalEntryId)
    .eq('company_id', params.companyId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, newJournalId: null };
}

export function inferReverseRepostStrategy(detail: JournalDetailForLab | null): ReverseRepostStrategy | null {
  if (!detail) return null;
  const t = (detail.reference_type || '').toLowerCase().trim();
  if (t === 'sale' && detail.reference_id) return 'rebuild_sale';
  if (t === 'purchase' && detail.reference_id) return 'rebuild_purchase';
  return 'void_only';
}

export interface PartyCandidate {
  contact_id: string;
  name: string;
  type?: string | null;
  suggested_from: string;
}

/**
 * Suggest contacts for relink: document party first, then same-type search (limited).
 */
export async function suggestPartyContactsForUnmappedLine(
  row: UnmappedJournalRow,
  companyId: string
): Promise<PartyCandidate[]> {
  const out: PartyCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: PartyCandidate) => {
    if (seen.has(c.contact_id)) return;
    seen.add(c.contact_id);
    out.push(c);
  };

  const refType = (row.reference_type || '').toLowerCase().trim();
  const refId = row.reference_id;

  if (refType === 'sale' && refId) {
    const { data: sale } = await supabase
      .from('sales')
      .select('customer_id, customer_name')
      .eq('id', refId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (sale?.customer_id) {
      push({
        contact_id: sale.customer_id as string,
        name: (sale.customer_name as string) || 'Customer',
        suggested_from: 'sale.customer_id',
      });
    }
  }

  if (refType === 'purchase' && refId) {
    const { data: pur } = await supabase
      .from('purchases')
      .select('supplier_id, supplier_name')
      .eq('id', refId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (pur?.supplier_id) {
      push({
        contact_id: pur.supplier_id as string,
        name: (pur.supplier_name as string) || 'Supplier',
        suggested_from: 'purchase.supplier_id',
      });
    }
  }

  const wantWorker = row.control_bucket === 'AP' && row.ap_sub_bucket === 'worker';
  const wantSupplier = row.control_bucket === 'AP' && row.ap_sub_bucket === 'supplier';
  const wantCustomer = row.control_bucket === 'AR';

  if (wantSupplier) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, type')
      .eq('company_id', companyId)
      .in('type', ['supplier', 'both'])
      .limit(40);
    (contacts || []).forEach((c: { id: string; name: string; type?: string }) => {
      push({
        contact_id: c.id,
        name: c.name,
        type: c.type ?? null,
        suggested_from: 'contacts.supplier_or_both',
      });
    });
  } else if (wantCustomer) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, type')
      .eq('company_id', companyId)
      .in('type', ['customer', 'both'])
      .limit(40);
    (contacts || []).forEach((c: { id: string; name: string; type?: string }) => {
      push({
        contact_id: c.id,
        name: c.name,
        type: c.type ?? null,
        suggested_from: 'contacts.customer_or_both',
      });
    });
  } else if (wantWorker) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, type')
      .eq('company_id', companyId)
      .eq('type', 'worker')
      .limit(40);
    (contacts || []).forEach((c: { id: string; name: string; type?: string }) => {
      push({
        contact_id: c.id,
        name: c.name,
        type: c.type ?? null,
        suggested_from: 'contacts.worker',
      });
    });
  }

  return out;
}

export async function saveJournalPartyContactMapping(params: {
  companyId: string;
  journalEntryId: string;
  journalLineId: string | null;
  partyContactId: string;
  suggestedFrom: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id ?? null;

  const { error } = await supabase.from('journal_party_contact_mapping').insert({
    company_id: params.companyId,
    journal_entry_id: params.journalEntryId,
    journal_line_id: params.journalLineId,
    party_contact_id: params.partyContactId,
    mapping_source: 'reconciliation_lab',
    suggested_from: params.suggestedFrom.slice(0, 200),
    notes: params.notes?.slice(0, 500) ?? null,
    created_by: uid,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'A mapping already exists for this line or entry. Remove it in SQL or extend UI to replace.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
