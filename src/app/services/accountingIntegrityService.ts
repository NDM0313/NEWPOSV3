/**
 * PF-14.5B: Accounting Integrity Test Lab – duplicate/orphan detection and safe void.
 * No deletes; void only. Business views exclude voided entries.
 */

import {
  buildStaleReversalVoidReason,
  correctionReversalReviewEligibility,
  isStaleCorrectionReversalVoidEligible,
  type StaleCorrectionReversalContext,
} from '@/app/lib/staleCorrectionReversalPolicy';
import { supabase } from '@/lib/supabase';

export interface DuplicateGroup {
  reference_type: string;
  root_id: string;
  description: string;
  count: number;
  je_ids: string[];
  entry_nos: string[];
  earliest_created_at: string;
}

export interface OrphanEntry {
  id: string;
  entry_no: string | null;
  reference_id: string | null;
  reference_type: string;
  description: string | null;
  created_at: string;
}

export interface IntegritySummary {
  duplicateGroups: DuplicateGroup[];
  orphanEntries: OrphanEntry[];
  staleCorrectionReversals: StaleCorrectionReversalCandidate[];
  voidedCountByType: { reference_type: string; count: number }[];
  activeCountByType: { reference_type: string; count: number }[];
}

export interface StaleCorrectionReversalCandidate {
  id: string;
  entry_no: string | null;
  entry_date: string | null;
  description: string | null;
  amount: number;
  payment_id: string | null;
  paymentRef: string | null;
  sourceEntryNo: string | null;
  sourceJournalIsVoid: boolean;
  paymentVoidedAt: string | null;
  voidReasonSuggested: string;
}

export interface VoidedJournalAuditRow {
  id: string;
  entry_no: string | null;
  entry_date: string | null;
  reference_type: string | null;
  void_reason: string | null;
  voided_at: string | null;
  description: string | null;
}

export interface VoidedJournalAuditBrowseOptions {
  limit?: number;
  offset?: number;
}

export interface VoidedJournalAuditBrowseResult {
  rows: VoidedJournalAuditRow[];
  total: number;
  error?: string;
}

export interface ActiveCorrectionReversalReviewRow {
  id: string;
  entry_no: string | null;
  entry_date: string | null;
  description: string | null;
  amount: number;
  paymentRef: string | null;
  sourceEntryNo: string | null;
  sourceStatus: string;
  eligibilityStatus: 'eligible' | 'blocked';
  eligibilityLabel: string;
}

function mapVoidedJournalAuditRow(row: VoidedJournalAuditRow): VoidedJournalAuditRow {
  return {
    id: row.id,
    entry_no: row.entry_no ?? null,
    entry_date: row.entry_date ?? null,
    reference_type: row.reference_type ?? null,
    void_reason: row.void_reason ?? null,
    voided_at: row.voided_at ?? null,
    description: row.description ?? null,
  };
}

/**
 * Fetch duplicate candidates: same (reference_type, reference_id, description) with count > 1.
 */
export async function getDuplicateCandidates(companyId: string): Promise<DuplicateGroup[]> {
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, reference_id, description, created_at')
    .eq('company_id', companyId)
    .in('reference_type', ['sale_adjustment', 'payment_adjustment'])
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: true });

  if (error || !entries?.length) return [];

  const key = (e: any) => `${e.reference_type}\t${e.reference_id ?? ''}\t${e.description ?? ''}`;
  const byKey = new Map<string, any[]>();
  for (const e of entries as any[]) {
    const k = key(e);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(e);
  }

  const groups: DuplicateGroup[] = [];
  for (const [, arr] of byKey) {
    if (arr.length <= 1) continue;
    groups.push({
      reference_type: arr[0].reference_type,
      root_id: arr[0].reference_id ?? '',
      description: (arr[0].description ?? '').slice(0, 200),
      count: arr.length,
      je_ids: arr.map((x: any) => x.id),
      entry_nos: arr.map((x: any) => x.entry_no ?? ''),
      earliest_created_at: arr[0].created_at,
    });
  }
  return groups.sort((a, b) => b.count - a.count);
}

/**
 * Fetch orphan candidates: sale_adjustment with missing sale, payment_adjustment with missing payment.
 */
