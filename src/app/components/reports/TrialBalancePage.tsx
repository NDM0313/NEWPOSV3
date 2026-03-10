import React, { useState, useEffect } from 'react';
import { Loader2, FileText, FileSpreadsheet, Calendar } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, TrialBalanceResult } from '@/app/services/accountingReportsService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';

const toExport = (r: TrialBalanceResult, formatCurrency: (n: number) => string): ExportData => ({
  title: `Trial Balance`,
  headers: ['Code', 'Account', 'Type', 'Debit', 'Credit', 'Balance'],
  rows: [
    ...r.rows.map((row) => [
      row.account_code,
      row.account_name,
      row.account_type,
      formatCurrency(row.debit),
      formatCurrency(row.credit),
      formatCurrency(row.balance),
    ]),
    [],
    ['Total Debit', '', '', formatCurrency(r.totalDebit), '', ''],
    ['Total Credit', '', '', '', formatCurrency(r.totalCredit), ''],
    ['Difference', '', '', '', '', formatCurrency(r.difference)],
  ],
});

export const TrialBalancePage: React.FC<{
  startDate: string;
  endDate: string;
  branchId?: string;
}> = ({ startDate, endDate, branchId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState<TrialBalanceResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    accountingReportsService
      .getTrialBalance(companyId, startDate, endDate, branchId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate, branchId]);

  const handleExportPDF = () => {
    if (!data) return;
    exportToPDF(toExport(data, formatCurrency), 'Trial_Balance');
  };
  const handleExportExcel = () => {
    if (!data) return;
    exportToExcel(toExport(data, formatCurrency), 'Trial_Balance');
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
        No data or error loading trial balance.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-400">
          Period: {startDate} to {endDate}
          {data.rows.length > 0 && (
            <span className="ml-2">
              • Total Debit: {formatCurrency(data.totalDebit)} • Total Credit: {formatCurrency(data.totalCredit)}
              {data.difference !== 0 && (
                <span className="text-amber-400"> • Difference: {formatCurrency(data.difference)}</span>
              )}
            </span>
          )}
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
              <th className="p-3 text-left font-medium text-gray-300">Code</th>
              <th className="p-3 text-left font-medium text-gray-300">Account</th>
              <th className="p-3 text-left font-medium text-gray-300">Type</th>
              <th className="p-3 text-right font-medium text-gray-300">Debit</th>
              <th className="p-3 text-right font-medium text-gray-300">Credit</th>
              <th className="p-3 text-right font-medium text-gray-300">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No journal entries in this period.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.account_id} className="hover:bg-gray-800/30">
                  <td className="p-3 font-mono text-gray-300">{row.account_code}</td>
                  <td className="p-3 text-white">{row.account_name}</td>
                  <td className="p-3 text-gray-400">{row.account_type}</td>
                  <td className="p-3 text-right text-gray-300">{row.debit ? formatCurrency(row.debit) : '—'}</td>
                  <td className="p-3 text-right text-gray-300">{row.credit ? formatCurrency(row.credit) : '—'}</td>
                  <td className="p-3 text-right font-medium text-white">{formatCurrency(row.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot className="border-t-2 border-gray-700 bg-gray-800/50">
              <tr>
                <td colSpan={3} className="p-3 font-medium text-white">Total</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(data.totalDebit)}</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(data.totalCredit)}</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(data.totalDebit - data.totalCredit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
