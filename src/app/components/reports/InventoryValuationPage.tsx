import React, { useState, useEffect } from 'react';
import { Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, InventoryValuationResult } from '@/app/services/accountingReportsService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';

const toExport = (r: InventoryValuationResult, formatCurrency: (n: number) => string): ExportData => ({
  title: `Inventory Valuation as at ${r.asOfDate}`,
  headers: ['Product', 'SKU', 'Quantity', 'Unit Cost', 'Total Value'],
  rows: [
    ...r.rows.map((row) => [
      row.product_name,
      row.sku,
      row.quantity,
      formatCurrency(row.unit_cost),
      formatCurrency(row.total_value),
    ]),
    [],
    ['Total Value', '', '', '', formatCurrency(r.totalValue)],
  ],
});

export const InventoryValuationPage: React.FC<{
  asOfDate: string;
  branchId?: string;
}> = ({ asOfDate, branchId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState<InventoryValuationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    accountingReportsService
      .getInventoryValuation(companyId, asOfDate, branchId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId, asOfDate, branchId]);

  const handleExportPDF = () => {
    if (!data) return;
    exportToPDF(toExport(data, formatCurrency), 'Inventory_Valuation');
  };
  const handleExportExcel = () => {
    if (!data) return;
    exportToExcel(toExport(data, formatCurrency), 'Inventory_Valuation');
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
        No data or error loading inventory valuation.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-400">
          As at: {data.asOfDate} • Total value: {formatCurrency(data.totalValue)}
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
              <th className="p-3 text-left font-medium text-gray-300">Product</th>
              <th className="p-3 text-left font-medium text-gray-300">SKU</th>
              <th className="p-3 text-right font-medium text-gray-300">Quantity</th>
              <th className="p-3 text-right font-medium text-gray-300">Unit Cost</th>
              <th className="p-3 text-right font-medium text-gray-300">Total Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No stock on hand.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.product_id} className="hover:bg-gray-800/30">
                  <td className="p-3 text-white">{row.product_name}</td>
                  <td className="p-3 font-mono text-gray-300">{row.sku}</td>
                  <td className="p-3 text-right text-gray-300">{row.quantity}</td>
                  <td className="p-3 text-right text-gray-300">{formatCurrency(row.unit_cost)}</td>
                  <td className="p-3 text-right font-medium text-white">{formatCurrency(row.total_value)}</td>
                </tr>
              ))
            )}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot className="border-t-2 border-gray-700 bg-gray-800/50">
              <tr>
                <td colSpan={4} className="p-3 font-medium text-white">Total Value</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(data.totalValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
