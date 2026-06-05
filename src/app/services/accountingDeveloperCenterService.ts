/**
 * Read-only facade for Accounting Developer Center (Phase B).
 * MUST NOT import repair/write services.
 */

import { supabase } from '@/lib/supabase';
import { accountService } from '@/app/services/accountService';
import { runFullAccountingAudit } from '@/app/services/fullAccountingAuditService';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import {
  runTraceSearch,
  type TraceSearchResult,
  type JournalTraceRow,
} from '@/app/services/developerAccountingDiagnosticsService';
import {
  classifyAccountEditSafety,
  findDuplicateCodes,
  findDuplicateNamesUnderParent,
  findMissingSystemAccounts,
  aggregateJournalLineUsage,
  inferModulesFromReferenceTypes,
  isNonVoidJournalEntry,
  mapFullAuditIssues,
  type CoaAccountRow,
  type CoaHealthIssue,
  type JournalLineUsageInput,
} from '@/app/lib/coaHealthChecks';
import { evaluateReportVisibility, type ReportVisibility } from '@/app/lib/transactionTraceReportVisibility';
import { journalHasLiquidityLine } from '@/app/lib/transactionTraceLiquidity';

export type TraceMode = 'auto' | 'entry_no' | 'payment_ref' | 'sale' | 'purchase' | 'reference' | 'account_code' | 'uuid';

export interface CoaHealthSnapshot {
  scannedAccounts: number;
  issues: CoaHealthIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
    inactiveUsed: number;
    balanceVariances: number;
  };
  loadedAt: string;
}

export interface AccountUsageDetail {
  accountId: string;
  code: string;
  name: string;
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  firstUsed: string | null;
  lastUsed: string | null;
  modules: string[];
  editSafety: ReturnType<typeof classifyAccountEditSafety>;
  journalBalance: number;
  storedBalance: number;
  balanceVariance: number;
}

export interface TransactionTracePaymentRow {
  id: string;
  reference_number?: string | null;
  reference_type?: string | null;
  amount?: number | null;
  payment_date?: string | null;
  branch_id?: string | null;
  contact_id?: string | null;
  journal_entry_id?: string | null;
  voided_at?: string | null;
}

export interface TransactionTraceRentalPaymentRow {
  id: string;
  rental_id?: string | null;
  amount?: number | null;
  payment_date?: string | null;
  journal_entry_id?: string | null;
  reference_number?: string | null;
}

export interface BranchChainLink {
  layer: string;
  branchId: string | null;
  label: string;
}

export interface JournalReportVisibility {
  journalId: string;
  entryNo: string | null;
  referenceType: string | null;
  visibility: ReportVisibility;
}

export interface TransactionTraceResult extends TraceSearchResult {
  payments: TransactionTracePaymentRow[];
  rentalPayments: TransactionTraceRentalPaymentRow[];
  branchChain: BranchChainLink[];
  reportVisibility: ReportVisibility[];
  reportVisibilityByJournal: JournalReportVisibility[];
  multipleEntryNoMatches: string[];
}

const BALANCE_EPS = 0.02;

function journalEntryFromLineRow(row: Record<string, unknown>): JournalLineUsageInput['journalEntry'] {
  const je = row.journal_entries;
  if (!je) return null;
  const entry = (Array.isArray(je) ? je[0] : je) as Record<string, unknown>;
  return {
    entry_date: entry.entry_date as string | null | undefined,
    reference_type: entry.reference_type as string | null | undefined,
    company_id: entry.company_id as string | null | undefined,
    is_void: entry.is_void as boolean | null | undefined,
  };
}

function mapAccount(a: Record<string, unknown>): CoaAccountRow {
  return {
    id: String(a.id),
    code: a.code as string | null,
    name: a.name as string | null,
    type: a.type as string | null,
    parent_id: a.parent_id as string | null,
    is_active: a.is_active as boolean | null,
    is_group: a.is_group as boolean | null,
    balance: Number(a.balance) || 0,
  };
}

