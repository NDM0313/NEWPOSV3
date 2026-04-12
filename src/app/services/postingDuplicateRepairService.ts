/**
 * Global duplicate / stacked posting detection and controlled repair.
 * Canonical rule: one active primary journal per payments.id (journal_entries.payment_id, non-void, not payment_adjustment).
 * PF-14 adjustments are separate rows (reference_type = payment_adjustment, reference_id = payment id).
 */

import { supabase } from '@/lib/supabase';
import { syncPaymentAccountAdjustmentsForCompany } from '@/app/services/paymentAdjustmentService';

export type DuplicatePrimaryPaymentGroup = {
  paymentId: string;
  referenceType: string | null;
  amount: number | null;
  /** Oldest primary kept by repair */
  keepJournalEntryId: string;
  /** Same payment_id, later created_at — void candidates */
  duplicateJournalEntryIds: string[];
};

export type PostingDuplicationPreview = {
  companyId: string;
  duplicatePrimaryGroups: DuplicatePrimaryPaymentGroup[];
  duplicateCount: number;
};

export type DuplicateEntryNoGroup = {
  /** Canonical casing from first row in sort order */
  entryNo: string;
  keepJournalEntryId: string;
  duplicateJournalEntryIds: string[];
};

export type DuplicateEntryNoPreview = {
  companyId: string;
  groups: DuplicateEntryNoGroup[];
  duplicateCount: number;
};

export type DuplicateFingerprintGroup = {
  actionFingerprint: string;
  keepJournalEntryId: string;
  duplicateJournalEntryIds: string[];
};

export type DuplicateFingerprintPreview = {
  companyId: string;
  groups: DuplicateFingerprintGroup[];
  duplicateCount: number;
};

const JE_PAGE = 800;
const VOID_ID_BATCH = 250;

async function voidJournalEntryIdsBatched(companyId: string, ids: string[]): Promise<{ error?: string }> {
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += VOID_ID_BATCH) {
    const slice = uniq.slice(i, i + VOID_ID_BATCH);
    const { error } = await supabase
      .from('journal_entries')
      .update({ is_void: true })
      .eq('company_id', companyId)
      .in('id', slice);
    if (error) return { error: error.message };
  }
  return {};
}

async function fetchAllActiveJournalIdsForDuplicateScan(
  companyId: string,
  columns: 'entry_no' | 'action_fingerprint'
): Promise<{ id: string; created_at: string; entry_no?: string; action_fingerprint?: string }[]> {
  const out: { id: string; created_at: string; entry_no?: string; action_fingerprint?: string }[] = [];
  for (let from = 0; ; from += JE_PAGE) {
    const to = from + JE_PAGE - 1;
    let q = supabase
      .from('journal_entries')
      .select(
        columns === 'entry_no'
          ? 'id, entry_no, created_at'
          : 'id, action_fingerprint, created_at'
      )
      .eq('company_id', companyId)
      .or('is_void.is.null,is_void.eq.false')
      .order('id', { ascending: true })
      .range(from, to);
    if (columns === 'entry_no') {
      q = q.not('entry_no', 'is', null);
    } else {
      q = q.not('action_fingerprint', 'is', null);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = data || [];
    for (const r of rows as any[]) {
      if (columns === 'entry_no') {
        const en = String(r.entry_no || '').trim();
        if (!en) continue;
        out.push({ id: r.id, created_at: r.created_at || '', entry_no: en });
      } else {
        const fp = String(r.action_fingerprint || '').trim();
        if (!fp) continue;
        out.push({ id: r.id, created_at: r.created_at || '', action_fingerprint: fp });
      }
    }
    if (rows.length < JE_PAGE) break;
  }
  return out;
}

/**
 * List payments that have more than one active primary-linked journal entry.
 */
export async function previewDuplicatePrimaryPaymentJournals(companyId: string): Promise<PostingDuplicationPreview> {
  const { data: payments } = await supabase
    .from('payments')
    .select('id, reference_type, amount')
    .eq('company_id', companyId);

  const paymentIds = (payments || []).map((p: any) => p.id);
  if (!paymentIds.length) {
    return { companyId, duplicatePrimaryGroups: [], duplicateCount: 0 };
  }

  const { data: jes } = await supabase
    .from('journal_entries')
    .select('id, payment_id, created_at, reference_type, is_void')
    .eq('company_id', companyId)
    .in('payment_id', paymentIds)
    .or('is_void.is.null,is_void.eq.false')
    .neq('reference_type', 'payment_adjustment');

  const byPay = new Map<string, any[]>();
  for (const je of jes || []) {
    const row = je as any;
    const pid = row.payment_id;
    if (!pid) continue;
    if (!byPay.has(pid)) byPay.set(pid, []);
    byPay.get(pid)!.push(row);
  }

  const duplicatePrimaryGroups: DuplicatePrimaryPaymentGroup[] = [];
  const payMap = new Map((payments || []).map((p: any) => [p.id, p]));

  for (const [paymentId, list] of byPay) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
    const keep = sorted[0];
    const dups = sorted.slice(1).map((x) => x.id);
    const p = payMap.get(paymentId) as any;
    duplicatePrimaryGroups.push({
      paymentId,
      referenceType: p?.reference_type ?? null,
      amount: p?.amount != null ? Number(p.amount) : null,
      keepJournalEntryId: keep.id,
      duplicateJournalEntryIds: dups,
    });
  }

  return {
    companyId,
    duplicatePrimaryGroups,
    duplicateCount: duplicatePrimaryGroups.reduce((s, g) => s + g.duplicateJournalEntryIds.length, 0),
  };
}

