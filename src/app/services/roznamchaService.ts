/**
 * Roznamcha (Daily Cash Book) – Cash In / Cash Out only (not Journal Debit/Credit).
 * Sources: payments (sale receipts, customer payments, expense payments, purchase payments).
 */

import { supabase } from '@/lib/supabase';

export type AccountFilter = 'all' | 'cash' | 'bank';

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
  cashIn: number;
  cashOut: number;
  direction: 'IN' | 'OUT';
  amount: number;
  accountType: 'cash' | 'bank' | null;
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
    rental: 'Rental Payment',
    studio_order: 'Studio Payment',
  };
  return m[(referenceType || '').toLowerCase()] || referenceType || 'Payment';
}

/** Fetch payments as roznamcha transactions (cash movements only) */
async function fetchPaymentRows(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
  accountFilter: AccountFilter
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
      received_by
    `)
    .eq('company_id', companyId)
    .gte('payment_date', dateFrom)
    .lte('payment_date', dateTo)
    .order('payment_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (branchId) q = q.eq('branch_id', branchId);

  const { data, error } = await q;
  if (error) return [];

  const rows: RoznamchaRow[] = [];
  for (const p of data || []) {
    const method = String((p as any).payment_method || '').toLowerCase();
    const isCash = method === 'cash' || /cash|drawer/i.test(method);
    const isBank = method === 'bank' || /bank|card/i.test(method);
    const isJazzCash = /jazz|mobile|wallet|easypaisa|jazzcash/i.test(method);
    const accountType: 'cash' | 'bank' | null = isCash ? 'cash' : isBank ? 'bank' : null;
    const accountLabel = isCash ? 'Cash' : isBank ? 'Bank' : isJazzCash ? 'JazzCash' : '—';

    if (accountFilter !== 'all') {
      if (accountFilter === 'cash' && !isCash) continue;
      if (accountFilter === 'bank' && !isBank) continue;
    }

    const amount = Number(p.amount) || 0;
    const direction = getDirection((p as any).payment_type);
    const dateStr = (p as any).payment_date || '';
    const createdAt = (p as any).created_at ? new Date((p as any).created_at) : new Date();
    const timeStr = createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const ref = (p as any).reference_number || (p as any).reference_type + '-' + String((p as any).reference_id || '').slice(0, 8);
    const details = getTypeLabel((p as any).reference_type) || (p as any).notes || '—';
    // referenceDisplay set below from sale invoice_no / purchase po_no when applicable
    const referenceDisplay = '';

    rows.push({
      id: (p as any).id,
      date: dateStr,
      time: timeStr,
      ref,
      details,
      referenceDisplay,
      createdBy: null, // filled below via received_by
      cashIn: direction === 'IN' ? amount : 0,
      cashOut: direction === 'OUT' ? amount : 0,
      direction,
      amount,
      accountType,
      accountLabel,
      branchId: (p as any).branch_id ?? null,
      type: getTypeLabel((p as any).reference_type),
    } as RoznamchaRow);
  }

  // Resolve referenceDisplay: sale → Invoice SL-xxx, purchase → PO-xxx, else payment reference_number or notes
  const saleIds = [...new Set((data || []).filter((p: any) => (p as any).reference_type === 'sale').map((p: any) => (p as any).reference_id).filter(Boolean))] as string[];
  const purchaseIds = [...new Set((data || []).filter((p: any) => (p as any).reference_type === 'purchase').map((p: any) => (p as any).reference_id).filter(Boolean))] as string[];

  const saleInvoiceByRefId = new Map<string, string>();
  const purchasePoByRefId = new Map<string, string>();
  if (saleIds.length > 0) {
    const { data: sales } = await supabase.from('sales').select('id, invoice_no').in('id', saleIds);
    (sales || []).forEach((s: any) => {
      if (s?.id && s.invoice_no) saleInvoiceByRefId.set(s.id, s.invoice_no);
    });
  }
  if (purchaseIds.length > 0) {
    const { data: purchases } = await supabase.from('purchases').select('id, po_no').in('id', purchaseIds);
    (purchases || []).forEach((p: any) => {
      if (p?.id && p.po_no) purchasePoByRefId.set(p.id, p.po_no);
    });
  }

  const paymentById = new Map((data || []).map((p: any) => [(p as any).id, p]));
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
    (data || []).flatMap((p: any) => [(p as any).created_by, (p as any).received_by].filter(Boolean))
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

  // Resolve payment_account_id to actual account name from accounts table
  const accountIds = [...new Set((data || []).map((p: any) => (p as any).payment_account_id).filter(Boolean))] as string[];
  if (accountIds.length > 0) {
    const { data: accounts } = await supabase.from('accounts').select('id, name').in('id', accountIds);
    const nameByAccountId = new Map<string, string>((accounts || []).map((a: any) => [a.id, (a.name || '').trim()]));
    rows.forEach((r) => {
      const p = paymentById.get(r.id) as any;
      const aid = p?.payment_account_id;
      if (aid) r.accountName = nameByAccountId.get(aid) || null;
    });
  }

  return rows;
}

/** Opening balance = sum(IN) - sum(OUT) for all payments before dateFrom */
export async function getOpeningBalance(
  companyId: string,
  branchId: string | null,
  beforeDate: string,
  accountFilter: AccountFilter
): Promise<number> {
  let q = supabase
    .from('payments')
    .select('amount, payment_type, payment_method')
    .eq('company_id', companyId)
    .lt('payment_date', beforeDate);

  if (branchId) q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) return 0;

  let total = 0;
  for (const p of data || []) {
    if (accountFilter !== 'all') {
      const method = String((p as any).payment_method || '').toLowerCase();
      const isCash = method === 'cash' || /cash|drawer/i.test(method);
      const isBank = method === 'bank' || /bank|card/i.test(method);
      if (accountFilter === 'cash' && !isCash) continue;
      if (accountFilter === 'bank' && !isBank) continue;
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
  for (const r of rows) {
    const delta = r.direction === 'IN' ? r.amount : -r.amount;
    if (r.accountType === 'cash') cash += delta;
    else if (r.accountType === 'bank') bank += delta;
    else cash += delta;
  }
  cash += openingBalance;
  const cashSplit: RoznamchaCashSplit = {
    cash: Math.round(cash * 100) / 100,
    bank: Math.round(bank * 100) / 100,
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
  accountFilterParam: AccountFilter = 'all'
): Promise<RoznamchaResult> {
  const openingBalance = await getOpeningBalance(companyId, branchId, dateFrom, accountFilterParam);
  const rows = await fetchPaymentRows(companyId, branchId, dateFrom, dateTo, accountFilterParam);
  const { rowsWithBalance, summary, cashSplit } = buildSummaryAndRunning(rows, openingBalance);
  return {
    rows: rowsWithBalance,
    summary,
    cashSplit,
  };
}
