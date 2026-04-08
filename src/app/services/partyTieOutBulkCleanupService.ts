/**
 * Live party tie-out cleanup: rank mismatches, classify repairs, apply deterministic DB fixes with audit (no GL mutation).
 */

import { supabase } from '@/lib/supabase';
import { contactService } from '@/app/services/contactService';
import { runPartyBalanceTieOut, type PartyKind } from '@/app/services/partyBalanceTieOutService';
import { buildPartyTieOutRepairPlan, type PartyTieOutRepairBucket } from '@/app/services/partyTieOutRepairService';

const EPS = 0.01;

function safeBranch(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  const u = String(branchId).trim();
  return /^[0-9a-f-]{36}$/i.test(u) ? u : null;
}

export interface RankedPartyRow {
  partyId: string;
  partyType: PartyKind;
  name: string | null;
  operational: number;
  glSlice: number;
  absVariance: number;
}

export interface TieOutCleanupPartyDetail extends RankedPartyRow {
  tieOutError?: string;
  repairCandidateCount: number;
  bucketCounts: Record<PartyTieOutRepairBucket, number>;
  /** Rows that need human decision */
  manualReviewHints: string[];
}

export interface LivePartyTieOutCleanupReport {
  scannedAt: string;
  companyId: string;
  branchId: string | null;
  limits: { topPerKind: number; minAbsVariance: number };
  ranked: {
    customers: RankedPartyRow[];
    suppliers: RankedPartyRow[];
    workers: RankedPartyRow[];
  };
  details: TieOutCleanupPartyDetail[];
  summary: {
    partiesDeepScanned: number;
    autoFixableBackfillCandidates: number;
    manualReviewPartyCount: number;
    totalRepairCandidates: number;
    topResidualParties: { partyId: string; partyType: PartyKind; name: string | null; residual: number }[];
  };
  /** Before scan: coarse op vs GL count over ranked set */
  beforeCoarseMismatchParties: number;
  /** After: parties in deep scan with any repair candidate */
  afterPartiesWithIssues: number;
}

export interface PaymentContactBackfillRow {
  paymentId: string;
  referenceType: string;
  referenceId: string | null;
  currentContactId: string | null;
  proposedContactId: string;
  source: 'sale_customer_id' | 'purchase_supplier_id';
}

export interface ApplyBackfillResult {
  /** Rows updated (0 when dryRun) */
  applied: number;
  /** Rows that would be updated (dryRun only) */
  wouldApply: number;
  skipped: number;
  errors: string[];
  auditIds: string[];
}

/**
 * Rank contacts by |operational − GL party slice| using summary RPCs (fast).
 */
