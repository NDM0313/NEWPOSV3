/**
 * Build LedgerData (same shape as Customer Ledger) for Supplier, User, and Worker.
 * Supplier/user operational statements use purchases, payments, expenses, and sales (commission) — not duplicate subledger tables.
 * Worker uses worker_ledger_entries. Customer ledger stays on customerLedgerApi.
 */

import { supabase } from '@/lib/supabase';
import type { LedgerData, Transaction, Invoice } from '@/app/services/customerLedgerTypes';

export type LedgerEntityType = 'supplier' | 'user' | 'worker';

/** Operational document date when header date is null (aligns with COALESCE patterns in summary RPCs). */
function effectiveYmdFromDoc(doc: { invoice_date?: unknown; po_date?: unknown; created_at?: unknown }): string {
  const primary =
    doc.invoice_date != null && String(doc.invoice_date).trim() !== ''
      ? doc.invoice_date
      : doc.po_date != null && String(doc.po_date).trim() !== ''
        ? doc.po_date
        : null;
  if (primary != null && String(primary).trim() !== '') return String(primary).slice(0, 10);
  const c = doc.created_at;
  if (!c) return '';
  if (typeof c === 'string' && c.length >= 10) return c.slice(0, 10);
  const t = new Date(c as string).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * @deprecated Alias for {@link getSupplierOperationalLedgerData} (legacy duplicate subledger removed).
 */
export async function getSupplierLedgerData(
  companyId: string,
  supplierId: string,
  supplierName: string,
  fromDate: string,
  toDate: string
): Promise<LedgerData> {
  return getSupplierOperationalLedgerData(companyId, supplierId, supplierName, fromDate, toDate);
}

/**
 * Supplier operational statement: purchases + supplier-linked payments from source tables.
 * Payable running balance = opening + purchase totals (credit column) − payments (debit column).
 * Equivalently: carry += credit − debit per event (purchases increase what we owe; payments decrease it).
 */
export async function getSupplierOperationalLedgerData(
  companyId: string,
  supplierId: string,
  supplierName: string,
  fromDate: string,
  toDate: string
): Promise<LedgerData> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('supplier_opening_balance, opening_balance')
    .eq('id', supplierId)
    .eq('company_id', companyId)
    .maybeSingle();

  const openingBase =
    Number((contact as { supplier_opening_balance?: number; opening_balance?: number } | null)?.supplier_opening_balance ??
      (contact as { opening_balance?: number } | null)?.opening_balance ??
      0) || 0;

  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, po_date, po_no, total, paid_amount, due_amount, status, created_at')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId);

  /** Same posted scope as get_contact_balances_summary payables (final | received). */
  const purchaseRows = (purchases || []).filter((p: { status?: string }) => {
    const s = String(p.status || '').toLowerCase().trim();
    return s === 'final' || s === 'received';
  });

  const supplierPurchaseIds = new Set(purchaseRows.map((p: { id: string }) => p.id));

  const { data: payments } = await supabase
    .from('payments')
    .select('id, payment_date, amount, reference_number, reference_type, reference_id, contact_id, payment_type, notes, voided_at')
    .eq('company_id', companyId)
    .eq('payment_type', 'paid');

  type Ev = {
    ts: number;
    date: string;
    ord: number;
    debit: number;
    credit: number;
    ref: string;
    desc: string;
    docType: Transaction['documentType'];
    id: string;
  };
  const events: Ev[] = [];

  purchaseRows.forEach((p: any) => {
    const d = effectiveYmdFromDoc({ po_date: p.po_date, created_at: p.created_at });
    if (!d) return;
    const total = Number(p.total) || 0;
    events.push({
      ts: new Date(d + 'T12:00:00').getTime(),
      date: d,
      ord: 0,
      debit: 0,
      credit: total,
      ref: p.po_no || `PUR-${String(p.id).slice(0, 8)}`,
      desc: `Purchase ${p.po_no || ''}`.trim() || 'Purchase',
      docType: 'Purchase',
      id: p.id,
    });
  });

  const { data: purchaseReturnRows } = await supabase
    .from('purchase_returns')
    .select('id, return_no, return_date, total, status, created_at, original_purchase_id')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
    .eq('status', 'final');

  (purchaseReturnRows || []).forEach((r: any) => {
    const d = effectiveYmdFromDoc({ po_date: r.return_date, created_at: r.created_at });
    if (!d) return;
    const amt = Math.abs(Number(r.total) || 0);
    if (amt <= 0) return;
    events.push({
      ts: new Date(d + 'T12:00:00').getTime(),
      date: d,
      ord: 2,
      debit: amt,
      credit: 0,
      ref: r.return_no || `PRET-${String(r.id).slice(0, 8)}`,
      desc: `Purchase Return ${r.return_no || ''}`.trim() || 'Purchase Return',
      docType: 'Purchase Return',
      id: r.id,
    });
  });

  (payments || []).forEach((p: any) => {
    if (p.voided_at) return;
    const rt = String(p.reference_type || '').toLowerCase();
    const isSupplier =
      p.contact_id === supplierId ||
      (rt === 'purchase' && p.reference_id && supplierPurchaseIds.has(p.reference_id));
    if (!isSupplier) return;
    const d = (p.payment_date || '').toString().slice(0, 10);
    if (!d) return;
    const amt = Number(p.amount) || 0;
    events.push({
      ts: new Date(d + 'T12:00:00').getTime(),
      date: d,
      ord: 1,
      debit: amt,
      credit: 0,
      ref: p.reference_number || `PAY-${String(p.id).slice(0, 8)}`,
      desc: (p.notes && String(p.notes).trim()) || 'Supplier payment',
      docType: 'Payment',
      id: p.id,
    });
  });

  events.sort((a, b) => a.ts - b.ts || a.ord - b.ord);

  const fromTs = new Date(fromDate + 'T12:00:00').getTime();
  const toTs = new Date(toDate + 'T23:59:59').getTime();

  let running = openingBase;
  for (const e of events) {
    if (e.ts < fromTs) running = running + e.credit - e.debit;
  }
  const openingAtFrom = running;

  const transactions: Transaction[] = [];
  const invoices: Invoice[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  running = openingAtFrom;
  for (const e of events) {
    if (e.ts < fromTs || e.ts > toTs) continue;
    totalDebit += e.debit;
    totalCredit += e.credit;
    running = running + e.credit - e.debit;
    transactions.push({
      id: e.id,
      date: e.date,
      referenceNo: e.ref,
      documentType: e.docType,
      description: e.desc,
      paymentAccount: '—',
      notes: '',
      debit: e.debit,
      credit: e.credit,
      runningBalance: running,
      linkedInvoices: [],
      linkedPayments: [],
    });
  }

  purchaseRows.forEach((p: any) => {
    const d = effectiveYmdFromDoc({ po_date: p.po_date, created_at: p.created_at });
    if (!d) return;
    const ts = new Date(d + 'T12:00:00').getTime();
    if (ts < fromTs || ts > toTs) return;
    const due = Math.max(0, Number(p.due_amount ?? 0) || (Number(p.total) || 0) - (Number(p.paid_amount) || 0));
    if (due <= 0) return;
    invoices.push({
      invoiceNo: p.po_no || `PUR-${String(p.id).slice(0, 8)}`,
      date: d,
      invoiceTotal: Number(p.total) || due,
      items: [],
      status: 'Unpaid',
      paidAmount: Number(p.paid_amount) || 0,
      pendingAmount: due,
    });
  });

  const closingBalance = running;
  const totalInvoices = invoices.length;
  const totalInvoiceAmount = invoices.reduce((s, i) => s + i.invoiceTotal, 0);
  const totalPaymentReceived = totalDebit;
  const pendingAmount = invoices.reduce((s, i) => s + i.pendingAmount, 0);

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.debug('[SupplierOperationalLedger]', { supplierId, supplierName, openingBase, openingAtFrom, rows: transactions.length });
  }

  return {
    openingBalance: openingAtFrom,
    totalDebit,
    totalCredit,
    closingBalance,
    transactions,
    detailTransactions: transactions.map((t) => ({ ...t })),
    invoices,
    invoicesSummary: {
      totalInvoices,
      totalInvoiceAmount,
      totalPaymentReceived,
      pendingAmount,
      fullyPaid: 0,
      partiallyPaid: 0,
      unpaid: invoices.length,
    },
  };
}

