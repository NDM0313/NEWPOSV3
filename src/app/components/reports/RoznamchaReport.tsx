/**
 * Roznamcha – Daily Cash Book (Pakistan/India style).
 * Cash In / Cash Out only (not Journal Debit/Credit).
 * Structure: Filters → Summary Cards → Cash Split → Roznamcha Table.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { ReportActions } from './ReportActions';
import { PdfPreviewModal, type PdfPreviewOrientation } from '@/app/components/shared/PdfPreviewModal';
import { useReportExport } from './shared/useReportExport';
import { CashBookReportPreview } from './shared/CashBookReportPreview';
import {
  buildRoznamchaPrintRows,
  buildRoznamchaSummaryStats,
  ROZNAMCHA_PRINT_COLUMNS,
  roznamchaDetailsForDisplay,
} from './shared/buildRoznamchaPrintPreview';
import { DateRangePicker } from '../ui/DateRangePicker';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { BranchSelector } from '@/app/components/layout/BranchSelector';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { formatRoznamchaRowDateTimeDisplay } from '@/app/utils/transactionEventDateTime';
import {
  getRoznamcha,
  roznamchaJournalSubtitle,
  roznamchaRefDisplay,
  type AccountFilter,
  type RoznamchaResult,
  type RoznamchaRowWithBalance,
} from '@/app/services/roznamchaService';
import { accountService } from '@/app/services/accountService';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';

const ROZNAMCHA_CACHE_TTL_MS = 30_000;
const roznamchaResultCache = new Map<string, { at: number; data: RoznamchaResult }>();

function roznamchaCacheKey(
  companyId: string,
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
  accountFilter: AccountFilter,
  includeVoidedReversed: boolean,
  paymentLedgerAccountId: string | null
): string {
  return [
    companyId,
    branchId ?? 'all',
    dateFrom,
    dateTo,
    accountFilter,
    includeVoidedReversed ? '1' : '0',
    paymentLedgerAccountId ?? '',
  ].join('|');
}
import { exportToExcel } from '@/app/utils/exportUtils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { DateTimeDisplay } from '../ui/DateTimeDisplay';
import { Loader2, BookOpen, Wallet, Building2, CreditCard, Smartphone, Search } from 'lucide-react';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import { format, parseISO } from 'date-fns';
import { journalDescriptionForDisplay } from '@/app/utils/journalDescriptionDisplay';

function rowSortTimestamp(r: RoznamchaRowWithBalance): number {
  const t = r.time?.length === 5 ? `${r.time}:00` : r.time || '00:00:00';
  try {
    return new Date(`${r.date}T${t}`).getTime();
  } catch {
    return 0;
  }
}

function AccountBadge({
  accountLabel,
  liquidity,
}: {
  accountLabel: string;
  liquidity?: 'cash' | 'bank' | 'wallet' | null;
}) {
  const label = accountLabel || '—';
  const icon =
    liquidity === 'cash' || label === 'Cash' ? (
      <Wallet className="w-3.5 h-3.5" />
    ) : liquidity === 'bank' || label === 'Bank' ? (
      <Building2 className="w-3.5 h-3.5" />
    ) : liquidity === 'wallet' || label === 'Wallet' || label === 'JazzCash' ? (
      <Smartphone className="w-3.5 h-3.5" />
    ) : (
      <CreditCard className="w-3.5 h-3.5" />
    );
  return (
    <span className={cn(
      'inline-flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-md text-sm',
      label === '—' ? 'text-gray-500' : 'text-gray-200'
    )}>
      {icon} {label}
    </span>
  );
}

export interface RoznamchaReportProps {
  /** When provided, use global filter date range instead of local picker (aligns with TopHeader). */
  globalStartDate?: string | null;
  globalEndDate?: string | null;
}

