/**
 * Ledger & Statement Center V2 — read-only wrapper over canonical GL services
 * (same engine as Accounting → Account Statements).
 * Operational/document adapters are NOT used for official balance — see ledgerStatementCenterV2Diagnostic.ts.
 */
import { accountingService, type AccountLedgerEntry } from '@/app/services/accountingService';
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
import { contactService } from '@/app/services/contactService';
import { accountService } from '@/app/services/accountService';
import { studioService } from '@/app/services/studioService';
import { fetchInBatches } from '@/app/lib/chunkInQuery';
import {
  LEDGER_V2_EMPTY,
  parseTransferSettlementFromDescription,
  pickCounterAccountLabel,
  shouldReplacePaymentMethod,
  type CounterAccountLine,
} from '@/app/lib/ledgerStatementV2Enrichment';
import { supabase } from '@/lib/supabase';
import { resolveLedgerTransactionOpenRef } from '@/app/lib/ledgerTransactionOpenRef';
import type {
  LedgerEntityOption,
  LedgerStatementV2Filters,
  LedgerStatementV2Result,
  LedgerStatementV2Row,
  LedgerStatementV2Summary,
  LedgerStatementV2Type,
  LedgerTransactionTypeFilter,
} from '@/app/features/ledger-statement-center-v2/types';

/** Matches AccountLedgerReportPage — party/account statements use all branches. */
export const STATEMENT_ALL_BRANCHES_SCOPE = undefined;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s?: string | null): boolean {
  return Boolean(s && UUID_RE.test(String(s).trim()));
}

function displaySettlementAccount(e: AccountLedgerEntry): string {
  const counter = String(e.counter_account || '').trim();
  if (counter && !isUuid(counter)) return counter;
  const parsed = parseTransferSettlementFromDescription(e.description || '');
  if (parsed) return parsed;
  const fromNotes = parseTransferSettlementFromDescription(e.notes || '');
  if (fromNotes) return fromNotes;
  return LEDGER_V2_EMPTY;
}

export type LedgerV2EnrichmentOpts = {
  statementType?: LedgerStatementV2Type;
  viewedAccountId?: string | null;
  viewedAccountNames?: string[];
};

const slice200 = <T>(arr: T[]) => arr.slice(0, 200);

const COMPANY_WIDE_BRANCH_LABEL = 'All branches';

function formatBranchLabel(branch?: { name?: string | null; code?: string | null } | null): string {
  const name = String(branch?.name || '').trim();
  const code = String(branch?.code || '').trim();
  if (!name && !code) return LEDGER_V2_EMPTY;
  return code ? `${code} | ${name}` : name;
}

function collectPartyGlAccountNames(rows: LedgerStatementV2Row[]): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    const accountName = String(row.glEntry?.account_name || '').trim();
    if (accountName && !isUuid(accountName)) names.add(accountName);
    const bareName = accountName.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (bareName) names.add(bareName);
  }
  return [...names];
}

async function resolveViewedAccountNames(
  companyId: string,
  opts?: LedgerV2EnrichmentOpts,
): Promise<Set<string>> {
  const names = new Set<string>();
  (opts?.viewedAccountNames || []).forEach((n) => {
    const t = String(n || '').trim();
    if (t) names.add(t);
  });
  if (opts?.viewedAccountId) {
    const { data } = await supabase
      .from('accounts')
      .select('name, code')
      .eq('company_id', companyId)
      .eq('id', opts.viewedAccountId)
      .maybeSingle();
    const name = String((data as { name?: string } | null)?.name || '').trim();
    const code = String((data as { code?: string } | null)?.code || '').trim();
    if (name) {
      names.add(name);
      if (code) names.add(`${name} (${code})`);
    }
  }
  return names;
}

