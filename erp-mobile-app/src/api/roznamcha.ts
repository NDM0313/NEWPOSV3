/**
 * Roznamcha (Daily Cash Book) – Cash In / Cash Out only (not Journal Debit/Credit).
 * Keep in sync with src/app/services/roznamchaService.ts (web ERP).
 * Primary source: payments (+ rental_payments). Journal-only rows with cash/bank/wallet legs
 * (general entry, internal transfer, pure journal) are merged when payment_id is null.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isLiquidityPaymentAccount, paymentMethodForLiquidityAccount } from '../lib/liquidityPaymentAccount';
import { journalDescriptionForDisplay } from '../utils/journalDescriptionDisplay';
import {
  formatRentalPaymentRef,
  isRcvReference,
  isGenericRentalPaymentReference,
} from '../utils/rentalPaymentRef';
import {
  dedupeRoznamchaRows,
  roznamchaEntityKeys,
  roznamchaLooseMovementKey,
  roznamchaMovementKey,
} from '../lib/roznamchaDedupe';
import {
  isEventDateInRange,
  resolveRoznamchaRowDateTime,
} from '../utils/transactionEventDateTime';
import {
  roznamchaLiquidityLineDirection,
  roznamchaPaymentDirection,
  roznamchaPaymentTypeDirection,
} from '../lib/roznamchaExpenseRules';
import { paymentMatchesRoznamchaBranch, type RoznamchaBranchMaps } from '../lib/roznamchaBranchMatch';

export { dedupeRoznamchaRows, roznamchaEntityKeys, roznamchaLooseMovementKey, roznamchaMovementKey };
export { roznamchaLiquidityLineDirection, roznamchaPaymentDirection } from '../lib/roznamchaExpenseRules';

export type AccountFilter = 'all' | 'cash' | 'bank' | 'wallet';

export interface RoznamchaRow {
  id: string;
  date: string;
  time: string;
  ref: string;
  /** Main transaction label (e.g. "Cash Sale", "Shop Expense") */
  details: string;
  /** For Details meta line: e.g. "Invoice SL-0027" or notes like "Electric Bill" */
  referenceDisplay: string;
  /** Resolved user name for "by Ali" (from received_by) */
  createdBy: string | null;
  /** Counterparty context: Customer / Supplier / Expense line for subtitle row */
  partyLine?: string | null;
  /** Journal voucher no. linked to this payment (shown under PAY-* in Ref column) */
  journalEntryNo?: string | null;
  cashIn: number;
  cashOut: number;
  direction: 'IN' | 'OUT';
  amount: number;
  accountType: 'cash' | 'bank' | 'wallet' | null;
  /** Display label for Account column: "Cash", "Bank", "JazzCash", etc. */
  accountLabel: string;
  /** Resolved account name from accounts table when payment_account_id is set (e.g. "HBL Main", "CASH IN HAND") */
  accountName?: string | null;
  /** Internal — used for dedupe (cash/bank/wallet account id). */
  paymentAccountId?: string | null;
  /** Internal — strict dedupe: one row per payments.id */
  sourcePaymentId?: string | null;
  /** Internal — strict dedupe: one row per rental_payments.id */
  sourceRentalPaymentId?: string | null;
  /** Internal — strict dedupe: one row per journal_entries.id */
  sourceJournalEntryId?: string | null;
  /** Internal — optional dedupe when multiple rows share one economic event */
  sourceEconomicEventId?: string | null;
  branchId: string | null;
  type: string;
}

export interface RoznamchaSummary {
  openingBalance: number;
  cashIn: number;
  cashOut: number;
  closingBalance: number;
}

export interface RoznamchaCashSplit {
  cash: number;
  bank: number;
  wallet: number;
  total: number;
}

export interface RoznamchaRowWithBalance extends RoznamchaRow {
  runningBalance: number;
}

export interface RoznamchaResult {
  rows: RoznamchaRowWithBalance[];
  summary: RoznamchaSummary;
  cashSplit: RoznamchaCashSplit;
}

function getDirection(paymentType: string): 'IN' | 'OUT' {
  return roznamchaPaymentTypeDirection(paymentType);
}

function getTypeLabel(referenceType: string): string {
  const m: Record<string, string> = {
    sale: 'Cash Sale',
    payment: 'Customer Payment',
    sale_return: 'Return Refund',
    expense: 'Shop Expense',
    purchase: 'Supplier Payment',
    on_account: 'On-Account Payment',
    rental: 'Rental Payment',
    studio_order: 'Studio Payment',
    worker_payment: 'Worker Payment',
    courier_payment: 'Courier Payment',
    manual_receipt: 'Manual Receipt',
    manual_payment: 'Manual Payment',
  };
  return m[(referenceType || '').toLowerCase()] || referenceType || 'Payment';
}

function getPartyAwareTypeLabel(referenceType: string, paymentType: string): string {
  const rt = (referenceType || '').toLowerCase();
  const dir = getDirection(paymentType);
  if (rt === 'sale' && dir === 'IN') return 'Customer Payment';
  if (rt === 'on_account') return dir === 'IN' ? 'Customer Receipt' : 'Supplier Payment';
  if (rt === 'manual_receipt') return 'Customer Receipt';
  if (rt === 'manual_payment') return 'Supplier Payment';
  return getTypeLabel(referenceType);
}

/** Document JEs with liquidity legs — cash movement already in payments / rental_payments. */
const ROZNAMCHA_DOCUMENT_JE_TYPES = new Set([
  'rental',
  'sale',
  'purchase',
  'expense',
  'worker_payment',
  'courier_payment',
  'studio_order',
]);

function rentalPaymentMatchKey(
  rentalId: string,
  date: string,
  amount: number,
  accountId: string | null | undefined
): string {
  return `${rentalId}|${date}|${Math.round(amount * 100)}|${accountId || ''}`;
}

function resolveSubAccountLabel(
  meta: { name: string } | undefined,
  shortLabel: string
): string {
  const name = String(meta?.name || '').trim();
  return name || shortLabel || '—';
}

