import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ArrowDownLeft, ArrowUpRight, Users, Search } from 'lucide-react';
import type { User } from '../../../types';
import { getContactSubAccountId, getAccountLedgerLines, type LedgerLine } from '../../../api/reports';
import {
  getSupplierApGlLedgerLinesForContact,
  getCustomerArGlLedgerLinesForContact,
} from '../../../api/partyGlLedger';
import { getContacts, type ContactRole } from '../../../api/contacts';
import { getWorkersWithPayable } from '../../../api/accounts';
import { getWorkerPartyGlLedgerLines } from '../../../api/workerPartyGlLedger';
import {
  fetchContactPartyGlBalancesMap,
  partyGlDueForListRole,
  partyGlSliceFromMap,
} from '../../../api/contactBalancesRpc';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';
import { sortLedgerLinesAndRebuildRunningBalance } from '../../../lib/ledgerChronology';

export type PartyLedgerKind = 'customer' | 'supplier' | 'worker';

interface PartyLedgerReportProps {
  onBack: () => void;
  kind: PartyLedgerKind;
  companyId: string | null;
  /** Same branch semantics as other reports (RPC balances); null = company-wide. */
  branchId?: string | null;
  user: User;
}

interface LocalParty {
  id: string;
  name: string;
  meta?: string;
  balance: number;
}

