/**
 * Roznamcha (Daily Cash Book) – Cash In / Cash Out only (not Journal Debit/Credit).
 * Primary source: payments (+ rental_payments). Journal-only rows with cash/bank/wallet legs
 * (general entry, internal transfer, pure journal) are merged when payment_id is null.
 */

import { supabase } from '@/lib/supabase';
import { isLiquidityPaymentAccount } from '@/app/lib/liquidityPaymentAccount';
import { journalDescriptionForDisplay } from '@/app/utils/journalDescriptionDisplay';
import {
  formatRentalPaymentRef,
  isGenericRentalPaymentReference,
} from '@/app/lib/rentalPaymentRef';

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
  const t = (paymentType || '').toLowerCase();
  return t === 'received' ? 'IN' : 'OUT';
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

/** Branch filter: payment row branch OR linked rental document branch (legacy null payment.branch_id). */
function paymentMatchesRoznamchaBranch(
  payment: {
    branch_id?: string | null;
    reference_type?: string | null;
    reference_id?: string | null;
  },
  branchId: string | null,
  rentalBranchById: Map<string, string>
): boolean {
  if (!branchId) return true;
  const payBranch = payment.branch_id != null ? String(payment.branch_id) : '';
  if (payBranch === branchId) return true;
  const rt = String(payment.reference_type || '').toLowerCase();
  if (rt === 'rental' && payment.reference_id) {
    return rentalBranchById.get(String(payment.reference_id)) === branchId;
  }
  return false;
}

/** Fingerprint for dedupe: one cash movement → one row (strict — includes account). */
export function roznamchaMovementKey(row: RoznamchaRow): string {
  return `${row.date}|${row.direction}|${Math.round(row.amount * 100)}|${row.paymentAccountId || ''}`;
}

/** Loose dedupe: same date + direction + amount (ignores account id gaps). */
export function roznamchaLooseMovementKey(row: RoznamchaRow): string {
  return `${row.date}|${row.direction}|${Math.round(row.amount * 100)}`;
}

function refQualityScore(row: RoznamchaRow): number {
  const ref = String(row.ref || '').trim();
  if (/^RCV-/i.test(ref)) return 5;
  if (/^PAY-/i.test(ref) || /^WPY-/i.test(ref)) return 5;
  if (/^REN-/i.test(ref)) return 5;
  if (/^EXP-/i.test(ref)) return 4;
  if (/^JE-/i.test(ref) || /^JV-/i.test(ref)) return 1;
  return 2;
}

function mergeRoznamchaRowMetadata(winner: RoznamchaRow, loser: RoznamchaRow): RoznamchaRow {
  const merged = { ...winner };
  const winnerRef = String(merged.ref || '').trim();
  const loserRef = String(loser.ref || '').trim();
  const loserHasPay = /-PAY$/i.test(loserRef);
  const winnerHasPay = /-PAY$/i.test(winnerRef);
  if (loserHasPay && !winnerHasPay) {
    merged.ref = loserRef;
  } else if (refQualityScore(loser) > refQualityScore(merged)) {
    merged.ref = loser.ref;
  }
  if (!merged.paymentAccountId && loser.paymentAccountId) {
    merged.paymentAccountId = loser.paymentAccountId;
    merged.accountName = merged.accountName || loser.accountName;
    merged.accountType = merged.accountType || loser.accountType;
    merged.accountLabel = merged.accountName
      ? resolveSubAccountLabel({ name: merged.accountName }, merged.accountLabel)
      : loser.accountLabel || merged.accountLabel;
  }
  if (!merged.details || merged.details === 'Rental Payment' || merged.details === 'Customer Receipt' || merged.details === 'Supplier Payment') {
    if (loser.details && loser.details !== merged.details) merged.details = loser.details;
  }
  const loserJe = String(loser.journalEntryNo || '').trim();
  const mergedRef = String(merged.ref || '').trim();
  if (loserJe && loserJe.toLowerCase() !== mergedRef.toLowerCase()) {
    merged.journalEntryNo = merged.journalEntryNo || loserJe;
  }
  return merged;
}