export async function rankPartiesByOperationalVsGl(
  companyId: string,
  branchId: string | null | undefined,
  opts: { topPerKind: number; minAbsVariance: number }
): Promise<{ customers: RankedPartyRow[]; suppliers: RankedPartyRow[]; workers: RankedPartyRow[] }> {
  const b = safeBranch(branchId ?? null);
  const { topPerKind, minAbsVariance } = opts;

  const { map: opMap, error: opErr } = await contactService.getContactBalancesSummary(companyId, b);
  const glRpc = await supabase.rpc('get_contact_party_gl_balances', {
    p_company_id: companyId,
    p_branch_id: b,
  });
  const glRows = !glRpc.error && Array.isArray(glRpc.data) ? (glRpc.data as any[]) : [];

  const glById = new Map<string, { ar: number; ap: number; wk: number }>();
  for (const r of glRows) {
    glById.set(String(r.contact_id), {
      ar: Number(r.gl_ar_receivable) || 0,
      ap: Number(r.gl_ap_payable) || 0,
      wk: Number(r.gl_worker_payable) || 0,
    });
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, type')
    .eq('company_id', companyId);

  const customers: RankedPartyRow[] = [];
  const suppliers: RankedPartyRow[] = [];
  const workers: RankedPartyRow[] = [];

  for (const c of contacts || []) {
    const id = String((c as any).id);
    const t = String((c as any).type || '').toLowerCase();
    const name = (c as any).name ?? null;
    const op = !opErr ? opMap.get(id) : undefined;
    const gl = glById.get(id) || { ar: 0, ap: 0, wk: 0 };

    if (t === 'customer' || t === 'both') {
      const o = Number(op?.receivables) || 0;
      const g = gl.ar;
      const v = Math.abs(o - g);
      if (v >= minAbsVariance) {
        customers.push({ partyId: id, partyType: 'customer', name, operational: o, glSlice: g, absVariance: v });
      }
    }
    if (t === 'supplier' || t === 'both') {
      const o = Number(op?.payables) || 0;
      const g = gl.ap;
      const v = Math.abs(o - g);
      if (v >= minAbsVariance) {
        suppliers.push({ partyId: id, partyType: 'supplier', name, operational: o, glSlice: g, absVariance: v });
      }
    }
    if (t === 'worker') {
      const o = Number(op?.payables) || 0;
      const g = gl.wk;
      const v = Math.abs(o - g);
      if (v >= minAbsVariance) {
        workers.push({ partyId: id, partyType: 'worker', name, operational: o, glSlice: g, absVariance: v });
      }
    }
  }

  const sortTake = (arr: RankedPartyRow[]) =>
    arr.sort((a, b) => b.absVariance - a.absVariance).slice(0, topPerKind);

  return {
    customers: sortTake(customers),
    suppliers: sortTake(suppliers),
    workers: sortTake(workers),
  };
}

function emptyBuckets(): Record<PartyTieOutRepairBucket, number> {
  return {
    missing_payment_contact_id: 0,
    wrong_document_payment_contact: 0,
    payment_without_je: 0,
    control_line_party_unresolved: 0,
    worker_lifecycle_rule_failure: 0,
    residual_after_attribution: 0,
    operational_vs_gl_slice: 0,
  };
}

/**
 * Deep scan: tie-out + repair plan for selected parties (developer cleanup).
 */
export async function runLivePartyTieOutCleanupScan(
  companyId: string,
  branchId: string | null | undefined,
  opts: { topPerKind: number; minAbsVariance: number }
): Promise<LivePartyTieOutCleanupReport> {
  const b = safeBranch(branchId ?? null);
  const ranked = await rankPartiesByOperationalVsGl(companyId, branchId, opts);
  const pickRaw = [...ranked.customers, ...ranked.suppliers, ...ranked.workers];
  const seen = new Set<string>();
  const pick = pickRaw.filter((r) => {
    const k = `${r.partyType}:${r.partyId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const beforeCoarseMismatchParties = pick.length;

  const details: TieOutCleanupPartyDetail[] = [];
  let totalRepairCandidates = 0;
  const residualList: { partyId: string; partyType: PartyKind; name: string | null; residual: number }[] = [];

  for (const row of pick) {
    const bucketCounts = emptyBuckets();
    const manualReviewHints: string[] = [];
    let tieOutError: string | undefined;
    let repairCandidateCount = 0;

    try {
      const tie = await runPartyBalanceTieOut({
        companyId,
        partyType: row.partyType,
        partyId: row.partyId,
        branchId: b,
      });
      const plan = buildPartyTieOutRepairPlan(tie);
      repairCandidateCount = plan.candidates.length;
      totalRepairCandidates += repairCandidateCount;

      for (const c of plan.candidates) {
        bucketCounts[c.bucket] += 1;
      }

      const rv = tie.residual.unmappedPartyOnControl.value;
      if (rv != null && Math.abs(rv) > EPS) {
        residualList.push({
          partyId: row.partyId,
          partyType: row.partyType,
          name: tie.party.name,
          residual: Math.abs(rv),
        });
      }

      for (const c of plan.candidates) {
        if (
          c.bucket === 'wrong_document_payment_contact' ||
          c.bucket === 'worker_lifecycle_rule_failure' ||
          c.bucket === 'control_line_party_unresolved'
        ) {
          manualReviewHints.push(`${c.bucket}: ${c.message}`);
        }
      }
    } catch (e) {
      tieOutError = e instanceof Error ? e.message : String(e);
      manualReviewHints.push(`Tie-out failed: ${tieOutError}`);
    }

    details.push({
      ...row,
      tieOutError,
      repairCandidateCount,
      bucketCounts,
      manualReviewHints,
    });
  }

  residualList.sort((a, b) => b.residual - a.residual);

  const backfillSale = await findSalePaymentContactBackfillCandidates(companyId);
  const backfillPur = await findPurchasePaymentContactBackfillCandidates(companyId);
  const autoFixableBackfillCandidates = backfillSale.length + backfillPur.length;

  const manualReviewPartyCount = details.filter(
    (d) => d.manualReviewHints.length > 0 || d.repairCandidateCount > 0
  ).length;

  return {
    scannedAt: new Date().toISOString(),
    companyId,
    branchId: b,
    limits: { topPerKind: opts.topPerKind, minAbsVariance: opts.minAbsVariance },
    ranked,
    details,
    summary: {
      partiesDeepScanned: pick.length,
      autoFixableBackfillCandidates,
      manualReviewPartyCount,
      totalRepairCandidates,
      topResidualParties: residualList.slice(0, 20),
    },
    beforeCoarseMismatchParties,
    afterPartiesWithIssues: details.filter((d) => d.repairCandidateCount > 0).length,
  };
}

/** Sale-linked payments with NULL contact_id — document gives customer_id. */
export async function findSalePaymentContactBackfillCandidates(companyId: string): Promise<PaymentContactBackfillRow[]> {
  const { data: pays, error } = await supabase
    .from('payments')
    .select('id, reference_id, contact_id, reference_type')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale')
    .is('contact_id', null)
    .not('reference_id', 'is', null)
    .limit(500);
  if (error || !pays?.length) return [];

  const saleIds = [...new Set(pays.map((p: any) => String(p.reference_id)))];
  const { data: sales } = await supabase
    .from('sales')
    .select('id, customer_id')
    .eq('company_id', companyId)
    .in('id', saleIds);
  const cust = new Map((sales || []).map((s: any) => [String(s.id), s.customer_id ? String(s.customer_id) : null]));

  const out: PaymentContactBackfillRow[] = [];
  for (const p of pays as any[]) {
    const cid = cust.get(String(p.reference_id));
    if (!cid) continue;
    out.push({
      paymentId: String(p.id),
      referenceType: 'sale',
      referenceId: p.reference_id ? String(p.reference_id) : null,
      currentContactId: null,
      proposedContactId: cid,
      source: 'sale_customer_id',
    });
  }
  return out;
}

/** Purchase-linked payments with NULL contact_id — document gives supplier_id. */
export async function findPurchasePaymentContactBackfillCandidates(companyId: string): Promise<PaymentContactBackfillRow[]> {
  const { data: pays, error } = await supabase
    .from('payments')
    .select('id, reference_id, contact_id, reference_type')
    .eq('company_id', companyId)
    .eq('reference_type', 'purchase')
    .is('contact_id', null)
    .not('reference_id', 'is', null)
    .limit(500);
  if (error || !pays?.length) return [];

  const purIds = [...new Set(pays.map((p: any) => String(p.reference_id)))];
  const { data: purs } = await supabase
    .from('purchases')
    .select('id, supplier_id')
    .eq('company_id', companyId)
    .in('id', purIds);
  const sup = new Map((purs || []).map((x: any) => [String(x.id), x.supplier_id ? String(x.supplier_id) : null]));

  const out: PaymentContactBackfillRow[] = [];
  for (const p of pays as any[]) {
    const sid = sup.get(String(p.reference_id));
    if (!sid) continue;
    out.push({
      paymentId: String(p.id),
      referenceType: 'purchase',
      referenceId: p.reference_id ? String(p.reference_id) : null,
      currentContactId: null,
      proposedContactId: sid,
      source: 'purchase_supplier_id',
    });
  }
  return out;
}

/**
 * Apply contact_id backfill only when current value is NULL (deterministic, traceable).
 */
export async function applyPaymentContactBackfills(
  companyId: string,
  rows: PaymentContactBackfillRow[],
  opts: { dryRun: boolean; appliedByUserId?: string | null }
): Promise<ApplyBackfillResult> {
  const result: ApplyBackfillResult = { applied: 0, wouldApply: 0, skipped: 0, errors: [], auditIds: [] };
  for (const r of rows) {
    const { data: cur, error: fetchErr } = await supabase
      .from('payments')
      .select('id, contact_id, company_id')
      .eq('id', r.paymentId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (fetchErr || !cur) {
      result.errors.push(`${r.paymentId}: fetch failed`);
      result.skipped++;
      continue;
    }
    if (cur.contact_id != null) {
      result.skipped++;
      continue;
    }
    if (opts.dryRun) {
      result.wouldApply++;
      continue;
    }
    const oldVal = cur.contact_id != null ? String(cur.contact_id) : '';
    const { error: updErr } = await supabase
      .from('payments')
      .update({ contact_id: r.proposedContactId })
      .eq('id', r.paymentId)
      .eq('company_id', companyId)
      .is('contact_id', null);
    if (updErr) {
      result.errors.push(`${r.paymentId}: ${updErr.message}`);
      result.skipped++;
      continue;
    }
    const { data: audit, error: audErr } = await supabase
      .from('party_repair_audit')
      .insert({
        company_id: companyId,
        table_name: 'payments',
        row_id: r.paymentId,
        column_name: 'contact_id',
        old_value: oldVal,
        new_value: r.proposedContactId,
        reason_code: r.source === 'sale_customer_id' ? 'BACKFILL_SALE_CUSTOMER' : 'BACKFILL_PURCHASE_SUPPLIER',
        metadata: { reference_type: r.referenceType, reference_id: r.referenceId },
        applied_by: opts.appliedByUserId ?? null,
      })
      .select('id')
      .maybeSingle();
    if (audErr) result.errors.push(`audit ${r.paymentId}: ${audErr.message}`);
    if (!audErr && audit?.id) result.auditIds.push(String(audit.id));
    result.applied++;
  }
  return result;
}
