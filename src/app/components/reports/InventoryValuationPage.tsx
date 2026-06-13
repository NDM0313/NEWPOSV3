import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { ReportActions } from './ReportActions';
import { FinancialReportPrintLayout, FinancialReportDataTable } from './FinancialReportPrintLayout';
import { shareViaWhatsApp } from '@/app/services/documentShareService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, InventoryValuationResult } from '@/app/services/accountingReportsService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';

const toExport = (r: InventoryValuationResult, formatCurrency: (n: number) => string): ExportData => ({
  title: `Inventory Valuation as at ${r.asOfDate}`,
  headers: ['Product', 'SKU', 'Category', 'Unit', 'Quantity', 'Unit Cost', 'Total Value'],
  rows: [
    ...r.rows.map((row) => [
      row.product_name,
      row.sku,
      row.category,
      row.unit,
      row.quantity,
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

  const reportPrintRef = useRef<HTMLDivElement>(null);
  const branchLabel = branchId && branchId !== 'all' ? 'Branch scope' : 'All branches';
  const exportPayload = useMemo(() => (data ? toExport(data, formatCurrency) : null), [data, formatCurrency]);

  const handleExportPDF = () => {
    if (!exportPayload) return;
    exportToPDF(exportPayload, 'Inventory_Valuation');
  };
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
      <div className="no-print">
        <ReportActions
          title="Inventory Valuation"
          onPrint={() => window.print()}
          onPdf={handleExportPDF}
          onExcel={handleExportExcel}
          onWhatsapp={handleWhatsApp}
          previewContentRef={reportPrintRef}
          previewDocumentType="ledger"
          previewReference={`inventory-valuation-${data.asOfDate}`}
        />
      </div>
      <p className="no-print text-sm text-gray-400">
        As at: {data.asOfDate} • {branchLabel} • {data.rows.length} SKU row(s) • Total value: {formatCurrency(data.totalValue)}
      </p>
      {exportPayload ? (
        <div className="fixed left-[-9999px] top-0 w-[820px] pointer-events-none" aria-hidden>
          <FinancialReportPrintLayout
            ref={reportPrintRef}
            title="Inventory Valuation"
            periodLabel={`As at ${data.asOfDate}`}
            branchLabel={branchLabel}
          >
            <FinancialReportDataTable headers={exportPayload.headers} rows={exportPayload.rows} />
          </FinancialReportPrintLayout>
        </div>
      ) : null}
      <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-900/50 no-print max-h-[calc(100dvh-16rem)]">
        <table className="w-full text-base leading-snug">
          <thead className="border-b border-gray-800 bg-gray-800/50 sticky top-0 z-10">
            <tr>
              <th className="p-3 text-left font-medium text-gray-300">Product</th>
              <th className="p-3 text-left font-medium text-gray-300">SKU</th>
              <th className="p-3 text-left font-medium text-gray-300">Category</th>
              <th className="p-3 text-left font-medium text-gray-300">Unit</th>
              <th className="p-3 text-right font-medium text-gray-300">Qty</th>
              <th className="p-3 text-right font-medium text-gray-300">Unit Cost</th>
              <th className="p-3 text-right font-medium text-gray-300">Total Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No stock on hand.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={`${row.product_id}-${row.variation_id || 'base'}`} className="hover:bg-gray-800/30">
                  <td className="p-3 text-white">{row.product_name || '—'}</td>
                  <td className="p-3 font-mono text-gray-300">{row.sku || '—'}</td>
                  <td className="p-3 text-gray-400">{row.category || '—'}</td>
                  <td className="p-3 text-gray-400">{row.unit || '—'}</td>
                  <td className="p-3 text-right text-gray-300 tabular-nums">{row.quantity}</td>
                  <td className="p-3 text-right text-gray-300 tabular-nums">{formatCurrency(row.unit_cost)}</td>
                  <td className="p-3 text-right font-medium text-white tabular-nums">{formatCurrency(row.total_value)}</td>
                </tr>
              ))
            )}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot className="border-t-2 border-gray-700 bg-gray-800/50 sticky bottom-0">
              <tr>
                <td colSpan={6} className="p-3 font-medium text-white">Total Value</td>
                <td className="p-3 text-right font-medium text-white tabular-nums">{formatCurrency(data.totalValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
