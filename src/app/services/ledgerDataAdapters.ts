/**
 * Build LedgerData (same shape as Customer Ledger) for Supplier, User, and Worker.
 * Customer ledger stays on customerLedgerApi. Supplier/User use ledger_master + ledger_entries; Worker uses worker_ledger_entries.
 */

import { supabase } from '@/lib/supabase';
import type { LedgerData, Transaction, Invoice } from '@/app/services/customerLedgerTypes';
import { getOrCreateLedger, getLedgerEntries, type LedgerEntryRow } from '@/app/services/ledgerService';

export type LedgerEntityType = 'supplier' | 'user' | 'worker';

/** Supplier: Purchase = Credit (we owe), Payment = Debit. Balance = amount to pay. */
export async function getSupplierLedgerData(
  companyId: string,
  supplierId: string,
  supplierName: string,
  fromDate: string,
  toDate: string
): Promise<LedgerData> {
  const ledger = await getOrCreateLedger(companyId, 'supplier', supplierId, supplierName);
  if (!ledger) return emptyLedgerData();

  const entries = await getLedgerEntries(ledger.id, fromDate, toDate);
  const openingBalance = Number(ledger.opening_balance ?? 0);

  // Entries before fromDate for opening
  const { data: prevEntries } = await supabase
    .from('ledger_entries')
    .select('debit, credit, balance_after')
    .eq('ledger_id', ledger.id)
    .lt('entry_date', fromDate)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  let runningBalance = openingBalance;
  if (prevEntries && (prevEntries as { balance_after?: number }).balance_after != null) {
    runningBalance = Number((prevEntries as { balance_after: number }).balance_after);
  }

  const transactions: Transaction[] = [];
  const invoices: Invoice[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const e of entries as LedgerEntryRow[]) {
    const debit = Number(e.debit ?? 0);
    const credit = Number(e.credit ?? 0);
    totalDebit += debit;
    totalCredit += credit;
    runningBalance = runningBalance + debit - credit;

    const docType = e.source === 'purchase' ? 'Purchase' : 'Payment';
    transactions.push({
      id: e.reference_id || e.id,
      date: e.entry_date,
      referenceNo: e.reference_no || e.source,
      documentType: docType as Transaction['documentType'],
      description: e.remarks || `${e.source} ${e.reference_no || ''}`.trim(),
      paymentAccount: '—',
      notes: e.remarks || '',
      debit,
      credit,
      runningBalance,
      linkedInvoices: [],
      linkedPayments: [],
    });

    if (e.source === 'purchase' && credit > 0) {
      const paid = 0;
      invoices.push({
        invoiceNo: e.reference_no || e.id,
        date: e.entry_date,
        invoiceTotal: credit,
        items: [],
        status: 'Unpaid',
        paidAmount: paid,
        pendingAmount: credit,
      });
    }
  }

  const closingBalance = runningBalance;
  const totalInvoices = invoices.length;
  const totalInvoiceAmount = invoices.reduce((s, i) => s + i.invoiceTotal, 0);
  const totalPaymentReceived = totalDebit;
  const pendingAmount = invoices.reduce((s, i) => s + i.pendingAmount, 0);
  const fullyPaid = 0;
  const partiallyPaid = 0;
  const unpaid = invoices.length;

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
      fullyPaid,
      partiallyPaid,
      unpaid,
    },
  };
}

