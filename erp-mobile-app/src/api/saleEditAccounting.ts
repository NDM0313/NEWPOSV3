/**
 * After mobile sale save: update the **canonical sale document** journal entry in place
 * (same contract as web `SalesContext` PF-14 v2 — no extra `sale_adjustment` rows).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SaleAcctSnapshot = {
  total: number;
  subtotal: number;
  discount: number;
  extraExpense: number;
  shippingCharges: number;
};

export type SaleLedgerSyncSkipReason =
  | 'not_configured'
  | 'snap_unchanged'
  | 'no_document_je'
  | 'sale_row_missing'
  | 'sale_not_final'
  | 'no_invoice_no'
  | 'missing_ar_account';

export type SaleLedgerSyncResult = {
  updated: boolean;
  error: string | null;
  skipReason?: SaleLedgerSyncSkipReason;
};

/** Match web `getSaleAccountingSnapshot` for list/detail `sales` rows (no sale_charges array on mobile). */
export function saleAccountingSnapshotFromRow(sale: Record<string, unknown>): SaleAcctSnapshot {
  const total = Number(sale.total ?? sale.total_amount ?? 0) || 0;
  const discount = Number(sale.discount_amount ?? 0) || 0;
  const shippingCharges = Number(sale.shipment_charges ?? 0) || 0;
  const extraExpense = Number(sale.extra_expenses ?? 0) || 0;
  const subtotal = Number(sale.subtotal ?? 0) || total + discount;
  return { total, subtotal, discount, extraExpense, shippingCharges };
}