export async function getOrphanCandidates(companyId: string): Promise<OrphanEntry[]> {
  const { data: adj, error: adjErr } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, reference_id, description, created_at')
    .eq('company_id', companyId)
    .in('reference_type', ['sale_adjustment', 'payment_adjustment'])
    .not('reference_id', 'is', null)
    .or('is_void.is.null,is_void.eq.false');

  if (adjErr || !adj?.length) return [];

  const saleIds = (adj as any[]).filter((e: any) => e.reference_type === 'sale_adjustment').map((e: any) => e.reference_id);
  const paymentIds = (adj as any[]).filter((e: any) => e.reference_type === 'payment_adjustment').map((e: any) => e.reference_id);

  const existingSales = new Set<string>();
  const existingPayments = new Set<string>();
  if (saleIds.length) {
    const { data: sales } = await supabase.from('sales').select('id').in('id', saleIds);
    (sales || []).forEach((s: any) => existingSales.add(s.id));
  }
  if (paymentIds.length) {
    const { data: payments } = await supabase.from('payments').select('id').in('id', paymentIds);
    (payments || []).forEach((p: any) => existingPayments.add(p.id));
  }

  const orphans: OrphanEntry[] = [];
  for (const e of adj as any[]) {
    const refId = e.reference_id as string;
    if (e.reference_type === 'sale_adjustment' && !existingSales.has(refId)) {
      orphans.push({
        id: e.id,
        entry_no: e.entry_no,
        reference_id: e.reference_id,
        reference_type: e.reference_type,
        description: e.description,
        created_at: e.created_at,
      });
    }
    if (e.reference_type === 'payment_adjustment' && !existingPayments.has(refId)) {
      orphans.push({
        id: e.id,
        entry_no: e.entry_no,
        reference_id: e.reference_id,
        reference_type: e.reference_type,
        description: e.description,
        created_at: e.created_at,
      });
    }
  }
  return orphans;
}

type CorrectionReversalRow = {
  id: string;
  entry_no: string | null;
  entry_date: string | null;
  description: string | null;
  reference_id: string | null;
  payment_id: string | null;
  action_fingerprint: string | null;
  is_void: boolean | null;
  lines?: Array<{ debit?: number | null; credit?: number | null }>;
};

function lineAmount(lines: Array<{ debit?: number | null; credit?: number | null }> | undefined): number {
  if (!lines?.length) return 0;
  return lines.reduce((sum, l) => sum + Math.max(Number(l.debit) || 0, Number(l.credit) || 0), 0);
}

type CorrectionReversalContextBundle = {
  row: CorrectionReversalRow;
  src: { entry_no: string | null; is_void: boolean } | undefined;
  pay: { reference_number: string | null; voided_at: string | null } | undefined;
  ctx: StaleCorrectionReversalContext;
};

async function fetchActiveCorrectionReversalsWithContext(
  companyId: string
): Promise<CorrectionReversalContextBundle[]> {
  const { data: reversals, error } = await supabase
    .from('journal_entries')
    .select(
      'id, entry_no, entry_date, description, reference_id, payment_id, action_fingerprint, is_void, lines:journal_entry_lines(debit, credit)'
    )
    .eq('company_id', companyId)
    .eq('reference_type', 'correction_reversal')
    .or('is_void.is.null,is_void.eq.false')
    .order('entry_date', { ascending: false });

  if (error || !reversals?.length) return [];

  const rows = reversals as CorrectionReversalRow[];
  const sourceJeIds = [...new Set(rows.map((r) => r.reference_id).filter(Boolean))] as string[];
  const paymentIds = [...new Set(rows.map((r) => r.payment_id).filter(Boolean))] as string[];

  const sourceJeById = new Map<string, { entry_no: string | null; is_void: boolean }>();
  if (sourceJeIds.length) {
    const { data: srcJes } = await supabase
      .from('journal_entries')
      .select('id, entry_no, is_void')
      .eq('company_id', companyId)
      .in('id', sourceJeIds);
    for (const j of srcJes || []) {
      const row = j as { id: string; entry_no: string | null; is_void: boolean | null };
      sourceJeById.set(row.id, {
        entry_no: row.entry_no,
        is_void: row.is_void === true,
      });
    }
  }

  const paymentById = new Map<string, { reference_number: string | null; voided_at: string | null }>();
  if (paymentIds.length) {
    const { data: pays } = await supabase
      .from('payments')
      .select('id, reference_number, voided_at')
      .eq('company_id', companyId)
      .in('id', paymentIds);
    for (const p of pays || []) {
      const row = p as { id: string; reference_number: string | null; voided_at: string | null };
      paymentById.set(row.id, {
        reference_number: row.reference_number,
        voided_at: row.voided_at,
      });
    }
  }

  return rows.map((r) => {
    const src = r.reference_id ? sourceJeById.get(r.reference_id) : undefined;
    const pay = r.payment_id ? paymentById.get(r.payment_id) : undefined;
    const ctx: StaleCorrectionReversalContext = {
      sourceJournalIsVoid: src?.is_void ?? undefined,
      sourceJournalIsActive: src ? !src.is_void : undefined,
      paymentVoidedAt: pay?.voided_at ?? (r.payment_id ? null : undefined),
    };
    return { row: r, src, pay, ctx };
  });
}

