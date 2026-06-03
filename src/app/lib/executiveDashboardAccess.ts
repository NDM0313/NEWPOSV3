/** Executive financial dashboard (GL roll-ups, cash/bank, company AR/AP) — admin and owner only. */

function normalizeErpRole(role: string | null | undefined): string {
  const r = (role ?? '').toLowerCase().trim();
  if (r === 'owner') return 'owner';
  if (r === 'admin' || r === 'super admin' || r === 'superadmin') return 'admin';
  return r;
}

export function canViewExecutiveDashboard(role: string | null | undefined): boolean {
  const r = normalizeErpRole(role);
  return r === 'owner' || r === 'admin';
}

/** Salesman + commission on invoice — admin/owner only; workers auto-assigned. */
export function canAssignSaleCommission(role: string | null | undefined): boolean {
  return canViewExecutiveDashboard(role);
}
