/**
 * CF-1 — Cash Flow report service (read-only). Composes roznamcha stream + enrichment.
 */

import { supabase } from '@/lib/supabase';
import {
  getRoznamcha,
  roznamchaRefDisplay,
  type AccountFilter,
  type RoznamchaRowWithBalance,
} from '@/app/services/roznamchaService';
import type { TransactionAttachment } from '@/app/utils/transactionAttachments';
import { isGenericRoznamchaPartyLabel } from '@/app/lib/roznamchaCounterpartyLabel';
import { branchService } from '@/app/services/branchService';
import {
  CASH_FLOW_SOURCE_MODULE_LABELS,
  computeCashFlowSummary,
  filterCashFlowRowsBySourceModule,
  inferCashFlowSourceModule,
  recomputeCashFlowRunningBalance,
  resolveCashFlowRowStatus,
  type CashFlowSourceModule,
  type CashFlowRowStatus,
  type CashFlowSummary,
} from '@/app/lib/cashFlowReportLogic';

export interface CashFlowRow {
  id: string;
  date: string;
  time: string;
  reference: string;
  journalEntryNo: string | null;
  party: string | null;
  sourceModule: CashFlowSourceModule;
  sourceModuleLabel: string;
  cashAccount: string;
  cashIn: number;
  cashOut: number;
  runningBalance: number;
  status: CashFlowRowStatus;
  branchId: string | null;
  branchName: string | null;
  details: string;
  referenceType: string | null;
  sourcePaymentId: string | null;
  sourceJournalEntryId: string | null;
  sourceRentalPaymentId: string | null;
  attachments?: TransactionAttachment[];
}

export interface CashFlowReportResult {
  rows: CashFlowRow[];
  summary: CashFlowSummary;
  auditMode: boolean;
}

export interface CashFlowReportParams {
  companyId: string;
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  accountFilter?: AccountFilter;
  paymentLedgerAccountId?: string | null;
  auditMode?: boolean;
  sourceModuleFilter?: CashFlowSourceModule | 'all';
}

type PaymentMeta = { reference_type: string | null; voided_at: string | null };
type JeMeta = { reference_type: string | null; is_void: boolean | null };

async function loadPaymentMeta(companyId: string, ids: string[]): Promise<Map<string, PaymentMeta>> {
  const out = new Map<string, PaymentMeta>();
  if (!ids.length) return out;
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const { data } = await supabase
      .from('payments')
      .select('id, reference_type, voided_at')
      .eq('company_id', companyId)
      .in('id', chunk);
    for (const p of data || []) {
      out.set(String(p.id), {
        reference_type: p.reference_type ?? null,
        voided_at: p.voided_at ?? null,
      });
    }
  }
  return out;
}

async function loadJournalMeta(companyId: string, ids: string[]): Promise<Map<string, JeMeta>> {
  const out = new Map<string, JeMeta>();
  if (!ids.length) return out;
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const { data } = await supabase
      .from('journal_entries')
      .select('id, reference_type, is_void')
      .eq('company_id', companyId)
      .in('id', chunk);
    for (const j of data || []) {
      out.set(String(j.id), {
        reference_type: j.reference_type ?? null,
        is_void: j.is_void ?? null,
      });
    }
  }
  return out;
}

function mapRoznamchaToCashFlowRow(
  row: RoznamchaRowWithBalance,
  paymentMeta: Map<string, PaymentMeta>,
  jeMeta: Map<string, JeMeta>,
  branchNameById: Map<string, string>
): CashFlowRow {
  const payId = row.sourcePaymentId ? String(row.sourcePaymentId) : null;
  const jeId = row.sourceJournalEntryId ? String(row.sourceJournalEntryId) : null;
  const pay = payId ? paymentMeta.get(payId) : undefined;
  const je = jeId ? jeMeta.get(jeId) : undefined;
  const referenceType = je?.reference_type ?? pay?.reference_type ?? null;
  const sourceModule = inferCashFlowSourceModule({
    rowType: row.type,
    referenceType,
    rowId: row.id,
  });
  const status = resolveCashFlowRowStatus({
    id: row.id,
    details: row.details,
    rowType: row.type,
    referenceType,
    paymentVoidedAt: pay?.voided_at,
    journalIsVoid: je?.is_void,
    sourcePaymentId: payId,
    sourceJournalEntryId: jeId,
  });
  const branchName = row.branchId ? branchNameById.get(String(row.branchId)) ?? null : null;

  return {
    id: row.id,
    date: row.date,
    time: row.time,
    reference: roznamchaRefDisplay(row),
    journalEntryNo: row.journalEntryNo ?? null,
    party:
      row.partyLine ??
      (!isGenericRoznamchaPartyLabel(row.details) ? row.details : null) ??
      row.referenceDisplay ??
      null,
    sourceModule,
    sourceModuleLabel: CASH_FLOW_SOURCE_MODULE_LABELS[sourceModule],
    cashAccount: (row.accountName ?? row.accountLabel) || '—',
    cashIn: row.cashIn,
    cashOut: row.cashOut,
    runningBalance: row.runningBalance,
    status,
    branchId: row.branchId,
    branchName,
    details: row.details,
    referenceType,
    sourcePaymentId: payId,
    sourceJournalEntryId: jeId,
    sourceRentalPaymentId: row.sourceRentalPaymentId ? String(row.sourceRentalPaymentId) : null,
    attachments: row.attachments,
  };
}

export async function getCashFlowReport(params: CashFlowReportParams): Promise<CashFlowReportResult> {
  const auditMode = params.auditMode === true;
  const accountFilter = params.accountFilter ?? 'all';
  const ledgerId = params.paymentLedgerAccountId?.trim() ? params.paymentLedgerAccountId.trim() : null;

  const roz = await getRoznamcha(
    params.companyId,
    params.branchId,
    params.dateFrom,
    params.dateTo,
    accountFilter,
    auditMode,
    ledgerId
  );

  const paymentIds = [
    ...new Set(roz.rows.map((r) => r.sourcePaymentId).filter(Boolean) as string[]),
  ];
  const jeIds = [
    ...new Set(roz.rows.map((r) => r.sourceJournalEntryId).filter(Boolean) as string[]),
  ];

  const [paymentMeta, jeMeta, branches] = await Promise.all([
    loadPaymentMeta(params.companyId, paymentIds),
    loadJournalMeta(params.companyId, jeIds),
    branchService.getAllBranches(params.companyId),
  ]);

  const branchNameById = new Map<string, string>(
    (branches || []).map((b: { id: string; name: string }) => [String(b.id), String(b.name)])
  );

  let rows = roz.rows.map((r) =>
    mapRoznamchaToCashFlowRow(r, paymentMeta, jeMeta, branchNameById)
  );

  rows = filterCashFlowRowsBySourceModule(rows, params.sourceModuleFilter ?? 'all');
  rows = recomputeCashFlowRunningBalance(rows, roz.summary.openingBalance);
  const summary = computeCashFlowSummary(rows, roz.summary.openingBalance);

  return { rows, summary, auditMode };
}