/** RCV / PAY / REN / EXP over JE — audit-facing ref column. */
export function resolveCanonicalRoznamchaRef(opts: {
  referenceNumber?: string | null;
  rentalBookingNo?: string | null;
  expenseNo?: string | null;
  journalEntryNo?: string | null;
  fallbackRef?: string | null;
}): { ref: string; journalEntryNo: string | null } {
  const refNum = String(opts.referenceNumber || '').trim();
  const jeNo = String(opts.journalEntryNo || '').trim();
  const rentalNo = String(opts.rentalBookingNo || '').trim();
  const expenseNo = String(opts.expenseNo || '').trim();
  const fallback = String(opts.fallbackRef || '').trim();

  const jeSubtitle =
    jeNo && refNum && jeNo.toLowerCase() !== refNum.toLowerCase() ? jeNo : null;

  if (isRcvReference(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle };
  if (expenseNo) {
    const expenseJeSubtitle =
      jeNo &&
      jeNo.toLowerCase() !== expenseNo.toLowerCase() &&
      (/^JE-/i.test(jeNo) || /^JV-/i.test(jeNo))
        ? jeNo
        : null;
    return { ref: expenseNo, journalEntryNo: expenseJeSubtitle };
  }
  if (/^PAY-/i.test(refNum) || /^WPY-/i.test(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle };
  if (/^REN-.+-PAY$/i.test(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle || (jeNo || null) };
  if (rentalNo && (isGenericRentalPaymentReference(refNum) || !refNum) && !isRcvReference(refNum)) {
    const synthesized = formatRentalPaymentRef(rentalNo);
    return {
      ref: synthesized || rentalNo,
      journalEntryNo: jeNo && jeNo.toLowerCase() !== (synthesized || rentalNo).toLowerCase() ? jeNo : null,
    };
  }
  if (rentalNo) return { ref: rentalNo, journalEntryNo: jeNo && jeNo.toLowerCase() !== rentalNo.toLowerCase() ? jeNo : null };
  if (/^REN-/i.test(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle };
  if (refNum && !/^JE-/i.test(refNum) && !/^JV-/i.test(refNum)) {
    return { ref: refNum, journalEntryNo: jeSubtitle };
  }
  if (jeNo) return { ref: jeNo, journalEntryNo: null };
  if (fallback) return { ref: fallback, journalEntryNo: null };
  return { ref: refNum || '—', journalEntryNo: null };
}

/** Ref column for UI/export — never repeat JE twice. */
export function roznamchaRefDisplay(row: Pick<RoznamchaRow, 'ref' | 'journalEntryNo'>): string {
  const ref = String(row.ref || '').trim();
  const je = String(row.journalEntryNo || '').trim();
  if (!je || je.toLowerCase() === ref.toLowerCase()) return ref || '—';
  return ref;
}

export function roznamchaJournalSubtitle(row: Pick<RoznamchaRow, 'ref' | 'journalEntryNo'>): string | null {
  const ref = String(row.ref || '').trim();
  const je = String(row.journalEntryNo || '').trim();
  if (!je || je.toLowerCase() === ref.toLowerCase()) return null;
  if (/^JE-/i.test(ref) || /^JV-/i.test(ref)) return null;
  if (/^EXP-/i.test(ref)) return null;
  return je;
}

async function loadRentalPaymentsInPaymentsTable(
  companyId: string,
  branchId: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  beforeDate: string | null,
  includeVoidedReversed: boolean
): Promise<Set<string>> {
  let q = supabase
    .from('payments')
    .select('reference_id, payment_date, amount, payment_account_id, branch_id, voided_at')
    .eq('company_id', companyId)
    .eq('reference_type', 'rental');

  if (dateFrom && dateTo) {
    q = q.gte('payment_date', dateFrom).lte('payment_date', dateTo);
  } else if (beforeDate) {
    q = q.lt('payment_date', beforeDate);
  }
  if (branchId) q = q.eq('branch_id', branchId);
  if (!includeVoidedReversed) q = q.is('voided_at', null);

  const { data } = await q;
  const keys = new Set<string>();
  (data || []).forEach((p: any) => {
    const rid = String(p.reference_id || '').trim();
    if (!rid) return;
    keys.add(
      rentalPaymentMatchKey(rid, String(p.payment_date || ''), Number(p.amount) || 0, p.payment_account_id)
    );
  });
  return keys;
}

/** Match rental_payments rows to RCV-* on linked payments (legacy REN-*-PAY backfill display). */
async function loadRentalRcvRefByMatchKey(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
  includeVoidedReversed: boolean
): Promise<Map<string, string>> {
  let q = supabase
    .from('payments')
    .select('reference_id, payment_date, amount, payment_account_id, reference_number, branch_id, voided_at')
    .eq('company_id', companyId)
    .eq('reference_type', 'rental')
    .ilike('reference_number', '%RCV-%')
    .gte('payment_date', dateFrom)
    .lte('payment_date', dateTo);
  if (branchId) q = q.eq('branch_id', branchId);
  if (!includeVoidedReversed) q = q.is('voided_at', null);
  const { data } = await q;
  const map = new Map<string, string>();
  (data || []).forEach((p: any) => {
    const rid = String(p.reference_id || '').trim();
    const ref = String(p.reference_number || '').trim();
    if (!rid || !isRcvReference(ref)) return;
    map.set(
      rentalPaymentMatchKey(rid, String(p.payment_date || ''), Number(p.amount) || 0, p.payment_account_id),
      ref
    );
  });
  return map;
}

function formatRoznamchaRentalAmount(amount: number): string {
  const n = Number(amount) || 0;
  return `Rs ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

const RENTAL_PAYMENT_ROW_SELECT =
  'id, amount, method, payment_date, created_at, reference, payment_account_id, journal_entry_id, created_by, voided_at, rentals!inner(id, booking_no, company_id, branch_id, created_by, customer_name)';

async function loadRentalPartyPaymentJeIdsInEntryDateRange(
  companyId: string,
  dateFrom: string,
  dateTo: string,
  includeVoidedReversed: boolean
): Promise<string[]> {
  let jeQ = supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)
    .like('action_fingerprint', 'rental_party_payment:%');
  if (!includeVoidedReversed) jeQ = jeQ.or('is_void.is.null,is_void.eq.false');
  const { data } = await jeQ;
  return (data || []).map((r: any) => String(r.id || '')).filter(Boolean);
}

async function loadRentalPaymentJournalLinks(
  companyId: string,
  branchId: string | null,
  options: {
    dateFrom?: string;
    dateTo?: string;
    beforeDate?: string;
    includeVoidedReversed?: boolean;
  }
): Promise<Set<string>> {
  const out = new Set<string>();

  let q = supabase
    .from('rental_payments')
    .select('journal_entry_id, payment_date, voided_at, rentals!inner(company_id, branch_id)')
    .eq('rentals.company_id', companyId)
    .not('journal_entry_id', 'is', null);

  if (options.dateFrom && options.dateTo) {
    q = q.gte('payment_date', options.dateFrom).lte('payment_date', options.dateTo);
  } else if (options.beforeDate) {
    q = q.lt('payment_date', options.beforeDate);
  }
  if (branchId) q = (q as any).eq('rentals.branch_id', branchId);
  if (!options.includeVoidedReversed) q = q.is('voided_at', null);

  const { data } = await q;
  (data || []).forEach((rp: any) => {
    const jeId = String(rp.journal_entry_id || '').trim();
    if (jeId) out.add(jeId);
  });

  // Also skip JEs whose posting date (entry_date) is in range even when payment_date differs.
  if (options.dateFrom && options.dateTo) {
    const jeIds = await loadRentalPartyPaymentJeIdsInEntryDateRange(
      companyId,
      options.dateFrom,
      options.dateTo,
      options.includeVoidedReversed ?? false
    );
    if (jeIds.length > 0) {
      let supQ = supabase
        .from('rental_payments')
        .select('journal_entry_id, rentals!inner(company_id, branch_id)')
        .eq('rentals.company_id', companyId)
        .in('journal_entry_id', jeIds)
        .not('journal_entry_id', 'is', null);
      if (branchId) supQ = (supQ as any).eq('rentals.branch_id', branchId);
      if (!options.includeVoidedReversed) supQ = supQ.is('voided_at', null);
      const { data: supData } = await supQ;
      (supData || []).forEach((rp: any) => {
        const jeId = String(rp.journal_entry_id || '').trim();
        if (jeId) out.add(jeId);
      });
    }
  }

  return out;
}

function shouldSkipJournalEntryForRoznamcha(
  je: {
    id: string;
    reference_type?: string | null;
    reference_id?: string | null;
    action_fingerprint?: string | null;
  },
  skipJeIds: Set<string>,
  expenseIdsWithLivePayments: Set<string> = new Set(),
): boolean {
  if (skipJeIds.has(je.id)) return true;
  const rt = String(je.reference_type || '').toLowerCase();
  const fp = String(je.action_fingerprint || '').trim();
  if (rt === 'rental' && fp.startsWith('rental_party_payment:')) {
    return false;
  }
  if (rt === 'expense') {
    const expenseId = String(je.reference_id || '').trim();
    if (expenseId && expenseIdsWithLivePayments.has(expenseId)) return true;
    return false;
  }
  return ROZNAMCHA_DOCUMENT_JE_TYPES.has(rt);
}

/** Expense ids that already have a live payments row (Roznamcha canonical path). */
async function loadExpenseIdsWithLivePayments(
  companyId: string,
  expenseIds: string[],
  includeVoidedReversed: boolean,
): Promise<Set<string>> {
  const out = new Set<string>();
  const unique = [...new Set(expenseIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (unique.length === 0) return out;
  if (!isSupabaseConfigured) return out;

  let q = supabase
    .from('payments')
    .select('reference_id')
    .eq('company_id', companyId)
    .eq('reference_type', 'expense')
    .in('reference_id', unique);
  if (!includeVoidedReversed) q = q.is('voided_at', null);

  const { data, error } = await q;
  if (error) return out;
  (data || []).forEach((p: { reference_id?: string | null }) => {
    const id = String(p.reference_id || '').trim();
    if (id) out.add(id);
  });
  return out;
}

function rentalMatchesRoznamchaBranch(
  branchId: string | null,
  rentalBranchId: string | null | undefined,
  jeBranchId: string | null | undefined
): boolean {
  if (!branchId) return true;
  if (rentalBranchId) return String(rentalBranchId) === branchId;
  if (jeBranchId) return String(jeBranchId) === branchId;
  return false;
}

async function loadLiquidityDebitAccountByJeId(
  jeIds: string[],
  accountById: Map<string, { name: string; type: string; code: string | null }>
): Promise<Map<string, string>> {
  const liquidityAccountByJeId = new Map<string, string>();
  if (jeIds.length === 0) return liquidityAccountByJeId;

  const { data: jeLines } = await supabase
    .from('journal_entry_lines')
    .select('journal_entry_id, account_id, debit, credit, account:accounts(id, name, type, code)')
    .in('journal_entry_id', jeIds);
  (jeLines || []).forEach((line: any) => {
    const rawAcc = line.account;
    const acc = Array.isArray(rawAcc) ? rawAcc[0] : rawAcc;
    if (!acc || !isLiquidityPaymentAccount(acc)) return;
    const debit = Number(line.debit) || 0;
    if (debit <= 0) return;
    const jeId = String(line.journal_entry_id || '');
    if (jeId && !liquidityAccountByJeId.has(jeId)) {
      liquidityAccountByJeId.set(jeId, String(line.account_id));
      if (!accountById.has(line.account_id)) {
        accountById.set(line.account_id, {
          name: (acc.name || '').trim(),
          type: String(acc.type || ''),
          code: acc.code != null ? String(acc.code).trim() : null,
        });
      }
    }
  });
  return liquidityAccountByJeId;
}

function resolveRentalPaymentLiquidity(
  rp: {
    payment_account_id?: string | null;
    journal_entry_id?: string | null;
    method?: string | null;
  },
  liquidityAccountByJeId: Map<string, string>,
  accountById: Map<string, { name: string; type: string; code: string | null }>
): {
  accountId: string | null;
  liquidity: 'cash' | 'bank' | 'wallet' | null;
  shortLabel: string;
  meta?: { name: string; type: string; code: string | null };
} {
  let aid = (rp.payment_account_id as string | null | undefined) || null;
  if (!aid && rp.journal_entry_id) {
    aid = liquidityAccountByJeId.get(String(rp.journal_entry_id)) || null;
  }
  const meta = aid ? accountById.get(aid) : undefined;
  const methodRaw = String(rp.method || '');
  let { liquidity, shortLabel } = classifyRoznamchaLiquidity(methodRaw, meta?.type, meta?.name, meta?.code);
  if (!liquidity && meta) {
    const inferredMethod = paymentMethodForLiquidityAccount(meta);
    ({ liquidity, shortLabel } = classifyRoznamchaLiquidity(
      inferredMethod,
      meta.type,
      meta.name,
      meta.code
    ));
  }
  return { accountId: aid, liquidity, shortLabel, meta };
}

async function buildJournalSkipJeIds(
  companyId: string,
  branchId: string | null,
  journalEntryIds: string[],
  includeVoidedReversed: boolean,
  dateOpts: { dateFrom?: string; dateTo?: string; beforeDate?: string }
): Promise<Set<string>> {
  const skipJeIds = await journalEntryIdsWithLiquidityPayments(companyId, journalEntryIds, branchId);
  const rentalJeLinks = await loadRentalPaymentJournalLinks(companyId, branchId, {
    ...dateOpts,
    includeVoidedReversed,
  });
  rentalJeLinks.forEach((id) => skipJeIds.add(id));
  return skipJeIds;
}

function normalizeMetaPart(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function dedupeMetaParts(parts: string[], excludePrimary?: string): string {
  const seen = new Set<string>();
  const exclude = excludePrimary ? normalizeMetaPart(excludePrimary) : '';
  const out: string[] = [];
  for (const part of parts) {
    const text = String(part || '').trim();
    if (!text) continue;
    const key = normalizeMetaPart(text);
    if (exclude && key === exclude) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out.join(' • ');
}

function buildRoznamchaMetaLine(
  referenceNumber: string | null | undefined,
  notes: string | null | undefined,
  extraParts: string[] = [],
  excludePrimary?: string
): string {
  const refNo = String(referenceNumber || '').trim();
  const noteText = String(notes || '').trim();
  const parts: string[] = [];
  if (refNo) parts.push(refNo);
  if (noteText && normalizeMetaPart(noteText) !== normalizeMetaPart(refNo)) parts.push(noteText);
  parts.push(...extraParts.map((p) => String(p || '').trim()).filter(Boolean));
  return dedupeMetaParts(parts, excludePrimary);
}

function resolvePaymentContactId(pay: {
  contact_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
}): string | null {
  const contactId = String(pay.contact_id || '').trim();
  if (contactId) return contactId;
  const refType = String(pay.reference_type || '').toLowerCase();
  if (refType === 'manual_receipt' || refType === 'manual_payment') {
    const refId = String(pay.reference_id || '').trim();
    if (refId) return refId;
  }
  return null;
}

function resolvePaymentContactName(
  pay: { contact_id?: string | null; contact_name?: string | null; reference_type?: string | null; reference_id?: string | null },
  contactNameById: Map<string, string>
): string | null {
  const denorm = String(pay.contact_name || '').trim();
  if (denorm) return denorm;
  const contactId = resolvePaymentContactId(pay);
  if (contactId && contactNameById.has(contactId)) return contactNameById.get(contactId)!;
  return null;
}

function isCustomerReceiptPayment(refType: string, paymentType: string): boolean {
  const rt = refType.toLowerCase();
  if (getDirection(paymentType) !== 'IN') return false;
  return rt === 'on_account' || rt === 'manual_receipt' || rt === 'payment' || rt === 'sale';
}

function isSupplierPaymentPayment(refType: string, paymentType: string): boolean {
  const rt = refType.toLowerCase();
  if (getDirection(paymentType) !== 'OUT') return false;
  return rt === 'on_account' || rt === 'manual_payment';
}

const MANUAL_DOCUMENT_JE_REF_TYPES = new Set([
  'general',
  'journal',
  'transfer',
  'manual',
  'manual_journal',
  'manual',
]);

type ManualDocumentJeContext = {
  id: string;
  description: string | null;
  reference_type: string | null;
  lines: Array<{
    debit: number;
    credit: number;
    account?: { name: string; type: string; code: string | null } | null;
  }>;
};

async function loadManualDocumentJeContextById(
  companyId: string,
  jeIds: string[],
): Promise<Map<string, ManualDocumentJeContext>> {
  const out = new Map<string, ManualDocumentJeContext>();
  const unique = [...new Set(jeIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (unique.length === 0) return out;

  const { data } = await supabase
    .from('journal_entries')
    .select(
      `
      id,
      description,
      reference_type,
      lines:journal_entry_lines(debit, credit, account:accounts(name, type, code))
    `,
    )
    .eq('company_id', companyId)
    .in('id', unique);

  (data || []).forEach((je: ManualDocumentJeContext) => {
    if (je?.id) out.set(String(je.id), je);
  });
  return out;
}

function counterpartyLabelFromManualJe(je: ManualDocumentJeContext, direction: 'IN' | 'OUT'): string | null {
  for (const line of je.lines || []) {
    const rawAcc = line.account as
      | { name: string; type: string; code: string | null }
      | { name: string; type: string; code: string | null }[]
      | null
      | undefined;
    const acc = Array.isArray(rawAcc) ? rawAcc[0] : rawAcc;
    if (!acc || !isLiquidityPaymentAccount(acc)) continue;
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    if (direction === 'OUT' && debit > 0) return String(acc.name || '').trim() || null;
    if (direction === 'IN' && credit > 0) return String(acc.name || '').trim() || null;
  }
  return null;
}

function resolveManualDocumentJeForPayment(
  payRefId: string,
  paymentRowId: string,
  journalEntryIdByPaymentId: Map<string, string>,
  manualJeContextById: Map<string, ManualDocumentJeContext>,
): ManualDocumentJeContext | undefined {
  const candidates = [
    payRefId,
    journalEntryIdByPaymentId.get(paymentRowId) || '',
  ].filter(Boolean);
  for (const id of candidates) {
    const je = manualJeContextById.get(id);
    if (je && MANUAL_DOCUMENT_JE_REF_TYPES.has(String(je.reference_type || '').toLowerCase())) {
      return je;
    }
  }
  return undefined;
}

type ExpenseCategoryRow = { id: string; name: string; parent_id: string | null };

function buildCategoryPath(categoryId: string, categoryById: Map<string, ExpenseCategoryRow>): string {
  const path: string[] = [];
  const guard = new Set<string>();
  let cur = categoryById.get(categoryId);
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    const name = String(cur.name || '').trim();
    if (name) path.unshift(name);
    cur = cur.parent_id ? categoryById.get(cur.parent_id) : undefined;
  }
  return path.join(' › ');
}

/** Liquidity bucket for Roznamcha filters and cash split (payment account + method). */
export type RoznamchaLiquidity = 'cash' | 'bank' | 'wallet';

/** COA: mobile wallet / e-money sub-accounts use 102x (see AddAccountDrawer 1020, UnifiedPaymentDialog 102*). */
function isWalletAccountCode(accountCode: string | null | undefined): boolean {
  const c = String(accountCode || '').trim();
  if (!c) return false;
  const head = c.split(/[-–—\s]/)[0]?.replace(/\D/g, '') || '';
  return head.length >= 3 && head.startsWith('102');
}

function walletDisplayLabel(accountName: string | null | undefined, methodHint: string): string {
  const raw = (accountName || '').trim();
  const mh = (methodHint || '').toLowerCase();
  if (/jazz|jazzcash/i.test(raw) || /jazz|jazzcash/i.test(mh)) return 'JazzCash';
  if (raw) return raw.length > 32 ? `${raw.slice(0, 29)}…` : raw;
  if (/jazz|jazzcash/i.test(mh)) return 'JazzCash';
  return 'Wallet';
}

/** Name / method hints for PK mobile wallets when DB stores method as `other` and type as `asset`. */
function nameOrMethodLooksLikeWallet(name: string, method: string): boolean {
  const n = name;
  const m = method;
  return (
    /\bndm\b/i.test(n) ||
    /\bndm\s*easy\b/i.test(n) ||
    /\beasypaisa\b/i.test(n) ||
    /\beasy\s*paisa\b/i.test(n) ||
    /\bmobicash\b/i.test(n) ||
    /\bfinja\b/i.test(n) ||
    /\bupaisa\b/i.test(n) ||
    /\bsadapay\b/i.test(n) ||
    /\bnayapay\b/i.test(n) ||
    /\bwallet\b/i.test(n) ||
    /\bndm\b/i.test(m) ||
    /\beasypaisa\b/i.test(m) ||
    /\beasy\s*paisa\b/i.test(m) ||
    /\bmobicash\b/i.test(m)
  );
}

/**
 * Classify a payment row for Roznamcha. Uses `accounts.type` and `accounts.code` (102x = wallet) so
 * NDM Easy / custom wallet names work when `payment_method` is `other`.
 */
export function classifyRoznamchaLiquidity(
  paymentMethod: string,
  accountType: string | null | undefined,
  accountName: string | null | undefined,
  accountCode?: string | null | undefined
): { liquidity: RoznamchaLiquidity | null; shortLabel: string } {
  const m = (paymentMethod || '').toLowerCase().trim();
  const t = String(accountType || '').toLowerCase().trim();
  const n = (accountName || '').toLowerCase().trim();

  if (isWalletAccountCode(accountCode)) {
    return { liquidity: 'wallet', shortLabel: walletDisplayLabel(accountName, paymentMethod) };
  }

  if (t === 'mobile_wallet' || t === 'wallet') {
    return { liquidity: 'wallet', shortLabel: walletDisplayLabel(accountName, paymentMethod) };
  }
  if (t === 'bank' || t === 'card') {
    return { liquidity: 'bank', shortLabel: 'Bank' };
  }
  if (t === 'cash' || t === 'pos') {
    return { liquidity: 'cash', shortLabel: 'Cash' };
  }

  if (
    m === 'mobile_wallet' ||
    /jazz|easypaisa|jazzcash|sadapay|nayapay|upaisa|ndm|mobicash|finja/.test(m) ||
    /\bmobile[_\s-]*wallet\b/.test(m)
  ) {
    return { liquidity: 'wallet', shortLabel: walletDisplayLabel(accountName, paymentMethod) };
  }
  if (m === 'bank' || m === 'card' || /bank|card/.test(m)) {
    return { liquidity: 'bank', shortLabel: 'Bank' };
  }
  if (m === 'cash' || /cash|drawer/.test(m)) {
    return { liquidity: 'cash', shortLabel: 'Cash' };
  }

  if (n && nameOrMethodLooksLikeWallet(n, m)) {
    return { liquidity: 'wallet', shortLabel: walletDisplayLabel(accountName, paymentMethod) };
  }

  if (m === 'other' && n) {
    if (
      /\b(jazz|easypaisa|jazzcash|sadapay|nayapay|mobile\s*wallet|ndm|mobicash|finja)\b/i.test(accountName || '') ||
      /\bwallet\b/i.test(n)
    ) {
      return { liquidity: 'wallet', shortLabel: walletDisplayLabel(accountName, paymentMethod) };
    }
  }

  if (isLiquidityPaymentAccount({ code: accountCode, type: accountType, name: accountName })) {
    const inferred = paymentMethodForLiquidityAccount({
      code: accountCode,
      type: accountType,
      name: accountName,
    });
    const im = inferred.toLowerCase();
    if (im === 'bank') return { liquidity: 'bank', shortLabel: 'Bank' };
    if (
      im === 'mobile_wallet' ||
      isWalletAccountCode(accountCode) ||
      nameOrMethodLooksLikeWallet(n, m)
    ) {
      return { liquidity: 'wallet', shortLabel: walletDisplayLabel(accountName, paymentMethod) };
    }
    return { liquidity: 'cash', shortLabel: 'Cash' };
  }

  return { liquidity: null, shortLabel: '—' };
}

/** Map auth_user_id or users.id → display name for Roznamcha "by …" subtitle. */
async function resolveUserDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const nameByUserId = new Map<string, string>();
  const unique = [...new Set(userIds.filter(Boolean))] as string[];
  if (unique.length === 0) return nameByUserId;

  const { data: usersByAuth } = await supabase
    .from('users')
    .select('auth_user_id, full_name, email')
    .in('auth_user_id', unique);
  (usersByAuth || []).forEach((u: { auth_user_id?: string; full_name?: string; email?: string }) => {
    if (u?.auth_user_id) {
      nameByUserId.set(u.auth_user_id, (u.full_name || u.email || '').trim());
    }
  });

  const missing = unique.filter((id) => !nameByUserId.has(id));
  if (missing.length > 0) {
    const { data: usersById } = await supabase.from('users').select('id, full_name, email').in('id', missing);
    (usersById || []).forEach((u: { id?: string; full_name?: string; email?: string }) => {
      if (u?.id) nameByUserId.set(u.id, (u.full_name || u.email || '').trim());
    });
  }

  return nameByUserId;
}

/**
 * Ref column for Roznamcha: expense rows show EXP-* (expense document / JE), not PAY-*.
 * Does not affect referenceDisplay (payment ref + by user stays as-is).
 */
function roznamchaExpenseRefColumn(
  p: { id: string; reference_type?: string | null; reference_id?: string | null; reference_number?: string | null },
  expenseNoById: Map<string, string>,
  jeByPaymentId: Map<string, string>
): string {
  const refType = String(p.reference_type || '').toLowerCase();
  const defaultRef =
    (p.reference_number && String(p.reference_number)) ||
    `${p.reference_type || 'payment'}-${String(p.reference_id || '').slice(0, 8)}`;

  if (refType !== 'expense') {
    return defaultRef;
  }

  const eid = p.reference_id ? String(p.reference_id) : '';
  if (eid && expenseNoById.has(eid)) {
    return expenseNoById.get(eid)!;
  }

  const jeNo = (jeByPaymentId.get(p.id) || '').trim();
  if (jeNo) return jeNo;
  return defaultRef;
}

/** Fetch payments as roznamcha transactions (cash movements only) */
async function fetchPaymentRows(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
  accountFilter: AccountFilter,
  /** Default false: exclude voided/reversed payment rows (Option 1 — Roznamcha economic view). */
  includeVoidedReversed = false,
  /** When set, only payments posted to this ledger (cash/bank/wallet) account */
  paymentLedgerAccountId: string | null = null
): Promise<RoznamchaRow[]> {
  let q = supabase
    .from('payments')
    .select(`
      id,
      payment_date,
      created_at,
      amount,
      payment_type,
      payment_method,
      reference_type,
      reference_id,
      reference_number,
      notes,
      branch_id,
      payment_account_id,
      created_by,
      received_by,
      contact_id,
      voided_at
    `)
    .eq('company_id', companyId)
    .gte('payment_date', dateFrom)
    .lte('payment_date', dateTo)
    .order('payment_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (!branchId) {
    // company-wide — no branch predicate on query
  }
  if (!includeVoidedReversed) q = q.is('voided_at', null);
  if (paymentLedgerAccountId) q = q.eq('payment_account_id', paymentLedgerAccountId);

  const { data, error } = await q;
  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[roznamchaService] payments query failed:', error.message);
    }
    return [];
  }

  let paymentList = data || [];

  const rentalIdsForBranch = [
    ...new Set(
      paymentList
        .filter((p: any) => String((p as any).reference_type || '').toLowerCase() === 'rental')
        .map((p: any) => (p as any).reference_id)
        .filter(Boolean)
    ),
  ] as string[];
  const rentalBranchById = new Map<string, string>();
  if (rentalIdsForBranch.length > 0) {
    const { data: rentalBranchRows } = await supabase
      .from('rentals')
      .select('id, branch_id')
      .in('id', rentalIdsForBranch);
    (rentalBranchRows || []).forEach((r: any) => {
      if (r?.id && r.branch_id) rentalBranchById.set(String(r.id), String(r.branch_id));
    });
  }

  const journalIdsForBranch = [
    ...new Set(
      paymentList
        .filter((p: any) => {
          const rt = String((p as any).reference_type || '').toLowerCase();
          return rt === 'manual_receipt' || rt === 'manual_payment';
        })
        .map((p: any) => (p as any).reference_id)
        .filter(Boolean)
        .map((id: any) => String(id))
    ),
  ] as string[];
  const journalBranchById = new Map<string, string>();
  if (journalIdsForBranch.length > 0) {
    const { data: jeBranchRows } = await supabase
      .from('journal_entries')
      .select('id, branch_id')
      .in('id', journalIdsForBranch);
    (jeBranchRows || []).forEach((r: any) => {
      if (r?.id && r.branch_id) journalBranchById.set(String(r.id), String(r.branch_id));
    });
  }

  const saleIdsForBranch = [
    ...new Set(
      paymentList
        .filter((p: any) => String((p as any).reference_type || '').toLowerCase() === 'sale')
        .map((p: any) => (p as any).reference_id)
        .filter(Boolean)
        .map((id: any) => String(id))
    ),
  ] as string[];
  const saleBranchById = new Map<string, string>();
  if (saleIdsForBranch.length > 0) {
    const { data: saleBranchRows } = await supabase
      .from('sales')
      .select('id, branch_id')
      .in('id', saleIdsForBranch);
    (saleBranchRows || []).forEach((r: any) => {
      if (r?.id && r.branch_id) saleBranchById.set(String(r.id), String(r.branch_id));
    });
  }

  const branchMaps: RoznamchaBranchMaps = { rentalBranchById, journalBranchById, saleBranchById };

  if (branchId) {
    paymentList = paymentList.filter((p: any) => paymentMatchesRoznamchaBranch(p, branchId, branchMaps));
  }

  const accountIds = [...new Set(paymentList.map((p: any) => p.payment_account_id).filter(Boolean))] as string[];
  const expensePayments = paymentList.filter(
    (p: any) => String((p as any).reference_type || '').toLowerCase() === 'expense'
  );
  const expenseEntityIds = [...new Set(expensePayments.map((p: any) => p.reference_id).filter(Boolean))] as string[];
  const expensePaymentIds = expensePayments.map((p: any) => p.id as string);
  const allPaymentIds = [...new Set(paymentList.map((p: any) => p.id).filter(Boolean))] as string[];
  const courierRefIds = [
    ...new Set(
      paymentList
        .filter((p: any) => String((p as any).reference_type || '').toLowerCase() === 'courier_payment')
        .map((p: any) => p.reference_id)
        .filter(Boolean)
        .map((id: any) => String(id))
    ),
  ] as string[];
  const partyContactIds = [
    ...new Set(
      paymentList
        .map((p: any) => resolvePaymentContactId(p as any))
        .filter(Boolean) as string[]
    ),
  ];
  const contactIdsToFetch = [...new Set([...partyContactIds, ...courierRefIds])];

  const [accRes, expRes, jeRes, jeByPaymentRes, contactRes, expenseCatRes] = await Promise.all([
    accountIds.length > 0
      ? supabase.from('accounts').select('id, name, type, code').in('id', accountIds)
      : Promise.resolve({ data: [] as { id: string; name: string; type: string; code?: string | null }[] }),
    expenseEntityIds.length > 0
      ? supabase
          .from('expenses')
          .select('id, expense_no, description, vendor_name, category, expense_category_id')
          .in('id', expenseEntityIds)
      : Promise.resolve(
          { data: [] as { id: string; expense_no: string; description?: string; vendor_name?: string; category?: string; expense_category_id?: string }[] }
        ),
    expensePaymentIds.length > 0
      ? supabase
          .from('journal_entries')
          .select('payment_id, entry_no')
          .in('payment_id', expensePaymentIds)
          .eq('reference_type', 'expense')
          .eq('company_id', companyId)
      : Promise.resolve({ data: [] as { payment_id: string; entry_no: string }[] }),
    allPaymentIds.length > 0
      ? supabase
          .from('journal_entries')
          .select('id, payment_id, entry_no')
          .eq('company_id', companyId)
          .in('payment_id', allPaymentIds)
      : Promise.resolve({ data: [] as { id: string; payment_id: string; entry_no: string }[] }),
    contactIdsToFetch.length > 0
      ? supabase.from('contacts').select('id, name').in('id', contactIdsToFetch)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from('expense_categories').select('id, name, parent_id').eq('company_id', companyId),
  ]);

  const accountById = new Map<string, { name: string; type: string; code: string | null }>();
  (accRes.data || []).forEach((a: any) => {
    if (a?.id) {
      accountById.set(a.id, {
        name: (a.name || '').trim(),
        type: String(a.type || ''),
        code: a.code != null ? String(a.code).trim() : null,
      });
    }
  });

  const expenseNoById = new Map<string, string>();
  const expenseDescById = new Map<string, string>();
  const expenseVendorById = new Map<string, string>();
  const expenseLegacyCategoryById = new Map<string, string>();
  const categoryPathByExpenseId = new Map<string, string>();
  const categoryById = new Map<string, ExpenseCategoryRow>();
  (expenseCatRes.data || []).forEach((c: any) => {
    if (c?.id) {
      categoryById.set(String(c.id), {
        id: String(c.id),
        name: String(c.name || ''),
        parent_id: c.parent_id ? String(c.parent_id) : null,
      });
    }
  });
  (expRes.data || []).forEach((e: any) => {
    if (e?.id && e.expense_no) expenseNoById.set(String(e.id), String(e.expense_no).trim());
    if (!e?.id) return;
    const eid = String(e.id);
    const desc = String(e.description || '').trim();
    const vendor = String(e.vendor_name || '').trim();
    const legacyCat = String(e.category || '').trim();
    if (desc) expenseDescById.set(eid, desc);
    if (vendor) expenseVendorById.set(eid, vendor);
    if (legacyCat) expenseLegacyCategoryById.set(eid, legacyCat);
    if (e.expense_category_id) {
      const path = buildCategoryPath(String(e.expense_category_id), categoryById);
      if (path) categoryPathByExpenseId.set(eid, path);
    }
  });

  const jeByPaymentId = new Map<string, string>();
  for (const je of jeRes.data || []) {
    const pid = (je as any).payment_id as string | undefined;
    if (!pid) continue;
    const eno = String((je as any).entry_no || '').trim();
    const prev = jeByPaymentId.get(pid);
    if (!prev) jeByPaymentId.set(pid, eno);
    else if (/^EXP-/i.test(eno) && !/^EXP-/i.test(prev)) jeByPaymentId.set(pid, eno);
  }

  /** Prefer journal-style entry numbers (JV-, JE-, …) over raw PAY-* when multiple rows exist. */
  const journalEntryNoByPaymentId = new Map<string, string>();
  const pickBetterJeNo = (prev: string, next: string): string => {
    const a = String(prev || '').trim();
    const b = String(next || '').trim();
    if (!a) return b;
    if (!b) return a;
    const aDoc = /^[A-Za-z]{2,}-\d+/i.test(a) && !/^PAY-/i.test(a);
    const bDoc = /^[A-Za-z]{2,}-\d+/i.test(b) && !/^PAY-/i.test(b);
    if (bDoc && !aDoc) return b;
    if (aDoc && !bDoc) return a;
    return b.length > a.length ? b : a;
  };
  const journalEntryIdByPaymentId = new Map<string, string>();
  for (const je of jeByPaymentRes.data || []) {
    const pid = String((je as any).payment_id || '');
    const eno = String((je as any).entry_no || '').trim();
    const jeUuid = String((je as any).id || '').trim();
    if (!pid || !eno) continue;
    const prev = journalEntryNoByPaymentId.get(pid);
    journalEntryNoByPaymentId.set(pid, prev ? pickBetterJeNo(prev, eno) : eno);
    if (jeUuid && !journalEntryIdByPaymentId.has(pid)) {
      journalEntryIdByPaymentId.set(pid, jeUuid);
    }
  }

  const contactNameById = new Map<string, string>();
  (contactRes.data || []).forEach((c: any) => {
    const nm = String(c?.name || '').trim();
    if (c?.id && nm) contactNameById.set(String(c.id), nm);
  });

  const manualDocJeIdSet = new Set<string>([...journalEntryIdByPaymentId.values()]);
  for (const p of paymentList) {
    const rt = String((p as any).reference_type || '').toLowerCase();
    if (rt !== 'manual_receipt' && rt !== 'manual_payment') continue;
    const refId = (p as any).reference_id ? String((p as any).reference_id) : '';
    if (refId) manualDocJeIdSet.add(refId);
  }
  const manualJeContextById = await loadManualDocumentJeContextById(
    companyId,
    [...manualDocJeIdSet],
  );

  const rows: RoznamchaRow[] = [];
  for (const p of paymentList) {
    const aid = (p as any).payment_account_id as string | null | undefined;
    const meta = aid ? accountById.get(aid) : undefined;
    const methodRaw = String((p as any).payment_method || '');
    const { liquidity, shortLabel } = classifyRoznamchaLiquidity(
      methodRaw,
      meta?.type,
      meta?.name,
      meta?.code
    );

    if (!liquidity) continue;

    if (accountFilter !== 'all') {
      if (accountFilter === 'cash' && liquidity !== 'cash') continue;
      if (accountFilter === 'bank' && liquidity !== 'bank') continue;
      if (accountFilter === 'wallet' && liquidity !== 'wallet') continue;
    }

    const amount = Number(p.amount) || 0;
    const direction = roznamchaPaymentDirection(
      String((p as any).reference_type || ''),
      String((p as any).payment_type || ''),
    );
    const { date: dateStr, time: timeStr } = resolveRoznamchaRowDateTime(
      (p as any).payment_date,
      (p as any).created_at ? String((p as any).created_at) : null,
    );
    const ref = roznamchaExpenseRefColumn(
      {
        id: (p as any).id,
        reference_type: (p as any).reference_type,
        reference_id: (p as any).reference_id,
        reference_number: (p as any).reference_number,
      },
      expenseNoById,
      jeByPaymentId
    );
    const voided = Boolean((p as any).voided_at);
    const baseDetails =
      getPartyAwareTypeLabel(String((p as any).reference_type || ''), String((p as any).payment_type || '')) ||
      (p as any).notes ||
      '—';
    const details =
      includeVoidedReversed && voided ? `${baseDetails} (voided)` : baseDetails;
    // referenceDisplay set below from sale invoice_no / purchase po_no when applicable
    const referenceDisplay = '';

    const payRefType = String((p as any).reference_type || '').toLowerCase();
    const payRefId = (p as any).reference_id ? String((p as any).reference_id) : '';
    const payBranchId =
      (p as any).branch_id ??
      (payRefType === 'rental' && payRefId ? rentalBranchById.get(payRefId) ?? null : null);

    const paymentId = String((p as any).id);
    rows.push({
      id: paymentId,
      date: dateStr,
      time: timeStr,
      ref,
      details,
      referenceDisplay,
      partyLine: null,
      journalEntryNo: journalEntryNoByPaymentId.get(paymentId) || null,
      createdBy: null, // filled below via received_by
      cashIn: direction === 'IN' ? amount : 0,
      cashOut: direction === 'OUT' ? amount : 0,
      direction,
      amount,
      accountType: liquidity,
      accountLabel: resolveSubAccountLabel(meta, shortLabel),
      accountName: meta?.name || null,
      paymentAccountId: aid ?? null,
      sourcePaymentId: paymentId,
      sourceJournalEntryId: journalEntryIdByPaymentId.get(paymentId) || null,
      branchId: payBranchId ?? null,
      type: getPartyAwareTypeLabel((p as any).reference_type, (p as any).payment_type),
    } as RoznamchaRow);
  }

  // Resolve referenceDisplay: sale → Invoice SL-xxx, purchase → PO-xxx, else payment reference_number or notes
  const saleIds = [...new Set(paymentList.filter((p: any) => (p as any).reference_type === 'sale').map((p: any) => (p as any).reference_id).filter(Boolean))] as string[];
  const purchaseIds = [...new Set(paymentList.filter((p: any) => (p as any).reference_type === 'purchase').map((p: any) => (p as any).reference_id).filter(Boolean))] as string[];

  const saleInvoiceByRefId = new Map<string, string>();
  const saleCustomerByRefId = new Map<string, string>();
  const purchasePoByRefId = new Map<string, string>();
  const purchaseSupplierByRefId = new Map<string, string>();
  const rentalBookingByRefId = new Map<string, string>();
  const rentalCustomerByRefId = new Map<string, string>();
  const rentalIds = [
    ...new Set(
      paymentList
        .filter((p: any) => String((p as any).reference_type || '').toLowerCase() === 'rental')
        .map((p: any) => (p as any).reference_id)
        .filter(Boolean)
    ),
  ] as string[];
  const [salesRes, purchasesRes, rentalsRes] = await Promise.all([
    saleIds.length > 0
      ? supabase.from('sales').select('id, invoice_no, customer_name').in('id', saleIds)
      : Promise.resolve({ data: [] as { id: string; invoice_no?: string; customer_name?: string }[] }),
    purchaseIds.length > 0
      ? supabase.from('purchases').select('id, po_no, supplier_name').in('id', purchaseIds)
      : Promise.resolve({ data: [] as { id: string; po_no?: string; supplier_name?: string }[] }),
    rentalIds.length > 0
      ? supabase.from('rentals').select('id, booking_no, customer_name').in('id', rentalIds)
      : Promise.resolve({ data: [] as { id: string; booking_no?: string; customer_name?: string }[] }),
  ]);
  (salesRes.data || []).forEach((s: any) => {
    if (s?.id && s.invoice_no) saleInvoiceByRefId.set(s.id, s.invoice_no);
    const cn = String(s?.customer_name || '').trim();
    if (s?.id && cn) saleCustomerByRefId.set(String(s.id), cn);
  });
  (purchasesRes.data || []).forEach((p: any) => {
    if (p?.id && p.po_no) purchasePoByRefId.set(p.id, p.po_no);
    const sn = String(p?.supplier_name || '').trim();
    if (p?.id && sn) purchaseSupplierByRefId.set(String(p.id), sn);
  });
  (rentalsRes.data || []).forEach((r: any) => {
    const bookingNo = String(r?.booking_no || '').trim();
    const customer = String(r?.customer_name || '').trim();
    if (r?.id && bookingNo) rentalBookingByRefId.set(String(r.id), bookingNo);
    if (r?.id && customer) rentalCustomerByRefId.set(String(r.id), customer);
  });

  const paymentById = new Map(paymentList.map((p: any) => [(p as any).id, p]));
  rows.forEach((r) => {
    const pay = paymentById.get(r.id) as any;
    if (!pay) return;
    const refType = String(pay.reference_type || '').toLowerCase();
    const refId = pay.reference_id ? String(pay.reference_id) : '';
    const paymentType = String(pay.payment_type || '');
    const contactName = resolvePaymentContactName(pay, contactNameById);

    if (refType === 'expense' && refId) {
      const categoryPath = categoryPathByExpenseId.get(refId);
      const legacyCat = expenseLegacyCategoryById.get(refId);
      const desc = expenseDescById.get(refId);
      const vendor = expenseVendorById.get(refId);
      const primary = vendor || categoryPath || legacyCat || desc || 'Shop Expense';
      const expenseDocNo = expenseNoById.get(refId) || r.ref;
      r.details = primary;
      r.referenceDisplay = buildRoznamchaMetaLine(
        expenseDocNo,
        pay.notes,
        [categoryPath, desc].filter(Boolean) as string[],
        primary
      );
      r.partyLine = null;
      return;
    }

    if (refType === 'rental' && refId) {
      const customer =
        contactName ||
        rentalCustomerByRefId.get(refId) ||
        null;
      r.details = customer || 'Rental Payment';
      const bookingNo = rentalBookingByRefId.get(refId) || '';
      const amtLabel = formatRoznamchaRentalAmount(r.amount);
      r.referenceDisplay = buildRoznamchaMetaLine(
        pay.reference_number,
        pay.notes,
        [bookingNo ? `Rental ${bookingNo}` : '', amtLabel].filter(Boolean) as string[]
      );
      r.partyLine = bookingNo ? `Rental: ${bookingNo}` : null;
      return;
    }

    if (refType === 'purchase' && refId) {
      const supplier = contactName || purchaseSupplierByRefId.get(refId) || null;
      r.details = supplier || getPartyAwareTypeLabel(refType, paymentType);
      const extraParts: string[] = [];
      if (purchasePoByRefId.has(refId)) extraParts.push(`PO ${purchasePoByRefId.get(refId)!}`);
      r.referenceDisplay = buildRoznamchaMetaLine(pay.reference_number, pay.notes, extraParts, r.details);
      r.partyLine = supplier ? null : 'Supplier Payment';
      return;
    }

    if (refType === 'manual_receipt' || refType === 'manual_payment') {
      const manualJe = resolveManualDocumentJeForPayment(
        refId,
        r.id,
        journalEntryIdByPaymentId,
        manualJeContextById,
      );
      if (manualJe) {
        const counterparty = counterpartyLabelFromManualJe(manualJe, r.direction);
        r.details =
          counterparty ||
          journalDescriptionForDisplay(manualJe.description, 'General Entry');
        r.referenceDisplay = buildRoznamchaMetaLine(pay.reference_number, pay.notes, [], r.details);
        r.partyLine = null;
        return;
      }
    }

    if (isCustomerReceiptPayment(refType, paymentType)) {
      const customer =
        contactName ||
        (refType === 'sale' && refId ? saleCustomerByRefId.get(refId) : null) ||
        null;
      r.details = customer || getPartyAwareTypeLabel(refType, paymentType);
      const extraParts: string[] = [];
      if (refType === 'sale' && refId && saleInvoiceByRefId.has(refId)) {
        extraParts.push(`Invoice ${saleInvoiceByRefId.get(refId)!}`);
      }
      r.referenceDisplay = buildRoznamchaMetaLine(pay.reference_number, pay.notes, extraParts, r.details);
      r.partyLine = customer ? null : 'Customer Receipt';
      return;
    }

    if (isSupplierPaymentPayment(refType, paymentType)) {
      r.details = contactName || getPartyAwareTypeLabel(refType, paymentType);
      r.referenceDisplay = buildRoznamchaMetaLine(pay.reference_number, pay.notes, [], r.details);
      r.partyLine = contactName ? null : 'Supplier Payment';
      return;
    }

    if (refType === 'courier_payment' && refId && contactNameById.has(refId)) {
      r.details = contactNameById.get(refId)!;
      r.referenceDisplay = buildRoznamchaMetaLine(pay.reference_number, pay.notes);
      r.partyLine = null;
      return;
    }

    if (contactName) {
      r.details = contactName;
    }
    r.referenceDisplay = buildRoznamchaMetaLine(pay.reference_number, pay.notes);
  });

  // Resolve "by [user]" from created_by || received_by (sale = received_by, purchase = received_by, old rows may have created_by only)
  const allUserIds = [
    ...new Set(
      paymentList.flatMap((p: { created_by?: string | null; received_by?: string | null }) =>
        [p.created_by, p.received_by].filter(Boolean),
      ),
    ),
  ] as string[];
  if (allUserIds.length > 0) {
    const nameByUserId = await resolveUserDisplayNames(allUserIds);
    rows.forEach((r) => {
      const p = paymentById.get(r.id) as { created_by?: string | null; received_by?: string | null } | undefined;
      const userId = p?.created_by || p?.received_by || null;
      if (userId) {
        const name = nameByUserId.get(userId);
        r.createdBy = name && name.length > 0 ? name : null;
      }
    });
  }

  rows.forEach((r) => {
    const pay = paymentById.get(r.id) as any;
    if (!pay) return;
    const refType = String(pay.reference_type || '').toLowerCase();
    const refId = pay.reference_id ? String(pay.reference_id) : '';
    const expenseNo =
      refType === 'expense' && refId && expenseNoById.has(refId) ? expenseNoById.get(refId)! : null;
    const rentalBookingNo =
      refType === 'rental' && refId ? rentalBookingByRefId.get(refId) || null : null;
    const canonical = resolveCanonicalRoznamchaRef({
      referenceNumber: pay.reference_number,
      rentalBookingNo,
      expenseNo,
      journalEntryNo: r.journalEntryNo,
      fallbackRef: r.ref,
    });
    r.ref = canonical.ref;
    r.journalEntryNo = canonical.journalEntryNo;
  });

  const rentalPaymentsCoveredByPaymentRows = new Set<string>();
  rows.forEach((r) => {
    const pay = paymentById.get(r.id) as any;
    if (!pay) return;
    if (String(pay.reference_type || '').toLowerCase() !== 'rental') return;
    const refId = pay.reference_id ? String(pay.reference_id) : '';
    if (!refId) return;
    rentalPaymentsCoveredByPaymentRows.add(
      rentalPaymentMatchKey(
        refId,
        String(pay.payment_date || ''),
        Number(pay.amount) || 0,
        pay.payment_account_id
      )
    );
  });

  // ── Rental payments (customer collections stored in rental_payments, not payments) ──
  const rentalPaymentsInPaymentsTable = await loadRentalPaymentsInPaymentsTable(
    companyId,
    branchId,
    dateFrom,
    dateTo,
    null,
    includeVoidedReversed
  );

  const rentalPayRows = await fetchRentalPaymentRows(
    companyId,
    branchId,
    dateFrom,
    dateTo,
    accountFilter,
    includeVoidedReversed,
    paymentLedgerAccountId,
    accountById,
    rentalPaymentsInPaymentsTable,
    rentalPaymentsCoveredByPaymentRows
  );
  rows.push(...rentalPayRows);

  return rows;
}

/** Fetch rental_payments rows (customer cash-IN) and map to RoznamchaRow. */
async function fetchRentalPaymentRows(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
  accountFilter: AccountFilter,
  includeVoidedReversed: boolean,
  paymentLedgerAccountId: string | null,
  accountById: Map<string, { name: string; type: string; code: string | null }>,
  rentalPaymentsInPaymentsTable: Set<string>,
  rentalPaymentsCoveredByPaymentRows: Set<string> = new Set()
): Promise<RoznamchaRow[]> {
  let q = supabase
    .from('rental_payments')
    .select(RENTAL_PAYMENT_ROW_SELECT)
    .eq('rentals.company_id', companyId)
    .gte('payment_date', dateFrom)
    .lte('payment_date', dateTo)
    .order('payment_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (!includeVoidedReversed) q = q.is('voided_at', null);

  const { data: byPayDate, error } = await q;
  if (error) return [];

  const primaryRows = byPayDate || [];
  const primaryIds = new Set(primaryRows.map((r: any) => String(r.id)));
  const supplementalJeIds = await loadRentalPartyPaymentJeIdsInEntryDateRange(
    companyId,
    dateFrom,
    dateTo,
    includeVoidedReversed
  );
  let supplementalRows: any[] = [];
  const extraJeIds = supplementalJeIds.filter((jeId) => {
    return !primaryRows.some((r: any) => String(r.journal_entry_id || '') === jeId);
  });
  if (extraJeIds.length > 0) {
    let supQ = supabase
      .from('rental_payments')
      .select(RENTAL_PAYMENT_ROW_SELECT)
      .eq('rentals.company_id', companyId)
      .in('journal_entry_id', extraJeIds);
    if (!includeVoidedReversed) supQ = supQ.is('voided_at', null);
    const { data: supData } = await supQ;
    supplementalRows = (supData || []).filter((r: any) => !primaryIds.has(String(r.id)));
  }

  const data = [...primaryRows, ...supplementalRows];
  if (!data.length) return [];

  const jeIdsForLiquidity = [
    ...new Set(
      (data as any[])
        .filter((rp: any) => rp.journal_entry_id)
        .map((rp: any) => String(rp.journal_entry_id))
    ),
  ] as string[];
  const liquidityAccountByJeId = await loadLiquidityDebitAccountByJeId(jeIdsForLiquidity, accountById);

  const jeBranchById = new Map<string, string>();
  if (branchId && jeIdsForLiquidity.length > 0) {
    const { data: jeBranchRows } = await supabase
      .from('journal_entries')
      .select('id, branch_id')
      .in('id', jeIdsForLiquidity);
    (jeBranchRows || []).forEach((je: any) => {
      if (je?.id && je.branch_id) jeBranchById.set(String(je.id), String(je.branch_id));
    });
  }

  // Collect any account ids that are not yet in the shared map and resolve them
  const missingAccountIds = [
    ...new Set(
      (data as any[])
        .map((rp: any) => rp.payment_account_id)
        .filter((id: any) => id && !accountById.has(id))
    ),
  ] as string[];
  if (missingAccountIds.length > 0) {
    const { data: extraAccounts } = await supabase
      .from('accounts')
      .select('id, name, type, code')
      .in('id', missingAccountIds);
    (extraAccounts || []).forEach((a: any) => {
      if (a?.id) {
        accountById.set(a.id, {
          name: (a.name || '').trim(),
          type: String(a.type || ''),
          code: a.code != null ? String(a.code).trim() : null,
        });
      }
    });
  }

  const jeIdsForEntryNo = [
    ...new Set(
      (data as any[])
        .filter((rp: any) => rp.journal_entry_id)
        .map((rp: any) => String(rp.journal_entry_id))
    ),
  ] as string[];
  const entryNoByJeId = new Map<string, string>();
  const entryDateByJeId = new Map<string, string>();
  if (jeIdsForEntryNo.length > 0) {
    const { data: jeRows } = await supabase
      .from('journal_entries')
      .select('id, entry_no, entry_date')
      .in('id', jeIdsForEntryNo);
    (jeRows || []).forEach((je: any) => {
      if (je?.id && je.entry_no) entryNoByJeId.set(String(je.id), String(je.entry_no).trim());
      if (je?.id && je.entry_date) entryDateByJeId.set(String(je.id), String(je.entry_date).slice(0, 10));
    });
  }

  const rcvRefByMatchKey = await loadRentalRcvRefByMatchKey(
    companyId,
    branchId,
    dateFrom,
    dateTo,
    includeVoidedReversed
  );

  const rows: RoznamchaRow[] = [];
  const userIdByRowId = new Map<string, string>();
  for (const rp of data as any[]) {
    const rental = (rp.rentals && !Array.isArray(rp.rentals)) ? rp.rentals : (Array.isArray(rp.rentals) ? rp.rentals[0] : null);
    if (!rental) continue;

    const jeBranchId = rp.journal_entry_id
      ? jeBranchById.get(String(rp.journal_entry_id)) || null
      : null;
    if (!rentalMatchesRoznamchaBranch(branchId, rental.branch_id, jeBranchId)) continue;

    const { accountId: aid, liquidity, shortLabel, meta } = resolveRentalPaymentLiquidity(
      rp,
      liquidityAccountByJeId,
      accountById
    );

    if (!liquidity) continue;

    if (accountFilter !== 'all') {
      if (accountFilter === 'cash' && liquidity !== 'cash') continue;
      if (accountFilter === 'bank' && liquidity !== 'bank') continue;
      if (accountFilter === 'wallet' && liquidity !== 'wallet') continue;
    }
    if (paymentLedgerAccountId && aid !== paymentLedgerAccountId) continue;

    const amount = Number(rp.amount) || 0;
    const rentalId = String(rental.id || '');
    const matchKey = rentalPaymentMatchKey(rentalId, rp.payment_date || '', amount, aid);
    if (
      rentalPaymentsInPaymentsTable.has(matchKey) ||
      rentalPaymentsCoveredByPaymentRows.has(matchKey)
    ) {
      continue;
    }

    const linkedJeId = rp.journal_entry_id ? String(rp.journal_entry_id) : '';
    const jeEntryDate = linkedJeId ? entryDateByJeId.get(linkedJeId) : '';
    const payDay = String(rp.payment_date || '').slice(0, 10);
    const payInRange = payDay >= dateFrom && payDay <= dateTo;
    const jeInRange = Boolean(jeEntryDate && jeEntryDate >= dateFrom && jeEntryDate <= dateTo);
    if (!payInRange && !jeInRange) continue;
    const businessDate = payInRange ? payDay : jeEntryDate || payDay;
    const { date: dateStr, time: timeStr } = resolveRoznamchaRowDateTime(
      businessDate,
      rp.created_at ? String(rp.created_at) : null,
    );
    const rentalNo: string = rental.booking_no || (rental as any).rental_no || '';
    const customerName = String((rental as any).customer_name || '').trim();
    let refDisplay = String(rp.reference || '').trim();
    if (!isRcvReference(refDisplay) && /^REN-.+-PAY$/i.test(refDisplay)) {
      const rcvFromPayments = rcvRefByMatchKey.get(matchKey);
      if (rcvFromPayments) refDisplay = rcvFromPayments;
    }
    const rowId = `rp-${rp.id}`;
    const creatorId = rp.created_by || rental.created_by || null;
    if (creatorId) userIdByRowId.set(rowId, String(creatorId));

    const linkedJeNo = rp.journal_entry_id
      ? entryNoByJeId.get(String(rp.journal_entry_id)) || null
      : null;

    const canonical = resolveCanonicalRoznamchaRef({
      referenceNumber: refDisplay,
      rentalBookingNo: rentalNo,
      journalEntryNo: linkedJeNo,
      fallbackRef: rentalNo || refDisplay || `rental-${String(rp.id).slice(0, 8)}`,
    });

    const amtLabel = formatRoznamchaRentalAmount(amount);
    const detailsPrimary = customerName || 'Rental Payment';

    rows.push({
      id: rowId,
      date: dateStr,
      time: timeStr,
      ref: canonical.ref,
      details: detailsPrimary,
      referenceDisplay: buildRoznamchaMetaLine(
        canonical.ref,
        isGenericRentalPaymentReference(String(rp.reference || '')) ? String(rp.reference) : '',
        [rentalNo ? `Rental ${rentalNo}` : '', amtLabel].filter(Boolean) as string[],
        detailsPrimary
      ),
      partyLine: rentalNo ? `Rental: ${rentalNo}` : null,
      journalEntryNo: canonical.journalEntryNo,
      createdBy: null,
      cashIn: amount,
      cashOut: 0,
      direction: 'IN',
      amount,
      accountType: liquidity,
      accountLabel: resolveSubAccountLabel(meta, shortLabel),
      accountName: meta?.name || null,
      paymentAccountId: aid ?? null,
      sourceRentalPaymentId: String(rp.id),
      sourceJournalEntryId: linkedJeId || null,
      branchId: rental.branch_id ?? null,
      type: 'Rental Payment',
    });
  }

  if (userIdByRowId.size > 0) {
    const nameByUserId = await resolveUserDisplayNames([...userIdByRowId.values()]);
    for (const row of rows) {
      const uid = userIdByRowId.get(row.id);
      if (!uid) continue;
      const name = nameByUserId.get(uid);
      row.createdBy = name && name.length > 0 ? name : null;
    }
  }

  return rows;
}

function journalLiquidityTypeLabel(referenceType: string): string {
  const rt = (referenceType || '').toLowerCase();
  const m: Record<string, string> = {
    general: 'General Entry',
    transfer: 'Account Transfer',
    journal: 'Journal Entry',
    manual: 'Manual Entry',
    manual_journal: 'Journal Entry',
  };
  return m[rt] || 'Journal Entry';
}

function sortRoznamchaRows(rows: RoznamchaRow[]): void {
  rows.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    return 0;
  });
}

/** JE ids with a live manual liquidity payment visible in the current Roznamcha branch filter. */
async function journalEntryIdsWithLiquidityPayments(
  companyId: string,
  journalEntryIds: string[],
  branchId: string | null,
): Promise<Set<string>> {
  if (journalEntryIds.length === 0) return new Set();
  const { data } = await supabase
    .from('payments')
    .select('reference_id, branch_id, reference_type')
    .eq('company_id', companyId)
    .in('reference_id', journalEntryIds)
    .in('reference_type', ['manual_receipt', 'manual_payment'])
    .is('voided_at', null);
  const rows = (data || []) as Array<{
    reference_id?: string | null;
    branch_id?: string | null;
    reference_type?: string | null;
  }>;
  if (rows.length === 0) return new Set();

  const jeIdsNeedingBranch = [
    ...new Set(
      rows
        .filter((p) => !p.branch_id && p.reference_id)
        .map((p) => String(p.reference_id)),
    ),
  ];
  const journalBranchById = new Map<string, string>();
  if (jeIdsNeedingBranch.length > 0) {
    const { data: jeRows } = await supabase
      .from('journal_entries')
      .select('id, branch_id')
      .in('id', jeIdsNeedingBranch);
    (jeRows || []).forEach((r: { id?: string; branch_id?: string | null }) => {
      if (r?.id && r.branch_id) journalBranchById.set(String(r.id), String(r.branch_id));
    });
  }

  const branchMaps: RoznamchaBranchMaps = {
    rentalBranchById: new Map(),
    journalBranchById,
    saleBranchById: new Map(),
  };

  const out = new Set<string>();
  rows.forEach((p) => {
    const rid = String(p.reference_id || '').trim();
    if (!rid) return;
    if (!branchId || paymentMatchesRoznamchaBranch(p, branchId, branchMaps)) {
      out.add(rid);
    }
  });
  return out;
}

type JournalLiquidityLineRow = {
  id: string;
  entry_no: string;
  entry_date: string;
  created_at: string | null;
  description: string | null;
  reference_type: string | null;
  reference_id?: string | null;
  action_fingerprint?: string | null;
  branch_id: string | null;
  created_by: string | null;
  is_void?: boolean;
  economic_event_id?: string | null;
  lines: Array<{
    id: string;
    account_id: string;
    debit: number;
    credit: number;
    account?: { id: string; name: string; type: string; code: string | null } | null;
  }>;
};

async function loadExpenseNoById(expenseIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (expenseIds.length === 0) return out;
  const { data } = await supabase.from('expenses').select('id, expense_no').in('id', expenseIds);
  (data || []).forEach((e: { id?: string; expense_no?: string }) => {
    if (e?.id && e.expense_no) out.set(String(e.id), String(e.expense_no).trim());
  });
  return out;
}

function mapJournalLiquidityLinesToRows(
  entries: JournalLiquidityLineRow[],
  skipJeIds: Set<string>,
  accountFilter: AccountFilter,
  paymentLedgerAccountId: string | null,
  nameByUserId: Map<string, string>,
  expenseNoByExpenseId: Map<string, string> = new Map(),
  expenseIdsWithLivePayments: Set<string> = new Set(),
): RoznamchaRow[] {
  const rows: RoznamchaRow[] = [];
  for (const je of entries) {
    if (shouldSkipJournalEntryForRoznamcha(je, skipJeIds, expenseIdsWithLivePayments)) continue;
    const { date: dateStr, time: timeStr } = resolveRoznamchaRowDateTime(
      je.entry_date,
      je.created_at ? String(je.created_at) : null,
    );
    const desc = journalDescriptionForDisplay(je.description, journalLiquidityTypeLabel(je.reference_type || ''));
    const entryNo = String(je.entry_no || '').trim();
    const refType = String(je.reference_type || '').toLowerCase();
    const expenseId = je.reference_id ? String(je.reference_id) : '';
    const expenseNo =
      refType === 'expense' && expenseId ? expenseNoByExpenseId.get(expenseId) : undefined;
    const ref = expenseNo || entryNo || `JE-${String(je.id).slice(0, 8)}`;
    const journalEntryNo =
      expenseNo && entryNo && expenseNo.toLowerCase() !== entryNo.toLowerCase() ? entryNo : null;
    const typeLabel = journalLiquidityTypeLabel(je.reference_type || '');
    const creatorName = je.created_by ? nameByUserId.get(je.created_by) || null : null;

    for (const line of je.lines || []) {
      const rawAcc = line.account as { id: string; name: string; type: string; code: string | null } | { id: string; name: string; type: string; code: string | null }[] | null | undefined;
      const acc = Array.isArray(rawAcc) ? rawAcc[0] : rawAcc;
      if (!acc || !isLiquidityPaymentAccount(acc)) continue;
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      if (debit <= 0 && credit <= 0) continue;
      const amount = debit > 0 ? debit : credit;
      const direction = roznamchaLiquidityLineDirection(je.reference_type, debit, credit);
      const { liquidity, shortLabel } = classifyRoznamchaLiquidity('', acc.type, acc.name, acc.code);
      if (!liquidity) continue;
      if (accountFilter !== 'all') {
        if (accountFilter === 'cash' && liquidity !== 'cash') continue;
        if (accountFilter === 'bank' && liquidity !== 'bank') continue;
        if (accountFilter === 'wallet' && liquidity !== 'wallet') continue;
      }
      if (paymentLedgerAccountId && line.account_id !== paymentLedgerAccountId) continue;

      rows.push({
        id: `jel-${line.id}`,
        date: dateStr,
        time: timeStr,
        ref,
        details: desc,
        referenceDisplay: '',
        partyLine: null,
        journalEntryNo,
        createdBy: creatorName,
        cashIn: direction === 'IN' ? amount : 0,
        cashOut: direction === 'OUT' ? amount : 0,
        direction,
        amount,
        accountType: liquidity,
        accountLabel: resolveSubAccountLabel(
          acc.name ? { name: acc.name } : undefined,
          shortLabel
        ),
        accountName: (acc.name || '').trim() || null,
        paymentAccountId: line.account_id,
        sourceJournalEntryId: String(je.id),
        sourceEconomicEventId: String((je as JournalLiquidityLineRow).economic_event_id || '').trim() || null,
        branchId: je.branch_id ?? null,
        type: typeLabel,
      });
    }
  }
  return rows;
}

async function filterJournalEntriesForRoznamchaBranch(
  entries: JournalLiquidityLineRow[],
  branchId: string | null
): Promise<JournalLiquidityLineRow[]> {
  if (!branchId) return entries;
  const rentalRefIds = [
    ...new Set(
      entries
        .filter((je) => String(je.reference_type || '').toLowerCase() === 'rental' && je.reference_id)
        .map((je) => String(je.reference_id))
    ),
  ];
  const rentalBranchById = new Map<string, string>();
  if (rentalRefIds.length > 0) {
    const { data: rentalRows } = await supabase
      .from('rentals')
      .select('id, branch_id')
      .in('id', rentalRefIds);
    (rentalRows || []).forEach((r: any) => {
      if (r?.id && r.branch_id) rentalBranchById.set(String(r.id), String(r.branch_id));
    });
  }
  return entries.filter((je) =>
    rentalMatchesRoznamchaBranch(
      branchId,
      je.reference_id ? rentalBranchById.get(String(je.reference_id)) : null,
      je.branch_id
    )
  );
}

/** Journal entries (no payment_id) with cash/bank/wallet legs — one Roznamcha row per liquidity line. */
async function fetchJournalLiquidityRows(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
  accountFilter: AccountFilter,
  includeVoidedReversed = false,
  paymentLedgerAccountId: string | null = null,
): Promise<RoznamchaRow[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase
    .from('journal_entries')
    .select(
      `
      id,
      entry_no,
      entry_date,
      created_at,
      description,
      reference_type,
      reference_id,
      action_fingerprint,
      branch_id,
      created_by,
      is_void,
      economic_event_id,
      lines:journal_entry_lines(
        id,
        account_id,
        debit,
        credit,
        account:accounts(id, name, type, code)
      )
    `,
    )
    .eq('company_id', companyId)
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)
    .is('payment_id', null);

  const { data, error } = await q;
  if (error || !data) return [];

  let entries = (data as unknown as JournalLiquidityLineRow[]).filter((je) => {
    if (!includeVoidedReversed && (je as { is_void?: boolean }).is_void === true) return false;
    return true;
  });
  entries = await filterJournalEntriesForRoznamchaBranch(entries, branchId);
  if (entries.length === 0) return [];

  const skipJeIds = await buildJournalSkipJeIds(
    companyId,
    branchId,
    entries.map((e) => e.id),
    includeVoidedReversed,
    { dateFrom, dateTo },
  );

  const userIds = [...new Set(entries.map((e) => e.created_by).filter(Boolean))] as string[];
  const nameByUserId = await resolveUserDisplayNames(userIds);

  const expenseIds = [
    ...new Set(
      entries
        .filter((e) => String(e.reference_type || '').toLowerCase() === 'expense' && e.reference_id)
        .map((e) => String(e.reference_id)),
    ),
  ];
  const [expenseNoByExpenseId, expenseIdsWithLivePayments] = await Promise.all([
    loadExpenseNoById(expenseIds),
    loadExpenseIdsWithLivePayments(companyId, expenseIds, includeVoidedReversed),
  ]);

  return mapJournalLiquidityLinesToRows(
    entries,
    skipJeIds,
    accountFilter,
    paymentLedgerAccountId,
    nameByUserId,
    expenseNoByExpenseId,
    expenseIdsWithLivePayments,
  );
}

/** Opening contribution from journal liquidity legs before dateFrom. */
async function getJournalLiquidityOpeningDelta(
  companyId: string,
  branchId: string | null,
  beforeDate: string,
  accountFilter: AccountFilter,
  includeVoidedReversed = false,
  paymentLedgerAccountId: string | null = null,
): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  let q = supabase
    .from('journal_entries')
    .select(
      `
      id,
      entry_no,
      entry_date,
      created_at,
      description,
      reference_type,
      reference_id,
      action_fingerprint,
      branch_id,
      created_by,
      is_void,
      lines:journal_entry_lines(
        id,
        account_id,
        debit,
        credit,
        account:accounts(id, name, type, code)
      )
    `,
    )
    .eq('company_id', companyId)
    .lt('entry_date', beforeDate)
    .is('payment_id', null);

  const { data, error } = await q;
  if (error || !data) return 0;

  let entries = (data as unknown as JournalLiquidityLineRow[]).filter((je) => {
    if (!includeVoidedReversed && (je as { is_void?: boolean }).is_void === true) return false;
    return true;
  });
  entries = await filterJournalEntriesForRoznamchaBranch(entries, branchId);
  if (entries.length === 0) return 0;

  const skipJeIds = await buildJournalSkipJeIds(
    companyId,
    branchId,
    entries.map((e) => e.id),
    includeVoidedReversed,
    { beforeDate },
  );

  const expenseIds = [
    ...new Set(
      entries
        .filter((e) => String(e.reference_type || '').toLowerCase() === 'expense' && e.reference_id)
        .map((e) => String(e.reference_id)),
    ),
  ];
  const [expenseNoByExpenseId, expenseIdsWithLivePayments] = await Promise.all([
    loadExpenseNoById(expenseIds),
    loadExpenseIdsWithLivePayments(companyId, expenseIds, includeVoidedReversed),
  ]);

  const rows = mapJournalLiquidityLinesToRows(
    entries,
    skipJeIds,
    accountFilter,
    paymentLedgerAccountId,
    new Map(),
    expenseNoByExpenseId,
    expenseIdsWithLivePayments,
  );
  let total = 0;
  for (const r of rows) {
    total += r.direction === 'IN' ? r.amount : -r.amount;
  }
  return total;
}

/** Opening balance = sum(IN) - sum(OUT) for all payments before dateFrom */
export async function getOpeningBalance(
  companyId: string,
  branchId: string | null,
  beforeDate: string,
  accountFilter: AccountFilter,
  includeVoidedReversed = false,
  paymentLedgerAccountId: string | null = null
): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  let q = supabase
    .from('payments')
    .select('amount, payment_type, payment_method, payment_account_id, reference_type, voided_at')
    .eq('company_id', companyId)
    .lt('payment_date', beforeDate);

  if (branchId) q = q.eq('branch_id', branchId);
  if (!includeVoidedReversed) q = q.is('voided_at', null);
  if (paymentLedgerAccountId) q = q.eq('payment_account_id', paymentLedgerAccountId);
  const { data, error } = await q;
  if (error) return 0;

  const list = data || [];
  const obAccountIds = [...new Set(list.map((p: any) => p.payment_account_id).filter(Boolean))] as string[];
  const obAccountById = new Map<string, { name: string; type: string; code: string | null }>();
  if (obAccountIds.length > 0) {
    const { data: accounts } = await supabase.from('accounts').select('id, name, type, code').in('id', obAccountIds);
    (accounts || []).forEach((a: any) => {
      if (a?.id) {
        obAccountById.set(a.id, {
          name: (a.name || '').trim(),
          type: String(a.type || ''),
          code: a.code != null ? String(a.code).trim() : null,
        });
      }
    });
  }

  let total = 0;
  for (const p of list) {
    const aid = (p as any).payment_account_id as string | null | undefined;
    const meta = aid ? obAccountById.get(aid) : undefined;
    const { liquidity } = classifyRoznamchaLiquidity(
      String((p as any).payment_method || ''),
      meta?.type,
      meta?.name,
      meta?.code
    );
    if (accountFilter !== 'all') {
      if (accountFilter === 'cash' && liquidity !== 'cash') continue;
      if (accountFilter === 'bank' && liquidity !== 'bank') continue;
      if (accountFilter === 'wallet' && liquidity !== 'wallet') continue;
    }
    if (!liquidity) continue;
    const amount = Number(p.amount) || 0;
    const dir = roznamchaPaymentDirection(
      String((p as any).reference_type || ''),
      String((p as any).payment_type || ''),
    );
    total += dir === 'IN' ? amount : -amount;
  }

  const rentalPaymentsInPaymentsTable = await loadRentalPaymentsInPaymentsTable(
    companyId,
    branchId,
    null,
    null,
    beforeDate,
    includeVoidedReversed
  );

  // Add rental_payments (cash-IN) when not already in payments table
  let rpQ = supabase
    .from('rental_payments')
    .select(
      'amount, method, payment_account_id, payment_date, rental_id, journal_entry_id, voided_at, rentals!inner(company_id, branch_id, id)'
    )
    .eq('rentals.company_id', companyId)
    .lt('payment_date', beforeDate);
  if (!includeVoidedReversed) rpQ = rpQ.is('voided_at', null);

  const { data: rpData } = await rpQ;
  if (rpData && rpData.length > 0) {
    const obJeIds = [
      ...new Set(
        (rpData as any[])
          .filter((rp: any) => rp.journal_entry_id)
          .map((rp: any) => String(rp.journal_entry_id))
      ),
    ] as string[];
    const obLiquidityByJeId = await loadLiquidityDebitAccountByJeId(obJeIds, obAccountById);
    const obJeBranchById = new Map<string, string>();
    if (branchId && obJeIds.length > 0) {
      const { data: obJeRows } = await supabase
        .from('journal_entries')
        .select('id, branch_id')
        .in('id', obJeIds);
      (obJeRows || []).forEach((je: any) => {
        if (je?.id && je.branch_id) obJeBranchById.set(String(je.id), String(je.branch_id));
      });
    }

    for (const rp of rpData as any[]) {
      const rental = (rp.rentals && !Array.isArray(rp.rentals)) ? rp.rentals : (Array.isArray(rp.rentals) ? rp.rentals[0] : null);
      const jeBranchId = rp.journal_entry_id
        ? obJeBranchById.get(String(rp.journal_entry_id)) || null
        : null;
      if (!rentalMatchesRoznamchaBranch(branchId, rental?.branch_id, jeBranchId)) continue;

      const { accountId: aid, liquidity } = resolveRentalPaymentLiquidity(rp, obLiquidityByJeId, obAccountById);
      if (accountFilter !== 'all') {
        if (accountFilter === 'cash' && liquidity !== 'cash') continue;
        if (accountFilter === 'bank' && liquidity !== 'bank') continue;
        if (accountFilter === 'wallet' && liquidity !== 'wallet') continue;
      }
      if (!liquidity) continue;
      if (paymentLedgerAccountId && aid !== paymentLedgerAccountId) continue;
      const rentalId = String(rp.rental_id || rental?.id || '');
      const rpAmount = Number(rp.amount) || 0;
      const rpDate = String(rp.payment_date || '');
      const matchKey = rentalPaymentMatchKey(rentalId, rpDate, rpAmount, aid);
      if (rentalPaymentsInPaymentsTable.has(matchKey)) continue;
      total += rpAmount;
    }
  }

  total += await getJournalLiquidityOpeningDelta(
    companyId,
    branchId,
    beforeDate,
    accountFilter,
    includeVoidedReversed,
    paymentLedgerAccountId,
  );

  return total;
}

/** Build running balance and summary from rows + opening */
function buildSummaryAndRunning(
  rows: RoznamchaRow[],
  openingBalance: number
): { rowsWithBalance: (RoznamchaRow & { runningBalance: number })[]; summary: RoznamchaSummary; cashSplit: RoznamchaCashSplit } {
  let running = openingBalance;
  const rowsWithBalance = rows.map((r) => {
    if (r.direction === 'IN') running += r.amount;
    else running -= r.amount;
    return { ...r, runningBalance: running };
  });

  const cashIn = rows.reduce((s, r) => s + (r.direction === 'IN' ? r.amount : 0), 0);
  const cashOut = rows.reduce((s, r) => s + (r.direction === 'OUT' ? r.amount : 0), 0);
  const closingBalance = openingBalance + cashIn - cashOut;

  let cash = 0;
  let bank = 0;
  let wallet = 0;
  for (const r of rows) {
    const delta = r.direction === 'IN' ? r.amount : -r.amount;
    if (r.accountType === 'wallet') wallet += delta;
    else if (r.accountType === 'bank') bank += delta;
    else if (r.accountType === 'cash') cash += delta;
    else cash += delta;
  }
  cash += openingBalance;
  const cashSplit: RoznamchaCashSplit = {
    cash: Math.round(cash * 100) / 100,
    bank: Math.round(bank * 100) / 100,
    wallet: Math.round(wallet * 100) / 100,
    total: closingBalance,
  };

  return {
    rowsWithBalance,
    summary: {
      openingBalance,
      cashIn,
      cashOut,
      closingBalance,
    },
    cashSplit,
  };
}

/** Recover rental_party_payment JEs skipped from journal path but not emitted via rental_payments. */
async function recoverOrphanRentalPaymentJeRows(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
  accountFilter: AccountFilter,
  includeVoidedReversed: boolean,
  paymentLedgerAccountId: string | null,
  existingRows: RoznamchaRow[]
): Promise<RoznamchaRow[]> {
  const representedEntityKeys = new Set<string>();
  for (const row of existingRows) {
    for (const k of roznamchaEntityKeys(row)) representedEntityKeys.add(k);
  }
  const representedMovementKeys = new Set(existingRows.map((r) => roznamchaMovementKey(r)));

  const jeIds = await loadRentalPartyPaymentJeIdsInEntryDateRange(
    companyId,
    dateFrom,
    dateTo,
    includeVoidedReversed
  );
  if (!jeIds.length) return [];

  const { data: jeData, error } = await supabase
    .from('journal_entries')
    .select(
      `
      id,
      entry_no,
      entry_date,
      created_at,
      description,
      reference_type,
      reference_id,
      action_fingerprint,
      branch_id,
      created_by,
      is_void,
      lines:journal_entry_lines(
        id,
        account_id,
        debit,
        credit,
        account:accounts(id, name, type, code)
      )
    `
    )
    .eq('company_id', companyId)
    .in('id', jeIds)
    .is('payment_id', null);

  if (error || !jeData?.length) return [];

  let entries = (jeData as unknown as JournalLiquidityLineRow[]).filter((je) => {
    if (!includeVoidedReversed && je.is_void === true) return false;
    return true;
  });
  entries = await filterJournalEntriesForRoznamchaBranch(entries, branchId);
  if (!entries.length) return [];

  const rentalRefIds = [
    ...new Set(
      entries
        .filter((je) => je.reference_id)
        .map((je) => String(je.reference_id))
    ),
  ];
  const rentalInfoById = new Map<string, { booking_no?: string; customer_name?: string; branch_id?: string }>();
  if (rentalRefIds.length > 0) {
    const { data: rentalRows } = await supabase
      .from('rentals')
      .select('id, booking_no, customer_name, branch_id')
      .in('id', rentalRefIds);
    (rentalRows || []).forEach((r: any) => {
      if (r?.id) rentalInfoById.set(String(r.id), r);
    });
  }

  const rpRefByJeId = new Map<string, string>();
  const rpIdByJeId = new Map<string, string>();
  if (jeIds.length > 0) {
    const { data: rpRows } = await supabase
      .from('rental_payments')
      .select('id, journal_entry_id, reference')
      .in('journal_entry_id', jeIds)
      .is('voided_at', null);
    (rpRows || []).forEach((rp: any) => {
      const jeId = String(rp?.journal_entry_id || '').trim();
      const ref = String(rp?.reference || '').trim();
      const rpId = String(rp?.id || '').trim();
      if (jeId && ref) rpRefByJeId.set(jeId, ref);
      if (jeId && rpId) rpIdByJeId.set(jeId, rpId);
    });
  }

  const userIds = [...new Set(entries.map((e) => e.created_by).filter(Boolean))] as string[];
  const nameByUserId = await resolveUserDisplayNames(userIds);
  const recovered: RoznamchaRow[] = [];

  for (const je of entries) {
    const jeIdStr = String(je.id);
    if (representedEntityKeys.has(`je:${jeIdStr}`)) continue;
    const linkedRpId = rpIdByJeId.get(jeIdStr);
    if (linkedRpId && representedEntityKeys.has(`rp:${linkedRpId}`)) continue;

    const rental = je.reference_id ? rentalInfoById.get(String(je.reference_id)) : undefined;
    const rentalNo = String(rental?.booking_no || '').trim();
    const { date: dateStr, time: timeStr } = resolveRoznamchaRowDateTime(
      je.entry_date,
      je.created_at ? String(je.created_at) : null,
    );
    const creatorName = je.created_by ? nameByUserId.get(je.created_by) || null : null;
    const storedRpRef = rpRefByJeId.get(String(je.id)) || '';
    const canonical = resolveCanonicalRoznamchaRef({
      referenceNumber: storedRpRef || (rentalNo ? formatRentalPaymentRef(rentalNo) : ''),
      rentalBookingNo: rentalNo,
      journalEntryNo: je.entry_no,
      fallbackRef: je.entry_no || `JE-${String(je.id).slice(0, 8)}`,
    });
    const customerLabel = String(rental?.customer_name || '').trim() || 'Rental Payment';

    for (const line of je.lines || []) {
      const rawAcc = line.account as { id: string; name: string; type: string; code: string | null } | { id: string; name: string; type: string; code: string | null }[] | null | undefined;
      const acc = Array.isArray(rawAcc) ? rawAcc[0] : rawAcc;
      if (!acc || !isLiquidityPaymentAccount(acc)) continue;
      const debit = Number(line.debit) || 0;
      if (debit <= 0) continue;
      const { liquidity, shortLabel } = classifyRoznamchaLiquidity('', acc.type, acc.name, acc.code);
      if (!liquidity) continue;
      if (accountFilter !== 'all') {
        if (accountFilter === 'cash' && liquidity !== 'cash') continue;
        if (accountFilter === 'bank' && liquidity !== 'bank') continue;
        if (accountFilter === 'wallet' && liquidity !== 'wallet') continue;
      }
      if (paymentLedgerAccountId && line.account_id !== paymentLedgerAccountId) continue;

      const candidate: RoznamchaRow = {
        id: `orphan-rp-${je.id}-${line.id}`,
        date: dateStr,
        time: timeStr,
        ref: canonical.ref,
        details: customerLabel,
        referenceDisplay: buildRoznamchaMetaLine(
          canonical.ref,
          je.description || '',
          [rentalNo ? `Rental ${rentalNo}` : '', formatRoznamchaRentalAmount(debit)].filter(Boolean) as string[],
          customerLabel
        ),
        partyLine: rentalNo ? `Rental: ${rentalNo}` : null,
        journalEntryNo: canonical.journalEntryNo,
        createdBy: creatorName,
        cashIn: debit,
        cashOut: 0,
        direction: 'IN',
        amount: debit,
        accountType: liquidity,
        accountLabel: resolveSubAccountLabel(
          acc.name ? { name: acc.name } : undefined,
          shortLabel
        ),
        accountName: (acc.name || '').trim() || null,
        paymentAccountId: line.account_id,
        sourceJournalEntryId: String(je.id),
        branchId: rental?.branch_id ?? je.branch_id ?? null,
        type: 'Rental Payment',
      };
      const candidateEntityKeys = roznamchaEntityKeys(candidate);
      if (candidateEntityKeys.some((k) => representedEntityKeys.has(k))) continue;
      if (representedMovementKeys.has(roznamchaMovementKey(candidate))) continue;
      recovered.push(candidate);
      for (const k of candidateEntityKeys) representedEntityKeys.add(k);
      representedMovementKeys.add(roznamchaMovementKey(candidate));
    }
  }

  return recovered;
}

function roznamchaTraceEnabled(): boolean {
  return Boolean(import.meta.env?.DEV) || String(import.meta.env?.VITE_ROZNAMCHA_TRACE || '') === '1';
}

function isRoznamchaTraceTarget(row: RoznamchaRow): boolean {
  const ref = String(row.ref || '').trim();
  const details = String(row.details || '').trim();
  const je = String(row.journalEntryNo || '').trim();
  if (/HQ-RCV-0006/i.test(ref)) return true;
  if (/JE-0012/i.test(je) || /JE-0012/i.test(ref)) return true;
  if (String(row.date || '').startsWith('2026-06-04') && Math.round(row.amount) === 10000 && /Inayat/i.test(details)) {
    return true;
  }
  return false;
}

function logRoznamchaTraceDedupe(pre: RoznamchaRow[], post: RoznamchaRow[]): void {
  if (!roznamchaTraceEnabled()) return;
  const preTargets = pre.filter(isRoznamchaTraceTarget);
  if (preTargets.length === 0) return;
  const postTargets = post.filter(isRoznamchaTraceTarget);
  const removed = preTargets.filter(
    (p) => !postTargets.some((q) => q.id === p.id || (q.ref === p.ref && q.sourceJournalEntryId === p.sourceJournalEntryId))
  );
  if (removed.length > 0) {
    console.warn('[roznamcha trace] Row(s) removed by dedupe (likely movement-key collapse before fix):', removed.map((r) => ({
      id: r.id,
      ref: r.ref,
      date: r.date,
      amount: r.amount,
      sourcePaymentId: r.sourcePaymentId,
      sourceRentalPaymentId: r.sourceRentalPaymentId,
      sourceJournalEntryId: r.sourceJournalEntryId,
      paymentAccountId: r.paymentAccountId,
    })));
  }
  if (preTargets.length > 0 && postTargets.length === 0) {
    console.warn('[roznamcha trace] Trace target present pre-dedupe but missing post-dedupe — check fetch/skip paths');
  }
  if (postTargets.length > 0) {
    console.log('[roznamcha trace] Trace target(s) in final Roznamcha:', postTargets.map((r) => r.ref));
  }
}

async function fetchRoznamchaPreDedupeRows(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
  accountFilterParam: AccountFilter = 'all',
  includeVoidedReversed = false,
  paymentLedgerAccountId: string | null = null
): Promise<RoznamchaRow[]> {
  const [paymentRows, journalRows] = await Promise.all([
    fetchPaymentRows(
      companyId,
      branchId,
      dateFrom,
      dateTo,
      accountFilterParam,
      includeVoidedReversed,
      paymentLedgerAccountId
    ),
    fetchJournalLiquidityRows(
      companyId,
      branchId,
      dateFrom,
      dateTo,
      accountFilterParam,
      includeVoidedReversed,
      paymentLedgerAccountId
    ),
  ]);
  const orphanRentalRows = await recoverOrphanRentalPaymentJeRows(
    companyId,
    branchId,
    dateFrom,
    dateTo,
    accountFilterParam,
    includeVoidedReversed,
    paymentLedgerAccountId,
    [...paymentRows, ...journalRows]
  );
  return [...paymentRows, ...journalRows, ...orphanRentalRows];
}

/** Pre/post dedupe rows for Developer Center Roznamcha Trace (read-only). */
export async function getRoznamchaTraceDiagnostics(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string
): Promise<{ preDedupe: RoznamchaRow[]; postDedupe: RoznamchaRow[] }> {
  const preDedupe = await fetchRoznamchaPreDedupeRows(
    companyId,
    branchId,
    dateFrom,
    dateTo,
    'all',
    false,
    null
  );
  const postDedupe = dedupeRoznamchaRows(preDedupe);
  return { preDedupe, postDedupe };
}

const EMPTY_ROZNAMCHA: RoznamchaResult = {
  rows: [],
  summary: { openingBalance: 0, cashIn: 0, cashOut: 0, closingBalance: 0 },
  cashSplit: { cash: 0, bank: 0, wallet: 0, total: 0 },
};

/** Get full roznamcha for date range */
export async function getRoznamcha(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
  accountFilterParam: AccountFilter = 'all',
  includeVoidedReversed = false,
  paymentLedgerAccountId: string | null = null
): Promise<RoznamchaResult> {
  if (!isSupabaseConfigured) return EMPTY_ROZNAMCHA;
  const [openingBalance, preDedupe] = await Promise.all([
    getOpeningBalance(
      companyId,
      branchId,
      dateFrom,
      accountFilterParam,
      includeVoidedReversed,
      paymentLedgerAccountId
    ),
    fetchRoznamchaPreDedupeRows(
      companyId,
      branchId,
      dateFrom,
      dateTo,
      accountFilterParam,
      includeVoidedReversed,
      paymentLedgerAccountId
    ),
  ]);
  if (roznamchaTraceEnabled()) {
    const tracePre = preDedupe.filter(isRoznamchaTraceTarget);
    if (tracePre.length > 0) {
      console.log('[roznamcha trace] Pre-dedupe sources:', tracePre.map((r) => ({
        id: r.id,
        ref: r.ref,
        date: r.date,
        amount: r.amount,
        source: r.id.startsWith('rp-') ? 'rental_payments' : r.id.startsWith('jel-') || r.id.startsWith('orphan-') ? 'journal' : 'payments',
      })));
    } else if (dateFrom <= '2026-06-04' && dateTo >= '2026-06-04') {
      console.warn('[roznamcha trace] HQ-RCV-0006 / JE-0012 not in pre-dedupe — excluded by fetch (date/branch/liquidity/rental skip)');
    }
  }
  const inRangeRows = preDedupe.filter((r) => isEventDateInRange(r.date, dateFrom, dateTo));
  const rows = dedupeRoznamchaRows(inRangeRows);
  logRoznamchaTraceDedupe(inRangeRows, rows);
  sortRoznamchaRows(rows);
  const { rowsWithBalance, summary, cashSplit } = buildSummaryAndRunning(rows, openingBalance);
  return {
    rows: rowsWithBalance,
    summary,
    cashSplit,
  };
}
