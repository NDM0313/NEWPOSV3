/**
 * Test Accounting Service – Accounting Test Page.
 * Canonical rule: any money movement (Cash/Bank/Wallet) creates payments row + JE with payment_id.
 * Uses canonical reference_type only: manual_payment, manual_receipt, expense, worker_payment, purchase, on_account.
 */

import { supabase } from '@/lib/supabase';
import { accountingService, JournalEntry, JournalEntryLine } from '@/app/services/accountingService';
import { documentNumberService } from '@/app/services/documentNumberService';
import { createSupplierPayment } from '@/app/services/supplierPaymentService';
import { createWorkerPayment } from '@/app/services/workerPaymentService';
import { generatePaymentReference } from '@/app/utils/paymentUtils';

/** Canonical reference types used by the test page. */
const CANONICAL_LIST = [
  'manual_payment', 'manual_receipt', 'expense', 'worker_payment', 'purchase', 'on_account',
];

/** True if account is Cash/Bank/Wallet (payment account). */
async function isPaymentAccountId(accountId: string): Promise<boolean> {
  const { data } = await supabase.from('accounts').select('id, code, name').eq('id', accountId).single();
  if (!data) return false;
  const code = (data.code || '').trim();
  const name = (data.name || '').toLowerCase();
  if (['1000', '1010', '1020'].includes(code)) return true;
  if (/cash|bank|wallet|jazz|easypaisa/.test(name)) return true;
  return false;
}

async function getNextPaymentRef(companyId: string, branchId: string | null | undefined): Promise<string> {
  const validBranchId = (branchId && branchId !== 'all') ? branchId : null;
  try {
    return await documentNumberService.getNextDocumentNumber(companyId, validBranchId, 'payment');
  } catch {
    return generatePaymentReference(null);
  }
}

export type TestEntryType = 'manual' | 'transfer' | 'supplier_payment' | 'worker_payment' | 'expense' | 'customer_receipt';

/** Human-readable label for canonical reference_type values. */
export function getTestEntryTypeLabel(ref: string): string {
  const map: Record<string, string> = {
    manual_payment: 'Manual Payment',
    manual_receipt: 'Manual Receipt',
    expense: 'Expense',
    worker_payment: 'Worker Payment',
    purchase: 'Purchase',
    on_account: 'Customer Receipt (On Account)',
  };
  return map[ref] || ref;
}

