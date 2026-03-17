/**
 * Sale Accounting Service
 *
 * ERP Rule: Journal entries are created ONLY when a sale is finalized.
 *
 *   Simple Sale (no discount / extras):
 *     Dr Accounts Receivable (1100)   total
 *     Cr Sales Revenue (4000)                  total
 *
 *   Sale with discount_amount > 0:
 *     Dr Accounts Receivable (1100)   net_total  (total after discount)
 *     Dr Discount Allowed   (5200)    discount_amount
 *     Cr Sales Revenue      (4000)               gross_total  (subtotal before discount)
 *
 *   Issue 08 – COGS: When sale has line items with product cost:
 *     Dr Cost of Production (5000)   totalCogs
 *     Cr Inventory (1200)                     totalCogs
 *   (Same journal entry; totalCogs = sum(line.quantity * product.cost_price).)
 *
 *   Sale with extra_expenses > 0:
 *     Dr Extra Expense (5300)   extra_expenses
 *     Cr Cash / Accounts Payable (2020)   extra_expenses
 *     (separate journal entry, reference_type='sale_extra_expense')
 *
 *   Cancelled:
 *     Reversal of the original sale entry (including COGS reversal: Dr Inventory Cr COGS).
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

/** Ensure Accounts Receivable (1100) exists for the company; create if missing. Canonical: 1100=AR, 2000=AP. */
async function ensureARAccount(companyId: string): Promise<{ id: string } | null> {
  let account = await accountHelperService.getAccountByCode('1100', companyId);
  if (account?.id) return account;

  // Fallback: look by name (exclude 2000 — that is Accounts Payable)
  const { data: byName } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .ilike('name', '%Accounts Receivable%')
    .eq('is_active', true)
    .limit(5);

  const arByName = (byName as { id: string; code: string }[] | null)?.find((a) => a.code !== '2000');
  if (arByName?.id) return { id: arByName.id };

  // Auto-create if missing (canonical code 1100)
  try {
    const { data: created, error } = await supabase
      .from('accounts')
      .insert({
        company_id: companyId,
        code: '1100',
        name: 'Accounts Receivable',
        type: 'asset',
        balance: 0,
        is_active: true,
      })
      .select('id')
      .single();

    if (!error && created?.id) {
      console.log('[saleAccountingService] Created Accounts Receivable (1100) account');
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

/** Ensure Discount Allowed (5200) exists for the company; create if missing. */
async function ensureDiscountAllowedAccount(companyId: string): Promise<{ id: string } | null> {
  const existing = await accountHelperService.getAccountByCode('5200', companyId);
  if (existing?.id) return existing;
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ company_id: companyId, code: '5200', name: 'Discount Allowed', type: 'Expense', balance: 0, is_active: true })
      .select('id')
      .single();
    if (!error && data?.id) return data;
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create Discount Allowed account:', e);
  }
  return null;
}

/** Ensure Extra Expense (5300) exists for the company; create if missing. */
async function ensureExtraExpenseAccount(companyId: string): Promise<{ id: string } | null> {
  const existing = await accountHelperService.getAccountByCode('5300', companyId);
  if (existing?.id) return existing;
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ company_id: companyId, code: '5300', name: 'Extra Expense', type: 'Expense', balance: 0, is_active: true })
      .select('id')
      .single();
    if (!error && data?.id) return data;
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create Extra Expense account:', e);
  }
  return null;
}

/** Ensure Accounts Payable (2020) exists for the company; create if missing. */
async function ensureAPAccount(companyId: string): Promise<{ id: string } | null> {
  const existing = await accountHelperService.getAccountByCode('2020', companyId);
  if (existing?.id) return existing;
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ company_id: companyId, code: '2020', name: 'Accounts Payable', type: 'Liability', balance: 0, is_active: true })
      .select('id')
      .single();
    if (!error && data?.id) return data;
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create Accounts Payable account:', e);
  }
  return null;
}

/** Issue 08: COGS account (5000) for Cost of Production / Cost of Goods Sold. */
async function ensureCOGSAccount(companyId: string): Promise<{ id: string } | null> {
  const existing = await accountHelperService.getAccountByCode('5000', companyId);
  if (existing?.id) return existing;
  const { data: byName } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .or('name.ilike.%Cost of Production%,name.ilike.%Cost of Goods Sold%')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (byName?.id) return byName;
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ company_id: companyId, code: '5000', name: 'Cost of Production', type: 'expense', balance: 0, is_active: true })
      .select('id')
      .single();
    if (!error && data?.id) {
      console.log('[saleAccountingService] Created COGS account (5000)');
      return data;
    }
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create COGS account:', e);
  }
  return null;
}

