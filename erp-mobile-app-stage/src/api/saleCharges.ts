/**

 * Sale line charges (extra expenses, shipping) — 4120 package split parity.

 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

import type { ExtraExpense } from '../types/saleExtras';

import { sumExtraExpenses, validateInclusiveExtraChargeCap } from '../lib/saleTotals';



import {
  formatSaleChargeDisplayLabel,
  formatSaleChargeLabel,
  type SaleChargeForDisplay,
} from '../lib/saleChargeDisplay';

export { formatSaleChargeDisplayLabel, formatSaleChargeLabel };

export type SaleChargeDisplayRow = SaleChargeForDisplay & {
  id?: string;
  charge_type: string;
  amount: number;
};

/** Line-level sale_charges for detail / receipt (parity with web ViewSaleDetailsDrawer). */
export async function getSaleChargesBySaleId(
  saleId: string,
): Promise<{ data: SaleChargeDisplayRow[]; error: string | null }> {
  if (!isSupabaseConfigured || !saleId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('sale_charges')
    .select(
      'id, charge_type, amount, expense_category_id, tailor_contact_id, expense_category:expense_categories(name), tailor:contacts(name)',
    )
    .eq('sale_id', saleId)
    .order('charge_type');
  if (error) {
    const fallback = await supabase
      .from('sale_charges')
      .select('id, charge_type, amount, expense_category_id, tailor_contact_id')
      .eq('sale_id', saleId)
      .order('charge_type');
    if (fallback.error) return { data: [], error: fallback.error.message };
    return {
      data: (fallback.data || []).map((row) => mapSaleChargeRow(row as Record<string, unknown>)),
      error: null,
    };
  }
  return {
    data: (data || []).map((row) => mapSaleChargeRow(row as Record<string, unknown>)),
    error: null,
  };
}

function mapSaleChargeRow(row: Record<string, unknown>): SaleChargeDisplayRow {
  const ec = row.expense_category as { name?: string } | null | undefined;
  const tailor = row.tailor as { name?: string } | null | undefined;
  return {
    id: row.id as string | undefined,
    charge_type: String(row.charge_type || 'other'),
    amount: Number(row.amount) || 0,
    expense_category_id: (row.expense_category_id as string) ?? null,
    tailor_contact_id: (row.tailor_contact_id as string) ?? null,
    expense_category: ec ?? null,
    tailor: tailor ?? null,
  };
}

export type SaleChargeRow = {

  charge_type: string;

  amount: number;

  ledger_account_id?: string | null;

  charged_to_customer?: boolean;

  tailor_contact_id?: string | null;

  expense_category_id?: string | null;

};



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



/** Extra Service Income (4120) — tracking/clearing node per frozen COA. */

export async function resolveExtraServiceIncomeAccountId(companyId: string): Promise<string | null> {

  if (!isSupabaseConfigured || !companyId) return null;

  const existing = await accountIdByCode(companyId, '4120');

  if (existing) return existing;

  const parent = await accountIdByCode(companyId, '4050');

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

        ...(parent ? { parent_id: parent } : {}),

      })

      .select('id')

      .single();

    if (!error && data?.id) return (data as { id: string }).id;

  } catch (e) {

    console.warn('[saleCharges] Could not auto-create account 4120:', e);

  }

  return null;

}



export async function replaceSaleCharges(

  saleId: string,

  charges: SaleChargeRow[],

  createdBy?: string | null,

): Promise<{ error: string | null }> {

  if (!isSupabaseConfigured) return { error: 'App not configured.' };

  const { error: delError } = await supabase.from('sale_charges').delete().eq('sale_id', saleId);

  if (delError) return { error: delError.message };



  const chargeRows = (charges || [])

    .filter((c) => Number(c.amount) > 0)

    .map((c) => {

      const row: Record<string, unknown> = {

        sale_id: saleId,

        charge_type: c.charge_type,

        ledger_account_id: c.ledger_account_id ?? null,

        amount: Number(c.amount),

        created_by: createdBy ?? null,

      };

      if (c.charged_to_customer !== undefined) {

        row.charged_to_customer = c.charged_to_customer;

      }

      if (c.tailor_contact_id) {

        row.tailor_contact_id = c.tailor_contact_id;

      }

      if (c.expense_category_id) {

        row.expense_category_id = c.expense_category_id;

      }

      return row;

    });



  if (chargeRows.length === 0) return { error: null };



  const { error: insError } = await supabase.from('sale_charges').insert(chargeRows);

  if (insError) {

    const msg = String(insError.message || '');

    if (
      insError.code === '42703' ||
      msg.includes('charged_to_customer') ||
      msg.includes('tailor_contact') ||
      msg.includes('expense_category')
    ) {

      const fallback = chargeRows.map((r) => {

        const {
          charged_to_customer: _c,
          tailor_contact_id: _t,
          expense_category_id: _e,
          ...rest
        } = r;

        return rest;

      });

      const { error: retry } = await supabase.from('sale_charges').insert(fallback);

      if (retry) return { error: retry.message };

      return { error: null };

    }

    return { error: insError.message };

  }

  return { error: null };

}