function pickBetterRoznamchaRow(a: RoznamchaRow, b: RoznamchaRow): RoznamchaRow {
  const pa = roznamchaRowSourcePriority(a.id);
  const pb = roznamchaRowSourcePriority(b.id);
  let winner: RoznamchaRow;
  let loser: RoznamchaRow;
  if (pa !== pb) {
    winner = pa > pb ? a : b;
    loser = pa > pb ? b : a;
  } else {
    const ra = refQualityScore(a);
    const rb = refQualityScore(b);
    if (ra !== rb) {
      winner = ra > rb ? a : b;
      loser = ra > rb ? b : a;
    } else {
      winner = a;
      loser = b;
    }
  }
  return mergeRoznamchaRowMetadata(winner, loser);
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

  if (/^RCV-/i.test(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle };
  if (/^PAY-/i.test(refNum) || /^WPY-/i.test(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle };
  if (/^REN-.+-PAY$/i.test(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle || (jeNo || null) };
  if (rentalNo && (isGenericRentalPaymentReference(refNum) || !refNum)) {
    const synthesized = formatRentalPaymentRef(rentalNo);
    return {
      ref: synthesized || rentalNo,
      journalEntryNo: jeNo && jeNo.toLowerCase() !== (synthesized || rentalNo).toLowerCase() ? jeNo : null,
    };
  }
  if (rentalNo) return { ref: rentalNo, journalEntryNo: jeNo && jeNo.toLowerCase() !== rentalNo.toLowerCase() ? jeNo : null };
  if (/^REN-/i.test(refNum)) return { ref: refNum, journalEntryNo: jeSubtitle };
  if (expenseNo) return { ref: expenseNo, journalEntryNo: jeNo && jeNo.toLowerCase() !== expenseNo.toLowerCase() ? jeNo : null };
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
  return je;
}

function finalizeRoznamchaRow(row: RoznamchaRow): RoznamchaRow {
  row.accountLabel = resolveSubAccountLabel(
    row.accountName ? { name: row.accountName } : undefined,
    row.accountLabel
  );
  row.journalEntryNo = roznamchaJournalSubtitle(row);
  return row;
}

function roznamchaRowSourcePriority(id: string): number {
  if (id.startsWith('jel-')) return 1;
  if (id.startsWith('rp-')) return 2;
  return 3;
}

/** When keys collide, keep payments > rental_payments > journal; loose pass merges same amount. */
export function dedupeRoznamchaRows(rows: RoznamchaRow[]): RoznamchaRow[] {
  const bestByStrict = new Map<string, RoznamchaRow>();
  for (const row of rows) {
    const key = roznamchaMovementKey(row);
    const prev = bestByStrict.get(key);
    bestByStrict.set(key, prev ? pickBetterRoznamchaRow(prev, row) : row);
  }
  const bestByLoose = new Map<string, RoznamchaRow>();
  for (const row of bestByStrict.values()) {
    const key = roznamchaLooseMovementKey(row);
    const prev = bestByLoose.get(key);
    bestByLoose.set(key, prev ? pickBetterRoznamchaRow(prev, row) : row);
  }
  return [...bestByLoose.values()].map(finalizeRoznamchaRow);
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
  const out = new Set<string>();
  (data || []).forEach((rp: any) => {
    const jeId = String(rp.journal_entry_id || '').trim();
    if (jeId) out.add(jeId);
  });
  return out;
}

function shouldSkipJournalEntryForRoznamcha(
  je: { id: string; reference_type?: string | null },
  skipJeIds: Set<string>
): boolean {
  if (skipJeIds.has(je.id)) return true;
  const rt = String(je.reference_type || '').toLowerCase();
  return ROZNAMCHA_DOCUMENT_JE_TYPES.has(rt);
}

async function buildJournalSkipJeIds(
  companyId: string,
  branchId: string | null,
  journalEntryIds: string[],
  includeVoidedReversed: boolean,
  dateOpts: { dateFrom?: string; dateTo?: string; beforeDate?: string }
): Promise<Set<string>> {
  const skipJeIds = await journalEntryIdsWithLiquidityPayments(companyId, journalEntryIds);
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
  const low = raw.toLowerCase();
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
  if (jeNo && /^EXP-/i.test(jeNo)) {
    return jeNo;
  }

  const payRef = String(p.reference_number || '').trim();
  const payMatch = payRef.match(/^PAY-(\d+)$/i);
  if (payMatch) {
    return `EXP-${payMatch[1]}`;
  }

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
    if (process.env.NODE_ENV === 'development') {
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

  if (branchId) {
    paymentList = paymentList.filter((p: any) => paymentMatchesRoznamchaBranch(p, branchId, rentalBranchById));
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
          .select('payment_id, entry_no')
          .eq('company_id', companyId)
          .in('payment_id', allPaymentIds)
      : Promise.resolve({ data: [] as { payment_id: string; entry_no: string }[] }),
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
  for (const je of jeByPaymentRes.data || []) {
    const pid = String((je as any).payment_id || '');
    const eno = String((je as any).entry_no || '').trim();
    if (!pid || !eno) continue;
    const prev = journalEntryNoByPaymentId.get(pid);
    journalEntryNoByPaymentId.set(pid, prev ? pickBetterJeNo(prev, eno) : eno);
  }

  const contactNameById = new Map<string, string>();
  (contactRes.data || []).forEach((c: any) => {
    const nm = String(c?.name || '').trim();
    if (c?.id && nm) contactNameById.set(String(c.id), nm);
  });

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
    const direction = getDirection((p as any).payment_type);
    const dateStr = (p as any).payment_date || '';
    const createdAt = (p as any).created_at ? new Date((p as any).created_at) : new Date();
    const timeStr = createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
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

    rows.push({
      id: (p as any).id,
      date: dateStr,
      time: timeStr,
      ref,
      details,
      referenceDisplay,
      partyLine: null,
      journalEntryNo: journalEntryNoByPaymentId.get(String((p as any).id)) || null,
      createdBy: null, // filled below via received_by
      cashIn: direction === 'IN' ? amount : 0,
      cashOut: direction === 'OUT' ? amount : 0,
      direction,
      amount,
      accountType: liquidity,
      accountLabel: resolveSubAccountLabel(meta, shortLabel),
      accountName: meta?.name || null,
      paymentAccountId: aid ?? null,
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
  if (saleIds.length > 0) {
    const { data: sales } = await supabase.from('sales').select('id, invoice_no, customer_name').in('id', saleIds);
    (sales || []).forEach((s: any) => {
      if (s?.id && s.invoice_no) saleInvoiceByRefId.set(s.id, s.invoice_no);
      const cn = String(s?.customer_name || '').trim();
      if (s?.id && cn) saleCustomerByRefId.set(String(s.id), cn);
    });
  }
  if (purchaseIds.length > 0) {
    const { data: purchases } = await supabase.from('purchases').select('id, po_no, supplier_name').in('id', purchaseIds);
    (purchases || []).forEach((p: any) => {
      if (p?.id && p.po_no) purchasePoByRefId.set(p.id, p.po_no);
      const sn = String(p?.supplier_name || '').trim();
      if (p?.id && sn) purchaseSupplierByRefId.set(String(p.id), sn);
    });
  }
  const rentalIds = [
    ...new Set(
      paymentList
        .filter((p: any) => String((p as any).reference_type || '').toLowerCase() === 'rental')
        .map((p: any) => (p as any).reference_id)
        .filter(Boolean)
    ),
  ] as string[];
  if (rentalIds.length > 0) {
    const { data: rentals } = await supabase
      .from('rentals')
      .select('id, booking_no, customer_name')
      .in('id', rentalIds);
    (rentals || []).forEach((r: any) => {
      const bookingNo = String(r?.booking_no || '').trim();
      const customer = String(r?.customer_name || '').trim();
      if (r?.id && bookingNo) rentalBookingByRefId.set(String(r.id), bookingNo);
      if (r?.id && customer) rentalCustomerByRefId.set(String(r.id), customer);
    });
  }

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
      r.details = primary;
      r.referenceDisplay = buildRoznamchaMetaLine(
        pay.reference_number,
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
      r.referenceDisplay = buildRoznamchaMetaLine(pay.reference_number, pay.notes, bookingNo ? [`Rental ${bookingNo}`] : []);
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
    const refForCanon =
      refType === 'rental' && rentalBookingNo
        ? formatRentalPaymentRef(rentalBookingNo)
        : pay.reference_number;
    const canonical = resolveCanonicalRoznamchaRef({
      referenceNumber: refForCanon,
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
    .select(
      'id, amount, method, payment_date, created_at, reference, payment_account_id, journal_entry_id, created_by, voided_at, rentals!inner(id, booking_no, company_id, branch_id, created_by, customer_name)',
    )
    .eq('rentals.company_id', companyId)
    .gte('payment_date', dateFrom)
    .lte('payment_date', dateTo)
    .order('payment_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (branchId) q = (q as any).eq('rentals.branch_id', branchId);
  if (!includeVoidedReversed) q = q.is('voided_at', null);

  const { data, error } = await q;
  if (error || !data) return [];

  const jeIdsNeedingAccount = [
    ...new Set(
      (data as any[])
        .filter((rp: any) => !rp.payment_account_id && rp.journal_entry_id)
        .map((rp: any) => String(rp.journal_entry_id))
    ),
  ] as string[];
  const liquidityAccountByJeId = new Map<string, string>();
  if (jeIdsNeedingAccount.length > 0) {
    const { data: jeLines } = await supabase
      .from('journal_entry_lines')
      .select('journal_entry_id, account_id, debit, credit, account:accounts(id, name, type, code)')
      .in('journal_entry_id', jeIdsNeedingAccount);
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
  if (jeIdsForEntryNo.length > 0) {
    const { data: jeRows } = await supabase
      .from('journal_entries')
      .select('id, entry_no')
      .in('id', jeIdsForEntryNo);
    (jeRows || []).forEach((je: any) => {
      if (je?.id && je.entry_no) entryNoByJeId.set(String(je.id), String(je.entry_no).trim());
    });
  }

  const rows: RoznamchaRow[] = [];
  const userIdByRowId = new Map<string, string>();
  for (const rp of data as any[]) {
    const rental = (rp.rentals && !Array.isArray(rp.rentals)) ? rp.rentals : (Array.isArray(rp.rentals) ? rp.rentals[0] : null);
    if (!rental) continue;

    let aid = (rp.payment_account_id as string | null | undefined) || null;
    if (!aid && rp.journal_entry_id) {
      aid = liquidityAccountByJeId.get(String(rp.journal_entry_id)) || null;
    }
    const meta = aid ? accountById.get(aid) : undefined;
    const methodRaw = String(rp.method || '');
    const { liquidity, shortLabel } = classifyRoznamchaLiquidity(methodRaw, meta?.type, meta?.name, meta?.code);

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
      rentalPaymentsInPaymentsTable.has(matchKey) &&
      rentalPaymentsCoveredByPaymentRows.has(matchKey)
    ) {
      continue;
    }

    const dateStr = rp.payment_date || '';
    const createdAt = rp.created_at ? new Date(rp.created_at) : new Date();
    const timeStr = createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const rentalNo: string = rental.booking_no || (rental as any).rental_no || '';
    const customerName = String((rental as any).customer_name || '').trim();
    const refDisplay = String(rp.reference || '').trim();
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

    const genericNote = isGenericRentalPaymentReference(refDisplay) ? refDisplay : '';
    const detailsParts = [customerName || 'Rental Payment', genericNote].filter(Boolean);

    rows.push({
      id: rowId,
      date: dateStr,
      time: timeStr,
      ref: canonical.ref,
      details: detailsParts.join(' · '),
      referenceDisplay: refDisplay && refDisplay !== canonical.ref ? refDisplay : '',
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
    transfer: 'Internal Transfer',
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

/** JE ids that already have synthetic liquidity payments (reference_id = journal entry id). */
async function journalEntryIdsWithLiquidityPayments(companyId: string, journalEntryIds: string[]): Promise<Set<string>> {
  if (journalEntryIds.length === 0) return new Set();
  const { data } = await supabase
    .from('payments')
    .select('reference_id')
    .eq('company_id', companyId)
    .in('reference_id', journalEntryIds);
  const out = new Set<string>();
  (data || []).forEach((p: { reference_id?: string | null }) => {
    const rid = String(p.reference_id || '').trim();
    if (rid) out.add(rid);
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
  branch_id: string | null;
  created_by: string | null;
  lines: Array<{
    id: string;
    account_id: string;
    debit: number;
    credit: number;
    account?: { id: string; name: string; type: string; code: string | null } | null;
  }>;
};

function mapJournalLiquidityLinesToRows(
  entries: JournalLiquidityLineRow[],
  skipJeIds: Set<string>,
  accountFilter: AccountFilter,
  paymentLedgerAccountId: string | null,
  nameByUserId: Map<string, string>,
): RoznamchaRow[] {
  const rows: RoznamchaRow[] = [];
  for (const je of entries) {
    if (shouldSkipJournalEntryForRoznamcha(je, skipJeIds)) continue;
    const dateStr = je.entry_date || '';
    const createdAt = je.created_at ? new Date(je.created_at) : new Date();
    const timeStr = createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const desc = journalDescriptionForDisplay(je.description, journalLiquidityTypeLabel(je.reference_type || ''));
    const entryNo = String(je.entry_no || '').trim();
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
      const direction: 'IN' | 'OUT' = debit > 0 ? 'IN' : 'OUT';
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
        ref: entryNo || `JE-${String(je.id).slice(0, 8)}`,
        details: desc,
        referenceDisplay: '',
        partyLine: null,
        journalEntryNo: null,
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
        branchId: je.branch_id ?? null,
        type: typeLabel,
      });
    }
  }
  return rows;
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
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)
    .is('payment_id', null);

  if (branchId) q = q.eq('branch_id', branchId);

  const { data, error } = await q;
  if (error || !data) return [];

  const entries = (data as unknown as JournalLiquidityLineRow[]).filter((je) => {
    if (!includeVoidedReversed && (je as { is_void?: boolean }).is_void === true) return false;
    return true;
  });
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

  return mapJournalLiquidityLinesToRows(entries, skipJeIds, accountFilter, paymentLedgerAccountId, nameByUserId);
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

  if (branchId) q = q.eq('branch_id', branchId);

  const { data, error } = await q;
  if (error || !data) return 0;

  const entries = (data as unknown as JournalLiquidityLineRow[]).filter((je) => {
    if (!includeVoidedReversed && (je as { is_void?: boolean }).is_void === true) return false;
    return true;
  });
  if (entries.length === 0) return 0;

  const skipJeIds = await buildJournalSkipJeIds(
    companyId,
    branchId,
    entries.map((e) => e.id),
    includeVoidedReversed,
    { beforeDate },
  );

  const rows = mapJournalLiquidityLinesToRows(entries, skipJeIds, accountFilter, paymentLedgerAccountId, new Map());
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
  let q = supabase
    .from('payments')
    .select('amount, payment_type, payment_method, payment_account_id, voided_at')
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
    const dir = getDirection((p as any).payment_type);
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
    .select('amount, method, payment_account_id, payment_date, rental_id, voided_at, rentals!inner(company_id, branch_id, id)')
    .eq('rentals.company_id', companyId)
    .lt('payment_date', beforeDate);
  if (branchId) rpQ = (rpQ as any).eq('rentals.branch_id', branchId);
  if (!includeVoidedReversed) rpQ = rpQ.is('voided_at', null);
  if (paymentLedgerAccountId) rpQ = rpQ.eq('payment_account_id', paymentLedgerAccountId);

  const { data: rpData } = await rpQ;
  if (rpData && rpData.length > 0) {
    // Resolve any account ids not yet in obAccountById
    const rpMissingIds = [
      ...new Set(
        (rpData as any[])
          .map((rp: any) => rp.payment_account_id)
          .filter((id: any) => id && !obAccountById.has(id))
      ),
    ] as string[];
    if (rpMissingIds.length > 0) {
      const { data: rpAccounts } = await supabase
        .from('accounts')
        .select('id, name, type, code')
        .in('id', rpMissingIds);
      (rpAccounts || []).forEach((a: any) => {
        if (a?.id) {
          obAccountById.set(a.id, {
            name: (a.name || '').trim(),
            type: String(a.type || ''),
            code: a.code != null ? String(a.code).trim() : null,
          });
        }
      });
    }

    for (const rp of rpData as any[]) {
      const aid = rp.payment_account_id as string | null | undefined;
      const meta = aid ? obAccountById.get(aid) : undefined;
      const { liquidity } = classifyRoznamchaLiquidity(String(rp.method || ''), meta?.type, meta?.name, meta?.code);
      if (accountFilter !== 'all') {
        if (accountFilter === 'cash' && liquidity !== 'cash') continue;
        if (accountFilter === 'bank' && liquidity !== 'bank') continue;
        if (accountFilter === 'wallet' && liquidity !== 'wallet') continue;
      }
      if (!liquidity) continue;
      const rental = (rp.rentals && !Array.isArray(rp.rentals)) ? rp.rentals : (Array.isArray(rp.rentals) ? rp.rentals[0] : null);
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
  const openingBalance = await getOpeningBalance(
    companyId,
    branchId,
    dateFrom,
    accountFilterParam,
    includeVoidedReversed,
    paymentLedgerAccountId
  );
  const paymentRows = await fetchPaymentRows(
    companyId,
    branchId,
    dateFrom,
    dateTo,
    accountFilterParam,
    includeVoidedReversed,
    paymentLedgerAccountId,
  );
  const journalRows = await fetchJournalLiquidityRows(
    companyId,
    branchId,
    dateFrom,
    dateTo,
    accountFilterParam,
    includeVoidedReversed,
    paymentLedgerAccountId,
  );
  const rows = dedupeRoznamchaRows([...paymentRows, ...journalRows]);
  sortRoznamchaRows(rows);
  const { rowsWithBalance, summary, cashSplit } = buildSummaryAndRunning(rows, openingBalance);
  return {
    rows: rowsWithBalance,
    summary,
    cashSplit,
  };
}
