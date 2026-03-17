import React, { useState, useEffect } from 'react';
import { Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, SalesProfitResult } from '@/app/services/accountingReportsService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';

const toExport = (r: SalesProfitResult, formatCurrency: (n: number) => string): ExportData => ({
  title: `Sales Profit Report (${r.startDate} to ${r.endDate})`,
  headers: ['Invoice', 'Date', 'Customer', 'Revenue', 'Cost', 'Profit', 'Margin %'],
  rows: [
    ...r.rows.map((row) => [
      row.invoice_no,
      row.sale_date,
      row.customer_name,
      formatCurrency(row.revenue),
      formatCurrency(row.cost),
      formatCurrency(row.profit),
      `${row.margin_pct.toFixed(1)}%`,
    ]),
    [],
    ['Total', '', '', formatCurrency(r.totalRevenue), formatCurrency(r.totalCost), formatCurrency(r.totalProfit), ''],
  ],
});

export const SalesProfitPage: React.FC<{
  startDate: string;
  endDate: string;
  branchId?: string;
  customerId?: string;
}> = ({ startDate, endDate, branchId, customerId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState<SalesProfitResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    accountingReportsService
      .getSalesProfit(companyId, startDate, endDate, branchId, customerId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate, branchId, customerId]);

  const handleExportPDF = () => {
    if (!data) return;
    exportToPDF(toExport(data, formatCurrency), 'Sales_Profit');
  };
  const handleExportExcel = () => {
    if (!data) return;
    exportToExcel(toExport(data, formatCurrency), 'Sales_Profit');
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
        <p className="font-medium">No data for the selected period</p>
        <p className="text-sm text-gray-500 mt-1">Adjust the date range or ensure sales exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-400">
          Period: {data.startDate} to {data.endDate} • Total Revenue: {formatCurrency(data.totalRevenue)} • Total Profit: {formatCurrency(data.totalProfit)}
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
      <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-900/50">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-800 bg-gray-800/50">
            <tr>
              <th className="p-3 text-left font-medium text-gray-300">Invoice</th>
              <th className="p-3 text-left font-medium text-gray-300">Date</th>
              <th className="p-3 text-left font-medium text-gray-300">Customer</th>
              <th className="p-3 text-right font-medium text-gray-300">Revenue</th>
              <th className="p-3 text-right font-medium text-gray-300">Cost</th>
              <th className="p-3 text-right font-medium text-gray-300">Profit</th>
              <th className="p-3 text-right font-medium text-gray-300">Margin %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No sales in this period.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.sale_id} className="hover:bg-gray-800/30">
                  <td className="p-3 font-mono text-white">{row.invoice_no}</td>
                  <td className="p-3 text-gray-300">{row.sale_date}</td>
                  <td className="p-3 text-gray-300">{row.customer_name}</td>
                  <td className="p-3 text-right text-white">{formatCurrency(row.revenue)}</td>
                  <td className="p-3 text-right text-gray-300">{formatCurrency(row.cost)}</td>
                  <td className="p-3 text-right text-green-400">{formatCurrency(row.profit)}</td>
                  <td className="p-3 text-right text-gray-300">{row.margin_pct.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot className="border-t-2 border-gray-700 bg-gray-800/50">
              <tr>
                <td colSpan={3} className="p-3 font-medium text-white">Total</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(data.totalRevenue)}</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(data.totalCost)}</td>
                <td className="p-3 text-right font-medium text-green-400">{formatCurrency(data.totalProfit)}</td>
                <td className="p-3 text-right font-medium text-white">—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
