'use client';

import type { AccountLedgerEntry } from '@/app/services/accountingService';
import { cn } from '@/app/components/ui/utils';

export interface CustomerGlJournalTableProps {
  entries: AccountLedgerEntry[];
  loading: boolean;
  error: string | null;
  formatCurrency: (n: number) => string;
  dateFrom: string;
  dateTo: string;
  /** Defaults: AR customer view */
  balanceColumnLabel?: string;
  emptyHint?: string;
  loadingHint?: string;
  showAccountCodeColumn?: boolean;
}

export function CustomerGlJournalTable({
  entries,
  loading,
  error,
  formatCurrency,
  dateFrom,
  dateTo,
  balanceColumnLabel = 'Balance (GL)',
  emptyHint,
  loadingHint = 'Loading GL (journal) statement…',
  showAccountCodeColumn = false,
}: CustomerGlJournalTableProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-[#0F1419] p-8 text-center text-sm text-gray-400">
        {loadingHint}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-200">{error}</div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-[#0F1419] p-8 text-center text-sm text-gray-400">
        {emptyHint ??
          `No AR journal lines in ${dateFrom} — ${dateTo}. Running balance is GL-only when lines exist.`}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0F1419] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Date</th>
              {showAccountCodeColumn ? (
                <th className="px-4 py-3 font-medium">Account</th>
              ) : null}
              <th className="px-4 py-3 font-medium">JE ref</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium text-right">Debit</th>
              <th className="px-4 py-3 font-medium text-right">Credit</th>
              <th className="px-4 py-3 font-medium text-right">{balanceColumnLabel}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr
                key={`${e.journal_entry_id || 'row'}-${i}`}
                className={cn('border-b border-gray-800/80', i % 2 === 0 ? 'bg-[#0B0F14]' : 'bg-transparent')}
              >
                <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{e.date}</td>
                {showAccountCodeColumn ? (
                  <td className="px-4 py-2.5 text-amber-200/90 font-mono text-xs whitespace-nowrap">
                    {e.gl_account_code || '—'}
                  </td>
                ) : null}
                <td className="px-4 py-2.5 text-violet-300 font-mono text-xs">{e.reference_number || e.entry_no || '—'}</td>
                <td className="px-4 py-2.5 text-gray-400 max-w-md truncate" title={e.description}>
                  {e.description || '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-emerald-400 tabular-nums">
                  {(e.debit || 0) > 0 ? formatCurrency(e.debit) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-rose-400 tabular-nums">
                  {(e.credit || 0) > 0 ? formatCurrency(e.credit) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-white tabular-nums">
                  {formatCurrency(e.running_balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
