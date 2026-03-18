/**
 * PF-14.5B: Accounting Integrity Test Lab – duplicate/orphan detection and safe void.
 * No deletes; void only. Business views exclude voided entries.
 */

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
  voidedCountByType: { reference_type: string; count: number }[];
  activeCountByType: { reference_type: string; count: number }[];
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
  const [duplicateGroups, orphanEntries, voidedCount, activeCount] = await Promise.all([
    getDuplicateCandidates(companyId),
    getOrphanCandidates(companyId),
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
    voidedCountByType: voidedCount,
    activeCountByType: activeCount,
  };
}
