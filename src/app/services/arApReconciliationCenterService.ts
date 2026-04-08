/**
 * AR/AP Reconciliation Center — operational vs GL vs exception queues.
 * Journal remains source of truth; no silent force-matching.
 */

import { supabase } from '@/lib/supabase';
import { contactService } from '@/app/services/contactService';
import { accountingReportsService } from '@/app/services/accountingReportsService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function safeBranchForFilter(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  return UUID_RE.test(branchId.trim()) ? branchId.trim() : null;
}

export type IntegrityLabStatus =
  | 'clean'
  | 'variance'
  | 'missing_posting'
  | 'unmapped'
  | 'manual_adjustment';

export type ArApFixStatus =
  | 'new'
  | 'reviewed'
  | 'ready_to_post'
  | 'ready_to_relink'
  | 'ready_to_reverse_repost'
  | 'resolved';

export interface IntegrityLabSnapshotRow {
  gl_ar_net_dr_minus_cr: number | null;
  gl_ap_net_credit: number | null;
  unposted_document_count: number;
  unmapped_ar_je_count: number;
  /** Total AP unmapped (supplier + worker); kept for backward compatibility with RPC. */
  unmapped_ap_je_count: number;
  unmapped_ap_supplier_je_count: number;
  unmapped_ap_worker_je_count: number;
  manual_adjustment_je_count: number;
  suspense_net_balance: number;
}

export interface IntegrityLabSummary extends IntegrityLabSnapshotRow {
  asOfDate: string;
  branchId: string | null;
  /** Full Contacts RPC totals (includes openings, workers where applicable). */
  operational_receivables_full: number;
  operational_payables_full: number;
  variance_receivables: number | null;
  variance_payables: number | null;
  status: IntegrityLabStatus;
  statusLabels: string[];
}

export interface UnpostedDocumentRow {
  source_type: string;
  source_id: string;
  document_no: string | null;
  contact_id: string | null;
  contact_name: string | null;
  amount: number;
  branch_id: string | null;
  document_date: string | null;
  company_id: string;
  reason: string | null;
}

export interface UnmappedJournalRow {
  journal_entry_id: string;
  entry_no: string | null;
  entry_date: string | null;
  company_id: string;
  branch_id: string | null;
  journal_line_id: string;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  debit: number;
  credit: number;
  reference_type: string | null;
  reference_id: string | null;
  control_bucket: string | null;
  /** supplier | worker for AP lines; null for AR. */
  ap_sub_bucket?: string | null;
  contact_mapping_status: string | null;
  reason: string | null;
}

export interface ManualAdjustmentRow {
  journal_entry_id: string;
  company_id: string;
  branch_id: string | null;
  entry_no: string | null;
  entry_date: string | null;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string | null;
  suspense_net_dr_minus_cr: number;
  detection_kind: string | null;
  status: string | null;
}

function pickSnapshotRow(data: unknown): IntegrityLabSnapshotRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const apTotalLegacy = Number(r.unmapped_ap_je_count) || 0;
  const hasSplit =
    r.unmapped_ap_supplier_je_count != null &&
    r.unmapped_ap_supplier_je_count !== undefined &&
    r.unmapped_ap_worker_je_count != null &&
    r.unmapped_ap_worker_je_count !== undefined;
  const apSup = hasSplit ? Number(r.unmapped_ap_supplier_je_count) || 0 : apTotalLegacy;
  const apWork = hasSplit ? Number(r.unmapped_ap_worker_je_count) || 0 : 0;
  const apTotal = hasSplit ? apSup + apWork : apTotalLegacy;

  return {
    gl_ar_net_dr_minus_cr: r.gl_ar_net_dr_minus_cr != null ? Number(r.gl_ar_net_dr_minus_cr) : null,
    gl_ap_net_credit: r.gl_ap_net_credit != null ? Number(r.gl_ap_net_credit) : null,
    unposted_document_count: Number(r.unposted_document_count) || 0,
    unmapped_ar_je_count: Number(r.unmapped_ar_je_count) || 0,
    unmapped_ap_je_count: apTotal,
    unmapped_ap_supplier_je_count: apSup,
    unmapped_ap_worker_je_count: apWork,
    manual_adjustment_je_count: Number(r.manual_adjustment_je_count) || 0,
    suspense_net_balance: Number(r.suspense_net_balance) || 0,
  };
}

