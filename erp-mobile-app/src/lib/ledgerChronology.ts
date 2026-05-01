import type { LedgerLine } from '../api/reports';

/** Parseable instant for tie-break: prefer journal `createdAt`, else start of `date` (UTC midnight). */
function effectiveTimeMs(createdAt: string, date: string): number {
  const t = String(createdAt || '').trim();
  if (t) {
    const ms = Date.parse(t);
    if (!Number.isNaN(ms)) return ms;
  }
  const d = String(date || '').slice(0, 10);
  if (d) {
    const ms = Date.parse(`${d}T00:00:00.000Z`);
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
}

/** Primary: `date`, secondary: posting time, tertiary: stable line id. */
export function compareLedgerLineChronological(a: LedgerLine, b: LedgerLine): number {
  const da = String(a.date || '').slice(0, 10);
  const db = String(b.date || '').slice(0, 10);
  if (da !== db) return da.localeCompare(db);
  const ta = effectiveTimeMs(a.createdAt, a.date);
  const tb = effectiveTimeMs(b.createdAt, b.date);
  if (ta !== tb) return ta - tb;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Sort ledger rows by date/time, then recompute running balances from opening (Dr − Cr).
 * Call after any RPC or query whose row order may not match strict chronology.
 */
export function sortLedgerLinesAndRebuildRunningBalance(
  lines: LedgerLine[],
  openingBalance: number,
): LedgerLine[] {
  const sorted = [...lines].sort(compareLedgerLineChronological);
  let running = openingBalance;
  return sorted.map((l) => {
    const debit = Number(l.debit || 0);
    const credit = Number(l.credit || 0);
    running += debit - credit;
    return { ...l, runningBalance: running };
  });
}
