import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, ExternalLink, AlertTriangle, ShieldAlert, Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import { ReportActions } from './ReportActions';
import { PdfPreviewModal } from '@/app/components/shared/PdfPreviewModal';
import { FinancialReportPreview } from './shared/FinancialReportPreview';
import { useFinancialReportPrint } from './shared/useFinancialReportPrint';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { toast } from 'sonner';
import {
  accountingReportsService,
  TrialBalanceResult,
  TrialBalanceRow,
  type TrialBalanceArApMode,
} from '@/app/services/accountingReportsService';
import { exportToExcel, ExportData } from '@/app/utils/exportUtils';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { AccountLedgerView } from '@/app/components/accounting/AccountLedgerView';
import {
  computeTrialBalanceTotals,
  mergeTrialBalanceSearchResults,
  searchTrialBalanceJournalAccounts,
} from '@/app/lib/trialBalanceJournalSearch';

const toExport = (
  r: TrialBalanceResult,
  formatCurrency: (n: number) => string,
  periodLabel: string
): ExportData => ({
  title: `Trial Balance (GL) — ${periodLabel}`,
  headers: ['Code', 'Account', 'Type', 'Debit', 'Credit', 'Period net (Dr−Cr)'],
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
  const financialPrint = useFinancialReportPrint(companyId);
  const { setCurrentView } = useNavigation();
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState<TrialBalanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchRetryKey, setFetchRetryKey] = useState(0);
  const [ledgerRow, setLedgerRow] = useState<TrialBalanceRow | null>(null);
  const [arApMode, setArApMode] = useState<TrialBalanceArApMode>('flat');
  const [searchTerm, setSearchTerm] = useState('');
  const [journalSearchEnabled, setJournalSearchEnabled] = useState(false);
  const [journalAccountIds, setJournalAccountIds] = useState<Set<string> | null>(null);
  const [journalSearchLoading, setJournalSearchLoading] = useState(false);

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      if (!companyId) setLoading(true);
      return;
    }
    setLoading(true);
    setFetchError(null);
    accountingReportsService
      .getTrialBalance(companyId, startDate, endDate, branchId, { arApMode })
      .then(setData)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load trial balance';
        setFetchError(msg);
        toast.error(msg);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate, branchId, arApMode, fetchRetryKey]);

  useEffect(() => {
    if (!journalSearchEnabled || !searchTerm.trim() || !companyId) {
      setJournalAccountIds(null);
      setJournalSearchLoading(false);
      return;
    }
    let cancelled = false;
    setJournalSearchLoading(true);
    const timer = window.setTimeout(() => {
      void searchTrialBalanceJournalAccounts({
        companyId,
        startDate,
        endDate,
        branchId,
        query: searchTerm,
      })
        .then((ids) => {
          if (!cancelled) setJournalAccountIds(ids);
        })
        .catch(() => {
          if (!cancelled) setJournalAccountIds(new Set());
        })
        .finally(() => {
          if (!cancelled) setJournalSearchLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [journalSearchEnabled, searchTerm, companyId, startDate, endDate, branchId]);

  const filteredRows = useMemo(() => {
    if (!data?.rows?.length) return [];
    return mergeTrialBalanceSearchResults(
      data.rows,
      searchTerm,
      journalAccountIds,
      journalSearchEnabled
    );
  }, [data?.rows, searchTerm, journalAccountIds, journalSearchEnabled]);

  const filteredTotals = useMemo(() => computeTrialBalanceTotals(filteredRows), [filteredRows]);

  const isSearchActive = searchTerm.trim().length > 0;

  /** Debit−Credit; negative on receivable-type assets usually indicates mis-posting or legacy journals. */
  const creditHeavyAssetRows = useMemo(() => {
    if (!filteredRows.length) return [];
    return filteredRows.filter((r) => {
      const t = (r.account_type || '').toLowerCase();
      const looksAsset = t.includes('asset') || t.includes('receivable') || t.includes('cash') || t.includes('bank');
      const isPayable = /payable/i.test(r.account_name || '');
      return looksAsset && !isPayable && r.balance < -0.01;
    });
  }, [filteredRows]);

  const branchLabel = branchId && branchId !== 'all' ? 'Branch scope' : 'All branches';
  const generatedAt = useMemo(
    () => new Date().toLocaleString(),
    [financialPrint.previewOpen],
  );

  const exportResult = useMemo((): TrialBalanceResult | null => {
    if (!data) return null;
    if (!isSearchActive) return data;
    return { rows: filteredRows, ...filteredTotals };
  }, [data, isSearchActive, filteredRows, filteredTotals]);

  const arApModeLabel =
    arApMode === 'summary' ? 'Summary (AR+AP rolled)' : arApMode === 'expanded' ? 'Expanded party subledgers' : 'All accounts (GL lines)';
  const periodExportLabel = `${startDate} to ${endDate} · ${arApModeLabel}`;

  const exportPayload = useMemo(
    () => (exportResult ? toExport(exportResult, formatCurrency, periodExportLabel) : null),
    [exportResult, formatCurrency, periodExportLabel]
  );

  const handleExportExcel = () => {
    if (!exportPayload) return;
    exportToExcel(exportPayload, `Trial_Balance_GL_${startDate}_${endDate}`);
  };
  const handleWhatsApp = () => {
    if (!exportResult) return;
    financialPrint.shareViaWhatsApp({
      title: 'Trial Balance (GL)',
      message: `Trial Balance (GL)\n${periodExportLabel}\nTotal Debit: ${formatCurrency(exportResult.totalDebit)}\nTotal Credit: ${formatCurrency(exportResult.totalCredit)}\nDifference: ${formatCurrency(exportResult.difference)}`,
    });
  };

  const renderFinancialPreview = () =>
    financialPrint.brand && exportPayload ? (
      <FinancialReportPreview
        brand={financialPrint.brand}
        title="Trial Balance (GL)"
        periodLabel={periodExportLabel}
        branchLabel={branchLabel}
        generatedAt={generatedAt}
        headers={exportPayload.headers}
        rows={exportPayload.rows}
        fieldVisibility={financialPrint.printOpts.fieldVisibility}
        showHeader={financialPrint.printOpts.showHeader}
        showFooter={financialPrint.printOpts.showFooter}
        orientation={financialPrint.printOrientation}
        fontSize={financialPrint.printOpts.fontSize}
        fontFamily={financialPrint.printOpts.fontFamily}
        margins={financialPrint.printOpts.margins}
      />
    ) : null;

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
        <p className="text-sm text-gray-500 mt-1">
          {fetchError ? 'Check your connection and try again.' : 'Adjust the date range or ensure journal entries exist.'}
        </p>
        {fetchError ? (
          <Button variant="outline" className="mt-4 border-gray-700" onClick={() => { setFetchError(null); setFetchRetryKey((k) => k + 1); }}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  const displayTotals = isSearchActive ? filteredTotals : data;

  return (
    <div className="space-y-4">
      <ReportBasisBanner basis="official_gl" />
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
      <div className="no-print">
        <ReportActions
          title="Trial Balance (GL)"
          onPrint={() => void financialPrint.handleOpenPreview()}
          onOpenPdfPreview={() => void financialPrint.handleOpenPreview()}
          onExcel={handleExportExcel}
          onWhatsapp={handleWhatsApp}
          pdfLoading={financialPrint.loadingBrand}
          previewContentRef={financialPrint.printRef}
          previewDocumentType="ledger"
          previewReference={`trial-balance-${startDate}-${endDate}-${arApMode}`}
        />
      </div>

      {financialPrint.previewOpen ? (
        <PdfPreviewModal
          open={financialPrint.previewOpen}
          onClose={financialPrint.closePreview}
          title="Trial Balance (GL)"
          documentType="ledger"
          reference={`trial-balance-${startDate}-${endDate}-${arApMode}`}
          format={financialPrint.printFormat}
          orientation={financialPrint.printOrientation}
          showOrientationToggle
          onOrientationChange={financialPrint.setPrintOrientation}
          pageNumbers={financialPrint.printOpts.showFooter}
        >
          {renderFinancialPreview()}
        </PdfPreviewModal>
      ) : null}

      <div ref={financialPrint.printRef} className="sr-only">
        {renderFinancialPreview()}
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
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
              • Total Debit: {formatCurrency(displayTotals.totalDebit)} • Total Credit: {formatCurrency(displayTotals.totalCredit)}
              {displayTotals.difference !== 0 && (
                <span className="text-amber-400"> • Difference: {formatCurrency(displayTotals.difference)}</span>
              )}
            </span>
          )}
        </p>
      </div>

      <div className="no-print rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex flex-col gap-2 min-w-0 sm:col-span-2 lg:col-span-2">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Code, account, amount…"
                className="pl-9 bg-gray-950 border-gray-700 text-white h-10"
              />
              {journalSearchLoading ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 animate-spin" />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-0 justify-end">
            <div className="flex items-center gap-2">
              <Switch
                id="tb-journal-search"
                checked={journalSearchEnabled}
                onCheckedChange={setJournalSearchEnabled}
              />
              <Label htmlFor="tb-journal-search" className="text-sm text-gray-300 cursor-pointer leading-snug">
                Search journal lines (ref / description)
              </Label>
            </div>
            {journalSearchEnabled ? (
              <span className="text-xs text-gray-600">
                Also matches entry no, document no, description, and payment ref in this period.
              </span>
            ) : null}
          </div>
        </div>
        {isSearchActive ? (
          <p className="text-xs text-gray-500">
            Showing {filteredRows.length} of {data.rows.length} accounts
          </p>
        ) : null}
      </div>

      <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-900/50 no-print">
        <table className="w-full text-base leading-snug">
          <thead className="border-b border-gray-800 bg-gray-800/50">
            <tr>
              <th className="p-3 text-left font-medium text-gray-300">Code</th>
              <th className="p-3 text-left font-medium text-gray-300">Account</th>
              <th className="p-3 text-left font-medium text-gray-300">Type</th>
              <th className="p-3 text-right font-medium text-gray-300">Debit</th>
              <th className="p-3 text-right font-medium text-gray-300">Credit</th>
              <th
                className="p-3 text-right font-medium text-gray-300"
                title="Period net (Dr−Cr). For amount owed, use Balance Basis Guide or party GL statement."
              >
                Period net (Dr−Cr)
              </th>
              <th className="p-3 w-40 font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  {isSearchActive ? 'No accounts match your search.' : 'No journal entries in this period.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
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
                    <span
                      style={{ paddingLeft: (row.presentationIndent || 0) * 16 }}
                      className="inline-block"
                      title={
                        (row.presentationIndent || 0) > 0
                          ? 'Party GL sub-ledger — should match Ledger Statement closing after AR tie-out'
                          : undefined
                      }
                    >
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
          {filteredRows.length > 0 && (
            <tfoot className="border-t-2 border-gray-700 bg-gray-800/50">
              <tr>
                <td colSpan={3} className="p-3 font-medium text-white">Total</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(displayTotals.totalDebit)}</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(displayTotals.totalCredit)}</td>
                <td className="p-3 text-right font-medium text-white">{formatCurrency(displayTotals.totalDebit - displayTotals.totalCredit)}</td>
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
