/**
 * Accounting Integrity Lab — Phase 2: categorized checks, fresh vs live, deep-link metadata, extended snapshots.
 * Canonical GL: accounts, journal_entries, journal_entry_lines. Ops: payments, stock_movements, documents.
 */

import { supabase } from '@/lib/supabase';
import { getDocumentConversionSchemaFlags } from '@/app/lib/documentConversionSchema';
import {
  PURCHASE_BUSINESS_ONLY_STATUSES,
  PURCHASE_STATUSES_FOR_PAYABLE_RECONCILIATION,
  SALE_BUSINESS_ONLY_STATUSES,
} from '@/app/lib/documentStatusConstants';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import { INTEGRITY_LAB_SESSION_KEY as _INTEGRITY_LAB_SESSION_KEY } from '@/app/lib/integrityLabConstants';
import {
  canPostAccountingForPurchaseStatus,
  canPostAccountingForSaleStatus,
  canPostStockForPurchaseStatus,
  canPostStockForSaleStatus,
} from '@/app/lib/postingStatusGate';
import { listActiveCanonicalSaleDocumentJournalEntryIds } from '@/app/services/saleAccountingService';
import { listActiveCanonicalPurchaseDocumentJournalEntryIds } from '@/app/services/purchaseAccountingService';

/** Re-export for lab UI (prefer importing from @/app/lib/integrityLabConstants in new code) */
export const INTEGRITY_LAB_SESSION_KEY = _INTEGRITY_LAB_SESSION_KEY;

export type LabCheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

/** A · Engine Integrity | B · Reconciliation | C · Data Quality / Legacy */
export type LabCheckCategory = 'engine' | 'reconciliation' | 'data_quality';

/**
 * F · Why this warning exists (for QA triage).
 * - engine_bug: current posting logic likely wrong for this row
 * - legacy_data: old rows / manual SQL / pre-canonical postings
 * - missing_backfill: column or link expected but never synced
 * - source_link: payments ↔ JE payment_id, reference chain
 * - reconciliation_timing: subledger vs GL timing / scope mismatch (often OK after investigation)
 * - informational: heuristic / not a failure
 */
export type WarningClassification =
  | 'engine_bug'
  | 'legacy_data'
  | 'missing_backfill'
  | 'source_link'
  | 'reconciliation_timing'
  | 'informational';

/** Actions the lab UI can take when user traces a failure */
export type LabNavAction =
  | { type: 'sale'; saleId: string; label?: string }
  | { type: 'purchase'; purchaseId: string; label?: string }
  | {
      type: 'accounting';
      tab: 'journal_entries' | 'daybook' | 'roznamcha' | 'accounts' | 'ledger' | 'receivables' | 'payables';
      focusJournalEntryId?: string;
      focusAccountId?: string;
      ledgerType?: 'customer' | 'supplier' | 'user' | 'worker';
      label?: string;
    }
  | { type: 'customer_ledger'; label?: string }
  | { type: 'supplier_ledger'; label?: string }
  | { type: 'copy'; text: string; label?: string };

export interface LabCheckFailure {
  module: string;
  step: string;
  record: string;
  expected: string;
  actual: string;
  /** Single row classification (most specific) */
  classification?: WarningClassification;
  /** Quick actions for traceability */
  navActions?: LabNavAction[];
}

/** Lab UI: document certification vs whole-company legacy reconciliation */
export type LabCheckLayer = 'document' | 'company';

export interface LabCheckResult {
  id: string;
  label: string;
  category: LabCheckCategory;
  /** Whole-check default classification when status is warn/fail */
  defaultClassification?: WarningClassification;
  status: LabCheckStatus;
  failures: LabCheckFailure[];
  meta?: Record<string, unknown>;
  /** When set, Auto checks tab splits document vs company suites */
  checkLayer?: LabCheckLayer;
}

export interface JournalBalanceRow {
  journal_entry_id: string;
  entry_no: string | null;
  reference_type: string | null;
  reference_id: string | null;
  total_debit: number;
  total_credit: number;
  diff: number;
}

/** Per-entry debit/credit sums; unbalanced entries have diff !== 0 */
export async function findUnbalancedJournalEntries(
  companyId: string,
  branchId?: string | null
): Promise<JournalBalanceRow[]> {
  let jeQuery = supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, reference_id, company_id, branch_id, is_void')
    .eq('company_id', companyId);
  if (branchId && branchId !== 'all') {
    jeQuery = jeQuery.or(`branch_id.eq.${branchId},branch_id.is.null`);
  }
  const { data: entries, error } = await jeQuery;
  if (error || !entries?.length) return [];

  const ids = entries.filter((e: any) => !e.is_void).map((e: any) => e.id);
  if (!ids.length) return [];

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('journal_entry_id, debit, credit')
    .in('journal_entry_id', ids);

  const sums = new Map<string, { d: number; c: number }>();
  ids.forEach((id) => sums.set(id, { d: 0, c: 0 }));
  (lines || []).forEach((l: any) => {
    const s = sums.get(l.journal_entry_id);
    if (!s) return;
    s.d += Number(l.debit) || 0;
    s.c += Number(l.credit) || 0;
  });

  const byId = new Map(entries.map((e: any) => [e.id, e]));
  const out: JournalBalanceRow[] = [];
  sums.forEach((s, jeId) => {
    const diff = Math.round((s.d - s.c) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      const e = byId.get(jeId) as any;
      out.push({
        journal_entry_id: jeId,
        entry_no: e?.entry_no ?? null,
        reference_type: e?.reference_type ?? null,
        reference_id: e?.reference_id ?? null,
        total_debit: s.d,
        total_credit: s.c,
        diff,
      });
    }
  });
  return out;
}

function matchesBranchFilter(
  rowBranchId: string | null | undefined,
  branchId: string | null | undefined
): boolean {
  if (!branchId || branchId === 'all') return true;
  if (rowBranchId == null || rowBranchId === '') return true;
  return rowBranchId === branchId;
}

/**
 * Unbalanced JEs that touch only the selected sale/purchase: document + reversal refs,
 * plus any journal_entries linked via payments for that document. Does not load company-wide JE rows.
 */
export async function findUnbalancedJournalEntriesForDocument(
  companyId: string,
  branchId: string | null | undefined,
  opts: { saleId?: string; purchaseId?: string }
): Promise<JournalBalanceRow[]> {
  const jeIds = new Set<string>();

  const considerRow = (e: { id: string; branch_id?: string | null; is_void?: boolean | null }) => {
    if (e.is_void) return;
    if (!matchesBranchFilter(e.branch_id, branchId)) return;
    jeIds.add(e.id);
  };

  const addByRef = async (rt: string, rid: string) => {
    const { data } = await supabase
      .from('journal_entries')
      .select('id, branch_id, is_void')
      .eq('company_id', companyId)
      .eq('reference_type', rt)
      .eq('reference_id', rid);
    (data || []).forEach(considerRow);
  };

  if (opts.saleId) {
    await addByRef('sale', opts.saleId);
    await addByRef('sale_reversal', opts.saleId);
    const { data: pays } = await supabase
      .from('payments')
      .select('id')
      .eq('reference_type', 'sale')
      .eq('reference_id', opts.saleId);
    for (const p of pays || []) {
      const { data: jes } = await supabase
        .from('journal_entries')
        .select('id, branch_id, is_void')
        .eq('company_id', companyId)
        .eq('payment_id', (p as { id: string }).id);
      (jes || []).forEach(considerRow);
    }
  }

  if (opts.purchaseId) {
    await addByRef('purchase', opts.purchaseId);
    const { data: pays } = await supabase
      .from('payments')
      .select('id')
      .eq('reference_type', 'purchase')
      .eq('reference_id', opts.purchaseId);
    for (const p of pays || []) {
      const { data: jes } = await supabase
        .from('journal_entries')
        .select('id, branch_id, is_void')
        .eq('company_id', companyId)
        .eq('payment_id', (p as { id: string }).id);
      (jes || []).forEach(considerRow);
    }
  }

  const ids = [...jeIds];
  if (!ids.length) return [];

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, reference_id, company_id, branch_id, is_void')
    .eq('company_id', companyId)
    .in('id', ids);
  if (error || !entries?.length) return [];

  const activeIds = entries.filter((e: any) => !e.is_void).map((e: any) => e.id);
  if (!activeIds.length) return [];

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('journal_entry_id, debit, credit')
    .in('journal_entry_id', activeIds);

  const sums = new Map<string, { d: number; c: number }>();
  activeIds.forEach((id) => sums.set(id, { d: 0, c: 0 }));
  (lines || []).forEach((l: any) => {
    const s = sums.get(l.journal_entry_id);
    if (!s) return;
    s.d += Number(l.debit) || 0;
    s.c += Number(l.credit) || 0;
  });

  const byId = new Map(entries.map((e: any) => [e.id, e]));
  const out: JournalBalanceRow[] = [];
  sums.forEach((s, jeId) => {
    const diff = Math.round((s.d - s.c) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      const e = byId.get(jeId) as any;
      out.push({
        journal_entry_id: jeId,
        entry_no: e?.entry_no ?? null,
        reference_type: e?.reference_type ?? null,
        reference_id: e?.reference_id ?? null,
        total_debit: s.d,
        total_credit: s.c,
        diff,
      });
    }
  });
  return out;
}

/** Roll up company reconciliation: FAIL beats WARN beats PASS */
export function summarizeCompanyReconciliationStatus(results: LabCheckResult[]): 'pass' | 'warn' | 'fail' {
  if (results.some((r) => r.status === 'fail')) return 'fail';
  if (results.some((r) => r.status === 'warn')) return 'warn';
  return 'pass';
}

function navForUnbalancedRow(u: JournalBalanceRow): LabNavAction[] {
  const actions: LabNavAction[] = [
    {
      type: 'accounting',
      tab: 'journal_entries',
      focusJournalEntryId: u.journal_entry_id,
      label: 'Journal entries (search JE)',
    },
    {
      type: 'accounting',
      tab: 'daybook',
      focusJournalEntryId: u.journal_entry_id,
      label: 'Day Book',
    },
    { type: 'copy', text: u.journal_entry_id, label: 'Copy JE id' },
  ];
  if (u.reference_type === 'sale' && u.reference_id) {
    actions.unshift({ type: 'sale', saleId: u.reference_id, label: 'Open sale' });
  }
  if (u.reference_type === 'purchase' && u.reference_id) {
    actions.unshift({ type: 'purchase', purchaseId: u.reference_id, label: 'Open purchase' });
  }
  return actions;
}

