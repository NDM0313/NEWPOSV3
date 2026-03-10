/**
 * Sale Accounting Service
 *
 * ERP Rule: Journal entries are created ONLY when a sale is finalized.
 *
 *   Draft Sale   → No accounting entry
 *   Final Sale   → Dr Accounts Receivable (2000) / Cr Sales Revenue (4000)
 *   Cancelled    → Dr Sales Revenue (4000) / Cr Accounts Receivable (2000) [reversal]
 *
 * Duplicate Protection: One entry per sale (reference_type='sale', reference_id=saleId).
 */

import { supabase } from '@/lib/supabase';
import { accountHelperService } from './accountHelperService';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';

/** Check if a journal entry already exists for a given sale (duplicate guard). */
async function saleJournalEntryExists(saleId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_type', 'sale')
      .eq('reference_id', saleId)
      .limit(1)
      .maybeSingle();

    if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) {
      return false;
    }
    return !!data;
  } catch {
    return false;
  }
}

/** Ensure Accounts Receivable (2000) exists for the company; create if missing. */
async function ensureARAccount(companyId: string): Promise<{ id: string } | null> {
  let account = await accountHelperService.getAccountByCode('2000', companyId);
  if (account?.id) return account;

  // Fallback: look by name
  const { data: byName } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .ilike('name', '%Accounts Receivable%')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (byName?.id) return byName;

  // Auto-create if missing
  try {
    const { data: created, error } = await supabase
      .from('accounts')
      .insert({
        company_id: companyId,
        code: '2000',
        name: 'Accounts Receivable',
        type: 'Accounts Receivable',
        balance: 0,
        is_active: true,
      })
      .select('id')
      .single();

    if (!error && created?.id) {
      console.log('[saleAccountingService] Created Accounts Receivable (2000) account');
      return created;
    }
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create AR account:', e);
  }
  return null;
}

/** Ensure Sales Revenue (4000) exists for the company; create if missing. */
async function ensureRevenueAccount(companyId: string): Promise<{ id: string } | null> {
  let account = await accountHelperService.getAccountByCode('4000', companyId);
  if (account?.id) return account;

  // Fallback: look by name
  const { data: byName } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .or('name.ilike.%Sales Revenue%,name.ilike.%Sales Income%')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (byName?.id) return byName;

  // Auto-create if missing
  try {
    const { data: created, error } = await supabase
      .from('accounts')
      .insert({
        company_id: companyId,
        code: '4000',
        name: 'Sales Revenue',
        type: 'Sales Revenue',
        balance: 0,
        is_active: true,
      })
      .select('id')
      .single();

    if (!error && created?.id) {
      console.log('[saleAccountingService] Created Sales Revenue (4000) account');
      return created;
    }
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create Sales Revenue account:', e);
  }
  return null;
}

