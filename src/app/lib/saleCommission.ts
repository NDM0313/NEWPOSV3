/**
 * Sale-level commission capture (pending until Commission Report batch post).
 */
import { supabase } from '@/lib/supabase';
import { canAssignSaleCommission } from '@/app/lib/executiveDashboardAccess';

export type SaleCommissionPatch = {
  salesman_id: string | null;
  commission_percent: number | null;
  commission_amount: number;
  commission_eligible_amount: number;
  commission_status: string | null;
};

async function loadDefaultCommissionPercent(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('users')
    .select('default_commission_percent')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const pct = Number((data as { default_commission_percent?: number | null }).default_commission_percent);
  return Number.isFinite(pct) ? pct : null;
}

export async function resolveSaleCommissionFields(params: {
  profileUserId?: string | null;
  subtotal: number;
  actorRole?: string | null;
  explicitSalesmanId?: string | null;
  explicitCommissionPercent?: number | null;
}): Promise<SaleCommissionPatch | null> {
  const subtotal = Math.max(0, Number(params.subtotal) || 0);
  const canAssign = canAssignSaleCommission(params.actorRole);

  let salesmanId: string | null = null;
  let percent: number | null = null;

  if (canAssign) {
    const explicit = params.explicitSalesmanId?.trim();
    if (!explicit || explicit === 'none' || explicit === '1') return null;
    salesmanId = explicit;
    percent =
      params.explicitCommissionPercent != null && Number.isFinite(Number(params.explicitCommissionPercent))
        ? Number(params.explicitCommissionPercent)
        : await loadDefaultCommissionPercent(salesmanId);
  } else {
    const profileId = params.profileUserId?.trim();
    if (!profileId) return null;
    salesmanId = profileId;
    percent = await loadDefaultCommissionPercent(profileId);
  }

  if (!salesmanId) return null;

  const pct = percent != null && Number.isFinite(percent) ? Math.max(0, percent) : 0;
  const amount = pct > 0 ? Math.round(subtotal * (pct / 100) * 100) / 100 : 0;

  return {
    salesman_id: salesmanId,
    commission_percent: pct > 0 ? pct : null,
    commission_amount: amount,
    commission_eligible_amount: subtotal,
    commission_status: amount > 0 ? 'pending' : null,
  };
}

export async function applySaleCommissionPatch(
  saleId: string,
  patch: SaleCommissionPatch | null,
): Promise<string | null> {
  if (!patch || !patch.salesman_id) return null;
  const { error } = await supabase.from('sales').update(patch).eq('id', saleId);
  return error?.message ?? null;
}
