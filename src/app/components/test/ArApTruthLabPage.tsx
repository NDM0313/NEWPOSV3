'use client';

/**
 * AR/AP Truth Lab — Phase 2: table lineage, payment mutation trace, reflection matrix.
 * Route: /test/ar-ap-truth-lab
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  loadTruthLabContacts,
  fetchTruthLabSnapshot,
  type TruthLabContactKind,
  type TruthLabDualBasis,
  type TruthLabSnapshot,
} from '@/app/services/arApTruthLabService';
import {
  fetchContactTableLineage,
  fetchPaymentDeepTrace,
  buildReflectionMatrix,
  buildDebugPayload,
  loadPhase4EntityBundle,
  buildEffectiveVsAuditCompare,
  buildPaymentPostingExpectedVsActual,
  buildDuplicatePostingAudit,
  buildPaymentRepairAssessment,
  type TableLineageRecord,
  type PaymentDeepTrace,
  type ContactLineageBundle,
} from '@/app/services/truthLabTraceWorkbenchService';
import type { TransactionEntityType } from '@/app/services/transactionMutationService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { toast } from 'sonner';
import { journalEntryPresentationFromHeader, presentationLabel } from '@/app/lib/journalLinePresentation';

const LS_EXCEPTION_KEY = 'ar-ap-truth-lab-exception-dismissed';
const LS_CONFIRMED_BAD_JES = 'ar-ap-truth-lab-confirmed-bad-jes';

type ConfirmedBadJeRow = { jeId: string; note: string; status: string; at: string };

function loadConfirmedBadJes(): ConfirmedBadJeRow[] {
  try {
    const raw = localStorage.getItem(LS_CONFIRMED_BAD_JES);
    if (!raw) return [];
    const a = JSON.parse(raw) as ConfirmedBadJeRow[];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function getDismissedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_EXCEPTION_KEY);
    if (!raw) return new Set();
    const a = JSON.parse(raw) as string[];
    return new Set(Array.isArray(a) ? a : []);
  } catch {
    return new Set();
  }
}

function toggleDismissed(id: string, ignored: boolean) {
  const s = getDismissedSet();
  if (ignored) s.add(id);
  else s.delete(id);
  localStorage.setItem(LS_EXCEPTION_KEY, JSON.stringify([...s]));
}

async function copyText(label: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error('Copy failed');
  }
}

function LineageBadges({ badges }: { badges: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) =>
        b ? (
          <Badge key={b} variant="outline" className="text-[10px] border-gray-600 text-gray-400">
            {b}
          </Badge>
        ) : null
      )}
    </div>
  );
}

export default function ArApTruthLabPage() {
  const { companyId, branchId } = useSupabase();
  const { setCurrentView } = useNavigation();
  const { formatCurrency } = useFormatCurrency();

  const [kind, setKind] = useState<TruthLabContactKind>('customer');
  const [contacts, setContacts] = useState<{ id: string; name: string; type: string }[]>([]);
  const [contactId, setContactId] = useState('');
  const [dualBasis, setDualBasis] = useState<TruthLabDualBasis>('ar');
  const [dateFrom, setDateFrom] = useState(() => {
    const t = new Date();
    t.setMonth(t.getMonth() - 3);
    return t.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [includeVoided, setIncludeVoided] = useState(false);
  const [includeReversals, setIncludeReversals] = useState(true);
  const [includeManualJe, setIncludeManualJe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [snap, setSnap] = useState<TruthLabSnapshot | null>(null);
  const [lineageBundle, setLineageBundle] = useState<ContactLineageBundle | null>(null);
  const [dismissTick, setDismissTick] = useState(0);

  const [workbenchMode, setWorkbenchMode] = useState<'contact' | 'payment' | 'document'>('contact');
  const [paymentRefInput, setPaymentRefInput] = useState('');
  const [paymentIdInput, setPaymentIdInput] = useState('');
  const [journalEntryIdInput, setJournalEntryIdInput] = useState('');
  const [paymentTrace, setPaymentTrace] = useState<PaymentDeepTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [lineDetail, setLineDetail] = useState<TableLineageRecord | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [phase4EntityType, setPhase4EntityType] = useState<TransactionEntityType>('payment');
  const [phase4EntityId, setPhase4EntityId] = useState('');
  const [phase4Bundle, setPhase4Bundle] = useState<Awaited<ReturnType<typeof loadPhase4EntityBundle>> | null>(null);
  const [phase4Loading, setPhase4Loading] = useState(false);

  const selected = useMemo(() => contacts.find((c) => c.id === contactId), [contacts, contactId]);

  const effectiveVsAudit = useMemo(() => buildEffectiveVsAuditCompare(paymentTrace), [paymentTrace]);
  const postingExpectedVsActual = useMemo(() => buildPaymentPostingExpectedVsActual(paymentTrace), [paymentTrace]);
  const duplicatePostingAudit = useMemo(() => buildDuplicatePostingAudit(paymentTrace), [paymentTrace]);
  const repairAssessment = useMemo(() => buildPaymentRepairAssessment(paymentTrace), [paymentTrace]);

  const [confirmedBadJes, setConfirmedBadJes] = useState<ConfirmedBadJeRow[]>([]);
  const [confirmJeInput, setConfirmJeInput] = useState('');
  const [confirmNoteInput, setConfirmNoteInput] = useState('');

  useEffect(() => {
    setConfirmedBadJes(loadConfirmedBadJes());
  }, []);

  useEffect(() => {
    const pid = paymentTrace?.payment ? String((paymentTrace.payment as { id?: string }).id || '') : '';
    if (pid) setPhase4EntityId(pid);
  }, [paymentTrace]);

  const runPhase4Load = async () => {
    if (!companyId || !phase4EntityId.trim()) {
      toast.message('Set entity UUID (payment trace fills payment id).');
      return;
    }
    setPhase4Loading(true);
    try {
      const b = await loadPhase4EntityBundle(companyId, phase4EntityType, phase4EntityId.trim());
      setPhase4Bundle(b);
      if (b.errors.length) toast.message(b.errors.join(' · '));
    } finally {
      setPhase4Loading(false);
    }
  };

  const loadContacts = useCallback(async () => {
    if (!companyId) return;
    const rows = await loadTruthLabContacts(companyId, kind);
    setContacts(rows);
    if (rows.length && !rows.some((r) => r.id === contactId)) {
      setContactId(rows[0].id);
    }
  }, [companyId, kind, contactId]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const run = async () => {
    if (!companyId || !contactId || !selected) return;
    setLoading(true);
    try {
      const b = branchId === 'all' ? null : branchId;
      const params = {
        companyId,
        branchId: b,
        contactId,
        contactName: selected.name,
        contactType: selected.type,
        contactKind: kind,
        dualBasis: selected.type === 'both' ? dualBasis : selected.type === 'supplier' ? 'ap' : 'ar',
        dateFrom,
        dateTo,
        includeVoided,
        includeReversals,
        includeManualJe,
      };
      const [data, lineage] = await Promise.all([
        fetchTruthLabSnapshot(params),
        fetchContactTableLineage(companyId, contactId, dateFrom, dateTo, includeVoided),
      ]);
      setSnap(data);
      setLineageBundle(lineage);
    } finally {
      setLoading(false);
    }
  };

  const runPaymentTrace = async () => {
    if (!companyId) return;
    setTraceLoading(true);
    try {
      const t = await fetchPaymentDeepTrace(companyId, {
        paymentId: paymentIdInput.trim() || undefined,
        referenceNumber: paymentRefInput.trim() || undefined,
        journalEntryId: journalEntryIdInput.trim() || undefined,
      });
      setPaymentTrace(t);
      if (t.errors.length) toast.message(t.errors.join(' · '));
    } finally {
      setTraceLoading(false);
    }
  };

  const dismissed = useMemo(() => getDismissedSet(), [dismissTick]);

  const primaryOp = snap?.isArSlice ? snap.operationalRpcRecv : snap?.operationalRpcPay;
  const primaryGl = snap?.isArSlice ? snap.partyGlAr : snap?.partyGlAp;
  const primaryDelta =
    primaryOp != null && primaryGl != null ? primaryOp - primaryGl : snap?.primaryDelta ?? null;
  const unmappedCount = snap?.isArSlice ? snap.companyUnmappedAr : snap?.companyUnmappedAp;

  const reflectionRows = useMemo(
    () => buildReflectionMatrix(snap, paymentTrace, selected?.name || ''),
    [snap, paymentTrace, selected?.name]
  );

  const debugMeta = useMemo(
    () => ({
      rpcs: [
        'get_contact_balances_summary',
        'get_contact_party_gl_balances',
        'get_customer_ar_gl_ledger_for_contact / get_supplier_ap_gl_ledger_for_contact',
        'count_unmapped_ar_ap_journal_entries (via reconciliation service)',
      ],
      tables: [
        'contacts',
        'payments',
        'payment_allocations',
        'sales',
        'purchases',
        'journal_entries',
        'journal_entry_lines',
        'accounts',
        'v_ar_ap_unmapped_journals',
      ],
      filters: {
        companyId,
        branchId: branchId === 'all' ? null : branchId,
        contactId,
        dateFrom,
        dateTo,
        includeVoided,
        includeReversals,
        includeManualJe,
      },
    }),
    [companyId, branchId, contactId, dateFrom, dateTo, includeVoided, includeReversals, includeManualJe]
  );

  const copyDebugPayload = () => {
    const payload = buildDebugPayload({
      companyId: companyId || '',
      branchId: branchId === 'all' ? null : branchId ?? null,
      contactId,
      dateFrom,
      dateTo,
      flags: { includeVoided, includeReversals, includeManualJe },
      snap,
      trace: paymentTrace,
      lineage: lineageBundle,
      meta: debugMeta,
    });
    void copyText('Debug payload', payload);
  };

  const openContactsApp = () => {
    setCurrentView('contacts' as any);
    if (typeof window !== 'undefined') window.history.pushState({}, '', '/');
  };

  const sqlForPayment = (id: string) =>
    `-- Truth Lab: payment deep trace\nSELECT * FROM payments WHERE id = '${id}' AND company_id = '${companyId}';\n` +
    `SELECT * FROM journal_entries WHERE company_id = '${companyId}' AND (payment_id = '${id}' OR reference_id = '${id}');\n` +
    `SELECT jel.* FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id\n` +
    `WHERE je.company_id = '${companyId}' AND (je.payment_id = '${id}' OR je.reference_id = '${id}');`;

  return (
    <div className="min-h-screen bg-[#0f1419] text-gray-100 p-6 max-w-[1700px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex flex-wrap items-center gap-2">
          AR / AP Truth Lab
          <Badge variant="outline" className="border-amber-500/60 text-amber-200/90">
            Phase 4 — mutations + unified feed + effective read model
          </Badge>
        </h1>
        <p className="text-sm text-gray-400 mt-2 max-w-3xl">
          Canonical operational RPCs + party GL + journal tables. Use <strong className="text-gray-300">Table trace</strong>{' '}
          for row UUIDs, <strong className="text-gray-300">Mutation</strong> for payment account/amount edits (PF-14),{' '}
          <strong className="text-gray-300">Reflection matrix</strong> for where amounts appear across surfaces.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Route: <code className="text-gray-500">/test/ar-ap-truth-lab</code>
        </p>
      </div>

      <Card className="bg-gray-900/80 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg">Workbench mode</CardTitle>
          <CardDescription className="text-gray-500">
            Contact overview loads snapshot + lineage. Payment mutation trace resolves a single payment by ref / UUID / JE id.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(['contact', 'payment', 'document'] as const).map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={workbenchMode === m ? 'default' : 'outline'}
              className={workbenchMode === m ? '' : 'border-gray-700 text-gray-300'}
              onClick={() => setWorkbenchMode(m)}
            >
              {m === 'contact' ? 'Contact overview' : m === 'payment' ? 'Payment mutation trace' : 'Document trace (use payment / sale id in inputs)'}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-gray-900/80 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription className="text-gray-500">
            Branch <code className="text-gray-600">all</code> → null RPC branch. Inspector below lists exact RPCs and flags.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4 items-end">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-400">Contact type list</span>
              <select
                className="bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as TruthLabContactKind);
                  setContactId('');
                }}
              >
                <option value="customer">Customer (+ both)</option>
                <option value="supplier">Supplier (+ both)</option>
                <option value="both">All contacts</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm min-w-[220px] flex-1">
              <span className="text-gray-400">Contact</span>
              <select
                className="bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </label>
            {selected?.type === 'both' && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-400">Basis (both)</span>
                <select
                  className="bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm"
                  value={dualBasis}
                  onChange={(e) => setDualBasis(e.target.value as TruthLabDualBasis)}
                >
                  <option value="ar">AR (receivable)</option>
                  <option value="ap">AP (payable)</option>
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-400">From</span>
              <input
                type="date"
                className="bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-400">To</span>
              <input
                type="date"
                className="bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
          </div>
          {workbenchMode === 'payment' && (
            <div className="flex flex-wrap gap-3 items-end border border-gray-800 rounded-lg p-3 bg-black/20">
              <label className="flex flex-col gap-1 text-xs min-w-[140px]">
                <span className="text-gray-500">reference_number</span>
                <input
                  className="bg-gray-950 border border-gray-700 rounded px-2 py-1.5 font-mono text-[11px]"
                  placeholder="RCV-0002"
                  value={paymentRefInput}
                  onChange={(e) => setPaymentRefInput(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs flex-1 min-w-[200px]">
                <span className="text-gray-500">payment UUID</span>
                <input
                  className="bg-gray-950 border border-gray-700 rounded px-2 py-1.5 font-mono text-[11px]"
                  placeholder="447f4205-…"
                  value={paymentIdInput}
                  onChange={(e) => setPaymentIdInput(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs flex-1 min-w-[200px]">
                <span className="text-gray-500">journal_entry UUID</span>
                <input
                  className="bg-gray-950 border border-gray-700 rounded px-2 py-1.5 font-mono text-[11px]"
                  value={journalEntryIdInput}
                  onChange={(e) => setJournalEntryIdInput(e.target.value)}
                />
              </label>
              <Button type="button" variant="secondary" disabled={traceLoading} onClick={() => void runPaymentTrace()}>
                {traceLoading ? 'Tracing…' : 'Resolve payment trace'}
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-6 items-center text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeVoided} onChange={(e) => setIncludeVoided(e.target.checked)} />
              Include voided payments
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeReversals} onChange={(e) => setIncludeReversals(e.target.checked)} />
              Include reversals on GL table
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeManualJe} onChange={(e) => setIncludeManualJe(e.target.checked)} />
              Include manual / unclassified GL rows
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void run()} disabled={loading || !companyId || !contactId}>
              {loading ? 'Loading…' : 'Load snapshot + table lineage'}
            </Button>
            <Button type="button" variant="outline" className="border-gray-600" onClick={() => void run()}>
              Recompute snapshot
            </Button>
            <Button type="button" variant="outline" className="border-gray-600" onClick={copyDebugPayload}>
              Copy debug payload
            </Button>
          </div>
        </CardContent>
      </Card>

      {snap?.errors?.length ? (
        <div className="text-amber-300 text-sm">{snap.errors.join(' · ')}</div>
      ) : null}
      {lineageBundle?.errors?.length ? (
        <div className="text-amber-300/90 text-xs">{lineageBundle.errors.join(' · ')}</div>
      ) : null}

      {snap && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-4">
          <TabsList className="bg-gray-900 border border-gray-800 flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="operational">Operational rows</TabsTrigger>
            <TabsTrigger value="gl">GL rows</TabsTrigger>
            <TabsTrigger value="delta">Delta explainer</TabsTrigger>
            <TabsTrigger value="lineage">Table trace</TabsTrigger>
            <TabsTrigger value="reflection">Reflection matrix</TabsTrigger>
            <TabsTrigger value="mutation">Mutation timeline</TabsTrigger>
            <TabsTrigger value="phase4">Entity mutations + feed</TabsTrigger>
            <TabsTrigger value="exceptions">Exception queue</TabsTrigger>
            <TabsTrigger value="inspector">RPC / SQL inspector</TabsTrigger>
            <TabsTrigger value="actions">Test actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <Card className="bg-gray-900/60 border-gray-800">
                <CardHeader className="py-3">
                  <CardDescription>Operational (Contacts RPC)</CardDescription>
                  <CardTitle className="text-lg text-white">
                    {primaryOp != null ? formatCurrency(primaryOp) : '—'}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-gray-900/60 border-gray-800">
                <CardHeader className="py-3">
                  <CardDescription>Party GL</CardDescription>
                  <CardTitle className="text-lg text-white">{primaryGl != null ? formatCurrency(primaryGl) : '—'}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-gray-900/60 border-gray-800">
                <CardHeader className="py-3">
                  <CardDescription>Delta (OP − GL)</CardDescription>
                  <CardTitle className="text-lg text-amber-200/95">
                    {primaryDelta != null ? formatCurrency(primaryDelta) : '—'}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-gray-900/60 border-gray-800">
                <CardHeader className="py-3">
                  <CardDescription>Unmapped JE (company)</CardDescription>
                  <CardTitle className="text-lg text-white">{unmappedCount ?? '—'}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-gray-900/60 border-gray-800">
                <CardHeader className="py-3">
                  <CardDescription>Allocated manual receipts</CardDescription>
                  <CardTitle className="text-lg text-white">
                    {snap.allocTotals ? formatCurrency(snap.allocTotals.allocated) : '—'}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-gray-900/60 border-gray-800">
                <CardHeader className="py-3">
                  <CardDescription>Unallocated manual receipts</CardDescription>
                  <CardTitle className="text-lg text-white">
                    {snap.allocTotals ? formatCurrency(snap.allocTotals.unallocated) : '—'}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
            {paymentTrace?.payment && (
              <Card className="bg-violet-950/30 border-violet-800/50">
                <CardHeader>
                  <CardTitle className="text-base text-violet-200">Active payment trace (side panel)</CardTitle>
                  <CardDescription>
                    {String((paymentTrace.payment as { reference_number?: string }).reference_number)} · amount{' '}
                    {formatCurrency(Number((paymentTrace.payment as { amount?: number }).amount) || 0)} · account{' '}
                    {paymentTrace.paymentAccount?.code} {paymentTrace.paymentAccount?.name}
                  </CardDescription>
                </CardHeader>
                {postingExpectedVsActual && (
                  <CardContent className="space-y-3 border-t border-violet-800/40 pt-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">Expected posting vs actual</span>
                      <Badge
                        variant="outline"
                        className={
                          postingExpectedVsActual.overallOk
                            ? 'border-emerald-700/60 text-emerald-200'
                            : 'border-rose-700/60 text-rose-200'
                        }
                      >
                        {postingExpectedVsActual.overallOk ? 'Resolved / OK' : 'Mismatch'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{postingExpectedVsActual.narrative}</p>
                    <ul className="text-xs text-gray-300 space-y-2 list-disc pl-4">
                      <li>
                        Current payment row: amount {formatCurrency(postingExpectedVsActual.finalAmount)} · final liquidity{' '}
                        {postingExpectedVsActual.finalLiquidityAccountId?.slice(0, 8) ?? '—'}…
                      </li>
                      <li>
                        Primary JE liquidity (original receipt):{' '}
                        {postingExpectedVsActual.primaryLiquidityAccountId?.slice(0, 8) ?? '—'}…
                      </li>
                      <li>
                        Amount-delta fingerprint liquidity:{' '}
                        {postingExpectedVsActual.amountDeltaLiquidityFromFingerprint?.slice(0, 8) ?? '— (legacy or none)'}…
                      </li>
                    </ul>
                    {postingExpectedVsActual.checks.length > 0 && (
                      <div className="rounded-lg border border-gray-800 bg-gray-950/50 overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-800">
                              <th className="p-2">Check</th>
                              <th className="p-2">Expected</th>
                              <th className="p-2">Actual</th>
                              <th className="p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {postingExpectedVsActual.checks.map((c, idx) => (
                              <tr key={`${idx}-${c.check}`} className="border-b border-gray-800/60">
                                <td className="p-2 text-gray-300">{c.check}</td>
                                <td className="p-2 text-gray-400 max-w-[200px]">{c.expected}</td>
                                <td className="p-2 text-gray-400 max-w-[200px]">{c.actual}</td>
                                <td className="p-2">
                                  <span className={c.ok ? 'text-emerald-400' : 'text-rose-400'}>{c.ok ? 'OK' : 'Fail'}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {duplicatePostingAudit && (
                      <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-white">Duplicate posting detector</span>
                          <Badge
                            variant="outline"
                            className={
                              duplicatePostingAudit.overallClean
                                ? 'border-emerald-700/60 text-emerald-200'
                                : 'border-rose-700/60 text-rose-200'
                            }
                          >
                            {duplicatePostingAudit.overallClean ? 'No critical duplicates' : 'Review flags'}
                          </Badge>
                        </div>
                        {duplicatePostingAudit.flags.length === 0 ? (
                          <p className="text-xs text-gray-500">No duplicate fingerprint / same-triple transfer patterns on this trace.</p>
                        ) : (
                          <ul className="text-[11px] space-y-2 text-gray-300">
                            {duplicatePostingAudit.flags.map((f, i) => (
                              <li
                                key={`${f.code}-${i}`}
                                className={
                                  f.severity === 'critical' ? 'text-rose-200/95' : f.severity === 'warn' ? 'text-amber-200/90' : 'text-gray-400'
                                }
                              >
                                <span className="font-mono text-[10px] text-gray-500">{f.code}</span> — {f.message}
                                {f.journalEntryIds.length > 0 && (
                                  <span className="block text-gray-500 mt-0.5">
                                    JE ids: {f.journalEntryIds.map((id) => id.slice(0, 8)).join(', ')}…
                                  </span>
                                )}
                                {f.detail && (
                                  <span className="block text-gray-500 font-mono text-[10px] mt-0.5 break-all">{f.detail}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        <details className="text-[10px] text-gray-500">
                          <summary className="cursor-pointer text-gray-400">Fingerprints & economic_event_id</summary>
                          <pre className="mt-2 overflow-x-auto max-h-32 bg-gray-950/80 rounded p-2 border border-gray-800">
                            {JSON.stringify(
                              {
                                fingerprints: duplicatePostingAudit.fingerprints,
                                economicEventIds: duplicatePostingAudit.economicEventIds,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      </div>
                    )}
                    {repairAssessment && (
                      <div className="rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-cyan-100">Repair assessment</span>
                          <Badge variant="outline" className="text-[10px] border-cyan-700/50 text-cyan-200/90">
                            {repairAssessment.classification}
                          </Badge>
                          <span className="text-[10px] text-gray-500">
                            dup critical: {repairAssessment.duplicateCriticalCount} · posting checks fail:{' '}
                            {repairAssessment.postingChecksFailed}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{repairAssessment.summary}</p>
                        <ul className="text-[11px] text-gray-300 list-disc pl-4 space-y-1">
                          {repairAssessment.repairRecommendation.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {postingExpectedVsActual && Object.keys(postingExpectedVsActual.liquidityNetByAccountId).length > 0 && (
                      <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-2">
                        <p className="text-xs font-medium text-gray-400 mb-2">Actual net (Dr − Cr) by account — traced JEs only</p>
                        <div className="overflow-x-auto max-h-40">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="text-left text-gray-500 border-b border-gray-800">
                                <th className="p-1.5">Account</th>
                                <th className="p-1.5">Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(postingExpectedVsActual.liquidityNetByAccountId)
                                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                                .map(([aid, net]) => {
                                  const line = paymentTrace.journalLines?.find((l) => String(l.account_id) === aid);
                                  const label =
                                    line?.account_code && line?.account_name
                                      ? `${line.account_code} ${line.account_name}`
                                      : `${aid.slice(0, 8)}…`;
                                  return (
                                    <tr key={aid} className="border-b border-gray-800/60">
                                      <td className="p-1.5 text-gray-300">{label}</td>
                                      <td className="p-1.5 tabular-nums text-gray-200">{formatCurrency(net)}</td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {paymentTrace.journalEntries && paymentTrace.journalEntries.length > 0 && (
                      <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-2">
                        <p className="text-xs font-medium text-gray-400 mb-2">Linked journal_entries (chronological)</p>
                        <div className="overflow-x-auto max-h-48">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="text-left text-gray-500 border-b border-gray-800">
                                <th className="p-1.5">JE id</th>
                                <th className="p-1.5">ref_type</th>
                                <th className="p-1.5">Presentation</th>
                                <th className="p-1.5">pay_id / econ</th>
                                <th className="p-1.5">created</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...paymentTrace.journalEntries]
                                .sort((a, b) =>
                                  String((a as { created_at?: string }).created_at || '').localeCompare(
                                    String((b as { created_at?: string }).created_at || '')
                                  )
                                )
                                .map((je) => {
                                  const id = String((je as { id?: string }).id || '');
                                  const rt = String((je as { reference_type?: string }).reference_type || '');
                                  const fp = String((je as { action_fingerprint?: string }).action_fingerprint || '');
                                  const pk = journalEntryPresentationFromHeader(rt, fp);
                                  const ee = String((je as { economic_event_id?: string }).economic_event_id || '');
                                  const pid = String((je as { payment_id?: string }).payment_id || '');
                                  return (
                                    <tr key={id} className="border-b border-gray-800/60 align-top">
                                      <td className="p-1.5 font-mono text-gray-400">{id.slice(0, 10)}…</td>
                                      <td className="p-1.5 text-gray-300">{rt || '—'}</td>
                                      <td className="p-1.5">
                                        <span className="text-amber-200/85">{presentationLabel(pk)}</span>
                                      </td>
                                      <td className="p-1.5 font-mono text-gray-500">
                                        {(pid || ee).slice(0, 8) || '—'}…
                                      </td>
                                      <td className="p-1.5 text-gray-500">
                                        {String((je as { created_at?: string }).created_at || '').slice(0, 19)}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {paymentTrace.journalLines && paymentTrace.journalLines.length > 0 && (
                      <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-2">
                        <p className="text-xs font-medium text-gray-400 mb-2">journal_entry_lines (all linked JEs)</p>
                        <div className="overflow-x-auto max-h-56">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="text-left text-gray-500 border-b border-gray-800">
                                <th className="p-1.5">Line id</th>
                                <th className="p-1.5">JE</th>
                                <th className="p-1.5">Account</th>
                                <th className="p-1.5">Dr</th>
                                <th className="p-1.5">Cr</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paymentTrace.journalLines.map((l) => (
                                <tr key={String(l.id)} className="border-b border-gray-800/60">
                                  <td className="p-1.5 font-mono text-gray-500">{String(l.id).slice(0, 8)}…</td>
                                  <td className="p-1.5 font-mono text-gray-500">
                                    {String(l.journal_entry_id || '').slice(0, 8)}…
                                  </td>
                                  <td className="p-1.5 text-gray-300">
                                    {l.account_code} {l.account_name}
                                  </td>
                                  <td className="p-1.5 tabular-nums">{formatCurrency(Number(l.debit) || 0)}</td>
                                  <td className="p-1.5 tabular-nums">{formatCurrency(Number(l.credit) || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg border border-amber-900/40 bg-amber-950/15 p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-100/95">Confirmed bad historical JEs (local notes)</p>
                      <p className="text-[10px] text-gray-500">
                        Stored in <code className="text-gray-400">localStorage</code> only — for repair runbook. Does not change GL.
                      </p>
                      <div className="flex flex-wrap gap-2 items-end">
                        <label className="flex flex-col gap-0.5 text-[10px]">
                          <span className="text-gray-500">journal_entry id</span>
                          <input
                            className="bg-gray-950 border border-gray-700 rounded px-2 py-1 font-mono text-[10px] w-64"
                            value={confirmJeInput}
                            onChange={(e) => setConfirmJeInput(e.target.value)}
                            placeholder="UUID"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5 text-[10px] flex-1 min-w-[120px]">
                          <span className="text-gray-500">note / status</span>
                          <input
                            className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-[10px]"
                            value={confirmNoteInput}
                            onChange={(e) => setConfirmNoteInput(e.target.value)}
                            placeholder="voided / reversed / pending SQL"
                          />
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const jeId = confirmJeInput.trim();
                            if (!jeId) {
                              toast.message('Enter JE UUID');
                              return;
                            }
                            const row: ConfirmedBadJeRow = {
                              jeId,
                              note: confirmNoteInput.trim() || 'flagged',
                              status: 'confirmed_local',
                              at: new Date().toISOString(),
                            };
                            const next = [...confirmedBadJes.filter((r) => r.jeId !== jeId), row];
                            localStorage.setItem(LS_CONFIRMED_BAD_JES, JSON.stringify(next));
                            setConfirmedBadJes(next);
                            setConfirmJeInput('');
                            setConfirmNoteInput('');
                            toast.success('Saved to local list');
                          }}
                        >
                          Add / update
                        </Button>
                      </div>
                      {confirmedBadJes.length > 0 && (
                        <div className="overflow-x-auto max-h-32 border border-gray-800 rounded">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="text-gray-500 text-left border-b border-gray-800">
                                <th className="p-1.5">JE id</th>
                                <th className="p-1.5">note</th>
                                <th className="p-1.5">at</th>
                                <th className="p-1.5"> </th>
                              </tr>
                            </thead>
                            <tbody>
                              {confirmedBadJes.map((r) => (
                                <tr key={r.jeId} className="border-b border-gray-800/60">
                                  <td className="p-1.5 font-mono text-gray-400">{r.jeId.slice(0, 12)}…</td>
                                  <td className="p-1.5 text-gray-300">{r.note}</td>
                                  <td className="p-1.5 text-gray-500">{r.at.slice(0, 19)}</td>
                                  <td className="p-1.5">
                                    <button
                                      type="button"
                                      className="text-rose-400 hover:underline text-[10px]"
                                      onClick={() => {
                                        const next = confirmedBadJes.filter((x) => x.jeId !== r.jeId);
                                        localStorage.setItem(LS_CONFIRMED_BAD_JES, JSON.stringify(next));
                                        setConfirmedBadJes(next);
                                      }}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    {(paymentTrace.transactionMutations?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-1">transaction_mutations</p>
                        <pre className="text-[10px] text-gray-500 overflow-x-auto max-h-40 bg-gray-950/80 rounded p-2 border border-gray-800">
                          {JSON.stringify(paymentTrace.transactionMutations, null, 2)}
                        </pre>
                      </div>
                    )}
                    {(paymentTrace.allocations?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-1">payment_allocations</p>
                        <pre className="text-[10px] text-gray-500 overflow-x-auto max-h-32 bg-gray-950/80 rounded p-2 border border-gray-800">
                          {JSON.stringify(paymentTrace.allocations, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="operational" className="mt-4">
            <Card className="bg-gray-900/80 border-gray-800">
              <CardHeader>
                <CardTitle>Operational truth</CardTitle>
                <CardDescription>{snap.isArSlice ? 'customerLedgerAPI.getLedgerSummary' : 'getSupplierOperationalLedgerData'}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="py-2 pr-4">Row</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.operationalMovementRows.map((r) => (
                      <tr key={r.label} className="border-b border-gray-800/80">
                        <td className="py-2 pr-4">{r.label}</td>
                        <td className="py-2 pr-4 tabular-nums">{formatCurrency(r.amount)}</td>
                        <td className="py-2 text-gray-500 text-xs">{r.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gl" className="mt-4">
            <Card className="bg-gray-900/80 border-gray-800">
              <CardHeader>
                <CardTitle>GL truth</CardTitle>
                <CardDescription>Filtered journal lines (RPC); toggles apply here only.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Ref</th>
                      <th className="py-2 pr-2">Account</th>
                      <th className="py-2 pr-2">Dr</th>
                      <th className="py-2 pr-2">Cr</th>
                      <th className="py-2 pr-2">Run</th>
                      <th className="py-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.glEntriesFiltered.map((e) => (
                      <tr key={`${e.journal_entry_id}-${e.date}-${e.reference_number}`} className="border-b border-gray-800/60">
                        <td className="py-1.5 pr-2 whitespace-nowrap">{e.date}</td>
                        <td className="py-1.5 pr-2">{e.reference_number}</td>
                        <td className="py-1.5 pr-2">{e.gl_account_code || e.account_name}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{formatCurrency(e.debit || 0)}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{formatCurrency(e.credit || 0)}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{formatCurrency(e.running_balance || 0)}</td>
                        <td className="py-1.5 text-gray-500">{e.document_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delta" className="mt-4">
            <Card className="bg-gray-900/80 border-gray-800">
              <CardHeader>
                <CardTitle>Delta explainer</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="py-2 pr-2">source_row_id</th>
                      <th className="py-2 pr-2">type</th>
                      <th className="py-2 pr-2">ref</th>
                      <th className="py-2 pr-2">op</th>
                      <th className="py-2 pr-2">gl</th>
                      <th className="py-2 pr-2">delta</th>
                      <th className="py-2">reason_bucket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.deltaRows.map((r) => (
                      <tr key={`${r.sourceRowId}-${r.documentRef}`} className="border-b border-gray-800/60">
                        <td className="py-1.5 pr-2 font-mono text-[10px]">{r.sourceRowId}</td>
                        <td className="py-1.5 pr-2">{r.sourceType}</td>
                        <td className="py-1.5 pr-2">{r.documentRef}</td>
                        <td className="py-1.5 pr-2">{r.operationalEffect}</td>
                        <td className="py-1.5 pr-2">{r.glEffect}</td>
                        <td className="py-1.5 pr-2">{r.delta}</td>
                        <td className="py-1.5 text-amber-200/80">{r.reasonBucket}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lineage" className="mt-4 space-y-3">
            <Card className="bg-gray-900/80 border-gray-800">
              <CardHeader>
                <CardTitle>Section 5 — Table trace / lineage</CardTitle>
                <CardDescription>
                  Rows from contacts, payments, payment_allocations, journal_entries, journal_entry_lines for this contact
                  and date range. Click a row for raw JSON.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto max-h-[560px]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="py-2 pr-2">table</th>
                      <th className="py-2 pr-2">pk</th>
                      <th className="py-2 pr-2">parent</th>
                      <th className="py-2 pr-2">ref #</th>
                      <th className="py-2 pr-2">amount</th>
                      <th className="py-2 pr-2">JE / pay</th>
                      <th className="py-2 pr-2">badges</th>
                      <th className="py-2">⋯</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lineageBundle?.records || []).map((rec) => (
                      <tr
                        key={`${rec.source_table}-${rec.source_pk}`}
                        className="border-b border-gray-800/60 cursor-pointer hover:bg-gray-800/40"
                        onClick={() => setLineDetail(rec)}
                      >
                        <td className="py-1.5 pr-2">{rec.source_table}</td>
                        <td className="py-1.5 pr-2 font-mono text-[10px]">{rec.source_pk.slice(0, 10)}…</td>
                        <td className="py-1.5 pr-2 font-mono text-[10px]">{rec.parent_pk?.slice(0, 8) || '—'}…</td>
                        <td className="py-1.5 pr-2">{rec.document_number || '—'}</td>
                        <td className="py-1.5 pr-2 tabular-nums">
                          {rec.amount_primary != null ? formatCurrency(rec.amount_primary) : rec.allocation_amount != null ? formatCurrency(rec.allocation_amount) : '—'}
                        </td>
                        <td className="py-1.5 pr-2 font-mono text-[10px]">
                          {rec.journal_entry_id?.slice(0, 8) || '—'} / {rec.payment_id?.slice(0, 8) || '—'}
                        </td>
                        <td className="py-1.5 pr-2">
                          <LineageBadges badges={rec.badges} />
                        </td>
                        <td className="py-1.5 text-blue-400">open</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            {paymentTrace?.lineage?.length ? (
              <Card className="bg-gray-900/80 border-gray-800">
                <CardHeader>
                  <CardTitle>Payment-scoped lineage (mutation trace)</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto max-h-[320px]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800 text-left">
                        <th className="py-2 pr-2">table</th>
                        <th className="py-2 pr-2">pk</th>
                        <th className="py-2 pr-2">doc</th>
                        <th className="py-2">badges</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentTrace.lineage.map((rec) => (
                        <tr key={`${rec.source_table}-${rec.source_pk}`} className="border-b border-gray-800/60 cursor-pointer" onClick={() => setLineDetail(rec)}>
                          <td className="py-1.5">{rec.source_table}</td>
                          <td className="font-mono text-[10px]">{rec.source_pk}</td>
                          <td>{rec.document_number || '—'}</td>
                          <td>
                            <LineageBadges badges={rec.badges} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="reflection" className="mt-4">
            <Card className="bg-gray-900/80 border-gray-800">
              <CardHeader>
                <CardTitle>Surface reflection matrix</CardTitle>
                <CardDescription>
                  Where the same economic event may appear. Load a <strong className="text-gray-400">payment trace</strong> to
                  fill journal/payment rows. PF-14 creates a <em>second</em> JE for account change — Roznamcha may show two rows;
                  net cash is a transfer, not duplicate receipt.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="py-2 pr-2">Surface</th>
                      <th className="py-2 pr-2">Source</th>
                      <th className="py-2 pr-2">Amount</th>
                      <th className="py-2 pr-2">Account / status</th>
                      <th className="py-2 pr-2">row ids</th>
                      <th className="py-2 pr-2">expected</th>
                      <th className="py-2">mismatch / reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reflectionRows.map((row) => (
                      <tr key={row.surface} className="border-b border-gray-800/60 align-top">
                        <td className="py-2 pr-2 text-gray-200">{row.surface}</td>
                        <td className="py-2 pr-2 text-gray-500">{row.source_used}</td>
                        <td className="py-2 pr-2">{row.amount_shown}</td>
                        <td className="py-2 pr-2">{row.account_shown}</td>
                        <td className="py-2 pr-2 font-mono text-[10px] max-w-[140px] break-all">{row.row_ids}</td>
                        <td className="py-2 pr-2">
                          <Badge variant="outline" className="border-gray-600 text-[10px]">
                            {row.expected}
                          </Badge>
                        </td>
                        <td className="py-2 text-amber-200/80">{row.mismatch_reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mutation" className="mt-4 space-y-4">
            <Card className="bg-gray-900/80 border-gray-800">
              <CardHeader>
                <CardTitle>Mutation timeline</CardTitle>
                <CardDescription>
                  Ordered events from <code className="text-gray-600">payments</code> timestamps and{' '}
                  <code className="text-gray-600">journal_entries</code>. Original payment JE is not edited; PF-14 posts
                  adjustment JEs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!paymentTrace?.timeline?.length ? (
                  <p className="text-sm text-gray-500">Run “Payment mutation trace” with a payment ref or UUID.</p>
                ) : (
                  <ol className="list-decimal list-inside space-y-3 text-sm">
                    {paymentTrace.timeline.map((ev) => (
                      <li key={ev.step} className="border border-gray-800 rounded-lg p-3 bg-black/20">
                        <div className="font-medium text-gray-200">{ev.event_type}</div>
                        <div className="text-gray-500 text-xs mt-1">{ev.at}</div>
                        <div className="text-xs mt-2 text-gray-400">{ev.notes}</div>
                        <div className="text-xs mt-1">
                          <span className="text-gray-500">row:</span> <code className="text-gray-300">{ev.row_id}</code>{' '}
                          · {ev.in_place ? 'in-place update' : 'new row'}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="phase4" className="mt-4 space-y-4">
            <Card className="bg-gray-900/80 border-gray-800">
              <CardHeader>
                <CardTitle>Generic entity trace</CardTitle>
                <CardDescription>
                  <code className="text-gray-600">transaction_mutations</code> (append-only) +{' '}
                  <code className="text-gray-600">v_unified_transaction_feed</code> read model. Requires DB migration{' '}
                  <code className="text-gray-600">20260433_phase4_transaction_mutations_unified_feed.sql</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-gray-500">entity_type</span>
                    <select
                      className="bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-sm"
                      value={phase4EntityType}
                      onChange={(e) => setPhase4EntityType(e.target.value as TransactionEntityType)}
                    >
                      {(['payment', 'sale', 'purchase', 'expense', 'journal', 'transfer'] as const).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs flex-1 min-w-[240px]">
                    <span className="text-gray-500">entity_id (uuid)</span>
                    <input
                      className="bg-gray-950 border border-gray-700 rounded px-2 py-1.5 font-mono text-[11px]"
                      value={phase4EntityId}
                      onChange={(e) => setPhase4EntityId(e.target.value)}
                      placeholder="Filled from payment trace when available"
                    />
                  </label>
                  <Button type="button" variant="secondary" disabled={phase4Loading} onClick={() => void runPhase4Load()}>
                    {phase4Loading ? 'Loading…' : 'Load mutations + feed row'}
                  </Button>
                </div>
                {effectiveVsAudit && (
                  <div className="rounded-lg border border-violet-800/50 bg-violet-950/20 p-3 text-sm text-violet-100/90">
                    <div className="font-medium text-violet-200 mb-1">Effective vs audit (from payment trace)</div>
                    <p className="text-xs text-gray-400 leading-relaxed">{effectiveVsAudit.narrative}</p>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-gray-500">
                      <div>
                        Effective amount (payments row):{' '}
                        <span className="text-gray-200">{effectiveVsAudit.effective_amount_payment_row}</span>
                      </div>
                      <div>
                        Journal vouchers:{' '}
                        <span className="text-gray-200">{effectiveVsAudit.audit_journal_voucher_count}</span>
                      </div>
                      <div>
                        Transfer JEs: <span className="text-gray-200">{effectiveVsAudit.transfer_je_count}</span>
                      </div>
                      <div>
                        Amount-delta JEs: <span className="text-gray-200">{effectiveVsAudit.amount_delta_je_count}</span>
                      </div>
                    </div>
                  </div>
                )}
                {phase4Bundle?.errors?.length ? (
                  <p className="text-amber-300 text-xs">{phase4Bundle.errors.join(' · ')}</p>
                ) : null}
                {phase4Bundle?.feedRow && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">v_unified_transaction_feed (one row)</h4>
                    <pre className="text-[10px] bg-black/40 border border-gray-800 rounded-lg p-3 overflow-x-auto text-gray-400 max-h-48">
                      {JSON.stringify(phase4Bundle.feedRow, null, 2)}
                    </pre>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">transaction_mutations</h4>
                  {!phase4Bundle?.mutations?.length ? (
                    <p className="text-xs text-gray-500">No rows (run load after new edits; legacy edits have no history until they mutate again).</p>
                  ) : (
                    <div className="overflow-x-auto max-h-64 border border-gray-800 rounded-lg">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="text-left text-gray-500 border-b border-gray-800">
                            <th className="p-2">type</th>
                            <th className="p-2">created</th>
                            <th className="p-2">adj JE</th>
                            <th className="p-2">reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phase4Bundle.mutations.map((m) => (
                            <tr key={String(m.id)} className="border-b border-gray-800/70">
                              <td className="p-2 text-gray-300">{String(m.mutation_type)}</td>
                              <td className="p-2 text-gray-500">{String(m.created_at || '').slice(0, 19)}</td>
                              <td className="p-2 font-mono text-gray-400">
                                {String(m.adjustment_journal_entry_id || '—').slice(0, 8)}…
                              </td>
                              <td className="p-2 text-gray-500 max-w-xs truncate" title={String(m.reason || '')}>
                                {String(m.reason || '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exceptions" className="mt-4">
            <Card className="bg-gray-900/80 border-gray-800">
              <CardHeader>
                <CardTitle>Exception queue</CardTitle>
                <CardDescription>v_ar_ap_unmapped_journals</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto space-y-2">
                {snap.exceptions.length === 0 ? (
                  <p className="text-sm text-gray-500">No rows.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-800">
                        <th className="py-2 pr-2">JE</th>
                        <th className="py-2 pr-2">Line</th>
                        <th className="py-2 pr-2">Dr/Cr</th>
                        <th className="py-2 pr-2">ref_type</th>
                        <th className="py-2 pr-2">line id</th>
                        <th className="py-2">Ignore</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.exceptions.map((ex) => (
                        <tr key={ex.journal_line_id} className="border-b border-gray-800/60">
                          <td className="py-1.5 pr-2">{ex.entry_no || '—'}</td>
                          <td className="py-1.5 pr-2">{ex.account_code}</td>
                          <td className="py-1.5 pr-2">
                            {formatCurrency(Number(ex.debit || 0))} / {formatCurrency(Number(ex.credit || 0))}
                          </td>
                          <td className="py-1.5 pr-2">{ex.reference_type}</td>
                          <td className="py-1.5 pr-2 font-mono text-[10px]">{ex.journal_line_id}</td>
                          <td className="py-1.5">
                            <input
                              type="checkbox"
                              checked={dismissed.has(ex.journal_line_id)}
                              onChange={(e) => {
                                toggleDismissed(ex.journal_line_id, e.target.checked);
                                setDismissTick((x) => x + 1);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inspector" className="mt-4">
            <Card className="bg-gray-900/80 border-gray-800">
              <CardHeader>
                <CardTitle>RPC / table / filter inspector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs font-mono text-gray-400">
                <p className="text-gray-300">RPCs: {debugMeta.rpcs.join(' · ')}</p>
                <p>Tables: {debugMeta.tables.join(', ')}</p>
                <pre className="bg-black/40 p-3 rounded-lg overflow-x-auto text-[11px]">{JSON.stringify(debugMeta.filters, null, 2)}</pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="mt-4">
            <Card className="bg-gray-900/80 border-gray-800">
              <CardHeader>
                <CardTitle>Test actions (dev)</CardTitle>
                <CardDescription>Copy IDs, open app surfaces, reload. No direct DB mutations here.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="border-gray-600" onClick={openContactsApp}>
                  Open Contacts app
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-gray-600"
                  disabled={!paymentTrace?.payment}
                  onClick={() => paymentTrace?.payment && void copyText('payment id', String(paymentTrace.payment.id))}
                >
                  Copy payment UUID
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-gray-600"
                  disabled={!paymentTrace?.journalEntries?.[0]}
                  onClick={() =>
                    paymentTrace?.journalEntries?.[0] && void copyText('JE id', String(paymentTrace.journalEntries[0].id))
                  }
                >
                  Copy first JE UUID
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-gray-600"
                  disabled={!contactId}
                  onClick={() => void copyText('contact id', contactId)}
                >
                  Copy contact UUID
                </Button>
                <Button type="button" variant="outline" size="sm" className="border-gray-600" onClick={() => void run()}>
                  Refresh / recompute snapshot
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-gray-600"
                  disabled={!paymentIdInput && !paymentTrace?.payment}
                  onClick={() => {
                    const id = paymentIdInput || (paymentTrace?.payment ? String(paymentTrace.payment.id) : '');
                    if (id) void copyText('SQL', sqlForPayment(id));
                  }}
                >
                  Copy SQL trace template
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Sheet open={!!lineDetail} onOpenChange={(o) => !o && setLineDetail(null)}>
        <SheetContent className="bg-gray-950 border-gray-800 text-gray-100 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-base">
              {lineDetail?.source_table} · {lineDetail?.source_pk}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 text-xs">
            <LineageBadges badges={lineDetail?.badges || []} />
            <pre className="bg-black/50 p-3 rounded-lg text-[10px] overflow-x-auto">{JSON.stringify(lineDetail?.extra ?? {}, null, 2)}</pre>
            <Button type="button" size="sm" variant="outline" onClick={() => lineDetail && void copyText('row JSON', JSON.stringify(lineDetail.extra, null, 2))}>
              Copy raw JSON
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
