import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Users, Search } from 'lucide-react';
import type { User } from '../../../types';
import { getContactSubAccountId, getAccountLedgerLines, type LedgerLine } from '../../../api/reports';
import {
  getSupplierApGlLedgerLinesForContact,
  getCustomerArGlLedgerLinesForContact,
  isPartyGlLedgerEmptySuccess,
} from '../../../api/partyGlLedger';
import { loadPartyLedger, type LoaderMetadata } from '../../../api/singleCore';
import { AccountingLoaderDebugBadge } from './_shared/AccountingLoaderDebugBadge';
import { LoaderSourceBadge } from './_shared/LoaderSourceBadge';
import { usePermissions } from '../../../context/PermissionContext';
import { getContacts, getContactWhatsAppPhone, type ContactRole } from '../../../api/contacts';
import { getWorkersWithPayable } from '../../../api/accounts';
import { getWorkerPartyGlLedgerLines } from '../../../api/workerPartyGlLedger';
import { getWorkerOperationalLedgerLines } from '../../../api/workerOperationalLedger';
import {
  fetchContactPartyGlBalancesMap,
  partyGlDueForListRole,
  partyGlSliceFromMap,
} from '../../../api/contactBalancesRpc';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import {
  LedgerPeriodEmptyCard,
  allTimeDateRange,
  isOpeningOnlyPeriod,
  isTrulyEmptyLedger,
} from './_shared/LedgerPeriodEmptyCard';
import { formatAmount, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';
import { sortLedgerLinesAndRebuildRunningBalance } from '../../../lib/ledgerChronology';
import { useAttachmentPreview } from '../../../hooks/useAttachmentPreview';
import { LedgerActivityListRow } from './_shared/LedgerActivityListRow';
import { isEasyReportHubMode, useReportHubMode } from './_shared/ReportHubModeContext';
import { loadMergedAttachmentsForJournalEntry } from '../../../lib/loadMergedAttachments';
import { toLedgerPreviewRow } from '../../../lib/ledgerLinePresentation';

export type PartyLedgerKind = 'customer' | 'supplier' | 'worker';

interface PartyLedgerReportProps {
  onBack: () => void;
  kind: PartyLedgerKind;
  companyId: string | null;
  /** Same branch semantics as other reports (RPC balances); null = company-wide. */
  branchId?: string | null;
  user: User;
  reportRefreshEpoch?: number;
}

interface LocalParty {
  id: string;
  name: string;
  meta?: string;
  balance: number;
  sharePhone?: string;
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

export function PartyLedgerReport({ onBack, kind, companyId, branchId, user, reportRefreshEpoch = 0 }: PartyLedgerReportProps) {
  const cfg = KIND_LABELS[kind];
  const hubMode = useReportHubMode();
  const easyMode = isEasyReportHubMode(hubMode);
  const { isAdminOrOwner } = usePermissions();
  const showLoaderDebug = isAdminOrOwner && !easyMode;
  const [parties, setParties] = useState<LocalParty[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LocalParty | null>(null);
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('all'));

  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [opening, setOpening] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [listRefreshNonce, setListRefreshNonce] = useState(0);
  const [ledgerRefreshNonce, setLedgerRefreshNonce] = useState(0);
  const [manualLedgerRefresh, setManualLedgerRefresh] = useState(false);
  const [ledgerSourceHint, setLedgerSourceHint] = useState<string | null>(null);
  const [loaderMeta, setLoaderMeta] = useState<LoaderMetadata | null>(null);
  const preview = usePdfPreview(companyId);
  const { openAttachmentPreview, AttachmentPreviewPortal } = useAttachmentPreview();

  const handleLineAttachmentPreview = async (l: LedgerLine) => {
    if (!companyId) return;
    const items = await loadMergedAttachmentsForJournalEntry(companyId, {
      journalEntryId: l.journalEntryId,
      referenceType: l.referenceType,
      referenceId: l.sourceReferenceId,
      paymentId: l.paymentId,
    });
    if (items.length) openAttachmentPreview(items, 0);
  };

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      setListError(null);
      setSelected(null);
      setLines([]);
      setOpening(0);
      setDetailError(null);
      setLoaderMeta(null);
      return;
    }
    setSelected(null);
    setLines([]);
    setOpening(0);
    setDetailError(null);
    setLoaderMeta(null);
    setLedgerSourceHint(null);
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
                sharePhone: (w.phone ?? '').trim() || undefined,
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
              sharePhone: getContactWhatsAppPhone(c) || undefined,
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
  }, [companyId, kind, branchId, listRefreshNonce, reportRefreshEpoch]);

  useEffect(() => {
    if (reportRefreshEpoch === 0) return;
    setLedgerRefreshNonce((n) => n + 1);
  }, [reportRefreshEpoch]);

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
          // Canonical path: unified party ledger when party_ledger flags ON (RPC supports worker).
          // Web production main still uses GL 2010/1180; operational ledger is labelled fallback only.
          const uni = await loadPartyLedger({
            companyId,
            partyType: 'worker',
            partyId: selected.id,
            branchId: branchId ?? null,
            dateFrom: range.from || '',
            dateTo: range.to || '',
            basis: 'official_gl',
          });
          if (cancelled) return;

          if (!uni.error && uni.meta.source === 'unified') {
            setOpening(uni.openingBalance);
            setLines(sortLedgerLinesAndRebuildRunningBalance(uni.lines, uni.openingBalance));
            setDetailError(null);
            setLedgerSourceHint('Official GL (unified party ledger · worker 2010/1180)');
            setLoaderMeta(uni.meta);
            return;
          }

          const unifiedHardFail =
            !!uni.error && uni.error.code !== 'flags_off' && uni.error.code !== 'kill_switch';

          const glRes = await getWorkerPartyGlLedgerLines(
            companyId,
            selected.id,
            branchId ?? null,
            range.from || undefined,
            range.to || undefined,
          );
          if (cancelled) return;

          if (!glRes.error && (glRes.lines.length > 0 || Math.abs(glRes.openingBalance) >= 0.005)) {
            setOpening(glRes.openingBalance);
            setLines(sortLedgerLinesAndRebuildRunningBalance(glRes.lines, glRes.openingBalance));
            setDetailError(
              unifiedHardFail
                ? `Unified worker ledger failed (${uni.error?.message}). Showing labelled legacy GL (2010/1180).`
                : null,
            );
            setLedgerSourceHint('Official GL journal (2010 / 1180) — web Worker Ledger parity');
            setLoaderMeta({
              ...uni.meta,
              source: 'legacy',
              resultKind: unifiedHardFail ? 'fallback' : 'ok',
              fallbackReason: unifiedHardFail
                ? uni.error?.message ?? 'unified_failed'
                : uni.error?.code === 'flags_off' || uni.error?.code === 'kill_switch'
                  ? uni.error.code
                  : null,
              rpcName: 'getWorkerPartyGlJournalLedger',
            });
            return;
          }

          const opRes = await getWorkerOperationalLedgerLines(
            companyId,
            selected.id,
            range.from || undefined,
            range.to || undefined,
          );
          if (cancelled) return;

          if (opRes.lines.length > 0 || Math.abs(opRes.openingBalance) >= 0.005) {
            setOpening(opRes.openingBalance);
            setLines(opRes.lines);
            setDetailError(
              [
                unifiedHardFail ? `Unified failed (${uni.error?.message})` : null,
                glRes.error ? `GL: ${glRes.error}` : 'GL empty for period',
                'Showing operational worker ledger (studio jobs & payments) — not official GL closing.',
                opRes.error,
              ]
                .filter(Boolean)
                .join(' · '),
            );
            setLedgerSourceHint('Operational worker_ledger_entries (not official GL)');
            setLoaderMeta({
              ...uni.meta,
              source: 'legacy',
              resultKind: 'fallback',
              fallbackReason: 'operational_worker_ledger_after_gl_empty',
              rpcName: 'getWorkerLedgerEntries',
            });
            return;
          }

          setOpening(0);
          setLines([]);
          setDetailError(
            [uni.error?.message, glRes.error, opRes.error].filter(Boolean).join(' · ') ||
              (unifiedHardFail ? `Unified worker ledger failed (${uni.error?.message}).` : null),
          );
          setLedgerSourceHint(null);
          setLoaderMeta({
            ...uni.meta,
            source: uni.meta.source === 'unified' ? 'unified' : 'legacy',
            resultKind: uni.error && uni.error.code !== 'flags_off' ? 'error' : 'empty',
            fallbackReason: uni.error?.message ?? glRes.error ?? null,
            rpcName: null,
          });
        } else {
          // Prefer unified party ledger when engine + loader + screen flags are ON.
          const uni = await loadPartyLedger({
            companyId,
            partyType: kind === 'supplier' ? 'supplier' : 'customer',
            partyId: selected.id,
            branchId: branchId ?? null,
            dateFrom: range.from || '',
            dateTo: range.to || '',
            basis: 'official_gl',
          });
          if (cancelled) return;

          if (!uni.error && uni.meta.source === 'unified') {
            setOpening(uni.openingBalance);
            setLines(sortLedgerLinesAndRebuildRunningBalance(uni.lines, uni.openingBalance));
            setDetailError(null);
            setLedgerSourceHint(null);
            setLoaderMeta(uni.meta);
            return;
          }

          // Unified failed (not flags_off): show error; still allow explicit labelled legacy fallback.
          const unifiedHardFail =
            !!uni.error && uni.error.code !== 'flags_off' && uni.error.code !== 'kill_switch';

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

          const needFallback = !!rpcRes.error || isPartyGlLedgerEmptySuccess(rpcRes);
          if (!needFallback) {
            setOpening(rpcRes.openingBalance);
            setLines(sortLedgerLinesAndRebuildRunningBalance(rpcRes.lines, rpcRes.openingBalance));
            setDetailError(
              unifiedHardFail
                ? `Unified party ledger failed (${uni.error?.message}). Showing labelled legacy party GL.`
                : null,
            );
            setLoaderMeta({
              ...uni.meta,
              source: 'legacy',
              resultKind: unifiedHardFail ? 'fallback' : 'ok',
              fallbackReason: unifiedHardFail
                ? uni.error?.message ?? 'unified_failed'
                : uni.error?.code === 'flags_off'
                  ? 'flags_off'
                  : null,
              rpcName: kind === 'supplier'
                ? 'get_supplier_ap_gl_ledger_for_contact'
                : 'get_customer_ar_gl_ledger_for_contact',
            });
          } else {
            const subId = await getContactSubAccountId(companyId, selected.id);
            if (cancelled) return;
            if (!subId) {
              setOpening(rpcRes.error ? 0 : rpcRes.openingBalance);
              setLines(rpcRes.error ? [] : rpcRes.lines);
              setDetailError(
                rpcRes.error
                  ? `${rpcRes.error} · No linked sub-account for legacy fallback.`
                  : unifiedHardFail
                    ? `Unified party ledger failed (${uni.error?.message}). No activity on legacy party GL.`
                    : null,
              );
              setLoaderMeta({
                ...uni.meta,
                source: 'legacy',
                resultKind: 'error',
                fallbackReason: rpcRes.error ?? uni.error?.message ?? null,
                rpcName: null,
              });
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
            const fbHasData = rows.length > 0 || Math.abs(openingBalance) >= 0.005;
            if (fbHasData) {
              setOpening(openingBalance);
              setLines(sortLedgerLinesAndRebuildRunningBalance(rows, openingBalance));
              setDetailError(
                error
                  ? `${rpcRes.error ?? 'Party GL empty'} · Fallback: ${error}`
                  : rpcRes.error
                    ? `Showing sub-account only (${rpcRes.error}). Totals may not match web AP/AR statement.`
                    : 'Party GL empty for this contact — showing lines posted to linked sub-account (legacy fallback).',
              );
              setLoaderMeta({
                ...uni.meta,
                source: 'legacy',
                resultKind: 'fallback',
                fallbackReason: 'sub_account_journal_lines',
                rpcName: 'getAccountLedgerLines',
              });
            } else {
              setOpening(rpcRes.error ? 0 : rpcRes.openingBalance);
              setLines([]);
              setDetailError(
                rpcRes.error ||
                  (unifiedHardFail
                    ? `Unified party ledger failed (${uni.error?.message}).`
                    : null),
              );
              setLoaderMeta({
                ...uni.meta,
                source: 'legacy',
                resultKind: 'empty',
                fallbackReason: uni.error?.message ?? null,
                rpcName: null,
              });
            }
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

  const detailPartySubtitle = [
    branchId && branchId !== 'all' && branchId !== 'default'
      ? `${selected.meta || cfg.title} · GL: this branch + company-wide`
      : selected.meta || cfg.title,
    kind === 'worker' && ledgerSourceHint ? ledgerSourceHint : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={() => {
          setSelected(null);
          setLedgerSourceHint(null);
          setLoaderMeta(null);
        }}
        title={selected.name}
        subtitle={detailPartySubtitle}
        stats={stats}
        onShare={easyMode ? undefined : preview.openPreview}
        sharing={preview.loading}
        gradient={cfg.gradient}
        onRefresh={() => {
          setManualLedgerRefresh(true);
          setLedgerRefreshNonce((n) => n + 1);
        }}
        refreshing={manualLedgerRefresh && detailLoading}
        rightExtras={
          loaderMeta ? (
            <LoaderSourceBadge source={loaderMeta.source} hidden={!showLoaderDebug} />
          ) : undefined
        }
      >
        <DateRangeBar value={range} onChange={setRange} companyId={companyId} branchId={branchId} />
      </ReportHeader>

      <AccountingLoaderDebugBadge meta={loaderMeta} hidden={!showLoaderDebug} />

      {detailError && (lines.length > 0 || isOpeningOnlyPeriod(lines.length, opening)) && (
        <div className="px-4 pt-2">
          <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-lg text-sm text-amber-100">
            {detailError}
          </div>
        </div>
      )}

      <ReportShell
        loading={detailLoading}
        error={
          lines.length > 0 || isOpeningOnlyPeriod(lines.length, opening) ? null : detailError
        }
        empty={!detailLoading && isTrulyEmptyLedger(lines.length, opening) && !detailError}
        emptyLabel="No ledger activity for this period."
      >
        {isOpeningOnlyPeriod(lines.length, opening) ? (
          <LedgerPeriodEmptyCard
            opening={opening}
            periodLabel={dateRangeLabel(range.from, range.to)}
            onShowAllTime={() => setRange(allTimeDateRange())}
          />
        ) : (
        <ReportCard>
          <ReportSectionTitle
            title="Ledger activity"
            subtitle={dateRangeLabel(range.from, range.to)}
            right={`${lines.length} entries`}
          />
          <ul className="divide-y divide-[#374151]">
            {lines.map((l) => (
              <LedgerActivityListRow
                key={l.id}
                line={l}
                displayReference={displayEntryNo}
                presentationOpts={{ viewedPartyName: selected.name }}
                onAttachmentClick={() => void handleLineAttachmentPreview(l)}
              />
            ))}
          </ul>
        </ReportCard>
        )}
      </ReportShell>

      {preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          title={cfg.title}
          filename={`${cfg.title.replace(/\s+/g, '_')}_${selected.name.replace(/\s+/g, '_')}_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          sharePhone={selected.sharePhone}
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
            rows={lines.map((l) =>
              toLedgerPreviewRow(l, displayEntryNo(l.entryNo, l.referenceType), {
                viewedPartyName: selected.name,
              }),
            )}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}
      {AttachmentPreviewPortal}
    </div>
  );
}
