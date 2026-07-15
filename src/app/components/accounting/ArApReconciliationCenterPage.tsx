import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookMarked,
  ClipboardList,
  ExternalLink,
  Eye,
  FileWarning,
  FileSearch,
  Loader2,
  RefreshCw,
  Scale,
  ShieldAlert,
  Users,
  Wrench,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { cn } from '@/app/components/ui/utils';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useCheckPermission } from '@/app/hooks/useCheckPermission';
import { toast } from 'sonner';
import {
  ensureArApSuspenseAccount,
  fetchAppliedGlCorrections,
  fetchIntegrityLabSummary,
  fetchManualAdjustments,
  fetchReconciliationItemStates,
  fetchUnmappedJournalLines,
  fetchUnpostedDocuments,
  type AppliedGlCorrectionAuditRow,
  manualJeItemKey,
  unmappedLineItemKey,
  unpostedItemKey,
  upsertArApItemFixStatus,
  type ArApFixStatus,
  type IntegrityLabSummary,
  type ManualAdjustmentRow,
  type UnmappedJournalRow,
  type UnpostedDocumentRow,
} from '@/app/services/arApReconciliationCenterService';
import { AccountingRefDisplayCell } from '@/app/components/accounting/AccountingRefDisplayCell';
import type { AccountingUiRef } from '@/app/lib/accountingDisplayReference';
import { resolveJournalUiRefsByJournalIds } from '@/app/services/integrityLabService';
import {
  JournalRepairWizardDialog,
} from '@/app/components/accounting/ArApRepairDialogs';
import { resolveArApReconciliationAccess, mergeHybridRepairProbe } from '@/app/lib/arApReconciliationAccess';
import { diagnoseUnpostedRow, diagnoseUnmappedLine } from '@/app/lib/arApReconciliationDiagnostics';
import { batchFetchUnpostedDocumentStatuses, loadUnmappedTrace } from '@/app/services/arApReconciliationTraceService';
import { SourceDocumentDetailModal, UnmappedRowDetailModal } from '@/app/components/accounting/ar-ap-repair/SourceDocumentDetailModal';
import { PostingDryRunWizard } from '@/app/components/accounting/ar-ap-repair/PostingDryRunWizard';
import { RelinkDryRunWizard } from '@/app/components/accounting/ar-ap-repair/RelinkDryRunWizard';
import { StatusChangeModal, type StatusChangeIntent } from '@/app/components/accounting/ar-ap-repair/StatusChangeModal';
import { RowTracePanel, type TraceTarget } from '@/app/components/accounting/ar-ap-repair/RowTracePanel';
import {
  AppliedGlCorrectionBadge,
  FalsePositiveBadge,
  MetadataReviewBadge,
  PostabilityBadge,
  RiskBadge,
} from '@/app/components/accounting/ar-ap-repair/ArApRepairBadges';
import {
  ActionableRepairCard,
  type ActionableRepairCardProps,
} from '@/app/components/accounting/ar-ap-repair/ActionableRepairCard';
import { GlCorrectionDraftModal } from '@/app/components/accounting/ar-ap-repair/GlCorrectionDraftModal';
import { KnownGlCorrectionSection } from '@/app/components/accounting/ar-ap-repair/KnownGlCorrectionSection';
import { HybridRepairPanel } from '@/app/components/accounting/ar-ap-repair/HybridRepairPanel';
import { ReceivablesVarianceBreakdownPanel } from '@/app/components/accounting/ar-ap-repair/ReceivablesVarianceBreakdownPanel';
import { PayablesVarianceExplainerPanel } from '@/app/components/accounting/ar-ap-repair/PayablesVarianceExplainerPanel';
import { ArApRepairProgressStrip } from '@/app/components/accounting/ar-ap-repair/ArApRepairProgressStrip';
import { consumeOpenArApHybridRepairFocus } from '@/app/lib/arApHybridRepairNav';
import {
  parseArApDiagnosticsHubTabFromUrl,
  syncArApDiagnosticsHubTabToUrl,
  type ArApDiagnosticsHubTab,
} from '@/app/lib/arApDiagnosticsHubTabs';
import { FinancialTraceDiagnosticsPanel } from '@/app/components/accounting/FinancialTraceCenterPage';
import { JournalHygienePanel } from '@/app/components/accounting/ar-ap-diagnostics/JournalHygienePanel';
import { loadDeveloperRepairSystemStatus } from '@/app/services/developerRepairSystemStatusService';
import {
  classifyUnmappedJournalLine,
  classifyUnpostedDocument as classifyUnpostedForRepair,
  type ActionableRepairButton,
} from '@/app/lib/actionableRepairClassifier';
import { UNIFIED_LEDGER_BASIS_LABELS } from '@/app/lib/unifiedLedgerBasisFilter';

function statusBadgeClass(status: IntegrityLabSummary['status']): string {
  switch (status) {
    case 'clean':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
    case 'variance':
      return 'bg-amber-500/15 text-amber-200 border-amber-500/40';
    case 'missing_posting':
      return 'bg-red-500/15 text-red-200 border-red-500/40';
    case 'unmapped':
      return 'bg-orange-500/15 text-orange-200 border-orange-500/40';
    case 'manual_adjustment':
      return 'bg-violet-500/15 text-violet-200 border-violet-500/40';
    default:
      return 'bg-gray-500/15 text-muted-foreground border-gray-600';
  }
}

function FixStatusButton(props: {
  value: ArApFixStatus;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className="max-w-[140px] bg-card border border-border rounded px-2 py-1 text-[11px] text-gray-200 text-left hover:bg-muted disabled:opacity-50"
      title="Change status (requires reason)"
    >
      {props.value.replace(/_/g, ' ')}
    </button>
  );
}

