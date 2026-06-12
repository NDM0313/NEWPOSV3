/**
 * Operational Remaining Balance — open document due (effective operational basis).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Search } from 'lucide-react';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  loadRemainingBalanceReport,
  remainingBalanceToCsv,
  type RemainingBalanceRow,
} from '@/app/services/remainingBalanceReportService';

type Props = {
  branchId?: string | null;
};

export function RemainingBalanceReport({ branchId }: Props) {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RemainingBalanceRow[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'customers' | 'suppliers'>('all');
  const [hideZero, setHideZero] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await loadRemainingBalanceReport(companyId, {
        branchId,
        search,
        typeFilter,
        hideZero,
      });
      setRows(res.rows);
      setError(res.error);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, search, typeFilter, hideZero]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => ({
      receivable: rows.reduce((s, r) => s + r.receivableDue, 0),
      payable: rows.reduce((s, r) => s + r.payableDue, 0),
    }),
    [rows]
  );

  const exportCsv = () => {
    const csv = remainingBalanceToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `remaining-balance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <ReportBasisBanner
        basis="effective_party"
        detail="Open document due from get_contact_balances_summary — sales/purchases/rentals/openings. Excludes void/cancelled GL audit trails. Use for customer/supplier follow-up, not Trial Balance."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-gray-900 border-gray-700"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'customers', 'suppliers'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                typeFilter === t ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t === 'all' ? 'All' : t === 'customers' ? 'Customers' : 'Suppliers'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
          Hide zero balances
        </label>
        <Button size="sm" variant="outline" className="border-gray-700 gap-1.5" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <div className="text-gray-500 text-xs">Total receivable due</div>
          <div className="text-lg font-semibold text-cyan-300 tabular-nums">{formatCurrency(totals.receivable)}</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <div className="text-gray-500 text-xs">Total payable due</div>
          <div className="text-lg font-semibold text-amber-300 tabular-nums">{formatCurrency(totals.payable)}</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <div className="text-gray-500 text-xs">Parties with balance</div>
          <div className="text-lg font-semibold text-white tabular-nums">{rows.length}</div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 bg-gray-900/50 text-left">
                <th className="py-2 px-3">Contact</th>
                <th className="py-2 px-3">Code</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3 text-right">Receivable due</th>
                <th className="py-2 px-3 text-right">Payable due</th>
                <th className="py-2 px-3 text-right">Net follow-up</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No open balances for current filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.contactId} className="border-b border-gray-800/80 hover:bg-gray-900/30">
                    <td className="py-2 px-3 text-gray-200">{r.name}</td>
                    <td className="py-2 px-3 text-gray-500 font-mono text-xs">{r.contactCode || '—'}</td>
                    <td className="py-2 px-3 text-gray-400 capitalize">{r.contactType}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-cyan-300">
                      {r.receivableDue > 0 ? formatCurrency(r.receivableDue) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-amber-300">
                      {r.payableDue > 0 ? formatCurrency(r.payableDue) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-300">
                      {formatCurrency(r.netFollowUp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RemainingBalanceReport;