export async function persistSaleChargesAfterCreate(params: {

  saleId: string;

  companyId: string;

  userId?: string | null;

  extraExpenses?: ExtraExpense[];

  shippingCharge?: number;

  discountAmount?: number;

  /** When true (default), extras on customer bill; when false, package-inclusive only. */

  chargeExtrasToCustomer?: boolean;

  /** Customer invoice total (for 25% inclusive validation). */

  saleTotal?: number;

  /** @deprecated use chargeExtrasToCustomer */

  excludeExtraExpensesFromCustomerBill?: boolean;

}): Promise<{ error: string | null }> {

  if (!isSupabaseConfigured) return { error: 'App not configured.' };



  const chargeOnBill =

    params.chargeExtrasToCustomer ??

    (params.excludeExtraExpensesFromCustomerBill === true ? false : true);



  const cap = validateInclusiveExtraChargeCap({

    invoiceTotal: Number(params.saleTotal) || 0,

    shippingCharge: params.shippingCharge,

    extraExpenses: params.extraExpenses,

    chargeExtrasToCustomer: chargeOnBill,

  });

  if (!cap.ok) return { error: cap.error };



  const extraSumCharged = chargeOnBill ? sumExtraExpenses(params.extraExpenses) : 0;

  const shipping = Number(params.shippingCharge) || 0;

  const discount = Number(params.discountAmount) || 0;

  const hasExtras = (params.extraExpenses ?? []).some((e) => Number(e.amount) > 0);

  const hasCharges = hasExtras || shipping > 0 || discount > 0;



  if (!hasCharges) {

    return { error: null };

  }



  const extraLedgerAccountId = hasExtras

    ? await resolveExtraServiceIncomeAccountId(params.companyId)

    : null;



  const charges: SaleChargeRow[] = [];

  for (const e of params.extraExpenses ?? []) {

    const amt = Number(e.amount) || 0;

    if (amt > 0) {

      charges.push({

        charge_type: e.type ?? 'other',

        amount: amt,

        ledger_account_id: extraLedgerAccountId,

        charged_to_customer: chargeOnBill,

        tailor_contact_id: e.tailorContactId ?? null,

        expense_category_id: e.tailorExpenseCategoryId ?? null,

      });

    }

  }

  if (shipping > 0) {

    charges.push({ charge_type: 'shipping', amount: shipping, charged_to_customer: true });

  }

  if (discount > 0) {

    charges.push({ charge_type: 'discount', amount: discount, charged_to_customer: true });

  }



  const replaceErr = await replaceSaleCharges(params.saleId, charges, params.userId ?? null);

  if (replaceErr.error) return replaceErr;



  const { error: updErr } = await supabase

    .from('sales')

    .update({

      extra_expenses: extraSumCharged,

      shipment_charges: shipping,

      expenses: 0,

    })

    .eq('id', params.saleId);



  if (updErr) {

    const msg = String(updErr.message || '');

    if (updErr.code === '42703' || msg.includes('extra_expenses') || msg.includes('shipment_charges')) {

      const fallback: Record<string, unknown> = { expenses: 0 };

      if (!msg.includes('extra_expenses')) fallback.extra_expenses = extraSumCharged;

      if (!msg.includes('shipment_charges')) fallback.shipment_charges = shipping;

      const { error: retry } = await supabase.from('sales').update(fallback).eq('id', params.saleId);

      if (retry) return { error: retry.message };

      return { error: null };

    }

    return { error: updErr.message };

  }



  return { error: null };

}


