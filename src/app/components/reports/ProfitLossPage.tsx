import React, { useState, useEffect } from 'react';
import { Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, ProfitLossResult } from '@/app/services/accountingReportsService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';

const toExport = (r: ProfitLossResult, formatCurrency: (n: number) => string): ExportData => {
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

export const ProfitLossPage: React.FC<{
  startDate: string;
  endDate: string;
  branchId?: string;
}> = ({ startDate, endDate, branchId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState<ProfitLossResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    accountingReportsService
      .getProfitLoss(companyId, startDate, endDate, branchId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate, branchId]);

  const handleExportPDF = () => {
    if (!data) return;
    exportToPDF(toExport(data, formatCurrency), 'Profit_Loss');
  };
  const handleExportExcel = () => {
    if (!data) return;
    exportToExcel(toExport(data, formatCurrency), 'Profit_Loss');
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-400">
          Period: {data.startDate} to {data.endDate}
        </p>
        <div className="flex gap-2">
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
            Total Revenue <span>{formatCurrency(data.revenue.total)}</span>
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
            Total Cost of Sales <span>{formatCurrency(data.costOfSales.total)}</span>
          </p>
          <p className="flex justify-between font-medium text-green-400 mt-1">
            Gross Profit <span>{formatCurrency(data.grossProfit)}</span>
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
            Total Expenses <span>{formatCurrency(data.expenses.total)}</span>
          </p>
        </section>
        <section className="border-t-2 border-gray-700 pt-4">
          <p className="flex justify-between text-xl font-bold text-white">
            Net Profit <span className={data.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(data.netProfit)}</span>
          </p>
        </section>
      </div>
    </div>
  );
};
