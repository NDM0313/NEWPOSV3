import React, { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { FinancialReportPrintShell } from './shared/FinancialReportPrintShell';
import { shareViaWhatsApp } from '@/app/services/documentShareService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, InventoryValuationResult } from '@/app/services/accountingReportsService';
import { exportToExcel, ExportData } from '@/app/utils/exportUtils';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { formatQty } from '@/app/utils/quantity';

const toExport = (r: InventoryValuationResult, formatCurrency: (n: number) => string): ExportData => ({
  title: `Inventory Valuation as at ${r.asOfDate}`,
  headers: ['Product', 'SKU', 'Category', 'Unit', 'Quantity', 'Unit Cost', 'Total Value'],
  rows: [
    ...r.rows.map((row) => [
      row.product_name,
      row.sku,
      row.category,
      row.unit,
      formatQty(row.quantity),
      formatCurrency(row.unit_cost),
      formatCurrency(row.total_value),
    ]),
    [],
    ['Total Value', '', '', '', '', '', formatCurrency(r.totalValue)],
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchRetryKey, setFetchRetryKey] = useState(0);

  useEffect(() => {
    if (!companyId) {
      setLoading(true);
      return;
    }
    setLoading(true);
    setFetchError(null);
    accountingReportsService
      .getInventoryValuation(companyId, asOfDate, branchId)
      .then(setData)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load inventory valuation';
        setFetchError(msg);
        toast.error(msg);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [companyId, asOfDate, branchId, fetchRetryKey]);

  const branchLabel = branchId && branchId !== 'all' ? 'Branch scope' : 'All branches';
  const exportPayload = useMemo(() => (data ? toExport(data, formatCurrency) : null), [data, formatCurrency]);

  const handleExportExcel = () => {
    if (!exportPayload) return;
    exportToExcel(exportPayload, 'Inventory_Valuation');
  };
  const handleWhatsApp = () => {
    if (!data) return;
    void shareViaWhatsApp(
      `Inventory Valuation\nAs at ${data.asOfDate}\nTotal value: ${formatCurrency(data.totalValue)}`
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
        <p className="font-medium">{fetchError || 'No inventory valuation data'}</p>
        {fetchError ? (
          <Button variant="outline" className="mt-4 border-gray-700" onClick={() => { setFetchError(null); setFetchRetryKey((k) => k + 1); }}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FinancialReportPrintShell
        companyId={companyId}
        actionsTitle="Inventory Valuation"
        reportTitle="Inventory Valuation"
        periodLabel={`As at ${data.asOfDate}`}
        branchLabel={branchLabel}
        previewReference={`inventory-valuation-${data.asOfDate}`}
        exportPayload={exportPayload}
        onExcel={handleExportExcel}
        onWhatsapp={handleWhatsApp}
      />
      <p className="no-print text-sm text-gray-400">
        As at: {data.asOfDate} • {branchLabel} • {data.rows.length} SKU row(s) • Total value: {formatCurrency(data.totalValue)}
      </p>
      <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-900/50 no-print max-h-[calc(100dvh-16rem)]">
        <table className="w-full text-base leading-snug">
          <thead className="border-b border-gray-800 bg-gray-800/50 sticky top-0 z-10">
            <tr>
              <th className="p-3 text-left font-medium text-gray-300">Product</th>
              <th className="p-3 text-left font-medium text-gray-300">SKU</th>
              <th className="p-3 text-left font-medium text-gray-300">Category</th>
              <th className="p-3 text-left font-medium text-gray-300">Unit</th>
              <th className="p-3 text-right font-medium text-gray-300">Qty</th>
              <th className="p-3 text-right font-medium text-gray-300">Unit cost</th>
              <th className="p-3 text-right font-medium text-gray-300">Total value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data.rows.map((row) => (
              <tr key={row.product_id} className="hover:bg-gray-800/30">
                <td className="p-3 text-white">{row.product_name}</td>
                <td className="p-3 text-gray-400 font-mono text-sm">{row.sku}</td>
                <td className="p-3 text-gray-300">{row.category}</td>
                <td className="p-3 text-gray-300">{row.unit}</td>
                <td className="p-3 text-right text-gray-300 tabular-nums">{formatQty(row.quantity)}</td>
                <td className="p-3 text-right text-gray-300">{formatCurrency(row.unit_cost)}</td>
                <td className="p-3 text-right text-white font-medium">{formatCurrency(row.total_value)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-gray-700 bg-gray-800/30">
            <tr>
              <td colSpan={6} className="p-3 text-right font-semibold text-gray-300">
                Total value
              </td>
              <td className="p-3 text-right font-bold text-white">{formatCurrency(data.totalValue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