/**
 * More than one **active** journal with the same `entry_no` (case-insensitive) — breaks `maybeSingle` lookups and statements.
 */
export async function previewDuplicateEntryNoJournals(companyId: string): Promise<DuplicateEntryNoPreview> {
  const rows = await fetchAllActiveJournalIdsForDuplicateScan(companyId, 'entry_no');
  const byKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.entry_no!.toLowerCase();
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(r);
  }
  const groups: DuplicateEntryNoGroup[] = [];
  for (const [, list] of byKey) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
    groups.push({
      entryNo: sorted[0].entry_no!,
      keepJournalEntryId: sorted[0].id,
      duplicateJournalEntryIds: sorted.slice(1).map((x) => x.id),
    });
  }
  const duplicateCount = groups.reduce((s, g) => s + g.duplicateJournalEntryIds.length, 0);
  return { companyId, groups, duplicateCount };
}

/**
 * Same `action_fingerprint` on two+ active JEs — PF-14 idempotency bypass / double post.
 */
export async function previewDuplicateFingerprintJournals(companyId: string): Promise<DuplicateFingerprintPreview> {
  const rows = await fetchAllActiveJournalIdsForDuplicateScan(companyId, 'action_fingerprint');
  const byKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.action_fingerprint!;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(r);
  }
  const groups: DuplicateFingerprintGroup[] = [];
  for (const [fp, list] of byKey) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
    groups.push({
      actionFingerprint: fp,
      keepJournalEntryId: sorted[0].id,
      duplicateJournalEntryIds: sorted.slice(1).map((x) => x.id),
    });
  }
  const duplicateCount = groups.reduce((s, g) => s + g.duplicateJournalEntryIds.length, 0);
  return { companyId, groups, duplicateCount };
}

export async function previewAllJournalPostingDuplicates(companyId: string): Promise<{
  primary: PostingDuplicationPreview;
  entryNo: DuplicateEntryNoPreview;
  fingerprint: DuplicateFingerprintPreview;
}> {
  const [primary, entryNo, fingerprint] = await Promise.all([
    previewDuplicatePrimaryPaymentJournals(companyId),
    previewDuplicateEntryNoJournals(companyId),
    previewDuplicateFingerprintJournals(companyId),
  ]);
  return { primary, entryNo, fingerprint };
}

export type VoidDuplicateResult = {
  voidedJournalEntryIds: string[];
  error?: string;
};

/**
 * Void duplicate primary payment journals (keep earliest created_at per payment_id). Idempotent.
 */
export async function voidDuplicatePrimaryPaymentJournals(
  companyId: string,
  options?: { dryRun?: boolean }
): Promise<VoidDuplicateResult> {
  const preview = await previewDuplicatePrimaryPaymentJournals(companyId);
  const ids = preview.duplicatePrimaryGroups.flatMap((g) => g.duplicateJournalEntryIds);
  if (options?.dryRun || ids.length === 0) {
    return { voidedJournalEntryIds: options?.dryRun ? ids : [] };
  }

  const batched = await voidJournalEntryIdsBatched(companyId, ids);
  if (batched.error) return { voidedJournalEntryIds: [], error: batched.error };
  return { voidedJournalEntryIds: ids };
}