/** Issue 08: Inventory asset account (1200). */
async function ensureInventoryAccount(companyId: string): Promise<{ id: string } | null> {
  const existing = await accountHelperService.getAccountByCode('1200', companyId);
  if (existing?.id) return existing;
  const { data: byName } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .ilike('name', '%Inventory%')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (byName?.id) return byName;
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ company_id: companyId, code: '1200', name: 'Inventory', type: 'asset', balance: 0, is_active: true })
      .select('id')
      .single();
    if (!error && data?.id) {
      console.log('[saleAccountingService] Created Inventory account (1200)');
      return data;
    }
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create Inventory account:', e);
  }
  return null;
}

/**
 * Issue 08: Compute total COGS for a sale from line items (quantity × product.cost_price).
 * Uses sales_items first, fallback sale_items. Returns 0 if no items or no cost.
 */
async function getSaleCogs(saleId: string): Promise<number> {
  let items: { quantity: number; product?: { cost_price?: number } | null }[] = [];
  const { data: fromSalesItems, error: err1 } = await supabase
    .from('sales_items')
    .select('quantity, product:products(cost_price)')
    .eq('sale_id', saleId);
  if (!err1 && fromSalesItems?.length) {
    items = fromSalesItems as typeof items;
  } else {
    const { data: fromSaleItems } = await supabase
      .from('sale_items')
      .select('quantity, product:products(cost_price)')
      .eq('sale_id', saleId);
    if (fromSaleItems?.length) items = fromSaleItems as typeof items;
  }
  let total = 0;
  for (const row of items) {
    const qty = Number(row.quantity) || 0;
    const cost = Number(row.product?.cost_price) || 0;
    total += qty * cost;
  }
  return Math.round(total * 100) / 100;
}