export const saleAccountingService = {
  /**
   * Create journal entry when sale is finalized.
   *
   *   Dr Accounts Receivable (2000)   amount
   *   Cr Sales Revenue (4000)                  amount
   *
   * Safe to call multiple times — duplicate is detected and skipped.
   */
  async createSaleJournalEntry(params: {
    saleId: string;
    companyId: string;
    branchId?: string | null;
    total: number;
    invoiceNo: string;
    performedBy?: string | null;
  }): Promise<string | null> {
    const { saleId, companyId, branchId, total, invoiceNo, performedBy } = params;

    if (!saleId || !companyId) {
      console.warn('[saleAccountingService] createSaleJournalEntry: missing saleId or companyId');
      return null;
    }

    if (total <= 0) {
      console.warn('[saleAccountingService] createSaleJournalEntry: total is 0, skipping');
      return null;
    }

    // Duplicate protection: skip if entry already exists for this sale
    const alreadyExists = await saleJournalEntryExists(saleId);
    if (alreadyExists) {
      console.log(`[saleAccountingService] Journal entry already exists for sale ${invoiceNo}, skipping`);
      return null;
    }

    const arAccount = await ensureARAccount(companyId);
    const revenueAccount = await ensureRevenueAccount(companyId);

    if (!arAccount?.id || !revenueAccount?.id) {
      console.warn('[saleAccountingService] AR or Sales Revenue account not found — cannot create journal entry');
      return null;
    }

    const entryNo = `JE-SALE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const entryDate = new Date().toISOString().split('T')[0];

    const entry: JournalEntry = {
      id: '',
      company_id: companyId,
      branch_id: (branchId && branchId !== 'all') ? branchId : undefined,
      entry_no: entryNo,
      entry_date: entryDate,
      description: `Sale finalized – ${invoiceNo}`,
      reference_type: 'sale',
      reference_id: saleId,
      created_by: performedBy || undefined,
    };

    const lines: JournalEntryLine[] = [
      {
        id: '',
        journal_entry_id: '',
        account_id: arAccount.id,
        debit: total,
        credit: 0,
        description: `Accounts Receivable – ${invoiceNo}`,
      },
      {
        id: '',
        journal_entry_id: '',
        account_id: revenueAccount.id,
        debit: 0,
        credit: total,
        description: `Sales Revenue – ${invoiceNo}`,
      },
    ];

    try {
      const result = await accountingService.createEntry(entry, lines);
      const journalEntryId = (result as any)?.id ?? null;
      console.log(`[saleAccountingService] Journal entry created for sale ${invoiceNo}: ${journalEntryId}`);
      return journalEntryId;
    } catch (err: any) {
      console.error('[saleAccountingService] Failed to create journal entry:', err.message);
      return null;
    }
  },

  /**
   * Create reversing journal entry when a finalized sale is cancelled.
   *
   *   Dr Sales Revenue (4000)         amount   [reversal]
   *   Cr Accounts Receivable (2000)            amount
   *
   * Only creates reversal if an original sale journal entry exists.
   */
  async reverseSaleJournalEntry(params: {
    saleId: string;
    companyId: string;
    branchId?: string | null;
    total: number;
    invoiceNo: string;
    performedBy?: string | null;
  }): Promise<string | null> {
    const { saleId, companyId, branchId, total, invoiceNo, performedBy } = params;

    if (!saleId || !companyId || total <= 0) return null;

    // Only reverse if the original journal entry exists
    const hasOriginal = await saleJournalEntryExists(saleId);
    if (!hasOriginal) {
      console.log(`[saleAccountingService] No original journal entry for sale ${invoiceNo}, skipping reversal`);
      return null;
    }

    const arAccount = await ensureARAccount(companyId);
    const revenueAccount = await ensureRevenueAccount(companyId);

    if (!arAccount?.id || !revenueAccount?.id) {
      console.warn('[saleAccountingService] AR or Sales Revenue account not found — cannot create reversal');
      return null;
    }

    const entryNo = `JE-SALE-REV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const entryDate = new Date().toISOString().split('T')[0];

    const entry: JournalEntry = {
      id: '',
      company_id: companyId,
      branch_id: (branchId && branchId !== 'all') ? branchId : undefined,
      entry_no: entryNo,
      entry_date: entryDate,
      description: `Sale cancelled – Reversal of ${invoiceNo}`,
      reference_type: 'sale_reversal',
      reference_id: saleId,
      created_by: performedBy || undefined,
    };

    const lines: JournalEntryLine[] = [
      {
        id: '',
        journal_entry_id: '',
        account_id: revenueAccount.id,
        debit: total,
        credit: 0,
        description: `Reversal Sales Revenue – ${invoiceNo}`,
      },
      {
        id: '',
        journal_entry_id: '',
        account_id: arAccount.id,
        debit: 0,
        credit: total,
        description: `Reversal Accounts Receivable – ${invoiceNo}`,
      },
    ];

    try {
      const result = await accountingService.createEntry(entry, lines);
      const journalEntryId = (result as any)?.id ?? null;
      console.log(`[saleAccountingService] Reversal entry created for cancelled sale ${invoiceNo}: ${journalEntryId}`);
      return journalEntryId;
    } catch (err: any) {
      console.error('[saleAccountingService] Failed to create reversal entry:', err.message);
      return null;
    }
  },
};
