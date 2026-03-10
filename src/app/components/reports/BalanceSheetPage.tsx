import React, { useState, useEffect } from 'react';
import { Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, BalanceSheetResult } from '@/app/services/accountingReportsService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';

const toExport = (r: BalanceSheetResult, formatCurrency: (n: number) => string): ExportData => ({
  title: `Balance Sheet as at ${r.asOfDate}`,
  headers: ['Section', 'Account', 'Code', 'Amount'],
  rows: [
    ...r.assets.items.map((i) => [r.assets.label, i.name, i.code || '', formatCurrency(i.amount)]),
    ['Total Assets', '', '', formatCurrency(r.totalAssets)],
    [],
    ...r.liabilities.items.map((i) => [r.liabilities.label, i.name, i.code || '', formatCurrency(i.amount)]),
    ['Total Liabilities', '', '', formatCurrency(r.liabilities.total)],
    [],
    ...r.equity.items.map((i) => [r.equity.label, i.name, i.code || '', formatCurrency(i.amount)]),
    ['Total Equity', '', '', formatCurrency(r.equity.total)],
    [],
    ['Total Liabilities & Equity', '', '', formatCurrency(r.totalLiabilitiesAndEquity)],
    ['Difference (should be 0)', '', '', formatCurrency(r.difference)],
  ],
});

export const BalanceSheetPage: React.FC<{
  asOfDate: string;
  branchId?: string;
}> = ({ asOfDate, branchId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState<BalanceSheetResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !asOfDate) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    accountingReportsService
      .getBalanceSheet(companyId, asOfDate, branchId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId, asOfDate, branchId]);

  const handleExportPDF = () => {
    if (!data) return;
    exportToPDF(toExport(data, formatCurrency), 'Balance_Sheet');
  };
  const handleExportExcel = () => {
    if (!data) return;
    exportToExcel(toExport(data, formatCurrency), 'Balance_Sheet');
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
        No data or error loading balance sheet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-400">As at: {data.asOfDate}{data.difference !== 0 && <span className="text-amber-400 ml-2"> • Difference: {formatCurrency(data.difference)}</span>}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1">
            <FileText size={14} /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1">
            <FileSpreadsheet size={14} /> Excel
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">{data.assets.label}</h3>
          <ul className="space-y-2">
            {data.assets.items.map((i) => (
              <li key={i.code || i.name} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.name}</span>
                <span className="text-white">{formatCurrency(i.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between font-medium text-white border-t border-gray-700 mt-3 pt-2">
            Total Assets <span>{formatCurrency(data.totalAssets)}</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">{data.liabilities.label}</h3>
          <ul className="space-y-2">
            {data.liabilities.items.map((i) => (
              <li key={i.code || i.name} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.name}</span>
                <span className="text-white">{formatCurrency(i.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between font-medium text-white border-t border-gray-700 mt-3 pt-2">
            Total Liabilities <span>{formatCurrency(data.liabilities.total)}</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">{data.equity.label}</h3>
          <ul className="space-y-2">
            {data.equity.items.map((i) => (
              <li key={i.code || i.name} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.name}</span>
                <span className="text-white">{formatCurrency(i.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between font-medium text-white border-t border-gray-700 mt-3 pt-2">
            Total Equity <span>{formatCurrency(data.equity.total)}</span>
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-gray-700 bg-gray-800/30 p-4 flex justify-between items-center">
        <span className="font-medium text-white">Total Liabilities + Equity</span>
        <span className="text-white">{formatCurrency(data.totalLiabilitiesAndEquity)}</span>
      </div>
    </div>
  );
};
