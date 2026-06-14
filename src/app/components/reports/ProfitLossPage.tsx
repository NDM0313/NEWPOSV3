import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, GitCompare } from 'lucide-react';
import { ReportActions } from './ReportActions';
import { FinancialReportPrintLayout, FinancialReportDataTable } from './FinancialReportPrintLayout';
import { shareViaWhatsApp } from '@/app/services/documentShareService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, ProfitLossResult } from '@/app/services/accountingReportsService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';

const toExport = (
  r: ProfitLossResult,
  formatCurrency: (n: number) => string,
  periodLabel: string
): ExportData => {
  const comp = r.comparison;
  const headers = comp
    ? ['Section', 'Code', `Current (${r.startDate}–${r.endDate})`, `Prior (${comp.startDate}–${comp.endDate})`]
    : ['Section', 'Code', 'Amount'];
  const amt = (n: number, prior?: number) =>
    comp ? [formatCurrency(n), formatCurrency(prior ?? 0)] : [formatCurrency(n)];
  const rows: (string | number)[][] = [
    ['Revenue', '', ...(comp ? ['', ''] : [''])],
    ...r.revenue.items.map((i) => [i.name, i.code || '', ...amt(i.amount)]),
    ['Total Revenue', '', ...amt(r.revenue.total, comp?.revenue)],
    [],
    ['Cost of Sales', '', ...(comp ? ['', ''] : [''])],
    ...r.costOfSales.items.map((i) => [i.name, i.code || '', ...amt(i.amount)]),
    ['Total Cost of Sales', '', ...amt(r.costOfSales.total, comp?.costOfSales)],
    ['Gross Profit', '', ...amt(r.grossProfit, comp?.grossProfit)],
    [],
    ['Expenses', '', ...(comp ? ['', ''] : [''])],
    ...r.expenses.items.map((i) => [i.name, i.code || '', ...amt(i.amount)]),
    ['Total Expenses', '', ...amt(r.expenses.total, comp?.expenses)],
    [],
    ['Net Profit', '', ...amt(r.netProfit, comp?.netProfit)],
  ];
  return { title: `Profit & Loss (GL) — ${periodLabel}`, headers, rows };
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchRetryKey, setFetchRetryKey] = useState(0);
  const [comparePeriod, setComparePeriod] = useState<'none' | 'prior-month' | 'prior-quarter'>('none');

  const compareOptions = useMemo(() => {
    if (comparePeriod === 'none') return undefined;
    return getCompareDates(startDate, endDate, comparePeriod === 'prior-quarter' ? 'prior-quarter' : 'prior-month');
  }, [startDate, endDate, comparePeriod]);

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      if (!companyId) setLoading(true);
      return;
    }
    setLoading(true);
    setFetchError(null);
    const options = compareOptions ? { compareStartDate: compareOptions.compareStart, compareEndDate: compareOptions.compareEnd } : undefined;
    accountingReportsService
      .getProfitLoss(companyId, startDate, endDate, branchId, options)
      .then(setData)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load profit & loss';
        setFetchError(msg);
        toast.error(msg);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate, branchId, compareOptions?.compareStart, compareOptions?.compareEnd, fetchRetryKey]);

  const reportPrintRef = useRef<HTMLDivElement>(null);
  const exportPeriodLabel = `${data?.startDate ?? startDate} to ${data?.endDate ?? endDate}`;
  const branchLabel = branchId && branchId !== 'all' ? 'Branch scope' : 'All branches';
  const exportPayload = useMemo(
    () => (data ? toExport(data, formatCurrency, exportPeriodLabel) : null),
    [data, formatCurrency, exportPeriodLabel]
  );

  const handleExportPDF = () => {
    if (!exportPayload) return;
    exportToPDF(exportPayload, `P_L_GL_${data!.startDate}_${data!.endDate}`);
  };
  const handleExportExcel = () => {
    if (!exportPayload) return;
    exportToExcel(exportPayload, `P_L_GL_${data!.startDate}_${data!.endDate}`);
  };
  const handleWhatsApp = () => {
    if (!data) return;
    void shareViaWhatsApp(
      `Profit & Loss (GL)\n${exportPeriodLabel}\nNet Profit: ${formatCurrency(data.netProfit)}\nRevenue: ${formatCurrency(data.revenue.total)}`
    );
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
        <p className="font-medium">{fetchError || 'No data for the selected period'}</p>
        {fetchError ? (
          <Button variant="outline" className="mt-4 border-gray-700" onClick={() => { setFetchError(null); setFetchRetryKey((k) => k + 1); }}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  const comp = data.comparison;

  return (
    <div className="space-y-4">
      <ReportBasisBanner
        basis="official_gl"
        detail='Reports Overview "operational flow" uses documents — do not compare without reading both labels.'
      />
      <div className="no-print">
        <ReportActions
          title="Profit & Loss (GL)"
          onPrint={() => window.print()}
          onPdf={handleExportPDF}
          onExcel={handleExportExcel}
          onWhatsapp={handleWhatsApp}
          previewContentRef={reportPrintRef}
          previewDocumentType="ledger"
          previewReference={`profit-loss-${data.startDate}-${data.endDate}`}
        />
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
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
        </div>
      </div>
      {exportPayload ? (
        <div className="fixed left-[-9999px] top-0 w-[820px] pointer-events-none" aria-hidden>
          <FinancialReportPrintLayout
            ref={reportPrintRef}
            title="Profit & Loss (GL)"
            periodLabel={exportPeriodLabel}
            branchLabel={branchLabel}
          >
            <FinancialReportDataTable headers={exportPayload.headers} rows={exportPayload.rows} />
          </FinancialReportPrintLayout>
        </div>
      ) : null}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-6 no-print">
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