/**
 * User (staff/salesman) operational statement: paid expenses with paid_to_user_id + posted sale commission.
 * Debits increase company obligation to the user; credits would come from dedicated payment flows (not yet linked by user id on payments).
 */
export async function getUserLedgerData(
  companyId: string,
  userId: string,
  userName: string,
  fromDate: string,
  toDate: string
): Promise<LedgerData> {
  const openingBase = 0;

  const { data: expenseRows } = await supabase
    .from('expenses')
    .select('id, expense_date, expense_no, amount, status, description, vendor_name, notes')
    .eq('company_id', companyId)
    .eq('paid_to_user_id', userId);

  const { data: commSales } = await supabase
    .from('sales')
    .select('id, invoice_no, invoice_date, commission_amount, created_at')
    .eq('company_id', companyId)
    .eq('salesman_id', userId)
    .eq('commission_status', 'posted');

  // Rental commission (same pattern as sales)
  let commRentals: any[] = [];
  try {
    const { data: rData } = await supabase
      .from('rentals')
      .select('id, booking_no, booking_date, commission_amount, created_at')
      .eq('company_id', companyId)
      .eq('salesman_id', userId)
      .eq('commission_status', 'posted');
    commRentals = rData || [];
  } catch { /* columns may not exist */ }

  type Ev = {
    ts: number;
    date: string;
    ord: number;
    debit: number;
    credit: number;
    ref: string;
    desc: string;
    docType: Transaction['documentType'];
    id: string;
  };
  const events: Ev[] = [];

  (expenseRows || []).forEach((row: any) => {
    const st = String(row.status || '').toLowerCase();
    if (st !== 'paid') return;
    const amt = Number(row.amount) || 0;
    if (amt <= 0) return;
    const d = (row.expense_date || '').toString().slice(0, 10);
    if (!d) return;
    const ref = row.expense_no || `EXP-${String(row.id).slice(0, 8)}`;
    const desc =
      (row.description && String(row.description).trim()) ||
      (row.vendor_name && String(row.vendor_name).trim()) ||
      row.notes ||
      'Expense (paid to user)';
    events.push({
      ts: new Date(d + 'T12:00:00').getTime(),
      date: d,
      ord: 0,
      debit: amt,
      credit: 0,
      ref,
      desc,
      docType: 'Expense',
      id: row.id,
    });
  });

  // Commission entries: CREDIT = company owes salesman (liability).
  // When salary/expense is paid to user → DEBIT (reduces what we owe).
  // Net balance: positive = company paid more (advance), negative = salesman is owed.
  (commSales || []).forEach((s: any) => {
    const amt = Number(s.commission_amount) || 0;
    if (amt <= 0) return;
    const d = effectiveYmdFromDoc({ invoice_date: s.invoice_date, created_at: s.created_at });
    if (!d) return;
    const ref = s.invoice_no || `SL-${String(s.id).slice(0, 8)}`;
    events.push({
      ts: new Date(d + 'T12:00:00').getTime(),
      date: d,
      ord: 1,
      debit: 0,
      credit: amt,
      ref,
      desc: `Commission earned — ${ref}`,
      docType: 'Expense',
      id: s.id,
    });
  });

  // Rental commission entries (same as sale commission — credit = owed to salesman)
  commRentals.forEach((r: any) => {
    const amt = Number(r.commission_amount) || 0;
    if (amt <= 0) return;
    const d = effectiveYmdFromDoc({ invoice_date: r.booking_date, created_at: r.created_at });
    if (!d) return;
    const ref = r.booking_no || `REN-${String(r.id).slice(0, 8)}`;
    events.push({
      ts: new Date(d + 'T12:00:00').getTime(),
      date: d,
      ord: 1,
      debit: 0,
      credit: amt,
      ref,
      desc: `Commission earned — ${ref}`,
      docType: 'Expense',
      id: r.id,
    });
  });

  events.sort((a, b) => a.ts - b.ts || a.ord - b.ord);

  const fromTs = new Date(fromDate + 'T12:00:00').getTime();
  const toTs = new Date(toDate + 'T23:59:59').getTime();

  let running = openingBase;
  for (const e of events) {
    if (e.ts < fromTs) running = running + e.debit - e.credit;
  }
  const openingAtFrom = running;

  const transactions: Transaction[] = [];
  const invoices: Invoice[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  running = openingAtFrom;
  for (const e of events) {
    if (e.ts < fromTs || e.ts > toTs) continue;
    totalDebit += e.debit;
    totalCredit += e.credit;
    running = running + e.debit - e.credit;
    transactions.push({
      id: e.id,
      date: e.date,
      referenceNo: e.ref,
      documentType: e.docType,
      description: e.desc,
      paymentAccount: '—',
      notes: userName ? `User: ${userName}` : '',
      debit: e.debit,
      credit: e.credit,
      runningBalance: running,
      linkedInvoices: [],
      linkedPayments: [],
    });
    if (e.debit > 0) {
      invoices.push({
        invoiceNo: e.ref,
        date: e.date,
        invoiceTotal: e.debit,
        items: [],
        status: 'Unpaid',
        paidAmount: 0,
        pendingAmount: e.debit,
      });
    }
  }

  const closingBalance = running;
  const totalInvoices = invoices.length;
  const totalInvoiceAmount = invoices.reduce((s, i) => s + i.invoiceTotal, 0);
  const totalPaymentReceived = totalCredit;
  const pendingAmount = invoices.reduce((s, i) => s + i.pendingAmount, 0);

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.debug('[UserOperationalLedger]', { userId, userName, openingAtFrom, rows: transactions.length });
  }

  return {
    openingBalance: openingAtFrom,
    totalDebit,
    totalCredit,
    closingBalance,
    transactions,
    detailTransactions: transactions.map((t) => ({ ...t })),
    invoices,
    invoicesSummary: {
      totalInvoices,
      totalInvoiceAmount,
      totalPaymentReceived,
      pendingAmount,
      fullyPaid: 0,
      partiallyPaid: 0,
      unpaid: invoices.length,
    },
  };
}