const KIND_LABELS: Record<PartyLedgerKind, { title: string; plural: string; gradient: 'indigo' | 'rose' | 'emerald' | 'amber' }> = {
  customer: { title: 'Customer Ledger', plural: 'customers', gradient: 'indigo' },
  supplier: { title: 'Supplier Ledger', plural: 'suppliers', gradient: 'amber' },
  worker: { title: 'Worker Ledger', plural: 'workers', gradient: 'emerald' },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const displayEntryNo = (value: string, fallbackType?: string) => {
  const v = (value || '').trim();
  if (!v || UUID_RE.test(v)) return (fallbackType || 'entry').replace('_', ' ').toUpperCase();
  return v;
};

export function PartyLedgerReport({ onBack, kind, companyId, branchId, user }: PartyLedgerReportProps) {
  const cfg = KIND_LABELS[kind];
  const [parties, setParties] = useState<LocalParty[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LocalParty | null>(null);
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));

  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [opening, setOpening] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [listRefreshNonce, setListRefreshNonce] = useState(0);
  const [ledgerRefreshNonce, setLedgerRefreshNonce] = useState(0);
  const [manualLedgerRefresh, setManualLedgerRefresh] = useState(false);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      setListError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setListError(null);

    (async () => {
      try {
        if (kind === 'worker') {
          const [{ data }, partyGl] = await Promise.all([
            getWorkersWithPayable(companyId),
            fetchContactPartyGlBalancesMap(companyId, branchId ?? null),
          ]);
          if (cancelled) return;
          setParties(
            (data || []).map((w) => {
              const slice = partyGlSliceFromMap(partyGl.map, w.id);
              const balance =
                !partyGl.error && slice
                  ? partyGlDueForListRole(slice, 'worker')
                  : Number(w.totalPayable || 0);
              return {
                id: w.id,
                name: w.name,
                meta: w.type || w.phone || undefined,
                balance,
              };
            }),
          );
        } else {
          const role = kind as ContactRole;
          const { data, error } = await getContacts(companyId, role, branchId ?? null);
          if (cancelled) return;
          if (error) {
            setParties([]);
            setListError(error);
            return;
          }
          setParties(
            (data || []).map((c) => ({
              id: c.id,
              name: c.name,
              meta: [c.phone, c.email].filter(Boolean).join(' · ') || undefined,
              balance: Number(c.balance || 0),
            })),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, kind, branchId, listRefreshNonce]);

  useEffect(() => {
    if (!companyId || !selected) {
      setLines([]);
      setOpening(0);
      setManualLedgerRefresh(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    (async () => {
      try {
        if (kind === 'worker') {
          const rpcRes = await getWorkerPartyGlLedgerLines(
            companyId,
            selected.id,
            branchId ?? null,
            range.from || undefined,
            range.to || undefined,
          );
          if (cancelled) return;
          if (rpcRes.error) {
            setDetailError(rpcRes.error);
            setOpening(0);
            setLines([]);
            return;
          }
          setOpening(rpcRes.openingBalance);
          setLines(sortLedgerLinesAndRebuildRunningBalance(rpcRes.lines, rpcRes.openingBalance));
          setDetailError(null);
        } else {
          const rpcLoad =
            kind === 'supplier'
              ? getSupplierApGlLedgerLinesForContact(
                  companyId,
                  selected.id,
                  branchId ?? null,
                  range.from || undefined,
                  range.to || undefined,
                )
              : getCustomerArGlLedgerLinesForContact(
                  companyId,
                  selected.id,
                  branchId ?? null,
                  range.from || undefined,
                  range.to || undefined,
                );

          const rpcRes = await rpcLoad;
          if (cancelled) return;

          if (!rpcRes.error) {
            setOpening(rpcRes.openingBalance);
            setLines(sortLedgerLinesAndRebuildRunningBalance(rpcRes.lines, rpcRes.openingBalance));
            setDetailError(null);
          } else {
            const subId = await getContactSubAccountId(companyId, selected.id);
            if (cancelled) return;
            if (!subId) {
              setOpening(0);
              setLines([]);
              setDetailError(
                `${rpcRes.error} · No linked sub-account for legacy fallback.`,
              );
              return;
            }
            const { openingBalance, lines: rows, error } = await getAccountLedgerLines(
              companyId,
              subId,
              range.from || undefined,
              range.to || undefined,
              branchId ?? null,
            );
            if (cancelled) return;
            setOpening(openingBalance);
            setLines(sortLedgerLinesAndRebuildRunningBalance(rows, openingBalance));
            setDetailError(
              error
                ? `${rpcRes.error} · Fallback: ${error}`
                : `Showing sub-account only (${rpcRes.error}). Totals may not match web AP/AR statement.`,
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : 'Failed to load ledger');
          setLines([]);
          setOpening(0);
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
  }, [companyId, selected, kind, range.from, range.to, branchId, ledgerRefreshNonce]);

  useEffect(() => {
    if (!selected) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') setLedgerRefreshNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [selected?.id]);

  useEffect(() => {
    if (selected) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') setListRefreshNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [selected]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    const closing = lines.length ? lines[lines.length - 1].runningBalance : opening;
    return { debit, credit, closing };
  }, [lines, opening]);

  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.meta ?? '').toLowerCase().includes(q),
    );
  }, [parties, search]);

  // List view
  if (!selected) {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <ReportHeader
          onBack={onBack}
          title={cfg.title}
          subtitle={`Select ${cfg.plural === 'customers' ? 'a customer' : cfg.plural === 'suppliers' ? 'a supplier' : 'a worker'}`}
          gradient={cfg.gradient}
          onRefresh={() => setListRefreshNonce((n) => n + 1)}
          refreshing={loading}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${cfg.plural}...`}
              className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/60"
            />
          </div>
        </ReportHeader>

        <ReportShell
          loading={loading}
          error={listError}
          empty={!loading && !listError && filteredParties.length === 0}
          emptyLabel={`No ${cfg.plural} found.`}
        >
          <ul className="space-y-2">
            {filteredParties.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelected(p)}
                  className="w-full bg-[#1F2937] border border-[#374151] hover:border-[#6366F1] rounded-xl p-3.5 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#111827] border border-[#374151] flex items-center justify-center">
                      <Users className="w-4 h-4 text-[#9CA3AF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      {p.meta && <p className="text-[11px] text-[#9CA3AF] truncate">{p.meta}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-bold ${
                          Math.abs(p.balance) < 0.01
                            ? 'text-[#9CA3AF]'
                            : p.balance > 0
                            ? kind === 'supplier' || kind === 'worker'
                              ? 'text-[#F59E0B]'
                              : 'text-[#10B981]'
                            : 'text-[#EF4444]'
                        }`}
                      >
                        Rs. {formatAmount(Math.abs(p.balance), 0)}
                      </p>
                      <p className="text-[10px] text-[#6B7280]">
                        {Math.abs(p.balance) < 0.01
                          ? 'Settled'
                          : kind === 'customer'
                          ? p.balance > 0
                            ? 'Receivable'
                            : 'Advance'
                          : p.balance > 0
                          ? 'Payable'
                          : 'Advance'}
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

  // Detail view
  const stats = [
    { label: 'Opening', value: `Rs. ${formatAmount(opening, 0)}` },
    { label: 'Debit', value: `Rs. ${formatAmount(totals.debit, 0)}`, color: 'text-[#FDE68A]' },
    { label: 'Credit', value: `Rs. ${formatAmount(totals.credit, 0)}`, color: 'text-[#BBF7D0]' },
    { label: 'Closing', value: `Rs. ${formatAmount(totals.closing, 0)}` },
  ];

  const detailPartySubtitle =
    branchId && branchId !== 'all' && branchId !== 'default'
      ? `${selected.meta || cfg.title} · GL: this branch + company-wide`
      : selected.meta || cfg.title;

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={() => setSelected(null)}
        title={selected.name}
        subtitle={detailPartySubtitle}
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient={cfg.gradient}
        onRefresh={() => {
          setManualLedgerRefresh(true);
          setLedgerRefreshNonce((n) => n + 1);
        }}
        refreshing={manualLedgerRefresh && detailLoading}
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>

      <ReportShell
        loading={detailLoading}
        error={detailError}
        empty={!detailLoading && lines.length === 0}
        emptyLabel="No ledger activity for this period."
      >
        <ReportCard>
          <ReportSectionTitle
            title="Ledger activity"
            subtitle={dateRangeLabel(range.from, range.to)}
            right={`${lines.length} entries`}
          />
          <ul className="divide-y divide-[#374151]">
            {lines.map((l) => {
              const isDebit = l.debit > 0;
              const amount = isDebit ? l.debit : l.credit;
              return (
                <li key={l.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        isDebit ? 'bg-[#F59E0B]/15 text-[#F59E0B]' : 'bg-[#10B981]/15 text-[#10B981]'
                      }`}
                    >
                      {isDebit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-semibold text-white truncate">{l.description || '—'}</p>
                      </div>
                      <p className="text-[11px] text-[#9CA3AF] truncate">
                        {formatDate(l.date)} · {displayEntryNo(l.entryNo, l.referenceType)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isDebit ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                        {isDebit ? '+' : '−'} Rs. {formatAmount(amount, 0)}
                      </p>
                      <p className="text-[10px] text-[#9CA3AF]">Bal Rs. {formatAmount(l.runningBalance, 0)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </ReportCard>
      </ReportShell>

      {preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          title={cfg.title}
          filename={`${cfg.title.replace(/\s+/g, '_')}_${selected.name.replace(/\s+/g, '_')}_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`${cfg.title} — ${selected.name} · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title={cfg.title}
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={selected.name}
            partyMeta={selected.meta}
            openingBalance={opening}
            closingBalance={totals.closing}
            totals={{ debit: totals.debit, credit: totals.credit }}
            rows={lines.map((l) => ({
              date: l.date,
              reference: displayEntryNo(l.entryNo, l.referenceType),
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
    </div>
  );
}
