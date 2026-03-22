import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookMarked,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
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
import { Input } from '@/app/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  RelinkContactDialog,
  UnpostedRepairDialog,
} from '@/app/components/accounting/ArApRepairDialogs';

const FIX_STATUSES: ArApFixStatus[] = [
  'new',
  'reviewed',
  'ready_to_post',
  'ready_to_relink',
  'ready_to_reverse_repost',
  'resolved',
];

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

function FixStatusSelect(props: {
  value: ArApFixStatus;
  onChange: (v: ArApFixStatus) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.target.value as ArApFixStatus)}
      className="max-w-[140px] bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
    >
      {FIX_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, ' ')}
        </option>
      ))}
    </select>
  );
}

export function ArApReconciliationCenterPage() {
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { canPostAccounting } = useCheckPermission();
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

  const [unpostedRepairRow, setUnpostedRepairRow] = useState<UnpostedDocumentRow | null>(null);
  const [journalWizardId, setJournalWizardId] = useState<string | null>(null);
  const [relinkRow, setRelinkRow] = useState<UnmappedJournalRow | null>(null);
  const [jeUiByJournalId, setJeUiByJournalId] = useState<Map<string, AccountingUiRef>>(new Map());

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

  const onFixStatusChange = async (kind: string, key: string, status: ArApFixStatus) => {
    if (!companyId) return;
    const r = await upsertArApItemFixStatus(companyId, kind, key, status);
    if (!r.ok) {
      toast.error(r.error || 'Could not save status');
      return;
    }
    setItemStates((prev) => new Map(prev).set(key, status));
    toast.success('Status updated');
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
  const unmappedCsVisible = useMemo(
    () => unmappedCustomerSupplier.filter((r) => rowVisible(unmappedLineItemKey(r))),
    [unmappedCustomerSupplier, rowVisible]
  );
  const unmappedWpVisible = useMemo(
    () => unmappedWorkerPayable.filter((r) => rowVisible(unmappedLineItemKey(r))),
    [unmappedWorkerPayable, rowVisible]
  );
  const manualVisible = useMemo(
    () => manual.filter((r) => rowVisible(manualJeItemKey(r))),
    [manual, rowVisible]
  );

  if (!companyId) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>Select a company to use the Reconciliation Center.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-4 md:p-8 space-y-6">
      <UnpostedRepairDialog
        open={!!unpostedRepairRow}
        onOpenChange={(o) => !o && setUnpostedRepairRow(null)}
        row={unpostedRepairRow}
        companyId={companyId}
        branchId={branchId}
        canPost={canPostAccounting}
        onSuccess={() => void load()}
      />
      <JournalRepairWizardDialog
        open={!!journalWizardId}
        onOpenChange={(o) => !o && setJournalWizardId(null)}
        journalEntryId={journalWizardId}
        companyId={companyId}
        canPost={canPostAccounting}
        onSuccess={() => void load()}
      />
      <RelinkContactDialog
        open={!!relinkRow}
        onOpenChange={(o) => !o && setRelinkRow(null)}
        row={relinkRow}
        companyId={companyId}
        onSuccess={() => void load()}
      />

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
          <Input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-40 bg-gray-900 border-gray-700 text-white"
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
          <QueueSection title="1 · Missing / unposted documents" icon={<FileWarning className="w-5 h-5 text-orange-400" />} rows={unpostedVisible.length}>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="p-2 min-w-[200px]">Document</th>
                  <th className="p-2">Contact</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2">Date</th>
                  <th className="p-2 w-32">Fix status</th>
                  <th className="p-2 w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {unpostedVisible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      No rows.
                    </td>
                  </tr>
                ) : (
                  unpostedVisible.map((r) => {
                    const key = unpostedItemKey(r);
                    return (
                      <tr key={key} className="hover:bg-gray-800/20">
                        <td className="p-2 align-top">
                          <AccountingRefDisplayCell ui={unpostedDocumentUiRef(r)} />
                        </td>
                        <td className="p-2 text-gray-300">{r.contact_name || '—'}</td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.amount) || 0)}</td>
                        <td className="p-2 text-gray-400">{r.document_date || '—'}</td>
                        <td className="p-2">
                          <FixStatusSelect value={getStatus(key)} onChange={(v) => void onFixStatusChange('unposted', key, v)} />
                        </td>
                        <td className="p-2">
                          <RowMini
                            onOpenSource={() => openSourceDocument(r)}
                            onPost={() => setUnpostedRepairRow(r)}
                            onReviewed={() => void onFixStatusChange('unposted', key, 'reviewed')}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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
                          <FixStatusSelect value={getStatus(key)} onChange={(v) => void onFixStatusChange('unmapped_line', key, v)} />
                        </td>
                        <td className="p-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 text-blue-400">
                                <ExternalLink size={14} className="mr-1" /> Actions
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-gray-200">
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setJournalWizardId(r.journal_entry_id)}>
                                Open journal wizard
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setRelinkRow(r)}>
                                Relink contact…
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer" onClick={() => void onFixStatusChange('unmapped_line', key, 'ready_to_reverse_repost')}>
                                Mark ready to reverse/repost
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer" onClick={() => void onFixStatusChange('unmapped_line', key, 'ready_to_relink')}>
                                Mark ready to relink
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-700" />
                              <DropdownMenuItem className="cursor-pointer text-emerald-400" onClick={() => void onFixStatusChange('unmapped_line', key, 'resolved')}>
                                <CheckCircle2 size={14} className="mr-2 inline" /> Mark resolved
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                          <FixStatusSelect value={getStatus(key)} onChange={(v) => void onFixStatusChange('unmapped_line', key, v)} />
                        </td>
                        <td className="p-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 text-blue-400">
                                <ExternalLink size={14} className="mr-1" /> Actions
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-gray-200">
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setJournalWizardId(r.journal_entry_id)}>
                                Open journal wizard
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setRelinkRow(r)}>
                                Relink worker contact…
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer" onClick={() => void onFixStatusChange('unmapped_line', key, 'resolved')}>
                                Mark resolved
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                          <FixStatusSelect value={getStatus(key)} onChange={(v) => void onFixStatusChange('manual_je', key, v)} />
                        </td>
                        <td className="p-2">
                          <Button variant="ghost" size="sm" className="h-8 text-blue-400" onClick={() => setJournalWizardId(r.journal_entry_id)}>
                            <ExternalLink size={14} className="mr-1" /> Wizard
                          </Button>
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
            <strong className="text-gray-200">Missing posting:</strong> opens validation + <code>postSaleDocumentAccounting</code> /{' '}
            <code>postPurchaseDocumentAccounting</code>. Branch checkbox blocks post when filter differs.
          </p>
          <p>
            <strong className="text-gray-200">Journal wizard:</strong> shows lines; sale/purchase → void canonical document JEs + repost; else void this JE with reason.
          </p>
          <p>
            <strong className="text-gray-200">Relink:</strong> saves <code>journal_party_contact_mapping</code> (audit). Does not alter posted lines until party_contact_id rollout.
          </p>
          <p>
            <strong className="text-gray-200">Fix status:</strong> stored in <code>ar_ap_reconciliation_review_items.fix_status</code>; resolved rows can be hidden.
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

function RowMini(props: { onOpenSource: () => void; onPost: () => void; onReviewed: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-blue-400">
          <ExternalLink size={14} className="mr-1" /> Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-gray-200">
        <DropdownMenuItem className="cursor-pointer" onClick={props.onOpenSource}>
          Open source document
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={props.onPost}>
          Validate & create posting…
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-gray-700" />
        <DropdownMenuItem className="cursor-pointer text-emerald-400" onClick={props.onReviewed}>
          Quick: mark reviewed
        </DropdownMenuItem>
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

function QueueSection(props: { title: string; icon: React.ReactNode; rows: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900/80">
        {props.icon}
        <div>
          <h2 className="text-sm font-semibold text-white">{props.title}</h2>
          <p className="text-xs text-gray-500">{props.rows} row(s) shown</p>
        </div>
      </div>
      <div className="p-2 overflow-x-auto">{props.children}</div>
    </div>
  );
}

export default ArApReconciliationCenterPage;
