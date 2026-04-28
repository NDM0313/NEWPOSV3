/**
 * Effective Party Ledger: collapses PF-14 mutation chains into single effective rows.
 * Read-only presentation layer — does NOT modify accounting data.
 */

import { supabase } from '@/lib/supabase';

export interface EffectiveLedgerRow {
  id: string;
  date: string;
  referenceNo: string;
  type: 'sale' | 'purchase' | 'payment' | 'receipt' | 'opening' | 'return' | 'reversal' | 'expense' | 'adjustment' | 'journal';
  typeLabel: string;
  description: string;
  effectiveAmount: number;
  effectiveAccountName: string | null;
  effectiveAccountCode: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
  status: 'active' | 'voided' | 'cancelled';
  paymentId: string | null;
  sourceDocumentId: string | null;
  sourceDocumentType: string | null;
  /** Number of mutations collapsed into this row */
  mutationCount: number;
  /** Full mutation history for expand/details */
  mutations: MutationStep[];
  /** JE references in this chain */
  journalEntryNos: string[];
  isCollapsed: boolean;
}

export interface MutationStep {
  timestamp: string;
  type: string;
  oldAmount?: number;
  newAmount?: number;
  oldAccountName?: string;
  newAccountName?: string;
  journalEntryNo?: string;
  journalEntryId?: string;
}

export interface EffectiveLedgerSummary {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  /** For customer: total sales */
  totalSales: number;
  /** For customer: total received */
  totalReceived: number;
  /** For supplier: total purchases */
  totalPurchases: number;
  /** For supplier: total paid */
  totalPaid: number;
}

export interface EffectiveLedgerResult {
  rows: EffectiveLedgerRow[];
  summary: EffectiveLedgerSummary;
  partyName: string;
  partyType: 'customer' | 'supplier';
}

type RawPaymentRow = {
  id: string;
  reference_number: string;
  amount: number;
  payment_type: string;
  reference_type: string;
  reference_id: string | null;
  payment_account_id: string | null;
  payment_date: string;
  voided_at: string | null;
  contact_id: string;
  created_at: string;
};

type RawMutationRow = {
  id: string;
  entity_id: string;
  mutation_type: string;
  old_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  delta_amount: number | null;
  adjustment_journal_entry_id: string | null;
  created_at: string;
};

