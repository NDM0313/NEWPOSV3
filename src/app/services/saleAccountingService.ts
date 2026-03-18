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
 *     Cr Cash (1000) / Accounts Payable (2000)   extra_expenses
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

/** Phase 2: Supplier payable = 2000 only (not 2020). Sale extra expense credit when payable uses this. */
async function ensureAPAccount(companyId: string): Promise<{ id: string } | null> {
  const existing = await accountHelperService.getAccountByCode('2000', companyId);
  if (existing?.id) return existing;
  const { data: byName } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .ilike('name', '%Accounts Payable%')
    .eq('is_active', true)
    .limit(2);
  const canonical = (byName as { id: string; code: string }[] | null)?.find((a) => a.code === '2000');
  if (canonical?.id) return { id: canonical.id };
  const first = (byName as { id: string }[] | null)?.[0];
  if (first?.id) return { id: first.id };
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ company_id: companyId, code: '2000', name: 'Accounts Payable', type: 'liability', balance: 0, is_active: true })
      .select('id')
      .single();
    if (!error && data?.id) return data;
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create Accounts Payable account (2000):', e);
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
   *   Cr Cash (1000) or Accounts Payable (2000)   amount
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

  /**
   * PF-14: Build accounting snapshot from sale row + sale_charges for delta comparison.
   * Used to compute OLD vs NEW and post only adjustment JEs on sale edit (never delete original JEs).
   */
  getSaleAccountingSnapshot(sale: {
    total?: number;
    total_amount?: number;
    subtotal?: number;
    discount_amount?: number;
    expenses?: number;
    shipment_charges?: number;
    charges?: { charge_type?: string; amount?: number }[];
  }): { total: number; subtotal: number; discount: number; extraExpense: number; shippingCharges: number } {
    const total = Number(sale?.total ?? sale?.total_amount ?? 0) || 0;
    const charges = Array.isArray(sale?.charges) ? sale.charges : [];
    const discount = Number(sale?.discount_amount ?? 0) || sumCharges(charges, 'discount');
    const shippingCharges = Number(sale?.shipment_charges ?? sale?.expenses ?? 0) || sumCharges(charges, 'shipping');
    const extraExpense = Number(sale?.expenses ?? 0) || sumCharges(charges, (t) => t !== 'discount' && t !== 'shipping');
    const subtotal = Number(sale?.subtotal ?? 0) || total + discount; // gross before discount
    return { total, subtotal, discount, extraExpense, shippingCharges };
  },

  /**
   * PF-14 / Phase 3: Post delta-only adjustment JEs for a sale edit. Original sale JEs remain untouched.
   * Each component (revenue, discount, extra expense, shipping) gets its own adjustment JE if delta !== 0.
   * Payment isolation: this method does NOT touch any payment_id JE or payment ledger; only document components.
   */
  async postSaleEditAdjustments(params: {
    companyId: string;
    branchId: string | null;
    saleId: string;
    invoiceNo: string;
    entryDate: string;
    createdBy: string | null;
    oldSnapshot: { total: number; subtotal: number; discount: number; extraExpense: number; shippingCharges: number };
    newSnapshot: { total: number; subtotal: number; discount: number; extraExpense: number; shippingCharges: number };
  }): Promise<{ adjustmentCount: number }> {
    const { companyId, branchId, saleId, invoiceNo, entryDate, createdBy, oldSnapshot, newSnapshot } = params;
    let adjustmentCount = 0;

    const arAccount = await ensureARAccount(companyId);
    const revenueAccount = await ensureRevenueAccount(companyId);
    const discountAccount = await ensureDiscountAllowedAccount(companyId);
    const extraExpenseAccount = await ensureExtraExpenseAccount(companyId);
    const apAccount = await ensureAPAccount(companyId);
    if (!arAccount?.id || !revenueAccount?.id) return { adjustmentCount };

    const branchIdSafe = branchId && branchId !== 'all' ? branchId : undefined;

    const fmt = (n: number) => Number(n).toLocaleString();
    // 1) Sales revenue delta (gross = subtotal; change in revenue)
    const oldGross = oldSnapshot.subtotal || oldSnapshot.total + oldSnapshot.discount;
    const newGross = newSnapshot.subtotal || newSnapshot.total + newSnapshot.discount;
    const deltaRevenue = Math.round((newGross - oldGross) * 100) / 100;
    if (deltaRevenue !== 0) {
      const desc = `Sale adjustment – revenue change (was Rs ${fmt(oldGross)}, now Rs ${fmt(newGross)}) – ${invoiceNo}`;
      if (deltaRevenue > 0) {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: arAccount.id, debit: deltaRevenue, credit: 0, description: `AR – ${invoiceNo}` },
          { accountId: revenueAccount.id, debit: 0, credit: deltaRevenue, description: `Sales Revenue – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      } else {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: revenueAccount.id, debit: -deltaRevenue, credit: 0, description: `Sales Revenue reversal – ${invoiceNo}` },
          { accountId: arAccount.id, debit: 0, credit: -deltaRevenue, description: `AR reversal – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      }
    }

    // 2) Discount delta
    const deltaDiscount = Math.round((newSnapshot.discount - oldSnapshot.discount) * 100) / 100;
    if (deltaDiscount !== 0 && discountAccount?.id) {
      const desc = `Sale adjustment – discount change (was Rs ${fmt(oldSnapshot.discount)}, now Rs ${fmt(newSnapshot.discount)}) – ${invoiceNo}`;
      if (deltaDiscount > 0) {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: discountAccount.id, debit: deltaDiscount, credit: 0, description: `Discount Allowed – ${invoiceNo}` },
          { accountId: revenueAccount.id, debit: 0, credit: deltaDiscount, description: `Sales Revenue – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      } else {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: revenueAccount.id, debit: -deltaDiscount, credit: 0, description: `Sales Revenue – ${invoiceNo}` },
          { accountId: discountAccount.id, debit: 0, credit: -deltaDiscount, description: `Discount reversal – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      }
    }

    // 3) Extra expense delta
    const deltaExtra = Math.round((newSnapshot.extraExpense - oldSnapshot.extraExpense) * 100) / 100;
    if (deltaExtra !== 0 && extraExpenseAccount?.id && apAccount?.id) {
      const desc = `Sale adjustment – extra expense change (was Rs ${fmt(oldSnapshot.extraExpense)}, now Rs ${fmt(newSnapshot.extraExpense)}) – ${invoiceNo}`;
      if (deltaExtra > 0) {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: extraExpenseAccount.id, debit: deltaExtra, credit: 0, description: `Extra Expense – ${invoiceNo}` },
          { accountId: apAccount.id, debit: 0, credit: deltaExtra, description: `Payable – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      } else {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: apAccount.id, debit: -deltaExtra, credit: 0, description: `Payable reversal – ${invoiceNo}` },
          { accountId: extraExpenseAccount.id, debit: 0, credit: -deltaExtra, description: `Extra Expense reversal – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      }
    }

    // 4) Shipping (charged to customer) delta – treat as revenue-side: Dr AR, Cr Revenue or shipping income
    const deltaShipping = Math.round((newSnapshot.shippingCharges - oldSnapshot.shippingCharges) * 100) / 100;
    if (deltaShipping !== 0) {
      const desc = `Sale adjustment – shipping change (was Rs ${fmt(oldSnapshot.shippingCharges)}, now Rs ${fmt(newSnapshot.shippingCharges)}) – ${invoiceNo}`;
      if (deltaShipping > 0) {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: arAccount.id, debit: deltaShipping, credit: 0, description: `AR shipping – ${invoiceNo}` },
          { accountId: revenueAccount.id, debit: 0, credit: deltaShipping, description: `Sales Revenue – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      } else {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: revenueAccount.id, debit: -deltaShipping, credit: 0, description: `Sales Revenue reversal – ${invoiceNo}` },
          { accountId: arAccount.id, debit: 0, credit: -deltaShipping, description: `AR reversal – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      }
    }

    return { adjustmentCount };
  },
};

