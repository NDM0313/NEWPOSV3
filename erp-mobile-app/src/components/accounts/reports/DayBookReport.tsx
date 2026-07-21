import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, FileText, Smartphone, Wallet, ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import type { User } from '../../../types';
import { getDayBook, type DayBookJournalEntry } from '../../../api/reports';
import {
  getRoznamcha,
  roznamchaJournalSubtitle,
  roznamchaRefDisplay,
  type AccountFilter,
  type RoznamchaResult,
  type RoznamchaRowWithBalance,
} from '../../../api/roznamcha';
import { getPaymentAccounts } from '../../../api/accounts';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel, displayReferenceNumber } from './_shared/format';
import { formatRoznamchaRowDateTimeDisplay } from '../../../utils/transactionEventDateTime';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { TimelinePreviewPdf } from '../../shared/TimelinePreviewPdf';
import { RoznamchaPreviewPdf } from '../../shared/RoznamchaPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';
import { TransactionDetailSheet } from './_shared/TransactionDetailSheet';
import { localNowDateString } from '../../../utils/localDate';
import { roznamchaMetaSubline } from '../../../lib/roznamchaRowDescription';
import { roznamchaRowHasAttachments } from '../../../lib/roznamchaAttachments';
import { journalDescriptionForDisplay } from '../../../utils/journalDescriptionDisplay';
import { AttachmentIndicatorButton } from '../../shared/AttachmentIndicatorButton';
import { useAttachmentPreview } from '../../../hooks/useAttachmentPreview';
import { isEasyReportHubMode, useReportHubMode } from './_shared/ReportHubModeContext';
import { resolveRoznamchaRowPresentation } from '../../../lib/roznamchaTimelinePresentation';

interface DayBookReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  user: User;
  reportRefreshEpoch?: number;
}

type ReportMode = 'cash' | 'all';
type BranchScope = 'all' | 'session';
type DateSort = 'asc' | 'desc';

function effectiveBranchId(scope: BranchScope, sessionBranchId?: string | null): string | null {
  if (scope === 'all') return null;
  if (!sessionBranchId || sessionBranchId === 'all' || sessionBranchId === 'default') return null;
  return sessionBranchId;
}

function liquidityChipLabel(type: RoznamchaRowWithBalance['accountType']): string | null {
  if (type === 'cash') return 'Cash';
  if (type === 'bank') return 'Bank';
  if (type === 'wallet') return 'Wallet';
  return null;
}

function rowSortTimestamp(r: RoznamchaRowWithBalance): number {
  const t = r.time?.length === 5 ? `${r.time}:00` : r.time || '12:00:00';
  try {
    return new Date(`${r.date}T${t}`).getTime();
  } catch {
    return 0;
  }
}