function extractPaymentId(record: string): string | null {
  const m = record.match(/payments\.id=([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

function extractAccountId(record: string): string | null {
  const m = record.match(/accounts\.id=([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

export interface DocumentTruthSnapshot {
  sale?: {
    id: string;
    invoice_no: string | null;
    status: string;
    total: number;
    paid_amount: number;
    due_amount: number;
    discount_amount: number;
    shipment_charges: number;
    expenses: number;
    subtotal: number;
    tax_amount: number;
  };
  purchase?: {
    id: string;
    po_no: string | null;
    status: string;
    total: number;
    paid_amount: number;
    due_amount: number;
    discount_amount: number;
  };
  payments: Array<{
    id: string;
    amount: number;
    payment_type: string;
    reference_type: string;
    reference_id: string;
    payment_account_id: string | null;
    payment_date: string | null;
  }>;
  journalEntries: Array<{
    id: string;
    entry_no: string | null;
    reference_type: string | null;
    reference_id: string | null;
    description: string | null;
    lineCount: number;
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
  }>;
  stockMovementsSample: Array<{
    id: string;
    movement_type: string;
    quantity: number;
    reference_type: string | null;
    reference_id: string | null;
  }>;
}

/** Phase 2 · Snapshot compare: full detail for QA */
export interface ExtendedLabSnapshot {
  document: Record<string, unknown> | null;
  payments: DocumentTruthSnapshot['payments'];
  journalEntriesDetailed: Array<{
    id: string;
    entry_no: string | null;
    reference_type: string | null;
    reference_id: string | null;
    description: string | null;
    lines: Array<{
      account_id: string;
      account_code?: string;
      account_name?: string;
      debit: number;
      credit: number;
      description?: string | null;
    }>;
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
  }>;
  /** Net debit − credit per account across all lines above */
  affectedAccounts: Record<string, { code?: string; name?: string; netDrMinusCr: number }>;
  /** Should be ~0 if every JE on document is self-balanced */
  aggregateLinesDrMinusCr: number;
  trialBalanceHint: {
    companyTbDifference: number | null;
    note: string;
  };
  arAp?: { label: string; sumDueDocuments?: number; glBalance?: number; diff?: number };
  inventory?: { inventoryGl1200?: number; movementHeuristicCost?: number; note: string };
  capturedAt: string;
}

export async function buildExtendedLabSnapshot(
  companyId: string,
  kind: 'sale' | 'purchase',
  docId: string,
  branchId?: string | null
): Promise<ExtendedLabSnapshot | null> {
  const base = kind === 'sale' ? await buildSaleTruthSnapshot(docId) : await buildPurchaseTruthSnapshot(docId);
  if (!base) return null;

  const jesDetailed: ExtendedLabSnapshot['journalEntriesDetailed'] = [];
  let aggDr = 0;
  let aggCr = 0;
  const accMap: ExtendedLabSnapshot['affectedAccounts'] = {};

  const jeIds = base.journalEntries.map((j) => j.id);
  if (jeIds.length) {
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('journal_entry_id, account_id, debit, credit, description')
      .in('journal_entry_id', jeIds);
    const accountIds = [...new Set((lines || []).map((l: any) => l.account_id).filter(Boolean))];
    const { data: accs } = await supabase.from('accounts').select('id, code, name').in('id', accountIds);
    const accById = new Map((accs || []).map((a: any) => [a.id, a]));

    const byJe = new Map<string, any[]>();
    (lines || []).forEach((l: any) => {
      const arr = byJe.get(l.journal_entry_id) || [];
      arr.push(l);
      byJe.set(l.journal_entry_id, arr);
    });

    for (const je of base.journalEntries) {
      const jl = byJe.get(je.id) || [];
      let td = 0,
        tc = 0;
      const lineRows = jl.map((l: any) => {
        const ai = l.account_id;
        const meta = accById.get(ai) as any;
        const d = Number(l.debit) || 0;
        const c = Number(l.credit) || 0;
        td += d;
        tc += c;
        aggDr += d;
        aggCr += c;
        const prev = accMap[ai] || { code: meta?.code, name: meta?.name, netDrMinusCr: 0 };
        prev.netDrMinusCr += d - c;
        if (meta?.code) prev.code = meta.code;
        if (meta?.name) prev.name = meta.name;
        accMap[ai] = prev;
        return {
          account_id: ai,
          account_code: meta?.code,
          account_name: meta?.name,
          debit: d,
          credit: c,
          description: l.description,
        };
      });
      jesDetailed.push({
        id: je.id,
        entry_no: je.entry_no,
        reference_type: je.reference_type,
        reference_id: je.reference_id,
        description: (je as any).description ?? null,
        lines: lineRows,
        totalDebit: td,
        totalCredit: tc,
        balanced: Math.abs(td - tc) < 0.01,
      });
    }
  }

  let companyTbDiff: number | null = null;
  try {
    const end = new Date().toISOString().slice(0, 10);
    const tb = await accountingReportsService.getTrialBalance(
      companyId,
      '1900-01-01',
      end,
      branchId && branchId !== 'all' ? branchId : undefined
    );
    companyTbDiff = tb.difference;
  } catch {
    companyTbDiff = null;
  }

  let arAp: ExtendedLabSnapshot['arAp'];
  if (kind === 'sale' && base.sale) {
    const ar = await runReceivablesVsARCheck(companyId, branchId);
    arAp = {
      label: 'AR vs sales.due (final)',
      sumDueDocuments: (ar.meta?.sumDue as number) ?? undefined,
      glBalance: (ar.meta?.arBalance as number) ?? undefined,
      diff: (ar.meta?.diff as number) ?? undefined,
    };
  }
  if (kind === 'purchase' && base.purchase) {
    const ap = await runPayablesVsAPCheck(companyId, branchId);
    arAp = {
      label: 'AP vs purchases.due',
      sumDueDocuments: (ap.meta?.sumDue as number) ?? undefined,
      glBalance: (ap.meta?.apBalance as number) ?? undefined,
      diff: (ap.meta?.diff as number) ?? undefined,
    };
  }

  const inv = await runInventoryValuationVsStockCheck(companyId);

  return {
    document: (kind === 'sale' ? base.sale : base.purchase) as any,
    payments: base.payments,
    journalEntriesDetailed: jesDetailed,
    affectedAccounts: accMap,
    aggregateLinesDrMinusCr: Math.round((aggDr - aggCr) * 100) / 100,
    trialBalanceHint: {
      companyTbDifference: companyTbDiff,
      note: 'Company-wide TB difference (not only this document). Use Live reconciliation mode to fix legacy JEs.',
    },
    arAp,
    inventory: {
      inventoryGl1200: (inv.meta?.invGlBalance as number) ?? undefined,
      movementHeuristicCost: (inv.meta?.movementHeuristic as number) ?? undefined,
      note: 'Heuristic — use Reports → Inventory Valuation for truth',
    },
    capturedAt: new Date().toISOString(),
  };
}

export async function buildSaleTruthSnapshot(saleId: string): Promise<DocumentTruthSnapshot | null> {
  const { data: sale, error } = await supabase
    .from('sales')
    .select(
      'id, invoice_no, status, total, paid_amount, due_amount, discount_amount, shipment_charges, expenses, subtotal, tax_amount'
    )
    .eq('id', saleId)
    .maybeSingle();
  if (error || !sale) return null;

  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, payment_type, reference_type, reference_id, payment_account_id, payment_date')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId);

  const { data: jes } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, reference_id, description, is_void')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId);

  const journalEntries: DocumentTruthSnapshot['journalEntries'] = [];
  for (const je of jes || []) {
    if ((je as any).is_void) continue;
    const { data: jl } = await supabase
      .from('journal_entry_lines')
      .select('debit, credit')
      .eq('journal_entry_id', (je as any).id);
    let td = 0,
      tc = 0;
    (jl || []).forEach((l: any) => {
      td += Number(l.debit) || 0;
      tc += Number(l.credit) || 0;
    });
    const balanced = Math.abs(td - tc) < 0.01;
    journalEntries.push({
      id: (je as any).id,
      entry_no: (je as any).entry_no,
      reference_type: (je as any).reference_type,
      reference_id: (je as any).reference_id,
      description: (je as any).description,
      lineCount: jl?.length ?? 0,
      totalDebit: td,
      totalCredit: tc,
      balanced,
    });
  }

  const { data: sm } = await supabase
    .from('stock_movements')
    .select('id, movement_type, quantity, reference_type, reference_id')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .limit(50);

  return {
    sale: {
      id: sale.id,
      invoice_no: sale.invoice_no,
      status: sale.status,
      total: Number(sale.total) || 0,
      paid_amount: Number(sale.paid_amount) || 0,
      due_amount: Number(sale.due_amount) || 0,
      discount_amount: Number(sale.discount_amount) || 0,
      shipment_charges: Number((sale as any).shipment_charges) || 0,
      expenses: Number((sale as any).expenses) || 0,
      subtotal: Number(sale.subtotal) || 0,
      tax_amount: Number(sale.tax_amount) || 0,
    },
    payments: (payments || []).map((p: any) => ({
      id: p.id,
      amount: Number(p.amount) || 0,
      payment_type: p.payment_type,
      reference_type: p.reference_type,
      reference_id: p.reference_id,
      payment_account_id: p.payment_account_id,
      payment_date: p.payment_date,
    })),
    journalEntries,
    stockMovementsSample: (sm || []).map((m: any) => ({
      id: m.id,
      movement_type: m.movement_type,
      quantity: Number(m.quantity) || 0,
      reference_type: m.reference_type,
      reference_id: m.reference_id,
    })),
  };
}

export async function buildPurchaseTruthSnapshot(purchaseId: string): Promise<DocumentTruthSnapshot | null> {
  const { data: purchase, error } = await supabase
    .from('purchases')
    .select('id, po_no, status, total, paid_amount, due_amount, discount_amount')
    .eq('id', purchaseId)
    .maybeSingle();
  if (error || !purchase) return null;

  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, payment_type, reference_type, reference_id, payment_account_id, payment_date')
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId);

  const { data: jes } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, reference_id, description, is_void')
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId);

  const journalEntries: DocumentTruthSnapshot['journalEntries'] = [];
  for (const je of jes || []) {
    if ((je as any).is_void) continue;
    const { data: jl } = await supabase
      .from('journal_entry_lines')
      .select('debit, credit')
      .eq('journal_entry_id', (je as any).id);
    let td = 0,
      tc = 0;
    (jl || []).forEach((l: any) => {
      td += Number(l.debit) || 0;
      tc += Number(l.credit) || 0;
    });
    journalEntries.push({
      id: (je as any).id,
      entry_no: (je as any).entry_no,
      reference_type: (je as any).reference_type,
      reference_id: (je as any).reference_id,
      description: (je as any).description,
      lineCount: jl?.length ?? 0,
      totalDebit: td,
      totalCredit: tc,
      balanced: Math.abs(td - tc) < 0.01,
    });
  }

  const { data: sm } = await supabase
    .from('stock_movements')
    .select('id, movement_type, quantity, reference_type, reference_id')
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId)
    .limit(50);

  return {
    purchase: {
      id: purchase.id,
      po_no: (purchase as any).po_no ?? null,
      status: purchase.status,
      total: Number(purchase.total) || 0,
      paid_amount: Number(purchase.paid_amount) || 0,
      due_amount: Number(purchase.due_amount) || 0,
      discount_amount: Number(purchase.discount_amount) || 0,
    },
    payments: (payments || []).map((p: any) => ({
      id: p.id,
      amount: Number(p.amount) || 0,
      payment_type: p.payment_type,
      reference_type: p.reference_type,
      reference_id: p.reference_id,
      payment_account_id: p.payment_account_id,
      payment_date: p.payment_date,
    })),
    journalEntries,
    stockMovementsSample: (sm || []).map((m: any) => ({
      id: m.id,
      movement_type: m.movement_type,
      quantity: Number(m.quantity) || 0,
      reference_type: m.reference_type,
      reference_id: m.reference_id,
    })),
  };
}

export async function findPaymentsMissingJournalLink(
  companyId: string,
  limit = 100
): Promise<LabCheckResult> {
  const failures: LabCheckFailure[] = [];
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, reference_type, reference_id')
    .eq('company_id', companyId)
    .in('reference_type', ['sale', 'purchase'])
    .limit(limit);

  for (const p of payments || []) {
    const { data: je } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('payment_id', (p as any).id)
      .maybeSingle();
    if (!je && (Number((p as any).amount) || 0) > 0) {
      const pid = (p as any).id as string;
      const rid = (p as any).reference_id as string;
      const rtype = (p as any).reference_type as string;
      failures.push({
        module: 'payments',
        step: 'journal_link',
        record: `payments.id=${pid} ref=${rtype}`,
        expected: 'journal_entries.payment_id',
        actual: 'none — legacy or trigger gap',
        classification: 'source_link',
        navActions: [
          ...(rtype === 'sale' && rid
            ? ([{ type: 'sale' as const, saleId: rid, label: 'Open sale' }] as LabNavAction[])
            : []),
          ...(rtype === 'purchase' && rid
            ? ([{ type: 'purchase' as const, purchaseId: rid, label: 'Open purchase' }] as LabNavAction[])
            : []),
          {
            type: 'accounting',
            tab: 'journal_entries',
            label: 'Journal entries',
          },
          { type: 'copy', text: pid, label: 'Copy payment id' },
        ],
      });
    }
  }
  return {
    id: 'payment_je_link',
    label: 'Payments → journal_entries.payment_id',
    category: 'data_quality',
    defaultClassification: 'source_link',
    status: failures.length === 0 ? 'pass' : 'warn',
    failures,
    meta: { checked: (payments || []).length },
  };
}

export async function runTrialBalanceCheck(
  companyId: string,
  branchId?: string | null
): Promise<LabCheckResult> {
  const end = new Date().toISOString().slice(0, 10);
  const tb = await accountingReportsService.getTrialBalance(companyId, '1900-01-01', end, branchId || undefined);
  const ok = Math.abs(tb.difference) < 0.02;
  return {
    id: 'trial_balance',
    label: 'Trial balance (journal lines)',
    category: 'engine',
    defaultClassification: ok ? undefined : 'legacy_data',
    status: ok ? 'pass' : 'fail',
    failures: ok
      ? []
      : [
          {
            module: 'journal_entry_lines',
            step: 'trial_balance',
            record: 'company aggregate',
            expected: 'totalDebit === totalCredit',
            actual: `debit=${tb.totalDebit} credit=${tb.totalCredit} diff=${tb.difference}`,
            classification: 'legacy_data',
            navActions: [
              { type: 'accounting', tab: 'journal_entries', label: 'Journal entries' },
              { type: 'accounting', tab: 'accounts', label: 'Accounts' },
            ],
          },
        ],
    meta: { totalDebit: tb.totalDebit, totalCredit: tb.totalCredit, difference: tb.difference },
  };
}

export async function runBalanceSheetCheck(
  companyId: string,
  branchId?: string | null
): Promise<LabCheckResult> {
  const asOf = new Date().toISOString().slice(0, 10);
  const bs = await accountingReportsService.getBalanceSheet(companyId, asOf, branchId || undefined);
  const ok = Math.abs(bs.difference) < 0.02;
  return {
    id: 'balance_sheet',
    label: 'Balance sheet equation',
    category: 'engine',
    defaultClassification: ok ? undefined : 'legacy_data',
    status: ok ? 'pass' : 'fail',
    failures: ok
      ? []
      : [
          {
            module: 'reports',
            step: 'balance_sheet',
            record: `as_of=${bs.asOfDate}`,
            expected: 'Assets = Liabilities + Equity (incl. net income)',
            actual: `diff=${bs.difference} assets=${bs.totalAssets} L+E=${bs.totalLiabilitiesAndEquity}`,
            classification: 'legacy_data',
            navActions: [{ type: 'accounting', tab: 'accounts', label: 'Accounts' }],
          },
        ],
    meta: {
      totalAssets: bs.totalAssets,
      totalLiabilitiesAndEquity: bs.totalLiabilitiesAndEquity,
      difference: bs.difference,
    },
  };
}

export async function runPnLConsistencyCheck(
  companyId: string,
  branchId?: string | null
): Promise<LabCheckResult> {
  const start = `${new Date().getFullYear()}-01-01`;
  const end = new Date().toISOString().slice(0, 10);
  const pl = await accountingReportsService.getProfitLoss(companyId, start, end, branchId || undefined);
  const derived = pl.grossProfit - pl.expenses.total;
  const ok = Math.abs(derived - pl.netProfit) < 0.02;
  return {
    id: 'pnl_consistency',
    label: 'P&L internal consistency',
    category: 'engine',
    defaultClassification: ok ? undefined : 'engine_bug',
    status: ok ? 'pass' : 'fail',
    failures: ok
      ? []
      : [
          {
            module: 'profit_loss',
            step: 'net_profit',
            record: `${start}..${end}`,
            expected: `netProfit = grossProfit - expenses (${derived})`,
            actual: String(pl.netProfit),
            classification: 'engine_bug',
          },
        ],
    meta: { grossProfit: pl.grossProfit, expenses: pl.expenses.total, netProfit: pl.netProfit },
  };
}

export async function runReceivablesVsARCheck(companyId: string, branchId?: string | null): Promise<LabCheckResult> {
  let saleQuery = supabase
    .from('sales')
    .select('due_amount')
    .eq('company_id', companyId)
    .eq('status', 'final');
  if (branchId && branchId !== 'all') saleQuery = saleQuery.eq('branch_id', branchId);
  const { data: sales } = await saleQuery;
  const sumDue = (sales || []).reduce((a, s: any) => a + (Number(s.due_amount) || 0), 0);

  const { data: arAcc } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .or('code.eq.1100,code.eq.1200,name.ilike.%receivable%')
    .limit(5);

  const arId = (arAcc || []).find((a: any) => String(a.code) === '1100')?.id || (arAcc || [])[0]?.id;
  let arBalance = 0;
  if (arId) {
    const map = await accountingReportsService.getAccountBalancesFromJournal(
      companyId,
      new Date().toISOString().slice(0, 10),
      branchId || undefined
    );
    arBalance = map[arId] ?? 0;
  }

  const diff = Math.round((sumDue - arBalance) * 100) / 100;
  const ok = Math.abs(diff) < 1;
  return {
    id: 'ar_reconcile',
    label: 'Receivables (sales.due) vs AR journal balance',
    category: 'reconciliation',
    defaultClassification: ok ? undefined : 'reconciliation_timing',
    status: ok ? 'pass' : 'warn',
    failures: ok
      ? []
      : [
          {
            module: 'reconciliation',
            step: 'ar',
            record: arId || 'no AR account',
            expected: `≈ sum final sale due_amount (${sumDue})`,
            actual: `AR journal balance ${arBalance} diff=${diff}`,
            classification: 'reconciliation_timing',
            navActions: [
              { type: 'accounting', tab: 'receivables', label: 'Receivables' },
              ...(arId
                ? ([
                    {
                      type: 'accounting' as const,
                      tab: 'ledger' as const,
                      focusAccountId: arId,
                      label: 'Ledger (pick AR)',
                    },
                  ] as LabNavAction[])
                : []),
              { type: 'customer_ledger', label: 'Customer ledger test page' },
            ],
          },
        ],
    meta: { sumDue, arBalance, diff },
  };
}

export async function runPayablesVsAPCheck(companyId: string, branchId?: string | null): Promise<LabCheckResult> {
  let pq = supabase
    .from('purchases')
    .select('due_amount')
    .eq('company_id', companyId)
    .in('status', [...PURCHASE_STATUSES_FOR_PAYABLE_RECONCILIATION]);
  if (branchId && branchId !== 'all') pq = pq.eq('branch_id', branchId);
  const { data: purchases } = await pq;
  const sumDue = (purchases || []).reduce((a, p: any) => a + (Number(p.due_amount) || 0), 0);

  const { data: apAcc } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .or('code.eq.2000,code.eq.2010')
    .limit(3);
  const apId = (apAcc || []).find((a: any) => String(a.code) === '2000')?.id || (apAcc || [])[0]?.id;
  let apBalance = 0;
  if (apId) {
    const map = await accountingReportsService.getAccountBalancesFromJournal(
      companyId,
      new Date().toISOString().slice(0, 10),
      branchId || undefined
    );
    apBalance = Math.abs(map[apId] ?? 0);
  }
  const diff = Math.round((sumDue - apBalance) * 100) / 100;
  const ok = Math.abs(diff) < 1;
  return {
    id: 'ap_reconcile',
    label: 'Payables (purchase due) vs AP journal balance',
    category: 'reconciliation',
    defaultClassification: ok ? undefined : 'reconciliation_timing',
    status: ok ? 'pass' : 'warn',
    failures: ok
      ? []
      : [
          {
            module: 'reconciliation',
            step: 'ap',
            record: apId || 'no AP account',
            expected: `≈ sum purchase due (${sumDue})`,
            actual: `AP abs balance ${apBalance} diff=${diff}`,
            classification: 'reconciliation_timing',
            navActions: [
              { type: 'accounting', tab: 'payables', label: 'Payables' },
              { type: 'supplier_ledger', label: 'Supplier context' },
            ],
          },
        ],
    meta: { sumDue, apBalance, diff },
  };
}

export async function runInventoryValuationVsStockCheck(companyId: string): Promise<LabCheckResult> {
  const { data: invAcc } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('code', '1200')
    .maybeSingle();
  const map = await accountingReportsService.getAccountBalancesFromJournal(
    companyId,
    new Date().toISOString().slice(0, 10)
  );
  const invGl = invAcc?.id ? map[invAcc.id] ?? 0 : 0;

  const { data: mov } = await supabase
    .from('stock_movements')
    .select('quantity, unit_cost, total_cost')
    .eq('company_id', companyId)
    .limit(5000);
  let movValue = 0;
  (mov || []).forEach((m: any) => {
    const tc = Number(m.total_cost);
    if (!Number.isNaN(tc) && tc !== 0) movValue += tc;
    else movValue += (Number(m.quantity) || 0) * (Number(m.unit_cost) || 0);
  });

  return {
    id: 'inventory_vs_movements',
    label: 'Inventory GL (1200) vs movement cost heuristic',
    category: 'reconciliation',
    defaultClassification: 'informational',
    status: 'warn',
    failures: [
      {
        module: 'inventory',
        step: 'compare',
        record: 'heuristic only',
        expected: 'Use Reports → Inventory Valuation',
        actual: `GL(1200)~${invGl} heuristic_move_sum~${Math.round(movValue * 100) / 100}`,
        classification: 'informational',
        navActions: [{ type: 'accounting', tab: 'accounts', label: 'Accounts (1200)' }],
      },
    ],
    meta: { invGlBalance: invGl, movementHeuristic: movValue },
  };
}

export async function runAccountsVsJournalCheck(companyId: string): Promise<LabCheckResult> {
  let accounts: any[] | null = null;
  const sel = await supabase
    .from('accounts')
    .select('id, code, name, balance')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .limit(200);
  if (sel.error?.message?.includes('balance') || sel.error?.code === '42703') {
    const alt = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .limit(200);
    accounts = alt.data;
  } else {
    accounts = sel.data;
  }

  const journalMap = await accountingReportsService.getAccountBalancesFromJournal(
    companyId,
    new Date().toISOString().slice(0, 10)
  );

  const failures: LabCheckFailure[] = [];
  let compared = 0;
  const hasBalanceColumn = (accounts || []).some((a: any) => 'balance' in a && (a as any).balance != null);
  if (!hasBalanceColumn) {
    return {
      id: 'accounts_vs_journal',
      label: 'accounts.balance vs journal-derived balance',
      category: 'data_quality',
      status: 'skip',
      failures: [],
      meta: { note: 'accounts.balance column not available — skipped' },
    };
  }
  for (const a of accounts || []) {
    const jid = (a as any).id;
    const colBal = Number((a as any).balance ?? 0) || 0;
    const jBal = journalMap[jid];
    if (jBal === undefined) continue;
    compared++;
    if (Math.abs(colBal - jBal) > 0.02) {
      failures.push({
        module: 'accounts',
        step: 'balance_column_vs_journal',
        record: `accounts.id=${jid} code=${(a as any).code}`,
        expected: String(jBal),
        actual: String(colBal),
        classification: 'missing_backfill',
        navActions: [
          {
            type: 'accounting',
            tab: 'accounts',
            focusAccountId: jid,
            label: 'Accounts',
          },
          { type: 'copy', text: jid, label: 'Copy account id' },
        ],
      });
    }
  }
  return {
    id: 'accounts_vs_journal',
    label: 'accounts.balance vs journal-derived balance',
    category: 'data_quality',
    defaultClassification: failures.length ? 'missing_backfill' : undefined,
    status: failures.length === 0 ? 'pass' : 'warn',
    failures,
    meta: { compared },
  };
}

function unbalancedCheckResult(unbalanced: JournalBalanceRow[]): LabCheckResult {
  return {
    id: 'je_balance',
    label: 'Every journal entry balanced',
    category: 'engine',
    defaultClassification: unbalanced.length ? 'engine_bug' : undefined,
    status: unbalanced.length === 0 ? 'pass' : 'fail',
    failures: unbalanced.map((u) => ({
      module: 'journal_entries',
      step: 'line_totals',
      record: u.journal_entry_id,
      expected: 'debit === credit',
      actual: `debit=${u.total_debit} credit=${u.total_credit} diff=${u.diff} ref=${u.reference_type}/${u.reference_id}`,
      classification: (u.reference_type === 'sale' || u.reference_type === 'purchase' ? 'engine_bug' : 'legacy_data') as WarningClassification,
      navActions: navForUnbalancedRow(u),
    })),
    meta: { count: unbalanced.length },
  };
}

const tagCompany = (r: LabCheckResult): LabCheckResult => ({ ...r, checkLayer: 'company' });
const tagDocument = (r: LabCheckResult): LabCheckResult => ({ ...r, checkLayer: 'document' });

/**
 * Whole company / legacy-aware reconciliation. TB/BS/P&L/AR/AP/inventory/accounts balance + posting-gate sample.
 * Does NOT belong in the “action just succeeded” path — run manually or from Reports tab.
 */
export async function runCompanyReconciliationChecks(
  companyId: string,
  branchId?: string | null
): Promise<LabCheckResult[]> {
  const unbalanced = await findUnbalancedJournalEntries(companyId, branchId);
  const paymentLink = await findPaymentsMissingJournalLink(companyId, 80);

  return [
    tagCompany(unbalancedCheckResult(unbalanced)),
    tagCompany(paymentLink),
    tagCompany(await runTrialBalanceCheck(companyId, branchId)),
    tagCompany(await runBalanceSheetCheck(companyId, branchId)),
    tagCompany(await runPnLConsistencyCheck(companyId, branchId)),
    tagCompany(await runReceivablesVsARCheck(companyId, branchId)),
    tagCompany(await runPayablesVsAPCheck(companyId, branchId)),
    tagCompany(await runInventoryValuationVsStockCheck(companyId)),
    tagCompany(await runAccountsVsJournalCheck(companyId)),
    tagCompany(await runPostingStatusGateLiveCheck(companyId)),
    tagCompany(await runOwnerEquityCapitalVisibilityCheck(companyId)),
  ];
}

/** @deprecated Use `runCompanyReconciliationChecks` (same behavior, tagged `checkLayer: company`). */
export async function runAllReconciliationChecks(
  companyId: string,
  branchId?: string | null
): Promise<LabCheckResult[]> {
  return runCompanyReconciliationChecks(companyId, branchId);
}

/**
 * Posted doc: each payment with amount &gt; 0 should have at least one non-void JE with payment_id set.
 */
async function runDocumentPaymentJournalLinkCheck(
  companyId: string,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult> {
  const failures: LabCheckFailure[] = [];

  const checkSide = async (refType: 'sale' | 'purchase', docId: string, status: string | undefined) => {
    const posted =
      refType === 'sale'
        ? canPostAccountingForSaleStatus(status)
        : canPostAccountingForPurchaseStatus(status);
    if (!posted) return;

    const { data: pays } = await supabase
      .from('payments')
      .select('id, amount')
      .eq('reference_type', refType)
      .eq('reference_id', docId);
    for (const p of pays || []) {
      const amt = Number((p as any).amount) || 0;
      if (amt <= 0.01) continue;
      const { count } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('payment_id', (p as { id: string }).id)
        .or('is_void.is.null,is_void.eq.false');
      if ((count ?? 0) < 1) {
        failures.push({
          module: 'payments',
          step: 'payment_je_link',
          record: `payments.id=${(p as { id: string }).id}`,
          expected: '≥1 active journal_entries row with payment_id for posted doc payment',
          actual: `linked_je_count=${count ?? 0}`,
          classification: 'source_link',
          navActions:
            refType === 'sale'
              ? [{ type: 'sale', saleId: docId, label: 'Open sale' }]
              : [{ type: 'purchase', purchaseId: docId, label: 'Open purchase' }],
        });
      }
    }
  };

  if (opts.saleId) {
    const { data: sale } = await supabase.from('sales').select('status').eq('id', opts.saleId).maybeSingle();
    await checkSide('sale', opts.saleId, (sale as any)?.status);
  }
  if (opts.purchaseId) {
    const { data: pur } = await supabase.from('purchases').select('status').eq('id', opts.purchaseId).maybeSingle();
    await checkSide('purchase', opts.purchaseId, (pur as any)?.status);
  }

  return {
    id: 'doc_cert_payment_je_link',
    label: 'Document cert: payments ↔ JE (posted docs)',
    category: 'engine',
    defaultClassification: failures.length ? 'source_link' : undefined,
    status: failures.length === 0 ? 'pass' : 'warn',
    failures,
    meta: { saleId: opts.saleId, purchaseId: opts.purchaseId },
  };
}

async function runDocumentTotalsConsistencyCheck(
  companyId: string,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult[]> {
  const out: LabCheckResult[] = [];

  if (opts.saleId) {
    const { data: s } = await supabase
      .from('sales')
      .select('total, paid_amount, due_amount, status, id')
      .eq('id', opts.saleId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (s) {
      const st = String((s as any).status || '').toLowerCase();
      const total = Number((s as any).total) || 0;
      const paid = Number((s as any).paid_amount) || 0;
      const due = Number((s as any).due_amount) || 0;
      const ok = st === 'cancelled' || Math.abs(total - paid - due) < 0.02;
      out.push({
        id: 'doc_cert_sale_totals',
        label: 'Document cert: sale total = paid + due',
        category: 'engine',
        status: ok ? 'pass' : 'warn',
        failures: ok
          ? []
          : [
              {
                module: 'sales',
                step: 'totals',
                record: opts.saleId,
                expected: `total≈paid+due (${total} vs ${paid + due})`,
                actual: `total=${total} paid=${paid} due=${due}`,
                classification: 'engine_bug',
                navActions: [{ type: 'sale', saleId: opts.saleId, label: 'Open sale' }],
              },
            ],
        meta: { total, paid, due, status: st },
      });
    }
  }

  if (opts.purchaseId) {
    const { data: p } = await supabase
      .from('purchases')
      .select('total, paid_amount, due_amount, status, id')
      .eq('id', opts.purchaseId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (p) {
      const st = String((p as any).status || '').toLowerCase();
      const total = Number((p as any).total) || 0;
      const paid = Number((p as any).paid_amount) || 0;
      const due = Number((p as any).due_amount) || 0;
      const ok = st === 'cancelled' || Math.abs(total - paid - due) < 0.02;
      out.push({
        id: 'doc_cert_purchase_totals',
        label: 'Document cert: purchase total = paid + due',
        category: 'engine',
        status: ok ? 'pass' : 'warn',
        failures: ok
          ? []
          : [
              {
                module: 'purchases',
                step: 'totals',
                record: opts.purchaseId,
                expected: `total≈paid+due (${total} vs ${paid + due})`,
                actual: `total=${total} paid=${paid} due=${due}`,
                classification: 'engine_bug',
                navActions: [{ type: 'purchase', purchaseId: opts.purchaseId, label: 'Open purchase' }],
              },
            ],
        meta: { total, paid, due, status: st },
      });
    }
  }

  return out;
}

/**
 * Document certification: selected sale/purchase only — posting gate, scoped JE balance, payments vs header, totals, payment↔JE for posted docs.
 * Does not run TB/BS/AR/AP/company inventory heuristics.
 */
export async function runDocumentCertificationChecks(
  companyId: string,
  branchId: string | null | undefined,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult[]> {
  if (!opts.saleId && !opts.purchaseId) {
    return [
      tagDocument({
        id: 'doc_cert_scope',
        label: 'Document certification: scope',
        category: 'engine',
        defaultClassification: 'informational',
        status: 'skip',
        failures: [],
        meta: { hint: 'Select a sale or purchase to certify the current document workflow.' },
      }),
    ];
  }

  const scoped = await findUnbalancedJournalEntriesForDocument(companyId, branchId, opts);
  const ub = unbalancedCheckResult(scoped);
  const results: LabCheckResult[] = [
    tagDocument({
      ...ub,
      label: 'Document cert: balanced JEs (this doc + its payments only)',
    }),
  ];

  if (opts.saleId) {
    const { data: sale } = await supabase
      .from('sales')
      .select('paid_amount, id, status')
      .eq('id', opts.saleId)
      .single();
    const { data: pays } = await supabase
      .from('payments')
      .select('amount')
      .eq('reference_type', 'sale')
      .eq('reference_id', opts.saleId);
    const sumPay = (pays || []).reduce((a, p: any) => a + (Number(p.amount) || 0), 0);
    const paid = Number((sale as any)?.paid_amount) || 0;
    const ok = Math.abs(sumPay - paid) < 0.02;
    results.push(
      tagDocument({
        id: 'doc_cert_sale_payments_vs_paid',
        label: 'Document cert: Σ payments vs sales.paid_amount',
        category: 'engine',
        status: ok ? 'pass' : 'warn',
        failures: ok
          ? []
          : [
              {
                module: 'sales',
                step: 'paid_amount',
                record: opts.saleId,
                expected: `sum(payments)=${sumPay}`,
                actual: `paid_amount=${paid}`,
                classification: 'engine_bug',
                navActions: [{ type: 'sale', saleId: opts.saleId, label: 'Open sale' }],
              },
            ],
        meta: { sumPay, paid },
      })
    );
  }

  if (opts.purchaseId) {
    const { data: pur } = await supabase
      .from('purchases')
      .select('paid_amount, id')
      .eq('id', opts.purchaseId)
      .single();
    const { data: pays } = await supabase
      .from('payments')
      .select('amount')
      .eq('reference_type', 'purchase')
      .eq('reference_id', opts.purchaseId);
    const sumPay = (pays || []).reduce((a, p: any) => a + (Number(p.amount) || 0), 0);
    const paid = Number((pur as any)?.paid_amount) || 0;
    const ok = Math.abs(sumPay - paid) < 0.02;
    results.push(
      tagDocument({
        id: 'doc_cert_purchase_payments_vs_paid',
        label: 'Document cert: Σ payments vs purchases.paid_amount',
        category: 'engine',
        status: ok ? 'pass' : 'warn',
        failures: ok
          ? []
          : [
              {
                module: 'purchases',
                step: 'paid_amount',
                record: opts.purchaseId,
                expected: `sum(payments)=${sumPay}`,
                actual: `paid_amount=${paid}`,
                classification: 'engine_bug',
                navActions: [{ type: 'purchase', purchaseId: opts.purchaseId, label: 'Open purchase' }],
              },
            ],
        meta: { sumPay, paid },
      })
    );
  }

  for (const r of await runDocumentTotalsConsistencyCheck(companyId, opts)) {
    results.push(tagDocument(r));
  }

  results.push(tagDocument(await runDocumentPaymentJournalLinkCheck(companyId, opts)));
  results.push(tagDocument(await runPostingStatusGateFreshCheck(companyId, opts)));
  return results;
}

/**
 * @deprecated Use `runDocumentCertificationChecks` (same behavior: document-scoped only, tagged `checkLayer: document`).
 */
export async function runFreshScenarioChecks(
  companyId: string,
  branchId: string | null | undefined,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult[]> {
  return runDocumentCertificationChecks(companyId, branchId, opts);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isJeActive(j: { is_void?: boolean | null }): boolean {
  return j.is_void !== true;
}

/**
 * Live: sample non-posted sales/purchases — must not have document JEs, reversals (sales), or stock_movements by reference.
 */
export async function runPostingStatusGateLiveCheck(companyId: string): Promise<LabCheckResult> {
  const failures: LabCheckFailure[] = [];
  const convSchema = await getDocumentConversionSchemaFlags();

  let nonFinalSales: { id: string; status?: string }[] | null = null;
  {
    let q1 = supabase
      .from('sales')
      .select('id, status')
      .eq('company_id', companyId)
      .in('status', [...SALE_BUSINESS_ONLY_STATUSES])
      .limit(200);
    if (convSchema.salesConvertedColumn) q1 = q1.eq('converted', false);
    const r1 = await q1;
    if (r1.error && convSchema.salesConvertedColumn) {
      const q2 = await supabase
        .from('sales')
        .select('id, status')
        .eq('company_id', companyId)
        .in('status', [...SALE_BUSINESS_ONLY_STATUSES])
        .limit(200);
      nonFinalSales = q2.error ? [] : q2.data;
    } else if (r1.error) {
      nonFinalSales = [];
    } else {
      nonFinalSales = r1.data;
    }
  }
  const saleIds = (nonFinalSales || []).map((r: { id: string }) => r.id).filter(Boolean);

  for (const batch of chunkArray(saleIds, 80)) {
    if (!batch.length) continue;
    const { data: saleJes } = await supabase
      .from('journal_entries')
      .select('id, reference_id, is_void, payment_id')
      .eq('reference_type', 'sale')
      .in('reference_id', batch)
      .is('payment_id', null);
    for (const je of saleJes || []) {
      if (!isJeActive(je as { is_void?: boolean })) continue;
      failures.push({
        module: 'posting_gate',
        step: 'non_posted_sale_has_sale_je',
        record: (je as { id: string }).id,
        expected: 'no active canonical document journal_entries for draft/quotation/order sale',
        actual: `sale_id=${(je as { reference_id: string }).reference_id}`,
        classification: 'engine_bug',
        navActions: [
          { type: 'sale', saleId: (je as { reference_id: string }).reference_id, label: 'Open sale' },
        ],
      });
    }
    const { data: revJes } = await supabase
      .from('journal_entries')
      .select('id, reference_id, is_void')
      .eq('reference_type', 'sale_reversal')
      .in('reference_id', batch);
    for (const je of revJes || []) {
      if (!isJeActive(je as { is_void?: boolean })) continue;
      failures.push({
        module: 'posting_gate',
        step: 'non_posted_sale_has_reversal_je',
        record: (je as { id: string }).id,
        expected: 'no sale_reversal JE for draft/quotation/order (nothing posted)',
        actual: `sale_id=${(je as { reference_id: string }).reference_id}`,
        classification: 'engine_bug',
        navActions: [
          { type: 'sale', saleId: (je as { reference_id: string }).reference_id, label: 'Open sale' },
        ],
      });
    }
    for (const sid of batch) {
      const { count } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('reference_type', 'sale')
        .eq('reference_id', sid);
      if ((count ?? 0) > 0) {
        failures.push({
          module: 'posting_gate',
          step: 'non_posted_sale_has_stock',
          record: sid,
          expected: 'no stock_movements for draft/quotation/order sale',
          actual: `movement_count=${count}`,
          classification: 'engine_bug',
          navActions: [{ type: 'sale', saleId: sid, label: 'Open sale' }],
        });
      }
    }
  }

  let nonPostedPurchases: { id: string; status?: string }[] | null = null;
  {
    let q1 = supabase
      .from('purchases')
      .select('id, status')
      .eq('company_id', companyId)
      .in('status', [...PURCHASE_BUSINESS_ONLY_STATUSES])
      .limit(200);
    if (convSchema.purchasesConvertedColumn) q1 = q1.eq('converted', false);
    const r1 = await q1;
    if (r1.error && convSchema.purchasesConvertedColumn) {
      const q2 = await supabase
        .from('purchases')
        .select('id, status')
        .eq('company_id', companyId)
        .in('status', [...PURCHASE_BUSINESS_ONLY_STATUSES])
        .limit(200);
      nonPostedPurchases = q2.error ? [] : q2.data;
    } else if (r1.error) {
      nonPostedPurchases = [];
    } else {
      nonPostedPurchases = r1.data;
    }
  }
  const purIds = (nonPostedPurchases || []).map((r: { id: string }) => r.id).filter(Boolean);

  for (const batch of chunkArray(purIds, 80)) {
    if (!batch.length) continue;
    const { data: purJes } = await supabase
      .from('journal_entries')
      .select('id, reference_id, is_void, payment_id')
      .eq('reference_type', 'purchase')
      .in('reference_id', batch)
      .is('payment_id', null);
    for (const je of purJes || []) {
      if (!isJeActive(je as { is_void?: boolean })) continue;
      failures.push({
        module: 'posting_gate',
        step: 'non_posted_purchase_has_purchase_je',
        record: (je as { id: string }).id,
        expected: 'no active canonical purchase document journal_entries for draft/ordered purchase',
        actual: `purchase_id=${(je as { reference_id: string }).reference_id}`,
        classification: 'engine_bug',
        navActions: [
          {
            type: 'purchase',
            purchaseId: (je as { reference_id: string }).reference_id,
            label: 'Open purchase',
          },
        ],
      });
    }
    for (const pid of batch) {
      const { count } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('reference_type', 'purchase')
        .eq('reference_id', pid);
      if ((count ?? 0) > 0) {
        failures.push({
          module: 'posting_gate',
          step: 'non_posted_purchase_has_stock',
          record: pid,
          expected: 'no stock_movements for draft/ordered purchase',
          actual: `movement_count=${count}`,
          classification: 'engine_bug',
          navActions: [{ type: 'purchase', purchaseId: pid, label: 'Open purchase' }],
        });
      }
    }
  }

  return {
    id: 'posting_status_gate_live',
    label: 'Posting gate: non-posted docs have no GL/stock (sample)',
    category: 'engine',
    defaultClassification: failures.length ? 'engine_bug' : undefined,
    status: failures.length === 0 ? 'pass' : 'fail',
    failures,
    meta: { salesSampled: saleIds.length, purchasesSampled: purIds.length },
  };
}

/**
 * Fresh: selected sale or purchase must match posting rules (no side effects until posted).
 */
export async function runPostingStatusGateFreshCheck(
  companyId: string,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult> {
  const failures: LabCheckFailure[] = [];

  if (opts.saleId) {
    const { data: row } = await supabase
      .from('sales')
      .select('id, status, total, invoice_no')
      .eq('id', opts.saleId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!row) {
      return {
        id: 'fresh_posting_gate_sale',
        label: 'Fresh: posting gate (sale)',
        category: 'engine',
        status: 'skip',
        failures: [],
        meta: { reason: 'Sale not found for company' },
      };
    }

    const st = (row as { status?: string }).status;
    // Canonical document JEs only: payment receipts use reference_type=sale + payment_id (DB trigger).
    const canonicalSaleJeIds = await listActiveCanonicalSaleDocumentJournalEntryIds(opts.saleId);
    const activeSaleJes = canonicalSaleJeIds.map((id) => ({ id, is_void: false as const }));

    const { data: revJes } = await supabase
      .from('journal_entries')
      .select('id, is_void')
      .eq('reference_type', 'sale_reversal')
      .eq('reference_id', opts.saleId);
    const activeRev = (revJes || []).filter((j) => isJeActive(j as { is_void?: boolean }));

    const { count: stockCount } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('reference_type', 'sale')
      .eq('reference_id', opts.saleId);

    if (!canPostAccountingForSaleStatus(st)) {
      if (activeSaleJes.length > 0) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_non_posted_sale_je',
          record: opts.saleId,
          expected: 'no document sale JE',
          actual: `active_je_count=${activeSaleJes.length}`,
          classification: 'engine_bug',
          navActions: [{ type: 'sale', saleId: opts.saleId, label: 'Open sale' }],
        });
      }
      if (activeRev.length > 0) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_non_posted_sale_reversal',
          record: opts.saleId,
          expected: 'no sale_reversal JE',
          actual: `active_reversal_count=${activeRev.length}`,
          classification: 'engine_bug',
          navActions: [{ type: 'sale', saleId: opts.saleId, label: 'Open sale' }],
        });
      }
      if ((stockCount ?? 0) > 0) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_non_posted_sale_stock',
          record: opts.saleId,
          expected: 'no stock_movements',
          actual: `count=${stockCount}`,
          classification: 'engine_bug',
          navActions: [{ type: 'sale', saleId: opts.saleId, label: 'Open sale' }],
        });
      }
    } else {
      const total = Number((row as { total?: number }).total) || 0;
      if (total > 0 && activeSaleJes.length === 0) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_posted_sale_missing_je',
          record: opts.saleId,
          expected: 'at least one active document sale JE when total > 0',
          actual: 'active_je_count=0',
          classification: 'missing_backfill',
          navActions: [{ type: 'sale', saleId: opts.saleId, label: 'Open sale' }],
        });
      }
      if (total > 0 && activeSaleJes.length > 1) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_posted_sale_duplicate_je',
          record: opts.saleId,
          expected: 'single canonical document sale JE (excl. void)',
          actual: `active_je_count=${activeSaleJes.length}`,
          classification: 'engine_bug',
          navActions: [{ type: 'sale', saleId: opts.saleId, label: 'Open sale' }],
        });
      }
      const invNo = String((row as { invoice_no?: string }).invoice_no ?? '').trim();
      if (!invNo) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_posted_sale_missing_invoice_no',
          record: opts.saleId,
          expected: 'invoice_no set when status=final (same-row lifecycle)',
          actual: '(empty)',
          classification: 'engine_bug',
          navActions: [{ type: 'sale', saleId: opts.saleId, label: 'Open sale' }],
        });
      }
    }
  }

  if (opts.purchaseId) {
    const { data: row } = await supabase
      .from('purchases')
      .select('id, status, total, po_no')
      .eq('id', opts.purchaseId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!row) {
      return {
        id: 'fresh_posting_gate_purchase',
        label: 'Fresh: posting gate (purchase)',
        category: 'engine',
        status: 'skip',
        failures: [],
        meta: { reason: 'Purchase not found for company' },
      };
    }

    const st = (row as { status?: string }).status;
    const canonicalPurJeIds = await listActiveCanonicalPurchaseDocumentJournalEntryIds(opts.purchaseId);
    const activePurJes = canonicalPurJeIds.map((id) => ({ id, is_void: false as const }));

    const { count: stockCount } = await supabase
      .from('stock_movements')
      .select('*', { count: 'exact', head: true })
      .eq('reference_type', 'purchase')
      .eq('reference_id', opts.purchaseId);

    if (!canPostAccountingForPurchaseStatus(st)) {
      if (activePurJes.length > 0) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_non_posted_purchase_je',
          record: opts.purchaseId,
          expected: 'no document purchase JE',
          actual: `active_je_count=${activePurJes.length}`,
          classification: 'engine_bug',
          navActions: [{ type: 'purchase', purchaseId: opts.purchaseId, label: 'Open purchase' }],
        });
      }
      if ((stockCount ?? 0) > 0) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_non_posted_purchase_stock',
          record: opts.purchaseId,
          expected: 'no stock_movements',
          actual: `count=${stockCount}`,
          classification: 'engine_bug',
          navActions: [{ type: 'purchase', purchaseId: opts.purchaseId, label: 'Open purchase' }],
        });
      }
    } else {
      const total = Number((row as { total?: number }).total) || 0;
      if (total > 0 && activePurJes.length === 0) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_posted_purchase_missing_je',
          record: opts.purchaseId,
          expected: 'at least one active document purchase JE when total > 0',
          actual: 'active_je_count=0',
          classification: 'missing_backfill',
          navActions: [{ type: 'purchase', purchaseId: opts.purchaseId, label: 'Open purchase' }],
        });
      }
      if (total > 0 && activePurJes.length > 1) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_posted_purchase_duplicate_je',
          record: opts.purchaseId,
          expected: 'single canonical document purchase JE (excl. void; adjustments use other ref types)',
          actual: `active_je_count=${activePurJes.length}`,
          classification: 'engine_bug',
          navActions: [{ type: 'purchase', purchaseId: opts.purchaseId, label: 'Open purchase' }],
        });
      }
      const po = String((row as { po_no?: string }).po_no ?? '').trim();
      if (!po) {
        failures.push({
          module: 'posting_gate',
          step: 'fresh_posted_purchase_missing_po_no',
          record: opts.purchaseId,
          expected: 'po_no set when status is final/received',
          actual: '(empty)',
          classification: 'engine_bug',
          navActions: [{ type: 'purchase', purchaseId: opts.purchaseId, label: 'Open purchase' }],
        });
      }
    }
  }

  const id = opts.saleId ? 'fresh_posting_gate_sale' : 'fresh_posting_gate_purchase';
  return {
    id,
    label: opts.saleId ? 'Fresh: posting gate (sale)' : 'Fresh: posting gate (purchase)',
    category: 'engine',
    defaultClassification: failures.length ? 'engine_bug' : undefined,
    status: failures.length === 0 ? 'pass' : 'fail',
    failures,
    meta: { saleId: opts.saleId, purchaseId: opts.purchaseId },
  };
}

