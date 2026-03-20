/**
 * Internal QA: Accounting Integrity Test Lab — Phase 2 (modes, categories, traceability, extended snapshots).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlaskConical,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { supabase } from '@/lib/supabase';
import { saleService } from '@/app/services/saleService';
import { purchaseService } from '@/app/services/purchaseService';
import { accountService } from '@/app/services/accountService';
import {
  buildSaleTruthSnapshot,
  buildPurchaseTruthSnapshot,
  buildExtendedLabSnapshot,
  runAllReconciliationChecks,
  runFreshScenarioChecks,
  snapshotToComparableJson,
  INTEGRITY_LAB_SESSION_KEY,
  type LabCheckResult,
  type LabCheckCategory,
  type LabNavAction,
  type WarningClassification,
} from '@/app/services/accountingIntegrityLabService';
import { toast } from 'sonner';
import { formatPostgrestError } from '@/app/lib/formatPostgrestError';
import { Input } from '@/app/components/ui/input';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Badge } from '@/app/components/ui/badge';

type Scenario = 'sale' | 'purchase' | 'inventory' | 'reconciliation';
type LabMode = 'fresh' | 'live';

interface DocRow {
  id: string;
  label: string;
  status?: string;
}

function StatusBadge({ status }: { status: LabCheckResult['status'] }) {
  if (status === 'pass')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> PASS
      </span>
    );
  if (status === 'fail')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
        <XCircle className="h-3 w-3" /> FAIL
      </span>
    );
  if (status === 'warn')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
        <AlertTriangle className="h-3 w-3" /> WARN
      </span>
    );
  return <span className="text-xs text-muted-foreground">SKIP</span>;
}

const CATEGORY_LABEL: Record<LabCheckCategory, string> = {
  engine: 'Engine integrity',
  reconciliation: 'Reconciliation',
  data_quality: 'Data quality / legacy',
};

const CLASS_LABEL: Record<WarningClassification, string> = {
  engine_bug: 'Engine bug?',
  legacy_data: 'Legacy data',
  missing_backfill: 'Missing backfill',
  source_link: 'Source / link',
  reconciliation_timing: 'Reconciliation timing',
  informational: 'Informational',
};

function ClassificationBadge({ c }: { c?: WarningClassification }) {
  if (!c) return null;
  const colors: Record<WarningClassification, string> = {
    engine_bug: 'bg-red-500/20 text-red-300',
    legacy_data: 'bg-slate-500/25 text-slate-300',
    missing_backfill: 'bg-violet-500/20 text-violet-300',
    source_link: 'bg-cyan-500/20 text-cyan-300',
    reconciliation_timing: 'bg-amber-500/20 text-amber-200',
    informational: 'bg-blue-500/15 text-blue-300',
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-normal ${colors[c]}`}>
      {CLASS_LABEL[c]}
    </Badge>
  );
}

export function AccountingIntegrityLabPage() {
  const { companyId, branchId, setBranchId, accessibleBranchIds } = useSupabase();
  const { openDrawer, setCurrentView, setOpenSaleIdForView } = useNavigation();

  const [labMode, setLabMode] = useState<LabMode>('live');
  const [categoryFilter, setCategoryFilter] = useState<LabCheckCategory | 'all'>('all');

  const [scenario, setScenario] = useState<Scenario>('sale');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [sales, setSales] = useState<DocRow[]>([]);
  const [purchases, setPurchases] = useState<DocRow[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [paymentAccounts, setPaymentAccounts] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [payAccountId, setPayAccountId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('100');
  const [checks, setChecks] = useState<LabCheckResult[]>([]);
  const [checksLoading, setChecksLoading] = useState(false);
  const [snapshotBefore, setSnapshotBefore] = useState<string | null>(null);
  const [snapshotAfter, setSnapshotAfter] = useState<string | null>(null);
  const [lastActionError, setLastActionError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string>('');
  const [scenarioPass, setScenarioPass] = useState<boolean | null>(null);

  const effectiveBranch = branchId && branchId !== 'all' ? branchId : null;

  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase.from('branches').select('id, name').eq('company_id', companyId);
    setBranches((data || []).map((b: any) => ({ id: b.id, name: b.name || b.id })));
  }, [companyId]);

  const loadDocs = useCallback(async () => {
    if (!companyId) return;
    let sq = supabase
      .from('sales')
      .select('id, invoice_no, status')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(40);
    if (effectiveBranch) sq = sq.eq('branch_id', effectiveBranch);
    const { data: s } = await sq;
    setSales(
      (s || []).map((x: any) => ({
        id: x.id,
        label: `${x.invoice_no || x.id.slice(0, 8)} · ${x.status}`,
        status: x.status,
      }))
    );

    let pq = supabase
      .from('purchases')
      .select('id, po_no, status')
      .eq('company_id', companyId)
      .order('id', { ascending: false })
      .limit(40);
    if (effectiveBranch) pq = pq.eq('branch_id', effectiveBranch);
    const { data: p, error: pErr } = await pq;
    if (pErr) {
      console.warn('[Integrity Lab] purchases list:', pErr.message);
      setPurchases([]);
    } else {
      setPurchases(
        (p || []).map((x: any) => ({
          id: x.id,
          label: `${x.po_no || x.id.slice(0, 8)} · ${x.status}`,
          status: x.status,
        }))
      );
    }
  }, [companyId, effectiveBranch]);

  const loadAccounts = useCallback(async () => {
    if (!companyId) return;
    const list = await accountService.getPaymentAccountsOnly(companyId);
    setPaymentAccounts((list || []).map((a: any) => ({ id: a.id, name: a.name, code: a.code })));
    if (list?.[0]?.id) setPayAccountId((prev) => prev || list[0].id);
  }, [companyId]);

  useEffect(() => {
    loadBranches();
    loadDocs();
    loadAccounts();
  }, [loadBranches, loadDocs, loadAccounts]);

  const runChecks = async () => {
    if (!companyId) return;
    setChecksLoading(true);
    try {
      let results: LabCheckResult[];
      if (labMode === 'fresh') {
        results = await runFreshScenarioChecks(companyId, branchId, {
          saleId: selectedSaleId || undefined,
          purchaseId: selectedPurchaseId || undefined,
        });
      } else {
        results = await runAllReconciliationChecks(companyId, branchId);
      }
      setChecks(results);
      const hasFail = results.some((r) => r.status === 'fail');
      setScenarioPass(!hasFail);
    } catch (e: any) {
      toast.error(e?.message || 'Checks failed');
      setScenarioPass(false);
    } finally {
      setChecksLoading(false);
    }
  };

  const captureExtendedSnapshot = async (kind: 'sale' | 'purchase', id: string) => {
    if (!id || !companyId) return null;
    const ext = await buildExtendedLabSnapshot(companyId, kind, id, branchId);
    return snapshotToComparableJson(ext);
  };

  const executeNavAction = async (a: LabNavAction) => {
    if (a.type === 'copy') {
      await navigator.clipboard.writeText(a.text);
      toast.success('Copied');
      return;
    }
    if (a.type === 'sale' && a.saleId) {
      setCurrentView('sales');
      setOpenSaleIdForView?.(a.saleId);
      toast.info('Opening Sales — invoice drawer should load');
      return;
    }
    if (a.type === 'purchase' && a.purchaseId) {
      try {
        const p = await purchaseService.getPurchase(a.purchaseId);
        if (p) {
          openDrawer('edit-purchase', undefined, { purchase: p });
          toast.info('Purchase form opened');
        } else toast.error('Purchase not found');
      } catch (e: any) {
        toast.error(e?.message || 'Could not load purchase');
      }
      return;
    }
    if (a.type === 'accounting') {
      const payload: Record<string, string> = { tab: a.tab };
      if (a.focusJournalEntryId) payload.searchTerm = a.focusJournalEntryId;
      if (a.focusAccountId) payload.searchTerm = a.focusAccountId;
      if (a.ledgerType) payload.ledgerType = a.ledgerType;
      sessionStorage.setItem(INTEGRITY_LAB_SESSION_KEY, JSON.stringify(payload));
      setCurrentView('accounting');
      toast.info(`Accounting → ${a.tab}${a.focusJournalEntryId ? ' (search JE id)' : ''}`);
      return;
    }
    if (a.type === 'customer_ledger') {
      setCurrentView('customer-ledger-test');
      toast.info('Customer ledger test page');
      return;
    }
    if (a.type === 'supplier_ledger') {
      setCurrentView('purchases');
      toast.info('Open supplier from Purchases / Payables');
    }
  };

  const inferDocKind = (name: string): 'sale' | 'purchase' => {
    const n = name.toLowerCase();
    if (n.includes('purchase')) return 'purchase';
    if (n.includes('sale')) return 'sale';
    return scenario === 'purchase' ? 'purchase' : 'sale';
  };

  const wrapAction = async (name: string, fn: () => Promise<void>) => {
    if (!companyId) {
      toast.error('No company');
      return;
    }
    const kind = inferDocKind(name);
    if (kind === 'sale' && !selectedSaleId && !/open|new|refresh|run all|reconciliation/i.test(name)) {
      toast.error('Select a sale first');
      return;
    }
    if (kind === 'purchase' && !selectedPurchaseId && !/open|new|refresh|run all|reconciliation/i.test(name)) {
      toast.error('Select a purchase first');
      return;
    }

    const docId = kind === 'sale' ? selectedSaleId : selectedPurchaseId;
    setLastActionError(null);
    setSnapshotAfter(null);
    if (docId) {
      const before = await captureExtendedSnapshot(kind, docId);
      setSnapshotBefore(before);
    }
    setLastAction(name);
    try {
      await fn();
      toast.success(name);
      await loadDocs();
      if (docId) {
        const after = await captureExtendedSnapshot(kind, docId);
        setSnapshotAfter(after);
      }
      await runChecks();
    } catch (e: unknown) {
      const { summary, detailJson } = formatPostgrestError(e);
      toast.error(`${name}: ${summary}`);
      setLastActionError(detailJson);
      setSnapshotAfter(null);
      setScenarioPass(false);
    }
  };

  const firstPaymentIdForSale = async (saleId: string) => {
    const { data } = await supabase
      .from('payments')
      .select('id')
      .eq('reference_type', 'sale')
      .eq('reference_id', saleId)
      .limit(1)
      .maybeSingle();
    return data?.id as string | undefined;
  };

  const firstPaymentIdForPurchase = async (purchaseId: string) => {
    const { data } = await supabase
      .from('payments')
      .select('id')
      .eq('reference_type', 'purchase')
      .eq('reference_id', purchaseId)
      .limit(1)
      .maybeSingle();
    return data?.id as string | undefined;
  };

  const branchOptions = useMemo(() => {
    if (accessibleBranchIds?.length) {
      return branches.filter((b) => accessibleBranchIds.includes(b.id));
    }
    return branches;
  }, [branches, accessibleBranchIds]);

  const filteredChecks = useMemo(() => {
    if (categoryFilter === 'all') return checks;
    return checks.filter((c) => c.category === categoryFilter);
  }, [checks, categoryFilter]);

  /** Sale payments require a concrete branch_id (avoids 400 / bad inserts). */
  const salePaymentBlocked = !branchId || branchId === 'all';
  const selectedSaleLabel = sales.find((s) => s.id === selectedSaleId)?.label ?? '—';
  const selectedPurchaseLabel = purchases.find((p) => p.id === selectedPurchaseId)?.label ?? '—';

  if (!companyId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Sign in and select a business to use the Accounting Integrity Lab.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <FlaskConical className="h-8 w-8" />
            <h1 className="text-2xl font-bold tracking-tight">Accounting Integrity Test Lab</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Internal QA only. Canonical truth: <code className="text-xs">accounts</code>,{' '}
            <code className="text-xs">journal_entries</code>, <code className="text-xs">journal_entry_lines</code>,{' '}
            <code className="text-xs">payments</code>, <code className="text-xs">stock_movements</code>, document tables.
          </p>
          <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <strong>Golden rule:</strong> Only <strong>final / posted</strong> documents should drive accounting and stock.
            Draft edits should not post until finalized.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Mode</Label>
              <Select value={labMode} onValueChange={(v) => setLabMode(v as LabMode)}>
                <SelectTrigger className="w-[220px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fresh">
                    Fresh scenario (selected doc only)
                  </SelectItem>
                  <SelectItem value="live">Live data reconciliation (whole company)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              <strong>Fresh:</strong> JEs + payments for the active sale/purchase only.{' '}
              <strong>Live:</strong> TB/BS/AR/AP + legacy gaps — expect WARN until data is cleaned.
            </p>
          </div>
        </div>
        {scenarioPass !== null && (
          <div
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              scenarioPass ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
            }`}
          >
            Last run: {scenarioPass ? 'No FAIL rows (WARNs may still exist)' : 'FAIL — see Engine / Data quality'}
          </div>
        )}
      </div>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="setup">A · Setup</TabsTrigger>
          <TabsTrigger value="actions">B · Action runner</TabsTrigger>
          <TabsTrigger value="checks">C · Auto checks</TabsTrigger>
          <TabsTrigger value="state">D · Effective state</TabsTrigger>
          <TabsTrigger value="reports">E · Reports reconcile</TabsTrigger>
          <TabsTrigger value="snapshots">F · Snapshots</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Scenario setup</CardTitle>
              <CardDescription>
                Company comes from your session. Use branch filter to match document branch. Sandbox: clone company in
                Supabase for isolated tests (see RESULT doc).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Company ID</Label>
                <Input readOnly value={companyId} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select
                  value={branchId || 'all'}
                  onValueChange={(v) => setBranchId(v === 'all' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branchOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scenario type</Label>
                <Select value={scenario} onValueChange={(v) => setScenario(v as Scenario)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">Sale workflow</SelectItem>
                    <SelectItem value="purchase">Purchase workflow</SelectItem>
                    <SelectItem value="inventory">Inventory (movements)</SelectItem>
                    <SelectItem value="reconciliation">Reconciliation only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs font-mono">
                <span className="text-muted-foreground">Selected sale: </span>
                {selectedSaleId ? `${selectedSaleLabel} (${selectedSaleId.slice(0, 8)}…)` : '—'}
                <span className="mx-3 text-border">|</span>
                <span className="text-muted-foreground">Selected purchase: </span>
                {selectedPurchaseId ? `${selectedPurchaseLabel} (${selectedPurchaseId.slice(0, 8)}…)` : '—'}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Active sale</Label>
                <Select value={selectedSaleId || '__none__'} onValueChange={(v) => setSelectedSaleId(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sale" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="__none__">— none —</SelectItem>
                    {sales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Active purchase</Label>
                <Select
                  value={selectedPurchaseId || '__none__'}
                  onValueChange={(v) => setSelectedPurchaseId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select purchase" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="__none__">— none —</SelectItem>
                    {purchases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-3">
                <Button variant="outline" size="sm" onClick={() => openDrawer('addSale', undefined, {})}>
                  Open new sale form
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDrawer('addPurchase', undefined, {})}>
                  Open new purchase form
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDrawer('addContact', undefined, { contactType: 'customer' })}>
                  New customer
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDrawer('addContact', undefined, { contactType: 'supplier' })}>
                  New supplier
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDrawer('addProduct', undefined, {})}>
                  New product
                </Button>
                <Button variant="secondary" size="sm" onClick={() => loadDocs()}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Refresh lists
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Action runner</CardTitle>
              <CardDescription>
                Buttons stay disabled until the required document is selected. Sale payments need a <strong>specific branch</strong> (not &quot;All branches&quot;) to avoid invalid API calls.
                {salePaymentBlocked && (
                  <span className="block mt-1 text-amber-400">
                    → Select a branch above to enable &quot;Add sale payment&quot;.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">G · Ready-made regression (one click each)</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Same actions as below; use after selecting the document. Cancels are destructive — use a QA sale/purchase.
                </p>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { label: 'Sale: finalize', dis: !selectedSaleId, run: () => wrapAction('Finalize sale (draft→final)', async () => saleService.updateSaleStatus(selectedSaleId, 'final')) },
                      { label: 'Sale: add payment', dis: !selectedSaleId || salePaymentBlocked || !payAccountId, run: () => wrapAction('Add sale payment', async () => saleService.recordPayment(selectedSaleId, Number(paymentAmount) || 0, 'Cash', payAccountId, companyId!, branchId!, undefined, undefined)) },
                      { label: 'Sale: +discount', dis: !selectedSaleId, run: () => wrapAction('Edit sale discount +10', async () => {
                        const { data } = await supabase.from('sales').select('discount_amount').eq('id', selectedSaleId).single();
                        await saleService.updateSale(selectedSaleId, { discount_amount: (Number((data as any)?.discount_amount) || 0) + 10 } as any);
                      }) },
                      { label: 'Sale: +shipping', dis: !selectedSaleId, run: () => wrapAction('Edit sale shipping +25', async () => {
                        const { data } = await supabase.from('sales').select('shipment_charges').eq('id', selectedSaleId).single();
                        await saleService.updateSale(selectedSaleId, { shipment_charges: (Number((data as any)?.shipment_charges) || 0) + 25 } as any);
                      }) },
                      { label: 'Sale: +extra exp', dis: !selectedSaleId, run: () => wrapAction('Edit sale extra expense +15', async () => {
                        const { data } = await supabase.from('sales').select('expenses').eq('id', selectedSaleId).single();
                        await saleService.updateSale(selectedSaleId, { expenses: (Number((data as any)?.expenses) || 0) + 15 } as any);
                      }) },
                      { label: 'Sale: line qty+1', dis: !selectedSaleId, run: () => wrapAction('Bump first line qty +1', async () => {
                        let { data: row } = await supabase.from('sales_items').select('id, quantity').eq('sale_id', selectedSaleId).limit(1).maybeSingle();
                        if (!row) {
                          const r2 = await supabase.from('sale_items').select('id, quantity').eq('sale_id', selectedSaleId).limit(1).maybeSingle();
                          row = r2.data as any;
                          if (row) await supabase.from('sale_items').update({ quantity: (Number(row.quantity) || 0) + 1 }).eq('id', row.id);
                        } else await supabase.from('sales_items').update({ quantity: (Number(row.quantity) || 0) + 1 }).eq('id', row.id);
                        if (!row) throw new Error('No line items');
                      }) },
                      { label: 'Sale: pay amount', dis: !selectedSaleId, run: () => wrapAction('Edit sale payment amount', async () => {
                        const pid = await firstPaymentIdForSale(selectedSaleId);
                        if (!pid) throw new Error('No payment on sale');
                        await saleService.updatePayment(pid, selectedSaleId, { amount: Number(paymentAmount) || 1 });
                      }) },
                      { label: 'Sale: pay account', dis: !selectedSaleId || !payAccountId, run: () => wrapAction('Edit sale payment account', async () => {
                        const pid = await firstPaymentIdForSale(selectedSaleId);
                        if (!pid) throw new Error('Payment + account required');
                        await saleService.updatePayment(pid, selectedSaleId, { accountId: payAccountId });
                      }) },
                      { label: 'Sale: cancel', dis: !selectedSaleId, run: () => wrapAction('Cancel sale', async () => saleService.cancelSale(selectedSaleId)) },
                    ] as const
                  ).map((x) => (
                    <Button key={x.label} size="sm" variant="outline" className="h-7 text-[10px]" disabled={x.dis} onClick={() => x.run()}>
                      {x.label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {[
                    ['Pur: finalize', () => wrapAction('Finalize purchase', async () => purchaseService.updatePurchaseStatus(selectedPurchaseId, 'final'))],
                    ['Pur: add pay', () => wrapAction('Add purchase payment', async () => purchaseService.recordPayment(selectedPurchaseId, Number(paymentAmount) || 0, 'Cash', payAccountId, companyId!, branchId || undefined))],
                    ['Pur: +discount', () => wrapAction('Edit purchase discount +10', async () => {
                      const { data } = await supabase.from('purchases').select('discount_amount').eq('id', selectedPurchaseId).single();
                      await purchaseService.updatePurchase(selectedPurchaseId, { discount_amount: (Number((data as any)?.discount_amount) || 0) + 10 } as any);
                    })],
                    ['Pur: +freight', () => wrapAction('Edit purchase freight/shipping +20', async () => {
                      const { data } = await supabase.from('purchases').select('shipping_cost').eq('id', selectedPurchaseId).single();
                      await purchaseService.updatePurchase(selectedPurchaseId, { shipping_cost: (Number((data as any)?.shipping_cost) || 0) + 20 } as any);
                    })],
                    ['Pur: line qty', () => wrapAction('Bump first purchase line qty +1', async () => {
                      const { data: row } = await supabase.from('purchase_items').select('id, quantity').eq('purchase_id', selectedPurchaseId).limit(1).maybeSingle();
                      if (!row) throw new Error('No purchase_items');
                      await supabase.from('purchase_items').update({ quantity: (Number((row as any).quantity) || 0) + 1 }).eq('id', (row as any).id);
                    })],
                    ['Pur: pay amt', () => wrapAction('Edit purchase payment amount', async () => {
                      const pid = await firstPaymentIdForPurchase(selectedPurchaseId);
                      if (!pid) throw new Error('No payment');
                      await purchaseService.updatePayment(pid, selectedPurchaseId, { amount: Number(paymentAmount) || 1 });
                    })],
                    ['Pur: pay acct', () => wrapAction('Edit purchase payment account', async () => {
                      const pid = await firstPaymentIdForPurchase(selectedPurchaseId);
                      if (!pid || !payAccountId) throw new Error('Payment + account required');
                      await purchaseService.updatePayment(pid, selectedPurchaseId, { accountId: payAccountId });
                    })],
                    ['Pur: cancel', () => wrapAction('Cancel purchase', async () => purchaseService.cancelPurchase(selectedPurchaseId))],
                  ].map(([label, fn]) => (
                    <Button key={String(label)} size="sm" variant="outline" className="h-7 text-[10px]" disabled={!selectedPurchaseId} onClick={() => (fn as () => void)()}>
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Payment amount (tests)</Label>
                  <Input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} type="number" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Payment account</Label>
                  <Select value={payAccountId || '__'} onValueChange={(v) => setPayAccountId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <ChevronRight className="h-4 w-4" /> Sale actions
                </h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!selectedSaleId}
                    onClick={() =>
                      wrapAction('Finalize sale (draft→final)', async () => {
                        if (!selectedSaleId) throw new Error('Select sale');
                        await saleService.updateSaleStatus(selectedSaleId, 'final');
                      })
                    }
                  >
                    Finalize sale
                  </Button>
                  <Button
                    size="sm"
                    disabled={!selectedSaleId || salePaymentBlocked || !payAccountId}
                    title={salePaymentBlocked ? 'Choose a specific branch (not All)' : undefined}
                    onClick={() =>
                      wrapAction('Add sale payment', async () => {
                        if (!selectedSaleId || !payAccountId || !branchId || branchId === 'all') {
                          throw new Error('Select sale, payment account, and a specific branch (not “All branches”).');
                        }
                        const amt = Number(paymentAmount) || 0;
                        await saleService.recordPayment(
                          selectedSaleId,
                          amt,
                          'Cash',
                          payAccountId,
                          companyId!,
                          branchId!,
                          undefined,
                          undefined
                        );
                      })
                    }
                  >
                    Add sale payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedSaleId}
                    onClick={() =>
                      wrapAction('Edit sale discount +10', async () => {
                        if (!selectedSaleId) throw new Error('Select sale');
                        const { data } = await supabase
                          .from('sales')
                          .select('discount_amount')
                          .eq('id', selectedSaleId)
                          .single();
                        const cur = Number((data as any)?.discount_amount) || 0;
                        await saleService.updateSale(selectedSaleId, { discount_amount: cur + 10 } as any);
                      })
                    }
                  >
                    +Discount 10
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedSaleId}
                    onClick={() =>
                      wrapAction('Edit sale shipping +25', async () => {
                        if (!selectedSaleId) throw new Error('Select sale');
                        const { data } = await supabase
                          .from('sales')
                          .select('shipment_charges')
                          .eq('id', selectedSaleId)
                          .single();
                        const cur = Number((data as any)?.shipment_charges) || 0;
                        await saleService.updateSale(selectedSaleId, { shipment_charges: cur + 25 } as any);
                      })
                    }
                  >
                    +Shipping 25
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedSaleId}
                    onClick={() =>
                      wrapAction('Edit sale extra expense +15', async () => {
                        if (!selectedSaleId) throw new Error('Select sale');
                        const { data } = await supabase.from('sales').select('expenses').eq('id', selectedSaleId).single();
                        const cur = Number((data as any)?.expenses) || 0;
                        await saleService.updateSale(selectedSaleId, { expenses: cur + 15 } as any);
                      })
                    }
                  >
                    +Extra expense 15
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedSaleId}
                    onClick={() =>
                      wrapAction('Bump first line qty +1', async () => {
                        if (!selectedSaleId) throw new Error('Select sale');
                        let { data: row } = await supabase
                          .from('sales_items')
                          .select('id, quantity')
                          .eq('sale_id', selectedSaleId)
                          .limit(1)
                          .maybeSingle();
                        if (!row) {
                          const r2 = await supabase
                            .from('sale_items')
                            .select('id, quantity')
                            .eq('sale_id', selectedSaleId)
                            .limit(1)
                            .maybeSingle();
                          row = r2.data as any;
                          if (row) {
                            await supabase
                              .from('sale_items')
                              .update({ quantity: (Number(row.quantity) || 0) + 1 })
                              .eq('id', row.id);
                          }
                        } else {
                          await supabase
                            .from('sales_items')
                            .update({ quantity: (Number(row.quantity) || 0) + 1 })
                            .eq('id', row.id);
                        }
                        if (!row) throw new Error('No line items');
                      })
                    }
                  >
                    Line qty +1
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedSaleId}
                    onClick={() =>
                      wrapAction('Edit sale payment amount', async () => {
                        const pid = await firstPaymentIdForSale(selectedSaleId);
                        if (!pid) throw new Error('No payment on sale');
                        await saleService.updatePayment(pid, selectedSaleId, {
                          amount: Number(paymentAmount) || 1,
                        });
                      })
                    }
                  >
                    Set payment amount
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedSaleId || !payAccountId}
                    onClick={() =>
                      wrapAction('Edit sale payment account', async () => {
                        const pid = await firstPaymentIdForSale(selectedSaleId);
                        if (!pid || !payAccountId) throw new Error('Payment + account required');
                        await saleService.updatePayment(pid, selectedSaleId, { accountId: payAccountId });
                      })
                    }
                  >
                    Set payment account
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!selectedSaleId}
                    onClick={() =>
                      wrapAction('Cancel sale', async () => {
                        await saleService.cancelSale(selectedSaleId);
                      })
                    }
                  >
                    Cancel sale
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <ChevronRight className="h-4 w-4" /> Purchase actions
                </h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!selectedPurchaseId}
                    onClick={() =>
                      wrapAction('Finalize purchase', async () => {
                        if (!selectedPurchaseId) throw new Error('Select purchase');
                        await purchaseService.updatePurchaseStatus(selectedPurchaseId, 'final');
                      })
                    }
                  >
                    Finalize purchase
                  </Button>
                  <Button
                    size="sm"
                    disabled={!selectedPurchaseId || !payAccountId}
                    onClick={() =>
                      wrapAction('Add purchase payment', async () => {
                        if (!selectedPurchaseId || !payAccountId) throw new Error('Purchase + account');
                        await purchaseService.recordPayment(
                          selectedPurchaseId,
                          Number(paymentAmount) || 0,
                          'Cash',
                          payAccountId,
                          companyId!,
                          branchId || undefined
                        );
                      })
                    }
                  >
                    Add purchase payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedPurchaseId}
                    onClick={() =>
                      wrapAction('Edit purchase discount +10', async () => {
                        if (!selectedPurchaseId) throw new Error('Select purchase');
                        const { data } = await supabase
                          .from('purchases')
                          .select('discount_amount')
                          .eq('id', selectedPurchaseId)
                          .single();
                        const cur = Number((data as any)?.discount_amount) || 0;
                        await purchaseService.updatePurchase(selectedPurchaseId, { discount_amount: cur + 10 } as any);
                      })
                    }
                  >
                    +Discount 10
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedPurchaseId}
                    onClick={() =>
                      wrapAction('Edit purchase freight/shipping +20', async () => {
                        if (!selectedPurchaseId) throw new Error('Select purchase');
                        const { data } = await supabase
                          .from('purchases')
                          .select('shipping_cost')
                          .eq('id', selectedPurchaseId)
                          .single();
                        const cur = Number((data as any)?.shipping_cost) || 0;
                        await purchaseService.updatePurchase(selectedPurchaseId, { shipping_cost: cur + 20 } as any);
                      })
                    }
                  >
                    +Freight 20
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedPurchaseId}
                    onClick={() =>
                      wrapAction('Bump first purchase line qty +1', async () => {
                        if (!selectedPurchaseId) throw new Error('Select purchase');
                        const { data: row } = await supabase
                          .from('purchase_items')
                          .select('id, quantity')
                          .eq('purchase_id', selectedPurchaseId)
                          .limit(1)
                          .maybeSingle();
                        if (!row) throw new Error('No purchase_items');
                        await supabase
                          .from('purchase_items')
                          .update({ quantity: (Number((row as any).quantity) || 0) + 1 })
                          .eq('id', (row as any).id);
                      })
                    }
                  >
                    Line qty +1
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedPurchaseId}
                    onClick={() =>
                      wrapAction('Edit purchase payment amount', async () => {
                        const pid = await firstPaymentIdForPurchase(selectedPurchaseId);
                        if (!pid) throw new Error('No payment');
                        await purchaseService.updatePayment(pid, selectedPurchaseId, {
                          amount: Number(paymentAmount) || 1,
                        });
                      })
                    }
                  >
                    Set purchase payment amount
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedPurchaseId || !payAccountId}
                    onClick={() =>
                      wrapAction('Edit purchase payment account', async () => {
                        const pid = await firstPaymentIdForPurchase(selectedPurchaseId);
                        if (!pid || !payAccountId) throw new Error('Payment + account');
                        await purchaseService.updatePayment(pid, selectedPurchaseId, { accountId: payAccountId });
                      })
                    }
                  >
                    Set purchase payment account
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!selectedPurchaseId}
                    onClick={() =>
                      wrapAction('Cancel purchase', async () => {
                        await purchaseService.cancelPurchase(selectedPurchaseId);
                      })
                    }
                  >
                    Cancel purchase
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checks" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Auto accounting checks</CardTitle>
                <CardDescription>
                  Mode: <strong>{labMode === 'fresh' ? 'Fresh (document-scoped)' : 'Live (company-wide)'}</strong>. Trace any row via actions below.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}>
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="engine">{CATEGORY_LABEL.engine}</SelectItem>
                    <SelectItem value="reconciliation">{CATEGORY_LABEL.reconciliation}</SelectItem>
                    <SelectItem value="data_quality">{CATEGORY_LABEL.data_quality}</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={runChecks} disabled={checksLoading} size="sm">
                  {checksLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                  Run now
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredChecks.length === 0 && (
                <p className="text-sm text-muted-foreground">No checks in this filter — choose “All categories” or run checks.</p>
              )}
              {filteredChecks.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg border p-3 space-y-2 ${
                    c.status === 'fail' ? 'border-red-500/40 bg-red-500/5' : 'border-border/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{c.label}</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {CATEGORY_LABEL[c.category]}
                      </Badge>
                      {c.defaultClassification && c.status !== 'pass' && (
                        <ClassificationBadge c={c.defaultClassification} />
                      )}
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.failures.length > 0 && (
                    <ScrollArea className="max-h-[320px] w-full rounded border border-border/40 p-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="p-1">Triage</th>
                            <th className="p-1">Module</th>
                            <th className="p-1">Record</th>
                            <th className="p-1">Expected / Actual</th>
                            <th className="p-1">Trace</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.failures.map((f, i) => (
                            <tr key={i} className="border-t border-border/30 align-top">
                              <td className="p-1">
                                <ClassificationBadge c={f.classification} />
                              </td>
                              <td className="p-1">
                                {f.module}
                                <div className="text-[10px] text-muted-foreground">{f.step}</div>
                              </td>
                              <td className="p-1 font-mono break-all max-w-[180px]">{f.record}</td>
                              <td className="p-1">
                                <div className="text-emerald-200/90">{f.expected}</div>
                                <div className="text-amber-200">{f.actual}</div>
                              </td>
                              <td className="p-1">
                                <div className="flex flex-col gap-1">
                                  {(f.navActions || []).map((a, j) => (
                                    <Button
                                      key={j}
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 justify-start px-2 text-[10px] text-primary"
                                      onClick={() => executeNavAction(a)}
                                    >
                                      {a.type === 'copy' ? <Copy className="h-3 w-3 mr-1 shrink-0" /> : <ExternalLink className="h-3 w-3 mr-1 shrink-0" />}
                                      {(a as any).label || a.type}
                                    </Button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="state" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Effective state vs accounting</CardTitle>
              <CardDescription>Side-by-side JSON from canonical queries (document, payments, journals, stock sample).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <TruthPanel title="Sale" id={selectedSaleId} kind="sale" />
              <TruthPanel title="Purchase" id={selectedPurchaseId} kind="purchase" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Reports reconciliation (one-click)</CardTitle>
              <CardDescription>Same engine as tab C — trial balance, BS, P&amp;L, AR/AP hints, accounts column vs journal.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={runChecks} disabled={checksLoading} className="mb-4">
                <ClipboardList className="h-4 w-4 mr-2" />
                Run full reconciliation suite
              </Button>
              <p className="text-xs text-muted-foreground">
                Trial Balance difference · Balance Sheet difference · P&amp;L consistency · Receivables vs AR · Payables vs
                AP · Inventory heuristic · Accounts.balance vs journal
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="snapshots" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Snapshot compare</CardTitle>
              <CardDescription className="space-y-1">
                <p>
                  Last action: <strong>{lastAction || '—'}</strong>
                </p>
                <p className="text-xs">
                  <strong>Before</strong> is always fetched from the server immediately before the action.{' '}
                  <strong>After</strong> is fetched only after the action completes without error (no optimistic
                  &quot;after&quot; on failed PATCH/cancel).
                </p>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lastActionError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs">
                  <p className="font-semibold text-destructive mb-1">Last action failed (PostgREST / API)</p>
                  <pre className="max-h-40 overflow-auto font-mono whitespace-pre-wrap text-[10px]">
                    {lastActionError}
                  </pre>
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Before (server, pre-action)</Label>
                  <pre className="mt-1 max-h-96 overflow-auto rounded border border-border/50 bg-muted/30 p-2 text-[10px] font-mono">
                    {snapshotBefore || '—'}
                  </pre>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">After (server, post-success only)</Label>
                  <pre className="mt-1 max-h-96 overflow-auto rounded border border-border/50 bg-muted/30 p-2 text-[10px] font-mono">
                    {snapshotAfter ?? (lastActionError ? '— (action failed — no after snapshot)' : '—')}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AccountingIntegrityLabPage;

function TruthPanel({ title, id, kind }: { title: string; id: string; kind: 'sale' | 'purchase' }) {
  const [json, setJson] = useState<string>('—');
  useEffect(() => {
    if (!id) {
      setJson('—');
      return;
    }
    (async () => {
      const s =
        kind === 'sale' ? await buildSaleTruthSnapshot(id) : await buildPurchaseTruthSnapshot(id);
      setJson(snapshotToComparableJson(s));
    })();
  }, [id, kind]);
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <pre className="max-h-[420px] overflow-auto rounded border border-border/50 bg-muted/20 p-2 text-[10px] font-mono whitespace-pre-wrap">
        {json}
      </pre>
    </div>
  );
}