export const RoznamchaReport = ({ globalStartDate, globalEndDate }: RoznamchaReportProps = {}) => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const reportExport = useReportExport({ companyId, documentType: 'ledger', reportKind: 'roznamcha' });
  const { formatCurrency } = useFormatCurrency();
  const [printOrientation, setPrintOrientation] = useState<PdfPreviewOrientation>('landscape');
  const { formatDate, formatDateTime } = useFormatDate();
  const today = new Date();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({ from: today, to: today });
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  /** Ledger row filter: single payment (cash/bank/wallet) account — all types when empty */
  const [paymentLedgerAccountId, setPaymentLedgerAccountId] = useState<string>('');
  const [paymentAccountOptions, setPaymentAccountOptions] = useState<Array<{ id: string; label: string }>>([]);
  /** Default off: voided payments (e.g. reversed receipts) are excluded from cash book totals. */
  const [includeVoidedReversed, setIncludeVoidedReversed] = useState(false);
  const [dateSort, setDateSort] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<RoznamchaResult | null>(null);
  const [loading, setLoading] = useState(!!companyId);
  const [currentPage, setCurrentPage] = useState(1);
  /** When Accounting uses global header dates, still allow a local start/end (or single day) here */
  const [overrideGlobalDates, setOverrideGlobalDates] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!companyId) {
      setPaymentAccountOptions([]);
      return;
    }
    let cancelled = false;
    accountService
      .getPaymentAccountsOnly(companyId)
      .then((list) => {
        if (cancelled) return;
        setPaymentAccountOptions(
          (list || []).map((a: { id: string; name?: string; code?: string }) => ({
            id: String(a.id),
            label: [a.code, a.name].filter(Boolean).join(' — ') || a.name || String(a.id),
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPaymentAccountOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const orderedRows = useMemo(() => {
    if (!data?.rows?.length) return [];
    const copy = [...data.rows];
    copy.sort((a, b) => rowSortTimestamp(a) - rowSortTimestamp(b));
    if (dateSort === 'desc') copy.reverse();
    return copy;
  }, [data?.rows, dateSort]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return orderedRows;
    return orderedRows.filter((r) => {
      const textHay = [
        r.ref,
        r.journalEntryNo,
        roznamchaRefDisplay(r),
        roznamchaJournalSubtitle(r),
        roznamchaDetailsForDisplay(r),
        r.referenceDisplay,
        r.partyLine,
        r.type,
        r.accountLabel,
        r.accountName,
        r.createdBy,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (textHay.includes(q)) return true;
      const amtHay = [
        r.amount,
        r.cashIn,
        r.cashOut,
        r.runningBalance,
      ]
        .map((n) => String(n ?? ''))
        .join(' ');
      return amtHay.includes(q.replace(/,/g, ''));
    });
  }, [orderedRows, searchTerm]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginatedRows = useMemo(() => {
    if (!filteredRows.length) return [];
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const useGlobalRange = Boolean(globalStartDate && globalEndDate);
  const dateFrom = useMemo(() => {
    if (useGlobalRange && !overrideGlobalDates) {
      return (globalStartDate ?? '').slice(0, 10);
    }
    if (dateRange.from) return format(dateRange.from, 'yyyy-MM-dd');
    return '';
  }, [useGlobalRange, overrideGlobalDates, globalStartDate, dateRange.from]);

  const dateTo = useMemo(() => {
    if (useGlobalRange && !overrideGlobalDates) {
      return (globalEndDate ?? '').slice(0, 10);
    }
    if (dateRange.to) return format(dateRange.to, 'yyyy-MM-dd');
    if (dateRange.from) return format(dateRange.from, 'yyyy-MM-dd');
    return dateFrom;
  }, [useGlobalRange, overrideGlobalDates, globalEndDate, dateRange.to, dateRange.from, dateFrom]);

  useEffect(() => {
    if (!useGlobalRange || !overrideGlobalDates) return;
    if (dateRange.from && dateRange.to) return;
    try {
      const gs = globalStartDate?.slice(0, 10);
      const ge = globalEndDate?.slice(0, 10);
      if (gs && ge) {
        setDateRange({ from: parseISO(gs), to: parseISO(ge) });
      }
    } catch {
      /* keep existing range */
    }
  }, [useGlobalRange, overrideGlobalDates, globalStartDate, globalEndDate, dateRange.from, dateRange.to]);

  const rowDateTime = (r: RoznamchaRowWithBalance) => {
    if (!r.date) return r.time || '—';
    return formatRoznamchaRowDateTimeDisplay(r.date, r.time || '');
  };

  const effectiveBranchId = contextBranchId === 'all' ? null : (contextBranchId || null);

  const load = useCallback(async () => {
    if (!companyId || !dateFrom || !dateTo) {
      setData(null);
      setLoading(false);
      return;
    }
    const ledgerId = paymentLedgerAccountId.trim() ? paymentLedgerAccountId.trim() : null;
    const cacheKey = roznamchaCacheKey(
      companyId,
      effectiveBranchId,
      dateFrom,
      dateTo,
      accountFilter,
      includeVoidedReversed,
      ledgerId
    );
    const cached = roznamchaResultCache.get(cacheKey);
    if (cached && Date.now() - cached.at < ROZNAMCHA_CACHE_TTL_MS) {
      setData(cached.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getRoznamcha(
        companyId,
        effectiveBranchId,
        dateFrom,
        dateTo,
        accountFilter,
        includeVoidedReversed,
        ledgerId
      );
      roznamchaResultCache.set(cacheKey, { at: Date.now(), data: result });
      setData(result);
    } catch {
      if (!cached) setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, effectiveBranchId, dateFrom, dateTo, accountFilter, includeVoidedReversed, paymentLedgerAccountId]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) setCurrentPage(1);
  }, [currentPage, totalPages]);
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, accountFilter, includeVoidedReversed, paymentLedgerAccountId, dateSort, pageSize, overrideGlobalDates, searchTerm]);

  const selectedBranchLabel = contextBranchId === 'all' || !contextBranchId ? 'All Branches' : 'Selected branch';

  useEffect(() => {
    setPrintOrientation(reportExport.accountingPrintOptions.orientation);
  }, [reportExport.accountingPrintOptions.orientation]);

  const handleOpenPdfPreview = useCallback(async () => {
    await reportExport.openPreview();
  }, [reportExport]);

  const printOpts = reportExport.accountingPrintOptions;
  const periodLabel = dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : '—';
  const generatedAt = useMemo(() => new Date().toLocaleString(), [reportExport.previewOpen]);

  const rozPrintPreview = useMemo(() => {
    if (!data?.summary) return null;
    return {
      summaryStats: buildRoznamchaSummaryStats(data.summary, formatCurrency),
      rows: buildRoznamchaPrintRows(filteredRows, roznamchaDetailsForDisplay),
      openingBalance: formatCurrency(data.summary.openingBalance),
      closingBalance: formatCurrency(data.summary.closingBalance),
    };
  }, [data?.summary, filteredRows, formatCurrency]);

  const exportData = {
    title: `Roznamcha ${dateFrom} to ${dateTo} – ${selectedBranchLabel}`,
    headers: ['Date & Time', 'Ref / Journal', 'Details', 'Account', 'Cash In', 'Cash Out', 'Balance'],
    rows: data
      ? [
          ['Opening', '—', 'Opening Balance', '—', '', '', data.summary.openingBalance],
          ...filteredRows.map((r: RoznamchaRowWithBalance) => {
            const meta = [r.referenceDisplay, r.partyLine, r.createdBy ? `by ${r.createdBy}` : ''].filter(Boolean).join(' • ');
            const jeSub = roznamchaJournalSubtitle(r);
            const refCol = jeSub ? `${roznamchaRefDisplay(r)}\n${jeSub}` : roznamchaRefDisplay(r);
            return [
            rowDateTime(r),
            refCol,
            meta ? `${roznamchaDetailsForDisplay(r)}\n${meta}` : roznamchaDetailsForDisplay(r),
            (r.accountName ?? r.accountLabel) || '—',
            r.cashIn || '',
            r.cashOut || '',
            r.runningBalance,
          ];
          }),
        ]
      : [],
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <ReportBasisBanner
        basis={includeVoidedReversed ? 'audit_full' : 'effective_party'}
        detail="Operational cash book — payments and rental_payments only (not full GL). Toggle voided rows for audit view."
      />
      <p className="text-xs text-gray-500 border border-gray-800/80 rounded-lg px-3 py-2 bg-gray-950/40 max-w-3xl">
        Cash / bank / wallet receive &amp; pay only — from <strong className="text-gray-400">payments</strong> and{' '}
        <strong className="text-gray-400">rental_payments</strong> (not rental journal vouchers). One row per actual
        movement. Incoming receipts (sale, rental, manual) show as <strong className="text-gray-400">RCV-*</strong>;{' '}
        <strong className="text-gray-400">JE-*</strong> appears as a subtitle when linked.{' '}
        <span className="text-gray-600">
          Match header date range to payment_date; use All Branches and All accounts if a line is missing.
        </span>
      </p>
      <div className="no-print">
        <ReportActions
          title="Roznamcha"
          onPrint={() => void handleOpenPdfPreview()}
          onOpenPdfPreview={() => void handleOpenPdfPreview()}
          onExcel={() => exportToExcel(exportData, 'Roznamcha')}
          pdfLoading={reportExport.loadingBrand}
          onWhatsapp={() => {
            const s = data?.summary;
            reportExport.shareViaWhatsApp({
              title: 'Roznamcha (Daily Cash Book)',
              period: `${dateFrom} to ${dateTo}`,
              message: [
                'Roznamcha (Daily Cash Book)',
                `Period: ${dateFrom} to ${dateTo}`,
                s
                  ? `Opening: ${s.openingBalance.toLocaleString()} · In: ${s.cashIn.toLocaleString()} · Out: ${s.cashOut.toLocaleString()} · Closing: ${s.closingBalance.toLocaleString()}`
                  : '',
                `Rows shown: ${filteredRows.length}`,
              ]
                .filter(Boolean)
                .join('\n'),
            });
          }}
          previewContentRef={reportExport.printRef}
          previewDocumentType="ledger"
          previewReference={dateFrom && dateTo ? `Roznamcha-${dateFrom}-${dateTo}` : 'Roznamcha'}
        />
      </div>

      {reportExport.previewOpen && reportExport.brand && rozPrintPreview ? (
        <PdfPreviewModal
          open={reportExport.previewOpen}
          onClose={reportExport.closePreview}
          title="Roznamcha (Daily Cash Book)"
          documentType="ledger"
          reference={dateFrom && dateTo ? `Roznamcha-${dateFrom}-${dateTo}` : 'Roznamcha'}
          format={reportExport.printFormat}
          orientation={printOrientation}
          showOrientationToggle
          onOrientationChange={setPrintOrientation}
          pageNumbers={printOpts.showFooter}
        >
          <CashBookReportPreview
            brand={reportExport.brand}
            title="Roznamcha (Daily Cash Book)"
            periodLabel={periodLabel}
            branchScopeLabel={selectedBranchLabel}
            generatedAt={generatedAt}
            columns={ROZNAMCHA_PRINT_COLUMNS}
            rows={rozPrintPreview.rows}
            summaryStats={rozPrintPreview.summaryStats}
            openingBalance={rozPrintPreview.openingBalance}
            closingBalance={rozPrintPreview.closingBalance}
            fieldVisibility={printOpts.fieldVisibility}
            showHeader={printOpts.showHeader}
            showFooter={printOpts.showFooter}
            orientation={printOrientation}
            fontSize={printOpts.fontSize}
            fontFamily={printOpts.fontFamily}
            margins={printOpts.margins}
          />
        </PdfPreviewModal>
      ) : null}

      <div ref={reportExport.printRef} className="sr-only">
        {reportExport.brand && rozPrintPreview ? (
          <CashBookReportPreview
            brand={reportExport.brand}
            title="Roznamcha (Daily Cash Book)"
            periodLabel={periodLabel}
            branchScopeLabel={selectedBranchLabel}
            generatedAt={generatedAt}
            columns={ROZNAMCHA_PRINT_COLUMNS}
            rows={rozPrintPreview.rows}
            summaryStats={rozPrintPreview.summaryStats}
            openingBalance={rozPrintPreview.openingBalance}
            closingBalance={rozPrintPreview.closingBalance}
            fieldVisibility={printOpts.fieldVisibility}
            showHeader={printOpts.showHeader}
            showFooter={printOpts.showFooter}
            orientation={printOrientation}
            fontSize={printOpts.fontSize}
            fontFamily={printOpts.fontFamily}
            margins={printOpts.margins}
          />
        ) : null}
      </div>

      <div className="space-y-6">

      {/* 1. FILTERS */}
      <div className="no-print rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-5 items-start">
          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Date range</Label>
            {useGlobalRange ? (
              <>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Header: {globalStartDate?.slice(0, 10)} → {globalEndDate?.slice(0, 10)}
                  {!overrideGlobalDates ? ' (active)' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Switch
                    id="roznamcha-override-global-dates"
                    checked={overrideGlobalDates}
                    onCheckedChange={setOverrideGlobalDates}
                  />
                  <Label htmlFor="roznamcha-override-global-dates" className="text-sm text-gray-300 cursor-pointer">
                    Custom start / end (override)
                  </Label>
                </div>
                {overrideGlobalDates && (
                  <>
                    <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Start & end (or one day)" />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Today', days: 0, single: true },
                        { label: 'Yesterday', days: 1, single: true },
                        { label: 'Last 5 days', days: 4, single: false },
                        { label: 'Last 7 days', days: 6, single: false },
                        { label: 'Last 30 days', days: 29, single: false },
                        { label: 'This month', days: -1, single: false },
                      ].map(({ label, days, single }) => (
                        <Button
                          key={label}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
                          onClick={() => {
                            const t = new Date(); t.setHours(0,0,0,0);
                            if (days === -1) {
                              const from = new Date(t.getFullYear(), t.getMonth(), 1);
                              setDateRange({ from, to: t });
                            } else if (single) {
                              const d = new Date(t); d.setDate(d.getDate() - days);
                              setDateRange({ from: d, to: d });
                            } else {
                              const from = new Date(t); from.setDate(from.getDate() - days);
                              setDateRange({ from, to: t });
                            }
                          }}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Start & end (same day = single date)" />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Today', days: 0, single: true },
                    { label: 'Yesterday', days: 1, single: true },
                    { label: 'Last 5 days', days: 4, single: false },
                    { label: 'Last 7 days', days: 6, single: false },
                    { label: 'Last 30 days', days: 29, single: false },
                    { label: 'This month', days: -1, single: false },
                  ].map(({ label, days, single }) => (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
                      onClick={() => {
                        const t = new Date(); t.setHours(0,0,0,0);
                        if (days === -1) {
                          const from = new Date(t.getFullYear(), t.getMonth(), 1);
                          setDateRange({ from, to: t });
                        } else if (single) {
                          const d = new Date(t); d.setDate(d.getDate() - days);
                          setDateRange({ from: d, to: d });
                        } else {
                          const from = new Date(t); from.setDate(from.getDate() - days);
                          setDateRange({ from, to: t });
                        }
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Branch</Label>
            <BranchSelector variant="inline" showAllBranchesOption />
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Liquidity</Label>
            <Select value={accountFilter} onValueChange={(v: AccountFilter) => setAccountFilter(v)}>
              <SelectTrigger className="w-full max-w-[200px] bg-gray-950 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Ledger account</Label>
            <Select
              value={paymentLedgerAccountId || '__all__'}
              onValueChange={(v) => setPaymentLedgerAccountId(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-full min-w-0 max-w-[320px] bg-gray-950 border-gray-700 text-white">
                <SelectValue placeholder="All payment accounts" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__all__">All payment accounts</SelectItem>
                {paymentAccountOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-600">One Cash/Bank/Wallet GL book (optional).</span>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Date order</Label>
            <Select value={dateSort} onValueChange={(v: 'asc' | 'desc') => setDateSort(v)}>
              <SelectTrigger className="w-full max-w-[200px] bg-gray-950 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Oldest first</SelectItem>
                <SelectItem value="desc">Newest first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Rows per page</Label>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-full max-w-[120px] bg-gray-950 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 min-w-0 sm:col-span-2 lg:col-span-2">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ref, description, party, or amount…"
                className="pl-9 bg-gray-950 border-gray-700 text-white h-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-0 sm:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Switch
                id="roznamcha-include-voided"
                checked={includeVoidedReversed}
                onCheckedChange={setIncludeVoidedReversed}
              />
              <Label htmlFor="roznamcha-include-voided" className="text-sm text-gray-300 cursor-pointer leading-snug">
                Include voided payments (audit)
              </Label>
            </div>
            <span className="text-xs text-gray-600">
              Off by default: reversed/voided receipts do not affect Roznamcha totals.
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800/80">
          Date: {dateFrom} → {dateTo}
          {useGlobalRange && !overrideGlobalDates ? ' (from top bar)' : ''}
          {useGlobalRange && overrideGlobalDates ? ' (custom override)' : ''}
          {' · '}
          Branch: {selectedBranchLabel} · Liquidity:{' '}
          {accountFilter === 'all' ? 'All' : accountFilter === 'wallet' ? 'Wallet' : accountFilter}
          {paymentLedgerAccountId
            ? ` · Ledger: ${paymentAccountOptions.find((o) => o.id === paymentLedgerAccountId)?.label || paymentLedgerAccountId}`
            : ''}
          {' · '}
          Order: {dateSort === 'asc' ? 'oldest first' : 'newest first'} · {pageSize}/page
          {includeVoidedReversed ? ' · Voided rows shown' : ''}
        </p>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* 2. SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Opening Balance"
              value={data.summary.openingBalance}
              subtitle="yesterday closing"
            />
            <SummaryCard
              title="Cash In Today"
              value={data.summary.cashIn}
              subtitle="total incoming"
              variant="in"
            />
            <SummaryCard
              title="Cash Out Today"
              value={data.summary.cashOut}
              subtitle="total outgoing"
              variant="out"
            />
            <SummaryCard
              title="Closing Balance"
              value={data.summary.closingBalance}
              subtitle="opening + in − out"
            />
          </div>

          {/* 3. CASH SPLIT */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Cash Split</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center justify-between rounded-lg bg-gray-950 border border-gray-800 px-4 py-3">
                <span className="text-gray-400 flex items-center gap-2">
                  <Wallet size={18} /> Cash
                </span>
                <span className="font-mono font-semibold text-white">
                  {data.cashSplit.cash.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-950 border border-gray-800 px-4 py-3">
                <span className="text-gray-400 flex items-center gap-2">
                  <Building2 size={18} /> Bank
                </span>
                <span className="font-mono font-semibold text-white">
                  {data.cashSplit.bank.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-950 border border-gray-800 px-4 py-3">
                <span className="text-gray-400 flex items-center gap-2">
                  <Smartphone size={18} /> Wallet
                </span>
                <span className="font-mono font-semibold text-white">
                  {data.cashSplit.wallet.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-800 border border-gray-700 px-4 py-3">
                <span className="text-gray-300 flex items-center gap-2">
                  <CreditCard size={18} /> Total
                </span>
                <span className="font-mono font-bold text-white">
                  {data.cashSplit.total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 4. ROZNAMCHA TABLE */}
          <div className="relative rounded-xl border border-gray-800 overflow-hidden bg-gray-900/50">
            {loading ? (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-gray-950/70 backdrop-blur-sm pointer-events-none"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm text-gray-300">Loading roznamcha…</p>
              </div>
            ) : null}
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider p-4 border-b border-gray-800">
              Roznamcha Table
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-base leading-snug">
                <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium w-40">Date & Time</th>
                    <th className="px-4 py-3 text-left font-medium w-36">Ref / Journal</th>
                    <th className="px-4 py-3 text-left font-medium">Details</th>
                    <th className="px-4 py-3 text-left font-medium w-24">Account</th>
                    <th className="px-4 py-3 text-right font-medium w-28">Cash In</th>
                    <th className="px-4 py-3 text-right font-medium w-28">Cash Out</th>
                    <th className="px-4 py-3 text-right font-medium w-32">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr className="bg-gray-950/50">
                    <td className="px-4 py-3 text-gray-400">Opening</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 text-gray-300">Opening Balance</td>
                    <td className="px-4 py-3">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right font-mono text-white">
                      {data.summary.openingBalance.toLocaleString()}
                    </td>
                  </tr>
                  {paginatedRows.map((r: RoznamchaRowWithBalance, i: number) => (
                    <tr
                      key={r.id}
                      className={cn(
                        'hover:bg-gray-800/30',
                        i % 2 === 0 ? 'bg-gray-950/30' : 'bg-gray-900/20'
                      )}
                    >
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {r.date && r.time ? (
                          <DateTimeDisplay
                            date={new Date(r.date + 'T' + (r.time.length === 5 ? r.time + ':00' : r.time))}
                          />
                        ) : (
                          rowDateTime(r)
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[7rem]">
                        <div className="font-mono text-gray-300">{roznamchaRefDisplay(r)}</div>
                        {roznamchaJournalSubtitle(r) ? (
                          <div className="text-xs text-gray-500 mt-0.5 font-sans">{roznamchaJournalSubtitle(r)}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-medium text-white">{roznamchaDetailsForDisplay(r)}</div>
                        {(r.referenceDisplay || r.partyLine || r.createdBy) && (
                          <div className="text-xs text-gray-400 mt-0.5 leading-snug">
                            {[
                              journalDescriptionForDisplay(r.referenceDisplay, ''),
                              r.partyLine,
                              r.createdBy ? `by ${r.createdBy}` : '',
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AccountBadge accountLabel={r.accountName ?? r.accountLabel} liquidity={r.accountType} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">
                        {r.cashIn > 0 ? r.cashIn.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-400">
                        {r.cashOut > 0 ? r.cashOut.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {r.runningBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-900 border-t-2 border-gray-700">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 font-bold text-white">
                      Closing
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-400">
                      {data.summary.cashIn.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-400">
                      {data.summary.cashOut.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {data.summary.closingBalance.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-800 bg-gray-900/80">
                <p className="text-xs text-gray-400">
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalRows)} of {totalRows}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-gray-700 text-gray-300"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-500">…</span>}
                        <button
                          type="button"
                          className={cn(
                            'h-8 min-w-[2rem] rounded px-2 text-sm font-medium',
                            p === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          )}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-gray-700 text-gray-300"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}

      {!loading && (!data || orderedRows.length === 0) && (
        <div className="text-center py-16 rounded-xl border border-gray-800 bg-gray-900/30">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No cash transactions in this period</p>
          <p className="text-sm text-gray-500 mt-1">Cash / Bank / Wallet receive &amp; pay only — one row per actual payment (not invoice totals).</p>
        </div>
      )}
      </div>
    </div>
  );
};

function SummaryCard({
  title,
  value,
  subtitle,
  variant,
}: {
  title: string;
  value: number;
  subtitle: string;
  variant?: 'in' | 'out';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        variant === 'in' && 'border-green-800/50 bg-green-950/20',
        variant === 'out' && 'border-red-800/50 bg-red-950/20',
        !variant && 'border-gray-800 bg-gray-900/50'
      )}
    >
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</p>
      <p
        className={cn(
          'text-xl font-bold mt-1 font-mono',
          variant === 'in' && 'text-green-400',
          variant === 'out' && 'text-red-400',
          !variant && 'text-white'
        )}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
    </div>
  );
}
