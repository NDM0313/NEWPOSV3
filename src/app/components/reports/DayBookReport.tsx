import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/app/context/SupabaseContext';
import { ReportActions } from './ReportActions';
import { DateRangePicker } from '../ui/DateRangePicker';
import { Loader2, BookOpen } from 'lucide-react';
import { cn } from '../ui/utils';
import { exportToPDF, exportToExcel } from '@/app/utils/exportUtils';

export interface DayBookEntry {
  id: string;
  time: string;
  voucher: string;
  account: string;
  description: string;
  debit: number;
  credit: number;
  type: 'Sale' | 'Purchase' | 'Expense' | 'Transfer' | 'Payment' | 'Journal' | 'Rental';
}

function refTypeToDisplayType(ref: string): DayBookEntry['type'] {
  const m: Record<string, DayBookEntry['type']> = {
    sale: 'Sale',
    purchase: 'Purchase',
    payment: 'Payment',
    expense: 'Expense',
    journal: 'Journal',
    rental: 'Rental',
    transfer: 'Transfer',
  };
  return m[ref?.toLowerCase() ?? ''] ?? 'Journal';
}

export const DayBookReport = () => {
  const { companyId } = useSupabase();
  const today = new Date();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: today,
    to: today,
  });
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  const dateFrom = dateRange.from ? dateRange.from.toISOString().split('T')[0] : '';
  const dateTo = dateRange.to ? dateRange.to.toISOString().split('T')[0] : dateFrom;

  useEffect(() => {
    if (!companyId || !dateFrom || !dateTo) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          id, entry_no, entry_date, description, reference_type, created_at,
          lines:journal_entry_lines(id, debit, credit, description, account:accounts(name))
        `)
        .eq('company_id', companyId)
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo)
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(500);

      if (cancelled) return;
      setLoading(false);
      if (error) {
        setEntries([]);
        return;
      }

      const list: DayBookEntry[] = [];
      for (const je of data || []) {
        const lines = (je.lines as Array<{ id?: string; debit?: number; credit?: number; description?: string; account?: { name?: string } | null }>) ?? [];
        const createdAt = je.created_at ? new Date(je.created_at as string) : new Date();
        const timeStr = createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const voucher = String(je.entry_no ?? `JE-${String(je.id ?? '').slice(0, 8)}`);
        const desc = String(je.description ?? '');
        const type = refTypeToDisplayType(String(je.reference_type ?? ''));

        for (const line of lines) {
          const debit = Number(line.debit ?? 0);
          const credit = Number(line.credit ?? 0);
          if (debit === 0 && credit === 0) continue;
          const acc = line.account;
          const accountName = Array.isArray(acc) ? (acc[0] as { name?: string })?.name : (acc as { name?: string } | null)?.name;
          const accountNameStr = accountName ?? 'Unknown Account';
          list.push({
            id: `${je.id}-${line.id ?? Math.random()}`,
            time: timeStr,
            voucher,
            account: accountNameStr,
            description: line.description ?? desc,
            debit,
            credit,
            type,
          });
        }
      }
      setEntries(list);
    })();
    return () => { cancelled = true; };
  }, [companyId, dateFrom, dateTo]);

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const exportData = {
    headers: ['Time', 'Voucher #', 'Account', 'Description', 'Debit (₨)', 'Credit (₨)', 'Type'],
    rows: entries.map((e) => [
      e.time,
      e.voucher,
      e.account,
      e.description,
      e.debit,
      e.credit,
      e.type,
    ]),
    title: `Roznamcha (Day Book) ${dateFrom} to ${dateTo}`,
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <ReportActions
        title="Roznamcha (Day Book)"
        onPrint={() => window.print()}
        onPdf={() => exportToPDF(exportData, 'DayBook')}
        onExcel={() => exportToExcel(exportData, 'DayBook')}
        onWhatsapp={() => {}}
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Date Range:</span>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Select range"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium w-20">Time</th>
                  <th className="px-4 py-3 text-left font-medium w-24">Voucher #</th>
                  <th className="px-4 py-3 text-left font-medium">Account</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium w-28">Debit (₨)</th>
                  <th className="px-4 py-3 text-right font-medium w-28">Credit (₨)</th>
                  <th className="px-4 py-3 text-center font-medium w-24">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {entries.map((e, i) => (
                  <tr key={e.id} className={cn('hover:bg-gray-800/30', i % 2 === 0 ? 'bg-gray-950/30' : 'bg-gray-900/20')}>
                    <td className="px-4 py-3 text-gray-300">{e.time}</td>
                    <td className="px-4 py-3 font-mono text-gray-300">{e.voucher}</td>
                    <td className="px-4 py-3 text-white">{e.account}</td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={e.description}>{e.description}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">
                      {e.debit > 0 ? e.debit.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-400">
                      {e.credit > 0 ? e.credit.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          e.type === 'Sale' && 'bg-blue-500/20 text-blue-400',
                          e.type === 'Purchase' && 'bg-green-500/20 text-green-400',
                          e.type === 'Payment' && 'bg-purple-500/20 text-purple-400',
                          e.type === 'Expense' && 'bg-red-500/20 text-red-400',
                          e.type === 'Rental' && 'bg-amber-500/20 text-amber-400',
                          !['Sale', 'Purchase', 'Payment', 'Expense', 'Rental'].includes(e.type) && 'bg-gray-500/20 text-gray-400'
                        )}
                      >
                        {e.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-900 border-t-2 border-gray-700">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-bold text-white">
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-400">
                    ₨ {totalDebit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-400">
                    ₨ {totalCredit.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {isBalanced ? (
            <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl">
              <p className="text-green-400 text-center font-medium">✓ Debit = Credit – Balanced Day Book</p>
            </div>
          ) : (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-center font-medium">
                ⚠ Unbalanced! Difference: ₨ {Math.abs(totalDebit - totalCredit).toLocaleString()}
              </p>
            </div>
          )}
        </>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No transactions in this period</p>
        </div>
      )}
    </div>
  );
};