export const saleAccountingService = {
  /**
   * Create journal entry when sale is finalized.
   *
   * With discount:
   *   Dr Accounts Receivable (1100)   net_total
   *   Dr Discount Allowed   (5200)    discount_amount
   *   Cr Sales Revenue      (4000)               gross_total
   *
   * Without discount:
   *   Dr Accounts Receivable (1100)   total
   *   Cr Sales Revenue (4000)                  total
   *
   * Safe to call multiple times — duplicate is detected and skipped.
   */
  async createSaleJournalEntry(params: {
    saleId: string;
    companyId: string;
    branchId?: string | null;
    total: number;
    discountAmount?: number;
    invoiceNo: string;
    performedBy?: string | null;
  }): Promise<string | null> {
    const { saleId, companyId, branchId, total, discountAmount = 0, invoiceNo, performedBy } = params;

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

    const hasDiscount = discountAmount > 0;
    const grossTotal = hasDiscount ? total + discountAmount : total;

    const lines: JournalEntryLine[] = [
      {
        id: '',
        journal_entry_id: '',
        account_id: arAccount.id,
        debit: total,
        credit: 0,
        description: `Accounts Receivable – ${invoiceNo}`,
      },
    ];

    if (hasDiscount) {
      const discountAccount = await ensureDiscountAllowedAccount(companyId);
      if (discountAccount?.id) {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: discountAccount.id,
          debit: discountAmount,
          credit: 0,
          description: `Discount Allowed – ${invoiceNo}`,
        });
      }
    }

    lines.push({
      id: '',
      journal_entry_id: '',
      account_id: revenueAccount.id,
      debit: 0,
      credit: hasDiscount ? grossTotal : total,
      description: `Sales Revenue – ${invoiceNo}`,
    });

    // Issue 08: COGS – Dr Cost of Production (5000), Cr Inventory (1200)
    const totalCogs = await getSaleCogs(saleId);
    if (totalCogs > 0) {
      const cogsAccount = await ensureCOGSAccount(companyId);
      const invAccount = await ensureInventoryAccount(companyId);
      if (cogsAccount?.id && invAccount?.id) {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: cogsAccount.id,
          debit: totalCogs,
          credit: 0,
          description: `Cost of Goods Sold – ${invoiceNo}`,
        });
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: invAccount.id,
          debit: 0,
          credit: totalCogs,
          description: `Inventory – sale ${invoiceNo}`,
        });
      }
    }

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
   * Create extra expense journal entry for a sale.
   *
   *   Dr Extra Expense (5300)    amount
   *   Cr Cash (1000) or Accounts Payable (2020)   amount
   *
   * Uses reference_type='sale_extra_expense' to allow multiple per sale.
   */
  async createExtraExpenseJournalEntry(params: {
    saleId: string;
    companyId: string;
    branchId?: string | null;
    amount: number;
    paymentMethod?: 'cash' | 'payable';
    invoiceNo: string;
    notes?: string;
    performedBy?: string | null;
  }): Promise<string | null> {
    const { saleId, companyId, branchId, amount, paymentMethod = 'payable', invoiceNo, notes, performedBy } = params;

    if (!saleId || !companyId || amount <= 0) return null;

    const expenseAccount = await ensureExtraExpenseAccount(companyId);
    if (!expenseAccount?.id) {
      console.warn('[saleAccountingService] Extra Expense account not found');
      return null;
    }

    // Credit account: Cash or Payable
    let creditAccountId: string | null = null;
    if (paymentMethod === 'cash') {
      const cashAccount = await accountHelperService.getAccountByCode('1000', companyId);
      creditAccountId = cashAccount?.id ?? null;
    }
    if (!creditAccountId) {
      const apAccount = await ensureAPAccount(companyId);
      creditAccountId = apAccount?.id ?? null;
    }

    if (!creditAccountId) {
      console.warn('[saleAccountingService] No credit account found for extra expense');
      return null;
    }

    const entry: JournalEntry = {
      id: '',
      company_id: companyId,
      branch_id: (branchId && branchId !== 'all') ? branchId : undefined,
      entry_no: `JE-EXP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      entry_date: new Date().toISOString().split('T')[0],
      description: notes ?? `Extra Expense – ${invoiceNo}`,
      reference_type: 'sale_extra_expense',
      reference_id: saleId,
      created_by: performedBy ?? undefined,
    };

    const lines: JournalEntryLine[] = [
      {
        id: '', journal_entry_id: '',
        account_id: expenseAccount.id,
        debit: amount, credit: 0,
        description: `Extra Expense – ${invoiceNo}`,
      },
      {
        id: '', journal_entry_id: '',
        account_id: creditAccountId,
        debit: 0, credit: amount,
        description: paymentMethod === 'cash' ? `Cash paid – Extra Expense ${invoiceNo}` : `Payable – Extra Expense ${invoiceNo}`,
      },
    ];

    try {
      const result = await accountingService.createEntry(entry, lines);
      const journalEntryId = (result as any)?.id ?? null;
      console.log(`[saleAccountingService] Extra expense entry created for sale ${invoiceNo}: ${journalEntryId}`);
      return journalEntryId;
    } catch (err: any) {
      console.error('[saleAccountingService] Failed to create extra expense entry:', err.message);
      return null;
    }
  },

  /**
   * Create reversing journal entry when a finalized sale is cancelled.
   *
   *   Dr Sales Revenue (4000)         amount   [reversal]
   *   Cr Accounts Receivable (1100)            amount
   *
   * Only creates reversal if an original sale journal entry exists.
   */
  async reverseSaleJournalEntry(params: {
    saleId: string;
    companyId: string;
    branchId?: string | null;
    total: number;
    discountAmount?: number;
    invoiceNo: string;
    performedBy?: string | null;
  }): Promise<string | null> {
    const { saleId, companyId, branchId, total, discountAmount = 0, invoiceNo, performedBy } = params;

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

    const hasDiscount = discountAmount > 0;
    const grossTotal = hasDiscount ? total + discountAmount : total;

    const lines: JournalEntryLine[] = [
      {
        id: '',
        journal_entry_id: '',
        account_id: revenueAccount.id,
        debit: hasDiscount ? grossTotal : total,
        credit: 0,
        description: `Reversal Sales Revenue – ${invoiceNo}`,
      },
    ];

    if (hasDiscount) {
      const discountAccount = await ensureDiscountAllowedAccount(companyId);
      if (discountAccount?.id) {
        lines.push({
          id: '', journal_entry_id: '',
          account_id: discountAccount.id,
          debit: 0, credit: discountAmount,
          description: `Reversal Discount Allowed – ${invoiceNo}`,
        });
      }
    }

    lines.push({
      id: '',
      journal_entry_id: '',
      account_id: arAccount.id,
      debit: 0,
      credit: total,
      description: `Reversal Accounts Receivable – ${invoiceNo}`,
    });

    // Issue 08: Reverse COGS – Dr Inventory (1200), Cr Cost of Production (5000)
    const totalCogs = await getSaleCogs(saleId);
    if (totalCogs > 0) {
      const cogsAccount = await ensureCOGSAccount(companyId);
      const invAccount = await ensureInventoryAccount(companyId);
      if (cogsAccount?.id && invAccount?.id) {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: invAccount.id,
          debit: totalCogs,
          credit: 0,
          description: `Reversal Inventory – ${invoiceNo}`,
        });
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: cogsAccount.id,
          debit: 0,
          credit: totalCogs,
          description: `Reversal Cost of Goods Sold – ${invoiceNo}`,
        });
      }
    }

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