export async function loadCoaHealthSnapshot(companyId: string): Promise<CoaHealthSnapshot> {
  const [audit, rawAccounts] = await Promise.all([
    runFullAccountingAudit(companyId),
    accountService.getAllAccounts(companyId),
  ]);
  const accounts = (rawAccounts || []).map((a) => mapAccount(a as Record<string, unknown>));

  const issues: CoaHealthIssue[] = [
    ...mapFullAuditIssues(audit.issues),
    ...findDuplicateCodes(accounts),
    ...findDuplicateNamesUnderParent(accounts),
    ...findMissingSystemAccounts(accounts),
  ];

  const inactiveIds = accounts.filter((a) => a.is_active === false).map((a) => a.id);
  let inactiveUsed = 0;

  if (inactiveIds.length > 0) {
    const { data: usedLines } = await supabase
      .from('journal_entry_lines')
      .select('account_id, journal_entries!inner(company_id, is_void)')
      .eq('journal_entries.company_id', companyId)
      .in('account_id', inactiveIds.slice(0, 200))
      .limit(500);

    const usedSet = new Set<string>();
    for (const row of usedLines || []) {
      const r = row as Record<string, unknown>;
      if (!isNonVoidJournalEntry(journalEntryFromLineRow(r))) continue;
      const aid = r.account_id as string | undefined;
      if (aid) usedSet.add(aid);
    }
    inactiveUsed = usedSet.size;
    for (const a of accounts) {
      if (a.is_active === false && usedSet.has(a.id)) {
        issues.push({
          severity: 'warning',
          checkId: 'INACTIVE_BUT_USED',
          accountId: a.id,
          accountCode: String(a.code || ''),
          accountName: String(a.name || ''),
          detail: 'Account is inactive but has non-void journal lines.',
        });
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const journalBalances = await accountingReportsService.getAccountBalancesFromJournal(companyId, today);
  let balanceVariances = 0;

  for (const a of accounts) {
    const jb = journalBalances[a.id] ?? 0;
    const stored = Number(a.balance) || 0;
    const variance = Math.round((stored - jb) * 100) / 100;
    if (Math.abs(variance) >= BALANCE_EPS) {
      balanceVariances += 1;
      issues.push({
        severity: 'info',
        checkId: 'BALANCE_CACHE_VARIANCE',
        accountId: a.id,
        accountCode: String(a.code || ''),
        accountName: String(a.name || ''),
        detail: `accounts.balance (${stored}) ≠ journal truth (${jb}); variance ${variance}.`,
      });
    }
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const info = issues.filter((i) => i.severity === 'info').length;

  return {
    scannedAccounts: accounts.length,
    issues,
    summary: { errors, warnings, info, inactiveUsed, balanceVariances },
    loadedAt: new Date().toISOString(),
  };
}

export async function loadAccountUsage(companyId: string, accountId: string): Promise<AccountUsageDetail | null> {
  const rawAccounts = await accountService.getAllAccounts(companyId);
  const account = (rawAccounts || []).find((a) => a.id === accountId);
  if (!account) return null;

  const { data: lines, error } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit, journal_entries!inner(entry_date, reference_type, company_id, is_void)')
    .eq('account_id', accountId)
    .eq('journal_entries.company_id', companyId)
    .limit(5000);

  if (error) throw new Error(error.message);

  const usageInputs: JournalLineUsageInput[] = (lines || []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      debit: r.debit as number | null | undefined,
      credit: r.credit as number | null | undefined,
      journalEntry: journalEntryFromLineRow(r),
    };
  });
  const usageAgg = aggregateJournalLineUsage(usageInputs, companyId);
  const { lineCount, totalDebit, totalCredit, firstUsed, lastUsed } = usageAgg;
  const today = new Date().toISOString().slice(0, 10);
  const journalBalances = await accountingReportsService.getAccountBalancesFromJournal(companyId, today);
  const journalBalance = journalBalances[accountId] ?? 0;
  const storedBalance = Number((account as { balance?: number }).balance) || 0;

  const mapped = mapAccount(account as Record<string, unknown>);
  return {
    accountId,
    code: String(account.code || ''),
    name: String(account.name || ''),
    lineCount,
    totalDebit,
    totalCredit,
    firstUsed,
    lastUsed,
    modules: inferModulesFromReferenceTypes(usageAgg.referenceTypes),
    editSafety: classifyAccountEditSafety(mapped, lineCount),
    journalBalance,
    storedBalance,
    balanceVariance: Math.round((storedBalance - journalBalance) * 100) / 100,
  };
}

function mapPaymentJeIds(trace: TraceSearchResult): Map<string, string> {
  const byPaymentId = new Map<string, string>();
  for (const j of trace.journals) {
    if (j.payment_id && !byPaymentId.has(j.payment_id)) {
      byPaymentId.set(j.payment_id, j.id);
    }
  }
  return byPaymentId;
}

function mapRentalPaymentRow(row: Record<string, unknown>): TransactionTraceRentalPaymentRow {
  const ref = row.reference ?? row.reference_number;
  return {
    id: String(row.id),
    rental_id: (row.rental_id as string | null) ?? null,
    amount: (row.amount as number | null) ?? null,
    payment_date: (row.payment_date as string | null) ?? null,
    journal_entry_id: (row.journal_entry_id as string | null) ?? null,
    reference_number: ref != null ? String(ref) : null,
  };
}

async function fetchPaymentsForTrace(companyId: string, trace: TraceSearchResult): Promise<TransactionTracePaymentRow[]> {
  const ids = new Set<string>();
  for (const e of trace.entities) {
    if (e.kind === 'payment') ids.add(e.id);
  }
  for (const j of trace.journals) {
    if (j.payment_id) ids.add(j.payment_id);
    if (j.reference_type === 'payment' && j.reference_id) ids.add(j.reference_id);
  }
  if (!ids.size) return [];

  const { data, error } = await supabase
    .from('payments')
    .select('id, reference_number, reference_type, amount, payment_date, branch_id, contact_id, voided_at')
    .eq('company_id', companyId)
    .in('id', [...ids]);

  if (error) throw new Error(error.message);

  const jeByPaymentId = mapPaymentJeIds(trace);
  return (data || []).map((row) => {
    const p = row as TransactionTracePaymentRow;
    return {
      ...p,
      journal_entry_id: jeByPaymentId.get(p.id) ?? null,
    };
  });
}

async function fetchRentalPayments(companyId: string, trace: TraceSearchResult): Promise<TransactionTraceRentalPaymentRow[]> {
  const jeIds = trace.journals.map((j) => j.id);
  const rentalEntityIds = trace.entities
    .filter((e) => /^REN-/i.test(e.label) || String(e.extra?.rentalId || e.extra?.rental_id || '').length > 0)
    .map((e) => String(e.extra?.rental_id || e.id));
  const rentalPaymentIds = trace.entities
    .filter((e) => e.extra?.rental_payment_id)
    .map((e) => String(e.extra?.rental_payment_id));

  const queries: Promise<{ data: unknown }>[] = [];
  const rentalSelect = 'id, rental_id, amount, payment_date, journal_entry_id, reference';

  if (rentalPaymentIds.length) {
    queries.push(
      supabase
        .from('rental_payments')
        .select(`${rentalSelect}, rentals!inner(company_id)`)
        .eq('rentals.company_id', companyId)
        .in('id', rentalPaymentIds)
        .then((r) => r)
    );
  }
  if (rentalEntityIds.length) {
    queries.push(
      supabase
        .from('rental_payments')
        .select(`${rentalSelect}, rentals!inner(company_id)`)
        .eq('rentals.company_id', companyId)
        .in('rental_id', rentalEntityIds)
        .then((r) => r)
    );
  }
  if (jeIds.length) {
    queries.push(
      supabase
        .from('rental_payments')
        .select(`${rentalSelect}, rentals!inner(company_id)`)
        .eq('rentals.company_id', companyId)
        .in('journal_entry_id', jeIds)
        .then((r) => r)
    );
  }
  if (!queries.length) return [];
  const results = await Promise.all(queries);
  const merged = new Map<string, TransactionTraceRentalPaymentRow>();
  for (const res of results) {
    for (const row of (res.data as Record<string, unknown>[]) || []) {
      const mapped = mapRentalPaymentRow(row);
      if (mapped.id) merged.set(mapped.id, mapped);
    }
  }
  return [...merged.values()];
}

function findDuplicateEntryNos(journals: JournalTraceRow[]): string[] {
  const counts = new Map<string, number>();
  for (const j of journals) {
    const no = String(j.entry_no || '').trim();
    if (!no) continue;
    counts.set(no, (counts.get(no) || 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([no]) => no);
}

function buildBranchChain(trace: TraceSearchResult, payments: TransactionTracePaymentRow[]): BranchChainLink[] {
  const chain: BranchChainLink[] = [];
  for (const e of trace.entities) {
    if (e.branch_id) {
      chain.push({
        layer: e.kind,
        branchId: e.branch_id,
        label: `${e.kind} document → ${e.label}`,
      });
    }
  }
  for (const p of payments) {
    chain.push({
      layer: 'payment',
      branchId: p.branch_id ?? null,
      label: `payment ${p.reference_number || p.id.slice(0, 8)}`,
    });
  }
  for (const j of trace.journals) {
    chain.push({
      layer: 'journal_entry',
      branchId: j.branch_id,
      label: `JE ${j.entry_no || j.id.slice(0, 8)}`,
    });
  }
  return chain;
}

export async function runTransactionTrace(
  companyId: string,
  query: string,
  mode: TraceMode = 'auto'
): Promise<TransactionTraceResult> {
  const trace = await runTraceSearch(companyId, query, mode);
  const [payments, rentalPayments] = await Promise.all([
    fetchPaymentsForTrace(companyId, trace),
    fetchRentalPayments(companyId, trace),
  ]);

  const saleEntity = trace.entities.find((e) => e.kind === 'sale');
  const reportVisibility: ReportVisibility[] = [];
  const reportVisibilityByJournal: JournalReportVisibility[] = [];
  const multipleEntryNoMatches = findDuplicateEntryNos(trace.journals);

  const liquidityByJournalId = new Map<string, boolean>();
  await Promise.all(
    trace.journals.map(async (j) => {
      liquidityByJournalId.set(j.id, await journalHasLiquidityLine(companyId, j));
    })
  );

  const paymentIdsWithRows = new Set(payments.map((p) => p.id));

  if (payments.length) {
    for (const p of payments) {
      const linkedJe = trace.journals.find((j) => j.payment_id === p.id || j.id === p.journal_entry_id);
      const vis = evaluateReportVisibility({
        hasPaymentRow: true,
        hasRentalPaymentRow: rentalPayments.some((rp) => rp.journal_entry_id === linkedJe?.id),
        journalReferenceType: linkedJe?.reference_type,
        journalIsVoid: linkedJe?.is_void,
        paymentVoided: Boolean(p.voided_at),
        paymentContactId: p.contact_id,
        paymentReferenceType: p.reference_type,
        hasLiquidityLine: linkedJe ? (liquidityByJournalId.get(linkedJe.id) ?? false) : true,
        actionFingerprint: null,
        linkedInPaymentsStream: true,
        saleStatus: saleEntity?.status ?? null,
      });
      reportVisibility.push(vis);
      if (linkedJe) {
        reportVisibilityByJournal.push({
          journalId: linkedJe.id,
          entryNo: linkedJe.entry_no,
          referenceType: linkedJe.reference_type,
          visibility: vis,
        });
      }
    }
  }

  for (const j of trace.journals) {
    if (j.payment_id && paymentIdsWithRows.has(j.payment_id)) continue;
    const vis = evaluateReportVisibility({
      hasPaymentRow: false,
      hasRentalPaymentRow: rentalPayments.some((rp) => rp.journal_entry_id === j.id),
      journalReferenceType: j.reference_type,
      journalIsVoid: j.is_void,
      hasLiquidityLine: liquidityByJournalId.get(j.id) ?? false,
      linkedInPaymentsStream: Boolean(j.payment_id),
      saleStatus: saleEntity?.status ?? null,
    });
    reportVisibility.push(vis);
    reportVisibilityByJournal.push({
      journalId: j.id,
      entryNo: j.entry_no,
      referenceType: j.reference_type,
      visibility: vis,
    });
  }

  if (!reportVisibility.length && trace.journals.length === 0) {
    const vis = evaluateReportVisibility({
      hasPaymentRow: false,
      journalReferenceType: null,
    });
    reportVisibility.push(vis);
  }

  return {
    ...trace,
    payments,
    rentalPayments,
    branchChain: buildBranchChain(trace, payments),
    reportVisibility,
    reportVisibilityByJournal,
    multipleEntryNoMatches,
  };
}
