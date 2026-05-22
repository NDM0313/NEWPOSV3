/**
 * Worker operational ledger (worker_ledger_entries) for mobile reports.
 * Studio jobs post here; GL 2010-only reports miss Pay Now and studio_production_stage refs.
 */
import { getWorkerLedgerEntries } from './accounts';
import type { LedgerLine } from './reports';
import { sortLedgerLinesAndRebuildRunningBalance } from '../lib/ledgerChronology';

function entryDate(row: { created_at: string; paid_at: string | null }): string {
  const paid = row.paid_at?.trim();
  if (paid) return paid.slice(0, 10);
  return row.created_at.slice(0, 10);
}

function mapOperationalRow(
  row: {
    id: string;
    amount: number;
    status: string;
    reference_type: string;
    reference_id: string;
    notes: string | null;
    created_at: string;
    paid_at: string | null;
  },
): LedgerLine {
  const amt = Number(row.amount) || 0;
  const st = (row.status || 'unpaid').toLowerCase();
  const isPaid = st === 'paid';
  const refLabel =
    row.reference_type === 'studio_production_stage'
      ? 'Studio job'
      : row.reference_type.replace(/_/g, ' ');
  const desc = row.notes?.trim() || `${refLabel}${row.reference_id ? ` · ${row.reference_id.slice(0, 8)}` : ''}`;
  return {
    id: row.id,
    journalEntryId: '',
    sourceReferenceId: row.reference_id || null,
    date: entryDate(row),
    createdAt: row.paid_at || row.created_at,
    entryNo: row.reference_type === 'studio_production_stage' ? 'STD' : 'WLE',
    description: desc,
    reference: row.reference_type,
    referenceType: row.reference_type,
    debit: isPaid ? amt : 0,
    credit: isPaid ? 0 : amt,
    runningBalance: 0,
  };
}

export async function getWorkerOperationalLedgerLines(
  companyId: string,
  workerId: string,
  startDate?: string,
  endDate?: string,
): Promise<{ openingBalance: number; lines: LedgerLine[]; error: string | null; source: 'operational' }> {
  const startStr = startDate ? startDate.slice(0, 10) : null;
  const endStr = endDate ? endDate.slice(0, 10) : null;

  const { data: rows, error } = await getWorkerLedgerEntries(companyId, workerId);
  if (error) return { openingBalance: 0, lines: [], error, source: 'operational' };

  const mapped = (rows || []).map(mapOperationalRow);
  mapped.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.createdAt.localeCompare(b.createdAt);
  });

  let opening = 0;
  if (startStr) {
    for (const l of mapped) {
      if (l.date >= startStr) continue;
      opening += (l.credit || 0) - (l.debit || 0);
    }
  }

  const inRange = mapped.filter((l) => {
    if (startStr && l.date < startStr) return false;
    if (endStr && l.date > endStr) return false;
    return true;
  });

  const lines = sortLedgerLinesAndRebuildRunningBalance(inRange, opening);
  return { openingBalance: opening, lines, error: null, source: 'operational' };
}
