/**
 * AR/AP Reconciliation Center — read-only trace loads (no mutations).
 */

import { supabase } from '@/lib/supabase';
import type { UnmappedJournalRow, UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';
import {
  fetchJournalDetailForLab,
  type JournalDetailForLab,
} from '@/app/services/arApRepairWorkflowService';

export interface DocumentEnrichment {
  status: string | null;
  total: number | null;
  paid_amount: number | null;
  due_amount: number | null;
  branch_name: string | null;
  attachments: unknown[] | null;
}

export interface PaymentTraceRow {
  id: string;
  reference_number: string | null;
  payment_date: string | null;
  amount: number;
  reference_type: string | null;
  contact_id: string | null;
  contact_name: string | null;
  voided_at: string | null;
}

export interface AccountLineMeta {
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  linked_contact_id: string | null;
  linked_contact_name: string | null;
}

export interface UnpostedTraceBundle {
  row: UnpostedDocumentRow;
  enrichment: DocumentEnrichment | null;
  linkedJournals: Array<{ id: string; entry_no: string | null; is_void: boolean | null }>;
}

export interface UnmappedTraceBundle {
  row: UnmappedJournalRow;
  journal: JournalDetailForLab | null;
  payment: PaymentTraceRow | null;
  lineAccount: AccountLineMeta | null;
}

export async function enrichUnpostedDocument(row: UnpostedDocumentRow): Promise<DocumentEnrichment | null> {
  if (row.source_type === 'sale') {
    const { data } = await supabase
      .from('sales')
      .select('status, total, paid_amount, due_amount, attachments, branch_id, branches(name)')
      .eq('id', row.source_id)
      .maybeSingle();
    if (!data) return null;
    const b = (data as { branches?: { name?: string } }).branches;
    return {
      status: (data as { status?: string }).status ?? null,
      total: Number((data as { total?: number }).total) || null,
      paid_amount: Number((data as { paid_amount?: number }).paid_amount) || null,
      due_amount: Number((data as { due_amount?: number }).due_amount) || null,
      branch_name: b?.name ?? null,
      attachments: (data as { attachments?: unknown[] }).attachments ?? null,
    };
  }
  if (row.source_type === 'purchase') {
    const { data } = await supabase
      .from('purchases')
      .select('status, total, paid_amount, due_amount, branch_id, branches(name)')
      .eq('id', row.source_id)
      .maybeSingle();
    if (!data) return null;
    const b = (data as { branches?: { name?: string } }).branches;
    return {
      status: (data as { status?: string }).status ?? null,
      total: Number((data as { total?: number }).total) || null,
      paid_amount: Number((data as { paid_amount?: number }).paid_amount) || null,
      due_amount: Number((data as { due_amount?: number }).due_amount) || null,
      branch_name: b?.name ?? null,
      attachments: null,
    };
  }
  return null;
}

export async function fetchLinkedSalePurchaseJournals(
  row: UnpostedDocumentRow
): Promise<Array<{ id: string; entry_no: string | null; is_void: boolean | null }>> {
  const refType = row.source_type === 'purchase' ? 'purchase' : 'sale';
  const { data } = await supabase
    .from('journal_entries')
    .select('id, entry_no, is_void')
    .eq('reference_id', row.source_id)
    .eq('reference_type', refType);
  return (data || []) as Array<{ id: string; entry_no: string | null; is_void: boolean | null }>;
}

export async function loadUnpostedTrace(row: UnpostedDocumentRow): Promise<UnpostedTraceBundle> {
  const [enrichment, linkedJournals] = await Promise.all([
    enrichUnpostedDocument(row),
    fetchLinkedSalePurchaseJournals(row),
  ]);
  return { row, enrichment, linkedJournals };
}

export async function loadPaymentForJournal(journalEntryId: string): Promise<PaymentTraceRow | null> {
  const { data: je } = await supabase
    .from('journal_entries')
    .select('id, payment_id, reference_type, reference_id')
    .eq('id', journalEntryId)
    .maybeSingle();
  if (!je) return null;
  let paymentId = (je as { payment_id?: string }).payment_id;
  if (!paymentId && (je as { reference_type?: string }).reference_type === 'payment') {
    paymentId = (je as { reference_id?: string }).reference_id;
  }
  if (!paymentId) return null;
  const { data: p } = await supabase
    .from('payments')
    .select('id, reference_number, payment_date, amount, reference_type, contact_id, voided_at, contacts(name)')
    .eq('id', paymentId)
    .maybeSingle();
  if (!p) return null;
  const c = (p as { contacts?: { name?: string } }).contacts;
  return {
    id: String((p as { id: string }).id),
    reference_number: (p as { reference_number?: string }).reference_number ?? null,
    payment_date: (p as { payment_date?: string }).payment_date ?? null,
    amount: Number((p as { amount?: number }).amount) || 0,
    reference_type: (p as { reference_type?: string }).reference_type ?? null,
    contact_id: (p as { contact_id?: string }).contact_id ?? null,
    contact_name: c?.name ?? null,
    voided_at: (p as { voided_at?: string }).voided_at ?? null,
  };
}

export async function loadAccountLineMeta(accountId: string, journalLineId: string): Promise<AccountLineMeta | null> {
  const { data: acc } = await supabase
    .from('accounts')
    .select('id, code, name, linked_contact_id, contacts:linked_contact_id(name)')
    .eq('id', accountId)
    .maybeSingle();
  if (!acc) return null;
  const lc = (acc as { contacts?: { name?: string } }).contacts;
  return {
    account_id: String((acc as { id: string }).id),
    account_code: (acc as { code?: string }).code ?? null,
    account_name: (acc as { name?: string }).name ?? null,
    linked_contact_id: (acc as { linked_contact_id?: string }).linked_contact_id ?? null,
    linked_contact_name: lc?.name ?? null,
  };
}

export async function loadUnmappedTrace(row: UnmappedJournalRow): Promise<UnmappedTraceBundle> {
  const [journal, payment, lineAccount] = await Promise.all([
    fetchJournalDetailForLab(row.journal_entry_id),
    loadPaymentForJournal(row.journal_entry_id),
    loadAccountLineMeta(row.account_id, row.journal_line_id),
  ]);
  return { row, journal, payment, lineAccount };
}

export interface ProposedPostingLine {
  account_label: string;
  debit: number;
  credit: number;
  description: string;
}

/** Batch-load document statuses for unposted queue split (read-only). */
export async function batchFetchUnpostedDocumentStatuses(
  rows: UnpostedDocumentRow[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const saleIds = rows.filter((r) => r.source_type === 'sale').map((r) => r.source_id);
  const purchaseIds = rows.filter((r) => r.source_type === 'purchase').map((r) => r.source_id);
  if (saleIds.length) {
    const { data } = await supabase.from('sales').select('id, status').in('id', saleIds);
    for (const row of data || []) {
      const id = String((row as { id: string }).id);
      const src = rows.find((r) => r.source_type === 'sale' && r.source_id === id);
      if (src) out.set(`${src.source_type}:${src.source_id}`, (row as { status?: string }).status ?? null);
    }
  }
  if (purchaseIds.length) {
    const { data } = await supabase.from('purchases').select('id, status').in('id', purchaseIds);
    for (const row of data || []) {
      const id = String((row as { id: string }).id);
      const src = rows.find((r) => r.source_type === 'purchase' && r.source_id === id);
      if (src) out.set(`${src.source_type}:${src.source_id}`, (row as { status?: string }).status ?? null);
    }
  }
  return out;
}

export function buildIllustrativePostingLines(
  row: UnpostedDocumentRow,
  enrichment: DocumentEnrichment | null
): ProposedPostingLine[] {
  const total = Number(enrichment?.total ?? row.amount) || 0;
  if (total <= 0) return [];
  const party = row.contact_name || 'Party';
  if (row.source_type === 'sale') {
    return [
      {
        account_label: `Receivable — ${party} (party AR sub-ledger)`,
        debit: total,
        credit: 0,
        description: 'Illustrative — from document posting engine (sale finalize)',
      },
      {
        account_label: 'Sales revenue (control account)',
        debit: 0,
        credit: total,
        description: 'Illustrative — COGS/stock lines omitted in preview',
      },
    ];
  }
  if (row.source_type === 'purchase') {
    return [
      {
        account_label: 'Inventory / expense (purchase posting)',
        debit: total,
        credit: 0,
        description: 'Illustrative purchase receipt',
      },
      {
        account_label: `Payable — ${party}`,
        debit: 0,
        credit: total,
        description: 'Illustrative AP credit',
      },
    ];
  }
  return [];
}