export function snapshotToComparableJson(s: unknown): string {
  if (s == null) return 'null';
  return JSON.stringify(s, null, 2);
}

// =============================================================================
// Phase: Module certification (document-scoped) — stock, COA, payment isolation
// =============================================================================

function normMovementType(t: unknown): string {
  return String(t ?? '')
    .trim()
    .toLowerCase();
}

function stockLineKey(productId: string, variationId: string | null | undefined): string {
  return `${productId}|${variationId ?? ''}`;
}

async function fetchSaleLineItemsForLab(saleId: string) {
  let { data } = await supabase.from('sales_items').select('product_id, variation_id, quantity').eq('sale_id', saleId);
  if (!data?.length) {
    const r2 = await supabase.from('sale_items').select('product_id, variation_id, quantity').eq('sale_id', saleId);
    data = r2.data;
  }
  return data || [];
}

async function fetchPurchaseLineItemsForLab(purchaseId: string) {
  const { data } = await supabase
    .from('purchase_items')
    .select('product_id, variation_id, quantity')
    .eq('purchase_id', purchaseId);
  return data || [];
}

/** Stock movement rules for the selected sale or purchase (document workflow). */
export async function runModuleStockCertification(
  companyId: string,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult> {
  const failures: LabCheckFailure[] = [];

  if (opts.saleId) {
    const { data: sale } = await supabase
      .from('sales')
      .select('id, status, total, invoice_no')
      .eq('id', opts.saleId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!sale) {
      failures.push({
        module: 'stock',
        step: 'sale_not_found',
        record: opts.saleId,
        expected: 'sale row for company',
        actual: 'not found',
        classification: 'informational',
        navActions: [{ type: 'sale', saleId: opts.saleId }],
      });
    } else {
    const st = (sale as { status?: string }).status;
    const { data: movs } = await supabase
      .from('stock_movements')
      .select('movement_type')
      .eq('reference_type', 'sale')
      .eq('reference_id', opts.saleId);
    const types = (movs || []).map((m: { movement_type?: string }) => normMovementType(m.movement_type));
    const postedStock = canPostStockForSaleStatus(st);

    if (!postedStock) {
      if ((movs?.length ?? 0) > 0) {
        failures.push({
          module: 'stock',
          step: 'draft_sale_has_stock',
          record: opts.saleId,
          expected: '0 stock_movements for draft/quotation/order',
          actual: `count=${movs?.length}`,
          classification: 'engine_bug',
          navActions: [{ type: 'sale', saleId: opts.saleId }],
        });
      }
    } else if (String(st).toLowerCase() === 'cancelled') {
      const rev = types.filter((t) => t === 'sale_cancelled').length;
      const fwd = types.filter((t) => t === 'sale').length;
      if (fwd > 0 && rev !== fwd) {
        failures.push({
          module: 'stock',
          step: 'cancelled_sale_reversal_count',
          record: opts.saleId,
          expected: `SALE_CANCELLED rows match prior sale rows (${fwd})`,
          actual: `sale=${fwd}, sale_cancelled=${rev}`,
          classification: 'engine_bug',
          navActions: [{ type: 'sale', saleId: opts.saleId }],
        });
      }
    } else {
      const out = types.filter((t) => t === 'sale').length;
      if (out < 1 && Number((sale as { total?: number }).total) > 0) {
        failures.push({
          module: 'stock',
          step: 'final_sale_missing_stock_out',
          record: opts.saleId,
          expected: 'at least one movement_type=sale when posted',
          actual: `sale_movements=${out}`,
          classification: 'missing_backfill',
          navActions: [{ type: 'sale', saleId: opts.saleId }],
        });
      }
      // Variation / line qty vs stock OUT (movement qty negative)
      const lines = await fetchSaleLineItemsForLab(opts.saleId);
      if (lines.length > 0 && out >= 1) {
        const { data: sm } = await supabase
          .from('stock_movements')
          .select('product_id, variation_id, quantity, movement_type')
          .eq('reference_type', 'sale')
          .eq('reference_id', opts.saleId);
        const lineMap = new Map<string, number>();
        for (const row of lines) {
          const pid = String((row as { product_id?: string }).product_id ?? '');
          const vid = (row as { variation_id?: string | null }).variation_id ?? null;
          const k = stockLineKey(pid, vid);
          lineMap.set(k, (lineMap.get(k) ?? 0) + Math.abs(Number((row as { quantity?: number }).quantity) || 0));
        }
        const movMap = new Map<string, number>();
        for (const m of sm || []) {
          if (normMovementType((m as { movement_type?: string }).movement_type) !== 'sale') continue;
          const pid = String((m as { product_id?: string }).product_id ?? '');
          const vid = (m as { variation_id?: string | null }).variation_id ?? null;
          const k = stockLineKey(pid, vid);
          movMap.set(k, (movMap.get(k) ?? 0) + Number((m as { quantity?: number }).quantity) || 0);
        }
        for (const [k, lineQty] of lineMap) {
          const movSum = movMap.get(k);
          if (movSum == null) {
            failures.push({
              module: 'stock',
              step: 'sale_line_missing_stock_movement',
              record: `${opts.saleId}:${k}`,
              expected: `movement for product|variation ${k}`,
              actual: 'none',
              classification: 'engine_bug',
              navActions: [{ type: 'sale', saleId: opts.saleId }],
            });
            continue;
          }
          if (Math.abs(movSum + lineQty) > 0.0001) {
            failures.push({
              module: 'stock',
              step: 'sale_line_qty_vs_movement',
              record: `${opts.saleId}:${k}`,
              expected: `sum(movement qty)=-${lineQty} (stock out)`,
              actual: `lineQty=${lineQty}, movementSum=${movSum}`,
              classification: 'engine_bug',
              navActions: [{ type: 'sale', saleId: opts.saleId }],
            });
          }
        }
      }
    }
    }
  }

  if (opts.purchaseId) {
    const { data: pur } = await supabase
      .from('purchases')
      .select('id, status, total')
      .eq('id', opts.purchaseId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!pur) {
      failures.push({
        module: 'stock',
        step: 'purchase_not_found',
        record: opts.purchaseId,
        expected: 'purchase row for company',
        actual: 'not found',
        classification: 'informational',
        navActions: [{ type: 'purchase', purchaseId: opts.purchaseId }],
      });
    } else {
    const st = (pur as { status?: string }).status;
    const { data: movs } = await supabase
      .from('stock_movements')
      .select('movement_type')
      .eq('reference_type', 'purchase')
      .eq('reference_id', opts.purchaseId);
    const types = (movs || []).map((m: { movement_type?: string }) => normMovementType(m.movement_type));
    const posted = canPostStockForPurchaseStatus(st);

    if (!posted) {
      if ((movs?.length ?? 0) > 0) {
        failures.push({
          module: 'stock',
          step: 'draft_purchase_has_stock',
          record: opts.purchaseId,
          expected: '0 stock_movements for draft/ordered',
          actual: `count=${movs?.length}`,
          classification: 'engine_bug',
          navActions: [{ type: 'purchase', purchaseId: opts.purchaseId }],
        });
      }
    } else if (String(st).toLowerCase() === 'cancelled') {
      const rev = types.filter((t) => t === 'purchase_cancelled').length;
      const fwd = types.filter((t) => t === 'purchase').length;
      if (fwd > 0 && rev !== fwd) {
        failures.push({
          module: 'stock',
          step: 'cancelled_purchase_reversal_count',
          record: opts.purchaseId,
          expected: `PURCHASE_CANCELLED rows match prior purchase rows (${fwd})`,
          actual: `purchase=${fwd}, purchase_cancelled=${rev}`,
          classification: 'engine_bug',
          navActions: [{ type: 'purchase', purchaseId: opts.purchaseId }],
        });
      }
    } else {
      const inn = types.filter((t) => t === 'purchase').length;
      if (inn < 1 && Number((pur as { total?: number }).total) > 0) {
        failures.push({
          module: 'stock',
          step: 'posted_purchase_missing_stock_in',
          record: opts.purchaseId,
          expected: 'at least one movement_type=purchase when posted',
          actual: `purchase_movements=${inn}`,
          classification: 'missing_backfill',
          navActions: [{ type: 'purchase', purchaseId: opts.purchaseId }],
        });
      }
      const lines = await fetchPurchaseLineItemsForLab(opts.purchaseId);
      if (lines.length > 0 && inn >= 1) {
        const { data: sm } = await supabase
          .from('stock_movements')
          .select('product_id, variation_id, quantity, movement_type')
          .eq('reference_type', 'purchase')
          .eq('reference_id', opts.purchaseId);
        const lineMap = new Map<string, number>();
        for (const row of lines) {
          const pid = String((row as { product_id?: string }).product_id ?? '');
          const vid = (row as { variation_id?: string | null }).variation_id ?? null;
          const k = stockLineKey(pid, vid);
          lineMap.set(k, (lineMap.get(k) ?? 0) + Math.abs(Number((row as { quantity?: number }).quantity) || 0));
        }
        const movMap = new Map<string, number>();
        for (const m of sm || []) {
          if (normMovementType((m as { movement_type?: string }).movement_type) !== 'purchase') continue;
          const pid = String((m as { product_id?: string }).product_id ?? '');
          const vid = (m as { variation_id?: string | null }).variation_id ?? null;
          const k = stockLineKey(pid, vid);
          movMap.set(k, (movMap.get(k) ?? 0) + Number((m as { quantity?: number }).quantity) || 0);
        }
        for (const [k, lineQty] of lineMap) {
          const movSum = movMap.get(k);
          if (movSum == null) {
            failures.push({
              module: 'stock',
              step: 'purchase_line_missing_stock_movement',
              record: `${opts.purchaseId}:${k}`,
              expected: `movement for product|variation ${k}`,
              actual: 'none',
              classification: 'engine_bug',
              navActions: [{ type: 'purchase', purchaseId: opts.purchaseId }],
            });
            continue;
          }
          if (Math.abs(movSum - lineQty) > 0.0001) {
            failures.push({
              module: 'stock',
              step: 'purchase_line_qty_vs_movement',
              record: `${opts.purchaseId}:${k}`,
              expected: `sum(movement qty)=${lineQty} (stock in)`,
              actual: `lineQty=${lineQty}, movementSum=${movSum}`,
              classification: 'engine_bug',
              navActions: [{ type: 'purchase', purchaseId: opts.purchaseId }],
            });
          }
        }
      }
    }
    }
  }

  return {
    id: 'module_cert_stock',
    label: 'Module cert: stock movements (selected document)',
    category: 'engine',
    checkLayer: 'document',
    status: failures.length ? 'fail' : 'pass',
    failures,
    meta: { saleId: opts.saleId, purchaseId: opts.purchaseId },
  };
}

/** Heuristic: document JEs balance; sample account codes present on sale/purchase lines. */
export async function runModuleCoaCertification(
  companyId: string,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult> {
  const failures: LabCheckFailure[] = [];

  const checkJeBalanced = async (jeIds: string[]) => {
    for (const jid of jeIds) {
      const { data: lines } = await supabase
        .from('journal_entry_lines')
        .select('debit, credit')
        .eq('journal_entry_id', jid);
      let d = 0;
      let c = 0;
      for (const ln of lines || []) {
        d += Number((ln as { debit?: number }).debit) || 0;
        c += Number((ln as { credit?: number }).credit) || 0;
      }
      if (Math.abs(d - c) > 0.02) {
        failures.push({
          module: 'coa',
          step: 'unbalanced_je',
          record: jid,
          expected: 'sum(debit)=sum(credit)',
          actual: `debit=${d}, credit=${c}`,
          classification: 'engine_bug',
        });
      }
    }
  };

  if (opts.saleId) {
    const ids = await listActiveCanonicalSaleDocumentJournalEntryIds(opts.saleId);
    await checkJeBalanced(ids);
  }
  if (opts.purchaseId) {
    const ids = await listActiveCanonicalPurchaseDocumentJournalEntryIds(opts.purchaseId);
    await checkJeBalanced(ids);
  }

  return {
    id: 'module_cert_coa',
    label: 'Module cert: COA / balanced document JEs (selected)',
    category: 'engine',
    checkLayer: 'document',
    status: failures.length ? 'fail' : 'pass',
    failures,
    meta: { hint: 'Extend with account-code assertions per charge type as COA stabilizes.' },
  };
}

/** Payment rows must have payment_id on JE; document JEs must not. */
export async function runModulePaymentIsolationCertification(
  companyId: string,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult> {
  const failures: LabCheckFailure[] = [];

  if (opts.saleId) {
    const { data: pays } = await supabase
      .from('payments')
      .select('id')
      .eq('reference_type', 'sale')
      .eq('reference_id', opts.saleId);
    for (const p of pays || []) {
      const pid = (p as { id: string }).id;
      const { data: je } = await supabase
        .from('journal_entries')
        .select('id, payment_id')
        .eq('payment_id', pid)
        .maybeSingle();
      if (!je?.id) {
        failures.push({
          module: 'payment_isolation',
          step: 'payment_missing_je',
          record: pid,
          expected: 'journal entry with payment_id set (trigger)',
          actual: 'none',
          classification: 'source_link',
          navActions: [{ type: 'sale', saleId: opts.saleId }],
        });
      }
    }
  }

  return {
    id: 'module_cert_payment_isolation',
    label: 'Module cert: payment isolation (selected sale)',
    category: 'engine',
    checkLayer: 'document',
    status: failures.length ? 'warn' : 'pass',
    failures,
  };
}

/**
 * Extra charges / freight on posted sale: expect at least one document JE when charges > 0.
 * Posted payment edits remain validated by document cert + payment isolation; delta JEs are backend-side.
 */
export async function runModuleExpenseAndChargesCertification(
  companyId: string,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult> {
  const failures: LabCheckFailure[] = [];

  if (opts.saleId) {
    const { data: sale } = await supabase
      .from('sales')
      .select('id, status, expenses, shipment_charges')
      .eq('id', opts.saleId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!sale) {
      return {
        id: 'module_cert_expense_charges',
        label: 'Module cert: extra expense / freight (sale)',
        category: 'engine',
        checkLayer: 'document',
        status: 'skip',
        failures: [],
        meta: { reason: 'sale not found' },
      };
    }
    const exp = Number((sale as { expenses?: number }).expenses) || 0;
    const ship = Number((sale as { shipment_charges?: number }).shipment_charges) || 0;
    const st = String((sale as { status?: string }).status).toLowerCase();
    if (exp <= 0 && ship <= 0) {
      return {
        id: 'module_cert_expense_charges',
        label: 'Module cert: extra expense / freight (sale)',
        category: 'engine',
        checkLayer: 'document',
        status: 'skip',
        failures: [],
        meta: { reason: 'no expenses or shipment on document' },
      };
    }
    if (st !== 'final') {
      return {
        id: 'module_cert_expense_charges',
        label: 'Module cert: extra expense / freight (sale)',
        category: 'engine',
        checkLayer: 'document',
        status: 'skip',
        failures: [],
        meta: { reason: 'not final — charges may be unposted' },
      };
    }
    const { data: jes } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_type', 'sale')
      .eq('reference_id', opts.saleId)
      .or('is_void.is.null,is_void.eq.false');
    if (!jes?.length) {
      failures.push({
        module: 'expense_charges',
        step: 'final_sale_charges_but_no_je',
        record: opts.saleId,
        expected: 'at least one non-void journal entry when posted with charges',
        actual: '0 journal entries',
        classification: 'source_link',
        navActions: [{ type: 'sale', saleId: opts.saleId }],
      });
    }
  } else if (opts.purchaseId) {
    const { data: pur } = await supabase
      .from('purchases')
      .select('id, status, shipping_cost')
      .eq('id', opts.purchaseId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!pur) {
      return {
        id: 'module_cert_expense_charges',
        label: 'Module cert: freight / charges (purchase)',
        category: 'engine',
        checkLayer: 'document',
        status: 'skip',
        failures: [],
        meta: { reason: 'purchase not found' },
      };
    }
    const ship = Number((pur as { shipping_cost?: number }).shipping_cost) || 0;
    const st = String((pur as { status?: string }).status).toLowerCase();
    if (ship <= 0) {
      return {
        id: 'module_cert_expense_charges',
        label: 'Module cert: freight / charges (purchase)',
        category: 'engine',
        checkLayer: 'document',
        status: 'skip',
        failures: [],
        meta: { reason: 'no shipping_cost on document' },
      };
    }
    if (!['received', 'final'].includes(st)) {
      return {
        id: 'module_cert_expense_charges',
        label: 'Module cert: freight / charges (purchase)',
        category: 'engine',
        checkLayer: 'document',
        status: 'skip',
        failures: [],
        meta: { reason: 'not received/final' },
      };
    }
    const { data: jes } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_type', 'purchase')
      .eq('reference_id', opts.purchaseId)
      .or('is_void.is.null,is_void.eq.false');
    if (!jes?.length) {
      failures.push({
        module: 'expense_charges',
        step: 'posted_purchase_freight_but_no_je',
        record: opts.purchaseId,
        expected: 'at least one non-void journal entry when posted with freight',
        actual: '0 journal entries',
        classification: 'source_link',
        navActions: [{ type: 'purchase', purchaseId: opts.purchaseId }],
      });
    }
  } else {
    return {
      id: 'module_cert_expense_charges',
      label: 'Module cert: extra expense / freight',
      category: 'engine',
      checkLayer: 'document',
      status: 'skip',
      failures: [],
      meta: { reason: 'no document selected' },
    };
  }

  return {
    id: 'module_cert_expense_charges',
    label: 'Module cert: extra expense / freight (selected)',
    category: 'engine',
    checkLayer: 'document',
    status: failures.length ? 'fail' : 'pass',
    failures,
  };
}

/** Worker / studio: PASS when no studio signals; SKIP when ambiguous; FAIL only on clear inconsistency. */
export async function runModuleWorkerStudioCertification(
  companyId: string,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult> {
  return runModuleStudioWorkflowCertification(companyId, opts);
}

/** Studio / worker: full path when studio sale selected; otherwise PASS/SKIP. */
export async function runModuleStudioWorkflowCertification(
  companyId: string,
  opts: { saleId?: string; purchaseId?: string }
): Promise<LabCheckResult> {
  const failures: LabCheckFailure[] = [];
  if (!opts.saleId) {
    return {
      id: 'module_cert_studio_workflow',
      label: 'Module cert: studio workflow (selected sale)',
      category: 'data_quality',
      checkLayer: 'document',
      status: 'skip',
      failures: [],
      meta: { reason: 'select a sale to evaluate studio production linkage' },
    };
  }
  const { data: sale } = await supabase
    .from('sales')
    .select('id, is_studio, studio_charges, source, status')
    .eq('id', opts.saleId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!sale) {
    return {
      id: 'module_cert_studio_workflow',
      label: 'Module cert: studio workflow (selected sale)',
      category: 'data_quality',
      checkLayer: 'document',
      status: 'skip',
      failures: [],
      meta: { reason: 'sale not found' },
    };
  }
  const studio = !!(sale as { is_studio?: boolean }).is_studio;
  const charges = Number((sale as { studio_charges?: number }).studio_charges) || 0;
  const src = String((sale as { source?: string }).source || '');
  if (!studio && charges <= 0 && !src.includes('studio')) {
    return {
      id: 'module_cert_studio_workflow',
      label: 'Module cert: studio workflow (selected sale)',
      category: 'data_quality',
      checkLayer: 'document',
      status: 'pass',
      failures: [],
      meta: { note: 'No studio signals on this sale — PASS (nothing to assert).' },
    };
  }

  const { data: prodsV1 } = await supabase
    .from('studio_productions')
    .select('id, status, production_no')
    .eq('sale_id', opts.saleId)
    .limit(10);
  const { data: ordersV2 } = await supabase
    .from('studio_production_orders_v2')
    .select('id, status, sale_id')
    .eq('sale_id', opts.saleId)
    .limit(10);

  const hasProd = (prodsV1?.length ?? 0) > 0 || (ordersV2?.length ?? 0) > 0;
  if (!hasProd) {
    failures.push({
      module: 'studio',
      step: 'no_production_for_studio_sale',
      record: opts.saleId,
      expected: '≥1 studio_productions or studio_production_orders_v2 for studio sale',
      actual: 'none',
      classification: 'missing_backfill',
      navActions: [{ type: 'sale', saleId: opts.saleId, label: 'Open sale' }],
    });
  } else {
    const prodIds = (prodsV1 || []).map((p: { id: string }) => p.id);
    if (prodIds.length > 0) {
      const { data: stages } = await supabase
        .from('studio_production_stages')
        .select('id, status, cost, production_id')
        .in('production_id', prodIds);
      if (!stages?.length) {
        failures.push({
          module: 'studio',
          step: 'production_without_stages',
          record: prodIds[0],
          expected: 'studio_production_stages rows for production',
          actual: '0',
          classification: 'informational',
          navActions: [{ type: 'sale', saleId: opts.saleId }],
        });
      }
    }
  }

  if (charges > 0 && String((sale as { status?: string }).status).toLowerCase() === 'final') {
    const { data: sm } = await supabase
      .from('stock_movements')
      .select('id')
      .eq('reference_type', 'sale')
      .eq('reference_id', opts.saleId)
      .limit(5);
    if (!(sm?.length ?? 0)) {
      failures.push({
        module: 'studio',
        step: 'final_studio_sale_no_stock_sample',
        record: opts.saleId,
        expected: 'stock movements when final (if physical finished goods posted)',
        actual: 'none in sample',
        classification: 'informational',
        navActions: [{ type: 'sale', saleId: opts.saleId }],
      });
    }
  }

  return {
    id: 'module_cert_studio_workflow',
    label: 'Module cert: studio workflow (production / stages / stock sample)',
    category: 'data_quality',
    checkLayer: 'document',
    status: failures.length ? 'warn' : 'pass',
    failures,
    meta: {
      productionsV1: prodsV1?.length ?? 0,
      ordersV2: ordersV2?.length ?? 0,
      studio_charges: charges,
    },
  };
}

/** Standalone business expense row: draft ⇒ no active expense JE; paid/approved ⇒ expect linked JE. */
export async function runModuleStandaloneExpenseCertification(
  companyId: string,
  expenseId?: string
): Promise<LabCheckResult> {
  if (!expenseId?.trim()) {
    return {
      id: 'module_cert_business_expense',
      label: 'Module cert: business expense (selected id)',
      category: 'engine',
      checkLayer: 'document',
      status: 'skip',
      failures: [],
      meta: { reason: 'Enter expense UUID in Lab Setup (optional).' },
    };
  }
  const { data: exp } = await supabase
    .from('expenses')
    .select('id, status, amount, company_id, created_at, updated_at')
    .eq('id', expenseId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!exp) {
    return {
      id: 'module_cert_business_expense',
      label: 'Module cert: business expense (selected id)',
      category: 'engine',
      checkLayer: 'document',
      status: 'fail',
      failures: [
        {
          module: 'expenses',
          step: 'expense_not_found',
          record: expenseId,
          expected: 'expenses row for company',
          actual: 'not found',
          classification: 'source_link',
        },
      ],
    };
  }
  const st = String((exp as { status?: string }).status).toLowerCase();
  const { data: jes } = await supabase
    .from('journal_entries')
    .select('id, is_void')
    .eq('company_id', companyId)
    .eq('reference_type', 'expense')
    .eq('reference_id', expenseId);
  const active = (jes || []).filter((j: { is_void?: boolean }) => !j.is_void).length;

  const failures: LabCheckFailure[] = [];
  const draftLike = st === 'draft' || st === 'submitted';
  const postedLike = st === 'paid' || st === 'approved';

  if (draftLike && active > 0) {
    failures.push({
      module: 'expenses',
      step: 'draft_expense_has_je',
      record: expenseId,
      expected: 'no active journal_entries for draft/submitted expense',
      actual: `active_je=${active}`,
      classification: 'engine_bug',
    });
  }
  if (postedLike && active < 1) {
    failures.push({
      module: 'expenses',
      step: 'posted_expense_missing_je',
      record: expenseId,
      expected: '≥1 active JE reference_type=expense',
      actual: `active_je=${active}`,
      classification: 'missing_backfill',
    });
  }
  if (st === 'rejected' && active > 0) {
    failures.push({
      module: 'expenses',
      step: 'rejected_expense_still_has_je',
      record: expenseId,
      expected: 'void or no JEs when rejected/cancelled',
      actual: `active_je=${active}`,
      classification: 'legacy_data',
    });
  }

  const created = (exp as { created_at?: string }).created_at;
  const updated = (exp as { updated_at?: string }).updated_at;
  const edited =
    created &&
    updated &&
    new Date(updated).getTime() > new Date(created).getTime() + 2000;

  return {
    id: 'module_cert_business_expense',
    label: 'Module cert: business expense (draft vs posted JE)',
    category: 'engine',
    checkLayer: 'document',
    status: failures.length ? 'fail' : 'pass',
    failures,
    meta: {
      status: st,
      activeExpenseJEs: active,
      editedHint: edited ? 'expense row updated_at > created_at — confirm delta JEs in activity only' : undefined,
    },
  };
}

/** Manual JE, supplier payment, transfer-style rows: balance + payment isolation when ids provided. */
export async function runModuleJournalTransferAndPaymentsCertification(
  companyId: string,
  opts: { manualJournalEntryId?: string; supplierPaymentId?: string }
): Promise<LabCheckResult> {
  const failures: LabCheckFailure[] = [];

  if (opts.manualJournalEntryId?.trim()) {
    const jid = opts.manualJournalEntryId.trim();
    const { data: je } = await supabase
      .from('journal_entries')
      .select('id, company_id, is_void')
      .eq('id', jid)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!je) {
      failures.push({
        module: 'journal',
        step: 'manual_je_not_found',
        record: jid,
        expected: 'journal_entries row',
        actual: 'not found',
        classification: 'source_link',
      });
    } else if (!(je as { is_void?: boolean }).is_void) {
      const { data: lines } = await supabase
        .from('journal_entry_lines')
        .select('debit, credit')
        .eq('journal_entry_id', jid);
      let d = 0;
      let c = 0;
      (lines || []).forEach((l: { debit?: number; credit?: number }) => {
        d += Number(l.debit) || 0;
        c += Number(l.credit) || 0;
      });
      if (Math.abs(d - c) > 0.02) {
        failures.push({
          module: 'journal',
          step: 'manual_je_unbalanced',
          record: jid,
          expected: 'sum(debit)=sum(credit)',
          actual: `debit=${d} credit=${c}`,
          classification: 'engine_bug',
        });
      }
    }
  }

  if (opts.supplierPaymentId?.trim()) {
    const pid = opts.supplierPaymentId.trim();
    const { data: pay } = await supabase
      .from('payments')
      .select('id, reference_type, reference_id, amount, company_id')
      .eq('id', pid)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!pay) {
      failures.push({
        module: 'payments',
        step: 'supplier_payment_not_found',
        record: pid,
        expected: 'payments row',
        actual: 'not found',
        classification: 'source_link',
      });
    } else {
      const refT = String((pay as { reference_type?: string }).reference_type).toLowerCase();
      if (refT !== 'purchase') {
        failures.push({
          module: 'payments',
          step: 'payment_not_purchase_ref',
          record: pid,
          expected: 'reference_type=purchase for supplier payment check',
          actual: refT,
          classification: 'informational',
        });
      }
      const amt = Number((pay as { amount?: number }).amount) || 0;
      if (amt > 0.01) {
        const { count } = await supabase
          .from('journal_entries')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('payment_id', pid)
          .or('is_void.is.null,is_void.eq.false');
        if ((count ?? 0) < 1) {
          failures.push({
            module: 'payments',
            step: 'supplier_payment_missing_je',
            record: pid,
            expected: '≥1 active JE with payment_id',
            actual: `count=${count ?? 0}`,
            classification: 'source_link',
          });
        }
      }
    }
  }

  if (!opts.manualJournalEntryId?.trim() && !opts.supplierPaymentId?.trim()) {
    return {
      id: 'module_cert_journal_transfer_payments',
      label: 'Module cert: manual JE / supplier payment (optional ids)',
      category: 'engine',
      checkLayer: 'document',
      status: 'skip',
      failures: [],
      meta: {
        reason: 'Optional: set manual journal entry id and/or supplier payment id in Lab Setup.',
      },
    };
  }

  return {
    id: 'module_cert_journal_transfer_payments',
    label: 'Module cert: manual JE / supplier payment (optional ids)',
    category: 'engine',
    checkLayer: 'document',
    status: failures.length ? 'fail' : 'pass',
    failures,
  };
}

/** Run all module certification checks for the selected document. */
export async function runModuleCertificationSuite(
  companyId: string,
  opts: {
    saleId?: string;
    purchaseId?: string;
    expenseId?: string;
    manualJournalEntryId?: string;
    supplierPaymentId?: string;
  }
): Promise<LabCheckResult[]> {
  const out: LabCheckResult[] = [];
  out.push(tagDocument(await runModuleStockCertification(companyId, opts)));
  out.push(tagDocument(await runModuleCoaCertification(companyId, opts)));
  out.push(tagDocument(await runModulePaymentIsolationCertification(companyId, opts)));
  out.push(tagDocument(await runModuleExpenseAndChargesCertification(companyId, opts)));
  out.push(tagDocument(await runModuleWorkerStudioCertification(companyId, opts)));
  out.push(tagDocument(await runModuleStandaloneExpenseCertification(companyId, opts.expenseId)));
  out.push(
    tagDocument(
      await runModuleJournalTransferAndPaymentsCertification(companyId, {
        manualJournalEntryId: opts.manualJournalEntryId,
        supplierPaymentId: opts.supplierPaymentId,
      })
    )
  );
  return out;
}

/** Section 3: surface owner equity / capital accounts for BS coverage (informational WARN if missing). */
export async function runOwnerEquityCapitalVisibilityCheck(companyId: string): Promise<LabCheckResult> {
  const { data: accs } = await supabase
    .from('accounts')
    .select('id, code, name, type')
    .eq('company_id', companyId)
    .limit(5000);
  const list = accs || [];
  const lower = (s: string) => s.toLowerCase();
  const hasCapital = list.some(
    (a: { name?: string; code?: string }) =>
      lower(a.name || '').includes('capital') ||
      lower(a.code || '').startsWith('3')
  );
  const hasDrawings = list.some(
    (a: { name?: string }) =>
      lower(a.name || '').includes('drawing') || lower(a.name || '').includes('withdrawal')
  );
  const hasRetained = list.some(
    (a: { name?: string }) =>
      lower(a.name || '').includes('retained') || lower(a.name || '').includes('accumulated')
  );
  const failures: LabCheckFailure[] = [];
  if (!hasCapital) {
    failures.push({
      module: 'coa_equity',
      step: 'owner_capital_not_obvious',
      record: companyId,
      expected: 'an owner equity / capital-style account (name or code 3xxx)',
      actual: 'none detected in sample',
      classification: 'missing_backfill',
    });
  }
  return {
    id: 'company_equity_capital_visibility',
    label: 'Company: owner equity / capital / drawings visibility (COA sample)',
    category: 'data_quality',
    checkLayer: 'company',
    status: failures.length ? 'warn' : 'pass',
    failures,
    meta: {
      hasCapital,
      hasDrawings,
      hasRetained,
      note: 'Drawings / retained naming hints in meta only. Presentation — does not replace TB/BS suite.',
    },
  };
}
