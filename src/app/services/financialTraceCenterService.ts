/**
 * Financial Trace Center — read-only diagnostic aggregation.
 * No mutations, no apply RPCs, no GL/payment/journal writes.
 */

import { supabase } from '@/lib/supabase';
import { accountingService } from '@/app/services/accountingService';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import { getLedgerStatementV2 } from '@/app/services/ledgerStatementCenterV2Service';
import {
  fetchIntegrityLabSummary,
  fetchManualAdjustments,
  fetchUnmappedJournalLines,
  fetchUnpostedDocuments,
  safeBranchForFilter,
  type IntegrityLabSummary,
  type UnmappedJournalRow,
  type UnpostedDocumentRow,
} from '@/app/services/arApReconciliationCenterService';
import {
  batchFetchUnpostedDocumentStatuses,
  loadUnmappedTrace,
  type PaymentTraceRow,
} from '@/app/services/arApReconciliationTraceService';
import { classifyControlTieOut } from '@/app/lib/financialTraceClassification';

export interface FinancialTraceOverview {
  asOfDate: string;
  summary: IntegrityLabSummary;
  control1100Net: number | null;
  arCusSubledgerSum: number | null;
  operationalSalesDueSum: number | null;
  warnings: string[];
  divergenceCodes: string[];
}

export interface PartySearchHit {
  kind: 'contact' | 'account' | 'sale' | 'rental' | 'payment' | 'journal';
  id: string;
  label: string;
  sublabel: string | null;
  contactId: string | null;
}

export interface PartyTraceResult {
  contact: { id: string; name: string; type: string | null };
  arAccount: { id: string; code: string | null; name: string | null } | null;
  accountLedgerClosing: number | null;
  customerStatementClosing: number | null;
  ledgerV2Closing: number | null;
  payments: PaymentTraceRow[];
  journalEntryNos: string[];
}

export interface RentalPaymentRow {
  id: string;
  reference: string | null;
  payment_date: string | null;
  amount: number;
  voided_at: string | null;
  journal_entry_id: string | null;
  entry_no: string | null;
  je_ref_type: string | null;
  je_void: boolean | null;
  cash_account_code: string | null;
}

export interface RentalTraceResult {
  rental: Record<string, unknown> | null;
  rentalPayments: RentalPaymentRow[];
  paymentsTableRows: PaymentTraceRow[];
  arSubledgerNet: number | null;
  arAccountCode: string | null;
  contactName: string | null;
}

export async function fetchFinancialTraceOverview(
  companyId: string,
  branchId?: string | null,
  asOfDate?: string
): Promise<FinancialTraceOverview | null> {
  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const summary = await fetchIntegrityLabSummary(companyId, branchId ?? null, end);
  if (!summary) return null;

  const [control1100Net, arCusSubledgerSum, operationalSalesDueSum] = await Promise.all([
    fetchControl1100Net(companyId, end, branchId ?? undefined),
    fetchArCusSubledgerSum(companyId, end, branchId ?? undefined),
    fetchOperationalSalesDueSum(companyId),
  ]);

  const { codes, warnings } = classifyControlTieOut({
    control1100Net,
    arCusSubledgerSum,
    glArNet: summary.gl_ar_net_dr_minus_cr,
    operationalDue: operationalSalesDueSum,
  });

  return {
    asOfDate: end,
    summary,
    control1100Net,
    arCusSubledgerSum,
    operationalSalesDueSum,
    warnings,
    divergenceCodes: codes,
  };
}

export async function fetchControl1100Net(
  companyId: string,
  asOfDate: string,
  branchId?: string
): Promise<number | null> {
  const snap = await accountingReportsService.getArApGlSnapshot(companyId, asOfDate, branchId);
  return snap.ar?.balance ?? null;
}