export interface TestEntryLine {
  id: string;
  account_id: string;
  account_name?: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface TestEntry {
  id: string;
  entry_no: string | null;
  entry_date: string;
  description: string | null;
  reference_type: string;
  reference_id: string | null;
  attachments: { url: string; name: string }[] | null;
  created_at?: string;
  lines: TestEntryLine[];
  /** Total amount (sum of debits) */
  amount: number;
}

async function getNextEntryNo(companyId: string): Promise<string> {
  const max = await documentNumberService.getMaxDocumentNumber(companyId, 'journal', 'JE-');
  const next = max + 1;
  return `JE-${String(next).padStart(4, '0')}`;
}

function toDateStr(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export interface ManualEntryParams {
  companyId: string;
  branchId?: string | null;
  createdBy?: string | null;
  date: string;
  description: string;
  optionalReference?: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  attachments?: { url: string; name: string }[];
}

export interface TransferParams {
  companyId: string;
  branchId?: string | null;
  createdBy?: string | null;
  date: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description: string;
  attachments?: { url: string; name: string }[];
}

export interface SupplierPaymentParams {
  companyId: string;
  branchId?: string | null;
  createdBy?: string | null;
  date: string;
  supplierId: string;
  supplierName: string;
  paymentAccountId: string;
  amount: number;
  description: string;
  attachments?: { url: string; name: string }[];
}

export interface WorkerPaymentParams {
  companyId: string;
  branchId?: string | null;
  createdBy?: string | null;
  date: string;
  workerId: string;
  workerName: string;
  paymentAccountId: string;
  amount: number;
  description: string;
  attachments?: { url: string; name: string }[];
}

export interface ExpenseEntryParams {
  companyId: string;
  branchId?: string | null;
  createdBy?: string | null;
  date: string;
  expenseAccountId: string;
  paymentAccountId: string;
  amount: number;
  description: string;
  attachments?: { url: string; name: string }[];
}

export interface CustomerReceiptParams {
  companyId: string;
  branchId?: string | null;
  createdBy?: string | null;
  date: string;
  customerId: string;
  customerName: string;
  paymentAccountId: string;
  amount: number;
  description: string;
  attachments?: { url: string; name: string }[];
}

export const testAccountingService = {
  /**
   * Fetch accounting test entries from canonical reference types only.
   * Used by Accounting Test page to list and view saved entries.
   */
  async getTestEntries(
    companyId: string,
    options?: { branchId?: string | null; startDate?: string; endDate?: string }
  ): Promise<TestEntry[]> {
    // Fetch entries with lines only (no nested accounts embed to avoid 400 from PostgREST)
    let query = supabase
      .from('journal_entries')
      .select(
        `
        id,
        entry_no,
        entry_date,
        description,
        reference_type,
        reference_id,
        attachments,
        created_at,
        lines:journal_entry_lines(id, account_id, debit, credit, description)
      `
      )
      .eq('company_id', companyId)
      .in('reference_type', CANONICAL_LIST)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (options?.branchId && options.branchId !== 'all') {
      query = query.eq('branch_id', options.branchId);
    }
    if (options?.startDate) {
      query = query.gte('entry_date', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('entry_date', options.endDate);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        return [];
      }
      console.error('[TEST ACCOUNTING] getTestEntries error:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Collect all account_ids and fetch account names in one query
    const accountIds = new Set<string>();
    for (const row of data) {
      for (const l of row.lines || []) {
        if (l.account_id) accountIds.add(l.account_id);
      }
    }
    const idList = Array.from(accountIds);
    let accountMap: Record<string, { name: string; code?: string }> = {};
    if (idList.length > 0) {
      const { data: accData } = await supabase
        .from('accounts')
        .select('id, name, code')
        .in('id', idList);
      if (accData) {
        for (const a of accData) {
          accountMap[a.id] = { name: a.name, code: a.code };
        }
      }
    }

    return data.map((row: any) => {
      const lines = (row.lines || []).map((l: any) => {
        const acc = accountMap[l.account_id];
        const account_name = acc ? `${acc.code || ''} ${acc.name}`.trim() : undefined;
        return {
          id: l.id,
          account_id: l.account_id,
          account_name,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description,
        };
      });
      const amount = lines.reduce((sum: number, l: TestEntryLine) => sum + l.debit, 0);
      return {
        id: row.id,
        entry_no: row.entry_no,
        entry_date: row.entry_date,
        description: row.description,
        reference_type: row.reference_type,
        reference_id: row.reference_id,
        attachments: row.attachments,
        created_at: row.created_at,
        lines,
        amount,
      } as TestEntry;
    });
  },

  async createManualEntry(params: ManualEntryParams): Promise<{ id: string; entry_no: string }> {
    const entryNo = await getNextEntryNo(params.companyId);
    const validBranchId = (params.branchId && params.branchId !== 'all') ? params.branchId : null;
    const debitIsPayment = await isPaymentAccountId(params.debitAccountId);
    const creditIsPayment = await isPaymentAccountId(params.creditAccountId);

    let paymentId: string | null = null;
    let refType: string = REF.manual;
    if (debitIsPayment && !creditIsPayment) {
      const refNo = await getNextPaymentRef(params.companyId, params.branchId);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: row, error } = await supabase.from('payments').insert({
        company_id: params.companyId,
        branch_id: validBranchId,
        payment_type: 'received',
        reference_type: 'manual_receipt',
        reference_id: null,
        amount: params.amount,
        payment_method: 'other',
        payment_account_id: params.debitAccountId,
        payment_date: toDateStr(params.date),
        reference_number: refNo,
        received_by: (user as any)?.id ?? null,
        created_by: params.createdBy ?? null,
      }).select('id').single();
      if (!error && row) { paymentId = (row as { id: string }).id; refType = 'manual_receipt'; }
    } else if (!debitIsPayment && creditIsPayment) {
      const refNo = await getNextPaymentRef(params.companyId, params.branchId);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: row, error } = await supabase.from('payments').insert({
        company_id: params.companyId,
        branch_id: validBranchId,
        payment_type: 'paid',
        reference_type: 'manual_payment',
        reference_id: null,
        amount: params.amount,
        payment_method: 'other',
        payment_account_id: params.creditAccountId,
        payment_date: toDateStr(params.date),
        reference_number: refNo,
        received_by: (user as any)?.id ?? null,
        created_by: params.createdBy ?? null,
      }).select('id').single();
      if (!error && row) { paymentId = (row as { id: string }).id; refType = 'manual_payment'; }
    }

    const entry: JournalEntry = {
      company_id: params.companyId,
      branch_id: validBranchId ?? undefined,
      entry_no: entryNo,
      entry_date: toDateStr(params.date),
      description: params.description,
      reference_type: refType,
      created_by: params.createdBy ?? undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    };
    const lines: JournalEntryLine[] = [
      { account_id: params.debitAccountId, debit: params.amount, credit: 0, description: params.description },
      { account_id: params.creditAccountId, debit: 0, credit: params.amount, description: params.description },
    ];
    const result = await accountingService.createEntry(entry, lines, paymentId ?? undefined);
    return { id: result.id, entry_no: entryNo };
  },

  async createTransfer(params: TransferParams): Promise<{ id: string; entry_no: string }> {
    const entryNo = await getNextEntryNo(params.companyId);
    const validBranchId = (params.branchId && params.branchId !== 'all') ? params.branchId : null;
    const refNo = await getNextPaymentRef(params.companyId, params.branchId);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: paymentRow, error: payErr } = await supabase.from('payments').insert({
      company_id: params.companyId,
      branch_id: validBranchId,
      payment_type: 'paid',
      reference_type: 'manual_payment',
      reference_id: null,
      amount: params.amount,
      payment_method: 'other',
      payment_account_id: params.fromAccountId,
      payment_date: toDateStr(params.date),
      reference_number: refNo,
      received_by: (user as any)?.id ?? null,
      created_by: params.createdBy ?? null,
    }).select('id').single();
    if (payErr) throw new Error(`Transfer payment row failed: ${payErr.message}`);
    const paymentId = (paymentRow as { id: string }).id;

    const entry: JournalEntry = {
      company_id: params.companyId,
      branch_id: validBranchId ?? undefined,
      entry_no: entryNo,
      entry_date: toDateStr(params.date),
      description: params.description,
      reference_type: 'manual_payment',
      created_by: params.createdBy ?? undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    };
    const lines: JournalEntryLine[] = [
      { account_id: params.toAccountId, debit: params.amount, credit: 0, description: params.description },
      { account_id: params.fromAccountId, debit: 0, credit: params.amount, description: params.description },
    ];
    const result = await accountingService.createEntry(entry, lines, paymentId);
    return { id: result.id, entry_no: entryNo };
  },

  async createSupplierPayment(params: SupplierPaymentParams): Promise<{ id: string; entry_no: string }> {
    const validBranchId = (params.branchId && params.branchId !== 'all') ? params.branchId : null;
    const { journalEntryId, referenceNumber } = await createSupplierPayment({
      companyId: params.companyId,
      branchId: validBranchId,
      amount: params.amount,
      paymentMethod: 'cash',
      paymentAccountId: params.paymentAccountId,
      contactId: params.supplierId,
      supplierName: params.supplierName,
      paymentDate: toDateStr(params.date),
      notes: params.description,
    });
    return { id: journalEntryId, entry_no: referenceNumber };
  },

  async createWorkerPayment(params: WorkerPaymentParams): Promise<{ id: string; entry_no: string }> {
    const validBranchId = (params.branchId && params.branchId !== 'all') ? params.branchId : null;
    const { journalEntryId, referenceNumber } = await createWorkerPayment({
      companyId: params.companyId,
      branchId: validBranchId,
      workerId: params.workerId,
      workerName: params.workerName,
      amount: params.amount,
      paymentMethod: 'cash',
      paymentAccountId: params.paymentAccountId,
      notes: params.description,
    });
    return { id: journalEntryId, entry_no: referenceNumber };
  },

  async createExpenseEntry(params: ExpenseEntryParams): Promise<{ id: string; entry_no: string }> {
    const entryNo = await getNextEntryNo(params.companyId);
    const validBranchId = (params.branchId && params.branchId !== 'all') ? params.branchId : null;
    const refNo = await getNextPaymentRef(params.companyId, params.branchId);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: paymentRow, error: payErr } = await supabase.from('payments').insert({
      company_id: params.companyId,
      branch_id: validBranchId,
      payment_type: 'paid',
      reference_type: 'expense',
      reference_id: null,
      amount: params.amount,
      payment_method: 'other',
      payment_account_id: params.paymentAccountId,
      payment_date: toDateStr(params.date),
      reference_number: refNo,
      received_by: (user as any)?.id ?? null,
      created_by: params.createdBy ?? null,
    }).select('id').single();
    if (payErr) throw new Error(`Expense payment row failed: ${payErr.message}`);
    const paymentId = (paymentRow as { id: string }).id;

    const entry: JournalEntry = {
      company_id: params.companyId,
      branch_id: validBranchId ?? undefined,
      entry_no: entryNo,
      entry_date: toDateStr(params.date),
      description: params.description,
      reference_type: 'expense',
      created_by: params.createdBy ?? undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    };
    const lines: JournalEntryLine[] = [
      { account_id: params.expenseAccountId, debit: params.amount, credit: 0, description: params.description },
      { account_id: params.paymentAccountId, debit: 0, credit: params.amount, description: params.description },
    ];
    const result = await accountingService.createEntry(entry, lines, paymentId);
    return { id: result.id, entry_no: entryNo };
  },