/** Parse YYYY-MM-DD as local calendar day bounds (avoids UTC shift dropping rows). */
function localDayBounds(fromYmd: string, toYmd: string): { fromMs: number; toMs: number } {
  const fromMs = new Date(`${fromYmd}T00:00:00`).getTime();
  const toMs = new Date(`${toYmd}T23:59:59.999`).getTime();
  return { fromMs, toMs };
}

function rowTimestampMs(r: {
  status?: string;
  created_at?: string;
  paid_at?: string;
}): number {
  const paid = String(r.status || '').toLowerCase() === 'paid';
  const raw = paid ? (r.paid_at || r.created_at) : (r.created_at || r.paid_at);
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Worker: Production-based. Job complete → payable (Debit), Payment → Credit. Job name + sale ref from stages. */
export async function getWorkerLedgerData(
  companyId: string,
  workerId: string,
  _workerName: string,
  fromDate: string,
  toDate: string
): Promise<LedgerData> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('opening_balance')
    .eq('id', workerId)
    .eq('company_id', companyId)
    .maybeSingle();
  const contactOpeningSeed = Math.max(0, Number((contact as { opening_balance?: number } | null)?.opening_balance) || 0);

  const { data: allEntries, error } = await supabase
    .from('worker_ledger_entries')
    .select('*')
    .eq('company_id', companyId)
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });

  if (error) return emptyLedgerData();

  let allRows = (allEntries || []) as Array<{
    id: string;
    amount: number;
    status?: string;
    created_at?: string;
    paid_at?: string;
    payment_reference?: string;
    reference_id?: string;
    reference_type?: string;
    document_no?: string | null;
  }>;

  // Dedupe only when both reference_type and reference_id are set (avoids collapsing many rows with empty keys).
  const seen = new Set<string>();
  allRows = allRows.filter((r) => {
    const rt = String(r.reference_type ?? '').trim();
    const rid = String(r.reference_id ?? '').trim();
    if (!rt || !rid) return true;
    const key = `${rt.toLowerCase()}\t${rid}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Enrich job rows with stage_type (job name) and production_no / sale ref
  // Only include reference_ids from studio_production_stage entries (salary uses expense_id)
  const stageIds = [...new Set(
    allRows
      .filter((r) => (r.reference_type || '').toLowerCase() === 'studio_production_stage' && r.reference_id)
      .map((r) => r.reference_id!)
  )] as string[];
  const stageMap = new Map<string, { stage_type?: string; production_no?: string; sale_id?: string }>();
  if (stageIds.length > 0) {
    try {
      const { data: stages } = await supabase
        .from('studio_production_stages')
        .select('id, stage_type, production_id')
        .in('id', stageIds);
      if (stages?.length) {
        const prodIds = [...new Set((stages as any[]).map((s) => s.production_id).filter(Boolean))];
        const { data: prods } = await supabase
          .from('studio_productions')
          .select('id, production_no, sale_id')
          .in('id', prodIds);
        const prodMap = new Map<string, { production_no?: string; sale_id?: string }>();
        (prods || []).forEach((p: any) => prodMap.set(p.id, { production_no: p.production_no, sale_id: p.sale_id }));
        (stages as any[]).forEach((s: any) => {
          const prod = s.production_id ? prodMap.get(s.production_id) : undefined;
          stageMap.set(s.id, { stage_type: s.stage_type, production_no: prod?.production_no, sale_id: prod?.sale_id });
        });
      }
    } catch (_) {}
  }

  const { fromMs, toMs } = localDayBounds(fromDate, toDate);

  /** Opening at start of range: contact seed + net worker_ledger activity before fromDate (unpaid = owed, paid = reduced). */
  let openingBalance = contactOpeningSeed;
  allRows.forEach((r) => {
    const t = rowTimestampMs(r);
    if (t === 0 || t >= fromMs) return;
    const amt = Number(r.amount || 0);
    const isPaid = String(r.status || 'unpaid').toLowerCase() === 'paid';
    if (isPaid) openingBalance -= amt;
    else openingBalance += amt;
  });

  const rows = allRows
    .filter((r) => {
      const t = rowTimestampMs(r);
      return t >= fromMs && t <= toMs;
    })
    .sort((a, b) => rowTimestampMs(a) - rowTimestampMs(b));

  const transactions: Transaction[] = [];
  const invoices: Invoice[] = [];
  let runningBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  for (const e of rows) {
    const amt = Number(e.amount || 0);
    const isPaid = String(e.status || 'unpaid').toLowerCase() === 'paid';
    const rawTs = isPaid ? e.paid_at || e.created_at : e.created_at || e.paid_at;
    const date =
      rawTs && String(rawTs).length >= 10
        ? String(rawTs).slice(0, 10)
        : fromDate;

    if (isPaid) {
      totalCredit += amt;
      runningBalance -= amt;
      transactions.push({
        id: e.id,
        date,
        referenceNo: e.payment_reference || `Payment ${e.id.slice(0, 8)}`,
        documentType: 'Payment',
        description: e.payment_reference ? `Worker payment — ${e.payment_reference}` : 'Worker payment',
        paymentAccount: '—',
        notes: e.payment_reference || '',
        debit: 0,
        credit: amt,
        runningBalance,
        linkedInvoices: [],
        linkedPayments: [],
      });
    } else {
      totalDebit += amt;
      runningBalance += amt;
      const stageInfo = e.reference_id ? stageMap.get(e.reference_id) : undefined;
      const jobName = stageInfo?.stage_type || 'Job';
      const billRef = stageInfo?.production_no || stageInfo?.sale_id || (e.reference_id || e.id).toString().slice(0, 8);
      const jobRef = e.document_no || `Job-${billRef}`;
      transactions.push({
        id: e.id,
        date,
        referenceNo: jobRef,
        documentType: 'Job',
        description: `${jobName} – ${stageInfo?.production_no ? `Prod ${stageInfo.production_no}` : 'Completed'}`,
        paymentAccount: '—',
        notes: stageInfo?.production_no || '',
        debit: amt,
        credit: 0,
        runningBalance,
        linkedInvoices: [],
        linkedPayments: [],
      });
      const invoiceJobRef = e.document_no || `Job-${e.id.slice(0, 8)}`;
      invoices.push({
        id: e.id,
        invoiceNo: invoiceJobRef,
        date,
        invoiceTotal: amt,
        items: [],
        status: 'Unpaid',
        paidAmount: 0,
        pendingAmount: amt,
      });
    }
  }

  const closingBalance = runningBalance;
  const totalInvoices = invoices.length;
  const totalInvoiceAmount = invoices.reduce((s, i) => s + i.invoiceTotal, 0);
  const totalPaymentReceived = totalCredit;
  const pendingAmount = invoices.reduce((s, i) => s + i.pendingAmount, 0);

  return {
    openingBalance,
    totalDebit,
    totalCredit,
    closingBalance,
    transactions,
    detailTransactions: transactions.map(t => ({ ...t })),
    invoices,
    invoicesSummary: {
      totalInvoices,
      totalInvoiceAmount,
      totalPaymentReceived,
      pendingAmount,
      fullyPaid: 0,
      partiallyPaid: 0,
      unpaid: invoices.length,
    },
  };
}

function emptyLedgerData(): LedgerData {
  return {
    openingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
    transactions: [],
    detailTransactions: [],
    invoices: [],
    invoicesSummary: {
      totalInvoices: 0,
      totalInvoiceAmount: 0,
      totalPaymentReceived: 0,
      pendingAmount: 0,
      fullyPaid: 0,
      partiallyPaid: 0,
      unpaid: 0,
    },
  };
}
