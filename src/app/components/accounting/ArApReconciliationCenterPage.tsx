import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookMarked,
  ClipboardList,
  ExternalLink,
  Eye,
  FileWarning,
  Loader2,
  RefreshCw,
  Scale,
  ShieldAlert,
  Users,
  Wrench,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
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
  fetchIntegrityLabSummary,
  fetchManualAdjustments,
  fetchReconciliationItemStates,
  fetchUnmappedJournalLines,
  fetchUnpostedDocuments,
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
import { resolveArApReconciliationAccess } from '@/app/lib/arApReconciliationAccess';
import { diagnoseUnpostedRow, diagnoseUnmappedLine } from '@/app/lib/arApReconciliationDiagnostics';
import { batchFetchUnpostedDocumentStatuses, loadUnmappedTrace } from '@/app/services/arApReconciliationTraceService';
import { SourceDocumentDetailModal, UnmappedRowDetailModal } from '@/app/components/accounting/ar-ap-repair/SourceDocumentDetailModal';
import { PostingDryRunWizard } from '@/app/components/accounting/ar-ap-repair/PostingDryRunWizard';
import { RelinkDryRunWizard } from '@/app/components/accounting/ar-ap-repair/RelinkDryRunWizard';
import { StatusChangeModal, type StatusChangeIntent } from '@/app/components/accounting/ar-ap-repair/StatusChangeModal';
import { RowTracePanel, type TraceTarget } from '@/app/components/accounting/ar-ap-repair/RowTracePanel';
import { FalsePositiveBadge, PostabilityBadge, RiskBadge } from '@/app/components/accounting/ar-ap-repair/ArApRepairBadges';

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
      return 'bg-gray-500/15 text-gray-300 border-gray-600';
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
      className="max-w-[140px] bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200 text-left hover:bg-gray-800 disabled:opacity-50"
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
  const access = useMemo(() => resolveArApReconciliationAccess(userRole), [userRole]);
  const { setCurrentView, setOpenSaleIdForView } = useNavigation();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<IntegrityLabSummary | null>(null);
  const [unposted, setUnposted] = useState<UnpostedDocumentRow[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedJournalRow[]>([]);
  const [manual, setManual] = useState<ManualAdjustmentRow[]>([]);
  const [itemStates, setItemStates] = useState<Map<string, ArApFixStatus>>(new Map());
  const [hideResolved, setHideResolved] = useState(true);
  const [ensuringSuspense, setEnsuringSuspense] = useState(false);
  const [activeTab, setActiveTab] = useState('queues');

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
      const [sum, up, um, man, states] = await Promise.all([
        fetchIntegrityLabSummary(companyId, branchId, asOfDate),
        fetchUnpostedDocuments(companyId, branchId, asOfDate),
        fetchUnmappedJournalLines(companyId, branchId, asOfDate),
        fetchManualAdjustments(companyId, branchId, asOfDate),
        fetchReconciliationItemStates(companyId),
      ]);
      setSummary(sum);
      setUnposted(up);
      setUnmapped(um);
      setManual(man);
      setItemStates(states);
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

  const openSourceDocument = (row: UnpostedDocumentRow) => {
    if (row.source_type === 'sale') {
      setOpenSaleIdForView?.(row.source_id);
      setCurrentView('sales');
      toast.message('Opened Sales', { description: `Invoice ${row.document_no || row.source_id}` });
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

  const unmappedCsVisible = useMemo(
    () =>
      unmappedCustomerSupplier
        .filter((r) => rowVisible(unmappedLineItemKey(r)))
        .filter((r) => !unmappedDiagByKey.get(unmappedLineItemKey(r))?.isLikelyFalsePositive),
    [unmappedCustomerSupplier, rowVisible, unmappedDiagByKey]
  );

  const unmappedCsFalsePositive = useMemo(
    () =>
      unmappedCustomerSupplier
        .filter((r) => rowVisible(unmappedLineItemKey(r)))
        .filter((r) => unmappedDiagByKey.get(unmappedLineItemKey(r))?.isLikelyFalsePositive),
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
      <thead className="text-left text-gray-500 border-b border-gray-800">
        <tr>
          <th className="p-2 min-w-[200px]">Document</th>
          <th className="p-2">Label</th>
          <th className="p-2">Contact</th>
          <th className="p-2 text-right">Amount</th>
          <th className="p-2">Date</th>
          <th className="p-2 w-32">Fix status</th>
          <th className="p-2 w-40">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800/80">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="p-6 text-center text-gray-500">
              {emptyLabel}
            </td>
          </tr>
        ) : (
          rows.map((r) => {
            const key = unpostedItemKey(r);
            const st = unpostedStatusByKey.get(key);
            const diag = diagnoseUnpostedRow(r, st);
            return (
              <tr key={key} className="hover:bg-gray-800/20">
                <td className="p-2 align-top">
                  <AccountingRefDisplayCell ui={unpostedDocumentUiRef(r)} />
                </td>
                <td className="p-2 align-top">
                  <div className="flex flex-col gap-1">
                    <PostabilityBadge label={diag.label} isNonFinal={diag.isNonFinal} />
                    <RiskBadge level={diag.riskLevel} />
                  </div>
                </td>
                <td className="p-2 text-gray-300">{r.contact_name || '—'}</td>
                <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.amount) || 0)}</td>
                <td className="p-2 text-gray-400">{r.document_date || '—'}</td>
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
                <td className="p-2">
                  <RowActionsMenu
                    readOnly={access.readOnly}
                    items={[
                      { label: 'Source detail…', onClick: () => setSourceDetailRow(r) },
                      { label: 'Row trace', onClick: () => setTraceTarget({ kind: 'unposted', row: r }) },
                      ...(!diag.isNonFinal
                        ? [{ label: 'Posting dry-run…', onClick: () => setPostingDryRunRow(r) }]
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
      <div className="min-h-screen bg-[#0B0F19] text-white p-8 flex flex-col items-center justify-center gap-4">
        <ShieldAlert className="w-12 h-12 text-amber-400" />
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-gray-400 text-sm max-w-md text-center">
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
      <div className="p-8 text-center text-gray-400">
        <p>Select a company to use the Reconciliation Center.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-4 md:p-8 space-y-6">
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

      <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 text-xs text-blue-100/90 flex gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
        <div>
          <p className="font-semibold">Phase 2 — safe UI only</p>
          <p className="text-gray-400 mt-0.5">
            Dry-run previews only. Post, relink apply, and journal execute are disabled or gated. No GL, payment, or journal mutations.
            {access.readOnly ? ' You have read-only auditor access.' : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white -ml-2 gap-1.5" onClick={() => setCurrentView('contacts')}>
            <ArrowLeft size={16} /> Back to Contacts
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <Scale className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AR/AP Reconciliation Center</h1>
              <p className="text-sm text-gray-400 max-w-2xl">
                Queues are grouped: unposted docs, customer/supplier AR·AP unmapped lines, worker payable unmapped (separate), then manual/suspense.
                Repair actions are explicit — no silent GL changes.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-gray-500 uppercase font-semibold shrink-0">As of</label>
          <DatePicker
            value={asOfDate}
            onChange={(v) => setAsOfDate(v)}
            className="w-40"
          />
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={hideResolved} onChange={(e) => setHideResolved(e.target.checked)} className="rounded border-gray-600" />
            Hide resolved
          </label>
          <Button variant="outline" size="sm" className="border-gray-600 gap-1.5" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {summary && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 uppercase font-semibold">Status</span>
          <Badge className={cn('border text-sm font-medium', statusBadgeClass(summary.status))}>{summary.statusLabels.join(' · ')}</Badge>
        </div>
      )}

      <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-4 text-sm text-amber-100/90 flex gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-100">Worker Payable vs Supplier AP</p>
          <p className="text-gray-400 text-xs mt-1 leading-relaxed">
            Lines on account code <strong className="text-gray-300">2010</strong> or named “Worker Payable” appear only in the{' '}
            <strong className="text-gray-300">Worker payable unmapped</strong> queue. Supplier AP cleanup uses the customer/supplier section — counts are split in the summary.
          </p>
        </div>
      </div>

      {loading && !summary ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <SummaryCard title="Operational receivables" subtitle="Contacts RPC (full)" value={summary.operational_receivables_full} formatCurrency={formatCurrency} tone="green" />
            <SummaryCard title="GL receivables" subtitle="Dr − Cr, as of" value={summary.gl_ar_net_dr_minus_cr} formatCurrency={formatCurrency} tone="white" />
            <SummaryCard title="Receivables variance" subtitle="Operational − GL" value={summary.variance_receivables} formatCurrency={formatCurrency} tone="warn" />
            <SummaryCard title="Operational payables" subtitle="Contacts RPC (full)" value={summary.operational_payables_full} formatCurrency={formatCurrency} tone="red" />
            <SummaryCard title="GL payables" subtitle="Cr − Dr, as of" value={summary.gl_ap_net_credit} formatCurrency={formatCurrency} tone="white" />
            <SummaryCard title="Payables variance" subtitle="Operational − GL" value={summary.variance_payables} formatCurrency={formatCurrency} tone="warn" />
            <SummaryCard title="Unposted documents" subtitle="Missing sale/purchase JE" value={summary.unposted_document_count} formatCurrency={formatCurrency} tone="orange" />
            <SummaryCard title="Unmapped AR + supplier AP JEs" subtitle="Distinct JEs (heuristic)" value={summary.unmapped_ar_je_count + summary.unmapped_ap_supplier_je_count} formatCurrency={formatCurrency} tone="orange" />
            <SummaryCard title="Unmapped worker payable JEs" subtitle="2010 / Worker Payable" value={summary.unmapped_ap_worker_je_count} formatCurrency={formatCurrency} tone="orange" />
            <SummaryCard
              title="Manual / suspense"
              subtitle="Tagged JE · suspense Dr−Cr"
              value={summary.manual_adjustment_je_count}
              formatCurrency={formatCurrency}
              tone="violet"
              displayOverride={`${summary.manual_adjustment_je_count} · ${formatCurrency(summary.suspense_net_balance)}`}
            />
          </div>

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
        <p className="text-gray-500 text-sm">Could not load summary. Apply migrations 20260328–20260330.</p>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger value="queues" className="data-[state=active]:bg-gray-800">
            Exception queues
          </TabsTrigger>
          <TabsTrigger value="about" className="data-[state=active]:bg-gray-800">
            Flows & rules
          </TabsTrigger>
        </TabsList>
        <TabsContent value="queues" className="space-y-6">
          <QueueSection
            title="1a · Non-final documents (not postable)"
            icon={<FileWarning className="w-5 h-5 text-slate-400" />}
            rows={unpostedNonFinal.length}
            subtitle="Order/draft sales — no urgent missing posting"
          >
            {renderUnpostedTable(unpostedNonFinal, 'No non-final documents in queue.')}
          </QueueSection>

          <QueueSection
            title="1b · Final documents missing posting"
            icon={<FileWarning className="w-5 h-5 text-orange-400" />}
            rows={unpostedFinalMissing.length}
            subtitle="Requires posting dry-run — apply disabled in Phase 2"
          >
            {renderUnpostedTable(unpostedFinalMissing, 'No final documents missing posting.')}
          </QueueSection>

          <QueueSection title="2 · Customer / supplier AR & supplier AP (unmapped lines)" icon={<Users className="w-5 h-5 text-amber-400" />} rows={unmappedCsVisible.length}>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="p-2 min-w-[200px]">Document</th>
                  <th className="p-2">Bucket</th>
                  <th className="p-2">Account</th>
                  <th className="p-2 text-right">Dr</th>
                  <th className="p-2 text-right">Cr</th>
                  <th className="p-2 w-32">Fix status</th>
                  <th className="p-2 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {unmappedCsVisible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-500">
                      No rows.
                    </td>
                  </tr>
                ) : (
                  unmappedCsVisible.map((r) => {
                    const key = unmappedLineItemKey(r);
                    return (
                      <tr key={key} className="hover:bg-gray-800/20">
                        <td className="p-2 align-top">
                          <AccountingRefDisplayCell ui={jeUiByJournalId.get(r.journal_entry_id)} />
                        </td>
                        <td className="p-2 text-xs">
                          {r.control_bucket}
                          {r.ap_sub_bucket ? ` · ${r.ap_sub_bucket}` : ''}
                        </td>
                        <td className="p-2 text-xs">
                          {r.account_name} <span className="text-gray-600">{r.account_code}</span>
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
                              { label: 'Relink dry-run…', onClick: () => setRelinkDryRunRow(r) },
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
              <thead className="text-left text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="p-2 min-w-[200px]">Document</th>
                  <th className="p-2">Label</th>
                  <th className="p-2">Account</th>
                  <th className="p-2 text-right">Cr</th>
                  <th className="p-2 w-32">Fix status</th>
                  <th className="p-2 w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {unmappedCsFalsePositive.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      No heuristic false positives.
                    </td>
                  </tr>
                ) : (
                  unmappedCsFalsePositive.map((r) => {
                    const key = unmappedLineItemKey(r);
                    return (
                      <tr key={key} className="hover:bg-gray-800/20 opacity-90">
                        <td className="p-2 align-top">
                          <AccountingRefDisplayCell ui={jeUiByJournalId.get(r.journal_entry_id)} />
                        </td>
                        <td className="p-2">
                          <FalsePositiveBadge />
                        </td>
                        <td className="p-2 text-xs">
                          {r.account_name} <span className="text-gray-600">{r.account_code}</span>
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
                              { label: 'Relink dry-run (preview)', onClick: () => setRelinkDryRunRow(r) },
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

          <QueueSection title="3 · Worker payable unmapped (2010 / Worker Payable only)" icon={<ClipboardList className="w-5 h-5 text-rose-400" />} rows={unmappedWpVisible.length}>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="p-2 min-w-[200px]">Document</th>
                  <th className="p-2">Account</th>
                  <th className="p-2 text-right">Dr</th>
                  <th className="p-2 text-right">Cr</th>
                  <th className="p-2 w-32">Fix status</th>
                  <th className="p-2 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {unmappedWpVisible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      No worker-payable unmapped lines.
                    </td>
                  </tr>
                ) : (
                  unmappedWpVisible.map((r) => {
                    const key = unmappedLineItemKey(r);
                    return (
                      <tr key={key} className="hover:bg-gray-800/20">
                        <td className="p-2 align-top">
                          <AccountingRefDisplayCell ui={jeUiByJournalId.get(r.journal_entry_id)} />
                        </td>
                        <td className="p-2 text-xs">
                          {r.account_name} <span className="text-gray-600">{r.account_code}</span>
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
                              { label: 'Relink dry-run…', onClick: () => setRelinkDryRunRow(r) },
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

          <QueueSection title="4 · Manual reconciliation / suspense" icon={<ShieldAlert className="w-5 h-5 text-violet-400" />} rows={manualVisible.length}>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b border-gray-800">
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
              <tbody className="divide-y divide-gray-800/80">
                {manualVisible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-500">
                      No rows.
                    </td>
                  </tr>
                ) : (
                  manualVisible.map((r) => {
                    const key = manualJeItemKey(r);
                    return (
                      <tr key={key} className="hover:bg-gray-800/20">
                        <td className="p-2 align-top">
                          <AccountingRefDisplayCell ui={jeUiByJournalId.get(r.journal_entry_id)} />
                        </td>
                        <td className="p-2 text-gray-400">{r.entry_date || '—'}</td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.suspense_net_dr_minus_cr) || 0)}</td>
                        <td className="p-2 text-xs">{r.detection_kind}</td>
                        <td className="p-2 text-gray-500 text-xs max-w-xs truncate" title={r.description || ''}>
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
        <TabsContent value="about" className="prose prose-invert prose-sm max-w-none text-gray-400 space-y-3">
          <p>
            <strong className="text-gray-200">Phase 2 (current):</strong> dry-run wizards, trace panels, and status changes with required notes.
            Post, relink apply, and journal execute are disabled or gated — no GL mutations.
          </p>
          <p>
            <strong className="text-gray-200">Non-final sales (order/draft):</strong> shown in queue 1a with label &quot;Non-final / not postable&quot; — not urgent missing posting.
          </p>
          <p>
            <strong className="text-gray-200">False-positive unmapped AR:</strong> payment JE + on_account payment + matching AR linked contact → queue 2b, not default repair.
          </p>
          <p>
            <strong className="text-gray-200">Fix status:</strong> stored in <code>ar_ap_reconciliation_review_items.fix_status</code>; mark resolved requires reason and stays reviewed if row remains in SQL view.
          </p>
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
      <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-gray-200">
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
}) {
  const { title, subtitle, value, formatCurrency, tone, displayOverride } = props;
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
      ? 'text-green-400'
      : tone === 'red'
        ? 'text-red-400'
        : tone === 'warn'
          ? 'text-amber-400'
          : tone === 'orange'
            ? 'text-orange-300'
            : tone === 'violet'
              ? 'text-violet-300'
              : 'text-white';
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">{title}</p>
      <p className="text-[10px] text-gray-600 mt-0.5">{subtitle}</p>
      <p className={cn('text-xl font-bold tabular-nums mt-2', color)}>{val}</p>
    </div>
  );
}

function QueueSection(props: {
  title: string;
  icon: React.ReactNode;
  rows: number;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900/80">
        {props.icon}
        <div>
          <h2 className="text-sm font-semibold text-white">{props.title}</h2>
          <p className="text-xs text-gray-500">
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
