/**
 * Test Accounting Service – parallel structured accounting for Test Pages only.
 * Uses same journal_entries + journal_entry_lines. reference_type: test_* to distinguish.
 * Does NOT modify existing accounting logic. Respects company_id, branch_id.
 */

import { supabase } from '@/lib/supabase';
import { accountingService, JournalEntry, JournalEntryLine } from '@/app/services/accountingService';
import { documentNumberService } from '@/app/services/documentNumberService';

const REF = {
  manual: 'test_manual',
  transfer: 'test_transfer',
  supplier_payment: 'test_supplier_payment',
  worker_payment: 'test_worker_payment',
  expense: 'test_expense',
  customer_receipt: 'test_customer_receipt',
} as const;

const REF_LIST = Object.values(REF);

export type TestEntryType = keyof typeof REF;

/** Human-readable label for reference_type */
export function getTestEntryTypeLabel(ref: string): string {
  const map: Record<string, string> = {
    [REF.manual]: 'Journal Voucher',
    [REF.transfer]: 'Account Transfer',
    [REF.supplier_payment]: 'Supplier Payment',
    [REF.worker_payment]: 'Worker Payment',
    [REF.expense]: 'Expense',
    [REF.customer_receipt]: 'Customer Receipt',
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
   * Fetch all test account entries (reference_type like test_*) from the database.
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
      .in('reference_type', REF_LIST)
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
    const entry: JournalEntry = {
      company_id: params.companyId,
      branch_id: params.branchId && params.branchId !== 'all' ? params.branchId : undefined,
      entry_no: entryNo,
      entry_date: toDateStr(params.date),
      description: params.description,
      reference_type: REF.manual,
      created_by: params.createdBy ?? undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    };
    const lines: JournalEntryLine[] = [
      { account_id: params.debitAccountId, debit: params.amount, credit: 0, description: params.description },
      { account_id: params.creditAccountId, debit: 0, credit: params.amount, description: params.description },
    ];
    const result = await accountingService.createEntry(entry, lines);
    return { id: result.id, entry_no: entryNo };
  },

  async createTransfer(params: TransferParams): Promise<{ id: string; entry_no: string }> {
    const entryNo = await getNextEntryNo(params.companyId);
    const entry: JournalEntry = {
      company_id: params.companyId,
      branch_id: params.branchId && params.branchId !== 'all' ? params.branchId : undefined,
      entry_no: entryNo,
      entry_date: toDateStr(params.date),
      description: params.description,
      reference_type: REF.transfer,
      created_by: params.createdBy ?? undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    };
    // Dr To Account, Cr From Account
    const lines: JournalEntryLine[] = [
      { account_id: params.toAccountId, debit: params.amount, credit: 0, description: params.description },
      { account_id: params.fromAccountId, debit: 0, credit: params.amount, description: params.description },
    ];
    const result = await accountingService.createEntry(entry, lines);
    return { id: result.id, entry_no: entryNo };
  },

  async createSupplierPayment(params: SupplierPaymentParams): Promise<{ id: string; entry_no: string }> {
    const { data: apAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('company_id', params.companyId)
      .or('code.eq.2000,name.ilike.%Accounts Payable%')
      .limit(1);
    const apId = apAccounts?.[0]?.id;
    if (!apId) throw new Error('Accounts Payable account not found. Add it in Chart of Accounts.');

    const entryNo = await getNextEntryNo(params.companyId);
    const entry: JournalEntry = {
      company_id: params.companyId,
      branch_id: params.branchId && params.branchId !== 'all' ? params.branchId : undefined,
      entry_no: entryNo,
      entry_date: toDateStr(params.date),
      description: params.description,
      reference_type: REF.supplier_payment,
      reference_id: params.supplierId,
      created_by: params.createdBy ?? undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    };
    const lines: JournalEntryLine[] = [
      { account_id: apId, debit: params.amount, credit: 0, description: `Supplier: ${params.supplierName}. ${params.description}` },
      { account_id: params.paymentAccountId, debit: 0, credit: params.amount, description: params.description },
    ];
    const result = await accountingService.createEntry(entry, lines);
    return { id: result.id, entry_no: entryNo };
  },

  async createWorkerPayment(params: WorkerPaymentParams): Promise<{ id: string; entry_no: string }> {
    const { data: wpAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('company_id', params.companyId)
      .or('name.ilike.%Worker Payable%,name.ilike.%Salary Expense%,code.eq.2100')
      .limit(1);
    const wpId = wpAccounts?.[0]?.id;
    if (!wpId) throw new Error('Worker Payable / Salary Expense account not found. Add it in Chart of Accounts.');

    const entryNo = await getNextEntryNo(params.companyId);
    const entry: JournalEntry = {
      company_id: params.companyId,
      branch_id: params.branchId && params.branchId !== 'all' ? params.branchId : undefined,
      entry_no: entryNo,
      entry_date: toDateStr(params.date),
      description: params.description,
      reference_type: REF.worker_payment,
      reference_id: params.workerId,
      created_by: params.createdBy ?? undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    };
    const lines: JournalEntryLine[] = [
      { account_id: wpId, debit: params.amount, credit: 0, description: `Worker: ${params.workerName}. ${params.description}` },
      { account_id: params.paymentAccountId, debit: 0, credit: params.amount, description: params.description },
    ];
    const result = await accountingService.createEntry(entry, lines);
    return { id: result.id, entry_no: entryNo };
  },

  async createExpenseEntry(params: ExpenseEntryParams): Promise<{ id: string; entry_no: string }> {
    const entryNo = await getNextEntryNo(params.companyId);
    const entry: JournalEntry = {
      company_id: params.companyId,
      branch_id: params.branchId && params.branchId !== 'all' ? params.branchId : undefined,
      entry_no: entryNo,
      entry_date: toDateStr(params.date),
      description: params.description,
      reference_type: REF.expense,
      created_by: params.createdBy ?? undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    };
    const lines: JournalEntryLine[] = [
      { account_id: params.expenseAccountId, debit: params.amount, credit: 0, description: params.description },
      { account_id: params.paymentAccountId, debit: 0, credit: params.amount, description: params.description },
    ];
    const result = await accountingService.createEntry(entry, lines);
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
    const entry: JournalEntry = {
      company_id: params.companyId,
      branch_id: params.branchId && params.branchId !== 'all' ? params.branchId : undefined,
      entry_no: entryNo,
      entry_date: toDateStr(params.date),
      description: params.description,
      reference_type: REF.customer_receipt,
      reference_id: params.customerId,
      created_by: params.createdBy ?? undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    };
    // Dr Payment Account (Cash/Bank), Cr Accounts Receivable
    const lines: JournalEntryLine[] = [
      { account_id: params.paymentAccountId, debit: params.amount, credit: 0, description: `Customer: ${params.customerName}. ${params.description}` },
      { account_id: arId, debit: 0, credit: params.amount, description: params.description },
    ];
    const result = await accountingService.createEntry(entry, lines);
    return { id: result.id, entry_no: entryNo };
  },
};
