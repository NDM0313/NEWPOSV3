/**
 * Wholesale import purchase: async helpers (Supabase).
 */
import { supabase } from '@/lib/supabase';

export type {
  FreightSettlement,
  WholesalePurchaseRow,
} from './wholesaleImportPurchaseCalc';

export {
  getFreightSettlement,
  isWholesaleImportClearance,
  purchaseSupplierPayableBase,
  purchaseSupplierDue,
  purchaseClearanceAmount,
  isCourierFreightChargeType,
} from './wholesaleImportPurchaseCalc';

/** Resolve or create courier payable (2031…) for clearance posting. */
export async function resolveCourierPayableForPurchase(
  companyId: string,
  clearanceCourierId: string,
  courierName?: string | null
): Promise<string | null> {
  if (!companyId || !clearanceCourierId) return null;
  let name = courierName?.trim() || '';
  if (!name) {
    const { data } = await supabase
      .from('contacts')
      .select('name')
      .eq('id', clearanceCourierId)
      .maybeSingle();
    name = String((data as { name?: string } | null)?.name ?? 'Courier');
  }
  const { data, error } = await supabase.rpc('get_or_create_courier_payable_account', {
    p_company_id: companyId,
    p_contact_id: clearanceCourierId,
    p_contact_name: name,
  });
  if (error) {
    console.warn('[wholesaleImportPurchase] get_or_create_courier_payable_account:', error.message);
    return null;
  }
  return (data as string | null) ?? null;
}
