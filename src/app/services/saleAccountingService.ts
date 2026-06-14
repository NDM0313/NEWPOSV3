import { getCurrentLocalTimestamp, localNowDateString } from '@/app/utils/localDate';
/**
 * Sale Accounting Service (Phase 4: one contract)
 *
 * Source lock: journal_entries + journal_entry_lines + accounts only.
 * COA: 1100 AR, 4000 Sales Revenue, 4010 Studio Service Revenue, 4110 Shipping Income, 4120 Extra Service Income,
 * 5200 Discount Allowed, 5300 Extra Expense (shop tailor payout — not customer invoice extra),
 * 5010 COGS–Inventory (physical goods COGS), 5000 Cost of Production (studio stage labor / worker accruals only), 1200 Inventory, 2000 AP.
 * Payment isolation: document JEs never touch payment_id; payment has its own flow.
 *
 * Sale create: Dr AR (total+shipping), Dr Discount (if any), Cr Sales Revenue (product), Cr Extra Service Income (4120, if extra charges),
 * Cr Shipping Income (4110, if shipmentCharges), COGS/Inventory.
 * Sale edit: delta JEs only (revenue, discount, shipping, extra); no blanket reversal; payment untouched unless payment changed.
 * Sale cancel: reversal JE matching create (Sales Revenue, Extra Service Income, Shipping Income, Discount, AR, COGS/Inventory).
 */

import { supabase } from '@/lib/supabase';
import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';
import { dispatchAccountingInvalidated } from '@/app/lib/dataInvalidationBus';
import { canPostAccountingForSaleStatus } from '@/app/lib/postingStatusGate';
import { accountHelperService } from './accountHelperService';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';
import { resolveReceivablePostingAccountId } from './partySubledgerAccountService';
import {
  assertJournalLinesBalanced,
  computeSaleDocumentRevenueAmounts,
  type SaleDocumentRevenueSnapshot,
} from './saleDocumentRevenueAmounts';

export {
  assertJournalLinesBalanced,
  computeSaleDocumentRevenueAmounts,
  type SaleDocumentRevenueSnapshot,
} from './saleDocumentRevenueAmounts';

/**
 * Canonical sale **document** JE (Dr AR / Cr Revenue / COGS — Phase 4):
 * - reference_type = 'sale'
 * - reference_id = sale id
 * - payment_id IS NULL (payment receipts use the same reference_type but always set payment_id)
 * - not voided
 *
 * Never count payment JEs, sale_adjustment, sale_reversal, sale_extra_expense as document JEs.
 */
export function saleDocumentJournalFingerprint(companyId: string, saleId: string): string {
  return `sale_document:${companyId}:${saleId}`;
}

/** Oldest active canonical document JE for idempotency / reversal guard. */
export async function findActiveCanonicalSaleDocumentJournalEntryId(saleId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_type', 'sale')
      .eq('reference_id', saleId)
      .is('payment_id', null)
      .or('is_void.is.null,is_void.eq.false')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) {
      return null;
    }
    if (error) return null;
    const row = (data as { id: string }[] | null)?.[0];
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** All active canonical document JE ids (Integrity Lab duplicate detection). */
export async function listActiveCanonicalSaleDocumentJournalEntryIds(saleId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, is_void')
      .eq('reference_type', 'sale')
      .eq('reference_id', saleId)
      .is('payment_id', null)
      .or('is_void.is.null,is_void.eq.false');

    if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) {
      return [];
    }
    if (error || !data?.length) return [];
    return (data as { id: string; is_void?: boolean | null }[])
      .filter((r) => r.is_void !== true)
      .map((r) => r.id)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Golden rule: only `final` sales get document-level sale JEs; posted rows must have invoice_no (final number). */
