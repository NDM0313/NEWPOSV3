/**
 * AR/AP reconciliation: operational (invoice/RPC) vs GL (journal) — two explicit truths.
 * Does NOT replace get_contact_balances_summary; wraps it for UI and Integrity workflows.
 *
 * Per-contact GL-aligned balance requires party linkage on journal lines (future party_contact_id).
 */

import { supabase } from '@/lib/supabase';
import { contactService } from '@/app/services/contactService';
import { accountingReportsService } from '@/app/services/accountingReportsService';

export type ReconciliationConfidence = 'company_control_only' | 'pending_journal_mapping';

export interface CompanyReconciliationSnapshot {
  asOfDate: string;
  /** Branch UUID or null = all branches (matches TB when branchId omitted). */
  branchId: string | null;
  operationalReceivablesTotal: number;
  operationalPayablesTotal: number;
  glArNetDrMinusCr: number | null;
  glApNetCredit: number | null;
  /** operational receivables (sum contacts) minus GL AR net (Dr−Cr). */
  varianceReceivablesVsAr: number | null;
  /** operational payables minus GL AP net (Cr−Dr). */
  variancePayablesVsAp: number | null;
  /** When split totals passed: customer+both recv vs AR 1100 (meaningful tie-out). */
  customerReceivablesOperational?: number | null;
  varianceCustomerReceivablesVsAr?: number | null;
  /** When split totals passed: supplier+both pay vs AP 2000 (meaningful tie-out). */
  supplierPayablesOperational?: number | null;
  varianceSupplierPayablesVsAp?: number | null;
  /** Worker contact payables (operational); not comparable to AP 2000 — use WP 2010 party GL. */
  workerPayablesOperational?: number | null;
  /** GL Worker Payable 2010 net (Cr − Dr), journal life-to-date. */
  glWorkerPayableNetCredit?: number | null;
  /** worker_op − GL WP (Cr−Dr); distinct from supplier vs AP. */
  varianceWorkerPayablesVsWp?: number | null;
  unmappedArJournalCount: number;
  unmappedApJournalCount: number;
  confidence: ReconciliationConfidence;
  /** User-facing explanation; never claims fake equality. */
  message: string;
}

