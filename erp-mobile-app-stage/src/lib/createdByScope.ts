/** Filter queries to rows created by the active worker (auth uid and/or profile id). */

export function applyCreatedByScope(query: any, authUserId: string, profileId?: string | null): any {
  const uid = authUserId?.trim();
  if (!uid) return query;
  const pid = profileId?.trim();
  if (pid && pid !== uid) {
    return query.or(`created_by.eq.${uid},created_by.eq.${pid}`);
  }
  return query.eq('created_by', uid);
}

export function applySalesBranchFilter(query: any, branchId?: string | null): any {
  if (branchId && branchId !== 'all' && branchId !== 'default') {
    return query.eq('branch_id', branchId);
  }
  return query;
}

/** End-of-local-day bound for timestamptz date columns (YYYY-MM-DD). */
export function dateRangeEndIso(ymd: string): string {
  return `${ymd}T23:59:59.999`;
}