export function deriveIntegrityLabStatus(input: {
  varianceReceivables: number | null;
  variancePayables: number | null;
  unpostedCount: number;
  unmappedArJe: number;
  unmappedApJe: number;
  unmappedApWorkerJe?: number;
  manualJeCount: number;
  suspenseAbs: number;
}): { status: IntegrityLabStatus; labels: string[] } {
  const labels: string[] = [];
  const vRecv = input.varianceReceivables != null ? Math.abs(input.varianceReceivables) : 0;
  const vPay = input.variancePayables != null ? Math.abs(input.variancePayables) : 0;
  const hasVariance = vRecv >= 1 || vPay >= 1;
  if (hasVariance) labels.push('Variance');
  if (input.unpostedCount > 0) labels.push('Missing posting');
  if (input.unmappedArJe + input.unmappedApJe > 0) {
    labels.push('Unmapped');
    if ((input.unmappedApWorkerJe ?? 0) > 0) labels.push('Worker payable');
  }
  if (input.manualJeCount > 0 || input.suspenseAbs >= 0.01) labels.push('Manual adjustment');

  let status: IntegrityLabStatus = 'clean';
  if (labels.length === 0) return { status: 'clean', labels: ['Clean'] };
  if (input.unpostedCount > 0) status = 'missing_posting';
  else if (input.unmappedArJe + input.unmappedApJe > 0) status = 'unmapped';
  else if (input.manualJeCount > 0 || input.suspenseAbs >= 0.01) status = 'manual_adjustment';
  else if (hasVariance) status = 'variance';
  return { status, labels };
}

/**
 * Full summary: RPC snapshot (as-of GL, counts, suspense) + Contacts operational totals + variances.
 */
export async function fetchIntegrityLabSummary(
  companyId: string,
  branchId: string | null | undefined,
  asOfDate?: string
): Promise<IntegrityLabSummary | null> {
  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const b = safeBranchForFilter(branchId);

  const [rpc, opRes, glSnap] = await Promise.all([
    supabase.rpc('ar_ap_integrity_lab_snapshot', {
      p_company_id: companyId,
      p_branch_id: b,
      p_as_of_date: end,
    }),
    contactService.getContactBalancesSummary(companyId, branchId ?? null),
    accountingReportsService.getArApGlSnapshot(companyId, end, b ?? undefined),
  ]);

  const snap = pickSnapshotRow(rpc.data);
  if (!snap && rpc.error) {
    console.warn('[arApIntegrityLab] ar_ap_integrity_lab_snapshot:', rpc.error.message);
  }
  const s = snap ?? {
    gl_ar_net_dr_minus_cr: glSnap.ar?.balance ?? null,
    gl_ap_net_credit: glSnap.apNetCredit,
    unposted_document_count: 0,
    unmapped_ar_je_count: 0,
    unmapped_ap_je_count: 0,
    unmapped_ap_supplier_je_count: 0,
    unmapped_ap_worker_je_count: 0,
    manual_adjustment_je_count: 0,
    suspense_net_balance: 0,
  };

  let operational_receivables_full = 0;
  let operational_payables_full = 0;
  if (!opRes.error) {
    opRes.map.forEach((v) => {
      operational_receivables_full += Number(v.receivables) || 0;
      operational_payables_full += Number(v.payables) || 0;
    });
  }

  const glAr = s.gl_ar_net_dr_minus_cr ?? glSnap.ar?.balance ?? null;
  const glAp = s.gl_ap_net_credit ?? glSnap.apNetCredit ?? null;
  const variance_receivables = glAr != null ? operational_receivables_full - glAr : null;
  const variance_payables = glAp != null ? operational_payables_full - glAp : null;

  const { status, labels } = deriveIntegrityLabStatus({
    varianceReceivables: variance_receivables,
    variancePayables: variance_payables,
    unpostedCount: s.unposted_document_count,
    unmappedArJe: s.unmapped_ar_je_count,
    unmappedApJe: s.unmapped_ap_je_count,
    unmappedApWorkerJe: s.unmapped_ap_worker_je_count,
    manualJeCount: s.manual_adjustment_je_count,
    suspenseAbs: Math.abs(s.suspense_net_balance),
  });

  return {
    ...s,
    asOfDate: end,
    branchId: b,
    operational_receivables_full,
    operational_payables_full,
    variance_receivables,
    variance_payables,
    status,
    statusLabels: labels,
  };
}