/** Batch-enrich Payment (settlement account) and Created by for V2 rows (legacy + unified loaders). */
export async function enrichLedgerV2PaymentAndAuthorship(
  rows: LedgerStatementV2Row[],
  companyId: string,
  opts?: LedgerV2EnrichmentOpts,
): Promise<void> {
  if (!rows.length) return;

  const viewedAccountIds = new Set<string>();
  if (opts?.viewedAccountId) viewedAccountIds.add(opts.viewedAccountId);

  const viewedAccountNames = await resolveViewedAccountNames(companyId, opts);
  if (opts?.statementType && opts.statementType !== 'account') {
    collectPartyGlAccountNames(rows).forEach((n) => viewedAccountNames.add(n));
  }

  const jeIds = [...new Set(rows.map((r) => r.journalEntryId).filter(Boolean))] as string[];
  let payIds = [...new Set(rows.map((r) => r.paymentId).filter(Boolean))] as string[];

  const jeCreatedBy = new Map<string, string>();
  const jePaymentId = new Map<string, string>();
  const jeBranchLabel = new Map<string, string>();
  const jeCompanyWide = new Set<string>();
  const saleRefByJe = new Map<string, string>();
  const purchaseRefByJe = new Map<string, string>();
  const linesByJe = new Map<string, CounterAccountLine[]>();

  if (jeIds.length) {
    const { data: jeRows } = await supabase
      .from('journal_entries')
      .select(
        'id, created_by, payment_id, branch_id, reference_type, reference_id, branch:branches(name, code)',
      )
      .eq('company_id', companyId)
      .in('id', slice200(jeIds));
    (jeRows || []).forEach(
      (r: {
        id: string;
        created_by?: string | null;
        payment_id?: string | null;
        branch_id?: string | null;
        reference_type?: string | null;
        reference_id?: string | null;
        branch?: { name?: string | null; code?: string | null } | null;
      }) => {
      if (r.created_by) jeCreatedBy.set(r.id, String(r.created_by));
      if (r.payment_id) {
        const pid = String(r.payment_id);
        jePaymentId.set(r.id, pid);
        if (!payIds.includes(pid)) payIds.push(pid);
      }
      const branchLabel = formatBranchLabel(r.branch);
      if (!isLedgerV2Placeholder(branchLabel)) {
        jeBranchLabel.set(r.id, branchLabel);
      } else if (!r.branch_id) {
        jeCompanyWide.add(r.id);
      }
      const refType = normalizeDocType(r.reference_type || '');
      const refId = r.reference_id != null ? String(r.reference_id) : '';
      if (refId) {
        if (refType.includes('purchase')) purchaseRefByJe.set(r.id, refId);
        else if (refType.includes('sale')) saleRefByJe.set(r.id, refId);
      }
    });

    const lineRows = await fetchInBatches(jeIds, async (chunk) => {
      const { data, error } = await supabase
        .from('journal_entry_lines')
        .select('id, journal_entry_id, account_id, account:accounts(id, name, code, type)')
        .in('journal_entry_id', chunk);
      if (error) throw error;
      return data || [];
    });

    for (const line of lineRows as Array<{
      id: string;
      journal_entry_id: string;
      account_id: string;
      account?: { id?: string; name?: string; code?: string; type?: string } | null;
    }>) {
      const jeId = String(line.journal_entry_id || '');
      if (!jeId) continue;
      const acc = line.account;
      const entry: CounterAccountLine = {
        lineId: String(line.id),
        accountId: String(line.account_id || acc?.id || ''),
        name: String(acc?.name || ''),
        code: String(acc?.code || ''),
        type: String(acc?.type || ''),
      };
      const arr = linesByJe.get(jeId) || [];
      arr.push(entry);
      linesByJe.set(jeId, arr);
    }
  }

  const paySettlement = new Map<string, string>();
  const payCreatedBy = new Map<string, string>();
  const payReceivedBy = new Map<string, string>();

  if (payIds.length) {
    const payments = await fetchInBatches(payIds, async (chunk) => {
      const { data, error } = await supabase
        .from('payments')
        .select(
          'id, payment_method, created_by, received_by, payment_account:accounts(name, code)',
        )
        .eq('company_id', companyId)
        .in('id', chunk);
      if (error) throw error;
      return data || [];
    });
    payments.forEach((p: {
      id: string;
      payment_method?: string | null;
      created_by?: string | null;
      received_by?: string | null;
      payment_account?: { name?: string; code?: string } | null;
    }) => {
      const acct = p.payment_account;
      const acctName = acct?.name
        ? acct.code
          ? `${acct.name} (${acct.code})`
          : acct.name
        : '';
      const settlement = acctName || String(p.payment_method || '').trim();
      if (settlement) paySettlement.set(p.id, settlement);
      if (p.created_by) payCreatedBy.set(p.id, String(p.created_by));
      if (p.received_by) payReceivedBy.set(p.id, String(p.received_by));
    });
  }

  for (const row of rows) {
    const jeId = row.journalEntryId;
    const paymentId = row.paymentId || (jeId ? jePaymentId.get(jeId) : undefined);
    if (paymentId && !row.paymentId) row.paymentId = paymentId;

    if (shouldReplacePaymentMethod(row.paymentMethod, viewedAccountNames)) {
      let settlement: string | null = null;

      const counterFromGl = String(row.glEntry?.counter_account || '').trim();
      if (counterFromGl && !isUuid(counterFromGl)) settlement = counterFromGl;

      if (!settlement && jeId) {
        const excludeLineId =
          row.glEntry?.journal_line_id ||
          (row.id && row.id !== jeId && isUuid(row.id) ? row.id : undefined);
        settlement = pickCounterAccountLabel(
          linesByJe.get(jeId) || [],
          excludeLineId,
          viewedAccountIds,
        );
      }

      if (!settlement && paymentId) settlement = paySettlement.get(paymentId) || null;

      if (!settlement) settlement = parseTransferSettlementFromDescription(row.description);
      if (!settlement && row.glEntry?.notes) {
        settlement = parseTransferSettlementFromDescription(row.glEntry.notes);
      }

      row.paymentMethod = settlement || LEDGER_V2_EMPTY;
    }

    const createdByEmpty =
      isLedgerV2Placeholder(row.createdBy) || (row.createdBy && isUuid(row.createdBy));
    if (createdByEmpty) {
      let author: string | undefined;
      if (jeId && jeCreatedBy.has(jeId)) author = jeCreatedBy.get(jeId);
      if (!author && paymentId) {
        author = payReceivedBy.get(paymentId) || payCreatedBy.get(paymentId);
      }
      if (author) row.createdBy = author;
    }

    if (isLedgerV2Placeholder(row.branch) && jeId) {
      const branchLabel = jeBranchLabel.get(jeId);
      if (branchLabel) row.branch = branchLabel;
    }
  }

  await enrichLedgerV2BranchFromDocuments(rows, saleRefByJe, purchaseRefByJe, jeCompanyWide);
  await enrichCreatedByNames(rows);
}