export function DayBookReport({ onBack, companyId, branchId, user, reportRefreshEpoch = 0 }: DayBookReportProps) {
  const hubMode = useReportHubMode();
  const easyMode = isEasyReportHubMode(hubMode);
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange());
  const [mode, setMode] = useState<ReportMode>('cash');
  const [branchScope, setBranchScope] = useState<BranchScope>('session');
  const [liquidity, setLiquidity] = useState<AccountFilter>('all');
  const [paymentLedgerAccountId, setPaymentLedgerAccountId] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);
  const [dateSort, setDateSort] = useState<DateSort>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [paymentAccountOptions, setPaymentAccountOptions] = useState<Array<{ id: string; label: string }>>([]);

  const [journalEntries, setJournalEntries] = useState<DayBookJournalEntry[]>([]);
  const [roznamcha, setRoznamcha] = useState<RoznamchaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedEntry, setSelectedEntry] = useState<DayBookJournalEntry | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);

  const preview = usePdfPreview(companyId);
  const { openAttachmentPreview, AttachmentPreviewPortal } = useAttachmentPreview();

  const dateFrom = range.from || '1970-01-01';
  const dateTo = range.to || localNowDateString();
  const rozBranchId = effectiveBranchId(branchScope, branchId);

  useEffect(() => {
    if (!companyId) {
      setPaymentAccountOptions([]);
      return;
    }
    let cancelled = false;
    getPaymentAccounts(companyId).then(({ data }) => {
      if (cancelled) return;
      setPaymentAccountOptions(
        (data || []).map((a) => ({
          id: a.id,
          label: [a.code, a.name].filter(Boolean).join(' — ') || a.name || a.id,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (mode === 'cash') {
      getRoznamcha(
        companyId,
        rozBranchId,
        dateFrom,
        dateTo,
        liquidity,
        includeVoided,
        paymentLedgerAccountId.trim() || null,
      )
        .then((result) => {
          if (cancelled) return;
          setRoznamcha(result);
          setJournalEntries([]);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setRoznamcha(null);
          setError('Failed to load Roznamcha.');
          setLoading(false);
        });
    } else {
      getDayBook(companyId, dateFrom, dateTo, rozBranchId, 'all').then(({ data, error: err }) => {
        if (cancelled) return;
        setJournalEntries(data);
        setRoznamcha(null);
        setError(err);
        setLoading(false);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    companyId,
    mode,
    rozBranchId,
    range.from,
    range.to,
    liquidity,
    includeVoided,
    paymentLedgerAccountId,
    dateFrom,
    dateTo,
    reportRefreshEpoch,
  ]);

  const orderedRozRows = useMemo(() => {
    if (!roznamcha) return [];
    const rows = [...roznamcha.rows];
    rows.sort((a, b) => {
      const ta = rowSortTimestamp(a);
      const tb = rowSortTimestamp(b);
      return dateSort === 'asc' ? ta - tb : tb - ta;
    });
    return rows;
  }, [roznamcha, dateSort]);

  const journalGroups = useMemo(() => {
    const map = new Map<string, DayBookJournalEntry[]>();
    for (const e of journalEntries) {
      const key = e.date;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, rows]) => {
        const sorted = [...rows].sort((a, b) => {
          const ta = Date.parse(String(a.createdAt || '')) || 0;
          const tb = Date.parse(String(b.createdAt || '')) || 0;
          if (ta !== tb) return ta - tb;
          return String(a.id).localeCompare(String(b.id));
        });
        return [date, sorted] as [string, DayBookJournalEntry[]];
      });
  }, [journalEntries]);

  const journalTotals = useMemo(() => {
    const debit = journalEntries.reduce((s, e) => s + e.debit, 0);
    const credit = journalEntries.reduce((s, e) => s + e.credit, 0);
    return { debit, credit, count: journalEntries.length };
  }, [journalEntries]);

  const journalPdfGroups = useMemo(
    () =>
      journalGroups.map(([date, rows]) => ({
        date: formatDate(date),
        rows: rows.map((e) => ({
          time: new Date(e.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
          party: e.description || e.referenceType || '—',
          reference: displayReferenceNumber(e.entryNo, e.referenceType),
          fromAccount: e.lines.find((l) => l.credit > 0)?.accountName,
          toAccount: e.lines.find((l) => l.debit > 0)?.accountName,
          amount: Math.max(e.debit, e.credit),
          direction: 'in' as const,
        })),
      })),
    [journalGroups],
  );

  const openRoznamchaRow = useCallback((row: RoznamchaRowWithBalance) => {
    if (row.id.startsWith('rp-')) return;
    if (row.id.startsWith('jel-') && row.sourceJournalEntryId) {
      setSelectedJournalId(row.sourceJournalEntryId);
      return;
    }
    if (row.sourceJournalEntryId && !row.sourcePaymentId) {
      setSelectedJournalId(row.sourceJournalEntryId);
      return;
    }
    setSelectedPaymentId(row.sourcePaymentId || row.id);
  }, []);

  const stats =
    mode === 'cash' && roznamcha
      ? [
          { label: 'Opening', value: `Rs. ${formatAmount(roznamcha.summary.openingBalance, 0)}` },
          { label: 'Cash In', value: `Rs. ${formatAmount(roznamcha.summary.cashIn, 0)}`, color: 'text-[#BBF7D0]' },
          { label: 'Cash Out', value: `Rs. ${formatAmount(roznamcha.summary.cashOut, 0)}`, color: 'text-[#FDE68A]' },
          {
            label: 'Closing',
            value: `Rs. ${formatAmount(roznamcha.summary.closingBalance, 0)}`,
            color: 'text-white',
          },
        ]
      : [
          { label: 'Entries', value: String(journalTotals.count) },
          { label: 'Total Dr', value: `Rs. ${formatAmount(journalTotals.debit, 0)}`, color: 'text-[#FDE68A]' },
          { label: 'Total Cr', value: `Rs. ${formatAmount(journalTotals.credit, 0)}`, color: 'text-[#BBF7D0]' },
        ];

  const empty =
    !loading &&
    (mode === 'cash' ? orderedRozRows.length === 0 : journalEntries.length === 0);

  const liquidityChips: { id: AccountFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'cash', label: 'Cash' },
    { id: 'bank', label: 'Bank' },
    { id: 'wallet', label: 'Wallet' },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title={mode === 'cash' ? 'Roznamcha' : 'Day Book'}
        subtitle={
          mode === 'cash'
            ? 'Payments-only cash book (matches web Roznamcha)'
            : 'All journal entries, chronological'
        }
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
      >
        <DateRangeBar
          value={range}
          onChange={setRange}
          companyId={companyId}
          branchId={branchId}
          hidePresets={easyMode ? ['week', 'month', 'quarter', 'year', 'custom', 'all'] : ['all', 'quarter', 'year']}
        />
        {!easyMode ? (
          <div className="flex gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => setMode('cash')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                mode === 'cash' ? 'bg-white text-[#3B82F6]' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Cash (Roznamcha)
            </button>
            <button
              type="button"
              onClick={() => setMode('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                mode === 'all' ? 'bg-white text-[#3B82F6]' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              All entries
            </button>
          </div>
        ) : null}
      </ReportHeader>

      {mode === 'cash' && (
        <div className="px-4 -mt-2 mb-2">
          <p className="text-[10px] text-[#9CA3AF] border border-[#374151] rounded-lg px-3 py-2 bg-[#0F172A]/80">
            Cash / bank / wallet receive &amp; pay only — from{' '}
            <span className="text-[#D1D5DB] font-medium">payments</span> and{' '}
            <span className="text-[#D1D5DB] font-medium">rental_payments</span>. One row per actual movement.
            Rental receipts show as <span className="text-[#D1D5DB] font-medium">REN-*-PAY</span> or RCV, not duplicate JE.
            Voided reversed receipts are excluded by default.
          </p>
        </div>
      )}

      {mode === 'cash' && !easyMode && (
        <div className="px-4 mb-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#1F2937] border border-[#374151] text-sm text-white"
          >
            <span className="font-medium">Filters</span>
            {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {filtersOpen && (
            <div className="mt-2 p-3 rounded-lg bg-[#1F2937] border border-[#374151] space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#9CA3AF] mb-1.5">Branch</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBranchScope('all')}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs ${
                      branchScope === 'all' ? 'bg-[#3B82F6] text-white' : 'bg-[#111827] text-[#9CA3AF]'
                    }`}
                  >
                    All branches
                  </button>
                  <button
                    type="button"
                    onClick={() => setBranchScope('session')}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs ${
                      branchScope === 'session' ? 'bg-[#3B82F6] text-white' : 'bg-[#111827] text-[#9CA3AF]'
                    }`}
                  >
                    This branch
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#9CA3AF] mb-1.5">Liquidity</p>
                <div className="flex flex-wrap gap-1.5">
                  {liquidityChips.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setLiquidity(c.id)}
                      className={`px-2.5 py-1 rounded-full text-xs ${
                        liquidity === c.id ? 'bg-white text-[#4F46E5]' : 'bg-[#111827] text-[#9CA3AF]'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#9CA3AF] mb-1">Ledger account</p>
                <select
                  value={paymentLedgerAccountId}
                  onChange={(e) => setPaymentLedgerAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111827] border border-[#374151] rounded-lg text-white text-sm"
                >
                  <option value="">All payment accounts</option>
                  {paymentAccountOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-xs text-[#D1D5DB]">
                  <input
                    type="checkbox"
                    checked={includeVoided}
                    onChange={(e) => setIncludeVoided(e.target.checked)}
                    className="rounded border-[#374151]"
                  />
                  Include voided (audit)
                </label>
                <div className="flex items-center gap-2 text-xs text-[#D1D5DB]">
                  <span>Order:</span>
                  <button
                    type="button"
                    onClick={() => setDateSort('asc')}
                    className={`px-2 py-0.5 rounded ${dateSort === 'asc' ? 'bg-[#3B82F6] text-white' : 'bg-[#111827]'}`}
                  >
                    Oldest
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateSort('desc')}
                    className={`px-2 py-0.5 rounded ${dateSort === 'desc' ? 'bg-[#3B82F6] text-white' : 'bg-[#111827]'}`}
                  >
                    Newest
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'cash' && roznamcha && !loading && (
        <div className="px-4 mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[#1F2937] border border-[#374151] px-3 py-2">
            <p className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
              <Wallet className="w-3 h-3" /> Cash
            </p>
            <p className="text-sm font-bold text-white">{formatAmount(roznamcha.cashSplit.cash, 0)}</p>
          </div>
          <div className="rounded-lg bg-[#1F2937] border border-[#374151] px-3 py-2">
            <p className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Bank
            </p>
            <p className="text-sm font-bold text-white">{formatAmount(roznamcha.cashSplit.bank, 0)}</p>
          </div>
          <div className="rounded-lg bg-[#1F2937] border border-[#374151] px-3 py-2">
            <p className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Wallet
            </p>
            <p className="text-sm font-bold text-white">{formatAmount(roznamcha.cashSplit.wallet, 0)}</p>
          </div>
          <div className="rounded-lg bg-[#374151]/50 border border-[#4B5563] px-3 py-2">
            <p className="text-[10px] text-[#D1D5DB]">Total</p>
            <p className="text-sm font-bold text-white">{formatAmount(roznamcha.cashSplit.total, 0)}</p>
          </div>
        </div>
      )}

      <ReportShell
        loading={loading}
        error={error}
        empty={empty}
        emptyLabel={mode === 'cash' ? 'No payments in this range.' : 'No journal entries in this range.'}
      >
        {mode === 'cash' ? (
          <div className="space-y-4">
            {roznamcha && (
              <ReportCard>
                <div className="px-4 py-2 border-b border-[#374151] flex justify-between text-xs text-[#9CA3AF]">
                  <span>Opening balance</span>
                  <span className="font-mono text-white">
                    Rs. {formatAmount(roznamcha.summary.openingBalance, 0)}
                  </span>
                </div>
                <ul className="divide-y divide-[#374151]">
                  {orderedRozRows.map((r) => {
                    const pres = resolveRoznamchaRowPresentation(r);
                    const timeLabel = formatRoznamchaRowDateTimeDisplay(r.date, r.time || '');
                    const meta = roznamchaMetaSubline(r);
                    const clickable = !r.id.startsWith('rp-');
                    const RowIcon =
                      pres.useLiquidityPresentation && pres.variant === 'transfer'
                        ? ArrowLeftRight
                        : pres.isReceived
                          ? ArrowDownLeft
                          : ArrowUpRight;
                    const title = pres.useLiquidityPresentation ? pres.title : journalDescriptionForDisplay(r.details, r.type || 'Payment');
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={() => openRoznamchaRow(r)}
                          className={`w-full text-left px-4 py-3 transition-colors ${
                            clickable ? 'hover:bg-[#111827]/60' : 'opacity-90'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${pres.pillClass}`}>
                              <RowIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-1">
                                <p className="text-sm font-semibold text-white truncate flex-1 min-w-0">
                                  {title}
                                </p>
                                {roznamchaRowHasAttachments(r) ? (
                                  <AttachmentIndicatorButton
                                    size="sm"
                                    onClick={() => openAttachmentPreview(r.attachments ?? [], 0)}
                                  />
                                ) : null}
                              </div>
                              {pres.useLiquidityPresentation ? (
                                <p className="text-[11px] text-[#9CA3AF] truncate">
                                  {pres.from} → {pres.to}
                                </p>
                              ) : null}
                              <p className="text-[11px] text-[#9CA3AF] truncate font-mono">
                                {roznamchaRefDisplay(r)}
                              </p>
                              {roznamchaJournalSubtitle(r) ? (
                                <p className="text-[10px] text-[#6B7280] truncate font-mono">
                                  {roznamchaJournalSubtitle(r)}
                                </p>
                              ) : null}
                              {meta && <p className="text-[10px] text-[#6B7280] truncate mt-0.5">{meta}</p>}
                              {r.partyLine ? (
                                <p className="text-[10px] text-[#9CA3AF] truncate">{r.partyLine}</p>
                              ) : null}
                              <p className="text-[11px] text-[#9CA3AF] mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {liquidityChipLabel(r.accountType) ? (
                                  <span className="inline-flex px-1.5 py-0.5 rounded bg-[#374151] text-[10px] uppercase tracking-wide">
                                    {liquidityChipLabel(r.accountType)}
                                  </span>
                                ) : null}
                                <span>{r.accountName?.trim() || r.accountLabel || '—'}</span>
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded mb-0.5 ${
                                  pres.isReceived ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#EF4444]/15 text-[#EF4444]'
                                }`}
                              >
                                {pres.signPrefix === '↔' ? 'XFER' : pres.isReceived ? 'IN' : 'OUT'}
                              </span>
                              <p className={`text-sm font-bold ${pres.amountClass}`}>
                                {pres.signPrefix} Rs. {formatAmount(r.amount, 0)}
                              </p>
                              <p className="text-[10px] text-[#9CA3AF]">{timeLabel}</p>
                              <p className="text-[10px] text-[#9CA3AF]">
                                Bal Rs. {formatAmount(r.runningBalance, 0)}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ReportCard>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {journalGroups.map(([date, rows]) => (
              <div key={date}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-semibold text-white uppercase tracking-wide">{formatDate(date)}</p>
                  <p className="text-[10px] text-[#9CA3AF]">{rows.length} entries</p>
                </div>
                <ReportCard>
                  <ul className="divide-y divide-[#374151]">
                    {rows.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedEntry(e)}
                          className="w-full text-left px-4 py-3 hover:bg-[#111827]/60 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-[#9CA3AF]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {e.description || e.referenceType || '—'}
                              </p>
                              <p className="text-[11px] text-[#9CA3AF] truncate">
                                {displayReferenceNumber(e.entryNo, e.referenceType)} ·{' '}
                                {(e.referenceType || 'journal').replace(/_/g, ' ')}
                              </p>
                              <div className="mt-1 grid grid-cols-1 gap-0.5">
                                {e.lines.slice(0, 4).map((l, i) => (
                                  <p
                                    key={i}
                                    className={`text-[11px] truncate ${l.debit > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}
                                  >
                                    {l.debit > 0 ? (
                                      <span>
                                        <span className="font-semibold">Dr</span> {l.accountName}
                                      </span>
                                    ) : (
                                      <span>
                                        <span className="font-semibold ml-3">Cr</span> {l.accountName}
                                      </span>
                                    )}{' '}
                                    · Rs. {formatAmount(Math.max(l.debit, l.credit), 0)}
                                  </p>
                                ))}
                                {e.lines.length > 4 && (
                                  <p className="text-[10px] text-[#6B7280]">+ {e.lines.length - 4} more</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-white">
                                Rs. {formatAmount(Math.max(e.debit, e.credit), 0)}
                              </p>
                              <p className="text-[10px] text-[#9CA3AF]">
                                {new Date(e.createdAt).toLocaleTimeString('en-PK', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </ReportCard>
              </div>
            ))}
          </div>
        )}
      </ReportShell>

      {preview.brand && mode === 'cash' && roznamcha && (
        <PdfPreviewModal
          open={preview.open}
          title="Roznamcha"
          filename={`Roznamcha_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`Roznamcha · ${dateRangeLabel(range.from, range.to)}`}
        >
          <RoznamchaPreviewPdf
            brand={preview.brand}
            title="Roznamcha"
            subtitle={dateRangeLabel(range.from, range.to)}
            summary={roznamcha.summary}
            rows={orderedRozRows}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}

      {preview.brand && mode === 'all' && (
        <PdfPreviewModal
          open={preview.open}
          title="Day Book"
          filename={`DayBook_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`Day Book · ${dateRangeLabel(range.from, range.to)}`}
        >
          <TimelinePreviewPdf
            brand={preview.brand}
            title="Day Book"
            subtitle={dateRangeLabel(range.from, range.to)}
            totals={{
              inAmount: journalTotals.credit,
              outAmount: journalTotals.debit,
              net: journalTotals.debit - journalTotals.credit,
              count: journalTotals.count,
            }}
            groups={journalPdfGroups}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}

      <TransactionDetailSheet
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        companyId={companyId}
        referenceType="journal"
        referenceId={selectedEntry?.id ?? null}
        fallbackTitle={
          selectedEntry
            ? `${displayReferenceNumber(selectedEntry.entryNo, selectedEntry.referenceType)} · ${(selectedEntry.referenceType || 'Journal').replace(/_/g, ' ')}`
            : undefined
        }
      />

      <TransactionDetailSheet
        open={!!selectedPaymentId}
        onClose={() => setSelectedPaymentId(null)}
        companyId={companyId}
        referenceType="payment"
        referenceId={selectedPaymentId}
      />

      <TransactionDetailSheet
        open={!!selectedJournalId}
        onClose={() => setSelectedJournalId(null)}
        companyId={companyId}
        referenceType="journal"
        referenceId={selectedJournalId}
      />

      {AttachmentPreviewPortal}
    </div>
  );
}
