/**
 * Roznamcha (Daily Cash Book) – Cash In / Cash Out only (not Journal Debit/Credit).
 * SOURCE LOCK (Phase 1): Movement from payments only; account names from accounts.
 */

import { supabase } from '@/lib/supabase';

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
    on_account: 'On-Account Supplier Payment',
    rental: 'Rental Payment',
    studio_order: 'Studio Payment',
    worker_payment: 'Worker Payment',
    courier_payment: 'Courier Payment',
    manual_receipt: 'Manual Receipt',
    manual_payment: 'Manual Payment',
  };
  return m[(referenceType || '').toLowerCase()] || referenceType || 'Payment';
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
  if (error) return [];

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

  const [accRes, expRes, jeRes, jeByPaymentRes, courierRes] = await Promise.all([
    accountIds.length > 0
      ? supabase.from('accounts').select('id, name, type, code').in('id', accountIds)
      : Promise.resolve({ data: [] as { id: string; name: string; type: string; code?: string | null }[] }),
    expenseEntityIds.length > 0
      ? supabase
          .from('expenses')
          .select('id, expense_no, description, vendor_name')
          .in('id', expenseEntityIds)
      : Promise.resolve({ data: [] as { id: string; expense_no: string; description?: string; vendor_name?: string }[] }),
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
    courierRefIds.length > 0
      ? supabase.from('contacts').select('id, name').in('id', courierRefIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
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
  const expensePartyById = new Map<string, string>();
  (expRes.data || []).forEach((e: any) => {
    if (e?.id && e.expense_no) expenseNoById.set(String(e.id), String(e.expense_no).trim());
    if (e?.id) {
      const parts: string[] = [];
      const d = String(e.description || '').trim();
      const v = String(e.vendor_name || '').trim();
      if (d) parts.push(d);
      if (v) parts.push(v);
      if (parts.length) expensePartyById.set(String(e.id), parts.join(' · '));
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

  const courierNameById = new Map<string, string>();
  (courierRes.data || []).forEach((c: any) => {
    const nm = String(c?.name || '').trim();
    if (c?.id && nm) courierNameById.set(String(c.id), nm);
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
      type: getTypeLabel((p as any).reference_type),
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
    const refType = (pay.reference_type || '').toLowerCase();
    const refId = pay.reference_id;
    if (refType === 'sale' && refId && saleInvoiceByRefId.has(refId)) {
      r.referenceDisplay = `Invoice ${saleInvoiceByRefId.get(refId)!}`;
    } else if (refType === 'purchase' && refId && purchasePoByRefId.has(refId)) {
      r.referenceDisplay = `PO ${purchasePoByRefId.get(refId)!}`;
    } else {
      r.referenceDisplay = pay.reference_number || pay.notes || '';
    }
  });

  // Resolve "by [user]" from created_by || received_by (sale = received_by, purchase = received_by, old rows may have created_by only)
  const allUserIds = [...new Set(
    paymentList.flatMap((p: any) => [(p as any).created_by, (p as any).received_by].filter(Boolean))
  )] as string[];
  if (allUserIds.length > 0) {
    const nameByUserId = new Map<string, string>();
    const { data: usersByAuth } = await supabase.from('users').select('auth_user_id, full_name, email').in('auth_user_id', allUserIds);
    (usersByAuth || []).forEach((u: any) => {
      if (u?.auth_user_id) nameByUserId.set(u.auth_user_id, u.full_name || u.email || '');
    });
    const missing = allUserIds.filter((id) => !nameByUserId.has(id));
    if (missing.length > 0) {
      const { data: usersById } = await supabase.from('users').select('id, full_name, email').in('id', missing);
      (usersById || []).forEach((u: any) => {
        if (u?.id) nameByUserId.set(u.id, u.full_name || u.email || '');
      });
    }
    rows.forEach((r) => {
      const p = paymentById.get(r.id) as any;
      const userId = p?.created_by || p?.received_by || null;
      if (userId) r.createdBy = nameByUserId.get(userId) || null;
    });
  }

  rows.forEach((r) => {
    const pay = paymentById.get(r.id) as any;
    if (!pay) return;
    const refType = String(pay.reference_type || '').toLowerCase();
    const refId = pay.reference_id ? String(pay.reference_id) : '';
    if (refType === 'sale' && refId && saleCustomerByRefId.has(refId)) {
      r.partyLine = `Customer: ${saleCustomerByRefId.get(refId)!}`;
    } else if (refType === 'purchase' && refId && purchaseSupplierByRefId.has(refId)) {
      r.partyLine = `Supplier: ${purchaseSupplierByRefId.get(refId)!}`;
    } else if (refType === 'expense' && refId && expensePartyById.has(refId)) {
      r.partyLine = `Expense: ${expensePartyById.get(refId)!}`;
    } else if (refType === 'courier_payment' && refId && courierNameById.has(refId)) {
      r.partyLine = `Courier: ${courierNameById.get(refId)!}`;
    }
  });

  return rows;
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
    const amount = Number(p.amount) || 0;
    const dir = getDirection((p as any).payment_type);
    total += dir === 'IN' ? amount : -amount;
  }
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
  const rows = await fetchPaymentRows(
    companyId,
    branchId,
    dateFrom,
    dateTo,
    accountFilterParam,
    includeVoidedReversed,
    paymentLedgerAccountId
  );
  const { rowsWithBalance, summary, cashSplit } = buildSummaryAndRunning(rows, openingBalance);
  return {
    rows: rowsWithBalance,
    summary,
    cashSplit,
  };
}
