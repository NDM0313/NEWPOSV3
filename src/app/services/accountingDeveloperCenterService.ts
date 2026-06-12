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
  fetchJournalExplorer,
  type TraceSearchResult,
  type JournalTraceRow,
  type JournalExplorerRow,
} from '@/app/services/developerAccountingDiagnosticsService';
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
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
import {
  buildRoznamchaTraceCandidates,
  defaultRoznamchaTraceDateRange,
  type RoznamchaTraceCandidateView,
} from '@/app/lib/roznamchaTraceDiagnostics';
import { getRoznamchaTraceDiagnostics } from '@/app/services/roznamchaService';
import { listIntegrityIssues, type IntegrityLabIssueRow } from '@/app/services/integrityIssueRepository';
import { numberingMaintenanceService } from '@/app/services/numberingMaintenanceService';
import {
  buildNumberingDryRunPreviews,
  integrityIssueToDryRunPreview,
  type NumberingDryRunRow,
  type RepairDryRunPreview,
} from '@/app/lib/repairQueueDryRun';
import { openingBalanceJournalService } from '@/app/services/openingBalanceJournalService';
import {
  classifyOpeningBalanceGap,
  openingBalanceRowMatchesQuery,
  type OpeningBalanceGapRow,
  type OpeningBalanceEntityType,
} from '@/app/lib/openingBalanceDiagnostics';
import {
  defaultAuditLogDateRange,
  mapPartyRepairAuditRow,
  mapDeveloperRepairAuditRow,
  type DeveloperCenterAuditRow,
} from '@/app/lib/developerCenterAuditLog';
import {
  computeDayBookPeriodBalance,
  dayBookLineMatchesQuery,
  defaultDayBookDiagnosticsDateRange,
  findUnbalancedVouchers,
  type DayBookLineInput,
  type UnbalancedVoucherRow,
} from '@/app/lib/dayBookDiagnostics';
import { buildPaymentTraceView, type PaymentTraceView } from '@/app/lib/paymentTraceDiagnostics';
import {
  buildExcludedRentalPaymentCandidate,
  buildExcludedVoidPaymentCandidate,
  defaultStatementTraceDateRange,
  mapStatementTransactionToCandidate,
  mergeStatementCandidates,
  statementRowMatchesQuery,
  type StatementTraceCandidateView,
} from '@/app/lib/statementTraceDiagnostics';