function sumCharges(charges: { charge_type?: string; amount?: number }[], type: string | ((t: string) => boolean)): number {
  return charges.reduce((sum, c) => {
    const t = (c.charge_type || '').toLowerCase();
    const amt = Number(c.amount ?? 0) || 0;
    if (typeof type === 'function' ? type(t) : t === type) return sum + amt;
    return sum;
  }, 0);
}

async function postAdjustmentJE(
  companyId: string,
  branchId: string | undefined,
  saleId: string,
  entryDate: string,
  createdBy: string | null,
  description: string,
  lines: { accountId: string; debit: number; credit: number; description: string }[]
): Promise<void> {
  // PF-14.4: Idempotency – skip if this exact adjustment already exists (prevents duplicate JEs on double submit / re-run).
  const exists = await accountingService.hasExistingSaleAdjustmentByDescription(companyId, saleId, description);
  if (exists) {
    if (import.meta.env?.DEV) console.log('[saleAccountingService] Skipping duplicate sale_adjustment JE (idempotent):', description.slice(0, 60));
    return;
  }
  const entryNo = `JE-ADJ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const fingerprint = `sale_adjustment:${companyId}:${saleId}:${description}`;
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId,
    entry_no: entryNo,
    entry_date: entryDate,
    description,
    reference_type: 'sale_adjustment',
    reference_id: saleId,
    created_by: createdBy || undefined,
    action_fingerprint: fingerprint,
  };
  const lineRows: JournalEntryLine[] = lines.map((l) => ({
    id: '',
    journal_entry_id: '',
    account_id: l.accountId,
    debit: l.debit,
    credit: l.credit,
    description: l.description,
  }));
  await accountingService.createEntry(entry, lineRows);
}