async function assertSaleEligibleForDocumentJournal(saleId: string, invoiceNo: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sales')
    .select('id, status, invoice_no')
    .eq('id', saleId)
    .maybeSingle();
  if (error || !data) {
    console.warn('[saleAccountingService] Cannot load sale for accounting guard:', saleId, error?.message);
    return false;
  }
  const status = (data as { status?: string }).status;
  const dbInvoice = String((data as { invoice_no?: string }).invoice_no ?? '').trim() || invoiceNo;
  if (!canPostAccountingForSaleStatus(status)) {
    console.warn(
      `[saleAccountingService] Blocked document JE for ${dbInvoice || saleId}: sale status is "${status}" (only final may post AR/Revenue/COGS).`
    );
    return false;
  }
  if (!dbInvoice) {
    console.warn(
      `[saleAccountingService] Blocked document JE for sale ${saleId}: status is final but invoice_no is empty — assign final invoice number before posting.`
    );
    return false;
  }
  return true;
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

/** AR line account: party subledger under 1100 when customer is set, else control 1100. */
async function resolveArLineAccountForSale(companyId: string, saleId: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase.from('sales').select('customer_id').eq('id', saleId).maybeSingle();
  if (error) return ensureARAccount(companyId);
  const customerId = (data as { customer_id?: string | null } | null)?.customer_id ?? null;
  const arId = await resolveReceivablePostingAccountId(companyId, customerId || undefined);
  if (arId) return { id: arId };
  return ensureARAccount(companyId);
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

/** Studio invoice lines credit here; merchandise stays on 4000. Auto-created if missing. */
async function ensureStudioServiceRevenueAccount(companyId: string): Promise<{ id: string } | null> {
  let account = await accountHelperService.getAccountByCode('4010', companyId);
  if (account?.id) return account;

  try {
    const { data: created, error } = await supabase
      .from('accounts')
      .insert({
        company_id: companyId,
        code: '4010',
        name: 'Studio Service Revenue',
        type: 'Sales Revenue',
        balance: 0,
        is_active: true,
      })
      .select('id')
      .single();

    if (!error && created?.id) {
      console.log('[saleAccountingService] Created Studio Service Revenue (4010) account');
      return created;
    }
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create Studio Service Revenue account:', e);
  }
  return null;
}

/**
 * Split product revenue credit between merchandise (4000) and studio service (4010) using sales_items line totals as weights.
 * Studio line = is_studio_product OR linked product product_type production (RPC parity when flag missing).
 * Exported for PF-14 sale-edit in-place JE updates (must match createSaleJournalEntry).
 */
export async function computeProductRevenueCreditSplit(
  saleId: string,
  revenueCreditTotal: number
): Promise<{ merchandiseCredit: number; studioServiceCredit: number }> {
  const { data: rows } = await supabase
    .from('sales_items')
    .select('total, is_studio_product, product:products(product_type)')
    .eq('sale_id', saleId);
  let merchSum = 0;
  let studioSum = 0;
  for (const r of rows || []) {
    const t = Number((r as { total?: number }).total) || 0;
    const pt = String(
      (r as { product?: { product_type?: string | null } | null }).product?.product_type || ''
    ).toLowerCase();
    const isStudioLine =
      (r as { is_studio_product?: boolean | null }).is_studio_product === true || pt === 'production';
    if (isStudioLine) studioSum += t;
    else merchSum += t;
  }
  const sum = merchSum + studioSum;
  if (sum <= 0 || revenueCreditTotal <= 0) {
    return { merchandiseCredit: revenueCreditTotal, studioServiceCredit: 0 };
  }
  if (studioSum <= 0) {
    return { merchandiseCredit: revenueCreditTotal, studioServiceCredit: 0 };
  }
  if (merchSum <= 0) {
    return { merchandiseCredit: 0, studioServiceCredit: revenueCreditTotal };
  }
  const wStudio = studioSum / sum;
  const studioCredit = Math.round(revenueCreditTotal * wStudio * 100) / 100;
  const merchCredit = Math.round((revenueCreditTotal - studioCredit) * 100) / 100;
  return { merchandiseCredit: merchCredit, studioServiceCredit: studioCredit };
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

/** Shipping income — code 4110 only (4100 is Sales Revenue in default COA; posting shipping to 4100 mixed product + shipping revenue). */
async function ensureShippingIncomeAccount(companyId: string): Promise<{ id: string } | null> {
  const existing = await accountHelperService.getAccountByCode('4110', companyId);
  if (existing?.id) return existing;
  const parent = await accountHelperService.getAccountByCode('4050', companyId);
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        company_id: companyId,
        code: '4110',
        name: 'Shipping Income',
        type: 'revenue',
        balance: 0,
        is_active: true,
        ...(parent?.id ? { parent_id: parent.id } : {}),
      })
      .select('id')
      .single();
    if (!error && data?.id) return data;
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create Shipping Income account (4110):', e);
  }
  return null;
}

/** Customer extra service income (stitching, etc.) — code 4120; separate from shop payout 5300. */
async function ensureExtraServiceIncomeAccount(companyId: string): Promise<{ id: string } | null> {
  const existing = await accountHelperService.getAccountByCode('4120', companyId);
  if (existing?.id) return existing;
  const parent = await accountHelperService.getAccountByCode('4050', companyId);
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        company_id: companyId,
        code: '4120',
        name: 'Extra Service Income',
        type: 'revenue',
        balance: 0,
        is_active: true,
        ...(parent?.id ? { parent_id: parent.id } : {}),
      })
      .select('id')
      .single();
    if (!error && data?.id) return data;
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create Extra Service Income account (4120):', e);
  }
  return null;
}

/** Load customer extra service amount from sale_charges (non-discount/shipping) or sales.extra_expenses. */
export async function loadSaleExtraServiceIncomeAmount(saleId: string): Promise<number> {
  if (!saleId) return 0;
  try {
    const { data: charges } = await supabase
      .from('sale_charges')
      .select('charge_type, amount')
      .eq('sale_id', saleId);
    const fromCharges = (charges || []).reduce((sum, row) => {
      const t = String((row as { charge_type?: string }).charge_type ?? '').toLowerCase();
      if (t === 'discount' || t === 'shipping') return sum;
      return sum + (Number((row as { amount?: number }).amount) || 0);
    }, 0);
    if (fromCharges > 0) return Math.round(fromCharges * 100) / 100;

    const { data: sale } = await supabase.from('sales').select('extra_expenses').eq('id', saleId).maybeSingle();
    const fromColumn = Number((sale as { extra_expenses?: number } | null)?.extra_expenses ?? 0) || 0;
    return Math.round(fromColumn * 100) / 100;
  } catch (e) {
    console.warn('[saleAccountingService] loadSaleExtraServiceIncomeAmount failed:', e);
    return 0;
  }
}

/** Exported for sale_charges ledger_account_id when persisting extra charge rows. */
export async function resolveExtraServiceIncomeAccountId(companyId: string): Promise<string | null> {
  const acct = await ensureExtraServiceIncomeAccount(companyId);
  return acct?.id ?? null;
}