export interface ContactReconciliationRow {
  contactId: string;
  operationalBalance: number;
  glAlignedBalance: number | null;
  variance: number | null;
  status: 'pending_journal_mapping' | 'not_applicable';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeBranchForRpc(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  return UUID_RE.test(branchId.trim()) ? branchId.trim() : null;
}

/** Sum receivables and payables across all contacts from operational RPC (same as Contacts list source). */
async function sumOperationalFromRpc(companyId: string, branchId: string | null | undefined): Promise<{
  receivables: number;
  payables: number;
}> {
  const map = await contactService.getContactBalancesSummary(companyId, branchId ?? null).catch(() => null);
  if (!map || map.size === 0) return { receivables: 0, payables: 0 };
  let receivables = 0;
  let payables = 0;
  map.forEach((v) => {
    receivables += Number(v.receivables) || 0;
    payables += Number(v.payables) || 0;
  });
  return { receivables, payables };
}

export interface CompanyReconciliationOptions {
  /** When set (e.g. Contacts tab scope), variance uses these instead of summing all contacts from RPC. */
  operationalReceivablesTotal?: number;
  operationalPayablesTotal?: number;
  /** Split by contact type — use for GL control tie-out (AR 1100 / AP 2000). */
  operationalCustomerReceivablesTotal?: number;
  operationalSupplierPayablesTotal?: number;
  operationalWorkerPayablesTotal?: number;
}

/**
 * Company-level snapshot: operational totals vs AR/AP control accounts (journal) + unmapped JE counts.
 */
export async function getCompanyReconciliationSnapshot(
  companyId: string,
  branchId: string | null | undefined,
  asOfDate?: string,
  options?: CompanyReconciliationOptions
): Promise<CompanyReconciliationSnapshot> {
  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const b = safeBranchForRpc(branchId);

  const operationalPromise =
    options?.operationalReceivablesTotal != null && options?.operationalPayablesTotal != null
      ? Promise.resolve({
          receivables: options.operationalReceivablesTotal,
          payables: options.operationalPayablesTotal,
        })
      : sumOperationalFromRpc(companyId, branchId);

  const [operational, glSnap, unmappedRpc] = await Promise.all([
    operationalPromise,
    accountingReportsService.getArApGlSnapshot(companyId, end, b ?? undefined),
    supabase.rpc('count_unmapped_ar_ap_journal_entries', {
      p_company_id: companyId,
      p_branch_id: b,
      p_as_of_date: end,
    }),
  ]);

  const glArNet = glSnap.ar != null ? glSnap.ar.balance : null;
  const glApNetCredit = glSnap.apNetCredit;

  const varRecv =
    glArNet != null ? operational.receivables - glArNet : null;
  const varPay =
    glApNetCredit != null ? operational.payables - glApNetCredit : null;

  const custRecvOp = options?.operationalCustomerReceivablesTotal;
  const supPayOp = options?.operationalSupplierPayablesTotal;
  const workPayOp = options?.operationalWorkerPayablesTotal;
  const varCustVsAr =
    custRecvOp != null && glArNet != null ? custRecvOp - glArNet : null;
  const varSupVsAp =
    supPayOp != null && glApNetCredit != null ? supPayOp - glApNetCredit : null;

  const glWpNet = glSnap.wpNetCredit;
  const varWorkVsWp =
    workPayOp != null && glWpNet != null ? workPayOp - glWpNet : null;

  let unmappedAr = 0;
  let unmappedAp = 0;
  if (!unmappedRpc.error && unmappedRpc.data != null) {
    const row = Array.isArray(unmappedRpc.data) ? unmappedRpc.data[0] : unmappedRpc.data;
    unmappedAr = Number((row as any)?.ar_unmapped_entry_count) || 0;
    unmappedAp = Number((row as any)?.ap_unmapped_entry_count) || 0;
  }

  return {
    asOfDate: end,
    branchId: b,
    operationalReceivablesTotal: operational.receivables,
    operationalPayablesTotal: operational.payables,
    glArNetDrMinusCr: glArNet,
    glApNetCredit,
    varianceReceivablesVsAr: varRecv,
    variancePayablesVsAp: varPay,
    customerReceivablesOperational: custRecvOp ?? null,
    supplierPayablesOperational: supPayOp ?? null,
    workerPayablesOperational: workPayOp ?? null,
    glWorkerPayableNetCredit: glWpNet,
    varianceWorkerPayablesVsWp: varWorkVsWp,
    varianceCustomerReceivablesVsAr: varCustVsAr,
    varianceSupplierPayablesVsAp: varSupVsAp,
    unmappedArJournalCount: unmappedAr,
    unmappedApJournalCount: unmappedAp,
    confidence: 'pending_journal_mapping',
    message:
      'Per-contact GL-aligned balances require party linkage on journal lines (planned). Shown: company operational totals vs control accounts + unmapped journal heuristic. Mixed payables include workers — compare supplier-only operational to AP 2000; worker payables belong to WP 2010 / party GL.',
  };
}

/**
 * Per-contact row: operational from a pre-built map; GL-aligned always null until party_contact_id / inference RPC exists.
 */
export function buildContactReconciliationRow(
  contactId: string,
  operationalReceivableOrPayable: number,
  contactKind: 'customer' | 'supplier' | 'worker' | 'both'
): ContactReconciliationRow {
  const needsGl = contactKind === 'customer' || contactKind === 'supplier' || contactKind === 'both';
  return {
    contactId,
    operationalBalance: operationalReceivableOrPayable,
    glAlignedBalance: null,
    variance: null,
    status: needsGl ? 'pending_journal_mapping' : 'not_applicable',
  };
}

/**
 * Phase 4 — services that can move AR/AP (posting audit). party_contact_id write = future.
 * Checklist only; does not execute.
 */
export const AR_AP_POSTING_TOUCHPOINTS: ReadonlyArray<{
  path: string;
  movesArOrAp: 'AR' | 'AP' | 'both';
  partyOnJournalEntry: string;
  partyOnLines: string;
}> = [
  {
    path: 'saleAccountingService.ts (createSaleJournalEntry, adjustments, reversal)',
    movesArOrAp: 'AR',
    partyOnJournalEntry: 'reference_type=sale, reference_id=saleId',
    partyOnLines: 'none — resolve customer via sales.customer_id',
  },
  {
    path: 'saleService.ts / payment paths (recordPayment, on_account)',
    movesArOrAp: 'AR',
    partyOnJournalEntry: 'often sale + payment_id',
    partyOnLines: 'none',
  },
  {
    path: 'purchaseAccountingService.ts (createPurchaseJournalEntry, adjustments)',
    movesArOrAp: 'AP',
    partyOnJournalEntry: 'reference_type=purchase, reference_id=purchaseId',
    partyOnLines: 'none — resolve supplier via purchases.supplier_id',
  },
  {
    path: 'purchaseService.ts / supplierPaymentService.ts',
    movesArOrAp: 'AP',
    partyOnJournalEntry: 'purchase / payment',
    partyOnLines: 'none',
  },
  {
    path: 'addEntryV2Service.ts (manual_receipt / manual_payment)',
    movesArOrAp: 'both',
    partyOnJournalEntry: 'manual_receipt: reference_id=customerId; manual_payment: supplier context',
    partyOnLines: 'none',
  },
  {
    path: 'accountingService.ts (createEntry, corrections, getCustomerLedger composition)',
    movesArOrAp: 'both',
    partyOnJournalEntry: 'varies',
    partyOnLines: 'none',
  },
  {
    path: 'creditNoteService.ts, refundService.ts, saleReturnService.ts, purchaseReturnService.ts',
    movesArOrAp: 'both',
    partyOnJournalEntry: 'document ids',
    partyOnLines: 'none',
  },
  {
    path: 'shipmentAccountingService.ts, rentalService.ts, workerPaymentService.ts (2010 typical)',
    movesArOrAp: 'both',
    partyOnJournalEntry: 'context-specific',
    partyOnLines: 'none',
  },
  {
    path: 'studioProductionService.ts / studioCustomerInvoiceService.ts',
    movesArOrAp: 'AR',
    partyOnJournalEntry: 'studio / sale ids',
    partyOnLines: 'none',
  },
  {
    path: 'paymentAdjustmentService.ts, inventoryService opening_balance',
    movesArOrAp: 'both',
    partyOnJournalEntry: 'varies',
    partyOnLines: 'none',
  },
];

/** One customer: operational receivable (RPC) vs journal-derived AR slice (get_contact_party_gl_balances). */
export interface SingleCustomerPartyReconciliation {
  customerId: string;
  operationalReceivable: number;
  glArReceivable: number;
  variance: number;
  asOfDate: string;
  companyUnmappedArCount: number;
}

export async function getSingleCustomerPartyReconciliation(
  companyId: string,
  customerId: string,
  branchId: string | null | undefined
): Promise<SingleCustomerPartyReconciliation> {
  const end = new Date().toISOString().slice(0, 10);
  const b = safeBranchForRpc(branchId);

  const [opMap, glRpc, unmappedRpc] = await Promise.all([
    contactService.getContactBalancesSummary(companyId, branchId ?? null).catch(() => null),
    supabase.rpc('get_contact_party_gl_balances', {
      p_company_id: companyId,
      p_branch_id: b,
    }),
    supabase.rpc('count_unmapped_ar_ap_journal_entries', {
      p_company_id: companyId,
      p_branch_id: b,
      p_as_of_date: end,
    }),
  ]);

  const operationalReceivable = opMap?.get(customerId)?.receivables ?? 0;

  let glArReceivable = 0;
  if (!glRpc.error && Array.isArray(glRpc.data)) {
    const row = (glRpc.data as { contact_id: string; gl_ar_receivable?: number | string }[]).find(
      (r) => String(r.contact_id) === String(customerId)
    );
    glArReceivable = Number(row?.gl_ar_receivable ?? 0) || 0;
  }

  let companyUnmappedArCount = 0;
  if (!unmappedRpc.error && unmappedRpc.data != null) {
    const row = Array.isArray(unmappedRpc.data) ? unmappedRpc.data[0] : unmappedRpc.data;
    companyUnmappedArCount = Number((row as { ar_unmapped_entry_count?: number })?.ar_unmapped_entry_count) || 0;
  }

  return {
    customerId,
    operationalReceivable,
    glArReceivable,
    variance: operationalReceivable - glArReceivable,
    asOfDate: end,
    companyUnmappedArCount,
  };
}

export interface SingleSupplierPartyReconciliation {
  supplierId: string;
  operationalPayable: number;
  glApPayable: number;
  variance: number;
  asOfDate: string;
  companyUnmappedApCount: number;
}

export async function getSingleSupplierPartyReconciliation(
  companyId: string,
  supplierId: string,
  branchId: string | null | undefined
): Promise<SingleSupplierPartyReconciliation> {
  const end = new Date().toISOString().slice(0, 10);
  const b = safeBranchForRpc(branchId);

  const [opMap, glRpc, unmappedRpc] = await Promise.all([
    contactService.getContactBalancesSummary(companyId, branchId ?? null).catch(() => null),
    supabase.rpc('get_contact_party_gl_balances', {
      p_company_id: companyId,
      p_branch_id: b,
    }),
    supabase.rpc('count_unmapped_ar_ap_journal_entries', {
      p_company_id: companyId,
      p_branch_id: b,
      p_as_of_date: end,
    }),
  ]);

  const operationalPayable = opMap?.get(supplierId)?.payables ?? 0;

  let glApPayable = 0;
  if (!glRpc.error && Array.isArray(glRpc.data)) {
    const row = (glRpc.data as { contact_id: string; gl_ap_payable?: number | string }[]).find(
      (r) => String(r.contact_id) === String(supplierId)
    );
    glApPayable = Number(row?.gl_ap_payable ?? 0) || 0;
  }

  let companyUnmappedApCount = 0;
  if (!unmappedRpc.error && unmappedRpc.data != null) {
    const row = Array.isArray(unmappedRpc.data) ? unmappedRpc.data[0] : unmappedRpc.data;
    companyUnmappedApCount = Number((row as { ap_unmapped_entry_count?: number })?.ap_unmapped_entry_count) || 0;
  }

  return {
    supplierId,
    operationalPayable,
    glApPayable,
    variance: operationalPayable - glApPayable,
    asOfDate: end,
    companyUnmappedApCount,
  };
}

export interface SingleWorkerPartyReconciliation {
  workerId: string;
  operationalPending: number;
  glWorkerPayableNet: number;
  variance: number;
  asOfDate: string;
  companyUnmappedApCount: number;
  companyUnmappedArCount: number;
}

export async function getSingleWorkerPartyReconciliation(
  companyId: string,
  workerId: string,
  branchId: string | null | undefined
): Promise<SingleWorkerPartyReconciliation> {
  const end = new Date().toISOString().slice(0, 10);
  const b = safeBranchForRpc(branchId);

  const [opMap, glRpc, unmappedRpc] = await Promise.all([
    contactService.getContactBalancesSummary(companyId, branchId ?? null).catch(() => null),
    supabase.rpc('get_contact_party_gl_balances', {
      p_company_id: companyId,
      p_branch_id: b,
    }),
    supabase.rpc('count_unmapped_ar_ap_journal_entries', {
      p_company_id: companyId,
      p_branch_id: b,
      p_as_of_date: end,
    }),
  ]);

  const operationalPending = opMap?.get(workerId)?.payables ?? 0;

  let glWorkerPayableNet = 0;
  if (!glRpc.error && Array.isArray(glRpc.data)) {
    const row = (glRpc.data as { contact_id: string; gl_worker_payable?: number | string }[]).find(
      (r) => String(r.contact_id) === String(workerId)
    );
    glWorkerPayableNet = Number(row?.gl_worker_payable ?? 0) || 0;
  }

  let companyUnmappedApCount = 0;
  let companyUnmappedArCount = 0;
  if (!unmappedRpc.error && unmappedRpc.data != null) {
    const row = Array.isArray(unmappedRpc.data) ? unmappedRpc.data[0] : unmappedRpc.data;
    companyUnmappedApCount = Number((row as { ap_unmapped_entry_count?: number })?.ap_unmapped_entry_count) || 0;
    companyUnmappedArCount = Number((row as { ar_unmapped_entry_count?: number })?.ar_unmapped_entry_count) || 0;
  }

  return {
    workerId,
    operationalPending,
    glWorkerPayableNet,
    variance: operationalPending - glWorkerPayableNet,
    asOfDate: end,
    companyUnmappedApCount,
    companyUnmappedArCount,
  };
}
