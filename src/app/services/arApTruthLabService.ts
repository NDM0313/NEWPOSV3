/**
 * AR/AP Truth Lab — explicit operational vs party-GL sources (no blended balances).
 * @see docs/accounting/FINAL_AR_TRUTH_LAB_FREEZE_AND_CUSTOMER_DELTA_CLOSE.md
 */

import { supabase } from '@/lib/supabase';
import { contactService } from '@/app/services/contactService';
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
import { accountingService, type AccountLedgerEntry } from '@/app/services/accountingService';
import { getSupplierOperationalLedgerData } from '@/app/services/ledgerDataAdapters';
import { fetchUnmappedJournalLines, type UnmappedJournalRow } from '@/app/services/arApReconciliationCenterService';
import {
  getSingleCustomerPartyReconciliation,
  getSingleSupplierPartyReconciliation,
} from '@/app/services/contactBalanceReconciliationService';
import type { CustomerLedgerSummary } from '@/app/services/customerLedgerApi';

export type TruthLabContactKind = 'customer' | 'supplier' | 'both';
export type TruthLabDualBasis = 'ar' | 'ap';

export interface TruthLabParams {
  companyId: string;
  branchId: string | null | undefined;
  contactId: string;
  contactName: string;
  contactType: string;
  contactKind: TruthLabContactKind;
  dualBasis: TruthLabDualBasis;
  dateFrom: string;
  dateTo: string;
  includeVoided: boolean;
  includeReversals: boolean;
  includeManualJe: boolean;
}

export interface TruthLabAllocTotals {
  allocated: number;
  unallocated: number;
}

export interface OperationalMovementRow {
  label: string;
  amount: number;
  source: string;
}

export interface DeltaExplainerRow {
  sourceRowId: string;
  sourceType: string;
  documentRef: string;
  operationalEffect: string;
  glEffect: string;
  delta: string;
  reasonBucket: string;
}

export interface TruthLabSnapshot {
  params: TruthLabParams;
  isArSlice: boolean;
  operationalRpcRecv: number | null;
  operationalRpcPay: number | null;
  partyGlAr: number | null;
  partyGlAp: number | null;
  primaryOperational: number | null;
  primaryPartyGl: number | null;
  primaryDelta: number | null;
  companyUnmappedAr: number;
  companyUnmappedAp: number;
  allocTotals: TruthLabAllocTotals | null;
  customerLedgerSummary: CustomerLedgerSummary | null;
  supplierLedgerClosing: number | null;
  operationalMovementRows: OperationalMovementRow[];
  glEntriesFiltered: AccountLedgerEntry[];
  glEntriesRaw: AccountLedgerEntry[];
  deltaRows: DeltaExplainerRow[];
  exceptions: UnmappedJournalRow[];
  errors: string[];
}

function inferReasonBucket(op: number, gl: number): string {
  const d = op - gl;
  if (Math.abs(d) < 0.02) return 'unknown';
  if (d > 500) return 'allocated_receipt_difference';
  if (d < -500) return 'manual_je_only_gl';
  return 'unknown';
}

function filterGlRows(
  rows: AccountLedgerEntry[],
  includeReversals: boolean,
  includeManualJe: boolean
): AccountLedgerEntry[] {
  return rows.filter((e) => {
    const dt = String(e.document_type || '');
    if (!includeReversals && dt === 'Reversal') return false;
    if (!includeManualJe && dt === 'AR Journal') return false;
    if (!includeManualJe && dt === 'AP Journal') return false;
    return true;
  });
}

async function fetchManualReceiptAllocationTotals(
  companyId: string,
  contactId: string,
  includeVoided: boolean
): Promise<TruthLabAllocTotals> {
  let q = supabase
    .from('payments')
    .select('id, amount, voided_at')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .eq('reference_type', 'manual_receipt');
  if (!includeVoided) q = q.is('voided_at', null);
  const { data: pays, error } = await q;
  if (error || !pays?.length) return { allocated: 0, unallocated: 0 };
  const ids = pays.map((p) => p.id as string);
  const { data: allocs } = await supabase
    .from('payment_allocations')
    .select('payment_id, allocated_amount')
    .in('payment_id', ids);
  const byPay = new Map<string, number>();
  (allocs || []).forEach((a: { payment_id?: string; allocated_amount?: number }) => {
    const id = String(a.payment_id ?? '');
    byPay.set(id, (byPay.get(id) || 0) + (Number(a.allocated_amount) || 0));
  });
  let allocated = 0;
  let unallocated = 0;
  for (const p of pays) {
    const amt = Number((p as { amount?: number }).amount) || 0;
    const a = byPay.get(String((p as { id?: string }).id)) || 0;
    allocated += a;
    unallocated += Math.max(0, amt - a);
  }
  return { allocated, unallocated };
}