export type { PaymentTraceView };

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
  type: string;
  parentId: string | null;
  isControl: boolean;
  isGroup: boolean;
  description: string | null;
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  firstUsed: string | null;
  lastUsed: string | null;
  modules: string[];
  editSafety: ReturnType<typeof classifyAccountEditSafety>;
  safeToEdit: boolean;
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
  const code = String(account.code || '').trim();
  const isControl = ['1100', '2000', '1000', '1010', '1020', '3000', '2010'].includes(code);
  const editSafety = classifyAccountEditSafety(mapped, lineCount);
  return {
    accountId,
    code,
    name: String(account.name || ''),
    type: String(account.type || ''),
    parentId: (account.parent_id as string | null) ?? null,
    isControl,
    isGroup: account.is_group === true,
    description: (account as { description?: string | null }).description ?? null,
    lineCount,
    totalDebit,
    totalCredit,
    firstUsed,
    lastUsed,
    modules: inferModulesFromReferenceTypes(usageAgg.referenceTypes),
    editSafety,
    safeToEdit: !editSafety.cannotTouch || editSafety.canEditName,
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

export interface RoznamchaTraceSnapshot {
  query: string;
  dateFrom: string;
  dateTo: string;
  preCount: number;
  postCount: number;
  candidates: RoznamchaTraceCandidateView[];
  loadedAt: string;
}

/** Read-only Roznamcha inclusion/dedupe diagnostic (Phase C2). */
export async function loadRoznamchaTraceSnapshot(
  companyId: string,
  query: string,
  dateFrom?: string,
  dateTo?: string,
  branchId: string | null = null
): Promise<RoznamchaTraceSnapshot> {
  const defaults = defaultRoznamchaTraceDateRange();
  const from = dateFrom?.slice(0, 10) || defaults.dateFrom;
  const to = dateTo?.slice(0, 10) || defaults.dateTo;
  const { preDedupe, postDedupe } = await getRoznamchaTraceDiagnostics(companyId, branchId, from, to);
  const candidates = buildRoznamchaTraceCandidates(preDedupe, postDedupe, query);
  return {
    query: query.trim(),
    dateFrom: from,
    dateTo: to,
    preCount: preDedupe.length,
    postCount: postDedupe.length,
    candidates,
    loadedAt: new Date().toISOString(),
  };
}

export interface StatementTraceSnapshot {
  query: string;
  contactId: string | null;
  contactName: string | null;
  dateFrom: string;
  dateTo: string;
  statementRowCount: number;
  candidates: StatementTraceCandidateView[];
  resolveHints: string[];
  loadedAt: string;
}

async function resolveStatementContactFromQuery(
  companyId: string,
  query: string
): Promise<{ contactId: string | null; contactName: string | null; hints: string[] }> {
  const q = query.trim();
  if (!q) return { contactId: null, contactName: null, hints: [] };
  const hints: string[] = [];

  const { data: payHits } = await supabase
    .from('payments')
    .select('contact_id, reference_number, contacts(name)')
    .eq('company_id', companyId)
    .ilike('reference_number', `%${q}%`)
    .not('contact_id', 'is', null)
    .limit(5);

  for (const row of payHits || []) {
    const cid = (row as { contact_id?: string }).contact_id;
    if (!cid) continue;
    const name = ((row as { contacts?: { name?: string } }).contacts?.name) || '';
    hints.push(`payments.reference_number match → contact ${name || cid}`);
    return { contactId: cid, contactName: name, hints };
  }

  const { data: rpHits } = await supabase
    .from('rental_payments')
    .select('reference, rentals!inner(id, customer_id, customer_name, company_id)')
    .ilike('reference', `%${q}%`)
    .limit(10);

  for (const row of rpHits || []) {
    const rental = (row as { rentals?: { customer_id?: string; customer_name?: string; company_id?: string } })
      .rentals;
    if (!rental || rental.company_id !== companyId || !rental.customer_id) continue;
    hints.push(`rental_payments.reference match → contact ${rental.customer_name || rental.customer_id}`);
    return {
      contactId: rental.customer_id,
      contactName: rental.customer_name || null,
      hints,
    };
  }

  return { contactId: null, contactName: null, hints };
}

async function fetchStatementExclusionProbes(
  companyId: string,
  contactId: string,
  contactName: string,
  query: string,
  dateFrom: string,
  dateTo: string
): Promise<StatementTraceCandidateView[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: StatementTraceCandidateView[] = [];

  const { data: rentals } = await supabase
    .from('rentals')
    .select('id')
    .eq('company_id', companyId)
    .eq('customer_id', contactId);
  const rentalIds = (rentals || []).map((r: { id: string }) => r.id);
  if (rentalIds.length === 0) return out;

  const { data: rpRows } = await supabase
    .from('rental_payments')
    .select('id, reference, amount, payment_date, journal_entry_id, voided_at')
    .in('rental_id', rentalIds)
    .ilike('reference', `%${q}%`);

  for (const rp of rpRows || []) {
    const d = String((rp as { payment_date?: string }).payment_date || '').slice(0, 10);
    const inRange = (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    const jeId = (rp as { journal_entry_id?: string | null }).journal_entry_id;
    if (jeId || !inRange) {
      out.push(
        buildExcludedRentalPaymentCandidate({
          id: String((rp as { id: string }).id),
          ref: String((rp as { reference?: string }).reference || ''),
          date: d,
          amount: Number((rp as { amount?: number }).amount) || 0,
          contactId,
          contactName,
          journalEntryId: jeId,
          inDateRange: inRange,
        })
      );
    }
  }

  const { data: voidPays } = await supabase
    .from('payments')
    .select('id, reference_number, payment_date, amount, voided_at')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .not('voided_at', 'is', null)
    .ilike('reference_number', `%${q}%`);

  for (const p of voidPays || []) {
    out.push(
      buildExcludedVoidPaymentCandidate({
        id: String((p as { id: string }).id),
        ref: String((p as { reference_number?: string }).reference_number || ''),
        date: String((p as { payment_date?: string }).payment_date || '').slice(0, 10),
        amount: Number((p as { amount?: number }).amount) || 0,
        contactId,
        contactName,
      })
    );
  }

  return out;
}

/** Read-only party statement inclusion diagnostic (Phase C3). */
export async function loadStatementTraceSnapshot(
  companyId: string,
  query: string,
  contactId?: string | null,
  dateFrom?: string,
  dateTo?: string
): Promise<StatementTraceSnapshot> {
  const defaults = defaultStatementTraceDateRange();
  const from = dateFrom?.slice(0, 10) || defaults.dateFrom;
  const to = dateTo?.slice(0, 10) || defaults.dateTo;
  const q = query.trim();

  let cId = contactId?.trim() || null;
  let contactName: string | null = null;
  let resolveHints: string[] = [];

  if (!cId && q) {
    const resolved = await resolveStatementContactFromQuery(companyId, q);
    cId = resolved.contactId;
    contactName = resolved.contactName;
    resolveHints = resolved.hints;
  } else if (cId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('name')
      .eq('company_id', companyId)
      .eq('id', cId)
      .maybeSingle();
    contactName = (contact as { name?: string } | null)?.name || null;
  }

  if (!cId) {
    return {
      query: q,
      contactId: null,
      contactName: null,
      dateFrom: from,
      dateTo: to,
      statementRowCount: 0,
      candidates: [],
      resolveHints,
      loadedAt: new Date().toISOString(),
    };
  }

  const transactions = await customerLedgerAPI.getTransactions(cId, companyId, from, to, {
    paymentScope: 'live',
  });
  const included = transactions
    .filter((tx) => statementRowMatchesQuery(tx, q))
    .map((tx) => mapStatementTransactionToCandidate(tx, cId!, contactName || ''));

  const excluded = await fetchStatementExclusionProbes(
    companyId,
    cId,
    contactName || '',
    q,
    from,
    to
  );
  const candidates = mergeStatementCandidates(included, excluded);

  return {
    query: q,
    contactId: cId,
    contactName,
    dateFrom: from,
    dateTo: to,
    statementRowCount: transactions.length,
    candidates,
    resolveHints,
    loadedAt: new Date().toISOString(),
  };
}

export interface DayBookDiagnosticsSnapshot {
  query: string;
  dateFrom: string;
  dateTo: string;
  periodBalance: ReturnType<typeof computeDayBookPeriodBalance>;
  unbalancedVouchers: UnbalancedVoucherRow[];
  matchingLines: DayBookLineInput[];
  truncationWarning: string | null;
  loadedAt: string;
}

/** Read-only Day Book unbalanced JE diagnostic (Phase C4). */
export async function loadDayBookDiagnostics(
  companyId: string,
  query: string,
  dateFrom?: string,
  dateTo?: string,
  includeVoid = false
): Promise<DayBookDiagnosticsSnapshot> {
  const defaults = defaultDayBookDiagnosticsDateRange();
  const from = dateFrom?.slice(0, 10) || defaults.dateFrom;
  const to = dateTo?.slice(0, 10) || defaults.dateTo;
  const q = query.trim();

  let supaQ = supabase
    .from('journal_entries')
    .select(
      `id, entry_no, entry_date, reference_type, is_void,
       lines:journal_entry_lines(debit, credit, account:accounts(name, code))`
    )
    .eq('company_id', companyId)
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: true })
    .limit(500);

  if (!includeVoid) {
    supaQ = supaQ.or('is_void.is.null,is_void.eq.false');
  }

  const { data, error } = await supaQ;
  if (error) throw new Error(error.message);

  const lines: DayBookLineInput[] = [];
  for (const hdr of data || []) {
    const h = hdr as Record<string, unknown>;
    const jeId = String(h.id);
    const voucher = String(h.entry_no || jeId.slice(0, 8));
    const entryDate = String(h.entry_date || '').slice(0, 10);
    const referenceType = String(h.reference_type || '');
    const isVoid = h.is_void === true;
    const rawLines = h.lines as Array<Record<string, unknown>> | undefined;
    for (const ln of rawLines || []) {
      const acct = ln.account as { name?: string; code?: string } | undefined;
      const accountLabel = acct ? `${acct.code || ''} ${acct.name || ''}`.trim() : '—';
      lines.push({
        journalEntryId: jeId,
        voucher,
        entryDate,
        referenceType,
        debit: Number(ln.debit) || 0,
        credit: Number(ln.credit) || 0,
        isVoid,
        accountLabel,
      });
    }
  }

  const matchingLines = q ? lines.filter((l) => dayBookLineMatchesQuery(l, q)) : lines;
  const periodBalance = computeDayBookPeriodBalance(lines);
  const unbalancedVouchers = findUnbalancedVouchers(lines);
  const filteredUnbalanced = q
    ? unbalancedVouchers.filter((v) =>
        dayBookLineMatchesQuery(
          {
            journalEntryId: v.journalEntryId,
            voucher: v.voucher,
            entryDate: v.entryDate,
            referenceType: v.referenceType,
            debit: 0,
            credit: 0,
            isVoid: false,
            accountLabel: '',
          },
          q
        )
      )
    : unbalancedVouchers;

  return {
    query: q,
    dateFrom: from,
    dateTo: to,
    periodBalance,
    unbalancedVouchers: filteredUnbalanced,
    matchingLines: matchingLines.slice(0, 200),
    truncationWarning:
      (data || []).length >= 500 ? 'Capped at 500 journal headers — widen dates if totals look wrong.' : null,
    loadedAt: new Date().toISOString(),
  };
}