/** User: Staff/Salesman/Admin only. Salary/Expense/Commission/Bonus = Debit, Payment = Credit. No sales, no purchases. */
export async function getUserLedgerData(
  companyId: string,
  userId: string,
  userName: string,
  fromDate: string,
  toDate: string
): Promise<LedgerData> {
  const ledger = await getOrCreateLedger(companyId, 'user', userId, userName);
  if (!ledger) return emptyLedgerData();

  const entries = await getLedgerEntries(ledger.id, fromDate, toDate);
  // Only expense and payment – no sales, no purchases, no grouping
  const allowedSources = ['expense', 'payment', 'salary', 'commission', 'bonus'];
  const filteredEntries = (entries as LedgerEntryRow[]).filter((e) =>
    allowedSources.includes((e.source || '').toLowerCase())
  );

  const openingBalance = Number(ledger.opening_balance ?? 0);

  const { data: prevEntries } = await supabase
    .from('ledger_entries')
    .select('balance_after')
    .eq('ledger_id', ledger.id)
    .lt('entry_date', fromDate)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  let runningBalance = openingBalance;
  if (prevEntries && (prevEntries as { balance_after?: number }).balance_after != null) {
    runningBalance = Number((prevEntries as { balance_after: number }).balance_after);
  }

  const transactions: Transaction[] = [];
  const invoices: Invoice[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const e of filteredEntries) {
    const debit = Number(e.debit ?? 0);
    const credit = Number(e.credit ?? 0);
    totalDebit += debit;
    totalCredit += credit;
    runningBalance = runningBalance + debit - credit;

    const docType = (e.source || '').toLowerCase() === 'payment' ? 'Payment' : 'Expense';
    transactions.push({
      id: e.reference_id || e.id,
      date: e.entry_date,
      referenceNo: e.reference_no || e.source,
      documentType: docType as Transaction['documentType'],
      description: e.remarks || `${e.source} ${e.reference_no || ''}`.trim(),
      paymentAccount: '—',
      notes: e.remarks || '',
      debit,
      credit,
      runningBalance,
      linkedInvoices: [],
      linkedPayments: [],
    });

    // Expenses (salary/commission/bonus) show as "invoices" for Aging tab
    const isExpense = !(e.source || '').toLowerCase().includes('payment') && debit > 0;
    if (isExpense) {
      invoices.push({
        invoiceNo: e.reference_no || e.id,
        date: e.entry_date,
        invoiceTotal: debit,
        items: [],
        status: 'Unpaid',
        paidAmount: 0,
        pendingAmount: debit,
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

/** Worker: Production-based. Job complete → payable (Debit), Payment → Credit. Job name + sale ref from stages. */
export async function getWorkerLedgerData(
  companyId: string,
  workerId: string,
  _workerName: string,
  fromDate: string,
  toDate: string
): Promise<LedgerData> {
  const { data: allEntries, error } = await supabase
    .from('worker_ledger_entries')
    .select('*')
    .eq('company_id', companyId)
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });

  if (error) return emptyLedgerData();

  const allRows = (allEntries || []) as Array<{
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

  // Enrich job rows with stage_type (job name) and production_no / sale ref
  const stageIds = [...new Set(allRows.map((r) => r.reference_id).filter(Boolean))] as string[];
  const stageMap = new Map<string, { stage_type?: string; production_no?: string; sale_id?: string }>();
  if (stageIds.length > 0) {
    try {
      const { data: stages } = await supabase
        .from('studio_production_stages')
        .select('id, stage_type, production_no, sale_id')
        .in('id', stageIds);
      (stages || []).forEach((s: any) => stageMap.set(s.id, { stage_type: s.stage_type, production_no: s.production_no, sale_id: s.sale_id }));
    } catch (_) {}
  }

  const fromTs = new Date(fromDate).getTime();
  const toTs = new Date(toDate + 'T23:59:59').getTime();
  const getRowDate = (r: { created_at?: string; paid_at?: string }) => {
    const t = r.created_at || r.paid_at || '';
    return t ? new Date(t).getTime() : 0;
  };

  let openingBalance = 0;
  allRows.forEach((r) => {
    const t = getRowDate(r);
    if (t < fromTs) {
      const amt = Number(r.amount || 0);
      if ((r.status || 'unpaid').toLowerCase() !== 'paid') openingBalance += amt;
    }
  });

  const rows = allRows.filter((r) => {
    const t = getRowDate(r);
    return t >= fromTs && t <= toTs;
  });

  const transactions: Transaction[] = [];
  const invoices: Invoice[] = [];
  let runningBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  for (const e of rows) {
    const amt = Number(e.amount || 0);
    const date = (e.created_at || '').split('T')[0];
    const isPaid = (e.status || 'unpaid').toLowerCase() === 'paid';

    if (isPaid) {
      totalCredit += amt;
      runningBalance -= amt;
      transactions.push({
        id: e.id,
        date,
        referenceNo: e.payment_reference || `Payment ${e.id.slice(0, 8)}`,
        documentType: 'Payment',
        description: `Worker payment`,
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
      invoices.push({
        invoiceNo: e.document_no || `Job-${e.id.slice(0, 8)}`,
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