async function enrichLedgerV2BranchFromDocuments(
  rows: LedgerStatementV2Row[],
  saleRefByJe: Map<string, string>,
  purchaseRefByJe: Map<string, string>,
  jeCompanyWide: Set<string>,
): Promise<void> {
  const saleBranchById = new Map<string, string>();
  const purchaseBranchById = new Map<string, string>();

  const saleIds = [...new Set(saleRefByJe.values())];
  if (saleIds.length) {
    const { data } = await supabase
      .from('sales')
      .select('id, branch:branches(name, code)')
      .in('id', slice200(saleIds));
    (data || []).forEach((s: { id: string; branch?: { name?: string; code?: string } | null }) => {
      const label = formatBranchLabel(s.branch);
      if (!isLedgerV2Placeholder(label)) saleBranchById.set(s.id, label);
    });
  }

  const purchaseIds = [...new Set(purchaseRefByJe.values())];
  if (purchaseIds.length) {
    const { data } = await supabase
      .from('purchases')
      .select('id, branch:branches(name, code)')
      .in('id', slice200(purchaseIds));
    (data || []).forEach((p: { id: string; branch?: { name?: string; code?: string } | null }) => {
      const label = formatBranchLabel(p.branch);
      if (!isLedgerV2Placeholder(label)) purchaseBranchById.set(p.id, label);
    });
  }

  for (const row of rows) {
    if (!isLedgerV2Placeholder(row.branch)) continue;
    const jeId = row.journalEntryId;
    if (!jeId) continue;

    const glBranch = formatBranchLabel(
      row.glEntry?.branch_name
        ? { name: row.glEntry.branch_name, code: undefined }
        : null,
    );
    if (!isLedgerV2Placeholder(glBranch)) {
      row.branch = glBranch;
      continue;
    }

    const saleId = saleRefByJe.get(jeId);
    if (saleId && saleBranchById.has(saleId)) {
      row.branch = saleBranchById.get(saleId)!;
      continue;
    }

    const purchaseId = purchaseRefByJe.get(jeId);
    if (purchaseId && purchaseBranchById.has(purchaseId)) {
      row.branch = purchaseBranchById.get(purchaseId)!;
      continue;
    }

    if (jeCompanyWide.has(jeId)) row.branch = COMPANY_WIDE_BRANCH_LABEL;
  }
}

function isLedgerV2Placeholder(value?: string | null): boolean {
  const v = String(value || '').trim();
  return !v || v === LEDGER_V2_EMPTY;
}