  async createCustomerReceipt(params: CustomerReceiptParams): Promise<{ id: string; entry_no: string }> {
    const { data: arAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('company_id', params.companyId)
      .or('code.eq.1100,name.ilike.%Accounts Receivable%')
      .limit(1);
    const arId = arAccounts?.[0]?.id;
    if (!arId) throw new Error('Accounts Receivable account not found. Add it in Chart of Accounts.');

    const entryNo = await getNextEntryNo(params.companyId);
    const validBranchId = (params.branchId && params.branchId !== 'all') ? params.branchId : null;
    const refNo = await getNextPaymentRef(params.companyId, params.branchId);
    const { data: { user } } = await supabase.auth.getUser();
    const insertPayload: Record<string, unknown> = {
      company_id: params.companyId,
      branch_id: validBranchId,
      payment_type: 'received',
      reference_type: 'on_account',
      reference_id: null,
      contact_id: params.customerId,
      amount: params.amount,
      payment_method: 'other',
      payment_account_id: params.paymentAccountId,
      payment_date: toDateStr(params.date),
      reference_number: refNo,
      received_by: (user as any)?.id ?? null,
      created_by: params.createdBy ?? null,
    };
    const { data: paymentRow, error: payErr } = await supabase.from('payments').insert(insertPayload).select('id').single();
    if (payErr) throw new Error(`Customer receipt payment row failed: ${payErr.message}`);
    const paymentId = (paymentRow as { id: string }).id;

    const entry: JournalEntry = {
      company_id: params.companyId,
      branch_id: validBranchId ?? undefined,
      entry_no: entryNo,
      entry_date: toDateStr(params.date),
      description: params.description,
      reference_type: 'on_account',
      reference_id: params.customerId,
      created_by: params.createdBy ?? undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    };
    const lines: JournalEntryLine[] = [
      { account_id: params.paymentAccountId, debit: params.amount, credit: 0, description: `Customer: ${params.customerName}. ${params.description}` },
      { account_id: arId, debit: 0, credit: params.amount, description: params.description },
    ];
    const result = await accountingService.createEntry(entry, lines, paymentId);
    return { id: result.id, entry_no: entryNo };
  },
};