async function accountIdByCode(companyId: string, code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function resolveArAccountId(companyId: string, customerId: string | null | undefined): Promise<string | null> {
  const control = await accountIdByCode(companyId, '1100');
  if (!control) return null;
  if (!customerId) return control;
  const { data: sub } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('linked_contact_id', customerId)
    .eq('parent_id', control)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return (sub as { id?: string } | null)?.id ?? control;
}

/** Same weights as web `saleAccountingService.computeProductRevenueCreditSplit` (mobile bundle cannot import web services). */
async function computeProductRevenueCreditSplitMobile(
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

async function findCanonicalSaleDocumentJe(companyId: string, saleId: string): Promise<{ id: string; description: string } | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, description, is_void')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .is('payment_id', null)
    .order('created_at', { ascending: true })
    .limit(8);
  if (error || !data?.length) return null;
  const rows = data as { id: string; description: string | null; is_void?: boolean | null }[];
  const active = rows.find((r) => r.is_void !== true);
  if (!active) return null;
  return { id: active.id, description: active.description || '' };
}

/**
 * In-place update of the original `reference_type = 'sale'` document JE lines + description edit tag.
 * No-op when there is no document JE, snapshots are unchanged, or sale row is missing.
 */
export async function syncSaleDocumentJournalInPlaceMobile(params: {
  companyId: string;
  saleId: string;
  customerId: string | null | undefined;
  invoiceNo: string;
  oldSnapshot: SaleAcctSnapshot;
  newSnapshot: SaleAcctSnapshot;
}): Promise<SaleLedgerSyncResult> {
  if (!isSupabaseConfigured || !params.companyId) {
    return { updated: false, error: null, skipReason: 'not_configured' };
  }

  const { companyId, saleId, customerId, invoiceNo, oldSnapshot, newSnapshot } = params;

  const snapSame =
    oldSnapshot.total === newSnapshot.total &&
    oldSnapshot.subtotal === newSnapshot.subtotal &&
    oldSnapshot.discount === newSnapshot.discount &&
    oldSnapshot.extraExpense === newSnapshot.extraExpense &&
    oldSnapshot.shippingCharges === newSnapshot.shippingCharges;
  if (snapSame) return { updated: false, error: null, skipReason: 'snap_unchanged' };

  const docJe = await findCanonicalSaleDocumentJe(companyId, saleId);
  if (!docJe) return { updated: false, error: null, skipReason: 'no_document_je' };

  const { data: saleRow, error: saleErr } = await supabase
    .from('sales')
    .select('id, status, invoice_no, order_no')
    .eq('id', saleId)
    .maybeSingle();
  if (saleErr || !saleRow) return { updated: false, error: null, skipReason: 'sale_row_missing' };

  const status = String((saleRow as { status?: string }).status || '').toLowerCase();
  if (status !== 'final') return { updated: false, error: null, skipReason: 'sale_not_final' };

  const rowInv = saleRow as { invoice_no?: string | null; order_no?: string | null };
  const inv = String(rowInv.invoice_no ?? rowInv.order_no ?? invoiceNo ?? '').trim();
  if (!inv) return { updated: false, error: null, skipReason: 'no_invoice_no' };

  const jeId = docJe.id;

  try {
    let arAccountId = await resolveArAccountId(companyId, customerId);
    if (!arAccountId) return { updated: false, error: null, skipReason: 'missing_ar_account' };

    const getAccId = async (code: string) => accountIdByCode(companyId, code);
    const merchandiseRevenueId = (await getAccId('4000')) || (await getAccId('4100'));
    const studioRevenueId = await getAccId('4010');
    const discountId = await getAccId('5200');
    const shippingIncomeId = await getAccId('4110');
    const cogs5010 = await getAccId('5010');
    const cogs5000 = await getAccId('5000');
    const inventoryId = await getAccId('1200');
    const ar1100 = await getAccId('1100');

    const newTotal = newSnapshot.total;
    const newGross = newSnapshot.subtotal || newTotal + newSnapshot.discount;
    const newDiscount = newSnapshot.discount;
    const newShipping = newSnapshot.shippingCharges || 0;
    const newRevenue = newGross - newShipping;
    const revenueSplit = await computeProductRevenueCreditSplitMobile(saleId, Math.max(0, newRevenue));

    const { data: jeLines } = await supabase.from('journal_entry_lines').select('id, account_id, debit, credit').eq('journal_entry_id', jeId);
    const lineRows = (jeLines || []) as { id: string; account_id: string; debit: number; credit: number }[];

    // Party GL (get_contact_party_gl_balances) includes AR subtree; Dr must stay on AR-* when that line exists.
    // Legacy JEs may only have Dr on 1100 — then update 1100, not both.
    let arTargetId = arAccountId;
    if (customerId && ar1100 && arAccountId && arAccountId !== ar1100) {
      const hasSubLine = lineRows.some((l) => l.account_id === arAccountId);
      if (!hasSubLine) arTargetId = ar1100;
    }

    for (const line of lineRows) {
      const accId = line.account_id;
      let newDebit = 0;
      let newCredit = 0;
      let didMatch = false;

      if (accId === arTargetId) {
        newDebit = newTotal;
        newCredit = 0;
        didMatch = true;
      } else if (merchandiseRevenueId && accId === merchandiseRevenueId) {
        newDebit = 0;
        newCredit = revenueSplit.merchandiseCredit;
        didMatch = true;
      } else if (studioRevenueId && accId === studioRevenueId) {
        newDebit = 0;
        newCredit = revenueSplit.studioServiceCredit;
        didMatch = true;
      } else if (discountId && accId === discountId && newDiscount > 0) {
        newDebit = newDiscount;
        newCredit = 0;
        didMatch = true;
      } else if (shippingIncomeId && accId === shippingIncomeId) {
        newDebit = 0;
        newCredit = newShipping;
        didMatch = true;
      } else if (
        ((cogs5010 && accId === cogs5010) || (cogs5000 && accId === cogs5000)) &&
        line.debit > 0
      ) {
        const { data: saleItems } = await supabase.from('sales_items').select('product_id, quantity').eq('sale_id', saleId);
        let totalCogs = 0;
        for (const si of (saleItems || []) as { product_id: string; quantity: number }[]) {
          const qty = Number(si.quantity) || 0;
          const { data: movements } = await supabase
            .from('stock_movements')
            .select('quantity, unit_cost, total_cost')
            .eq('product_id', si.product_id)
            .eq('company_id', companyId)
            .in('movement_type', ['purchase', 'opening_stock']);
          let costSum = 0;
          let costQty = 0;
          for (const m of (movements || []) as { quantity?: number; unit_cost?: number; total_cost?: number }[]) {
            costQty += Math.abs(Number(m.quantity) || 0);
            costSum += Math.abs(Number(m.total_cost) || Math.abs(Number(m.quantity) || 0) * (Number(m.unit_cost) || 0));
          }
          const avgCost = costQty > 0 ? costSum / costQty : 0;
          totalCogs += qty * avgCost;
        }
        newDebit = Math.round(totalCogs * 100) / 100;
        newCredit = 0;
        didMatch = true;
      } else if (inventoryId && accId === inventoryId && line.credit > 0) {
        continue;
      } else {
        continue;
      }

      if (didMatch) {
        await supabase.from('journal_entry_lines').update({ debit: newDebit, credit: newCredit }).eq('id', line.id);
      }
    }

    const cogsIds = [cogs5010, cogs5000].filter(Boolean) as string[];
    if (cogsIds.length > 0 && inventoryId) {
      const { data: cogsRows } = await supabase
        .from('journal_entry_lines')
        .select('debit')
        .eq('journal_entry_id', jeId)
        .in('account_id', cogsIds)
        .gt('debit', 0)
        .limit(1);
      const cogsDebit = cogsRows?.[0] ? Number((cogsRows[0] as { debit?: number }).debit) : 0;
      if (cogsDebit > 0) {
        await supabase
          .from('journal_entry_lines')
          .update({ credit: cogsDebit })
          .eq('journal_entry_id', jeId)
          .eq('account_id', inventoryId);
      }
    }

    if (newDiscount > 0 && discountId) {
      const { data: discLine } = await supabase.from('journal_entry_lines').select('id').eq('journal_entry_id', jeId).eq('account_id', discountId).maybeSingle();
      if (!discLine) {
        await supabase.from('journal_entry_lines').insert({
          journal_entry_id: jeId,
          account_id: discountId,
          debit: newDiscount,
          credit: 0,
          description: `Discount – ${inv}`,
        });
      }
    }

    const ts = new Date().toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
    const oldTotal = oldSnapshot.total;
    const editLog = `[Edited ${ts}: Total Rs ${oldTotal.toLocaleString()} → Rs ${newTotal.toLocaleString()}]`;
    const baseDesc = (docJe.description || '').replace(/\s*\[Edited[^\]]*\]/g, '').trim();
    await supabase.from('journal_entries').update({ description: `${baseDesc} ${editLog}`.slice(0, 500) }).eq('id', jeId);

    return { updated: true, error: null };
  } catch (e) {
    return { updated: false, error: (e as Error)?.message ?? String(e), skipReason: undefined };
  }
}
