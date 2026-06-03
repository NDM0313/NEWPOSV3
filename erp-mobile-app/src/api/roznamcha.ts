/**
 * Roznamcha (Daily Cash Book) – Cash In / Cash Out only (not Journal Debit/Credit).
 * Keep in sync with src/app/services/roznamchaService.ts (web ERP).
 * Primary source: payments; journal-only liquidity legs merged when payment_id is null.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isLiquidityPaymentAccount } from '../lib/liquidityPaymentAccount';
import { journalDescriptionForDisplay } from '../utils/journalDescriptionDisplay';

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
  if (rt === 'on_account') return dir === 'IN' ? 'Customer Receipt' : 'Supplier Payment';
  if (rt === 'manual_receipt') return 'Customer Receipt';
  if (rt === 'manual_payment') return 'Supplier Payment';
  return getTypeLabel(referenceType);
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
  return rt === 'on_account' || rt === 'manual_receipt' || rt === 'payment';
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

  if (branchId) q = q.eq('branch_id', branchId);
  if (!includeVoidedReversed) q = q.is('voided_at', null);
  if (paymentLedgerAccountId) q = q.eq('payment_account_id', paymentLedgerAccountId);

  const { data, error } = await q;
  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[roznamcha] payments query failed:', error.message);
    }
    return [];
  }

  const paymentList = data || [];
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
    const baseDetails = getTypeLabel((p as any).reference_type) || (p as any).notes || '—';
    const details =
      includeVoidedReversed && voided ? `${baseDetails} (voided)` : baseDetails;
    // referenceDisplay set below from sale invoice_no / purchase po_no when applicable
    const referenceDisplay = '';

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
      accountLabel: shortLabel,
      accountName: meta?.name || null,
      branchId: (p as any).branch_id ?? null,
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
      const primary = categoryPath || legacyCat || desc || 'Shop Expense';
      r.details = primary;
      r.referenceDisplay = buildRoznamchaMetaLine(
        pay.reference_number,
        pay.notes,
        [desc, vendor].filter(Boolean) as string[],
        primary
      );
      r.partyLine = null;
      return;
    }

    if (isCustomerReceiptPayment(refType, paymentType)) {
      r.details = contactName || getPartyAwareTypeLabel(refType, paymentType);
      r.referenceDisplay = buildRoznamchaMetaLine(pay.reference_number, pay.notes, [], r.details);
      r.partyLine = contactName ? null : 'Customer Receipt';
      return;
    }

    if (isSupplierPaymentPayment(refType, paymentType)) {
      r.details = contactName || getPartyAwareTypeLabel(refType, paymentType);
      r.referenceDisplay = buildRoznamchaMetaLine(pay.reference_number, pay.notes, [], r.details);
      r.partyLine = contactName ? null : 'Supplier Payment';
      return;
    }

    if (refType === 'sale' && refId && saleInvoiceByRefId.has(refId)) {
      r.referenceDisplay = buildRoznamchaMetaLine(
        null,
        pay.notes,
        [`Invoice ${saleInvoiceByRefId.get(refId)!}`]
      );
    } else if (refType === 'purchase' && refId && purchasePoByRefId.has(refId)) {
      r.referenceDisplay = buildRoznamchaMetaLine(
        null,
        pay.notes,
        [`PO ${purchasePoByRefId.get(refId)!}`]
      );
    } else {
      r.referenceDisplay = buildRoznamchaMetaLine(pay.reference_number, pay.notes);
    }
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
    if (refType === 'expense' || isCustomerReceiptPayment(refType, String(pay.payment_type || '')) || isSupplierPaymentPayment(refType, String(pay.payment_type || ''))) {
      return;
    }
    if (refType === 'sale' && refId && saleCustomerByRefId.has(refId)) {
      r.partyLine = `Customer: ${saleCustomerByRefId.get(refId)!}`;
    } else if (refType === 'purchase' && refId && purchaseSupplierByRefId.has(refId)) {
      r.partyLine = `Supplier: ${purchaseSupplierByRefId.get(refId)!}`;
    } else if (refType === 'courier_payment' && refId && contactNameById.has(refId)) {
      r.partyLine = `Courier: ${contactNameById.get(refId)!}`;
    }
  });

  // ── Rental payments (customer collections stored in rental_payments, not payments) ──
  const rentalPayRows = await fetchRentalPaymentRows(
    companyId,
    branchId,
    dateFrom,
    dateTo,
    accountFilter,
    paymentLedgerAccountId,
    accountById
  );
  rows.push(...rentalPayRows);

  // Re-sort merged rows by date then created_at
  rows.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    return 0;
  });

  return rows;
}

/** Fetch rental_payments rows (customer cash-IN) and map to RoznamchaRow. */
async function fetchRentalPaymentRows(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
  accountFilter: AccountFilter,
  paymentLedgerAccountId: string | null,
  accountById: Map<string, { name: string; type: string; code: string | null }>
): Promise<RoznamchaRow[]> {
  // PostgREST inner join: only rental_payments whose rental.company_id matches
  // Note: live DB uses booking_no (not rental_no) on the rentals table
  let q = supabase
    .from('rental_payments')
    .select(
      'id, amount, method, payment_date, created_at, reference, payment_account_id, created_by, rentals!inner(id, booking_no, company_id, branch_id, created_by)',
    )
    .eq('rentals.company_id', companyId)
    .gte('payment_date', dateFrom)
    .lte('payment_date', dateTo)
    .order('payment_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (branchId) q = (q as any).eq('rentals.branch_id', branchId);

  const { data, error } = await q;
  if (error || !data) return [];

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

  const rows: RoznamchaRow[] = [];
  const userIdByRowId = new Map<string, string>();
  for (const rp of data as any[]) {
    const rental = (rp.rentals && !Array.isArray(rp.rentals)) ? rp.rentals : (Array.isArray(rp.rentals) ? rp.rentals[0] : null);
    if (!rental) continue;

    const aid = rp.payment_account_id as string | null | undefined;
    const meta = aid ? accountById.get(aid) : undefined;
    const methodRaw = String(rp.method || '');
    const { liquidity, shortLabel } = classifyRoznamchaLiquidity(methodRaw, meta?.type, meta?.name, meta?.code);

    if (accountFilter !== 'all') {
      if (accountFilter === 'cash' && liquidity !== 'cash') continue;
      if (accountFilter === 'bank' && liquidity !== 'bank') continue;
      if (accountFilter === 'wallet' && liquidity !== 'wallet') continue;
    }
    if (paymentLedgerAccountId && aid !== paymentLedgerAccountId) continue;

    const amount = Number(rp.amount) || 0;
    const dateStr = rp.payment_date || '';
    const createdAt = rp.created_at ? new Date(rp.created_at) : new Date();
    const timeStr = createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    // live DB uses booking_no; rental_no may exist in newer schema variants
    const rentalNo: string = rental.booking_no || (rental as any).rental_no || rental.id || '';
    const refDisplay = String(rp.reference || rentalNo || '').trim();
    const rowId = `rp-${rp.id}`;
    const creatorId = rp.created_by || rental.created_by || null;
    if (creatorId) userIdByRowId.set(rowId, String(creatorId));

    rows.push({
      id: rowId,
      date: dateStr,
      time: timeStr,
      ref: rentalNo || refDisplay || `rental-${String(rp.id).slice(0, 8)}`,
      details: 'Rental Payment',
      referenceDisplay: refDisplay,
      partyLine: rentalNo ? `Rental: ${rentalNo}` : null,
      journalEntryNo: null,
      createdBy: null,
      cashIn: amount,
      cashOut: 0,
      direction: 'IN',
      amount,
      accountType: liquidity,
      accountLabel: shortLabel,
      accountName: meta?.name || null,
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
    if (skipJeIds.has(je.id)) continue;
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
        journalEntryNo: entryNo || null,
        createdBy: creatorName,
        cashIn: direction === 'IN' ? amount : 0,
        cashOut: direction === 'OUT' ? amount : 0,
        direction,
        amount,
        accountType: liquidity,
        accountLabel: shortLabel,
        accountName: (acc.name || '').trim() || null,
        branchId: je.branch_id ?? null,
        type: typeLabel,
      });
    }
  }
  return rows;
}

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

  const skipJeIds = await journalEntryIdsWithLiquidityPayments(
    companyId,
    entries.map((e) => e.id),
  );

  const userIds = [...new Set(entries.map((e) => e.created_by).filter(Boolean))] as string[];
  const nameByUserId = await resolveUserDisplayNames(userIds);

  return mapJournalLiquidityLinesToRows(entries, skipJeIds, accountFilter, paymentLedgerAccountId, nameByUserId);
}

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

  const skipJeIds = await journalEntryIdsWithLiquidityPayments(
    companyId,
    entries.map((e) => e.id),
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
  if (!isSupabaseConfigured) return 0;
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
    const amount = Number(p.amount) || 0;
    const dir = getDirection((p as any).payment_type);
    total += dir === 'IN' ? amount : -amount;
  }

  // Add rental_payments (cash-IN from customers) to opening balance
  // Note: live DB uses booking_no (not rental_no) on rentals table
  let rpQ = supabase
    .from('rental_payments')
    .select('amount, method, payment_account_id, rentals!inner(company_id, branch_id)')
    .eq('rentals.company_id', companyId)
    .lt('payment_date', beforeDate);
  if (branchId) rpQ = (rpQ as any).eq('rentals.branch_id', branchId);
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
      total += Number(rp.amount) || 0; // rental payments are always cash-IN
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
  const rows = [...paymentRows, ...journalRows];
  sortRoznamchaRows(rows);
  const { rowsWithBalance, summary, cashSplit } = buildSummaryAndRunning(rows, openingBalance);
  return {
    rows: rowsWithBalance,
    summary,
    cashSplit,
  };
}