export async function fetchArCusSubledgerSum(
  companyId: string,
  asOfDate: string,
  branchId?: string
): Promise<number | null> {
  const tb = await accountingReportsService.getTrialBalance(companyId, '1900-01-01', asOfDate, branchId);
  const rows = tb.rows.filter((r) => (r.account_code || '').trim().startsWith('AR-CUS'));
  if (rows.length === 0) return 0;
  return rows.reduce((s, r) => s + (r.balance || 0), 0);
}

export async function fetchOperationalSalesDueSum(companyId: string): Promise<number> {
  const { data, error } = await supabase
    .from('sales')
    .select('due_amount, status')
    .eq('company_id', companyId);
  if (error || !data) return 0;
  return data
    .filter((s) => {
      const st = String(s.status ?? '').toLowerCase();
      return st !== 'cancelled' && st !== 'void';
    })
    .reduce((sum, s) => sum + (Number(s.due_amount) || 0), 0);
}

export async function fetchTraceQueues(
  companyId: string,
  branchId?: string | null,
  asOfDate?: string
): Promise<{
  unposted: UnpostedDocumentRow[];
  unmapped: UnmappedJournalRow[];
  manualCount: number;
  unpostedStatuses: Map<string, string | null>;
}> {
  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const [unposted, unmapped, manual] = await Promise.all([
    fetchUnpostedDocuments(companyId, branchId ?? null, end, 500),
    fetchUnmappedJournalLines(companyId, branchId ?? null, end, 500),
    fetchManualAdjustments(companyId, branchId ?? null, end, 500),
  ]);
  const unpostedStatuses = await batchFetchUnpostedDocumentStatuses(unposted);
  return { unposted, unmapped, manualCount: manual.length, unpostedStatuses };
}

export async function searchFinancialTrace(
  companyId: string,
  query: string,
  limit = 25
): Promise<PartySearchHit[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];
  const hits: PartySearchHit[] = [];
  const ilike = `%${q}%`;

  const [contacts, accounts, sales, rentals, payments, journals] = await Promise.all([
    supabase.from('contacts').select('id, name, type').eq('company_id', companyId).ilike('name', ilike).limit(8),
    supabase.from('accounts').select('id, code, name, linked_contact_id').eq('company_id', companyId).or(`code.ilike.${ilike},name.ilike.${ilike}`).limit(8),
    supabase.from('sales').select('id, invoice_no, customer_id, customer_name').eq('company_id', companyId).ilike('invoice_no', ilike).limit(6),
    supabase.from('rentals').select('id, booking_no, customer_id, customer_name').eq('company_id', companyId).ilike('booking_no', ilike).limit(6),
    supabase.from('payments').select('id, reference_number, contact_id, contact_name').eq('company_id', companyId).ilike('reference_number', ilike).limit(6),
    supabase.from('journal_entries').select('id, entry_no, reference_type').eq('company_id', companyId).ilike('entry_no', ilike).limit(6),
  ]);

  for (const c of contacts.data || []) {
    hits.push({
      kind: 'contact',
      id: c.id,
      label: c.name,
      sublabel: c.type,
      contactId: c.id,
    });
  }
  for (const a of accounts.data || []) {
    hits.push({
      kind: 'account',
      id: a.id,
      label: `${a.code ?? ''} ${a.name ?? ''}`.trim(),
      sublabel: 'Account',
      contactId: a.linked_contact_id,
    });
  }
  for (const s of sales.data || []) {
    hits.push({
      kind: 'sale',
      id: s.id,
      label: s.invoice_no || s.id,
      sublabel: s.customer_name,
      contactId: s.customer_id,
    });
  }
  for (const r of rentals.data || []) {
    hits.push({
      kind: 'rental',
      id: r.id,
      label: r.booking_no || r.id,
      sublabel: r.customer_name,
      contactId: r.customer_id,
    });
  }
  for (const p of payments.data || []) {
    hits.push({
      kind: 'payment',
      id: p.id,
      label: p.reference_number || p.id,
      sublabel: p.contact_name,
      contactId: p.contact_id,
    });
  }
  for (const j of journals.data || []) {
    hits.push({
      kind: 'journal',
      id: j.id,
      label: j.entry_no || j.id,
      sublabel: j.reference_type,
      contactId: null,
    });
  }

  return hits.slice(0, limit);
}

