import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ArrowDownLeft, ArrowUpRight, Wallet, Search } from 'lucide-react';
import type { User } from '../../../types';
import * as accountsApi from '../../../api/accounts';
import { getAccountLedgerLines, type LedgerLine } from '../../../api/reports';
import {
  getCustomerArGlLedgerLinesForContact,
  getSupplierApGlLedgerLinesForContact,
} from '../../../api/partyGlLedger';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel, displayReferenceNumber } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';
import { TransactionDetailSheet } from './_shared/TransactionDetailSheet';
import type { TransactionReferenceType } from '../../../api/transactionDetail';
import { sortLedgerLinesAndRebuildRunningBalance } from '../../../lib/ledgerChronology';

interface AccountLedgerReportProps {
  onBack: () => void;
  companyId: string | null;
  initialAccountId?: string | null;
  user: User;
  /** Selected app branch — ledger lines match web when scoped (includes NULL branch_id JEs). */
  branchId?: string | null;
  filterTypes?: ('cash' | 'bank' | 'mobile_wallet' | 'asset' | 'liability' | 'equity' | 'income' | 'expense')[];
  titleOverride?: string;
}

export function AccountLedgerReport({
  onBack,
  companyId,
  initialAccountId,
  user,
  branchId,
  filterTypes,
  titleOverride,
}: AccountLedgerReportProps) {
  const [accounts, setAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<accountsApi.AccountRow | null>(null);
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));

  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [opening, setOpening] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedLine, setSelectedLine] = useState<LedgerLine | null>(null);
  const [ledgerRefreshNonce, setLedgerRefreshNonce] = useState(0);
  const [manualLedgerRefresh, setManualLedgerRefresh] = useState(false);
  /** Shown when party GL RPC fails and we fall back to raw sub-account lines. */
  const [ledgerFallbackNotice, setLedgerFallbackNotice] = useState<string | null>(null);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    accountsApi.getAccounts(companyId).then(({ data }) => {
      if (cancelled) return;
      const list = (data || []).filter((a) => !filterTypes || filterTypes.includes(a.type as never));
      setAccounts(list);
      setLoading(false);
      if (initialAccountId) {
        const found = list.find((a) => a.id === initialAccountId);
        if (found) setSelected(found);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, initialAccountId, filterTypes]);

  useEffect(() => {
    if (!companyId || !selected) {
      setLines([]);
      setOpening(0);
      setLedgerFallbackNotice(null);
      setManualLedgerRefresh(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setLedgerFallbackNotice(null);

    const cid = selected.linkedContactId ?? null;
    /** Party AP sub-accounts are often stored as `liability` (not only `payable`) under the COA. */
    const useSupplierAp =
      !!cid &&
      (selected.type === 'payable' || selected.type === 'liability');
    const useCustomerAr = selected.type === 'receivable' && !!cid;

    (async () => {
      try {
        if (useSupplierAp && cid) {
          const rpcRes = await getSupplierApGlLedgerLinesForContact(
            companyId,
            cid,
            branchId ?? null,
            range.from || undefined,
            range.to || undefined,
          );
          if (cancelled) return;
          if (!rpcRes.error) {
            setOpening(rpcRes.openingBalance);
            setLines(sortLedgerLinesAndRebuildRunningBalance(rpcRes.lines, rpcRes.openingBalance));
            setLedgerFallbackNotice(null);
            return;
          }
          const fb = await getAccountLedgerLines(
            companyId,
            selected.id,
            range.from || undefined,
            range.to || undefined,
            branchId ?? null,
          );
          if (cancelled) return;
          setOpening(fb.openingBalance);
          setLines(sortLedgerLinesAndRebuildRunningBalance(fb.lines, fb.openingBalance));
          setLedgerFallbackNotice(
            `Party AP GL unavailable (${rpcRes.error}). Showing lines posted only to this sub-account.`,
          );
          return;
        }

        if (useCustomerAr && cid) {
          const rpcRes = await getCustomerArGlLedgerLinesForContact(
            companyId,
            cid,
            branchId ?? null,
            range.from || undefined,
            range.to || undefined,
          );
          if (cancelled) return;
          if (!rpcRes.error) {
            setOpening(rpcRes.openingBalance);
            setLines(sortLedgerLinesAndRebuildRunningBalance(rpcRes.lines, rpcRes.openingBalance));
            setLedgerFallbackNotice(null);
            return;
          }
          const fb = await getAccountLedgerLines(
            companyId,
            selected.id,
            range.from || undefined,
            range.to || undefined,
            branchId ?? null,
          );
          if (cancelled) return;
          setOpening(fb.openingBalance);
          setLines(sortLedgerLinesAndRebuildRunningBalance(fb.lines, fb.openingBalance));
          setLedgerFallbackNotice(
            `Party AR GL unavailable (${rpcRes.error}). Showing lines posted only to this sub-account.`,
          );
          return;
        }

        const res = await getAccountLedgerLines(
          companyId,
          selected.id,
          range.from || undefined,
          range.to || undefined,
          branchId ?? null,
        );
        if (cancelled) return;
        setOpening(res.openingBalance);
        setLines(sortLedgerLinesAndRebuildRunningBalance(res.lines, res.openingBalance));
        setLedgerFallbackNotice(null);
      } catch {
        if (!cancelled) {
          setOpening(0);
          setLines([]);
          setLedgerFallbackNotice(null);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
          setManualLedgerRefresh(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, selected, range.from, range.to, branchId, ledgerRefreshNonce]);

  useEffect(() => {
    if (!selected) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') setLedgerRefreshNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [selected?.id]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    const closing = lines.length ? lines[lines.length - 1].runningBalance : opening;
    return { debit, credit, closing };
  }, [lines, opening]);

  type Granularity = 'none' | 'week' | 'month';
  const granularity: Granularity = useMemo(() => {
    if (!range.from || !range.to) return lines.length > 30 ? 'week' : 'none';
    const from = new Date(range.from);
    const to = new Date(range.to);
    const days = Math.round((to.getTime() - from.getTime()) / 86400000);
    if (days > 60) return 'month';
    if (days > 7) return 'week';
    return 'none';
  }, [range.from, range.to, lines.length]);

  const groupedLines = useMemo(() => {
    if (granularity === 'none' || lines.length === 0) {
      return [{ key: 'all', label: '', lines, closingBalance: totals.closing }];
    }
    const groups = new Map<string, { key: string; label: string; lines: LedgerLine[]; closingBalance: number }>();
    const labelForKey = (key: string) => {
      if (granularity === 'month') {
        const [y, m] = key.split('-').map((n) => parseInt(n, 10));
        const d = new Date(y, m - 1, 1);
        return d.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
      }
      const [y, w] = key.split('-W');
      return `Week ${w}, ${y}`;
    };

    const weekKey = (dateStr: string): string => {
      const d = new Date(dateStr + 'T00:00:00Z');
      const yr = d.getUTCFullYear();
      const jan1 = new Date(Date.UTC(yr, 0, 1));
      const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000) + 1;
      const week = Math.ceil((dayOfYear + ((jan1.getUTCDay() + 6) % 7)) / 7);
      return `${yr}-W${String(week).padStart(2, '0')}`;
    };

    const monthKey = (dateStr: string): string => {
      return dateStr.slice(0, 7);
    };

    for (const line of lines) {
      const key = granularity === 'month' ? monthKey(line.date) : weekKey(line.date);
      const existing = groups.get(key);
      if (existing) {
        existing.lines.push(line);
        existing.closingBalance = line.runningBalance;
      } else {
        groups.set(key, { key, label: labelForKey(key), lines: [line], closingBalance: line.runningBalance });
      }
    }
    return Array.from(groups.values());
  }, [lines, granularity, totals.closing]);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.code ?? '').toLowerCase().includes(q) ||
        (a.type ?? '').toLowerCase().includes(q),
    );
  }, [accounts, search]);

  if (!selected) {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <ReportHeader
          onBack={onBack}
          title={titleOverride ?? 'Account Ledger'}
          subtitle="Select an account"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts..."
              className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/60"
            />
          </div>
        </ReportHeader>

        <ReportShell loading={loading} empty={!loading && filteredAccounts.length === 0} emptyLabel="No accounts found.">
          <ul className="space-y-2">
            {filteredAccounts.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setSelected(a)}
                  className="w-full bg-[#1F2937] border border-[#374151] hover:border-[#6366F1] rounded-xl p-3.5 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-[#9CA3AF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        <span className="text-[#9CA3AF] font-mono text-[11px] mr-2">{a.code}</span>
                        {a.name}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] capitalize">{a.type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${a.balance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        Rs. {formatAmount(a.balance, 0)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </ReportShell>
      </div>
    );
  }

  const stats = [
    { label: 'Opening', value: `Rs. ${formatAmount(opening, 0)}` },
    { label: 'Debit', value: `Rs. ${formatAmount(totals.debit, 0)}`, color: 'text-[#FDE68A]' },
    { label: 'Credit', value: `Rs. ${formatAmount(totals.credit, 0)}`, color: 'text-[#BBF7D0]' },
    { label: 'Closing', value: `Rs. ${formatAmount(totals.closing, 0)}` },
  ];

  const detailSubtitle =
    (branchId && branchId !== 'all' && branchId !== 'default'
      ? `${selected.code} · ${selected.type} · this branch + company-wide entries`
      : `${selected.code} · ${selected.type}`) +
    (selected.linkedContactId &&
    !ledgerFallbackNotice &&
    (selected.type === 'payable' || selected.type === 'liability')
      ? ' · Party AP (GL)'
      : selected.type === 'receivable' && selected.linkedContactId && !ledgerFallbackNotice
        ? ' · Party AR (GL)'
        : '');

  return (
    <div className="min-h-screen bg-[#111827] pb-28">
      <ReportHeader
        onBack={() => setSelected(null)}
        title={selected.name}
        subtitle={detailSubtitle}
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        onRefresh={() => {
          setManualLedgerRefresh(true);
          setLedgerRefreshNonce((n) => n + 1);
        }}
        refreshing={manualLedgerRefresh && detailLoading}
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>

      {/* Floating running balance footer so the current balance is always visible. */}
      {!detailLoading && lines.length > 0 && (
        <div className="fixed left-3 right-3 bottom-3 z-40 rounded-xl border border-[#374151] bg-[#111827]/95 backdrop-blur shadow-lg px-4 py-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[#9CA3AF]">Running balance</p>
            <p className={`text-sm font-bold ${totals.closing >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              Rs. {formatAmount(totals.closing, 0)}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-[#10B981]">+ Rs. {formatAmount(totals.debit, 0)}</span>
            <span className="text-[#EF4444]">− Rs. {formatAmount(totals.credit, 0)}</span>
          </div>
        </div>
      )}

      {ledgerFallbackNotice && (
        <div className="px-4 pt-2">
          <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-lg text-sm text-amber-100">
            {ledgerFallbackNotice}
          </div>
        </div>
      )}

      <ReportShell loading={detailLoading} empty={!detailLoading && lines.length === 0} emptyLabel="No ledger activity for this period.">
        <ReportCard>
          <ReportSectionTitle
            title="Ledger activity"
            subtitle={dateRangeLabel(range.from, range.to)}
            right={`${lines.length} entries`}
          />
          <ul className="divide-y divide-[#374151]">
            {groupedLines.map((group) => (
              <li key={group.key}>
                {group.label && (
                  <div className="px-4 py-2 bg-[#111827]/60 border-b border-[#374151]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{group.label}</p>
                  </div>
                )}
                <ul className="divide-y divide-[#374151]">
                  {group.lines.map((l) => {
                    // For asset-style accounts (cash/bank) we display debit as
                    // money IN (green) and credit as money OUT (red). This
                    // matches the on-screen semantics users expect.
                    const isIn = l.debit > 0;
                    const amount = isIn ? l.debit : l.credit;
                    const time = l.createdAt ? new Date(l.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '';
                    const refLabel = displayReferenceNumber(l.entryNo, l.referenceType);
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedLine(l)}
                          className="w-full text-left px-4 py-3 hover:bg-[#111827]/60 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                isIn ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#EF4444]/15 text-[#EF4444]'
                              }`}
                            >
                              {isIn ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{l.description || '—'}</p>
                              <p className="text-[11px] text-[#9CA3AF] truncate">
                                {formatDate(l.date)}{time ? ` · ${time}` : ''} · {refLabel} · {(l.referenceType || '').replace(/_/g, ' ') || '—'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded mb-0.5 ${
                                isIn ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#EF4444]/15 text-[#EF4444]'
                              }`}>
                                {isIn ? 'IN' : 'OUT'}
                              </span>
                              <p className={`text-sm font-bold ${isIn ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                {isIn ? '+' : '−'} Rs. {formatAmount(amount, 0)}
                              </p>
                              <p className="text-[10px] text-[#9CA3AF]">Bal Rs. {formatAmount(l.runningBalance, 0)}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {granularity !== 'none' && (
                  <div className="flex items-center justify-between px-4 py-2 bg-[#0F172A] border-t border-[#374151]">
                    <span className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">Closing balance</span>
                    <span className={`text-sm font-bold ${group.closingBalance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      Rs. {formatAmount(group.closingBalance, 0)}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </ReportCard>
      </ReportShell>

      {preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          title={titleOverride ?? 'Account Ledger'}
          filename={`Account_Ledger_${selected.code}_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`${selected.code} — ${selected.name} · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title={titleOverride ?? 'Account Ledger'}
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={`${selected.code} — ${selected.name}`}
            partyMeta={selected.type}
            openingBalance={opening}
            closingBalance={totals.closing}
            totals={{ debit: totals.debit, credit: totals.credit }}
            rows={lines.map((l) => ({
              date: l.date,
              reference: displayReferenceNumber(l.entryNo, l.referenceType),
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              balance: l.runningBalance,
            }))}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}

      {selectedLine && (() => {
        const knownTypes: TransactionReferenceType[] = [
          'sale', 'purchase', 'payment', 'expense', 'expense_payment',
          'rental', 'journal', 'on_account', 'worker_payment', 'studio',
        ];
        const refType: TransactionReferenceType = (
          knownTypes.includes(selectedLine.referenceType as TransactionReferenceType)
            ? (selectedLine.referenceType as TransactionReferenceType)
            : 'journal'
        );
        const refId = refType === 'journal'
          ? selectedLine.journalEntryId
          : (selectedLine.sourceReferenceId ?? selectedLine.journalEntryId);
        return (
          <TransactionDetailSheet
            open
            onClose={() => setSelectedLine(null)}
            companyId={companyId}
            referenceType={refType}
            referenceId={refId}
            fallbackTitle={`${displayReferenceNumber(selectedLine.entryNo, selectedLine.referenceType)} · ${(selectedLine.referenceType || '').replace(/_/g, ' ')}`}
          />
        );
      })()}
    </div>
  );
}