export async function loadEffectivePartyLedger(params: {
  companyId: string;
  contactId: string;
  partyType: 'customer' | 'supplier';
  fromDate: string;
  toDate: string;
  branchId?: string | null;
}): Promise<EffectiveLedgerResult> {
  const { companyId, contactId, partyType, fromDate, toDate } = params;

  const { data: contact } = await supabase
    .from('contacts')
    .select('name, type, opening_balance, supplier_opening_balance')
    .eq('id', contactId)
    .eq('company_id', companyId)
    .maybeSingle();

  const partyName = (contact as { name?: string } | null)?.name || 'Unknown';
  const openingBase = partyType === 'supplier'
    ? Number((contact as any)?.supplier_opening_balance ?? (contact as any)?.opening_balance ?? 0)
    : Number((contact as any)?.opening_balance ?? 0);

  const accountMap = await loadAccountMap(companyId);

  const rows: EffectiveLedgerRow[] = [];
  let totalSales = 0, totalReceived = 0, totalPurchases = 0, totalPaid = 0;

  if (partyType === 'customer') {
    const { sales, saleReturns, payments, mutations } = await loadCustomerData(companyId, contactId);
    const inRange = (d: string) => d >= fromDate && d <= toDate;

    for (const s of sales) {
      const d = String(s.invoice_date || s.created_at || '').slice(0, 10);
      if (!inRange(d)) continue;
      const amt = Number(s.total) || 0;
      const status = String(s.status || '').toLowerCase();
      if (status !== 'final' && status !== 'delivered') continue;
      totalSales += amt;
      rows.push({
        id: s.id, date: d, referenceNo: s.invoice_no || `SL-${s.id.slice(0, 8)}`,
        type: 'sale', typeLabel: 'Sale', description: `Invoice ${s.invoice_no || ''}`.trim(),
        effectiveAmount: amt, effectiveAccountName: null, effectiveAccountCode: null,
        debit: amt, credit: 0, runningBalance: 0, status: 'active',
        paymentId: null, sourceDocumentId: s.id, sourceDocumentType: 'sale',
        mutationCount: 0, mutations: [], journalEntryNos: [], isCollapsed: false,
      });
    }

    const paymentRows = buildEffectivePaymentRows(payments, mutations, accountMap, 'receipt');
    for (const pr of paymentRows) {
      const d = pr.date;
      if (!inRange(d)) continue;
      if (pr.status === 'voided') continue;
      totalReceived += pr.effectiveAmount;
      pr.credit = pr.effectiveAmount;
      pr.debit = 0;
      rows.push(pr);
    }

    for (const sr of saleReturns) {
      const st = String(sr.status || '').toLowerCase().trim();
      if (st !== 'final') continue;
      const d = String(sr.return_date || sr.created_at || '').slice(0, 10);
      if (!inRange(d)) continue;
      const amt = Math.abs(Number(sr.total) || 0);
      if (amt <= 0) continue;
      rows.push({
        id: sr.id,
        date: d,
        referenceNo: sr.return_no || `SRET-${sr.id.slice(0, 8)}`,
        type: 'return',
        typeLabel: 'Sale Return',
        description: `Sale Return ${sr.return_no || ''}`.trim(),
        effectiveAmount: amt,
        effectiveAccountName: null,
        effectiveAccountCode: null,
        debit: 0,
        credit: amt,
        runningBalance: 0,
        status: 'active',
        paymentId: null,
        sourceDocumentId: sr.original_sale_id || sr.id,
        sourceDocumentType: 'sale_return',
        mutationCount: 0,
        mutations: [],
        journalEntryNos: [],
        isCollapsed: false,
      });
    }
  } else {
    const { purchases, purchaseReturns, payments, mutations } = await loadSupplierData(companyId, contactId);
    const inRange = (d: string) => d >= fromDate && d <= toDate;

    for (const p of purchases) {
      const d = String(p.po_date || p.created_at || '').slice(0, 10);
      if (!inRange(d)) continue;
      const amt = Number(p.total) || 0;
      const status = String(p.status || '').toLowerCase();
      if (status !== 'final' && status !== 'received') continue;
      totalPurchases += amt;
      rows.push({
        id: p.id, date: d, referenceNo: p.po_no || `PUR-${p.id.slice(0, 8)}`,
        type: 'purchase', typeLabel: 'Purchase', description: `Bill ${p.po_no || ''}`.trim(),
        effectiveAmount: amt, effectiveAccountName: null, effectiveAccountCode: null,
        debit: 0, credit: amt, runningBalance: 0, status: 'active',
        paymentId: null, sourceDocumentId: p.id, sourceDocumentType: 'purchase',
        mutationCount: 0, mutations: [], journalEntryNos: [], isCollapsed: false,
      });
    }

    const paymentRows = buildEffectivePaymentRows(payments, mutations, accountMap, 'payment');
    for (const pr of paymentRows) {
      const d = pr.date;
      if (!inRange(d)) continue;
      if (pr.status === 'voided') continue;
      totalPaid += pr.effectiveAmount;
      pr.debit = pr.effectiveAmount;
      pr.credit = 0;
      rows.push(pr);
    }

    for (const pret of purchaseReturns) {
      const st = String(pret.status || '').toLowerCase().trim();
      if (st !== 'final') continue;
      const d = String(pret.return_date || pret.created_at || '').slice(0, 10);
      if (!inRange(d)) continue;
      const amt = Math.abs(Number(pret.total) || 0);
      if (amt <= 0) continue;
      rows.push({
        id: pret.id,
        date: d,
        referenceNo: pret.return_no || `PRET-${pret.id.slice(0, 8)}`,
        type: 'return',
        typeLabel: 'Purchase Return',
        description: `Purchase Return ${pret.return_no || ''}`.trim(),
        effectiveAmount: amt,
        effectiveAccountName: null,
        effectiveAccountCode: null,
        debit: amt,
        credit: 0,
        runningBalance: 0,
        status: 'active',
        paymentId: null,
        sourceDocumentId: pret.original_purchase_id || pret.id,
        sourceDocumentType: 'purchase_return',
        mutationCount: 0,
        mutations: [],
        journalEntryNos: [],
        isCollapsed: false,
      });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let running = openingBase;
  const preWindowRows = rows.filter(r => r.date < fromDate);
  const inWindowRows = rows.filter(r => r.date >= fromDate);

  for (const r of preWindowRows) {
    running += (partyType === 'supplier') ? (r.credit - r.debit) : (r.debit - r.credit);
  }
  const openingForWindow = running;

  for (const r of inWindowRows) {
    running += (partyType === 'supplier') ? (r.credit - r.debit) : (r.debit - r.credit);
    r.runningBalance = running;
  }

  const totalDebit = inWindowRows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = inWindowRows.reduce((s, r) => s + r.credit, 0);

  const openingRow: EffectiveLedgerRow = {
    id: 'opening-balance', date: fromDate, referenceNo: 'Opening Balance',
    type: 'opening', typeLabel: 'Opening Balance', description: 'Opening Balance',
    effectiveAmount: Math.abs(openingForWindow), effectiveAccountName: null, effectiveAccountCode: null,
    debit: partyType === 'customer' ? Math.max(0, openingForWindow) : (openingForWindow < 0 ? Math.abs(openingForWindow) : 0),
    credit: partyType === 'customer' ? (openingForWindow < 0 ? Math.abs(openingForWindow) : 0) : Math.max(0, openingForWindow),
    runningBalance: openingForWindow, status: 'active',
    paymentId: null, sourceDocumentId: null, sourceDocumentType: null,
    mutationCount: 0, mutations: [], journalEntryNos: [], isCollapsed: false,
  };

  return {
    rows: [openingRow, ...inWindowRows],
    summary: {
      openingBalance: openingForWindow, totalDebit, totalCredit,
      closingBalance: running, totalSales, totalReceived, totalPurchases, totalPaid,
    },
    partyName, partyType,
  };
}

function buildEffectivePaymentRows(
  payments: RawPaymentRow[],
  mutations: RawMutationRow[],
  accountMap: Map<string, { code: string; name: string }>,
  kind: 'receipt' | 'payment',
): EffectiveLedgerRow[] {
  const mutsByPayment = new Map<string, RawMutationRow[]>();
  for (const m of mutations) {
    const pid = m.entity_id;
    if (!mutsByPayment.has(pid)) mutsByPayment.set(pid, []);
    mutsByPayment.get(pid)!.push(m);
  }

  const rows: EffectiveLedgerRow[] = [];
  for (const p of payments) {
    const acct = accountMap.get(p.payment_account_id || '');
    const muts = mutsByPayment.get(p.id) || [];
    muts.sort((a, b) => a.created_at.localeCompare(b.created_at));

    const mutationSteps: MutationStep[] = muts.map(m => {
      const step: MutationStep = { timestamp: m.created_at, type: m.mutation_type };
      if (m.mutation_type === 'amount_edit') {
        step.oldAmount = Number((m.old_state as any)?.amount ?? 0);
        step.newAmount = Number((m.new_state as any)?.amount ?? 0);
      }
      if (m.mutation_type === 'account_change') {
        const oldAcctId = String((m.old_state as any)?.payment_account_id || '');
        const newAcctId = String((m.new_state as any)?.payment_account_id || '');
        step.oldAccountName = accountMap.get(oldAcctId)?.name || oldAcctId.slice(0, 8);
        step.newAccountName = accountMap.get(newAcctId)?.name || newAcctId.slice(0, 8);
      }
      if (m.adjustment_journal_entry_id) {
        step.journalEntryId = m.adjustment_journal_entry_id;
      }
      return step;
    });

    const jeNos: string[] = [];
    const isVoided = !!p.voided_at;
    const rt = String(p.reference_type || '').toLowerCase();
    let typeLabel = kind === 'receipt' ? 'Receipt' : 'Payment';
    if (rt === 'manual_receipt' || rt === 'on_account') typeLabel = 'Manual Receipt';
    if (rt === 'manual_payment') typeLabel = 'Manual Payment';

    rows.push({
      id: p.id,
      date: String(p.payment_date || p.created_at || '').slice(0, 10),
      referenceNo: p.reference_number || `PAY-${p.id.slice(0, 8)}`,
      type: kind,
      typeLabel,
      description: `${typeLabel} – ${p.reference_number || ''}`.trim(),
      effectiveAmount: Number(p.amount) || 0,
      effectiveAccountName: acct?.name || null,
      effectiveAccountCode: acct?.code || null,
      debit: 0, credit: 0, runningBalance: 0,
      status: isVoided ? 'voided' : 'active',
      paymentId: p.id,
      sourceDocumentId: p.reference_id || null,
      sourceDocumentType: rt === 'sale' ? 'sale' : rt === 'purchase' ? 'purchase' : null,
      mutationCount: muts.length,
      mutations: mutationSteps,
      journalEntryNos: jeNos,
      isCollapsed: muts.length > 0,
    });
  }
  return rows;
}

async function loadCustomerData(companyId: string, contactId: string) {
  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no, invoice_date, total, status, customer_id, created_at')
    .eq('company_id', companyId)
    .eq('customer_id', contactId);

  const { data: saleReturns } = await supabase
    .from('sale_returns')
    .select('id, return_no, return_date, total, status, customer_id, original_sale_id, created_at')
    .eq('company_id', companyId)
    .eq('customer_id', contactId);

  const { data: payments } = await supabase
    .from('payments')
    .select('id, reference_number, amount, payment_type, reference_type, reference_id, payment_account_id, payment_date, voided_at, contact_id, created_at')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .eq('payment_type', 'received')
    .in('reference_type', ['sale', 'manual_receipt', 'on_account']);

  const paymentIds = (payments || []).map((p: any) => p.id);
  let mutations: RawMutationRow[] = [];
  if (paymentIds.length > 0) {
    const { data: muts } = await supabase
      .from('transaction_mutations')
      .select('id, entity_id, mutation_type, old_state, new_state, delta_amount, adjustment_journal_entry_id, created_at')
      .eq('company_id', companyId)
      .eq('entity_type', 'payment')
      .in('entity_id', paymentIds);
    mutations = (muts || []) as RawMutationRow[];
  }

  return {
    sales: (sales || []) as { id: string; invoice_no: string; invoice_date: string; total: number; status: string; customer_id: string; created_at: string }[],
    saleReturns: (saleReturns || []) as {
      id: string;
      return_no: string;
      return_date: string;
      total: number;
      status: string;
      customer_id: string;
      original_sale_id: string | null;
      created_at: string;
    }[],
    payments: (payments || []) as RawPaymentRow[],
    mutations,
  };
}

async function loadSupplierData(companyId: string, contactId: string) {
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, po_no, po_date, total, paid_amount, due_amount, status, supplier_id, created_at')
    .eq('company_id', companyId)
    .eq('supplier_id', contactId);

  const { data: purchaseReturns } = await supabase
    .from('purchase_returns')
    .select('id, return_no, return_date, total, status, supplier_id, original_purchase_id, created_at')
    .eq('company_id', companyId)
    .eq('supplier_id', contactId);

  const { data: payments } = await supabase
    .from('payments')
    .select('id, reference_number, amount, payment_type, reference_type, reference_id, payment_account_id, payment_date, voided_at, contact_id, created_at')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .eq('payment_type', 'paid')
    .in('reference_type', ['purchase', 'manual_payment']);

  const paymentIds = (payments || []).map((p: any) => p.id);
  let mutations: RawMutationRow[] = [];
  if (paymentIds.length > 0) {
    const { data: muts } = await supabase
      .from('transaction_mutations')
      .select('id, entity_id, mutation_type, old_state, new_state, delta_amount, adjustment_journal_entry_id, created_at')
      .eq('company_id', companyId)
      .eq('entity_type', 'payment')
      .in('entity_id', paymentIds);
    mutations = (muts || []) as RawMutationRow[];
  }

  return {
    purchases: (purchases || []) as { id: string; po_no: string; po_date: string; total: number; paid_amount: number; due_amount: number; status: string; supplier_id: string; created_at: string }[],
    purchaseReturns: (purchaseReturns || []) as {
      id: string;
      return_no: string;
      return_date: string;
      total: number;
      status: string;
      supplier_id: string;
      original_purchase_id: string | null;
      created_at: string;
    }[],
    payments: (payments || []) as RawPaymentRow[],
    mutations,
  };
}

async function loadAccountMap(companyId: string): Promise<Map<string, { code: string; name: string }>> {
  const { data } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId);
  const map = new Map<string, { code: string; name: string }>();
  for (const a of (data || []) as { id: string; code: string; name: string }[]) {
    map.set(a.id, { code: a.code, name: a.name });
  }
  return map;
}