export function ArApReconciliationCenterPage() {
  const { companyId, branchId, userRole } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { canPostAccounting } = useCheckPermission();
  const baseAccess = useMemo(() => resolveArApReconciliationAccess(userRole), [userRole]);
  const [glCorrectionRpcAvailable, setGlCorrectionRpcAvailable] = useState(false);
  const access = useMemo(
    () => mergeHybridRepairProbe(baseAccess, { glCorrectionRpcAvailable }),
    [baseAccess, glCorrectionRpcAvailable]
  );
  const { setCurrentView, setOpenSaleIdForView, openPartyLedger } = useNavigation();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<IntegrityLabSummary | null>(null);
  const [unposted, setUnposted] = useState<UnpostedDocumentRow[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedJournalRow[]>([]);
  const [manual, setManual] = useState<ManualAdjustmentRow[]>([]);
  const [itemStates, setItemStates] = useState<Map<string, ArApFixStatus>>(new Map());
  const [hideResolved, setHideResolved] = useState(true);
  const [ensuringSuspense, setEnsuringSuspense] = useState(false);
  const [hubTab, setHubTab] = useState<ArApDiagnosticsHubTab>(() => parseArApDiagnosticsHubTabFromUrl());
  const [activeTab, setActiveTab] = useState('queues');
  const [dataRefreshToken, setDataRefreshToken] = useState(0);
  const [appliedGlCorrections, setAppliedGlCorrections] = useState<AppliedGlCorrectionAuditRow[]>([]);

  const [sourceDetailRow, setSourceDetailRow] = useState<UnpostedDocumentRow | null>(null);
  const [postingDryRunRow, setPostingDryRunRow] = useState<UnpostedDocumentRow | null>(null);
  const [relinkDryRunRow, setRelinkDryRunRow] = useState<UnmappedJournalRow | null>(null);
  const [unmappedDetailRow, setUnmappedDetailRow] = useState<UnmappedJournalRow | null>(null);
  const [traceTarget, setTraceTarget] = useState<TraceTarget | null>(null);
  const [journalWizardId, setJournalWizardId] = useState<string | null>(null);
  const [journalWizardItemKey, setJournalWizardItemKey] = useState<string | null>(null);
  const [journalWizardItemKind, setJournalWizardItemKind] = useState<string>('unmapped_line');
  const [jeUiByJournalId, setJeUiByJournalId] = useState<Map<string, AccountingUiRef>>(new Map());
  const [unpostedStatusByKey, setUnpostedStatusByKey] = useState<Map<string, string | null>>(new Map());
  const [unmappedDiagByKey, setUnmappedDiagByKey] = useState<
    Map<string, ReturnType<typeof diagnoseUnmappedLine>>
  >(new Map());
  const [statusModal, setStatusModal] = useState<{
    kind: string;
    key: string;
    intent: StatusChangeIntent;
    title: string;
    description?: string;
    rowStillInQueue?: boolean;
  } | null>(null);
  const [glCorrectionDefectId, setGlCorrectionDefectId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !access.canUseHybridRepair) return;
    void loadDeveloperRepairSystemStatus(companyId, userRole).then((s) => {
      setGlCorrectionRpcAvailable(s.probe.glCorrectionRpcAvailable);
    });
  }, [companyId, userRole, access.canUseHybridRepair]);

  useEffect(() => {
    if (!consumeOpenArApHybridRepairFocus()) return;
    setHubTab('queues');
    syncArApDiagnosticsHubTabToUrl('queues');
    const t = window.setTimeout(() => {
      document.getElementById('hybrid-repair-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onPop = () => setHubTab(parseArApDiagnosticsHubTabFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setHubTabAndSync = useCallback((tab: ArApDiagnosticsHubTab) => {
    setHubTab(tab);
    syncArApDiagnosticsHubTabToUrl(tab);
  }, []);

  const scrollToHybridRepair = useCallback(() => {
    setHubTabAndSync('queues');
    window.setTimeout(() => {
      document.getElementById('hybrid-repair-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [setHubTabAndSync]);

  const load = useCallback(async () => {
    if (!companyId) {
      setSummary(null);
      setUnposted([]);
      setUnmapped([]);
      setManual([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [sum, up, um, man, states, appliedGl] = await Promise.all([
        fetchIntegrityLabSummary(companyId, branchId, asOfDate),
        fetchUnpostedDocuments(companyId, branchId, asOfDate),
        fetchUnmappedJournalLines(companyId, branchId, asOfDate),
        fetchManualAdjustments(companyId, branchId, asOfDate),
        fetchReconciliationItemStates(companyId),
        fetchAppliedGlCorrections(companyId),
      ]);
      setSummary(sum);
      setUnposted(up);
      setUnmapped(um);
      setManual(man);
      setItemStates(states);
      setAppliedGlCorrections(appliedGl);
      setDataRefreshToken((t) => t + 1);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, asOfDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!unposted.length) {
      setUnpostedStatusByKey(new Map());
      return;
    }
    let cancelled = false;
    void batchFetchUnpostedDocumentStatuses(unposted).then((m) => {
      if (!cancelled) setUnpostedStatusByKey(m);
    });
    return () => {
      cancelled = true;
    };
  }, [unposted]);

  useEffect(() => {
    if (!unmapped.length) {
      setUnmappedDiagByKey(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const m = new Map<string, ReturnType<typeof diagnoseUnmappedLine>>();
      await Promise.all(
        unmapped.map(async (r) => {
          const key = unmappedLineItemKey(r);
          try {
            const t = await loadUnmappedTrace(r);
            m.set(key, diagnoseUnmappedLine(r, t.payment ?? undefined, t.lineAccount?.linked_contact_id));
          } catch {
            m.set(key, diagnoseUnmappedLine(r));
          }
        })
      );
      if (!cancelled) setUnmappedDiagByKey(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [unmapped]);

  useEffect(() => {
    const onInvalidate = (e: Event) => {
      const d = (e as CustomEvent<{ companyId?: string }>).detail;
      if (d?.companyId && d.companyId !== companyId) return;
      void load();
    };
    window.addEventListener('contactBalancesRefresh', onInvalidate as EventListener);
    return () => {
      window.removeEventListener('contactBalancesRefresh', onInvalidate as EventListener);
    };
  }, [companyId, load]);

  useEffect(() => {
    if (!companyId) {
      setJeUiByJournalId(new Map());
      return;
    }
    const ids = new Set<string>();
    for (const u of unmapped) ids.add(u.journal_entry_id);
    for (const m of manual) ids.add(m.journal_entry_id);
    if (!ids.size) {
      setJeUiByJournalId(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const m = await resolveJournalUiRefsByJournalIds(
        companyId,
        [...ids].map((id) => ({ key: id, journalEntryId: id }))
      );
      if (cancelled) return;
      setJeUiByJournalId(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, unmapped, manual]);

  const getStatus = useCallback(
    (key: string): ArApFixStatus => itemStates.get(key) ?? 'new',
    [itemStates]
  );

  const rowVisible = useCallback(
    (key: string) => {
      const st = getStatus(key);
      if (hideResolved && st === 'resolved') return false;
      return true;
    },
    [getStatus, hideResolved]
  );

  const onFixStatusChange = async (kind: string, key: string, status: ArApFixStatus, note?: string) => {
    if (!companyId || access.readOnly) return;
    const r = await upsertArApItemFixStatus(companyId, kind, key, status);
    if (!r.ok) {
      toast.error(r.error || 'Could not save status');
      return;
    }
    setItemStates((prev) => new Map(prev).set(key, status));
    toast.success('Status updated', { description: note ? note.slice(0, 120) : undefined });
  };

  const openJournalWizard = (journalEntryId: string, itemKind: string, itemKey: string) => {
    setJournalWizardId(journalEntryId);
    setJournalWizardItemKind(itemKind);
    setJournalWizardItemKey(itemKey);
  };

  const openSaleById = (saleId: string, invoiceNo?: string) => {
    setOpenSaleIdForView?.(saleId);
    setCurrentView('sales');
    toast.message('Opened Sales — finalize to post', {
      description: invoiceNo
        ? `${invoiceNo}: use Finalize in sale drawer to create invoice JE and clear order advance variance.`
        : 'Finalize the sale to create invoice JE and clear order advance variance.',
    });
  };

  const goToUnpostedOrders = () => {
    scrollToQueueSection(unpostedFinalMissing.length > 0 ? 'unposted-queue-1b' : 'unposted-queue-1a');
  };

  const scrollToQueueSection = useCallback((elementId: string) => {
    setActiveTab('queues');
    window.setTimeout(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  const openSourceDocument = (row: UnpostedDocumentRow) => {
    if (row.source_type === 'sale') {
      openSaleById(row.source_id, row.document_no || undefined);
      return;
    }
    if (row.source_type === 'purchase') {
      setCurrentView('purchases');
      toast.message('Opened Purchases', { description: `Find PO ${row.document_no || row.source_id}` });
    }
  };

  const openAccounting = () => {
    setCurrentView('accounting');
    toast.info('Journal entries / Add Entry; tag suspense with [AR_AP_RECON].');
  };

  const openDeveloperIntegrityLab = () => {
    setCurrentView('accounting-integrity-lab');
    toast.message('Developer Accounting Integrity Lab');
  };

  const handleActionableRepair: ActionableRepairCardProps['onAction'] = (button, classification) => {
    switch (button) {
      case 'create_gl_correction_draft': {
        const defectId = String(classification.queueItem?.params.defectId || 'hq-sl-0003-orphan-ar');
        setGlCorrectionDefectId(defectId);
        break;
      }
      case 'fix_link':
        toast.message('Use Fix Link on the unmapped row — metadata only, GL unchanged');
        break;
      case 'open_source_document':
        toast.message('Open the source document from the row Actions menu');
        break;
      case 'mark_reviewed':
        toast.message('Use Mark reviewed on the row — requires a note');
        break;
      case 'view_audit':
        toast.message('Switch Account Statement to audit mode to view reversal trails');
        break;
      case 'blocked_explain':
        toast.warning(classification.blockReason || 'Action blocked — review required');
        break;
      default:
        toast.info(classification.recommendedAction);
    }
  };

  const handleEnsureSuspense = async () => {
    if (!companyId) return;
    setEnsuringSuspense(true);
    try {
      const { accountId, error } = await ensureArApSuspenseAccount(companyId);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(accountId ? `Suspense ready (${accountId.slice(0, 8)}…)` : 'OK');
      await load();
    } finally {
      setEnsuringSuspense(false);
    }
  };

  const unmappedCustomerSupplier = useMemo(
    () => unmapped.filter((r) => r.control_bucket === 'AR' || r.ap_sub_bucket === 'supplier' || (r.control_bucket === 'AP' && r.ap_sub_bucket !== 'worker')),
    [unmapped]
  );
  const unmappedWorkerPayable = useMemo(
    () => unmapped.filter((r) => r.control_bucket === 'AP' && r.ap_sub_bucket === 'worker'),
    [unmapped]
  );

  const unpostedVisible = useMemo(
    () => unposted.filter((r) => rowVisible(unpostedItemKey(r))),
    [unposted, rowVisible]
  );

  const unpostedNonFinal = useMemo(
    () =>
      unpostedVisible.filter((r) => {
        const st = unpostedStatusByKey.get(unpostedItemKey(r));
        return diagnoseUnpostedRow(r, st).isNonFinal;
      }),
    [unpostedVisible, unpostedStatusByKey]
  );

  const unpostedFinalMissing = useMemo(
    () =>
      unpostedVisible.filter((r) => {
        const st = unpostedStatusByKey.get(unpostedItemKey(r));
        return !diagnoseUnpostedRow(r, st).isNonFinal;
      }),
    [unpostedVisible, unpostedStatusByKey]
  );

  const unmappedCsAppliedGlCorrection = useMemo(
    () =>
      unmappedCustomerSupplier
        .filter((r) => rowVisible(unmappedLineItemKey(r)))
        .filter((r) => unmappedDiagByKey.get(unmappedLineItemKey(r))?.isAppliedGlCorrectionReview),
    [unmappedCustomerSupplier, rowVisible, unmappedDiagByKey]
  );

  const unmappedCsVisible = useMemo(
    () =>
      unmappedCustomerSupplier
        .filter((r) => rowVisible(unmappedLineItemKey(r)))
        .filter((r) => {
          const d = unmappedDiagByKey.get(unmappedLineItemKey(r));
          return !d?.isLikelyFalsePositive && !d?.isMetadataReviewOnly && !d?.isAppliedGlCorrectionReview;
        }),
    [unmappedCustomerSupplier, rowVisible, unmappedDiagByKey]
  );

  const unmappedCsFalsePositive = useMemo(
    () =>
      unmappedCustomerSupplier
        .filter((r) => rowVisible(unmappedLineItemKey(r)))
        .filter((r) => unmappedDiagByKey.get(unmappedLineItemKey(r))?.isLikelyFalsePositive),
    [unmappedCustomerSupplier, rowVisible, unmappedDiagByKey]
  );

  const unmappedCsMetadataReview = useMemo(
    () =>
      unmappedCustomerSupplier
        .filter((r) => rowVisible(unmappedLineItemKey(r)))
        .filter((r) => unmappedDiagByKey.get(unmappedLineItemKey(r))?.isMetadataReviewOnly),
    [unmappedCustomerSupplier, rowVisible, unmappedDiagByKey]
  );
  const unmappedWpVisible = useMemo(
    () => unmappedWorkerPayable.filter((r) => rowVisible(unmappedLineItemKey(r))),
    [unmappedWorkerPayable, rowVisible]
  );
  const manualVisible = useMemo(
    () => manual.filter((r) => rowVisible(manualJeItemKey(r))),
    [manual, rowVisible]
  );

  const openStatusModal = (
    kind: string,
    key: string,
    intent: StatusChangeIntent,
    title: string,
    opts?: { description?: string; rowStillInQueue?: boolean }
  ) => {
    setStatusModal({ kind, key, intent, title, ...opts });
  };

  const renderUnpostedTable = (rows: UnpostedDocumentRow[], emptyLabel: string) => (
    <table className="w-full text-sm">
      <thead className="text-left text-muted-foreground border-b border-border">
        <tr>
          <th className="p-2 min-w-[200px]">Document</th>
          <th className="p-2">Label</th>
          <th className="p-2">Contact</th>
          <th className="p-2 text-right">Amount</th>
          <th className="p-2">Date</th>
          <th className="p-2 w-32">Fix status</th>
          <th className="p-2 min-w-[160px]">Repair</th>
          <th className="p-2 w-40">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/80">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={8} className="p-6 text-center text-muted-foreground">
              {emptyLabel}
            </td>
          </tr>
        ) : (
          rows.map((r) => {
            const key = unpostedItemKey(r);
            const st = unpostedStatusByKey.get(key);
            const diag = diagnoseUnpostedRow(r, st);
            const repairCls = classifyUnpostedForRepair(r, diag);
            return (
              <tr key={key} className="hover:bg-accent/20">
                <td className="p-2 align-top">
                  <AccountingRefDisplayCell ui={unpostedDocumentUiRef(r)} />
                </td>
                <td className="p-2 align-top">
                  <div className="flex flex-col gap-1">
                    <PostabilityBadge label={diag.label} isNonFinal={diag.isNonFinal} />
                    <RiskBadge level={diag.riskLevel} />
                  </div>
                </td>
                <td className="p-2 text-muted-foreground">{r.contact_name || '—'}</td>
                <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.amount) || 0)}</td>
                <td className="p-2 text-muted-foreground">{r.document_date || '—'}</td>
                <td className="p-2">
                  <FixStatusButton
                    value={getStatus(key)}
                    disabled={access.readOnly}
                    onClick={() =>
                      openStatusModal('unposted', key, { kind: 'set', status: getStatus(key) }, 'Change fix status', {
                        description: 'Select a new status and provide a reason.',
                      })
                    }
                  />
                </td>
                <td className="p-2 align-top">
                  <div className="flex flex-col gap-1">
                    <ActionableRepairCard
                      compact
                      readOnly={access.readOnly}
                      classification={repairCls}
                      onAction={(btn) => {
                        if (btn === 'open_source_document') openSourceDocument(r);
                        else handleActionableRepair(btn, repairCls);
                      }}
                    />
                    {diag.isNonFinal && r.source_type === 'sale' ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-[10px] bg-amber-700 hover:bg-amber-600"
                        disabled={access.readOnly}
                        onClick={() => openSaleById(r.source_id, r.document_no || undefined)}
                      >
                        Finalize &amp; Open sale
                      </Button>
                    ) : null}
                  </div>
                </td>
                <td className="p-2">
                  <RowActionsMenu
                    readOnly={access.readOnly}
                    items={[
                      { label: 'Source detail…', onClick: () => setSourceDetailRow(r) },
                      { label: 'Row trace', onClick: () => setTraceTarget({ kind: 'unposted', row: r }) },
                      ...(!diag.isNonFinal
                        ? [{ label: 'Preview posting…', onClick: () => setPostingDryRunRow(r) }]
                        : []),
                      ...(diag.isNonFinal && r.source_type === 'sale'
                        ? [{ label: 'Open sale (finalize)…', onClick: () => openSaleById(r.source_id, r.document_no || undefined) }]
                        : []),
                      { label: 'Open in module', onClick: () => openSourceDocument(r) },
                      {
                        label: 'Mark reviewed…',
                        onClick: () =>
                          openStatusModal('unposted', key, { kind: 'mark_reviewed' }, 'Mark reviewed', {
                            description: 'Requires a note explaining manual review.',
                          }),
                      },
                      {
                        label: 'Mark resolved…',
                        onClick: () =>
                          openStatusModal('unposted', key, { kind: 'mark_resolved' }, 'Mark resolved', {
                            description: 'True resolved only if row disappears from queue after refresh.',
                            rowStillInQueue: true,
                          }),
                        className: 'text-emerald-400',
                      },
                    ]}
                  />
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  if (!access.canAccess) {
    return (
      <div className="min-h-screen bg-secondary text-foreground p-8 flex flex-col items-center justify-center gap-4">
        <ShieldAlert className="w-12 h-12 text-amber-400" />
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-muted-foreground text-sm max-w-md text-center">
          AR/AP Reconciliation Center is available to Admin, Developer, Super Admin, and Accounting Auditor roles only.
          Sales staff cannot access this page in Phase 2.
        </p>
        <Button variant="outline" className="border-gray-600" onClick={() => setCurrentView('contacts')}>
          Back to Contacts
        </Button>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Select a company to use the Reconciliation Center.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary text-foreground p-4 md:p-8 space-y-6">
      <SourceDocumentDetailModal
        open={!!sourceDetailRow}
        onOpenChange={(o) => !o && setSourceDetailRow(null)}
        row={sourceDetailRow}
        readOnly={access.readOnly}
        onOpenDryRun={
          access.readOnly
            ? undefined
            : () => {
                setPostingDryRunRow(sourceDetailRow);
                setSourceDetailRow(null);
              }
        }
      />
      <PostingDryRunWizard
        open={!!postingDryRunRow}
        onOpenChange={(o) => !o && setPostingDryRunRow(null)}
        row={postingDryRunRow}
        companyId={companyId}
        branchId={branchId}
      />
      <UnmappedRowDetailModal
        open={!!unmappedDetailRow}
        onOpenChange={(o) => !o && setUnmappedDetailRow(null)}
        row={unmappedDetailRow}
        readOnly={access.readOnly}
        onOpenRelinkDryRun={
          access.readOnly
            ? undefined
            : () => {
                setRelinkDryRunRow(unmappedDetailRow);
                setUnmappedDetailRow(null);
              }
        }
        onOpenTrace={() => {
          if (unmappedDetailRow) setTraceTarget({ kind: 'unmapped', row: unmappedDetailRow });
        }}
      />
      <RelinkDryRunWizard
        open={!!relinkDryRunRow}
        onOpenChange={(o) => !o && setRelinkDryRunRow(null)}
        row={relinkDryRunRow}
        companyId={companyId}
        canApplyRelinkMapping={access.canApplyRelinkMapping}
        onSaved={() => void load()}
      />
      <JournalRepairWizardDialog
        open={!!journalWizardId}
        onOpenChange={(o) => {
          if (!o) {
            setJournalWizardId(null);
            setJournalWizardItemKey(null);
          }
        }}
        journalEntryId={journalWizardId}
        companyId={companyId}
        canPost={canPostAccounting}
        onSuccess={() => void load()}
        phase2SafeMode
        canDeveloperExecute={access.canDeveloperBypassExecuteGate}
        itemFixStatus={journalWizardItemKey ? getStatus(journalWizardItemKey) : null}
        onSendToRepairQueue={
          access.readOnly || !journalWizardItemKey
            ? undefined
            : async () => {
                await onFixStatusChange(journalWizardItemKind, journalWizardItemKey, 'ready_to_reverse_repost', 'Sent to repair queue from journal wizard');
                toast.message('Queued for repair', { description: 'Execute remains gated until Phase 3 or Developer bypass.' });
              }
        }
      />
      <StatusChangeModal
        open={!!statusModal}
        onOpenChange={(o) => !o && setStatusModal(null)}
        title={statusModal?.title || 'Change status'}
        description={statusModal?.description}
        intent={statusModal?.intent || null}
        currentStatus={statusModal ? getStatus(statusModal.key) : 'new'}
        rowStillInQueue={statusModal?.rowStillInQueue}
        readOnly={access.readOnly}
        onConfirm={async (note, effectiveStatus) => {
          if (!statusModal) return;
          await onFixStatusChange(statusModal.kind, statusModal.key, effectiveStatus, note);
        }}
      />
      <RowTracePanel open={!!traceTarget} onClose={() => setTraceTarget(null)} target={traceTarget} companyId={companyId} />
      <GlCorrectionDraftModal
        open={!!glCorrectionDefectId}
        onOpenChange={(o) => !o && setGlCorrectionDefectId(null)}
        defectId={glCorrectionDefectId || 'hq-sl-0003-orphan-ar'}
        canApplyGlRepair={access.canApplyGlRepair}
        onApplied={() => void load()}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2 gap-1.5" onClick={() => setCurrentView('contacts')}>
            <ArrowLeft size={16} /> Back to Contacts
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <Scale className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AR/AP Diagnostics &amp; Repair</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                One hub for exception queues, hybrid repair, financial tie-out, party trace, and journal hygiene.
                Advanced COA repairs: Accounting Developer Center.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted-foreground uppercase font-semibold shrink-0">As of</label>
          <DatePicker
            value={asOfDate}
            onChange={(v) => setAsOfDate(v)}
            className="w-40"
          />
          {hubTab === 'queues' ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={hideResolved} onChange={(e) => setHideResolved(e.target.checked)} className="rounded border-gray-600" />
              Hide resolved
            </label>
          ) : null}
          <Button variant="outline" size="sm" className="border-gray-600 gap-1.5" onClick={() => void load()} disabled={loading && hubTab === 'queues'}>
            {loading && hubTab === 'queues' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600"
            onClick={() => {
              window.history.pushState({}, '', '/admin/accounting-developer-center');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            <ExternalLink className="w-4 h-4 mr-1" /> Developer Center
          </Button>
        </div>
      </div>

      <Tabs value={hubTab} onValueChange={(v) => setHubTabAndSync(v as ArApDiagnosticsHubTab)} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="queues" className="data-[state=active]:bg-muted">
            Overview &amp; Queues
          </TabsTrigger>
          <TabsTrigger value="tie-out" className="data-[state=active]:bg-muted">
            <FileSearch className="w-3.5 h-3.5 mr-1.5" /> Tie-out
          </TabsTrigger>
          <TabsTrigger value="party-rental" className="data-[state=active]:bg-muted">
            Party &amp; Rental Trace
          </TabsTrigger>
          <TabsTrigger value="metadata" className="data-[state=active]:bg-muted">
            Metadata &amp; Docs
          </TabsTrigger>
          <TabsTrigger value="journal-hygiene" className="data-[state=active]:bg-muted">
            Journal hygiene
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queues" className="space-y-6 mt-0">
      <HybridRepairPanel
        companyId={companyId}
        branchId={branchId}
        asOfDate={asOfDate}
        access={access}
        refreshToken={dataRefreshToken}
        onRefresh={() => void load()}
        onOpenGlCorrectionDraft={(defectId) => setGlCorrectionDefectId(defectId)}
      />

      <div className="rounded-xl border border-blue-500/30 bg-primary/5 p-3 text-xs text-primary dark:text-blue-100 flex gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
        <div>
          <p className="font-semibold">AR/AP repair — scoped apply</p>
          <p className="text-muted-foreground mt-0.5">
            GL posting/reverse/repost is intentionally disabled for safety. Use Fix Link for metadata-only trace
            fixes (contact mapping — GL amounts unchanged). Fix Link saves contact mapping metadata only (including
            trace-only rows).
            {access.readOnly ? ' You have read-only auditor access.' : ''}
          </p>
          {!access.canApplyGlRepair && access.canUseHybridRepair && (
            <p className="text-amber-300/90 mt-1 text-[11px]">
              GL correction apply requires deployed create_gl_correction_journal RPC. Expense sync and Fix Link remain
              available.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <ReportBasisBanner basis="official_gl" detail="GL receivables/payables (raw) cards use Official Posted GL — all non-void posted lines." />
        <ReportBasisBanner basis="effective_party" detail="Effective variance cards subtract audit-only / cancelled chains (same rules as Account Statements effective mode)." />
        {summary?.party_gl_balance_source === 'unified' ? (
          <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-100 flex flex-wrap items-center gap-2">
            <span>
              <strong>Party GL rollup:</strong> Unified Core Ledger — operational{' '}
              {UNIFIED_LEDGER_BASIS_LABELS[summary.party_gl_balance_basis] ?? summary.party_gl_balance_basis}
              {' '}via <code className="text-emerald-200/90">get_unified_contact_party_gl_balances</code>
            </span>
            <span className="text-emerald-200/80">
              Parity baseline:{' '}
              {UNIFIED_LEDGER_BASIS_LABELS[summary.party_gl_parity_basis] ?? summary.party_gl_parity_basis}
              {' '}(vs Contacts legacy)
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-emerald-600/50"
              onClick={() => setCurrentView('party-ledger')}
            >
              Party Ledger
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-emerald-600/50"
              onClick={() => {
                window.history.pushState({}, '', '/admin/unified-ledger-compare');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            >
              Admin Compare
            </Button>
            {access.canUseHybridRepair && summary.party_gl_parity_status === 'pass' ? (
              <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-500/40 text-[10px]">
                Parity PASS
                {summary.party_gl_parity_max_delta != null
                  ? ` (max Δ ${summary.party_gl_parity_max_delta.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
                  : ''}
              </Badge>
            ) : null}
            {access.canUseHybridRepair && summary.party_gl_parity_status === 'fail' ? (
              <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/40 text-[10px]">
                Parity FAIL — legacy shadow delta PKR{' '}
                {(summary.party_gl_parity_max_delta ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Badge>
            ) : null}
            {access.canUseHybridRepair &&
            summary.party_gl_balance_basis !== summary.party_gl_parity_basis ? (
              <span className="text-[10px] text-emerald-200/70">
                Note: operational {summary.party_gl_balance_basis} may differ from parity {summary.party_gl_parity_basis}; that is intentional.
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {companyId && access.canUseHybridRepair ? (
        <ArApRepairProgressStrip
          companyId={companyId}
          branchId={branchId}
          asOfDate={asOfDate}
          glCorrectionRpcAvailable={glCorrectionRpcAvailable}
          varianceReceivables={summary?.variance_receivables ?? null}
          refreshToken={dataRefreshToken}
          onScrollToHybrid={() =>
            document.getElementById('hybrid-repair-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          onScrollToVariance={() =>
            document.getElementById('receivables-variance-breakdown')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        />
      ) : null}

      {summary && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase font-semibold">Status</span>
          <Badge className={cn('border text-sm font-medium', statusBadgeClass(summary.status))}>{summary.statusLabels.join(' · ')}</Badge>
        </div>
      )}

      <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-4 text-sm text-amber-100/90 flex gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-100">Worker Payable vs Supplier AP</p>
          <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
            Lines on account code <strong className="text-muted-foreground">2010</strong> or named “Worker Payable” appear only in the{' '}
            <strong className="text-muted-foreground">Worker payable unmapped</strong> queue. Supplier AP cleanup uses the customer/supplier section — counts are split in the summary.
          </p>
        </div>
      </div>

      {loading && !summary ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
        </div>
      ) : summary ? (
        <>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Effective variance excludes cancelled, voided, and audit-only GL chains (same rules as Account Statements
            effective mode). Audit/raw variance uses full posted GL.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <SummaryCard title="Operational receivables" subtitle="Party GL (1100 subtree, as of)" value={summary.operational_receivables_full} formatCurrency={formatCurrency} tone="green" />
            <SummaryCard title="Operational receivables (signed)" subtitle="Includes negative contacts" value={summary.operational_receivables_signed} formatCurrency={formatCurrency} tone="green" />
            <SummaryCard title="GL receivables (raw)" subtitle="Dr − Cr, as of" value={summary.gl_ar_net_dr_minus_cr} formatCurrency={formatCurrency} tone="white" />
            <SummaryCard title="GL receivables (effective)" subtitle="Raw − audit-only chains" value={summary.effective_gl_ar_net_dr_minus_cr} formatCurrency={formatCurrency} tone="white" />
            <SummaryCard
              title="Receivables variance (raw)"
              subtitle="Operational − GL raw · click for breakdown"
              value={summary.variance_receivables}
              formatCurrency={formatCurrency}
              tone="warn"
              onClick={() => document.getElementById('receivables-variance-breakdown')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />
            <SummaryCard title="Receivables variance (effective)" subtitle="Operational − GL effective" value={summary.effective_variance_receivables} formatCurrency={formatCurrency} tone="warn" />
            <SummaryCard title="Audit-only AR adjustment" subtitle="Hidden from effective" value={summary.audit_only_ar_net_adjustment} formatCurrency={formatCurrency} tone="orange" />
            <SummaryCard title="Operational payables" subtitle="Document due · not party GL" value={summary.operational_payables_full} formatCurrency={formatCurrency} tone="red" />
            <SummaryCard
              title="Party GL payables (signed)"
              subtitle={
                summary.party_gl_balance_source === 'unified'
                  ? `get_unified_contact_party_gl_balances (${UNIFIED_LEDGER_BASIS_LABELS[summary.party_gl_balance_basis] ?? summary.party_gl_balance_basis})`
                  : 'get_contact_party_gl_balances — same as Contacts'
              }
              value={summary.party_gl_payables_signed}
              formatCurrency={formatCurrency}
              tone="green"
            />
            <SummaryCard title="GL payables (raw)" subtitle="AP control Cr − Dr, as of" value={summary.gl_ap_net_credit} formatCurrency={formatCurrency} tone="white" />
            <SummaryCard
              title="Party GL vs control AP"
              subtitle="Supplier sub-ledger − AP 2000"
              value={summary.party_gl_vs_control_variance}
              formatCurrency={formatCurrency}
              tone="warn"
              onClick={() =>
                document.getElementById('payables-variance-explainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            />
            <SummaryCard title="GL payables (effective)" subtitle="Raw − audit-only chains" value={summary.effective_gl_ap_net_credit} formatCurrency={formatCurrency} tone="white" />
            <SummaryCard
              title="Payables variance (raw)"
              subtitle="Operational − GL raw · click for explainer"
              value={summary.variance_payables}
              formatCurrency={formatCurrency}
              tone="warn"
              onClick={() =>
                document.getElementById('payables-variance-explainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            />
            <SummaryCard title="Payables variance (effective)" subtitle="Operational − GL effective" value={summary.effective_variance_payables} formatCurrency={formatCurrency} tone="warn" />
            <SummaryCard title="Audit-only AP adjustment" subtitle="Hidden from effective" value={summary.audit_only_ap_net_adjustment} formatCurrency={formatCurrency} tone="orange" />
            <SummaryCard
              title="Unposted documents"
              subtitle="Click to view queue · missing sale/purchase JE"
              value={summary.unposted_document_count}
              formatCurrency={formatCurrency}
              tone="orange"
              onClick={goToUnpostedOrders}
            />
            <SummaryCard
              title="Unmapped AR + supplier AP JEs"
              subtitle="Click to view queue · distinct JEs"
              value={summary.unmapped_ar_je_count + summary.unmapped_ap_supplier_je_count}
              formatCurrency={formatCurrency}
              tone="orange"
              onClick={() => scrollToQueueSection('unmapped-queue-2')}
            />
            <SummaryCard
              title="Unmapped worker payable JEs"
              subtitle="Click to view queue · 2010 / Worker Payable"
              value={summary.unmapped_ap_worker_je_count}
              formatCurrency={formatCurrency}
              tone="orange"
              onClick={() => scrollToQueueSection('unmapped-queue-3')}
            />
            <SummaryCard
              title="Manual / suspense"
              subtitle="Click to view queue · tagged JE"
              value={summary.manual_adjustment_je_count}
              formatCurrency={formatCurrency}
              tone="violet"
              displayOverride={`${summary.manual_adjustment_je_count} · ${formatCurrency(summary.suspense_net_balance)}`}
              onClick={() => scrollToQueueSection('manual-queue-4')}
            />
          </div>

          <ReceivablesVarianceBreakdownPanel
            companyId={companyId}
            branchId={branchId}
            asOfDate={asOfDate}
            varianceTotal={summary.variance_receivables}
            formatCurrency={formatCurrency}
            refreshToken={dataRefreshToken}
            onOpenSale={openSaleById}
            onGoToUnpostedOrders={goToUnpostedOrders}
            onOpenPartyLedger={(contactId, contactName) =>
              openPartyLedger?.({ contactId, contactName, contactType: 'customer' })
            }
            onGoToFinancialTrace={() => setHubTabAndSync('tie-out')}
            onTraceJournal={(journalEntryId) =>
              setTraceTarget({
                kind: 'manual',
                row: {
                  journal_entry_id: journalEntryId,
                  company_id: companyId || '',
                  branch_id: null,
                  entry_no: null,
                  entry_date: null,
                  description: null,
                  reference_type: null,
                  reference_id: null,
                  created_by: null,
                  created_at: null,
                  suspense_net_dr_minus_cr: 0,
                  detection_kind: null,
                  status: null,
                },
              })
            }
          />

          <PayablesVarianceExplainerPanel
            summary={summary}
            formatCurrency={formatCurrency}
            partyGlSource={summary.party_gl_balance_source}
            partyGlBasis={summary.party_gl_balance_basis}
            partyGlParityBasis={summary.party_gl_parity_basis}
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="border-violet-500/40 text-violet-200" onClick={() => void handleEnsureSuspense()} disabled={ensuringSuspense}>
              {ensuringSuspense ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wrench className="w-4 h-4 mr-2" />}
              Ensure suspense (1195)
            </Button>
            <Button variant="outline" size="sm" className="border-gray-600" onClick={openAccounting}>
              <BookMarked className="w-4 h-4 mr-2" />
              Open Accounting
            </Button>
            <Button variant="outline" size="sm" className="border-gray-600" onClick={openDeveloperIntegrityLab}>
              <ShieldAlert className="w-4 h-4 mr-2" />
              Developer Integrity Lab
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Could not load summary. Apply migrations 20260328–20260330.</p>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="queues" className="data-[state=active]:bg-muted">
            Exception queues
          </TabsTrigger>
          <TabsTrigger value="about" className="data-[state=active]:bg-muted">
            Flows & rules
          </TabsTrigger>
        </TabsList>
        <TabsContent value="queues" className="space-y-6">
          <KnownGlCorrectionSection
            companyId={companyId}
            readOnly={access.readOnly}
            canApplyGlRepair={access.canApplyGlRepair}
            onAction={handleActionableRepair}
            onApplied={() => void load()}
          />

          <QueueSection
            id="unposted-queue-1a"
            title="1a · Non-final documents (not postable)"
            icon={<FileWarning className="w-5 h-5 text-slate-400" />}
            rows={unpostedNonFinal.length}
            subtitle="Order/draft sales — no urgent missing posting"
          >
            <p className="text-xs text-slate-400 mb-3 px-1">
              These are order-stage sales. They are not postable until finalized. Finalize the sale to create normal
              accounting posting, or leave as order if still pending.
            </p>
            {renderUnpostedTable(unpostedNonFinal, 'No non-final documents in queue.')}
          </QueueSection>

          <QueueSection
            id="unposted-queue-1b"
            title="1b · Final documents missing posting"
            icon={<FileWarning className="w-5 h-5 text-orange-400" />}
            rows={unpostedFinalMissing.length}
            subtitle="Requires posting dry-run — apply disabled in Phase 2"
          >
            {renderUnpostedTable(unpostedFinalMissing, 'No final documents missing posting.')}
          </QueueSection>

          <QueueSection id="unmapped-queue-2" title="2 · Customer / supplier AR & supplier AP (unmapped lines)" icon={<Users className="w-5 h-5 text-amber-400" />} rows={unmappedCsVisible.length}>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-2 min-w-[200px]">Document</th>
                  <th className="p-2">Bucket</th>
                  <th className="p-2">Account</th>
                  <th className="p-2 text-right">Dr</th>
                  <th className="p-2 text-right">Cr</th>
                  <th className="p-2 w-32">Fix status</th>
                  <th className="p-2 min-w-[160px]">Repair</th>
                  <th className="p-2 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {unmappedCsVisible.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      No rows.
                    </td>
                  </tr>
                ) : (
                  unmappedCsVisible.map((r) => {
                    const key = unmappedLineItemKey(r);
                    const diag = unmappedDiagByKey.get(key) ?? diagnoseUnmappedLine(r);
                    const repairCls = classifyUnmappedJournalLine(r, diag);
                    return (
                      <tr key={key} className="hover:bg-accent/20">
                        <td className="p-2 align-top">
                          <AccountingRefDisplayCell ui={jeUiByJournalId.get(r.journal_entry_id)} />
                        </td>
                        <td className="p-2 text-xs">
                          {r.control_bucket}
                          {r.ap_sub_bucket ? ` · ${r.ap_sub_bucket}` : ''}
                        </td>
                        <td className="p-2 text-xs">
                          {r.account_name} <span className="text-muted-foreground">{r.account_code}</span>
                        </td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.debit) || 0)}</td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.credit) || 0)}</td>
                        <td className="p-2">
                          <FixStatusButton
                            value={getStatus(key)}
                            disabled={access.readOnly}
                            onClick={() =>
                              openStatusModal('unmapped_line', key, { kind: 'set', status: getStatus(key) }, 'Change fix status')
                            }
                          />
                        </td>
                        <td className="p-2 align-top">
                          <ActionableRepairCard
                            compact
                            readOnly={access.readOnly}
                            classification={repairCls}
                            onAction={(btn) => {
                              if (btn === 'fix_link') setRelinkDryRunRow(r);
                              else handleActionableRepair(btn, repairCls);
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <RowActionsMenu
                            readOnly={access.readOnly}
                            items={[
                              { label: 'Line detail…', onClick: () => setUnmappedDetailRow(r) },
                              { label: 'Row trace', onClick: () => setTraceTarget({ kind: 'unmapped', row: r }) },
                              { label: 'Fix Link…', onClick: () => setRelinkDryRunRow(r) },
                              {
                                label: 'Journal wizard (review)',
                                onClick: () => openJournalWizard(r.journal_entry_id, 'unmapped_line', key),
                              },
                              {
                                label: 'Send to repair queue…',
                                onClick: () =>
                                  openStatusModal('unmapped_line', key, { kind: 'send_repair_queue' }, 'Send to repair queue'),
                              },
                              {
                                label: 'Mark ready to relink…',
                                onClick: () =>
                                  openStatusModal('unmapped_line', key, { kind: 'set', status: 'ready_to_relink' }, 'Mark ready to relink'),
                              },
                              {
                                label: 'Mark resolved…',
                                onClick: () =>
                                  openStatusModal('unmapped_line', key, { kind: 'mark_resolved' }, 'Mark resolved', {
                                    rowStillInQueue: true,
                                  }),
                                className: 'text-emerald-400',
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </QueueSection>

          <QueueSection
            title="2b · Likely mapped — heuristic false positives"
            icon={<Eye className="w-5 h-5 text-cyan-400" />}
            rows={unmappedCsFalsePositive.length}
            subtitle="Payment on_account with matching AR contact — not sent to repair by default"
          >
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-2 min-w-[200px]">Document</th>
                  <th className="p-2">Label</th>
                  <th className="p-2">Account</th>
                  <th className="p-2 text-right">Cr</th>
                  <th className="p-2 w-32">Fix status</th>
                  <th className="p-2 w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {unmappedCsFalsePositive.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No heuristic false positives.
                    </td>
                  </tr>
                ) : (
                  unmappedCsFalsePositive.map((r) => {
                    const key = unmappedLineItemKey(r);
                    return (
                      <tr key={key} className="hover:bg-accent/20 opacity-90">
                        <td className="p-2 align-top">
                          <AccountingRefDisplayCell ui={jeUiByJournalId.get(r.journal_entry_id)} />
                        </td>
                        <td className="p-2">
                          <FalsePositiveBadge />
                        </td>
                        <td className="p-2 text-xs">
                          {r.account_name} <span className="text-muted-foreground">{r.account_code}</span>
                        </td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.credit) || 0)}</td>
                        <td className="p-2">
                          <FixStatusButton
                            value={getStatus(key)}
                            disabled={access.readOnly}
                            onClick={() =>
                              openStatusModal('unmapped_line', key, { kind: 'mark_reviewed' }, 'Mark manual reviewed')
                            }
                          />
                        </td>
                        <td className="p-2">
                          <RowActionsMenu
                            readOnly={access.readOnly}
                            items={[
                              { label: 'Line detail…', onClick: () => setUnmappedDetailRow(r) },
                              { label: 'Row trace', onClick: () => setTraceTarget({ kind: 'unmapped', row: r }) },
                              { label: 'Fix Link…', onClick: () => setRelinkDryRunRow(r) },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </QueueSection>

          <QueueSection
            title="2c · Mapped financially — metadata review"
            icon={<Eye className="w-5 h-5 text-violet-400" />}
            rows={unmappedCsMetadataReview.length}
            subtitle="Ledger correct — JE payment vs payment rental metadata only (e.g. RCV-0008 / Saqib)"
          >
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-2 min-w-[200px]">Document</th>
                  <th className="p-2">Label</th>
                  <th className="p-2">Account</th>
                  <th className="p-2 text-right">Cr</th>
                  <th className="p-2 w-32">Fix status</th>
                  <th className="p-2 w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {unmappedCsMetadataReview.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No metadata-review rows.
                    </td>
                  </tr>
                ) : (
                  unmappedCsMetadataReview.map((r) => {
                    const key = unmappedLineItemKey(r);
                    const diag = unmappedDiagByKey.get(key);
                    return (
                      <tr key={key} className="hover:bg-accent/20 opacity-90">
                        <td className="p-2 align-top">
                          <AccountingRefDisplayCell ui={jeUiByJournalId.get(r.journal_entry_id)} />
                        </td>
                        <td className="p-2 align-top space-y-1">
                          <MetadataReviewBadge />
                          {diag?.metadataReviewReason && (
                            <p className="text-[10px] text-violet-200/80 leading-snug max-w-xs">{diag.metadataReviewReason}</p>
                          )}
                        </td>
                        <td className="p-2 text-xs">
                          {r.account_name} <span className="text-muted-foreground">{r.account_code}</span>
                        </td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.credit) || 0)}</td>
                        <td className="p-2">
                          <FixStatusButton
                            value={getStatus(key)}
                            disabled={access.readOnly}
                            onClick={() =>
                              openStatusModal('unmapped_line', key, { kind: 'mark_reviewed' }, 'Mark metadata reviewed')
                            }
                          />
                        </td>
                        <td className="p-2">
                          <RowActionsMenu
                            readOnly={access.readOnly}
                            items={[
                              { label: 'Line detail…', onClick: () => setUnmappedDetailRow(r) },
                              { label: 'Row trace', onClick: () => setTraceTarget({ kind: 'unmapped', row: r }) },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </QueueSection>

          <QueueSection
            title="2d · Applied GL corrections (audit only)"
            icon={<Eye className="w-5 h-5 text-emerald-400" />}
            rows={unmappedCsAppliedGlCorrection.length + appliedGlCorrections.length}
            subtitle="JV-000207 class — correction already posted; source JE unchanged"
          >
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-2 min-w-[200px]">Document</th>
                  <th className="p-2">Label</th>
                  <th className="p-2">Fingerprint</th>
                  <th className="p-2 w-32">Fix status</th>
                  <th className="p-2 w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {unmappedCsAppliedGlCorrection.length === 0 && appliedGlCorrections.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No applied GL corrections in audit queue.
                    </td>
                  </tr>
                ) : (
                  <>
                    {unmappedCsAppliedGlCorrection.map((r) => {
                      const key = unmappedLineItemKey(r);
                      const diag = unmappedDiagByKey.get(key);
                      return (
                        <tr key={key} className="hover:bg-accent/20 opacity-90">
                          <td className="p-2 align-top">
                            <AccountingRefDisplayCell ui={jeUiByJournalId.get(r.journal_entry_id)} />
                          </td>
                          <td className="p-2 align-top space-y-1">
                            <AppliedGlCorrectionBadge />
                            {diag?.appliedGlCorrectionReason ? (
                              <p className="text-[10px] text-emerald-200/80 leading-snug max-w-xs">{diag.appliedGlCorrectionReason}</p>
                            ) : null}
                          </td>
                          <td className="p-2 text-[10px] text-muted-foreground font-mono">{r.reference_type || 'gl_correction'}</td>
                          <td className="p-2">
                            <FixStatusButton
                              value={getStatus(key)}
                              disabled={access.readOnly}
                              onClick={() =>
                                openStatusModal('unmapped_line', key, { kind: 'mark_reviewed' }, 'Mark correction reviewed')
                              }
                            />
                          </td>
                          <td className="p-2">
                            <RowActionsMenu
                              readOnly={access.readOnly}
                              items={[
                                { label: 'Line detail…', onClick: () => setUnmappedDetailRow(r) },
                                { label: 'Row trace', onClick: () => setTraceTarget({ kind: 'unmapped', row: r }) },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {appliedGlCorrections.map((row) => (
                      <tr key={`audit-${row.journal_entry_id}`} className="hover:bg-accent/20 opacity-80">
                        <td className="p-2 text-muted-foreground font-mono text-xs">{row.entry_no || row.journal_entry_id.slice(0, 8)}</td>
                        <td className="p-2">
                          <AppliedGlCorrectionBadge />
                          <p className="text-[10px] text-muted-foreground mt-1 max-w-xs">{row.description || 'Applied developer repair'}</p>
                        </td>
                        <td className="p-2 text-[10px] text-muted-foreground font-mono break-all">{row.action_fingerprint}</td>
                        <td className="p-2 text-xs text-muted-foreground">—</td>
                        <td className="p-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-violet-300"
                            onClick={() =>
                              setTraceTarget({
                                kind: 'manual',
                                row: {
                                  journal_entry_id: row.journal_entry_id,
                                  company_id: companyId || '',
                                  branch_id: null,
                                  entry_no: row.entry_no,
                                  entry_date: row.entry_date,
                                  description: row.description,
                                  reference_type: 'gl_correction',
                                  reference_id: null,
                                  created_by: null,
                                  created_at: null,
                                  suspense_net_dr_minus_cr: 0,
                                  detection_kind: null,
                                  status: null,
                                },
                              })
                            }
                          >
                            Trace
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </QueueSection>

          <QueueSection id="unmapped-queue-3" title="3 · Worker payable unmapped (2010 / Worker Payable only)" icon={<ClipboardList className="w-5 h-5 text-rose-400" />} rows={unmappedWpVisible.length}>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-2 min-w-[200px]">Document</th>
                  <th className="p-2">Account</th>
                  <th className="p-2 text-right">Dr</th>
                  <th className="p-2 text-right">Cr</th>
                  <th className="p-2 w-32">Fix status</th>
                  <th className="p-2 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {unmappedWpVisible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No worker-payable unmapped lines.
                    </td>
                  </tr>
                ) : (
                  unmappedWpVisible.map((r) => {
                    const key = unmappedLineItemKey(r);
                    return (
                      <tr key={key} className="hover:bg-accent/20">
                        <td className="p-2 align-top">
                          <AccountingRefDisplayCell ui={jeUiByJournalId.get(r.journal_entry_id)} />
                        </td>
                        <td className="p-2 text-xs">
                          {r.account_name} <span className="text-muted-foreground">{r.account_code}</span>
                        </td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.debit) || 0)}</td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.credit) || 0)}</td>
                        <td className="p-2">
                          <FixStatusButton
                            value={getStatus(key)}
                            disabled={access.readOnly}
                            onClick={() =>
                              openStatusModal('unmapped_line', key, { kind: 'set', status: getStatus(key) }, 'Change fix status')
                            }
                          />
                        </td>
                        <td className="p-2">
                          <RowActionsMenu
                            readOnly={access.readOnly}
                            items={[
                              { label: 'Line detail…', onClick: () => setUnmappedDetailRow(r) },
                              { label: 'Row trace', onClick: () => setTraceTarget({ kind: 'unmapped', row: r }) },
                              {
                                label: 'Journal wizard (review)',
                                onClick: () => openJournalWizard(r.journal_entry_id, 'unmapped_line', key),
                              },
                              { label: 'Fix Link…', onClick: () => setRelinkDryRunRow(r) },
                              {
                                label: 'Mark resolved…',
                                onClick: () =>
                                  openStatusModal('unmapped_line', key, { kind: 'mark_resolved' }, 'Mark resolved', {
                                    rowStillInQueue: true,
                                  }),
                                className: 'text-emerald-400',
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </QueueSection>

          <QueueSection id="manual-queue-4" title="4 · Manual reconciliation / suspense" icon={<ShieldAlert className="w-5 h-5 text-violet-400" />} rows={manualVisible.length}>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-2 min-w-[200px]">Document</th>
                  <th className="p-2">Date</th>
                  <th className="p-2 text-right">Suspense net</th>
                  <th className="p-2">Kind</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 w-32">Fix status</th>
                  <th className="p-2 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {manualVisible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No rows.
                    </td>
                  </tr>
                ) : (
                  manualVisible.map((r) => {
                    const key = manualJeItemKey(r);
                    return (
                      <tr key={key} className="hover:bg-accent/20">
                        <td className="p-2 align-top">
                          <AccountingRefDisplayCell ui={jeUiByJournalId.get(r.journal_entry_id)} />
                        </td>
                        <td className="p-2 text-muted-foreground">{r.entry_date || '—'}</td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.suspense_net_dr_minus_cr) || 0)}</td>
                        <td className="p-2 text-xs">{r.detection_kind}</td>
                        <td className="p-2 text-muted-foreground text-xs max-w-xs truncate" title={r.description || ''}>
                          {r.description}
                        </td>
                        <td className="p-2">
                          <FixStatusButton
                            value={getStatus(key)}
                            disabled={access.readOnly}
                            onClick={() =>
                              openStatusModal('manual_je', key, { kind: 'set', status: getStatus(key) }, 'Change fix status')
                            }
                          />
                        </td>
                        <td className="p-2">
                          <RowActionsMenu
                            readOnly={access.readOnly}
                            items={[
                              { label: 'Row trace', onClick: () => setTraceTarget({ kind: 'manual', row: r }) },
                              {
                                label: 'Journal wizard (review)',
                                onClick: () => openJournalWizard(r.journal_entry_id, 'manual_je', key),
                              },
                              {
                                label: 'Send to repair queue…',
                                onClick: () =>
                                  openStatusModal('manual_je', key, { kind: 'send_repair_queue' }, 'Send to repair queue'),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </QueueSection>
        </TabsContent>
        <TabsContent value="about" className="prose prose-invert prose-sm max-w-none text-muted-foreground space-y-3">
          <p>
            <strong className="text-gray-200">Phase 2 (current):</strong> dry-run wizards, trace panels, and status changes with required notes.
            Post, relink apply, and journal execute are disabled or gated — no GL mutations.
          </p>
          <p>
            <strong className="text-gray-200">Non-final sales (order/draft):</strong> queue 1a — order-stage sales are not postable until finalized.
          </p>
          <p>
            <strong className="text-gray-200">False-positive unmapped AR:</strong> payment JE + on_account payment + matching AR linked contact → queue 2b.
          </p>
          <p>
            <strong className="text-gray-200">Metadata review (e.g. RCV-0008):</strong> rental payment with correct AR sub-ledger but JE reference_type=payment → queue 2c; no relink/repost in Phase 2.
          </p>
          <p>
            <strong className="text-gray-200">Fix status:</strong> stored in <code>ar_ap_reconciliation_review_items.fix_status</code>; mark resolved requires reason and stays reviewed if row remains in SQL view.
          </p>
        </TabsContent>
      </Tabs>
        </TabsContent>

        <TabsContent value="tie-out" className="mt-0">
          <FinancialTraceDiagnosticsPanel
            embedded
            visibleTabs={['tieout']}
            initialTab="tieout"
            onOpenHybridRepair={scrollToHybridRepair}
            onSwitchHubTab={(t) => setHubTabAndSync(t as ArApDiagnosticsHubTab)}
          />
        </TabsContent>

        <TabsContent value="party-rental" className="mt-0">
          <FinancialTraceDiagnosticsPanel
            embedded
            visibleTabs={['party', 'rental']}
            initialTab="party"
            onOpenHybridRepair={scrollToHybridRepair}
            onSwitchHubTab={(t) => setHubTabAndSync(t as ArApDiagnosticsHubTab)}
          />
        </TabsContent>

        <TabsContent value="metadata" className="mt-0">
          <FinancialTraceDiagnosticsPanel
            embedded
            visibleTabs={['metadata', 'non-final', 'deeper']}
            initialTab="metadata"
            onOpenHybridRepair={scrollToHybridRepair}
            onSwitchHubTab={(t) => setHubTabAndSync(t as ArApDiagnosticsHubTab)}
          />
        </TabsContent>

        <TabsContent value="journal-hygiene" className="mt-0">
          <JournalHygienePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function unpostedDocumentUiRef(r: UnpostedDocumentRow): AccountingUiRef {
  const technicalRef = `${r.source_type || 'source'}:${r.source_id}`;
  const doc = (r.document_no || '').trim();
  const displayRef = doc || technicalRef;
  const st = (r.source_type || '').toLowerCase();
  const sourceLabel =
    st === 'sale' ? 'Sale' : st === 'purchase' ? 'Purchase' : st ? st.replace(/_/g, ' ') : 'Document';
  return {
    displayRef,
    technicalRef,
    sourceLabel,
    entryNoBadge: null,
    documentResolved: Boolean(doc),
  };
}

function RowActionsMenu(props: {
  readOnly?: boolean;
  items: Array<{ label: string; onClick: () => void; className?: string }>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-blue-400">
          <ExternalLink size={14} className="mr-1" /> Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border text-gray-200">
        {props.items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            className={cn('cursor-pointer', item.className, props.readOnly && 'opacity-50 pointer-events-none')}
            onClick={() => !props.readOnly && item.onClick()}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SummaryCard(props: {
  title: string;
  subtitle: string;
  value: number | null;
  formatCurrency: (n: number) => string;
  tone: 'green' | 'red' | 'white' | 'warn' | 'orange' | 'violet';
  displayOverride?: string;
  onClick?: () => void;
}) {
  const { title, subtitle, value, formatCurrency, tone, displayOverride, onClick } = props;
  const val =
    displayOverride != null && displayOverride !== ''
      ? displayOverride
      : tone === 'orange'
        ? String(value ?? 0)
        : value != null
          ? formatCurrency(value)
          : '—';
  const color =
    tone === 'green'
      ? 'text-[var(--erp-money-positive)]'
      : tone === 'red'
        ? 'text-red-400'
        : tone === 'warn'
          ? 'text-amber-400'
          : tone === 'orange'
            ? 'text-orange-300'
            : tone === 'violet'
              ? 'text-violet-300'
              : 'text-foreground';
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border bg-muted/40 p-4 text-left w-full',
        onClick && 'hover:border-amber-500/40 hover:bg-card/70 cursor-pointer transition-colors'
      )}
    >
      <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">{title}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
      <p className={cn('text-xl font-bold tabular-nums mt-2', color)}>{val}</p>
    </Wrapper>
  );
}

function QueueSection(props: {
  id?: string;
  title: string;
  icon: React.ReactNode;
  rows: number;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={props.id} className="rounded-xl border border-border bg-card/40 overflow-hidden scroll-mt-4">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
        {props.icon}
        <div>
          <h2 className="text-sm font-semibold text-foreground">{props.title}</h2>
          <p className="text-xs text-muted-foreground">
            {props.rows} row(s) shown
            {props.subtitle ? ` · ${props.subtitle}` : ''}
          </p>
        </div>
      </div>
      <div className="p-2 overflow-x-auto">{props.children}</div>
    </div>
  );
}

export default ArApReconciliationCenterPage;
