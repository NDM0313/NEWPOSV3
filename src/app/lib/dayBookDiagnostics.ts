/**
 * Pure Day Book balance helpers (Phase C4) — mirrors DayBookReport.tsx logic.
 */

export const DAY_BOOK_ROUNDING_TOLERANCE = 0.02;

export interface DayBookLineInput {
  journalEntryId: string;
  voucher: string;
  entryDate: string;
  referenceType: string;
  debit: number;
  credit: number;
  isVoid: boolean;
  accountLabel: string;
}

export interface UnbalancedVoucherRow {
  journalEntryId: string;
  voucher: string;
  entryDate: string;
  referenceType: string;
  debit: number;
  credit: number;
  diff: number;
  lineCount: number;
}

export interface DayBookPeriodBalance {
  totalDebit: number;
  totalCredit: number;
  difference: number;
  isBalanced: boolean;
  voidLineCount: number;
  activeLineCount: number;
}

export function computeDayBookPeriodBalance(lines: DayBookLineInput[]): DayBookPeriodBalance {
  const active = lines.filter((l) => !l.isVoid);
  const totalDebit = active.reduce((s, l) => s + l.debit, 0);
  const totalCredit = active.reduce((s, l) => s + l.credit, 0);
  const difference = totalDebit - totalCredit;
  return {
    totalDebit,
    totalCredit,
    difference,
    isBalanced: Math.abs(difference) < DAY_BOOK_ROUNDING_TOLERANCE,
    voidLineCount: lines.length - active.length,
    activeLineCount: active.length,
  };
}

export function findUnbalancedVouchers(lines: DayBookLineInput[]): UnbalancedVoucherRow[] {
  const active = lines.filter((l) => !l.isVoid);
  const byJe = new Map<
    string,
    { voucher: string; entryDate: string; referenceType: string; debit: number; credit: number; lineCount: number }
  >();
  for (const l of active) {
    const cur = byJe.get(l.journalEntryId) ?? {
      voucher: l.voucher,
      entryDate: l.entryDate,
      referenceType: l.referenceType,
      debit: 0,
      credit: 0,
      lineCount: 0,
    };
    cur.debit += l.debit;
    cur.credit += l.credit;
    cur.lineCount += 1;
    byJe.set(l.journalEntryId, cur);
  }
  return [...byJe.entries()]
    .map(([journalEntryId, v]) => ({
      journalEntryId,
      voucher: v.voucher,
      entryDate: v.entryDate,
      referenceType: v.referenceType,
      debit: v.debit,
      credit: v.credit,
      diff: v.debit - v.credit,
      lineCount: v.lineCount,
    }))
    .filter((row) => Math.abs(row.diff) >= DAY_BOOK_ROUNDING_TOLERANCE)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

export function dayBookLineMatchesQuery(line: DayBookLineInput, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [line.voucher, line.referenceType, line.accountLabel, line.entryDate].join(' ').toLowerCase();
  return hay.includes(q);
}

export function defaultDayBookDiagnosticsDateRange(todayIso?: string): { dateFrom: string; dateTo: string } {
  const today = (todayIso || new Date().toISOString()).slice(0, 10);
  const d = new Date(`${today}T12:00:00`);
  d.setMonth(d.getMonth() - 1);
  return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
}