function resolveArSlice(
  contactType: string,
  contactKind: TruthLabContactKind,
  dualBasis: TruthLabDualBasis
): boolean {
  if (contactType === 'customer') return true;
  if (contactType === 'supplier') return false;
  if (contactType === 'both') return dualBasis === 'ar';
  if (contactKind === 'customer') return true;
  if (contactKind === 'supplier') return false;
  return dualBasis === 'ar';
}

export async function loadTruthLabContacts(
  companyId: string,
  kind: TruthLabContactKind
): Promise<{ id: string; name: string; type: string }[]> {
  if (kind === 'both') {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, type')
      .eq('company_id', companyId)
      .order('name');
    if (error) throw error;
    return (data || []) as { id: string; name: string; type: string }[];
  }
  const types = kind === 'customer' ? ['customer', 'both'] : ['supplier', 'both'];
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, type')
    .eq('company_id', companyId)
    .in('type', types)
    .order('name');
  if (error) throw error;
  return (data || []) as { id: string; name: string; type: string }[];
}

export async function fetchTruthLabSnapshot(params: TruthLabParams): Promise<TruthLabSnapshot> {
  const errors: string[] = [];
  const branch = params.branchId === 'all' ? null : params.branchId;
  const scope = params.includeVoided ? 'audit' : 'live';
  const payOpts = { paymentScope: scope as const, branchId: branch ?? undefined };
  const isArSlice = resolveArSlice(params.contactType, params.contactKind, params.dualBasis);

  const dateFrom = params.dateFrom.slice(0, 10);
  const dateTo = params.dateTo.slice(0, 10);

  let operationalRpcRecv: number | null = null;
  let operationalRpcPay: number | null = null;
  let partyGlAr: number | null = null;
  let partyGlAp: number | null = null;
  let primaryOperational: number | null = null;
  let primaryPartyGl: number | null = null;
  let primaryDelta: number | null = null;
  let companyUnmappedAr = 0;
  let companyUnmappedAp = 0;
  let customerLedgerSummary: CustomerLedgerSummary | null = null;
  let supplierLedgerClosing: number | null = null;
  const operationalMovementRows: OperationalMovementRow[] = [];
  let glRaw: AccountLedgerEntry[] = [];
  let allocTotals: TruthLabAllocTotals | null = null;

  try {
    if (isArSlice) {
      const recon = await getSingleCustomerPartyReconciliation(params.companyId, params.contactId, branch);
      operationalRpcRecv = recon.operationalReceivable;
      primaryOperational = recon.operationalReceivable;
      partyGlAr = recon.glArReceivable;
      primaryPartyGl = recon.glArReceivable;
      primaryDelta = recon.variance;
      companyUnmappedAr = recon.companyUnmappedArCount;

      customerLedgerSummary = await customerLedgerAPI.getLedgerSummary(
        params.contactId,
        params.companyId,
        dateFrom,
        dateTo,
        payOpts
      );
      operationalMovementRows.push(
        { label: 'Opening (period)', amount: customerLedgerSummary.openingBalance, source: 'customerLedgerAPI.getLedgerSummary' },
        { label: 'Sales / invoices (period gross)', amount: customerLedgerSummary.totalInvoiceAmount, source: 'customerLedgerAPI.getLedgerSummary' },
        { label: 'Receipts & credits (period)', amount: -customerLedgerSummary.totalPaymentReceived, source: 'customerLedgerAPI.getLedgerSummary' },
        { label: 'Closing (period)', amount: customerLedgerSummary.closingBalance, source: 'customerLedgerAPI.getLedgerSummary' }
      );

      glRaw = await accountingService.getCustomerArGlJournalLedger(
        params.contactId,
        params.companyId,
        branch ?? undefined,
        dateFrom,
        dateTo
      );
      allocTotals = await fetchManualReceiptAllocationTotals(params.companyId, params.contactId, params.includeVoided);
    } else {
      const recon = await getSingleSupplierPartyReconciliation(params.companyId, params.contactId, branch);
      operationalRpcPay = recon.operationalPayable;
      primaryOperational = recon.operationalPayable;
      partyGlAp = recon.glApPayable;
      primaryPartyGl = recon.glApPayable;
      primaryDelta = recon.variance;
      companyUnmappedAp = recon.companyUnmappedApCount;

      const supData = await getSupplierOperationalLedgerData(
        params.companyId,
        params.contactId,
        params.contactName || 'Supplier',
        dateFrom,
        dateTo
      );
      supplierLedgerClosing = supData.closingBalance;
      operationalMovementRows.push(
        { label: 'Opening (period)', amount: supData.openingBalance, source: 'getSupplierOperationalLedgerData' },
        { label: 'Purchases (credit to AP)', amount: supData.invoicesSummary.totalInvoiceAmount, source: 'getSupplierOperationalLedgerData' },
        { label: 'Payments (debit to AP)', amount: -supData.invoicesSummary.totalPaymentReceived, source: 'getSupplierOperationalLedgerData' },
        { label: 'Closing (period)', amount: supData.closingBalance, source: 'getSupplierOperationalLedgerData' }
      );

      glRaw = await accountingService.getSupplierApGlJournalLedger(
        params.contactId,
        params.companyId,
        branch ?? undefined,
        dateFrom,
        dateTo
      );
    }
  } catch (e: unknown) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  const glEntriesFiltered = filterGlRows(glRaw, params.includeReversals, params.includeManualJe);

  const { map: opMap } = await contactService.getContactBalancesSummary(params.companyId, branch ?? null);
  const rowOp = opMap.get(params.contactId);
  operationalRpcRecv = rowOp != null ? Number(rowOp.receivables) || 0 : null;
  operationalRpcPay = rowOp != null ? Number(rowOp.payables) || 0 : null;

  const deltaRows: DeltaExplainerRow[] = [];
  if (primaryOperational != null && primaryPartyGl != null) {
    const bucket = inferReasonBucket(primaryOperational, primaryPartyGl);
    deltaRows.push({
      sourceRowId: params.contactId,
      sourceType: 'contact',
      documentRef: '—',
      operationalEffect: primaryOperational.toFixed(2),
      glEffect: primaryPartyGl.toFixed(2),
      delta: (primaryOperational - primaryPartyGl).toFixed(2),
      reasonBucket: bucket,
    });
  }

  const end = dateTo;
  const exceptionsFull = await fetchUnmappedJournalLines(params.companyId, branch, end, 200);
  const exceptions: UnmappedJournalRow[] = exceptionsFull.filter((r) =>
    isArSlice ? r.control_bucket === 'AR' : r.control_bucket === 'AP'
  );

  for (const ex of exceptions.slice(0, 12)) {
    const glNetAsset = Number(ex.debit || 0) - Number(ex.credit || 0);
    const glNetAp = Number(ex.credit || 0) - Number(ex.debit || 0);
    deltaRows.push({
      sourceRowId: ex.journal_line_id,
      sourceType: 'journal_line',
      documentRef: ex.entry_no || ex.journal_entry_id,
      operationalEffect: '—',
      glEffect: (isArSlice ? glNetAsset : glNetAp).toFixed(2),
      delta: '—',
      reasonBucket: 'orphan_unmatched_je',
    });
  }

  return {
    params,
    isArSlice,
    operationalRpcRecv,
    operationalRpcPay,
    partyGlAr,
    partyGlAp,
    primaryOperational,
    primaryPartyGl,
    primaryDelta,
    companyUnmappedAr,
    companyUnmappedAp,
    allocTotals,
    customerLedgerSummary,
    supplierLedgerClosing,
    operationalMovementRows,
    glEntriesFiltered,
    glEntriesRaw: glRaw,
    deltaRows,
    exceptions,
    errors,
  };
}