export async function fetchUnpostedDocuments(
  companyId: string,
  branchId: string | null | undefined,
  asOfDate?: string,
  limit = 200
): Promise<UnpostedDocumentRow[]> {
  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const b = safeBranchForFilter(branchId);
  let q = supabase
    .from('v_ar_ap_unposted_documents')
    .select('*')
    .eq('company_id', companyId)
    .lte('document_date', end)
    .order('document_date', { ascending: false })
    .limit(limit);
  if (b) q = q.eq('branch_id', b);
  const { data, error } = await q;
  if (error) {
    console.warn('[arApIntegrityLab] v_ar_ap_unposted_documents:', error.message);
    return [];
  }
  return (data || []) as UnpostedDocumentRow[];
}

export async function fetchUnmappedJournalLines(
  companyId: string,
  branchId: string | null | undefined,
  asOfDate?: string,
  limit = 200
): Promise<UnmappedJournalRow[]> {
  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const b = safeBranchForFilter(branchId);
  let q = supabase
    .from('v_ar_ap_unmapped_journals')
    .select('*')
    .eq('company_id', companyId)
    .lte('entry_date', end)
    .order('entry_date', { ascending: false })
    .limit(limit);
  if (b) q = q.eq('branch_id', b);
  const { data, error } = await q;
  if (error) {
    console.warn('[arApIntegrityLab] v_ar_ap_unmapped_journals:', error.message);
    return [];
  }
  return (data || []) as UnmappedJournalRow[];
}

export async function fetchManualAdjustments(
  companyId: string,
  branchId: string | null | undefined,
  asOfDate?: string,
  limit = 200
): Promise<ManualAdjustmentRow[]> {
  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const b = safeBranchForFilter(branchId);
  let q = supabase
    .from('v_ar_ap_manual_adjustments')
    .select('*')
    .eq('company_id', companyId)
    .lte('entry_date', end)
    .order('entry_date', { ascending: false })
    .limit(limit);
  if (b) q = q.eq('branch_id', b);
  const { data, error } = await q;
  if (error) {
    console.warn('[arApIntegrityLab] v_ar_ap_manual_adjustments:', error.message);
    return [];
  }
  return (data || []) as ManualAdjustmentRow[];
}

export async function fetchReconciliationItemStates(companyId: string): Promise<Map<string, ArApFixStatus>> {
  const { data, error } = await supabase
    .from('ar_ap_reconciliation_review_items')
    .select('item_key, fix_status')
    .eq('company_id', companyId);
  const m = new Map<string, ArApFixStatus>();
  if (error) return m;
  (data || []).forEach((r: { item_key: string; fix_status: string }) => {
    m.set(r.item_key, (r.fix_status as ArApFixStatus) || 'new');
  });
  return m;
}

/** @deprecated Prefer fetchReconciliationItemStates */
export async function fetchReviewedItemKeys(companyId: string): Promise<Set<string>> {
  const m = await fetchReconciliationItemStates(companyId);
  const s = new Set<string>();
  m.forEach((st, key) => {
    if (st === 'reviewed' || st === 'resolved') s.add(key);
  });
  return s;
}

export async function upsertArApItemFixStatus(
  companyId: string,
  itemKind: string,
  itemKey: string,
  fixStatus: ArApFixStatus
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('upsert_ar_ap_reconciliation_item', {
    p_company_id: companyId,
    p_item_kind: itemKind,
    p_item_key: itemKey,
    p_fix_status: fixStatus,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markArApItemReviewed(
  companyId: string,
  itemKind: string,
  itemKey: string
): Promise<{ ok: boolean; error?: string }> {
  return upsertArApItemFixStatus(companyId, itemKind, itemKey, 'reviewed');
}

export async function ensureArApSuspenseAccount(companyId: string): Promise<{ accountId: string | null; error?: string }> {
  const { data, error } = await supabase.rpc('ensure_ar_ap_reconciliation_suspense_account', {
    p_company_id: companyId,
  });
  if (error) return { accountId: null, error: error.message };
  const id = typeof data === 'string' ? data : (data as string | null);
  return { accountId: id || null };
}

export function unpostedItemKey(row: UnpostedDocumentRow): string {
  return `${row.source_type}:${row.source_id}`;
}

export function unmappedLineItemKey(row: UnmappedJournalRow): string {
  return `jel:${row.journal_line_id}`;
}

export function manualJeItemKey(row: ManualAdjustmentRow): string {
  return `je:${row.journal_entry_id}`;
}
