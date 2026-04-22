import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SalesmanRow {
  id: string;
  name: string;
  role: string | null;
  /** Default commission % for sales (from users.default_commission_percent or employees.commission_rate). */
  defaultCommissionPercent: number | null;
  /** Default commission % for rentals (from users.rental_commission_percent), falls back to defaultCommissionPercent on the consumer side. */
  rentalCommissionPercent: number | null;
}

/**
 * Load users who can be assigned as a salesman (mirrors web userService.getSalesmen).
 * Fallback: if the `permissions` column is empty/missing, returns active users with
 * salesman-like roles.
 */
export async function getSalesmen(companyId: string): Promise<{ data: SalesmanRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, role, permissions, default_commission_percent, rental_commission_percent, is_active')
    .eq('company_id', companyId);

  if (error) return { data: [], error: error.message };

  type UserRow = {
    id: string;
    full_name?: string | null;
    role?: string | null;
    permissions?: Record<string, unknown> | null;
    default_commission_percent?: number | null;
    rental_commission_percent?: number | null;
    is_active?: boolean;
  };

  const activeUsers = (users || []).filter((u) => (u as UserRow).is_active !== false);
  const filtered = activeUsers.filter((u) => {
    const row = u as UserRow;
    const perms = (row.permissions ?? {}) as Record<string, unknown>;
    if (perms.canBeAssignedAsSalesman === true) return true;
    if ((perms as { sales?: { canBeAssignedAsSalesman?: boolean } }).sales?.canBeAssignedAsSalesman === true) return true;
    const role = String(row.role ?? '').toLowerCase();
    return ['salesman', 'cashier', 'manager', 'admin', 'owner'].includes(role);
  });

  const ids = filtered.map((u) => String((u as UserRow).id));
  const commissionByUser = new Map<string, number>();
  if (ids.length > 0) {
    const { data: emps } = await supabase
      .from('employees')
      .select('user_id, commission_rate')
      .in('user_id', ids);
    (emps || []).forEach((e) => {
      const row = e as { user_id?: string | null; commission_rate?: number | null };
      if (row.user_id && row.commission_rate != null) {
        commissionByUser.set(String(row.user_id), Number(row.commission_rate));
      }
    });
  }

  const data: SalesmanRow[] = filtered.map((u) => {
    const row = u as UserRow;
    const def =
      row.default_commission_percent != null
        ? Number(row.default_commission_percent)
        : commissionByUser.get(String(row.id)) ?? null;
    return {
      id: String(row.id),
      name: String(row.full_name ?? '—'),
      role: row.role ?? null,
      defaultCommissionPercent: def,
      rentalCommissionPercent:
        row.rental_commission_percent != null ? Number(row.rental_commission_percent) : null,
    };
  });

  return { data, error: null };
}
