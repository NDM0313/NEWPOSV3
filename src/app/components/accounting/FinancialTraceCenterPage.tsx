import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Loader2,
  Printer,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { cn } from '@/app/components/ui/utils';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { toast } from 'sonner';
import { resolveArApReconciliationAccess } from '@/app/lib/arApReconciliationAccess';
import { markOpenArApHybridRepair } from '@/app/lib/arApHybridRepairNav';
import { detectRental1100LeakageDefects } from '@/app/lib/arControlOrphanRepair';
import {
  fetchGlCorrectionEntryNo,
  isGlCorrectionDefectResolved,
} from '@/app/lib/glCorrectionResolveStatus';
import {
  basisBadgeClass,
  basisBadgeLabel,
  classifyRentalPaymentRow,
  classifyUnmappedJournal,
  classifyUnpostedDocument,
  DIVERGENCE_LABELS,
  divergenceBadgeClass,
  KNOWN_TRACE_CASES,
  type BasisBadge,
  type DivergenceCode,
} from '@/app/lib/financialTraceClassification';
import {
  buildOverviewSummaryText,
  copyTraceSummary,
  downloadCsv,
} from '@/app/lib/financialTraceExport';
import {
  enrichUnmappedWithPayment,
  fetchFinancialTraceOverview,
  fetchPartyTrace,
  fetchRentalTrace,
  fetchTraceQueues,
  searchFinancialTrace,
  type FinancialTraceOverview,
  type PartySearchHit,
  type PartyTraceResult,
  type RentalTraceResult,
} from '@/app/services/financialTraceCenterService';
import {
  fetchFinancialTruthTieOut,
  type FinancialTruthTieOutResult,
} from '@/app/services/financialTruthTieOutService';
import type { TieOutDrilldownTarget } from '@/app/lib/financialTruthTieOut';
import type { UnmappedJournalRow, UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';

export type FinancialTraceTabId =
  | 'tieout'
  | 'overview'
  | 'party'
  | 'rental'
  | 'metadata'
  | 'non-final'
  | 'deeper';

export type FinancialTraceDiagnosticsPanelProps = {
  embedded?: boolean;
  /** When set, only these trace sub-tabs render (embedded hub sections). */
  visibleTabs?: FinancialTraceTabId[];
  initialTab?: FinancialTraceTabId;
  onOpenHybridRepair?: () => void;
  onSwitchHubTab?: (tab: string) => void;
};

const ALL_TRACE_TABS: FinancialTraceTabId[] = [
  'tieout',
  'overview',
  'party',
  'rental',
  'metadata',
  'non-final',
  'deeper',
];

const TRACE_TAB_LABELS: Record<FinancialTraceTabId, string> = {
  tieout: 'Tie-out',
  overview: 'Overview',
  party: 'Party Trace',
  rental: 'Rental Trace',
  metadata: 'Metadata Review',
  'non-final': 'Non-final Docs',
  deeper: 'D7 Deeper Trace',
};

function BasisBadge({ basis }: { basis: BasisBadge }) {
  return (
    <Badge variant="outline" className={cn('text-xs', basisBadgeClass(basis))}>
      {basisBadgeLabel(basis)}
    </Badge>
  );
}

function CodeBadge({ code }: { code: DivergenceCode }) {
  return (
    <Badge variant="outline" className={cn('text-xs font-mono', divergenceBadgeClass(code))}>
      {code} — {DIVERGENCE_LABELS[code]}
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  basis,
  warn,
}: {
  label: string;
  value: string;
  basis?: BasisBadge;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 bg-gray-900/40',
        warn ? 'border-amber-500/50' : 'border-gray-700'
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        {basis && <BasisBadge basis={basis} />}
      </div>
      <p className={cn('text-xl font-semibold tabular-nums', warn && 'text-amber-200')}>{value}</p>
    </div>
  );
}

function CrossLinkBar({
  contactId,
  contactName,
  onNavigate,
  embedded,
  onOpenDeveloperCenter,
}: {
  contactId?: string | null;
  contactName?: string | null;
  onNavigate: (view: string, url?: string, cId?: string, cName?: string) => void;
  embedded?: boolean;
  onOpenDeveloperCenter?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <Button variant="outline" size="sm" className="border-gray-600" onClick={() => onNavigate('accounting')}>
        <BookOpen className="h-3 w-3 mr-1" /> Account Ledger
      </Button>
      {contactId && (
        <Button
          variant="outline"
          size="sm"
          className="border-gray-600"
          onClick={() => onNavigate('party-ledger', undefined, contactId, contactName ?? undefined)}
        >
          Party Statement
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="border-gray-600"
        onClick={() => onNavigate('accounting')}
      >
        Account Statements
      </Button>
      {!embedded && (
        <Button
          variant="outline"
          size="sm"
          className="border-gray-600"
          onClick={() => onNavigate('ar-ap-reconciliation-center')}
        >
          <Scale className="h-3 w-3 mr-1" /> AR/AP Reconciliation
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="border-gray-600"
        onClick={() =>
          onOpenDeveloperCenter
            ? onOpenDeveloperCenter()
            : onNavigate('dev-center', '/admin/accounting-developer-center')
        }
      >
        <ExternalLink className="h-3 w-3 mr-1" /> Developer Center
      </Button>
    </div>
  );
}

export function FinancialTraceDiagnosticsPanel({
  embedded = false,
  visibleTabs,
  initialTab,
  onOpenHybridRepair,
  onSwitchHubTab,
}: FinancialTraceDiagnosticsPanelProps = {}) {
  const { setCurrentView, openPartyLedger, setAccountingTabInitial } = useNavigation();
  const { companyId, userRole } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const access = resolveArApReconciliationAccess(userRole);

  const tabsToShow = useMemo(() => {
    if (visibleTabs?.length) return visibleTabs;
    if (embedded) return ALL_TRACE_TABS.filter((t) => t !== 'overview');
    return ALL_TRACE_TABS;
  }, [embedded, visibleTabs]);

  const [tab, setTab] = useState<FinancialTraceTabId>(() => {
    if (initialTab && tabsToShow.includes(initialTab)) return initialTab;
    return tabsToShow[0] ?? 'tieout';
  });

  useEffect(() => {
    if (!tabsToShow.includes(tab)) setTab(tabsToShow[0] ?? 'tieout');
  }, [tab, tabsToShow]);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<FinancialTraceOverview | null>(null);
  const [queues, setQueues] = useState<{
    unposted: UnpostedDocumentRow[];
    unmapped: UnmappedJournalRow[];
    manualCount: number;
    unpostedStatuses: Map<string, string | null>;
  } | null>(null);
  const [paymentMeta, setPaymentMeta] = useState<
    Map<string, { reference_type?: string | null; contact_id?: string | null; reference_number?: string | null; linked_contact_id?: string | null }>
  >(new Map());

  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<PartySearchHit[]>([]);
  const [partyTrace, setPartyTrace] = useState<PartyTraceResult | null>(null);
  const [rentalLeakagePending, setRentalLeakagePending] = useState<number | null>(null);
  const [resolvedTraceEntryNos, setResolvedTraceEntryNos] = useState<Record<string, string | null>>({});
  const [partyLoading, setPartyLoading] = useState(false);

  const [rentalQ, setRentalQ] = useState('REN-0002');
  const [rentalTrace, setRentalTrace] = useState<RentalTraceResult | null>(null);
  const [rentalLoading, setRentalLoading] = useState(false);
  const [tieOut, setTieOut] = useState<FinancialTruthTieOutResult | null>(null);

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [ov, q, tie] = await Promise.all([
        fetchFinancialTraceOverview(companyId),
        fetchTraceQueues(companyId),
        fetchFinancialTruthTieOut(companyId),
      ]);
      setOverview(ov);
      setQueues(q);
      setTieOut(tie);
      const meta = await enrichUnmappedWithPayment(companyId, q.unmapped.slice(0, 40));
      setPaymentMeta(meta);
    } catch (e) {
      console.warn('[FinancialTrace]', e);
      toast.error('Failed to load trace data');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (access.canAccess && companyId) loadAll();
  }, [access.canAccess, companyId, loadAll]);

  useEffect(() => {
    if (!companyId || !access.canUseHybridRepair) {
      setRentalLeakagePending(null);
      return;
    }
    let cancelled = false;
    void detectRental1100LeakageDefects(companyId, null).then((rows) => {
      if (!cancelled) setRentalLeakagePending(rows.length);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, access.canUseHybridRepair, overview?.asOfDate]);

  const openHybridRepair = useCallback(() => {
    if (onOpenHybridRepair) {
      onOpenHybridRepair();
      return;
    }
    markOpenArApHybridRepair();
    setCurrentView('ar-ap-reconciliation-center');
  }, [onOpenHybridRepair, setCurrentView]);

  const openDeveloperCenter = useCallback(() => {
    window.history.pushState({}, '', '/admin/accounting-developer-center');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  const navigateCross = useCallback(
    (view: string, url?: string, contactId?: string, contactName?: string) => {
      if (url) {
        window.history.pushState({}, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }
      if (view === 'party-ledger' && contactId) {
        openPartyLedger?.({
          contactId,
          contactName: contactName ?? undefined,
          contactType: 'customer',
        });
        return;
      }
      if (view === 'accounting') {
        setAccountingTabInitial('account_statements');
        setCurrentView('accounting');
        return;
      }
      setCurrentView(view as never);
    },
    [openPartyLedger, setAccountingTabInitial, setCurrentView]
  );

  const handleTieOutDrilldown = useCallback(
    (target: TieOutDrilldownTarget) => {
      switch (target) {
        case 'trial_balance':
        case 'balance_sheet':
        case 'profit_loss':
          setCurrentView('reports');
          break;
        case 'ar_ap_center':
          if (onSwitchHubTab) onSwitchHubTab('queues');
          else setCurrentView('ar-ap-reconciliation-center');
          break;
        case 'account_statements':
          setCurrentView('accounting');
          break;
        case 'cash_flow':
          setCurrentView('accounting');
          break;
        case 'party_trace':
          setTab('party');
          break;
        default:
          break;
      }
    },
    [onSwitchHubTab, setCurrentView]
  );

  useEffect(() => {
    if (!companyId) {
      setResolvedTraceEntryNos({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const traceCases = KNOWN_TRACE_CASES.filter((c) => c.glCorrectionDefectId);
      const entries: Record<string, string | null> = {};
      await Promise.all(
        traceCases.map(async (c) => {
          const defectId = c.glCorrectionDefectId!;
          const applied = await isGlCorrectionDefectResolved(companyId, defectId);
          if (applied) {
            entries[c.id] = await fetchGlCorrectionEntryNo(companyId, defectId);
          }
        })
      );
      if (!cancelled) setResolvedTraceEntryNos(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, overview?.asOfDate]);

  const regressionQuickLinks = useMemo(
    () =>
      KNOWN_TRACE_CASES.filter((c) =>
        ['inayat-ren-0002', 'saqib-rcv-0008', 'hq-sl-0003-orphan-ar'].includes(c.id)
      ).filter((c) => !(c.id in resolvedTraceEntryNos)),
    [resolvedTraceEntryNos]
  );

  const metadataRows = useMemo(() => {
    if (!queues) return [];
    return queues.unmapped
      .map((row) => {
        const meta = paymentMeta.get(row.journal_line_id);
        const cls = classifyUnmappedJournal(row, meta, meta?.linked_contact_id);
        if (cls.code !== 'D3') return null;
        return { row, cls, meta };
      })
      .filter(Boolean) as Array<{
      row: UnmappedJournalRow;
      cls: ReturnType<typeof classifyUnmappedJournal>;
      meta: typeof paymentMeta extends Map<string, infer V> ? V : never;
    }>;
  }, [queues, paymentMeta]);

  const nonFinalRows = useMemo(() => {
    if (!queues) return [];
    return queues.unposted.map((row) => {
      const st = queues.unpostedStatuses.get(`${row.source_type}:${row.source_id}`) ?? null;
      const cls = classifyUnpostedDocument(row, st);
      return { row, cls, status: st };
    });
  }, [queues]);

  const deeperRows = useMemo(
    () => KNOWN_TRACE_CASES.filter((c) => c.codes.includes('D7') && !(c.id in resolvedTraceEntryNos)),
    [resolvedTraceEntryNos]
  );

  const resolvedDeeperRows = useMemo(
    () => KNOWN_TRACE_CASES.filter((c) => c.codes.includes('D7') && c.id in resolvedTraceEntryNos),
    [resolvedTraceEntryNos]
  );

  const runSearch = useCallback(async () => {
    if (!companyId || searchQ.trim().length < 2) return;
    const hits = await searchFinancialTrace(companyId, searchQ);
    setSearchHits(hits);
  }, [companyId, searchQ]);

  const loadParty = useCallback(
    async (contactId: string) => {
      if (!companyId) return;
      setPartyLoading(true);
      try {
        const trace = await fetchPartyTrace(companyId, contactId);
        setPartyTrace(trace);
        setTab('party');
      } finally {
        setPartyLoading(false);
      }
    },
    [companyId]
  );

  const loadRental = useCallback(async () => {
    if (!companyId || !rentalQ.trim()) return;
    setRentalLoading(true);
    try {
      const trace = await fetchRentalTrace(companyId, rentalQ.trim());
      setRentalTrace(trace);
      if (!trace) toast.info('No rental found for that booking number');
    } finally {
      setRentalLoading(false);
    }
  }, [companyId, rentalQ]);

  useEffect(() => {
    if (tab === 'rental' && !rentalTrace && companyId) {
      void loadRental();
    }
  }, [tab, rentalTrace, companyId, loadRental]);

  const handleExportOverview = () => {
    if (!overview || !queues) return;
    downloadCsv(
      `financial-trace-overview-${overview.asOfDate}.csv`,
      [
        {
          metric: 'GL AR net',
          value: overview.summary.gl_ar_net_dr_minus_cr,
          basis: 'GL',
        },
        {
          metric: '1100 control',
          value: overview.control1100Net,
          basis: 'GL',
        },
        {
          metric: 'AR-CUS sum',
          value: overview.arCusSubledgerSum,
          basis: 'GL',
        },
        {
          metric: 'Ops sales due',
          value: overview.operationalSalesDueSum,
          basis: 'Operational',
        },
        { metric: 'Unposted', value: queues.unposted.length, basis: 'Heuristic' },
        { metric: 'Unmapped AR', value: overview.summary.unmapped_ar_je_count, basis: 'Heuristic' },
      ],
      ['metric', 'value', 'basis']
    );
  };

  const handleCopySummary = async () => {
    if (!overview || !queues) return;
    const text = buildOverviewSummaryText({
      asOfDate: overview.asOfDate,
      glArNet: overview.summary.gl_ar_net_dr_minus_cr,
      glApNet: overview.summary.gl_ap_net_credit,
      control1100: overview.control1100Net,
      arCusSum: overview.arCusSubledgerSum,
      opsSalesDue: overview.operationalSalesDueSum,
      unposted: queues.unposted.length,
      unmappedAr: overview.summary.unmapped_ar_je_count,
      manual: queues.manualCount,
    });
    const ok = await copyTraceSummary(text);
    toast[ok ? 'success' : 'error'](ok ? 'Summary copied' : 'Copy failed');
  };

  const handlePrint = () => window.print();

  if (!access.canAccess) {
    return (
      <div className="p-8 text-center text-gray-400">
        <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>Financial Trace Center requires accounting admin / developer / auditor access.</p>
        <Button variant="ghost" className="mt-4" onClick={() => setCurrentView('dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const gap1100 =
    overview?.control1100Net != null && overview?.arCusSubledgerSum != null
      ? Math.abs(overview.control1100Net - overview.arCusSubledgerSum)
      : null;

  return (
    <div className={cn('flex flex-col text-gray-100 print:bg-white print:text-black', embedded ? 'min-h-0' : 'h-full bg-[#0a0a0f]')}>
      {!embedded ? (
        <div className="border-b border-gray-800 px-4 py-3 flex flex-wrap items-center gap-3 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('accounting')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-cyan-400" />
              Financial Truth Center
            </h1>
            <p className="text-xs text-gray-500">Read-only tie-out and diagnosis — no repairs, no Phase 3 apply</p>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
            Read-only
          </Badge>
          <Button variant="outline" size="sm" className="border-gray-600" onClick={() => loadAll()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" className="border-gray-600" onClick={handleExportOverview}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="border-gray-600" onClick={handleCopySummary}>
            <Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
          <Button variant="outline" size="sm" className="border-gray-600" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      ) : (
        <div className="flex justify-end px-1 pb-2 print:hidden">
          <Button variant="outline" size="sm" className="border-gray-600" onClick={() => loadAll()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh trace
          </Button>
        </div>
      )}

      {loading && !overview ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as FinancialTraceTabId)} className="flex-1 flex flex-col min-h-0">
          {tabsToShow.length > 1 ? (
            <TabsList className={cn('bg-gray-900/80 border border-gray-800 flex-wrap h-auto print:hidden', embedded ? 'mb-2' : 'mx-4 mt-3')}>
              {tabsToShow.map((tid) => (
                <TabsTrigger key={tid} value={tid}>
                  {TRACE_TAB_LABELS[tid]}
                </TabsTrigger>
              ))}
            </TabsList>
          ) : null}

          <TabsContent value="tieout" className="flex-1 overflow-auto p-4 space-y-4">
            {tieOut ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>As of {tieOut.asOfDate}</span>
                  <span>·</span>
                  <span>P&amp;L period {tieOut.periodStart} → {tieOut.profitAndLoss.endDate}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard
                    label="TB total debit"
                    value={formatCurrency(tieOut.trialBalance.totalDebit)}
                    basis="gl"
                  />
                  <MetricCard
                    label="TB total credit"
                    value={formatCurrency(tieOut.trialBalance.totalCredit)}
                    basis="gl"
                  />
                  <MetricCard
                    label="TB difference"
                    value={formatCurrency(tieOut.trialBalance.difference)}
                    basis="gl"
                    warn={!tieOut.trialBalance.balanced}
                  />
                  <MetricCard
                    label="BS A = L + E diff"
                    value={formatCurrency(tieOut.balanceSheet.difference)}
                    basis="gl"
                    warn={Math.abs(tieOut.balanceSheet.difference) >= 0.01}
                  />
                  <MetricCard
                    label="P&amp;L net profit"
                    value={formatCurrency(tieOut.profitAndLoss.netProfit)}
                    basis="gl"
                  />
                  <MetricCard
                    label="AR control (1100)"
                    value={formatCurrency(tieOut.ar.controlGl ?? 0)}
                    basis="gl"
                  />
                  <MetricCard
                    label="AR-CUS sum (raw GL)"
                    value={formatCurrency(tieOut.ar.subledgerRawSum ?? 0)}
                    basis="gl"
                  />
                  <MetricCard
                    label="AR-CUS sum (effective)"
                    value={formatCurrency(tieOut.ar.subledgerEffectiveSum ?? 0)}
                    basis="operational"
                  />
                  <MetricCard
                    label="Cash/Bank GL (official)"
                    value={formatCurrency(tieOut.cash.glNetOfficial ?? 0)}
                    basis="gl"
                  />
                  <MetricCard
                    label="Cash flow closing (ops)"
                    value={formatCurrency(tieOut.cash.operationalClosing ?? 0)}
                    basis="operational"
                  />
                </div>

                <div className="rounded-lg border border-gray-700 overflow-hidden">
                  <div className="px-4 py-2 border-b border-gray-700 bg-gray-900/60 flex items-center gap-2">
                    <Scale className="h-4 w-4 text-cyan-400" />
                    <p className="text-sm font-medium">Difference rows</p>
                  </div>
                  {tieOut.differences.length === 0 ? (
                    <p className="p-4 text-sm text-emerald-300">All checked pairs tie within Rs 0.01 on official / effective surfaces.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                            <th className="p-3">Pair</th>
                            <th className="p-3 text-right">Left</th>
                            <th className="p-3 text-right">Right</th>
                            <th className="p-3 text-right">Diff</th>
                            <th className="p-3">Reason</th>
                            <th className="p-3">Action</th>
                            <th className="p-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {tieOut.differences.map((row) => (
                            <tr key={row.id} className="border-b border-gray-800/80 hover:bg-gray-900/40">
                              <td className="p-3">
                                <p className="font-medium text-gray-200">{row.label}</p>
                                <p className="text-xs text-gray-500">{row.leftLabel} vs {row.rightLabel}</p>
                              </td>
                              <td className="p-3 text-right tabular-nums">{formatCurrency(row.leftAmount)}</td>
                              <td className="p-3 text-right tabular-nums">{formatCurrency(row.rightAmount)}</td>
                              <td className={cn('p-3 text-right tabular-nums font-medium', Math.abs(row.difference) >= 0.01 && 'text-amber-200')}>
                                {formatCurrency(row.difference)}
                              </td>
                              <td className="p-3 text-xs text-gray-400">{row.reasonLabel}</td>
                              <td className="p-3 text-xs text-gray-500 max-w-[200px]">{row.recommendedAction}</td>
                              <td className="p-3">
                                <Button variant="outline" size="sm" className="border-gray-600 text-xs" onClick={() => handleTieOutDrilldown(row.drilldown)}>
                                  Open
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {regressionQuickLinks.length > 0 && (
                  <div className="rounded-lg border border-gray-700 p-4 space-y-2">
                    <p className="text-sm font-medium text-gray-300">Known regression cases</p>
                    <div className="flex flex-wrap gap-2">
                      {regressionQuickLinks.map((c) => (
                        <Button
                          key={c.id}
                          variant="outline"
                          size="sm"
                          className="border-gray-600 text-xs"
                          onClick={() => {
                            if (c.tab === 'rental') {
                              setRentalQ(c.searchHint);
                              setTab('rental');
                            } else {
                              setSearchQ(c.searchHint);
                              setTab(c.tab === 'metadata' ? 'metadata' : 'party');
                            }
                          }}
                        >
                          {c.title}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <CrossLinkBar embedded={embedded} onNavigate={navigateCross} onOpenDeveloperCenter={openDeveloperCenter} />
              </>
            ) : (
              <p className="text-sm text-gray-500">Tie-out data unavailable.</p>
            )}
          </TabsContent>

          <TabsContent value="overview" className="flex-1 overflow-auto p-4 space-y-4">
            {overview && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard
                    label="GL AR net"
                    value={formatCurrency(overview.summary.gl_ar_net_dr_minus_cr ?? 0)}
                    basis="gl"
                  />
                  <MetricCard
                    label="GL AP net"
                    value={formatCurrency(overview.summary.gl_ap_net_credit ?? 0)}
                    basis="gl"
                  />
                  <MetricCard
                    label="1100 control net"
                    value={formatCurrency(overview.control1100Net ?? 0)}
                    basis="gl"
                    warn={gap1100 != null && gap1100 >= 1}
                  />
                  <MetricCard
                    label="AR-CUS sub-ledger sum"
                    value={formatCurrency(overview.arCusSubledgerSum ?? 0)}
                    basis="gl"
                    warn={gap1100 != null && gap1100 >= 1}
                  />
                  <MetricCard
                    label="Operational sales due"
                    value={formatCurrency(overview.operationalSalesDueSum ?? 0)}
                    basis="operational"
                  />
                  <MetricCard
                    label="Unposted docs"
                    value={String(queues?.unposted.length ?? 0)}
                    basis="heuristic"
                  />
                  <MetricCard
                    label="Unmapped AR JEs"
                    value={String(overview.summary.unmapped_ar_je_count)}
                    basis="heuristic"
                  />
                  <MetricCard
                    label="Manual / suspense"
                    value={String(queues?.manualCount ?? 0)}
                    basis="heuristic"
                  />
                </div>

                {overview.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
                    <p className="text-sm font-medium text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Control tie-out warnings
                    </p>
                    <ul className="text-sm text-amber-100/90 list-disc pl-5 space-y-1">
                      {overview.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {overview.divergenceCodes.map((c) => (
                        <CodeBadge key={c} code={c as DivergenceCode} />
                      ))}
                    </div>
                    {access.canUseHybridRepair && rentalLeakagePending != null && rentalLeakagePending > 0 ? (
                      <Button
                        size="sm"
                        className="mt-2 bg-violet-700 hover:bg-violet-600"
                        onClick={openHybridRepair}
                      >
                        Open Hybrid Repair ({rentalLeakagePending} rental 1100 pending)
                      </Button>
                    ) : null}
                  </div>
                )}

                <CrossLinkBar embedded={embedded} onNavigate={navigateCross} onOpenDeveloperCenter={openDeveloperCenter} />
              </>
            )}
          </TabsContent>

          <TabsContent value="party" className="flex-1 overflow-auto p-4 space-y-4 print:hidden">
            <div className="flex gap-2 max-w-xl">
              <Input
                placeholder="Contact, account, invoice, REN, RCV, JE…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                className="bg-gray-900 border-gray-700"
              />
              <Button onClick={runSearch} disabled={partyLoading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {searchHits.length > 0 && (
              <div className="rounded-lg border border-gray-700 divide-y divide-gray-800">
                {searchHits.map((h) => (
                  <button
                    key={`${h.kind}-${h.id}`}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-800/60 flex justify-between"
                    onClick={() => h.contactId && loadParty(h.contactId)}
                  >
                    <span>
                      <span className="text-xs text-gray-500 uppercase mr-2">{h.kind}</span>
                      {h.label}
                    </span>
                    <span className="text-gray-500 text-sm">{h.sublabel}</span>
                  </button>
                ))}
              </div>
            )}
            {partyTrace && (
              <div className="rounded-lg border border-gray-700 p-4 space-y-3">
                <h3 className="font-medium">{partyTrace.contact.name}</h3>
                {partyTrace.arAccount && (
                  <p className="text-sm text-gray-400">
                    {partyTrace.arAccount.code} — {partyTrace.arAccount.name}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Account ledger closing</p>
                    <p className="font-mono">{formatCurrency(partyTrace.accountLedgerClosing ?? 0)}</p>
                    <BasisBadge basis="gl" />
                  </div>
                  <div>
                    <p className="text-gray-500">Party statement closing</p>
                    <p className="font-mono">{formatCurrency(partyTrace.customerStatementClosing ?? 0)}</p>
                    <BasisBadge basis="gl" />
                  </div>
                  <div>
                    <p className="text-gray-500">Ledger V2 official</p>
                    <p className="font-mono">{formatCurrency(partyTrace.ledgerV2Closing ?? 0)}</p>
                    <BasisBadge basis="gl" />
                  </div>
                </div>
                <CrossLinkBar
                  contactId={partyTrace.contact.id}
                  contactName={partyTrace.contact.name}
                  embedded={embedded}
                  onNavigate={navigateCross}
                  onOpenDeveloperCenter={openDeveloperCenter}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="rental" className="flex-1 overflow-auto p-4 space-y-4">
            <div className="flex gap-2 max-w-md">
              <Input
                value={rentalQ}
                onChange={(e) => setRentalQ(e.target.value)}
                placeholder="REN-0002"
                className="bg-gray-900 border-gray-700"
              />
              <Button onClick={loadRental} disabled={rentalLoading}>
                {rentalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Trace'}
              </Button>
            </div>
            {rentalTrace?.rental && (
              <div className="space-y-4">
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
                  <h3 className="font-medium text-cyan-200">
                    {(rentalTrace.rental.booking_no as string) ?? rentalQ} — {rentalTrace.contactName}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Paid {formatCurrency(Number(rentalTrace.rental.paid_amount) || 0)} / Total{' '}
                    {formatCurrency(Number(rentalTrace.rental.total_amount) || 0)} — Due{' '}
                    {formatCurrency(Number(rentalTrace.rental.due_amount) || 0)}
                  </p>
                  {rentalTrace.arAccountCode && (
                    <p className="text-sm mt-2">
                      AR {rentalTrace.arAccountCode} net:{' '}
                      <span className="font-mono text-amber-200">
                        {formatCurrency(rentalTrace.arSubledgerNet ?? 0)}
                      </span>
                      <CodeBadge code="D7" />
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Roznamcha: verify HQ-RCV refs in Accounting → Roznamcha (cash flow surface, not GL tie-out).
                  </p>
                </div>
                <div className="rounded-lg border border-gray-700 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900/80 text-gray-400 text-left">
                      <tr>
                        <th className="p-2">Reference</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">JE</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Codes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rentalTrace.rentalPayments.map((rp) => {
                        const codes = classifyRentalPaymentRow({
                          voidedAt: rp.voided_at,
                          reference: rp.reference,
                          hasPaymentsMirror: rentalTrace.paymentsTableRows.some(
                            (p) => p.reference_number === rp.reference
                          ),
                        });
                        return (
                          <tr key={rp.id} className="border-t border-gray-800">
                            <td className="p-2 font-mono">{rp.reference}</td>
                            <td className="p-2">{formatCurrency(rp.amount)}</td>
                            <td className="p-2">
                              {rp.entry_no} {rp.je_void ? '(void)' : ''}
                            </td>
                            <td className="p-2">{rp.voided_at ? 'Voided' : 'Active'}</td>
                            <td className="p-2 flex flex-wrap gap-1">
                              {codes.map((c) => (
                                <CodeBadge key={c} code={c} />
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {rentalTrace.paymentsTableRows.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No <code className="text-gray-400">payments</code> table rows — canonical stream is{' '}
                    <code className="text-gray-400">rental_payments</code> (<CodeBadge code="D4" />).
                  </p>
                )}
                <p className="text-sm text-amber-200/90 border border-amber-500/30 rounded p-3">
                  Inayat / REN-0002: active HQ-RCV-0003 (50k) + HQ-RCV-0006 (10k); void REN-0002-PAY / JE-0011.
                  Deeper trace required — no auto repair.
                </p>
                <CrossLinkBar embedded={embedded} onNavigate={navigateCross} onOpenDeveloperCenter={openDeveloperCenter} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="metadata" className="flex-1 overflow-auto p-4 space-y-3">
            <p className="text-sm text-gray-400">D3 — metadata whitelist / false positives. No GL repair recommended.</p>
            {metadataRows.map(({ row, cls, meta }) => (
              <div key={row.journal_line_id} className="rounded-lg border border-gray-700 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{row.entry_no}</span>
                  <CodeBadge code="D3" />
                  <Badge variant="outline" className="text-xs">
                    {cls.label}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400">{cls.detail}</p>
                {meta?.reference_number && (
                  <p className="text-xs text-gray-500">
                    Payment {meta.reference_number} ({meta.reference_type})
                  </p>
                )}
              </div>
            ))}
            <CrossLinkBar onNavigate={navigateCross} />
          </TabsContent>

          <TabsContent value="non-final" className="flex-1 overflow-auto p-4 space-y-3">
            <p className="text-sm text-gray-400">D2 — order-stage sales; not postable until finalized.</p>
            {nonFinalRows.map(({ row, cls, status }) => (
              <div key={`${row.source_type}-${row.source_id}`} className="rounded-lg border border-gray-700 p-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-mono">{row.document_no}</span>
                  <CodeBadge code="D2" />
                  <Badge variant="outline">{status ?? 'order'}</Badge>
                </div>
                <p className="text-sm mt-2">{cls.label}</p>
                <p className="text-xs text-gray-500 mt-1">{formatCurrency(row.amount)} — {row.reason}</p>
              </div>
            ))}
            <CrossLinkBar onNavigate={navigateCross} />
          </TabsContent>

          <TabsContent value="deeper" className="flex-1 overflow-auto p-4 space-y-4">
            <p className="text-sm text-gray-400">
              D7 — escalate for manual review. GL-correction cases move to Resolved when fingerprint JE exists.
            </p>
            {resolvedDeeperRows.length > 0 ? (
              <details className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2 group">
                <summary className="cursor-pointer text-sm font-medium text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Resolved GL corrections ({resolvedDeeperRows.length})
                </summary>
                <div className="pt-3 space-y-2">
                  {resolvedDeeperRows.map((c) => (
                    <div key={c.id} className="text-sm text-gray-300 border-t border-emerald-500/15 pt-2 first:border-0 first:pt-0">
                      <span className="text-emerald-200 font-medium">{c.title}</span>
                      {resolvedTraceEntryNos[c.id] ? (
                        <span className="text-gray-500 ml-2 font-mono">→ {resolvedTraceEntryNos[c.id]}</span>
                      ) : null}
                      <p className="text-xs text-gray-500 mt-0.5">Additive correction applied — source JEs unchanged.</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
            {deeperRows.map((c) => (
              <div key={c.id} className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <h3 className="font-medium">{c.title}</h3>
                  {c.codes.map((code) => (
                    <CodeBadge key={code} code={code} />
                  ))}
                </div>
                <p className="text-sm text-gray-300">{c.summary}</p>
                <p className="text-sm text-amber-200">{c.statusLabel}</p>
                {c.glCorrectionDefectId ? (
                  <p className="text-xs text-violet-300/90">
                    Fix in AR/AP Reconciliation Center → Hybrid Repair (confirm: APPLY GL CORRECTION).
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">Recommended: manual review in AR/AP Reconciliation (status-only).</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600"
                  onClick={() => {
                    if (c.glCorrectionDefectId) markOpenArApHybridRepair();
                    openHybridRepair();
                  }}
                >
                  {c.glCorrectionDefectId ? 'Open Hybrid Repair' : 'Open repair queues'}
                </Button>
              </div>
            ))}
            {gap1100 != null && gap1100 >= 1 && overview && (
              <div className="rounded-lg border border-red-500/30 p-4 space-y-2">
                <CodeBadge code="D7" />
                <p className="text-sm mt-2">
                  1100 vs AR-CUS gap: {formatCurrency(gap1100)} — investigate chart rollup vs party sub-ledgers.
                </p>
                {access.canUseHybridRepair && rentalLeakagePending != null && rentalLeakagePending > 0 ? (
                  <Button size="sm" variant="outline" className="border-violet-600 text-violet-200" onClick={openHybridRepair}>
                    Open Hybrid Repair ({rentalLeakagePending} per-line fixes)
                  </Button>
                ) : null}
              </div>
            )}
            <CrossLinkBar onNavigate={navigateCross} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default FinancialTraceDiagnosticsPanel;

/** @deprecated Use FinancialTraceRedirect — standalone page merged into AR/AP Diagnostics hub. */
export const FinancialTraceCenterPage = FinancialTraceDiagnosticsPanel;