/** Physical inventory COGS (5010). Studio/worker stage costs stay on 5000 — see studioProductionService. */
async function ensureCOGSAccount(companyId: string): Promise<{ id: string } | null> {
  const existing = await accountHelperService.getAccountByCode('5010', companyId);
  if (existing?.id) return existing;
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        company_id: companyId,
        code: '5010',
        name: 'COGS - Inventory',
        type: 'expense',
        balance: 0,
        is_active: true,
      })
      .select('id')
      .single();
    if (!error && data?.id) {
      console.log('[saleAccountingService] Created COGS - Inventory account (5010)');
      return data;
    }
  } catch (e) {
    console.warn('[saleAccountingService] Could not auto-create COGS - Inventory (5010):', e);
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
/**
 * Calculate COGS for a sale using weighted average cost from stock_movements.
 * Falls back to product.cost_price only when no purchase/opening movements exist.
 */
export async function getSaleCogs(saleId: string): Promise<number> {
  // Get sale items with product_id and quantity (is_studio_product lines excluded — labor in stage JEs)
  let items: {
    product_id?: string;
    quantity: number;
    is_studio_product?: boolean | null;
    product?: { cost_price?: number; company_id?: string } | null;
  }[] = [];
  const { data: fromSalesItems, error: err1 } = await supabase
    .from('sales_items')
    .select('product_id, quantity, is_studio_product, product:products(cost_price, company_id, product_type)')
    .eq('sale_id', saleId);
  if (!err1 && fromSalesItems?.length) {
    items = fromSalesItems as typeof items;
  }

  let total = 0;
  for (const row of items) {
    /** Labor for studio lines is expensed via studio_production_stage JEs (Dr 5000); do not duplicate in sale COGS. */
    const pt = String((row.product as { product_type?: string | null } | null)?.product_type || '').toLowerCase();
    if ((row as { is_studio_product?: boolean | null }).is_studio_product === true || pt === 'production') continue;
    const qty = Number(row.quantity) || 0;
    if (qty <= 0 || !row.product_id) continue;

    // Calculate weighted average cost from stock_movements (purchases + opening stock)
    const companyId = (row.product as any)?.company_id;
    let avgCost = 0;
    if (companyId) {
      const { data: movements } = await supabase
        .from('stock_movements')
        .select('quantity, unit_cost, total_cost')
        .eq('product_id', row.product_id)
        .eq('company_id', companyId)
        .in('movement_type', ['purchase', 'opening_stock', 'opening']);
      if (movements?.length) {
        let costSum = 0;
        let costQty = 0;
        for (const m of movements) {
          const mQty = Math.abs(Number((m as any).quantity) || 0);
          const mCost = Number((m as any).total_cost) || (mQty * (Number((m as any).unit_cost) || 0));
          costSum += Math.abs(mCost);
          costQty += mQty;
        }
        if (costQty > 0) avgCost = costSum / costQty;
      }
    }

    // Fallback to product.cost_price if no movements found
    if (avgCost <= 0) avgCost = Number(row.product?.cost_price) || 0;

    total += qty * avgCost;
  }
  return Math.round(total * 100) / 100;
}

/** Sum debits/credits for a JE; used after in-place sale document edits. */
export async function assertJournalEntryBalanced(
  journalEntryId: string
): Promise<{ balanced: boolean; debit: number; credit: number; diff: number }> {
  if (!journalEntryId) return { balanced: true, debit: 0, credit: 0, diff: 0 };
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit')
    .eq('journal_entry_id', journalEntryId);
  const debit = Math.round((lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
  const credit = Math.round((lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;
  const diff = Math.round((debit - credit) * 100) / 100;
  return { balanced: Math.abs(diff) <= 0.02, debit, credit, diff };
}

/**
 * Keep COGS (5010) debit and Inventory (1200) credit in sync on an existing sale document JE.
 * Always sets both to the same amount (including 0) — prevents orphaned inventory credits.
 */
export async function syncSaleDocumentJeCogsInventoryPair(params: {
  journalEntryId: string;
  saleId: string;
  companyId: string;
  invoiceNo?: string;
}): Promise<number> {
  const { journalEntryId, saleId, companyId, invoiceNo } = params;
  const totalCogs = await getSaleCogs(saleId);
  const cogsAccount = await ensureCOGSAccount(companyId);
  const invAccount = await ensureInventoryAccount(companyId);
  if (!cogsAccount?.id || !invAccount?.id) return totalCogs;

  const desc = invoiceNo || saleId.slice(0, 8);
  const legacyCogs = await accountHelperService.getAccountByCode('5000', companyId);
  const primaryCogsId = cogsAccount.id;
  const invId = invAccount.id;

  const { data: existingLines } = await supabase
    .from('journal_entry_lines')
    .select('id, account_id, debit, credit')
    .eq('journal_entry_id', journalEntryId);

  const cogsLine = (existingLines || []).find((l) => l.account_id === primaryCogsId);
  if (totalCogs > 0) {
    if (cogsLine?.id) {
      await supabase.from('journal_entry_lines').update({ debit: totalCogs, credit: 0 }).eq('id', cogsLine.id);
    } else {
      await supabase.from('journal_entry_lines').insert({
        journal_entry_id: journalEntryId,
        account_id: primaryCogsId,
        debit: totalCogs,
        credit: 0,
        description: `COGS – ${desc}`,
      });
    }
  } else if (cogsLine?.id) {
    await supabase.from('journal_entry_lines').update({ debit: 0, credit: 0 }).eq('id', cogsLine.id);
  }

  if (legacyCogs?.id && legacyCogs.id !== primaryCogsId) {
    const legacyLine = (existingLines || []).find(
      (l) => l.account_id === legacyCogs.id && (Number(l.debit) || 0) > 0
    );
    if (legacyLine?.id) {
      await supabase.from('journal_entry_lines').update({ debit: 0, credit: 0 }).eq('id', legacyLine.id);
    }
  }

  const invLine = (existingLines || []).find((l) => l.account_id === invId);
  if (totalCogs > 0) {
    if (invLine?.id) {
      await supabase.from('journal_entry_lines').update({ debit: 0, credit: totalCogs }).eq('id', invLine.id);
    } else {
      await supabase.from('journal_entry_lines').insert({
        journal_entry_id: journalEntryId,
        account_id: invId,
        debit: 0,
        credit: totalCogs,
        description: `Inventory – sale ${desc}`,
      });
    }
  } else if (invLine?.id) {
    await supabase.from('journal_entry_lines').update({ debit: 0, credit: 0 }).eq('id', invLine.id);
  }

  return totalCogs;
}

export const saleAccountingService = {
  /**
   * Create journal entry when sale is finalized (Phase 4: one contract).
   *
   * Dr AR (1100) = total + shipping (full customer receivable). Cr: Sales Revenue (4000), Extra Service Income (4120),
   * Shipping Income (4110), Dr Discount (5200) if any.
   * COGS: Dr COGS - Inventory (5010), Cr Inventory (1200).
   * Safe to call multiple times — duplicate is detected and skipped.
   */
  async createSaleJournalEntry(params: {
    saleId: string;
    companyId: string;
    branchId?: string | null;
    total: number;
    discountAmount?: number;
    /** Shipping charged to customer → Cr Shipping Income (4110). */
    shipmentCharges?: number;
    invoiceNo: string;
    performedBy?: string | null;
  }): Promise<string | null> {
    const { saleId, companyId, branchId, total, discountAmount = 0, shipmentCharges = 0, invoiceNo, performedBy } = params;

    if (!saleId || !companyId) {
      console.warn('[saleAccountingService] createSaleJournalEntry: missing saleId or companyId');
      return null;
    }

    if (total <= 0) {
      console.warn('[saleAccountingService] createSaleJournalEntry: total is 0, skipping');
      return null;
    }

    const eligible = await assertSaleEligibleForDocumentJournal(saleId, invoiceNo);
    if (!eligible) return null;

    // Idempotency: exactly one active canonical document JE; payment-linked rows must not block creation.
    const existingDocId = await findActiveCanonicalSaleDocumentJournalEntryId(saleId);
    if (existingDocId) {
      console.log(
        `[saleAccountingService] Canonical sale document JE already exists for ${invoiceNo}, reusing ${existingDocId}`
      );
      return existingDocId;
    }

    const arAccount = await resolveArLineAccountForSale(companyId, saleId);
    const revenueAccount = await ensureRevenueAccount(companyId);

    if (!arAccount?.id || !revenueAccount?.id) {
      console.warn('[saleAccountingService] AR or Sales Revenue account not found — cannot create journal entry');
      return null;
    }

    const entryNo = `JE-SALE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const entryDate = localNowDateString();

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
      action_fingerprint: saleDocumentJournalFingerprint(companyId, saleId),
    };

    const amounts = computeSaleDocumentRevenueAmounts({
      total,
      discount: discountAmount,
      extraExpense: await loadSaleExtraServiceIncomeAmount(saleId),
      shippingCharges: shipmentCharges,
    });
    const { arDebit, merchandisePool, extraAmount, shippingAmount } = amounts;
    const hasDiscount = discountAmount > 0;

    const lines: JournalEntryLine[] = [
      {
        id: '',
        journal_entry_id: '',
        account_id: arAccount.id,
        debit: arDebit,
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

    if (merchandisePool > 0) {
      const split = await computeProductRevenueCreditSplit(saleId, merchandisePool);
      const studioRevAccount = await ensureStudioServiceRevenueAccount(companyId);
      if (split.studioServiceCredit > 0 && studioRevAccount?.id) {
        if (split.merchandiseCredit > 0) {
          lines.push({
            id: '',
            journal_entry_id: '',
            account_id: revenueAccount.id,
            debit: 0,
            credit: split.merchandiseCredit,
            description: `Sales Revenue (merchandise) – ${invoiceNo}`,
          });
          lines.push({
            id: '',
            journal_entry_id: '',
            account_id: studioRevAccount.id,
            debit: 0,
            credit: split.studioServiceCredit,
            description: `Studio Service Revenue – ${invoiceNo}`,
          });
        } else {
          lines.push({
            id: '',
            journal_entry_id: '',
            account_id: studioRevAccount.id,
            debit: 0,
            credit: split.studioServiceCredit,
            description: `Studio Service Revenue – ${invoiceNo}`,
          });
        }
      } else {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: revenueAccount.id,
          debit: 0,
          credit: merchandisePool,
          description: `Sales Revenue – ${invoiceNo}`,
        });
      }
    }
    if (extraAmount > 0) {
      const extraServiceAccount = await ensureExtraServiceIncomeAccount(companyId);
      if (extraServiceAccount?.id) {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: extraServiceAccount.id,
          debit: 0,
          credit: extraAmount,
          description: `Extra Service Income – ${invoiceNo}`,
        });
      } else {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: revenueAccount.id,
          debit: 0,
          credit: extraAmount,
          description: `Extra Service Income (fallback Revenue) – ${invoiceNo}`,
        });
      }
    }
    if (shippingAmount > 0) {
      const shippingAccount = await ensureShippingIncomeAccount(companyId);
      if (shippingAccount?.id) {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: shippingAccount.id,
          debit: 0,
          credit: shippingAmount,
          description: `Shipping Income – ${invoiceNo}`,
        });
      } else {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: revenueAccount.id,
          debit: 0,
          credit: shippingAmount,
          description: `Shipping (fallback Revenue) – ${invoiceNo}`,
        });
      }
    }

    // Issue 08: COGS – Dr COGS - Inventory (5010), Cr Inventory (1200)
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
      assertJournalLinesBalanced(lines, `createSaleJournalEntry ${invoiceNo}`);
      const result = await accountingService.createEntry(entry, lines);
      const journalEntryId = (result as any)?.id ?? null;
      console.log(`[saleAccountingService] Journal entry created for sale ${invoiceNo}: ${journalEntryId}`);
      if (journalEntryId) {
        dispatchAccountingInvalidated({
          companyId,
          branchId: branchId ?? null,
          entityId: saleId,
          reason: 'saleDocumentJournalCreated',
        });
      }
      dispatchContactBalancesRefresh(companyId);
      return journalEntryId;
    } catch (err: any) {
      console.error('[saleAccountingService] Failed to create journal entry:', err.message);
      return null;
    }
  },

  /**
   * @deprecated Extra charges on customer invoices are included in the main sale JE (Dr AR / Cr Revenue).
   * Do not use for invoice add-ons — causes double-counting / imbalanced EXP-* vouchers. Kept for rare direct calls only.
   *
   * Legacy design was Dr Extra Expense / Cr Cash or AP (supplier-style); sale form totals already book via main sale entry.
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

    const eligibleDoc = await assertSaleEligibleForDocumentJournal(saleId, invoiceNo);
    if (!eligibleDoc) return null;

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
      entry_date: localNowDateString(),
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
   * Create reversing journal entry when a finalized sale is cancelled (Phase 4: match create).
   * Reverses: Sales Revenue, Shipping Income (if any), Discount, AR, and COGS/Inventory.
   * Only creates reversal if an original sale journal entry exists.
   */
  async reverseSaleJournalEntry(params: {
    saleId: string;
    companyId: string;
    branchId?: string | null;
    total: number;
    discountAmount?: number;
    shipmentCharges?: number;
    invoiceNo: string;
    performedBy?: string | null;
    /** 0-1 fraction of COGS to reverse (for partial cancel after return). Default 1. */
    cogsMultiplier?: number;
  }): Promise<string | null> {
    const { saleId, companyId, branchId, total, discountAmount = 0, shipmentCharges: _shipmentCharges = 0, invoiceNo, performedBy, cogsMultiplier = 1 } = params;

    if (!saleId || !companyId || total <= 0) return null;

    // Check if a non-void canonical document JE exists (ignore payment-linked rows).
    // If not found, still proceed — the sale was final so the reversal is needed
    // (original JE may have failed to post silently, e.g. studio sales via try-catch).
    const originalDocId = await findActiveCanonicalSaleDocumentJournalEntryId(saleId);
    if (!originalDocId) {
      console.warn(`[saleAccountingService] No canonical sale document JE for sale ${invoiceNo} — creating reversal anyway (sale was final)`);
    }

    const arAccount = await resolveArLineAccountForSale(companyId, saleId);
    const revenueAccount = await ensureRevenueAccount(companyId);

    if (!arAccount?.id || !revenueAccount?.id) {
      console.warn('[saleAccountingService] AR or Sales Revenue account not found — cannot create reversal');
      return null;
    }

    const entryNo = `JE-SALE-REV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const entryDate = localNowDateString();

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
    const extraAmount = await loadSaleExtraServiceIncomeAmount(saleId);
    // Shipping is NON-REFUNDABLE: shipping stays charged to customer even on cancel.
    // Cancel reversal only reverses product revenue + discount + extra service, NOT shipping.
    const merchandiseReversal = Math.round((grossTotal - extraAmount) * 100) / 100;

    const lines: JournalEntryLine[] = [];
    if (merchandiseReversal > 0) {
      const split = await computeProductRevenueCreditSplit(saleId, merchandiseReversal);
      const studioRevAccount = await ensureStudioServiceRevenueAccount(companyId);
      if (split.studioServiceCredit > 0 && studioRevAccount?.id) {
        if (split.merchandiseCredit > 0) {
          lines.push({
            id: '',
            journal_entry_id: '',
            account_id: revenueAccount.id,
            debit: split.merchandiseCredit,
            credit: 0,
            description: `Reversal Sales Revenue (merchandise) – ${invoiceNo}`,
          });
          lines.push({
            id: '',
            journal_entry_id: '',
            account_id: studioRevAccount.id,
            debit: split.studioServiceCredit,
            credit: 0,
            description: `Reversal Studio Service Revenue – ${invoiceNo}`,
          });
        } else {
          lines.push({
            id: '',
            journal_entry_id: '',
            account_id: studioRevAccount.id,
            debit: split.studioServiceCredit,
            credit: 0,
            description: `Reversal Studio Service Revenue – ${invoiceNo}`,
          });
        }
      } else {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: revenueAccount.id,
          debit: merchandiseReversal,
          credit: 0,
          description: `Reversal Sales Revenue – ${invoiceNo}`,
        });
      }
    }
    if (extraAmount > 0) {
      const extraServiceAccount = await ensureExtraServiceIncomeAccount(companyId);
      const extraAcctId = extraServiceAccount?.id ?? revenueAccount.id;
      lines.push({
        id: '',
        journal_entry_id: '',
        account_id: extraAcctId,
        debit: extraAmount,
        credit: 0,
        description: `Reversal Extra Service Income – ${invoiceNo}`,
      });
    }
    // Shipping Income is NOT reversed — shipping is non-refundable (courier already paid).
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

    // Issue 08: Reverse COGS – Dr Inventory (1200), Cr COGS - Inventory (5010)
    // Apply cogsMultiplier to only reverse the un-returned portion (returns already reversed their COGS)
    const fullCogs = await getSaleCogs(saleId);
    const totalCogs = Math.round(fullCogs * cogsMultiplier * 100) / 100;
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
    extra_expenses?: number;
    shipment_charges?: number;
    charges?: { charge_type?: string; amount?: number }[];
  }): { total: number; subtotal: number; discount: number; extraExpense: number; shippingCharges: number } {
    const total = Number(sale?.total ?? sale?.total_amount ?? 0) || 0;
    const charges = Array.isArray(sale?.charges) ? sale.charges : [];
    const discount = Number(sale?.discount_amount ?? 0) || sumCharges(charges, 'discount');
    const shippingFromColumn = Number(sale?.shipment_charges ?? 0) || 0;
    const shippingCharges =
      shippingFromColumn > 0
        ? shippingFromColumn
        : sumCharges(charges, 'shipping');
    const extraFromColumn = Number(sale?.extra_expenses ?? 0) || 0;
    const extraFromCharges = sumCharges(charges, (t) => t !== 'discount' && t !== 'shipping');
    const extraExpense =
      extraFromCharges > 0
        ? extraFromCharges
        : extraFromColumn > 0
          ? extraFromColumn
          : shippingFromColumn > 0
            ? 0
            : Number(sale?.expenses ?? 0) || 0;
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
    customerName?: string;
  }): Promise<{ adjustmentCount: number }> {
    const { companyId, branchId, saleId, invoiceNo, entryDate, createdBy, oldSnapshot, newSnapshot } = params;
    const customerName = params.customerName || 'Customer';
    let adjustmentCount = 0;

    const eligible = await assertSaleEligibleForDocumentJournal(saleId, invoiceNo);
    if (!eligible) return { adjustmentCount: 0 };

    const arAccount = await resolveArLineAccountForSale(companyId, saleId);
    const revenueAccount = await ensureRevenueAccount(companyId);
    const discountAccount = await ensureDiscountAllowedAccount(companyId);
    if (!arAccount?.id || !revenueAccount?.id) return { adjustmentCount };

    const branchIdSafe = branchId && branchId !== 'all' ? branchId : undefined;

    const fmt = (n: number) => Number(n).toLocaleString();
    const dfmt = (n: number) => (n > 0 ? `+Rs ${fmt(n)}` : `-Rs ${fmt(-n)}`);

    // 1) Sales revenue delta (gross = subtotal; change in revenue)
    const oldGross = oldSnapshot.subtotal || oldSnapshot.total + oldSnapshot.discount;
    const newGross = newSnapshot.subtotal || newSnapshot.total + newSnapshot.discount;
    const deltaRevenue = Math.round((newGross - oldGross) * 100) / 100;
    if (deltaRevenue !== 0) {
      const abs = Math.abs(deltaRevenue);
      const desc = `Sale edit ${invoiceNo}: Subtotal Rs ${fmt(oldGross)} → Rs ${fmt(newGross)} (${dfmt(deltaRevenue)}) – ${customerName}`;
      if (deltaRevenue > 0) {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: arAccount.id, debit: abs, credit: 0, description: `AR ${dfmt(deltaRevenue)} – ${invoiceNo}` },
          { accountId: revenueAccount.id, debit: 0, credit: abs, description: `Revenue ${dfmt(deltaRevenue)} – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      } else {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: revenueAccount.id, debit: abs, credit: 0, description: `Revenue ${dfmt(deltaRevenue)} – ${invoiceNo}` },
          { accountId: arAccount.id, debit: 0, credit: abs, description: `AR ${dfmt(deltaRevenue)} – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      }
    }

    // 2) Discount delta — affects AR (customer owes less/more), NOT revenue.
    // Discount increase: Dr Discount Allowed (expense) / Cr AR (reduces customer balance).
    // Discount decrease: Dr AR (customer owes more) / Cr Discount Allowed (reversal).
    const deltaDiscount = Math.round((newSnapshot.discount - oldSnapshot.discount) * 100) / 100;
    if (deltaDiscount !== 0 && discountAccount?.id) {
      const abs = Math.abs(deltaDiscount);
      const desc = `Sale edit ${invoiceNo}: Discount Rs ${fmt(oldSnapshot.discount)} → Rs ${fmt(newSnapshot.discount)} (${dfmt(deltaDiscount)}) – ${customerName}`;
      if (deltaDiscount > 0) {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: discountAccount.id, debit: abs, credit: 0, description: `Discount +Rs ${fmt(abs)} – ${invoiceNo}` },
          { accountId: arAccount.id, debit: 0, credit: abs, description: `AR discount reduce – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      } else {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: arAccount.id, debit: abs, credit: 0, description: `AR discount reversal – ${invoiceNo}` },
          { accountId: discountAccount.id, debit: 0, credit: abs, description: `Discount -Rs ${fmt(abs)} – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      }
    }

    // 3) Extra charges on invoice (stitching, etc.) delta — Cr Extra Service Income (4120), not Sales Revenue
    const deltaExtra = Math.round((newSnapshot.extraExpense - oldSnapshot.extraExpense) * 100) / 100;
    if (deltaExtra !== 0) {
      const abs = Math.abs(deltaExtra);
      const extraIncomeAccount = await ensureExtraServiceIncomeAccount(companyId);
      const creditAccountId = extraIncomeAccount?.id ?? revenueAccount.id;
      const desc = `Sale edit ${invoiceNo}: Extra charges Rs ${fmt(oldSnapshot.extraExpense)} → Rs ${fmt(newSnapshot.extraExpense)} (${dfmt(deltaExtra)}) – ${customerName}`;
      if (deltaExtra > 0) {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: arAccount.id, debit: abs, credit: 0, description: `AR extra ${dfmt(deltaExtra)} – ${invoiceNo}` },
          { accountId: creditAccountId, debit: 0, credit: abs, description: `Extra service income ${dfmt(deltaExtra)} – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      } else {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: creditAccountId, debit: abs, credit: 0, description: `Extra service income reversal ${dfmt(deltaExtra)} – ${invoiceNo}` },
          { accountId: arAccount.id, debit: 0, credit: abs, description: `AR extra reversal ${dfmt(deltaExtra)} – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      }
    }

    // 4) Shipping (charged to customer) delta – Cr Shipping Income (4110), not Sales Revenue
    const deltaShipping = Math.round((newSnapshot.shippingCharges - oldSnapshot.shippingCharges) * 100) / 100;
    if (deltaShipping !== 0) {
      const abs = Math.abs(deltaShipping);
      const shippingIncomeAccount = await ensureShippingIncomeAccount(companyId);
      const creditAccountId = shippingIncomeAccount?.id ?? revenueAccount.id;
      const desc = `Sale edit ${invoiceNo}: Shipping Rs ${fmt(oldSnapshot.shippingCharges)} → Rs ${fmt(newSnapshot.shippingCharges)} (${dfmt(deltaShipping)}) – ${customerName}`;
      if (deltaShipping > 0) {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: arAccount.id, debit: abs, credit: 0, description: `AR shipping ${dfmt(deltaShipping)} – ${invoiceNo}` },
          { accountId: creditAccountId, debit: 0, credit: abs, description: `Shipping income ${dfmt(deltaShipping)} – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      } else {
        await postAdjustmentJE(companyId, branchIdSafe, saleId, entryDate, createdBy, desc, [
          { accountId: creditAccountId, debit: abs, credit: 0, description: `Shipping reversal ${dfmt(deltaShipping)} – ${invoiceNo}` },
          { accountId: arAccount.id, debit: 0, credit: abs, description: `AR shipping reversal ${dfmt(deltaShipping)} – ${invoiceNo}` },
        ]);
        adjustmentCount++;
      }
    }

    return { adjustmentCount };
  },

  /**
   * Post the inventory / COGS reversal JE for a finalized sale return.
   *
   * Standard sale return accounting requires TWO journal entries:
   *   1. Settlement JE  — Dr Sales Revenue / Cr AR or Cash/Bank (handled by AccountingContext.recordSaleReturn)
   *   2. Inventory JE   — Dr Inventory (1200) / Cr COGS - Inventory (5010)  ← THIS function
   *
   * Both must be tagged reference_type='sale_return', reference_id=returnId so that
   * voidSaleReturn can reverse them automatically via createReversalEntry.
   *
   * Idempotent via action_fingerprint = "sale_return_cogs:<companyId>:<returnId>".
   * Safe to call from finalizeSaleReturn without risk of double-posting.
   */
  async createSaleReturnInventoryReversalJE(params: {
    returnId: string;
    companyId: string;
    branchId?: string | null;
    /** Sum of canonicalSaleReturnStockEconomics.totalCost across all return lines. */
    totalCostAmount: number;
    returnNo: string;
    performedBy?: string | null;
  }): Promise<string | null> {
    const { returnId, companyId, branchId, totalCostAmount, returnNo, performedBy } = params;

    if (!returnId || !companyId || totalCostAmount <= 0) {
      console.log('[saleAccountingService] createSaleReturnInventoryReversalJE: skipping (no cost or missing ids)');
      return null;
    }

    const fingerprint = `sale_return_cogs:${companyId}:${returnId}`;

    // Idempotency: skip if this JE was already posted (e.g. retry or double-submit)
    try {
      const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('action_fingerprint', fingerprint)
        .or('is_void.is.null,is_void.eq.false')
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        console.log(`[saleAccountingService] Inventory reversal JE already exists for return ${returnNo}: ${existing.id}`);
        return existing.id as string;
      }
    } catch (e) {
      console.warn('[saleAccountingService] createSaleReturnInventoryReversalJE fingerprint check failed:', e);
    }

    const invAccount = await ensureInventoryAccount(companyId);
    const cogsAccount = await ensureCOGSAccount(companyId);

    if (!invAccount?.id || !cogsAccount?.id) {
      console.warn('[saleAccountingService] createSaleReturnInventoryReversalJE: Inventory or COGS account not found — skipping');
      return null;
    }

    const branchIdSafe = branchId && branchId !== 'all' ? branchId : undefined;
    const entryNo = `JE-RTN-INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const entryDate = localNowDateString();

    const entry: JournalEntry = {
      id: '',
      company_id: companyId,
      branch_id: branchIdSafe,
      entry_no: entryNo,
      entry_date: entryDate,
      description: `Sale Return ${returnNo} – Inventory reversal (cost)`,
      reference_type: 'sale_return',
      reference_id: returnId,
      created_by: performedBy || undefined,
      action_fingerprint: fingerprint,
    };

    const lines: JournalEntryLine[] = [
      {
        id: '',
        journal_entry_id: '',
        account_id: invAccount.id,
        debit: totalCostAmount,
        credit: 0,
        description: `Inventory returned – ${returnNo}`,
      },
      {
        id: '',
        journal_entry_id: '',
        account_id: cogsAccount.id,
        debit: 0,
        credit: totalCostAmount,
        description: `COGS reversal – ${returnNo}`,
      },
    ];

    try {
      const result = await accountingService.createEntry(entry, lines);
      const journalEntryId = (result as any)?.id ?? null;
      console.log(`[saleAccountingService] Inventory reversal JE created for return ${returnNo}: ${journalEntryId}`);
      if (journalEntryId) {
        dispatchAccountingInvalidated({
          companyId,
          branchId: branchId ?? null,
          entityId: returnId,
          reason: 'saleReturnInventoryReversalJe',
        });
      }
      return journalEntryId;
    } catch (err: any) {
      console.error('[saleAccountingService] Failed to create inventory reversal JE for return:', err.message);
      return null;
    }
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

const TRIGGER_JE_POLL_MS = 120;
const TRIGGER_JE_MAX_WAIT_MS = 900;

async function findJournalIdForPayment(paymentId: string): Promise<string | null> {
  const voidFilter = 'is_void.is.null,is_void.eq.false';
  const byPaymentId = await supabase
    .from('journal_entries')
    .select('id')
    .eq('payment_id', paymentId)
    .or(voidFilter)
    .maybeSingle();
  if (byPaymentId.data?.id) return byPaymentId.data.id as string;
  const legacyRpcJe = await supabase
    .from('journal_entries')
    .select('id')
    .eq('reference_type', 'payment')
    .eq('reference_id', paymentId)
    .or(voidFilter)
    .maybeSingle();
  return (legacyRpcJe.data?.id as string) ?? null;
}

async function waitForJournalOnPaymentId(paymentId: string): Promise<string | null> {
  const deadline = Date.now() + TRIGGER_JE_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const id = await findJournalIdForPayment(paymentId);
    if (id) return id;
    await new Promise((r) => setTimeout(r, TRIGGER_JE_POLL_MS));
  }
  return null;
}

/**
 * Idempotent: if DB trigger already created Dr Cash/Bank, Cr AR for this sale payment, returns that JE id.
 * Otherwise creates the same shape as create_payment_journal_entry (reference_type sale + sale id + payment_id).
 */
export async function ensureSalePaymentJournalIfMissing(paymentId: string): Promise<string | null> {
  const { data: pay, error } = await supabase
    .from('payments')
    .select('id, company_id, branch_id, reference_type, reference_id, amount, payment_account_id, payment_date')
    .eq('id', paymentId)
    .maybeSingle();
  if (error || !pay) return null;
  const p = pay as {
    company_id: string;
    branch_id: string | null;
    reference_type: string | null;
    reference_id: string | null;
    amount: number | null;
    payment_account_id: string | null;
    payment_date: string | null;
  };
  if (String(p.reference_type || '').toLowerCase() !== 'sale' || !p.reference_id) return null;

  const existingId = await findJournalIdForPayment(paymentId);
  if (existingId) return existingId;

  const { data: saleRow } = await supabase
    .from('sales')
    .select('invoice_no, customer_id')
    .eq('id', p.reference_id)
    .maybeSingle();
  const arId =
    (await resolveReceivablePostingAccountId(
      p.company_id,
      (saleRow as { customer_id?: string | null } | null)?.customer_id ?? undefined
    )) || (await ensureARAccount(p.company_id))?.id;
  const arAccount = arId ? { id: arId } : null;
  if (!arAccount?.id || !p.payment_account_id) {
    console.error('[saleAccountingService] ensureSalePaymentJournalIfMissing: missing AR (1100) or payment_account_id', paymentId);
    return null;
  }

  const sale = saleRow;
  const inv = String((sale as { invoice_no?: string } | null)?.invoice_no || '').trim();

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;

  const entryDate = p.payment_date ? String(p.payment_date).slice(0, 10) : localNowDateString();
  const entryNo = `JE-PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const amt = Math.round((Number(p.amount) || 0) * 100) / 100;
  if (amt <= 0) return null;

  const entry: JournalEntry = {
    id: '',
    company_id: p.company_id,
    branch_id: p.branch_id || undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: `Payment received${inv ? ` – ${inv}` : ''}`,
    reference_type: 'sale',
    reference_id: p.reference_id,
    created_by: uid || undefined,
  };
  const lines: JournalEntryLine[] = [
    {
      id: '',
      journal_entry_id: '',
      account_id: p.payment_account_id,
      debit: amt,
      credit: 0,
      description: `Payment received - ${inv || 'invoice'}`,
    },
    {
      id: '',
      journal_entry_id: '',
      account_id: arAccount.id,
      debit: 0,
      credit: amt,
      description: `Payment received - ${inv || 'invoice'}`,
    },
  ];
  const saved = await accountingService.createEntry(entry, lines, paymentId);
  return (saved as { id: string }).id;
}

/**
 * After trigger (or app) creates a payment JE, patch the AR line from parent 1100
 * to the customer's sub-ledger account (AR-CUS0001 etc.) if one exists.
 * The DB trigger hardcodes 1100; this corrects it so the customer ledger is accurate.
 */
export async function patchPaymentJeToSubLedger(paymentId: string, jeId: string): Promise<void> {
  try {
    const { data: pay } = await supabase
      .from('payments')
      .select('company_id, reference_type, reference_id, contact_id')
      .eq('id', paymentId)
      .maybeSingle();
    if (!pay) return;
    const companyId = (pay as any).company_id as string;
    if (!companyId) return;

    // Resolve customer: try contact_id first (manual_receipt/on_account), then sale.customer_id
    let customerId = (pay as any).contact_id as string | null;
    if (!customerId) {
      const rt = String((pay as any).reference_type || '').toLowerCase();
      const refId = (pay as any).reference_id as string | null;
      if (rt === 'sale' && refId) {
        const { data: sale } = await supabase.from('sales').select('customer_id').eq('id', refId).maybeSingle();
        customerId = (sale as any)?.customer_id ?? null;
      }
    }
    if (!customerId) return;

    const subLedgerId = await resolveReceivablePostingAccountId(companyId, customerId);
    if (!subLedgerId) return;

    // Get parent AR (1100) account ID
    const parentAr = await ensureARAccount(companyId);
    if (!parentAr?.id || subLedgerId === parentAr.id) return;

    // Patch: replace parent 1100 with sub-ledger on the credit line
    await supabase
      .from('journal_entry_lines')
      .update({ account_id: subLedgerId })
      .eq('journal_entry_id', jeId)
      .eq('account_id', parentAr.id);
  } catch (e) {
    console.warn('[saleAccountingService] patchPaymentJeToSubLedger failed (non-critical):', e);
  }
}

/** After insert of a sale payment row: wait for trigger, else app-side JE (avoids PAYMENT_WITHOUT_JE if trigger is off). */
export async function ensureSalePaymentJournalAfterInsert(paymentId: string): Promise<string | null> {
  let jeId = await waitForJournalOnPaymentId(paymentId);
  if (!jeId) jeId = await ensureSalePaymentJournalIfMissing(paymentId);
  if (jeId) await patchPaymentJeToSubLedger(paymentId, jeId);
  return jeId;
}

/**
 * Customer on-account (payments.reference_type = on_account): Dr payment account, Cr AR; JE reference_type payment, reference_id = payment id.
 */
export async function ensureOnAccountCustomerJournalIfMissing(
  paymentId: string,
  customerDisplayName: string
): Promise<string | null> {
  const { data: pay, error } = await supabase
    .from('payments')
    .select('id, company_id, branch_id, reference_type, contact_id, amount, payment_account_id, payment_date')
    .eq('id', paymentId)
    .maybeSingle();
  if (error || !pay) return null;
  const p = pay as {
    company_id: string;
    branch_id: string | null;
    reference_type: string | null;
    contact_id: string | null;
    amount: number | null;
    payment_account_id: string | null;
    payment_date: string | null;
  };
  if (String(p.reference_type || '').toLowerCase() !== 'on_account') return null;
  if (!p.contact_id || !p.payment_account_id) return null;

  const { data: existing } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('payment_id', paymentId)
    .or('is_void.is.null,is_void.eq.false')
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const arId =
    (await resolveReceivablePostingAccountId(p.company_id, p.contact_id || undefined)) ||
    (await ensureARAccount(p.company_id))?.id;
  const arAccount = arId ? { id: arId } : null;
  if (!arAccount?.id) return null;

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  const entryDate = p.payment_date ? String(p.payment_date).slice(0, 10) : localNowDateString();
  const entryNo = `JE-OA-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const amt = Math.round((Number(p.amount) || 0) * 100) / 100;
  if (amt <= 0) return null;

  const desc = `On-account payment from ${customerDisplayName || 'customer'}`;
  const entry: JournalEntry = {
    id: '',
    company_id: p.company_id,
    branch_id: p.branch_id || undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: desc,
    reference_type: 'payment',
    reference_id: paymentId,
    created_by: uid || undefined,
  };
  const lines: JournalEntryLine[] = [
    { id: '', journal_entry_id: '', account_id: p.payment_account_id, debit: amt, credit: 0, description: desc },
    { id: '', journal_entry_id: '', account_id: arAccount.id, debit: 0, credit: amt, description: desc },
  ];
  const saved = await accountingService.createEntry(entry, lines, paymentId);
  return (saved as { id: string }).id;
}