export async function voidDuplicateEntryNoJournals(
  companyId: string,
  options?: { dryRun?: boolean }
): Promise<VoidDuplicateResult> {
  const preview = await previewDuplicateEntryNoJournals(companyId);
  const ids = preview.groups.flatMap((g) => g.duplicateJournalEntryIds);
  if (options?.dryRun || ids.length === 0) {
    return { voidedJournalEntryIds: options?.dryRun ? ids : [] };
  }
  const batched = await voidJournalEntryIdsBatched(companyId, ids);
  if (batched.error) return { voidedJournalEntryIds: [], error: batched.error };
  return { voidedJournalEntryIds: ids };
}

export async function voidDuplicateFingerprintJournals(
  companyId: string,
  options?: { dryRun?: boolean }
): Promise<VoidDuplicateResult> {
  const preview = await previewDuplicateFingerprintJournals(companyId);
  const ids = preview.groups.flatMap((g) => g.duplicateJournalEntryIds);
  if (options?.dryRun || ids.length === 0) {
    return { voidedJournalEntryIds: options?.dryRun ? ids : [] };
  }
  const batched = await voidJournalEntryIdsBatched(companyId, ids);
  if (batched.error) return { voidedJournalEntryIds: [], error: batched.error };
  return { voidedJournalEntryIds: ids };
}

export type FullPostingRepairSummary = {
  preview: PostingDuplicationPreview;
  previewEntryNo: DuplicateEntryNoPreview;
  previewFingerprint: DuplicateFingerprintPreview;
  voidedJournalEntryIds: string[];
  voidedByCategory: {
    duplicatePrimary: string[];
    duplicateEntryNo: string[];
    duplicateFingerprint: string[];
  };
  sync: Awaited<ReturnType<typeof syncPaymentAccountAdjustmentsForCompany>>;
  dryRun: boolean;
  errors: string[];
};

/**
 * End-to-end: preview duplicates → optionally void extras (primary per payment, duplicate entry_no, duplicate fingerprints) → payment_account sync.
 */
export async function runFullPostingRepair(
  companyId: string,
  options?: {
    voidDuplicates?: boolean;
    voidDuplicateEntryNos?: boolean;
    voidDuplicateFingerprints?: boolean;
    dryRun?: boolean;
  }
): Promise<FullPostingRepairSummary> {
  const dryRun = options?.dryRun === true;
  const errors: string[] = [];
  const [preview, previewEntryNo, previewFingerprint] = await Promise.all([
    previewDuplicatePrimaryPaymentJournals(companyId),
    previewDuplicateEntryNoJournals(companyId),
    previewDuplicateFingerprintJournals(companyId),
  ]);

  const voidedByCategory = {
    duplicatePrimary: [] as string[],
    duplicateEntryNo: [] as string[],
    duplicateFingerprint: [] as string[],
  };
  let voidedJournalEntryIds: string[] = [];

  const wantPrimary = options?.voidDuplicates === true;
  const wantEntryNo = options?.voidDuplicateEntryNos ?? wantPrimary;
  const wantFp = options?.voidDuplicateFingerprints ?? wantPrimary;

  if (wantPrimary && preview.duplicateCount > 0) {
    const v = await voidDuplicatePrimaryPaymentJournals(companyId, { dryRun });
    if (v.error) errors.push(v.error);
    voidedByCategory.duplicatePrimary = v.voidedJournalEntryIds;
  }
  if (wantEntryNo && previewEntryNo.duplicateCount > 0) {
    const v = await voidDuplicateEntryNoJournals(companyId, { dryRun });
    if (v.error) errors.push(v.error);
    voidedByCategory.duplicateEntryNo = v.voidedJournalEntryIds;
  }
  if (wantFp && previewFingerprint.duplicateCount > 0) {
    const v = await voidDuplicateFingerprintJournals(companyId, { dryRun });
    if (v.error) errors.push(v.error);
    voidedByCategory.duplicateFingerprint = v.voidedJournalEntryIds;
  }

  voidedJournalEntryIds = [
    ...new Set([
      ...voidedByCategory.duplicatePrimary,
      ...voidedByCategory.duplicateEntryNo,
      ...voidedByCategory.duplicateFingerprint,
    ]),
  ];

  let sync = { synced: 0, errors: 0, skippedDuplicates: 0, skippedAmbiguous: 0, skippedPf14Chain: 0 };
  if (!dryRun && (wantPrimary || wantEntryNo || wantFp)) {
    try {
      sync = await syncPaymentAccountAdjustmentsForCompany(companyId);
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return {
    preview,
    previewEntryNo,
    previewFingerprint,
    voidedJournalEntryIds,
    voidedByCategory,
    sync,
    dryRun,
    errors,
  };
}
