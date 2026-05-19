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

/** Roles eligible for Salary expense payee (mirrors web `userService.getUsersForSalary`). Workers are excluded. */
const SALARY_EXPENSE_ROLES = ['admin', 'manager', 'staff', 'salesman', 'operator', 'cashier', 'inventory'] as const;

export interface SalaryUserRow {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
}

/**
 * Active users who may receive salary via Expenses (not production workers).
 */
export async function getUsersForSalary(companyId: string): Promise<{ data: SalaryUserRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, role, email, is_active')
    .eq('company_id', companyId);

  if (error) return { data: [], error: error.message };

  type Row = { id: string; full_name?: string | null; role?: string | null; email?: string | null; is_active?: boolean };
  const active = (users || []).filter((u) => (u as Row).is_active !== false);
  const roleOk = (r: string) => (SALARY_EXPENSE_ROLES as readonly string[]).includes(r);
  const filtered = active.filter((u) => {
    const role = String((u as Row).role ?? '').toLowerCase();
    return roleOk(role);
  });

  const data: SalaryUserRow[] = filtered.map((u) => {
    const r = u as Row;
    return {
      id: String(r.id),
      full_name: String(r.full_name ?? '—'),
      email: r.email ?? null,
      role: r.role ?? null,
    };
  });

  return { data, error: null };
}

export interface CreateUserWithAuthParams {
  email: string;
  full_name: string;
  role: string;
  company_id: string;
  phone?: string;
  temporary_password?: string;
  send_invite_email?: boolean;
  branch_ids?: string[];
  default_branch_id?: string;
  is_active?: boolean;
}

/**
 * Same as web `userService.createUserWithAuth`: Edge Function `create-erp-user`.
 */
export async function createUserWithAuth(
  params: CreateUserWithAuthParams
): Promise<{ data: { user_id?: string; success?: boolean } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { data: null, error: 'Not authenticated. Please log in to create users.' };

  const { data, error } = await supabase.functions.invoke('create-erp-user', {
    body: params,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    const ctx = error as { message?: string; context?: { body?: string } };
    let msg = ctx.message || 'Edge function failed';
    try {
      const b = ctx.context?.body;
      if (b) {
        const j = JSON.parse(b) as { error?: string; message?: string };
        msg = j.error || j.message || msg;
      }
    } catch {
      /* ignore */
    }
    return { data: null, error: msg };
  }

  const result = data as {
    success?: boolean;
    error?: string;
    user_id?: string;
  };
  if (!result?.success) return { data: null, error: result?.error || 'Failed to create user' };
  return { data: result, error: null };
}
