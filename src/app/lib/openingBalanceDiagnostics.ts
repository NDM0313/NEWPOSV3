/**
 * Opening balance gap diagnostics (Phase E preview) — read-only, no sync apply.
 */

export type OpeningBalanceEntityType = 'contact_ar' | 'contact_ap' | 'contact_worker';

export type OpeningBalanceGapStatus =
  | 'synced'
  | 'missing_je'
  | 'amount_mismatch'
  | 'orphan_je'
  | 'no_opening';

export interface OpeningBalanceGapRow {
  rowId: string;
  entityType: OpeningBalanceEntityType;
  entityId: string;
  entityName: string;
  operationalOpening: number;
  jeEntryNo: string | null;
  jeAmount: number | null;
  gap: number;
  status: OpeningBalanceGapStatus;
  reason: string;
}

const MONEY_EPS = 0.02;

export function classifyOpeningBalanceGap(opts: {
  operationalOpening: number;
  jeAmount: number | null;
  hasJe: boolean;
}): { status: OpeningBalanceGapStatus; gap: number; reason: string } {
  const op = Number(opts.operationalOpening) || 0;
  const hasOp = Math.abs(op) >= MONEY_EPS;
  const je = opts.jeAmount != null ? Number(opts.jeAmount) : null;
  const hasJe = opts.hasJe && je != null;

  if (!hasOp && !hasJe) {
    return { status: 'no_opening', gap: 0, reason: 'No operational opening and no opening JE' };
  }
  if (hasOp && !hasJe) {
    return {
      status: 'missing_je',
      gap: op,
      reason: 'Operational opening set but no active opening_balance_contact_* JE',
    };
  }
  if (!hasOp && hasJe) {
    return {
      status: 'orphan_je',
      gap: je ?? 0,
      reason: 'Active opening JE exists but operational opening is zero',
    };
  }
  const gap = op - (je ?? 0);
  if (Math.abs(gap) < MONEY_EPS) {
    return { status: 'synced', gap: 0, reason: 'Operational opening matches JE primary leg net' };
  }
  return {
    status: 'amount_mismatch',
    gap,
    reason: `Gap Rs.${gap.toFixed(2)} between operational opening and JE net`,
  };
}

export function defaultOpeningBalanceDiagnosticsDateRange(todayIso?: string): { dateFrom: string; dateTo: string } {
  const today = (todayIso || new Date().toISOString()).slice(0, 10);
  return { dateFrom: `${today.slice(0, 4)}-01-01`, dateTo: today };
}

export function openingBalanceRowMatchesQuery(
  row: Pick<OpeningBalanceGapRow, 'entityName' | 'jeEntryNo' | 'entityId'>,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [row.entityName, row.jeEntryNo, row.entityId].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}
