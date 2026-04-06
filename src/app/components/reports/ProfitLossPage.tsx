import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, FileText, FileSpreadsheet, GitCompare } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, ProfitLossResult } from '@/app/services/accountingReportsService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

const toExport = (
  r: ProfitLossResult,
  formatCurrency: (n: number) => string,
  periodLabel: string
): ExportData => {
  const rows: (string | number)[][] = [
    ['Revenue', '', ''],
    ...r.revenue.items.map((i) => [i.name, i.code || '', formatCurrency(i.amount)]),
    ['Total Revenue', '', formatCurrency(r.revenue.total)],
    [],
    ['Cost of Sales', '', ''],
    ...r.costOfSales.items.map((i) => [i.name, i.code || '', formatCurrency(i.amount)]),
    ['Total Cost of Sales', '', formatCurrency(r.costOfSales.total)],
    ['Gross Profit', '', formatCurrency(r.grossProfit)],
    [],
    ['Expenses', '', ''],
    ...r.expenses.items.map((i) => [i.name, i.code || '', formatCurrency(i.amount)]),
    ['Total Expenses', '', formatCurrency(r.expenses.total)],
    [],
    ['Net Profit', '', formatCurrency(r.netProfit)],
  ];
  return { title: 'Profit & Loss', headers: ['Section', 'Code', 'Amount'], rows };
};

function getCompareDates(startDate: string, endDate: string, period: 'prior-month' | 'prior-quarter'): { compareStart: string; compareEnd: string } {
  const end = new Date(endDate);
  const start = new Date(startDate);
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (period === 'prior-month') {
    const compareEnd = new Date(start);
    compareEnd.setDate(compareEnd.getDate() - 1);
    const compareStart = new Date(compareEnd);
    compareStart.setDate(compareStart.getDate() - days);
    return { compareStart: compareStart.toISOString().slice(0, 10), compareEnd: compareEnd.toISOString().slice(0, 10) };
  }
  const compareEnd = new Date(start);
  compareEnd.setDate(compareEnd.getDate() - 1);
  const compareStart = new Date(compareEnd);
  compareStart.setDate(compareStart.getDate() - days);
  return { compareStart: compareStart.toISOString().slice(0, 10), compareEnd: compareEnd.toISOString().slice(0, 10) };
}

export const ProfitLossPage: React.FC<{
  startDate: string;
  endDate: string;
  branchId?: string;
}> = ({ startDate, endDate, branchId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState<ProfitLossResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparePeriod, setComparePeriod] = useState<'none' | 'prior-month' | 'prior-quarter'>('none');

  const compareOptions = useMemo(() => {
    if (comparePeriod === 'none') return undefined;
    return getCompareDates(startDate, endDate, comparePeriod === 'prior-quarter' ? 'prior-quarter' : 'prior-month');
  }, [startDate, endDate, comparePeriod]);

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const options = compareOptions ? { compareStartDate: compareOptions.compareStart, compareEndDate: compareOptions.compareEnd } : undefined;
    accountingReportsService
      .getProfitLoss(companyId, startDate, endDate, branchId, options)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate, branchId, compareOptions?.compareStart, compareOptions?.compareEnd]);

  const exportPeriodLabel = `${data?.startDate ?? startDate} to ${data?.endDate ?? endDate}`;

  const handleExportPDF = () => {
    if (!data) return;
    exportToPDF(toExport(data, formatCurrency, exportPeriodLabel), `P_L_GL_${data.startDate}_${data.endDate}`);
  };
  const handleExportExcel = () => {
    if (!data) return;
    exportToExcel(toExport(data, formatCurrency, exportPeriodLabel), `P_L_GL_${data.startDate}_${data.endDate}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center text-gray-400">
        No data or error loading P&L.
      </div>
    );
  }

  const comp = data.comparison;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2 text-xs text-emerald-100/95">
        <strong className="font-semibold">Basis: GL (journal)</strong> — Canonical net profit from account types and posted lines.
        Reports Overview “operational flow” uses documents — do not compare without reading both labels.
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-400">
          Period: {data.startDate} to {data.endDate}
          {comp && (
            <span className="ml-2 text-gray-500">
              • Compare: {comp.startDate} to {comp.endDate}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <GitCompare size={14} className="text-gray-400" />
            <Select value={comparePeriod} onValueChange={(v: 'none' | 'prior-month' | 'prior-quarter') => setComparePeriod(v)}>
              <SelectTrigger className="w-[140px] h-8 text-xs border-gray-700 bg-gray-800">
                <SelectValue placeholder="Compare" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No comparison</SelectItem>
                <SelectItem value="prior-month">Prior month</SelectItem>
                <SelectItem value="prior-quarter">Prior period</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1">
            <FileText size={14} /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1">
            <FileSpreadsheet size={14} /> Excel
          </Button>
        </div>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-6">
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">{data.revenue.label}</h3>
          <ul className="space-y-1">
            {data.revenue.items.map((i) => (
              <li key={i.code || i.name} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.name}</span>
                <span className="text-white">{formatCurrency(i.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between font-medium text-white border-t border-gray-700 mt-2 pt-2">
            Total Revenue
            <span className="flex items-center gap-4">
              {comp && <span className="text-gray-500 text-xs">Prior: {formatCurrency(comp.revenue)}</span>}
              <span>{formatCurrency(data.revenue.total)}</span>
            </span>
          </p>
        </section>
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">{data.costOfSales.label}</h3>
          <ul className="space-y-1">
            {data.costOfSales.items.map((i) => (
              <li key={i.code || i.name} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.name}</span>
                <span className="text-white">{formatCurrency(i.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between text-gray-300 border-t border-gray-700 mt-2 pt-2">
            Total Cost of Sales
            <span className="flex items-center gap-4">
              {comp && <span className="text-gray-500 text-xs">Prior: {formatCurrency(comp.costOfSales)}</span>}
              <span>{formatCurrency(data.costOfSales.total)}</span>
            </span>
          </p>
          <p className="flex justify-between font-medium text-green-400 mt-1">
            Gross Profit
            <span className="flex items-center gap-4">
              {comp && <span className="text-gray-500 text-xs">Prior: {formatCurrency(comp.grossProfit)}</span>}
              <span>{formatCurrency(data.grossProfit)}</span>
            </span>
          </p>
        </section>
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">{data.expenses.label}</h3>
          <ul className="space-y-1">
            {data.expenses.items.map((i) => (
              <li key={i.code || i.name} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.name}</span>
                <span className="text-white">{formatCurrency(i.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between text-gray-300 border-t border-gray-700 mt-2 pt-2">
            Total Expenses
            <span className="flex items-center gap-4">
              {comp && <span className="text-gray-500 text-xs">Prior: {formatCurrency(comp.expenses)}</span>}
              <span>{formatCurrency(data.expenses.total)}</span>
            </span>
          </p>
        </section>
        <section className="border-t-2 border-gray-700 pt-4">
          <p className="flex justify-between text-xl font-bold text-white">
            Net Profit
            <span className="flex items-center gap-4">
              {comp && <span className="text-gray-500 text-sm font-normal">Prior: {formatCurrency(comp.netProfit)}</span>}
              <span className={data.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(data.netProfit)}</span>
            </span>
          </p>
        </section>
      </div>
    </div>
  );
};