function formatCorrectionReversalSourceStatus(
  src: { entry_no: string | null; is_void: boolean } | undefined,
  pay: { reference_number: string | null; voided_at: string | null } | undefined
): string {
  const parts: string[] = [];
  if (pay?.reference_number) {
    parts.push(pay.voided_at ? `Payment ${pay.reference_number} (voided)` : `Payment ${pay.reference_number} (active)`);
  }
  if (src?.entry_no) {
    parts.push(src.is_void ? `Source ${src.entry_no} (voided)` : `Source ${src.entry_no} (active)`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

/**
 * Active correction_reversal JEs whose source payment/JE is already void — safe to remove from live GL.
 */
export async function getStaleCorrectionReversalCandidates(
  companyId: string
): Promise<StaleCorrectionReversalCandidate[]> {
  const bundles = await fetchActiveCorrectionReversalsWithContext(companyId);

  const out: StaleCorrectionReversalCandidate[] = [];
  for (const { row: r, src, pay, ctx } of bundles) {
    if (
      !isStaleCorrectionReversalVoidEligible(
        {
          reference_type: 'correction_reversal',
          is_void: r.is_void,
          action_fingerprint: r.action_fingerprint,
          payment_id: r.payment_id,
          reference_id: r.reference_id,
        },
        ctx
      )
    ) {
      continue;
    }
    out.push({
      id: r.id,
      entry_no: r.entry_no,
      entry_date: r.entry_date,
      description: r.description,
      amount: lineAmount(r.lines),
      payment_id: r.payment_id,
      paymentRef: pay?.reference_number ?? null,
      sourceEntryNo: src?.entry_no ?? null,
      sourceJournalIsVoid: src?.is_void ?? false,
      paymentVoidedAt: pay?.voided_at ?? null,
      voidReasonSuggested: buildStaleReversalVoidReason(
        r.entry_no,
        pay?.reference_number ? `payment ${pay.reference_number} already voided` : 'source journal voided'
      ),
    });
  }
  return out;
}

/** Read-only review of all active correction_reversal rows with stale-removal eligibility. */
export async function getActiveCorrectionReversalReview(
  companyId: string
): Promise<ActiveCorrectionReversalReviewRow[]> {
  const bundles = await fetchActiveCorrectionReversalsWithContext(companyId);

  return bundles.map(({ row: r, src, pay, ctx }) => {
    const eligibility = correctionReversalReviewEligibility(
      {
        reference_type: 'correction_reversal',
        is_void: r.is_void,
        action_fingerprint: r.action_fingerprint,
        payment_id: r.payment_id,
        reference_id: r.reference_id,
      },
      ctx
    );
    return {
      id: r.id,
      entry_no: r.entry_no,
      entry_date: r.entry_date,
      description: r.description,
      amount: lineAmount(r.lines),
      paymentRef: pay?.reference_number ?? null,
      sourceEntryNo: src?.entry_no ?? null,
      sourceStatus: formatCorrectionReversalSourceStatus(src, pay),
      eligibilityStatus: eligibility.status,
      eligibilityLabel: eligibility.label,
    };
  });
}

export async function voidStaleCorrectionReversals(
  companyId: string,
  ids: string[],
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!ids.length) return { success: true };
  const candidates = await getStaleCorrectionReversalCandidates(companyId);
  const allowed = new Set(candidates.map((c) => c.id));
  const toVoid = ids.filter((id) => allowed.has(id));
  if (!toVoid.length) {
    return { success: false, error: 'No eligible stale reversal entries to void.' };
  }
  if (toVoid.length === 1 && reason) {
    return voidJournalEntries(companyId, toVoid, reason);
  }
  for (const id of toVoid) {
    const row = candidates.find((c) => c.id === id);
    const res = await voidJournalEntries(
      companyId,
      [id],
      reason || row?.voidReasonSuggested || buildStaleReversalVoidReason(row?.entry_no)
    );
    if (!res.success) return res;
  }
  return { success: true };
}

/** Read-only browse of voided journal headers (audit history — not an actionable hygiene queue). */
export async function getVoidedJournalAuditBrowse(
  companyId: string,
  options: VoidedJournalAuditBrowseOptions = {}
): Promise<VoidedJournalAuditBrowseResult> {
  const limit = Math.max(1, options.limit ?? 50);
  const offset = Math.max(0, options.offset ?? 0);

  const { count, error: countError } = await supabase
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_void', true);

  if (countError) {
    return { rows: [], total: 0, error: countError.message };
  }

  const total = count ?? 0;
  if (total === 0) return { rows: [], total: 0 };

  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, entry_no, entry_date, reference_type, void_reason, voided_at, description')
    .eq('company_id', companyId)
    .eq('is_void', true)
    .order('voided_at', { ascending: false, nullsFirst: false })
    .order('entry_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { rows: [], total, error: error.message };
  }

  const rows = ((data || []) as VoidedJournalAuditRow[]).map(mapVoidedJournalAuditRow);
  return { rows, total };
}

/**
 * Void journal entries by IDs (set is_void = true, void_reason, voided_at).
 */
export async function voidJournalEntries(
  companyId: string,
  ids: string[],
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (!ids.length) return { success: true };
  const { error } = await supabase
    .from('journal_entries')
    .update({
      is_void: true,
      void_reason: reason,
      voided_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .in('id', ids);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Void duplicate group: keep first (earliest), void the rest.
 */
export async function voidDuplicateGroup(
  companyId: string,
  jeIds: string[],
  referenceType: string
): Promise<{ success: boolean; voided: number; error?: string }> {
  if (jeIds.length <= 1) return { success: true, voided: 0 };
  const toVoid = jeIds.slice(1);
  const res = await voidJournalEntries(
    companyId,
    toVoid,
    `PF-14.5B duplicate ${referenceType} (kept first)`
  );
  return { success: res.success, voided: res.success ? toVoid.length : 0, error: res.error };
}

/**
 * Fetch summary for Test Lab: duplicates, orphans, voided/active counts.
 */
export async function getIntegritySummary(companyId: string): Promise<IntegritySummary> {
  const [duplicateGroups, orphanEntries, staleCorrectionReversals, voidedCount, activeCount] = await Promise.all([
    getDuplicateCandidates(companyId),
    getOrphanCandidates(companyId),
    getStaleCorrectionReversalCandidates(companyId),
    supabase
      .from('journal_entries')
      .select('reference_type')
      .eq('company_id', companyId)
      .eq('is_void', true)
      .then((r) => {
        const arr = (r.data || []) as { reference_type: string }[];
        const byType = new Map<string, number>();
        arr.forEach((e) => byType.set(e.reference_type || 'unknown', (byType.get(e.reference_type || 'unknown') || 0) + 1));
        return [...byType.entries()].map(([reference_type, count]) => ({ reference_type, count }));
      }),
    supabase
      .from('journal_entries')
      .select('reference_type')
      .eq('company_id', companyId)
      .or('is_void.is.null,is_void.eq.false')
      .then((r) => {
        const arr = (r.data || []) as { reference_type: string }[];
        const byType = new Map<string, number>();
        arr.forEach((e) => byType.set(e.reference_type || 'unknown', (byType.get(e.reference_type || 'unknown') || 0) + 1));
        return [...byType.entries()].map(([reference_type, count]) => ({ reference_type, count }));
      }),
  ]);

  return {
    duplicateGroups,
    orphanEntries,
    staleCorrectionReversals,
    voidedCountByType: voidedCount,
    activeCountByType: activeCount,
  };
}