export async function fetchPartyTrace(
  companyId: string,
  contactId: string,
  asOfDate?: string
): Promise<PartyTraceResult | null> {
  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, type')
    .eq('id', contactId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!contact) return null;

  const { data: arAcc } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('linked_contact_id', contactId)
    .maybeSingle();

  let accountLedgerClosing: number | null = null;
  let customerStatementClosing: number | null = null;
  let ledgerV2Closing: number | null = null;

  if (arAcc?.id) {
    const ledger = await accountingService.getAccountLedger(arAcc.id, companyId, '1900-01-01', end);
    const last = ledger.length > 0 ? ledger[ledger.length - 1] : null;
    accountLedgerClosing = last?.balance != null ? Number(last.balance) : null;
  }

  try {
    const custLedger = await accountingService.getCustomerLedger(
      contactId,
      companyId,
      undefined,
      '1900-01-01',
      end,
      undefined,
      'gl_journal_only'
    );
    const last = custLedger.length > 0 ? custLedger[custLedger.length - 1] : null;
    customerStatementClosing = last?.balance != null ? Number(last.balance) : null;
  } catch {
    customerStatementClosing = null;
  }

  try {
    const stType =
      contact.type === 'supplier' ? 'supplier' : contact.type === 'worker' ? 'worker' : 'customer';
    const v2 = await getLedgerStatementV2(
      companyId,
      {
        statementType: stType,
        entityId: contactId,
        fromDate: '1900-01-01',
        toDate: end,
        transactionType: 'all',
        search: '',
      },
      contact.name
    );
    ledgerV2Closing = v2.summary.closingBalance ?? null;
  } catch {
    ledgerV2Closing = null;
  }

  const { data: payRows } = await supabase
    .from('payments')
    .select('id, reference_number, payment_date, amount, reference_type, contact_id, contact_name, voided_at')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .order('payment_date', { ascending: false })
    .limit(50);

  const payments: PaymentTraceRow[] = (payRows || []).map((p) => ({
    id: p.id,
    reference_number: p.reference_number,
    payment_date: p.payment_date,
    amount: Number(p.amount) || 0,
    reference_type: p.reference_type,
    contact_id: p.contact_id,
    contact_name: p.contact_name,
    voided_at: p.voided_at,
  }));

  const { data: jeRows } = await supabase
    .from('journal_entry_lines')
    .select('journal_entries(entry_no)')
    .eq('account_id', arAcc?.id ?? '')
    .limit(100);

  const journalEntryNos = [
    ...new Set(
      (jeRows || [])
        .map((r) => {
          const je = r.journal_entries as { entry_no?: string } | null;
          return je?.entry_no ?? null;
        })
        .filter(Boolean) as string[]
    ),
  ];

  return {
    contact: { id: contact.id, name: contact.name, type: contact.type },
    arAccount: arAcc ? { id: arAcc.id, code: arAcc.code, name: arAcc.name } : null,
    accountLedgerClosing,
    customerStatementClosing,
    ledgerV2Closing,
    payments,
    journalEntryNos,
  };
}