/** Payment-first trace layout (Phase C5). */
export async function loadPaymentTraceSnapshot(
  companyId: string,
  query: string,
  mode: TraceMode = 'auto'
): Promise<PaymentTraceView> {
  const trace = await runTransactionTrace(companyId, query, mode);
  return buildPaymentTraceView(trace, query);
}

export interface JournalIntegrityBrowseSnapshot {
  query: string;
  dateFrom: string;
  dateTo: string;
  suspiciousOnly: boolean;
  rows: JournalExplorerRow[];
  loadedAt: string;
}

/** Browse-only journal explorer (Phase C6) — no void/repair exports. */
export async function loadJournalIntegrityBrowse(
  companyId: string,
  opts?: {
    query?: string;
    dateFrom?: string;
    dateTo?: string;
    suspiciousOnly?: boolean;
    limit?: number;
  }
): Promise<JournalIntegrityBrowseSnapshot> {
  const defaults = defaultDayBookDiagnosticsDateRange();
  const from = opts?.dateFrom?.slice(0, 10) || defaults.dateFrom;
  const to = opts?.dateTo?.slice(0, 10) || defaults.dateTo;
  const q = opts?.query?.trim() || '';
  const rows = await fetchJournalExplorer(companyId, {
    dateFrom: from,
    dateTo: to,
    suspiciousOnly: opts?.suspiciousOnly ?? false,
    isVoid: 'all',
    limit: opts?.limit ?? 60,
  });
  const filtered = q
    ? rows.filter((r) => {
        const hay = [r.je.entry_no, r.je.reference_type, r.je.id, r.summary, r.uiRef?.displayRef]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : rows;
  return {
    query: q,
    dateFrom: from,
    dateTo: to,
    suspiciousOnly: opts?.suspiciousOnly ?? false,
    rows: filtered,
    loadedAt: new Date().toISOString(),
  };
}

export interface RepairQueueSnapshot {
  issues: IntegrityLabIssueRow[];
  issuePreviews: RepairDryRunPreview[];
  numberingRows: NumberingDryRunRow[];
  loadedAt: string;
}

/** Repair queue dry-run snapshot (Phase D) � preview only. Expense mismatch search is on-demand in Repair Queue tab. */
export async function loadRepairQueueSnapshot(companyId: string): Promise<RepairQueueSnapshot> {
  const [issues, numberingRows] = await Promise.all([
    listIntegrityIssues(companyId, { hideResolved: true, limit: 100 }),
    numberingMaintenanceService.analyze(companyId),
  ]);
  return {
    issues,
    issuePreviews: issues.slice(0, 50).map(integrityIssueToDryRunPreview),
    numberingRows: buildNumberingDryRunPreviews(numberingRows),
    loadedAt: new Date().toISOString(),
  };
}

export interface SafeSequenceSyncResult {
  success: boolean;
  documentType: string;
  message: string;
  updated: boolean;
}

/** Phase E — sequence sync via controlled repair registry (Phase F). */
export async function applySafeSequenceSync(
  companyId: string,
  documentType: string,
  ctx?: { userId: string | null; userRole: string | null; confirmPhrase?: string }
): Promise<SafeSequenceSyncResult> {
  const { applySafeSequenceSyncViaRegistry } = await import('./developerRepairService');
  const { SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE } = await import('@/app/lib/repairQueueDryRun');
  const confirmPhrase = ctx?.confirmPhrase ?? SAFE_SEQUENCE_SYNC_CONFIRM_PHRASE;
  const res = await applySafeSequenceSyncViaRegistry(companyId, documentType, confirmPhrase, {
    userId: ctx?.userId ?? null,
    userRole: ctx?.userRole ?? null,
  });
  return {
    success: res.ok,
    documentType,
    message: res.message || res.error || (res.ok ? 'Sequence synced' : 'Apply failed'),
    updated: res.ok && !String(res.message || '').includes('already in sync'),
  };
}

const OB_REF = openingBalanceJournalService.OPENING_BALANCE_REFERENCE;

function openingJePrimaryAmount(lines: Array<{ debit?: number; credit?: number }>): number {
  let max = 0;
  for (const l of lines) {
    max = Math.max(max, Number(l.debit) || 0, Number(l.credit) || 0);
  }
  return max;
}

async function loadOpeningJeSnapshot(
  companyId: string,
  referenceType: string,
  referenceId: string
): Promise<{ entryNo: string | null; jeAmount: number | null; hasJe: boolean }> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_no, lines:journal_entry_lines(debit, credit)')
    .eq('company_id', companyId)
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { entryNo: null, jeAmount: null, hasJe: false };
  const lines = (data as { lines?: Array<{ debit?: number; credit?: number }> }).lines || [];
  const mag = openingJePrimaryAmount(lines);
  return {
    entryNo: String((data as { entry_no?: string }).entry_no || '') || null,
    jeAmount: mag > 0 ? mag : null,
    hasJe: lines.length > 0,
  };
}

export interface OpeningBalanceDiagnosticsSnapshot {
  query: string;
  rows: OpeningBalanceGapRow[];
  scannedContacts: number;
  loadedAt: string;
}

/** Opening balance gap preview (Phase E) — read-only, no OB sync apply. */
export async function loadOpeningBalanceDiagnostics(
  companyId: string,
  query = '',
  limit = 100
): Promise<OpeningBalanceDiagnosticsSnapshot> {
  const q = query.trim();
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, name, type, opening_balance, supplier_opening_balance')
    .eq('company_id', companyId)
    .order('name', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows: OpeningBalanceGapRow[] = [];
  for (const c of contacts || []) {
    const contactId = String((c as { id: string }).id);
    const name = String((c as { name?: string }).name || contactId.slice(0, 8));
    const type = String((c as { type?: string }).type || '').toLowerCase();

    const legs: Array<{ entityType: OpeningBalanceEntityType; operational: number; refType: string }> = [];
    if (type === 'customer' || type === 'both') {
      legs.push({
        entityType: 'contact_ar',
        operational: Number((c as { opening_balance?: number }).opening_balance) || 0,
        refType: OB_REF.CONTACT_AR,
      });
    }
    if (type === 'supplier' || type === 'both') {
      const supOb = (c as { supplier_opening_balance?: number | null }).supplier_opening_balance;
      const ob = (c as { opening_balance?: number }).opening_balance;
      const apOp =
        type === 'supplier'
          ? supOb != null && Math.abs(Number(supOb) || 0) >= 0.02
            ? Number(supOb) || 0
            : Number(ob) || 0
          : Number(supOb) || 0;
      legs.push({
        entityType: 'contact_ap',
        operational: apOp,
        refType: OB_REF.CONTACT_AP,
      });
    }

    for (const leg of legs) {
      const je = await loadOpeningJeSnapshot(companyId, leg.refType, contactId);
      const signedJe =
        je.jeAmount != null && leg.operational < 0 ? -Math.abs(je.jeAmount) : je.jeAmount;
      const classified = classifyOpeningBalanceGap({
        operationalOpening: leg.operational,
        jeAmount: signedJe,
        hasJe: je.hasJe,
      });
      const row: OpeningBalanceGapRow = {
        rowId: `${leg.entityType}-${contactId}`,
        entityType: leg.entityType,
        entityId: contactId,
        entityName: name,
        operationalOpening: leg.operational,
        jeEntryNo: je.entryNo,
        jeAmount: signedJe,
        gap: classified.gap,
        status: classified.status,
        reason: classified.reason,
      };
      if (row.status === 'no_opening' && q) continue;
      if (q && !openingBalanceRowMatchesQuery(row, q)) continue;
      rows.push(row);
    }
  }

  return {
    query: q,
    rows,
    scannedContacts: (contacts || []).length,
    loadedAt: new Date().toISOString(),
  };
}

export interface DeveloperCenterAuditLogSnapshot {
  dateFrom: string;
  dateTo: string;
  rows: DeveloperCenterAuditRow[];
  truncationWarning: string | null;
  loadedAt: string;
}

/** Read-only audit log (Phase E) — party_repair_audit + resolved integrity issues. */
export async function loadDeveloperCenterAuditLog(
  companyId: string,
  dateFrom?: string,
  dateTo?: string,
  limit = 200
): Promise<DeveloperCenterAuditLogSnapshot> {
  const defaults = defaultAuditLogDateRange();
  const from = dateFrom?.slice(0, 10) || defaults.dateFrom;
  const to = dateTo?.slice(0, 10) || defaults.dateTo;

  const rows: DeveloperCenterAuditRow[] = [];

  const { data: partyRows, error: partyErr } = await supabase
    .from('party_repair_audit')
    .select('id, created_at, table_name, row_id, column_name, old_value, new_value, reason_code, applied_by')
    .eq('company_id', companyId)
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (partyErr && !String(partyErr.message).includes('does not exist')) {
    throw new Error(partyErr.message);
  }
  for (const r of partyRows || []) {
    rows.push(mapPartyRepairAuditRow(r as Parameters<typeof mapPartyRepairAuditRow>[0]));
  }

  const { data: devRepairRows, error: devRepairErr } = await supabase
    .from('developer_repair_audit')
    .select(
      'id, created_at, action_id, target_table, target_id, before_json, after_json, status, user_id, confirm_phrase, error_message'
    )
    .eq('company_id', companyId)
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`)
    .order('created_at', { ascending: false })
    .limit(Math.max(0, limit - rows.length));

  if (devRepairErr && !String(devRepairErr.message).includes('does not exist')) {
    throw new Error(devRepairErr.message);
  }
  for (const r of devRepairRows || []) {
    rows.push(mapDeveloperRepairAuditRow(r as Parameters<typeof mapDeveloperRepairAuditRow>[0]));
  }

  const { data: resolvedIssues } = await supabase
    .from('integrity_lab_issues')
    .select('id, resolved_at, rule_code, rule_message, resolved_by, module, source_id')
    .eq('company_id', companyId)
    .not('resolved_at', 'is', null)
    .gte('resolved_at', `${from}T00:00:00`)
    .lte('resolved_at', `${to}T23:59:59`)
    .order('resolved_at', { ascending: false })
    .limit(Math.max(0, limit - rows.length));

  for (const issue of resolvedIssues || []) {
    const i = issue as {
      id: string;
      resolved_at: string;
      rule_code: string;
      rule_message: string | null;
      resolved_by: string | null;
      module: string | null;
      source_id: string | null;
    };
    rows.push({
      id: `ili-${i.id}`,
      timestamp: i.resolved_at,
      action: 'integrity_issue_resolved',
      entityType: i.module || 'integrity_lab',
      entityId: i.source_id || i.id,
      actorId: i.resolved_by,
      before: i.rule_code,
      after: 'resolved',
      reasonCode: i.rule_message || i.rule_code,
      source: 'integrity_lab',
    });
  }

  rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return {
    dateFrom: from,
    dateTo: to,
    rows: rows.slice(0, limit),
    truncationWarning: (partyRows || []).length >= limit ? `Capped at ${limit} party_repair_audit rows` : null,
    loadedAt: new Date().toISOString(),
  };
}
