import React, { useState, useEffect } from 'react';
import { Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingService, AccountLedgerEntry } from '@/app/services/accountingService';
import { accountService } from '@/app/services/accountService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';

export const AccountLedgerReportPage: React.FC<{
  startDate: string;
  endDate: string;
  branchId?: string;
}> = ({ startDate, endDate, branchId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [accounts, setAccounts] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [entries, setEntries] = useState<AccountLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoadingAccounts(true);
    accountService
      .getAllAccounts(companyId, branchId)
      .then((list: any[]) => {
        const active = (list || []).filter((a) => a.is_active !== false);
        setAccounts(active.map((a) => ({ id: a.id, name: a.name, code: a.code })));
        if (active.length > 0 && !selectedAccountId) setSelectedAccountId(active[0].id);
      })
      .finally(() => setLoadingAccounts(false));
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId || !selectedAccountId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    accountingService
      .getAccountLedger(selectedAccountId, companyId, startDate, endDate, branchId)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [companyId, selectedAccountId, startDate, endDate, branchId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const toExport = (): ExportData => ({
    title: `Account Ledger - ${selectedAccount?.name || selectedAccountId} (${startDate} to ${endDate})`,
    headers: ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'],
    rows: entries.map((e) => [
      e.date,
      e.reference_number,
      e.description,
      e.debit,
      e.credit,
      e.running_balance,
    ]),
  });
  const handleExportPDF = () => exportToPDF(toExport(), 'Account_Ledger');
  const handleExportExcel = () => exportToExcel(toExport(), 'Account_Ledger');

  if (loadingAccounts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Account</label>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[280px] bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-white">
                  {a.code ? `${a.code} - ` : ''}{a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1">
            <FileText size={14} /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1">
            <FileSpreadsheet size={14} /> Excel
          </Button>
        </div>
      </div>
      <p className="text-sm text-gray-400">
        Period: {startDate} to {endDate}
        {selectedAccount && ` • ${selectedAccount.code || ''} ${selectedAccount.name}`}
      </p>
      <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-900/50">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800 bg-gray-800/50">
              <tr>
                <th className="p-3 text-left font-medium text-gray-300">Date</th>
                <th className="p-3 text-left font-medium text-gray-300">Reference</th>
                <th className="p-3 text-left font-medium text-gray-300">Description</th>
                <th className="p-3 text-right font-medium text-gray-300">Debit</th>
                <th className="p-3 text-right font-medium text-gray-300">Credit</th>
                <th className="p-3 text-right font-medium text-gray-300">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    No transactions in this period.
                  </td>
                </tr>
              ) : (
                entries.map((e, i) => (
                  <tr key={`${e.journal_entry_id}-${i}`} className="hover:bg-gray-800/30">
                    <td className="p-3 text-gray-300">{e.date}</td>
                    <td className="p-3 font-mono text-gray-300">{e.reference_number}</td>
                    <td className="p-3 text-white">{e.description}</td>
                    <td className="p-3 text-right text-gray-300">{e.debit ? formatCurrency(e.debit) : '—'}</td>
                    <td className="p-3 text-right text-gray-300">{e.credit ? formatCurrency(e.credit) : '—'}</td>
                    <td className="p-3 text-right font-medium text-white">{formatCurrency(e.running_balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
