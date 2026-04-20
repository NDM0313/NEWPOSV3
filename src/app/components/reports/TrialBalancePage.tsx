import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, FileText, FileSpreadsheet, ExternalLink, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  accountingReportsService,
  TrialBalanceResult,
  TrialBalanceRow,
  type TrialBalanceArApMode,
} from '@/app/services/accountingReportsService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';
import { AccountLedgerView } from '@/app/components/accounting/AccountLedgerView';

const toExport = (
  r: TrialBalanceResult,
  formatCurrency: (n: number) => string,
  periodLabel: string
): ExportData => ({
  title: `Trial Balance (GL) — ${periodLabel}`,
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

function isArApControlTrialBalanceRow(row: TrialBalanceRow): boolean {
  const c = (row.account_code || '').trim();
  if (c === '1100' || c === '2000') return true;
  const n = (row.account_name || '').trim().toLowerCase();
  const t = (row.account_type || '').toLowerCase();
  if (n === 'accounts receivable' || n === 'accounts payable' || n === 'worker payable') return true;
  if (n.includes('receivable') && t.includes('asset')) return true;
  if (n.includes('payable') && t.includes('liab')) return true;
  return false;
}

export const TrialBalancePage: React.FC<{
  startDate: string;
  endDate: string;
  branchId?: string;
}> = ({ startDate, endDate, branchId }) => {
  const { companyId } = useSupabase();
  const { setCurrentView } = useNavigation();
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState<TrialBalanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerRow, setLedgerRow] = useState<TrialBalanceRow | null>(null);
  const [arApMode, setArApMode] = useState<TrialBalanceArApMode>('flat');

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    accountingReportsService
      .getTrialBalance(companyId, startDate, endDate, branchId, { arApMode })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate, branchId, arApMode]);

  /** Debit−Credit; negative on receivable-type assets usually indicates mis-posting or legacy journals. */
  const creditHeavyAssetRows = useMemo(() => {
    if (!data?.rows?.length) return [];
    return data.rows.filter((r) => {
      const t = (r.account_type || '').toLowerCase();
      const looksAsset = t.includes('asset') || t.includes('receivable') || t.includes('cash') || t.includes('bank');
      const isPayable = /payable/i.test(r.account_name || '');
      return looksAsset && !isPayable && r.balance < -0.01;
    });
  }, [data]);

  const periodExportLabel = `${startDate} to ${endDate}${branchId && branchId !== 'all' ? ` · branch` : ' · all branches'}`;

  const handleExportPDF = () => {
    if (!data) return;
    exportToPDF(toExport(data, formatCurrency, periodExportLabel), `Trial_Balance_GL_${startDate}_${endDate}`);
  };
  const handleExportExcel = () => {
    if (!data) return;
    exportToExcel(toExport(data, formatCurrency, periodExportLabel), `Trial_Balance_GL_${startDate}_${endDate}`);
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
        <p className="text-sm text-gray-500 mt-1">Adjust the date range or ensure journal entries exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2 text-sm text-emerald-100/95">
        <strong className="font-semibold">Basis: GL (journal)</strong> — Canonical trial balance from posted lines. Not operational
        document totals. Compare to Contacts/Sales only via explicit reconciliation (different basis).
      </div>
      {creditHeavyAssetRows.length > 0 && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.08] p-4 text-base text-amber-100/95 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-100">Credit-heavy asset account(s)</p>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">
              Trial Balance uses <strong className="text-gray-300">Balance = Debits − Credits</strong> per account. For receivables/cash/bank,
              a <strong className="text-gray-300">negative</strong> balance means total credits posted to that account exceed debits (e.g. reversed entries,
              receipts mis-posted, or journals not tied to sales). This does <strong className="text-gray-300">not</strong> match the Contacts “receivables” column,
              which is built from <strong className="text-gray-300">open invoice dues</strong> only. Use <strong className="text-gray-300">Ledger</strong> on the row to trace lines.
            </p>
            <ul className="mt-2 text-sm font-mono text-amber-200/90 space-y-0.5">
              {creditHeavyAssetRows.map((r) => (
                <li key={r.account_id}>
                  {r.account_code} {r.account_name} → {formatCurrency(r.balance)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-500 flex items-center gap-2">
            AR / AP view
            <select
              value={arApMode}
              onChange={(e) => setArApMode(e.target.value as TrialBalanceArApMode)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="flat">All accounts (GL lines)</option>
              <option value="summary">Summary (AR + AP rolled to control)</option>
              <option value="expanded">Expanded (control + party subledgers)</option>
            </select>
          </label>
        </div>
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
        <table className="w-full text-base leading-snug">
          <thead className="border-b border-gray-800 bg-gray-800/50">
            <tr>
              <th className="p-3 text-left font-medium text-gray-300">Code</th>
              <th className="p-3 text-left font-medium text-gray-300">Account</th>
              <th className="p-3 text-left font-medium text-gray-300">Type</th>
              <th className="p-3 text-right font-medium text-gray-300">Debit</th>
              <th className="p-3 text-right font-medium text-gray-300">Credit</th>
              <th className="p-3 text-right font-medium text-gray-300">Balance</th>
              <th className="p-3 w-40 font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No journal entries in this period.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => {
                const t = (row.account_type || '').toLowerCase();
                const looksAsset = t.includes('asset') || t.includes('receivable') || t.includes('cash') || t.includes('bank');
                const isPayable = /payable/i.test(row.account_name || '');
                const creditHeavyAsset = looksAsset && !isPayable && row.balance < -0.01;
                const arApControl = isArApControlTrialBalanceRow(row);
                return (
                <tr
                  key={row.account_id}
                  className={creditHeavyAsset ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-gray-800/30'}
                >
                  <td className="p-3 font-mono text-gray-300">
                    <span style={{ paddingLeft: (row.presentationIndent || 0) * 16 }} className="inline-block">
                      {row.account_code}
                    </span>
                  </td>
                  <td className="p-3 text-white">
                    <span style={{ paddingLeft: (row.presentationIndent || 0) * 16 }} className="inline-block">
                      {row.account_name}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400">{row.account_type}</td>
                  <td className="p-3 text-right text-gray-300">{row.debit ? formatCurrency(row.debit) : '—'}</td>
                  <td className="p-3 text-right text-gray-300">{row.credit ? formatCurrency(row.credit) : '—'}</td>
                  <td className="p-3 text-right font-medium text-white">{formatCurrency(row.balance)}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1 items-start">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-blue-400 hover:text-blue-300"
                        onClick={() => setLedgerRow(row)}
                      >
                        <ExternalLink size={12} className="mr-1" /> Ledger
                      </Button>
                      {arApControl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-indigo-400 hover:text-indigo-300"
                          onClick={() => setCurrentView('ar-ap-reconciliation-center')}
                        >
                          <ShieldAlert size={12} className="mr-1" /> Integrity Lab
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot className="border-t-2 border-gray-700 bg-gray-800/50">
              <tr>
                <td colSpan={3} className="p-3 font-medium text-white">Total</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(data.totalDebit)}</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(data.totalCredit)}</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(data.totalDebit - data.totalCredit)}</td>
                <td className="p-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {ledgerRow && (
        <AccountLedgerView
          isOpen={!!ledgerRow}
          onClose={() => setLedgerRow(null)}
          accountId={ledgerRow.account_id}
          accountName={ledgerRow.account_name}
          accountCode={ledgerRow.account_code}
          accountType={ledgerRow.account_type}
          initialDateRange={{ from: startDate, to: endDate }}
        />
      )}
    </div>
  );
};