export async function fetchRentalTrace(
  companyId: string,
  bookingNo: string
): Promise<RentalTraceResult | null> {
  const bn = bookingNo.trim().toUpperCase();
  const { data: rental } = await supabase
    .from('rentals')
    .select('*')
    .eq('company_id', companyId)
    .ilike('booking_no', bn)
    .maybeSingle();
  if (!rental) return null;

  const { data: rpRows } = await supabase
    .from('rental_payments')
    .select('id, reference, payment_date, amount, voided_at, journal_entry_id, payment_account_id')
    .eq('rental_id', rental.id)
    .order('payment_date', { ascending: true });

  const jeIds = [...new Set((rpRows || []).map((r) => r.journal_entry_id).filter(Boolean))] as string[];
  const accIds = [...new Set((rpRows || []).map((r) => r.payment_account_id).filter(Boolean))] as string[];

  const [jeMap, accMap] = await Promise.all([
    (async () => {
      if (jeIds.length === 0) return new Map<string, { entry_no?: string; reference_type?: string; is_void?: boolean }>();
      const { data } = await supabase.from('journal_entries').select('id, entry_no, reference_type, is_void').in('id', jeIds);
      return new Map((data || []).map((j) => [j.id, j]));
    })(),
    (async () => {
      if (accIds.length === 0) return new Map<string, { code?: string }>();
      const { data } = await supabase.from('accounts').select('id, code').in('id', accIds);
      return new Map((data || []).map((a) => [a.id, a]));
    })(),
  ]);

  const rentalPayments: RentalPaymentRow[] = (rpRows || []).map((rp) => {
    const je = rp.journal_entry_id ? jeMap.get(rp.journal_entry_id) : null;
    const acc = rp.payment_account_id ? accMap.get(rp.payment_account_id) : null;
    return {
      id: rp.id,
      reference: rp.reference,
      payment_date: rp.payment_date,
      amount: Number(rp.amount) || 0,
      voided_at: rp.voided_at,
      journal_entry_id: rp.journal_entry_id,
      entry_no: je?.entry_no ?? null,
      je_ref_type: je?.reference_type ?? null,
      je_void: je?.is_void ?? null,
      cash_account_code: acc?.code ?? null,
    };
  });

  const refs = rentalPayments.map((r) => r.reference).filter(Boolean) as string[];
  let paymentsTableRows: PaymentTraceRow[] = [];
  if (refs.length > 0) {
    const { data: pRows } = await supabase
      .from('payments')
      .select('id, reference_number, payment_date, amount, reference_type, contact_id, contact_name, voided_at')
      .eq('company_id', companyId)
      .in('reference_number', refs);
    paymentsTableRows = (pRows || []).map((p) => ({
      id: p.id,
      reference_number: p.reference_number,
      payment_date: p.payment_date,
      amount: Number(p.amount) || 0,
      reference_type: p.reference_type,
      contact_id: p.contact_id,
      contact_name: p.contact_name,
      voided_at: p.voided_at,
    }));
  }

  let arSubledgerNet: number | null = null;
  let arAccountCode: string | null = null;
  const customerId = rental.customer_id as string | null;
  if (customerId) {
    const { data: arAcc } = await supabase
      .from('accounts')
      .select('id, code')
      .eq('company_id', companyId)
      .eq('linked_contact_id', customerId)
      .maybeSingle();
    if (arAcc?.id) {
      arAccountCode = arAcc.code;
      const lines = await accountingService.getAccountLedger(arAcc.id, companyId);
      const last = lines.length > 0 ? lines[lines.length - 1] : null;
      arSubledgerNet = last?.balance != null ? Number(last.balance) : null;
    }
  }

  return {
    rental,
    rentalPayments,
    paymentsTableRows,
    arSubledgerNet,
    arAccountCode,
    contactName: (rental.customer_name as string) ?? null,
  };
}

export async function enrichUnmappedWithPayment(
  companyId: string,
  rows: UnmappedJournalRow[]
): Promise<Map<string, { reference_type?: string | null; contact_id?: string | null; reference_number?: string | null; linked_contact_id?: string | null }>> {
  const map = new Map<
    string,
    { reference_type?: string | null; contact_id?: string | null; reference_number?: string | null; linked_contact_id?: string | null }
  >();
  for (const row of rows.slice(0, 100)) {
    const bundle = await loadUnmappedTrace(row);
    map.set(row.journal_line_id, {
      reference_type: bundle.payment?.reference_type,
      contact_id: bundle.payment?.contact_id,
      reference_number: bundle.payment?.reference_number,
      linked_contact_id: bundle.lineAccount?.linked_contact_id,
    });
  }
  return map;
}

export { safeBranchForFilter };