async function resolveUserDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const nameByUserId = new Map<string, string>();
  const unique = [...new Set(userIds.filter(Boolean))] as string[];
  if (!unique.length) return nameByUserId;

  const { data: usersByAuth } = await supabase
    .from('users')
    .select('auth_user_id, full_name, email')
    .in('auth_user_id', unique.slice(0, 200));
  (usersByAuth || []).forEach((u: { auth_user_id?: string; full_name?: string; email?: string }) => {
    if (u?.auth_user_id) nameByUserId.set(u.auth_user_id, (u.full_name || u.email || '').trim());
  });

  const missing = unique.filter((id) => !nameByUserId.has(id));
  if (missing.length) {
    const { data: usersById } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', missing.slice(0, 200));
    (usersById || []).forEach((u: { id?: string; full_name?: string; email?: string }) => {
      if (u?.id) nameByUserId.set(u.id, (u.full_name || u.email || '').trim());
    });
  }
  return nameByUserId;
}

async function enrichCreatedByNames(rows: LedgerStatementV2Row[]): Promise<void> {
  const ids = [...new Set(rows.map((r) => r.createdBy).filter((v) => v && v !== '—' && isUuid(v)))] as string[];
  if (!ids.length) return;
  const names = await resolveUserDisplayNames(ids);
  rows.forEach((r) => {
    if (r.createdBy && isUuid(r.createdBy)) {
      const name = names.get(r.createdBy);
      r.createdBy = name || '—';
    }
  });
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizeDocType(t: string): string {
  return String(t || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function mapGlReferenceType(refType?: string | null): LedgerStatementV2Row['sourceKind'] {
  const r = normalizeDocType(refType || '');
  if (r.includes('party_discount')) return 'journal';
  if (r.includes('opening')) return 'opening';
  if (r.includes('sale_return') || (r.includes('return') && r.includes('sale'))) return 'return';
  if (r.includes('sale')) return 'sale';
  if (r.includes('purchase_return') || (r.includes('return') && r.includes('purchase'))) return 'return';
  if (r.includes('purchase')) return 'purchase';
  if (r.includes('rental')) return 'rental';
  if (r.includes('expense')) return 'expense';
  if (r.includes('payment')) return 'payment';
  return 'journal';
}

function matchesTransactionFilter(row: LedgerStatementV2Row, filter: LedgerTransactionTypeFilter): boolean {
  if (filter === 'all') return true;
  const k = row.sourceKind;
  const t = normalizeDocType(row.transactionType);
  switch (filter) {
    case 'sale':
      return k === 'sale';
    case 'purchase':
      return k === 'purchase';
    case 'payment_received':
      return k === 'payment' && row.credit > 0;
    case 'payment_paid':
      return k === 'payment' && row.debit > 0;
    case 'return':
      return k === 'return' || t.includes('return');
    case 'rental':
      return k === 'rental';
    case 'expense':
      return k === 'expense';
    case 'journal':
      return k === 'journal';
    case 'opening':
      return k === 'opening';
    case 'discount':
      return normalizeDocType(row.transactionType).includes('discount');
    default:
      return true;
  }
}

function matchesSearch(row: LedgerStatementV2Row, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  const blob = [
    row.referenceNo,
    row.transactionType,
    row.description,
    row.paymentMethod,
    row.createdBy,
    row.branch,
    String(row.debit),
    String(row.credit),
  ]
    .join(' ')
    .toLowerCase();
  return blob.includes(s);
}

export function glToRows(entries: AccountLedgerEntry[]): LedgerStatementV2Row[] {
  return entries.map((e, idx) => {
    const refType = normalizeDocType(e.je_reference_type || e.document_type || '');
    const transactionType =
      refType.includes('party_discount')
        ? 'Discount'
        : String(e.document_type || e.je_reference_type || 'Journal Entry');
    return {
      id: e.journal_entry_id || `${e.date}-${e.reference_number}-${idx}`,
      date: e.date,
      referenceNo: String(e.reference_number || e.entry_no || e.journal_entry_id || '—'),
      transactionType,
      description: String(e.description || ''),
      branch: String(e.branch_name || '—'),
      debit: round2(Number(e.debit) || 0),
      credit: round2(Number(e.credit) || 0),
      runningBalance: round2(Number(e.running_balance) || 0),
      paymentMethod: displaySettlementAccount(e),
      createdBy: String(e.created_by || LEDGER_V2_EMPTY),
      hasAttachments: false,
      sourceKind: mapGlReferenceType(e.je_reference_type || e.document_type),
      sourceId: e.sale_id || e.payment_id || e.rental_id || undefined,
      journalEntryId: e.journal_entry_id,
      paymentId: e.payment_id || undefined,
      glEntry: e,
    };
  });
}

export function applyLedgerV2DisplayFilters(
  rows: LedgerStatementV2Row[],
  transactionType: LedgerTransactionTypeFilter,
  search: string,
): LedgerStatementV2Row[] {
  return rows
    .filter((r) => matchesTransactionFilter(r, transactionType))
    .filter((r) => matchesSearch(r, search));
}

export function summarizeLedgerV2Rows(
  rows: LedgerStatementV2Row[],
  opening: number,
  type: LedgerStatementV2Type,
): LedgerStatementV2Summary {
  return summarizeFromRows(rows, opening, type);
}

export function deriveLedgerV2Opening(rows: LedgerStatementV2Row[]): number {
  if (!rows.length) return 0;
  return round2(rows[0].runningBalance - (rows[0].debit - rows[0].credit));
}

function deriveOpeningFromGlRows(rows: LedgerStatementV2Row[]): number {
  return deriveLedgerV2Opening(rows);
}

function summarizeFromRows(rows: LedgerStatementV2Row[], opening: number, type: LedgerStatementV2Type): LedgerStatementV2Summary {
  let totalDebit = 0;
  let totalCredit = 0;
  let totalSales = 0;
  let totalSalesReturn = 0;
  let totalPaymentsReceived = 0;
  let totalPurchases = 0;
  let totalPurchaseReturns = 0;
  let totalPaymentsPaid = 0;
  let totalRentalCharges = 0;
  let totalRentalPayments = 0;
  let totalWorkCharges = 0;
  let totalAdjustments = 0;

  for (const r of rows) {
    totalDebit += r.debit;
    totalCredit += r.credit;
    const tl = normalizeDocType(r.transactionType);
    if (type === 'customer') {
      if (r.sourceKind === 'sale' && !tl.includes('return')) totalSales += r.debit;
      if (r.sourceKind === 'return' && tl.includes('sale')) totalSalesReturn += r.credit;
      if (r.sourceKind === 'payment' || tl.includes('payment')) totalPaymentsReceived += r.credit;
      if (r.sourceKind === 'rental') {
        if (r.debit > 0) totalRentalCharges += r.debit;
        if (r.credit > 0) totalRentalPayments += r.credit;
      }
    }
    if (type === 'supplier') {
      if (r.sourceKind === 'purchase' && !tl.includes('return')) totalPurchases += r.credit;
      if (r.sourceKind === 'return') totalPurchaseReturns += r.debit;
      if (r.sourceKind === 'payment') totalPaymentsPaid += r.debit;
    }
    if (type === 'worker') {
      if (r.debit > 0 && r.sourceKind !== 'payment') totalWorkCharges += r.debit;
      if (r.sourceKind === 'payment') totalPaymentsPaid += r.credit;
      if (tl.includes('adjust')) totalAdjustments += Math.abs(r.debit - r.credit);
    }
  }

  const closing = rows.length ? rows[rows.length - 1].runningBalance : opening;
  return {
    openingBalance: round2(opening),
    closingBalance: round2(closing),
    totalDebit: round2(totalDebit),
    totalCredit: round2(totalCredit),
    totalSales: round2(totalSales),
    totalSalesReturn: round2(totalSalesReturn),
    totalPaymentsReceived: round2(totalPaymentsReceived),
    totalRentalCharges: round2(totalRentalCharges),
    totalRentalPayments: round2(totalRentalPayments),
    totalPurchases: round2(totalPurchases),
    totalPurchaseReturns: round2(totalPurchaseReturns),
    totalPaymentsPaid: round2(totalPaymentsPaid),
    totalWorkCharges: round2(totalWorkCharges),
    totalAdjustments: round2(totalAdjustments),
    netMovement: round2(totalDebit - totalCredit),
  };
}

async function loadGlEntries(
  companyId: string,
  statementType: LedgerStatementV2Type,
  entityId: string,
  fromDate: string,
  toDate: string,
  search: string,
): Promise<AccountLedgerEntry[]> {
  const branchScope = STATEMENT_ALL_BRANCHES_SCOPE;
  const searchTerm = search.trim() || undefined;

  if (statementType === 'customer') {
    return accountingService.getCustomerLedger(
      entityId,
      companyId,
      branchScope,
      fromDate,
      toDate,
      searchTerm,
    );
  }
  if (statementType === 'supplier') {
    return accountingService.getSupplierApGlJournalLedger(
      entityId,
      companyId,
      branchScope,
      fromDate,
      toDate,
    );
  }
  if (statementType === 'worker') {
    return accountingService.getWorkerPartyGlJournalLedger(
      entityId,
      companyId,
      branchScope,
      fromDate,
      toDate,
    );
  }
  return accountingService.getAccountLedger(
    entityId,
    companyId,
    fromDate,
    toDate,
    branchScope,
    searchTerm,
  );
}

function isSaleReferenceType(rt: string): boolean {
  const n = normalizeDocType(rt);
  if (n.includes('sale_return') || (n.includes('return') && n.includes('sale'))) return false;
  return n.includes('sale');
}

function isPurchaseReferenceType(rt: string): boolean {
  const n = normalizeDocType(rt);
  if (n.includes('purchase_return') || (n.includes('return') && n.includes('purchase'))) return false;
  return n.includes('purchase');
}

function isRentalReferenceType(rt: string): boolean {
  return normalizeDocType(rt).includes('rental');
}

function hasAttachmentPayload(att: unknown): boolean {
  return (Array.isArray(att) && att.length > 0) || (typeof att === 'string' && att.trim().length > 0);
}

/** Collect sale / purchase / rental ids from row GL + sourceKind (before JE refetch fills gaps). */
function collectDocIdsFromRow(r: LedgerStatementV2Row): {
  saleId?: string;
  purchaseId?: string;
  rentalId?: string;
} {
  const gl = r.glEntry;
  const jeRt = String(gl?.je_reference_type || '');
  const jeRid = gl?.je_reference_id ? String(gl.je_reference_id) : '';

  let saleId = gl?.sale_id ? String(gl.sale_id) : undefined;
  if (!saleId && r.sourceKind === 'sale' && r.sourceId) saleId = String(r.sourceId);
  if (!saleId && jeRid && isSaleReferenceType(jeRt)) saleId = jeRid;

  let purchaseId: string | undefined;
  if (r.sourceKind === 'purchase' && r.sourceId) purchaseId = String(r.sourceId);
  if (!purchaseId && jeRid && isPurchaseReferenceType(jeRt)) purchaseId = jeRid;

  let rentalId = gl?.rental_id ? String(gl.rental_id) : undefined;
  if (!rentalId && r.sourceKind === 'rental' && r.sourceId) rentalId = String(r.sourceId);
  if (!rentalId && jeRid && isRentalReferenceType(jeRt)) rentalId = jeRid;

  return { saleId, purchaseId, rentalId };
}

/**
 * Mark `hasAttachments` from JE / payment / sale / purchase / rental attachment sets.
 * Soft-caps batch lookups at 200 ids. Safe for legacy and unified main loaders.
 */
export async function enrichLedgerV2AttachmentFlags(rows: LedgerStatementV2Row[]): Promise<void> {
  const jeIds = [...new Set(rows.map((r) => r.journalEntryId).filter(Boolean))] as string[];
  const payIds = [...new Set(rows.map((r) => r.paymentId).filter(Boolean))] as string[];

  const saleIdSet = new Set<string>();
  const purchaseIdSet = new Set<string>();
  const rentalIdSet = new Set<string>();
  for (const r of rows) {
    const ids = collectDocIdsFromRow(r);
    if (ids.saleId) saleIdSet.add(ids.saleId);
    if (ids.purchaseId) purchaseIdSet.add(ids.purchaseId);
    if (ids.rentalId) rentalIdSet.add(ids.rentalId);
  }

  const jeHas = new Set<string>();
  const payHas = new Set<string>();
  const saleHas = new Set<string>();
  const rentalHas = new Set<string>();
  const purchaseHas = new Set<string>();
  const jeSaleRefById = new Map<string, string>();
  const jePurchaseRefById = new Map<string, string>();
  const jeRentalRefById = new Map<string, string>();
  const slice200 = <T>(arr: T[]) => arr.slice(0, 200);

  if (jeIds.length) {
    const { data: jeRows } = await supabase
      .from('journal_entries')
      .select('id, attachments, reference_type, reference_id')
      .in('id', slice200(jeIds));
    (jeRows || []).forEach((r: { id: string; attachments?: unknown; reference_type?: string; reference_id?: string }) => {
      if (Array.isArray(r.attachments) && r.attachments.length > 0) jeHas.add(r.id);
      if (!r.reference_id) return;
      const rid = String(r.reference_id);
      const rt = r.reference_type || '';
      if (isSaleReferenceType(rt)) {
        jeSaleRefById.set(r.id, rid);
        saleIdSet.add(rid);
      } else if (isPurchaseReferenceType(rt)) {
        jePurchaseRefById.set(r.id, rid);
        purchaseIdSet.add(rid);
      } else if (isRentalReferenceType(rt)) {
        jeRentalRefById.set(r.id, rid);
        rentalIdSet.add(rid);
      }
    });
  }
  if (payIds.length) {
    const { data } = await supabase.from('payments').select('id, attachments').in('id', slice200(payIds));
    (data || []).forEach((r: { id: string; attachments?: unknown }) => {
      if (Array.isArray(r.attachments) && r.attachments.length > 0) payHas.add(r.id);
    });
  }
  const saleIds = [...saleIdSet];
  if (saleIds.length) {
    const { data } = await supabase.from('sales').select('id, attachments').in('id', slice200(saleIds));
    (data || []).forEach((r: { id: string; attachments?: unknown }) => {
      if (hasAttachmentPayload(r.attachments)) saleHas.add(r.id);
    });
  }
  const rentalIds = [...rentalIdSet];
  if (rentalIds.length) {
    const { data } = await supabase.from('rentals').select('id, attachments').in('id', slice200(rentalIds));
    (data || []).forEach((r: { id: string; attachments?: unknown }) => {
      if (hasAttachmentPayload(r.attachments)) rentalHas.add(r.id);
    });
  }
  const purchaseIds = [...purchaseIdSet];
  if (purchaseIds.length) {
    const { data } = await supabase.from('purchases').select('id, attachments').in('id', slice200(purchaseIds));
    (data || []).forEach((r: { id: string; attachments?: unknown }) => {
      if (hasAttachmentPayload(r.attachments)) purchaseHas.add(r.id);
    });
  }

  rows.forEach((r) => {
    if (r.journalEntryId && jeHas.has(r.journalEntryId)) r.hasAttachments = true;
    if (r.paymentId && payHas.has(r.paymentId)) r.hasAttachments = true;

    const fromRow = collectDocIdsFromRow(r);
    const saleId =
      fromRow.saleId || (r.journalEntryId ? jeSaleRefById.get(r.journalEntryId) : undefined);
    const purchaseId =
      fromRow.purchaseId || (r.journalEntryId ? jePurchaseRefById.get(r.journalEntryId) : undefined);
    const rentalId =
      fromRow.rentalId || (r.journalEntryId ? jeRentalRefById.get(r.journalEntryId) : undefined);

    if (saleId && saleHas.has(saleId)) r.hasAttachments = true;
    if (purchaseId && purchaseHas.has(purchaseId)) r.hasAttachments = true;
    if (rentalId && rentalHas.has(rentalId)) r.hasAttachments = true;
  });
}

export async function listLedgerEntitiesV2(
  companyId: string,
  type: LedgerStatementV2Type,
): Promise<LedgerEntityOption[]> {
  if (type === 'customer') {
    const list = await customerLedgerAPI.getCustomers(companyId);
    return (list || []).map((c) => ({
      id: c.id,
      label: c.name || c.code || c.id,
      sublabel: c.code,
      phone: c.phone,
    }));
  }
  if (type === 'supplier') {
    const list = await contactService.getAllContacts(companyId, 'supplier');
    const both = await contactService.getAllContacts(companyId, 'both');
    const combined = [...(list || []), ...(both || [])].filter(
      (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i,
    );
    return combined.map((c) => ({
      id: c.id!,
      label: (c as { name?: string }).name || 'Supplier',
      phone: (c as { phone?: string }).phone,
    }));
  }
  if (type === 'worker') {
    const list = await studioService.getAllWorkers(companyId);
    return ((list || []) as { id: string; name?: string; phone?: string }[]).map((w) => ({
      id: w.id,
      label: w.name || w.id,
      phone: w.phone,
    }));
  }
  const accounts = await accountService.getAllAccounts(companyId);
  return (accounts || [])
    .filter((a: { is_active?: boolean }) => a.is_active !== false)
    .map((a: { id: string; name?: string; code?: string; type?: string }) => ({
      id: a.id,
      label: `${String(a.code || '').trim()} — ${String(a.name || '').trim()}`.replace(/^—\s*/, ''),
      sublabel: a.type,
      code: a.code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getLedgerStatementV2(
  companyId: string,
  filters: LedgerStatementV2Filters,
  entityLabel: string,
): Promise<LedgerStatementV2Result> {
  const { statementType, entityId, fromDate, toDate, transactionType, search } = filters;
  if (!entityId) {
    return {
      entityLabel,
      basis: 'gl',
      rows: [],
      summary: {
        openingBalance: 0,
        closingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
      },
    };
  }

  const entries = await loadGlEntries(companyId, statementType, entityId, fromDate, toDate, '');
  let rows = glToRows(entries);
  const opening = deriveOpeningFromGlRows(rows);

  await enrichLedgerV2PaymentAndAuthorship(rows, companyId, {
    statementType,
    viewedAccountId: statementType === 'account' ? entityId : null,
  });
  await enrichLedgerV2AttachmentFlags(rows);

  const summary = summarizeFromRows(rows, opening, statementType);
  return { entityLabel, basis: 'gl', rows, summary };
}

/** Open the correct transaction detail for a V2 row (read-only drill-down). */
export function openLedgerRowDetailV2(row: LedgerStatementV2Row): void {
  if (typeof window === 'undefined') return;
  if (row.glEntry) {
    const ref = resolveLedgerTransactionOpenRef(row.glEntry);
    window.dispatchEvent(
      new CustomEvent('openTransactionDetail', {
        detail: {
          referenceNumber: ref.referenceNumber,
          journalEntryId: ref.journalEntryId,
          autoLaunchUnifiedEdit: false,
        },
      }),
    );
    return;
  }
  const refNo = row.referenceNo || row.id;
  if (refNo && refNo !== 'Opening Balance') {
    window.dispatchEvent(
      new CustomEvent('openTransactionDetail', {
        detail: { referenceNumber: refNo, autoLaunchUnifiedEdit: false },
      }),
    );
  }
}

function normalizeAttachments(raw: unknown): { url: string; name: string }[] {
  if (Array.isArray(raw)) {
    return raw.filter((a) => a && typeof a === 'object' && 'url' in a) as { url: string; name: string }[];
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [{ url: raw.trim(), name: 'Attachment' }];
  }
  return [];
}

export async function getLedgerAttachmentsV2(
  row: LedgerStatementV2Row,
): Promise<{ url: string; name: string }[]> {
  if (row.journalEntryId) {
    const { data } = await supabase
      .from('journal_entries')
      .select('attachments, reference_type, reference_id')
      .eq('id', row.journalEntryId)
      .maybeSingle();
    const je = data as { attachments?: unknown; reference_type?: string; reference_id?: string } | null;
    const att = normalizeAttachments(je?.attachments);
    if (att.length) return att;

    // Prefer JE reference for source docs when row GL ids are thin.
    if (je?.reference_id && !row.paymentId) {
      const rid = String(je.reference_id);
      const rt = je.reference_type || '';
      if (isSaleReferenceType(rt)) {
        const { data: sale } = await supabase.from('sales').select('attachments').eq('id', rid).maybeSingle();
        const saleAtt = normalizeAttachments((sale as { attachments?: unknown } | null)?.attachments);
        if (saleAtt.length) return saleAtt;
      } else if (isPurchaseReferenceType(rt)) {
        const { data: purchase } = await supabase
          .from('purchases')
          .select('attachments')
          .eq('id', rid)
          .maybeSingle();
        const purchaseAtt = normalizeAttachments((purchase as { attachments?: unknown } | null)?.attachments);
        if (purchaseAtt.length) return purchaseAtt;
      } else if (isRentalReferenceType(rt)) {
        const { data: rental } = await supabase.from('rentals').select('attachments').eq('id', rid).maybeSingle();
        const rentalAtt = normalizeAttachments((rental as { attachments?: unknown } | null)?.attachments);
        if (rentalAtt.length) return rentalAtt;
      }
    }
  }
  if (row.paymentId) {
    const { data } = await supabase.from('payments').select('attachments').eq('id', row.paymentId).maybeSingle();
    const att = normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
    if (att.length) return att;
    return [];
  }

  const ids = collectDocIdsFromRow(row);
  if (ids.saleId) {
    const { data } = await supabase.from('sales').select('attachments').eq('id', ids.saleId).maybeSingle();
    const att = normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
    if (att.length) return att;
  }
  if (ids.rentalId) {
    const { data } = await supabase.from('rentals').select('attachments').eq('id', ids.rentalId).maybeSingle();
    const att = normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
    if (att.length) return att;
  }
  if (ids.purchaseId) {
    const { data } = await supabase.from('purchases').select('attachments').eq('id', ids.purchaseId).maybeSingle();
    const att = normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
    if (att.length) return att;
  }
  return [];
}
