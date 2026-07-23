/**
 * Operational Remaining Balance — open document due (effective operational basis).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { exportToPDF, exportToExcel } from '@/app/utils/exportUtils';
import { toast } from 'sonner';
import { ReportActions } from './ReportActions';
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
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RemainingBalanceRow[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'customers' | 'suppliers'>('all');
  const [hideZero, setHideZero] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setRows([]);
      setLoading(true);
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
    try {
      const csv = remainingBalanceToCsv(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `remaining-balance-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'CSV export failed');
    }
  };

  const exportPayload = useMemo(
    () => ({
      title: 'Remaining Balance Report',
      headers: ['Contact', 'Code', 'Type', 'Receivable due', 'Payable due', 'Net follow-up'],
      rows: rows.map((r) => [
        r.name,
        r.contactCode || '',
        r.contactType,
        formatCurrency(r.receivableDue),
        formatCurrency(r.payableDue),
        formatCurrency(r.netFollowUp),
      ]),
    }),
    [rows, formatCurrency]
  );

  const handleExportPdf = () => {
    try {
      exportToPDF(exportPayload, 'remaining-balance');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF export failed');
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcel(exportPayload, 'remaining-balance');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Excel export failed');
    }
  };

  return (
    <div className="space-y-4">
      <ReportActions
        title="Remaining Balance"
        onPrint={() => window.print()}
        onPdf={handleExportPdf}
        onExcel={handleExportExcel}
        onCsv={exportCsv}
        previewContentRef={printRef}
        previewDocumentType="ledger"
        previewReference="remaining-balance"
      />
      <div ref={printRef} className="classic-print-base" style={{ position: 'absolute', left: '-9999px', top: 0, width: '820px', minHeight: '240px', overflow: 'visible' }} aria-hidden>
        <div className="p-4 text-black bg-white">
          <h1 className="text-lg font-bold">{exportPayload.title}</h1>
          <table className="w-full text-xs border-collapse mt-4">
            <thead>
              <tr>{exportPayload.headers.map((h) => <th key={h} className="border px-2 py-1 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {exportPayload.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j} className="border px-2 py-1">{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ReportBasisBanner
        basis="effective_party"
        detail="Open document due from get_contact_balances_summary — sales/purchases/rentals/openings. Excludes void/cancelled GL audit trails. Use for customer/supplier follow-up, not Trial Balance."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'customers', 'suppliers'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                typeFilter === t ? 'bg-cyan-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'all' ? 'All' : t === 'customers' ? 'Customers' : 'Suppliers'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
          Hide zero balances
        </label>
        {error ? (
          <Button size="sm" variant="outline" className="border-red-800 text-red-300" onClick={() => void load()}>
            Retry load
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="text-muted-foreground text-xs">Total receivable due</div>
          <div className="text-lg font-semibold text-cyan-300 tabular-nums">{formatCurrency(totals.receivable)}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="text-muted-foreground text-xs">Total payable due</div>
          <div className="text-lg font-semibold text-amber-300 tabular-nums">{formatCurrency(totals.payable)}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="text-muted-foreground text-xs">Parties with balance</div>
          <div className="text-lg font-semibold text-foreground tabular-nums">{rows.length}</div>
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
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border bg-muted/40 text-left">
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
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No open balances for current filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.contactId} className="border-b border-border/80 hover:bg-muted/30">
                    <td className="py-2 px-3 text-gray-200">{r.name}</td>
                    <td className="py-2 px-3 text-muted-foreground font-mono text-xs">{r.contactCode || '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground capitalize">{r.contactType}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-cyan-300">
                      {r.receivableDue > 0 ? formatCurrency(r.receivableDue) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-amber-300">
                      {r.payableDue > 0 ? formatCurrency(r.payableDue) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
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
