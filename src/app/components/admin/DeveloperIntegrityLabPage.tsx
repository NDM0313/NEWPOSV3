/**
 * Developer Integrity Lab — forensic GL diagnostics (super admin / auditor / developer).
 * @see docs/accounting/ACCOUNTING_TEST_BENCH.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { canAccessDeveloperIntegrityLab } from '@/app/lib/developerAccountingAccess';
import { supabase } from '@/lib/supabase';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/app/components/ui/sheet';
import {
  runTraceSearch,
  loadJournalWithLines,
  fetchJournalExplorer,
  runIntegrityJournalScan,
  fetchAccountHealth,
  rollupDiagnosticsHits,
  listIntegrityIssues,
  insertIntegrityIssue,
  updateIntegrityIssueStatus,
  INTEGRITY_RULE_REGISTRY,
  getRuleDefinition,
  type TraceSearchResult,
  type JournalTraceRow,
  type JournalAnomalyRow,
  type JournalExplorerRow,
  type IntegrityScanSummary,
  type DiagnosticsSeverity,
  type IntegrityLabIssueRow,
  resolveJournalUiRefsByJournalIds,
} from '@/app/services/integrityLabService';
import { AccountingRefDisplayCell } from '@/app/components/accounting/AccountingRefDisplayCell';
import type { AccountingUiRef } from '@/app/lib/accountingDisplayReference';
import { toast } from 'sonner';
import { PartyTieOutRepairPanel } from '@/app/components/admin/PartyTieOutRepairPanel';
import { runFullAccountingAudit, type FullAccountingAuditResult } from '@/app/services/fullAccountingAuditService';
import { defaultAccountsService } from '@/app/services/defaultAccountsService';
import {
  previewAllJournalPostingDuplicates,
  runFullPostingRepair,
} from '@/app/services/postingDuplicateRepairService';

const CONTROL_ACCOUNT_CODES = ['1100', '1180', '1195', '2000', '2010', '5000', '1000', '1010', '1020'];

type TraceMode = Parameters<typeof runTraceSearch>[2];

function SevBadge({ s }: { s: DiagnosticsSeverity }) {
  if (s === 'error')
    return (
      <Badge className="bg-red-700 text-white border-0 text-[10px] uppercase tracking-wide">Error</Badge>
    );
  if (s === 'warning')
    return (
      <Badge className="bg-amber-700 text-white border-0 text-[10px] uppercase tracking-wide">Warning</Badge>
    );
  if (s === 'info')
    return (
      <Badge className="bg-slate-600 text-white border-0 text-[10px] uppercase tracking-wide">Info</Badge>
    );
  return (
    <Badge className="bg-emerald-800 text-white border-0 text-[10px] uppercase tracking-wide">Clean</Badge>
  );
}

function moduleGuess(refType: string | null): string {
  const t = (refType || '').toLowerCase();
  if (t === 'sale') return 'Sales';
  if (t === 'purchase') return 'Purchases';
  if (t.includes('worker') || t === 'studio_production_stage') return 'Studio / Worker';
  if (t.includes('expense')) return 'Expenses';
  return 'GL';
}

export default function DeveloperIntegrityLabPage() {
  const { companyId, userRole, user } = useSupabase();
  const { setCurrentView } = useNavigation();
  const allowed = canAccessDeveloperIntegrityLab(userRole);

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterRefType, setFilterRefType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterDisplayRef, setFilterDisplayRef] = useState('');
  const [activeTab, setActiveTab] = useState('trace');

  const [scanLoading, setScanLoading] = useState(false);
  const [scanRows, setScanRows] = useState<JournalAnomalyRow[]>([]);
  const [summary, setSummary] = useState<IntegrityScanSummary | null>(null);
  /** Aligns rule tab + export with the same rollup counts as the scan service */
  const [scanMeta, setScanMeta] = useState<{ ruleCounts: Record<string, number>; scannedAt: string } | null>(null);

  const [traceMode, setTraceMode] = useState<TraceMode>('auto');
  const [traceQ, setTraceQ] = useState('');
  const [traceLoading, setTraceLoading] = useState(false);
  const [trace, setTrace] = useState<TraceSearchResult | null>(null);
  const [selectedJe, setSelectedJe] = useState<JournalTraceRow | null>(null);

  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerRows, setExplorerRows] = useState<JournalExplorerRow[]>([]);
  const [explorerVoid, setExplorerVoid] = useState<'all' | 'yes' | 'no'>('no');
  const [explorerSuspicious, setExplorerSuspicious] = useState(false);
  const [drawerJe, setDrawerJe] = useState<JournalTraceRow | null>(null);
  const [drawerRules, setDrawerRules] = useState<string[]>([]);
  const [drawerSeverityReason, setDrawerSeverityReason] = useState<string>('');
  const [drawerHits, setDrawerHits] = useState<JournalAnomalyRow['hits']>([]);

  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchAccountHealth>>>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  const [fixIssues, setFixIssues] = useState<IntegrityLabIssueRow[]>([]);
  const [fixLoading, setFixLoading] = useState(false);
  const [hideResolved, setHideResolved] = useState(true);
  const [hideReviewed, setHideReviewed] = useState(false);
  const [fixUiByIssueId, setFixUiByIssueId] = useState<Map<string, AccountingUiRef>>(new Map());

  const [coaAuditLoading, setCoaAuditLoading] = useState(false);
  const [coaAuditResult, setCoaAuditResult] = useState<FullAccountingAuditResult | null>(null);
  const [coaSeedLoading, setCoaSeedLoading] = useState(false);

  const [glAuditLoading, setGlAuditLoading] = useState(false);
  const [glAuditData, setGlAuditData] = useState<{ code: string; name: string; gl_balance: number; stored_balance: number; mismatch: number }[] | null>(null);
  const [glSyncLoading, setGlSyncLoading] = useState(false);

  const [contactReconLoading, setContactReconLoading] = useState(false);
  const [contactReconData, setContactReconData] = useState<{ name: string; code: string; type: string; opening: number; sales_due: number; operational: number; gl_balance: number; diff: number; sub_account: string }[] | null>(null);

  const [invDetailLoading, setInvDetailLoading] = useState(false);
  const [invDetailData, setInvDetailData] = useState<{ product: string; sku: string; variation: string; var_sku: string; qty: number; cost: number; sale_price: number; stock_value: number; margin: number }[] | null>(null);

  const [obSyncLoading, setObSyncLoading] = useState(false);
  const [obSyncResult, setObSyncResult] = useState<{ totalContacts: number; synced: number; subledgersCreated?: number; inventoryMovementsSynced?: number; inventoryJEsPosted?: number; inventoryJEsKept?: number; inventoryZeroCostSkipped?: number; inventoryTotalValue?: number; errors: string[] } | null>(null);

  const [dataRepairLoading, setDataRepairLoading] = useState(false);
  const [dataRepairResult, setDataRepairResult] = useState<string[] | null>(null);

  const [postingPreviewLoading, setPostingPreviewLoading] = useState(false);
  const [postingRepairLoading, setPostingRepairLoading] = useState(false);
  const [postingRepairJson, setPostingRepairJson] = useState<string | null>(null);

  const effBranch = filterBranch !== 'all' ? filterBranch : null;

  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase.from('branches').select('id, name').eq('company_id', companyId);
    setBranches((data || []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name || b.id })));
  }, [companyId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const runScan = useCallback(async () => {
    if (!companyId) return;
    setScanLoading(true);
    try {
      const pack = await runIntegrityJournalScan(companyId, {
        branchId: effBranch,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 120,
      });
      setScanRows(pack.rows);
      setSummary(pack.summary);
      setScanMeta({ ruleCounts: pack.ruleCounts, scannedAt: pack.scannedAt });
      const h = await fetchAccountHealth(companyId, CONTROL_ACCOUNT_CODES, {
        scanRows: pack.rows,
        branchId: effBranch,
        asOfDate: dateTo || undefined,
      });
      setHealth(h);
      toast.success(`Scan complete — ${pack.rows.length} journals`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanLoading(false);
    }
  }, [companyId, effBranch, dateFrom, dateTo]);

  const loadHealth = useCallback(async () => {
    if (!companyId) return;
    setHealthLoading(true);
    try {
      const h = await fetchAccountHealth(companyId, CONTROL_ACCOUNT_CODES, {
        scanRows: scanRows.length ? scanRows : undefined,
        branchId: effBranch,
        asOfDate: dateTo || undefined,
      });
      setHealth(h);
    } finally {
      setHealthLoading(false);
    }
  }, [companyId, scanRows, effBranch, dateTo]);

  const loadFixQueue = useCallback(async () => {
    if (!companyId) return;
    setFixLoading(true);
    try {
      const rows = await listIntegrityIssues(companyId, { hideResolved, hideReviewed });
      setFixIssues(rows);
    } catch {
      setFixIssues([]);
    } finally {
      setFixLoading(false);
    }
  }, [companyId, hideResolved, hideReviewed]);

  const runCoaAudit = useCallback(async () => {
    if (!companyId) return;
    setCoaAuditLoading(true);
    try {
      const r = await runFullAccountingAudit(companyId);
      setCoaAuditResult(r);
      toast.success(`COA audit — ${r.scannedAccounts} accounts, ${r.issueCount} issue(s)`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'COA audit failed');
      setCoaAuditResult(null);
    } finally {
      setCoaAuditLoading(false);
    }
  }, [companyId]);

  const repairCoaStructure = useCallback(async () => {
    if (!companyId) return;
    setCoaSeedLoading(true);
    try {
      await defaultAccountsService.ensureDefaultAccounts(companyId);
      toast.success('Default COA structure ensured (idempotent seed + parent repair)');
      await runCoaAudit();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'COA repair failed');
    } finally {
      setCoaSeedLoading(false);
    }
  }, [companyId, runCoaAudit]);

  const previewPostingDuplicates = useCallback(async () => {
    if (!companyId) return;
    setPostingPreviewLoading(true);
    try {
      const pack = await previewAllJournalPostingDuplicates(companyId);
      setPostingRepairJson(JSON.stringify(pack, null, 2));
      const n =
        pack.primary.duplicateCount + pack.entryNo.duplicateCount + pack.fingerprint.duplicateCount;
      toast.success(
        n > 0
          ? `Duplicates — primary: ${pack.primary.duplicateCount}, same entry_no: ${pack.entryNo.duplicateCount}, same fingerprint: ${pack.fingerprint.duplicateCount}`
          : 'No duplicate primary / entry_no / fingerprint journals'
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPostingPreviewLoading(false);
    }
  }, [companyId]);

  const runPostingDuplicateRepair = useCallback(async () => {
    if (!companyId) return;
    setPostingRepairLoading(true);
    try {
      const r = await runFullPostingRepair(companyId, {
        voidDuplicates: true,
        voidDuplicateEntryNos: true,
        voidDuplicateFingerprints: true,
        dryRun: false,
      });
      setPostingRepairJson(JSON.stringify(r, null, 2));
      if (r.errors.length) toast.error(r.errors.join('; '));
      else {
        const { voidedByCategory: c } = r;
        toast.success(
          `Voided ${r.voidedJournalEntryIds.length} JE(s) — primary:${c.duplicatePrimary.length} entry_no:${c.duplicateEntryNo.length} fp:${c.duplicateFingerprint.length}; sync +${r.sync.synced} (skipped dup=${r.sync.skippedDuplicates})`
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Repair failed');
    } finally {
      setPostingRepairLoading(false);
    }
  }, [companyId]);

  const loadExplorer = useCallback(async () => {
    if (!companyId) return;
    setExplorerLoading(true);
    try {
      const rows = await fetchJournalExplorer(companyId, {
        branchId: effBranch,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        referenceType: filterRefType || undefined,
        isVoid: explorerVoid,
        suspiciousOnly: explorerSuspicious,
        limit: 100,
      });
      setExplorerRows(rows);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Explorer failed');
    } finally {
      setExplorerLoading(false);
    }
  }, [companyId, effBranch, dateFrom, dateTo, filterRefType, explorerVoid, explorerSuspicious]);

  useEffect(() => {
    if (companyId && allowed) {
      runScan();
      loadFixQueue();
    }
  }, [companyId, allowed]); // eslint-disable-line react-hooks/exhaustive-deps -- initial load only

  const ruleCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (scanMeta?.ruleCounts) {
      for (const [k, v] of Object.entries(scanMeta.ruleCounts)) m.set(k, v);
      return m;
    }
    for (const row of scanRows) {
      for (const id of row.ruleIds) {
        m.set(id, (m.get(id) || 0) + 1);
      }
    }
    return m;
  }, [scanRows, scanMeta]);

  const filteredAnomalies = useMemo(() => {
    const fd = filterDisplayRef.trim().toLowerCase();
    return scanRows.filter((r) => {
      if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
      if (filterRefType && (r.referenceType || '') !== filterRefType) return false;
      if (filterModule !== 'all' && moduleGuess(r.referenceType) !== filterModule) return false;
      if (fd) {
        const hay = `${r.uiRef?.displayRef || ''} ${r.uiRef?.technicalRef || ''} ${r.entryNo || ''}`.toLowerCase();
        if (!hay.includes(fd)) return false;
      }
      return true;
    });
  }, [scanRows, filterSeverity, filterRefType, filterModule, filterDisplayRef]);

  useEffect(() => {
    if (!companyId || fixIssues.length === 0) {
      setFixUiByIssueId(new Map());
      return;
    }
    const jeIds = [...new Set(fixIssues.map((i) => i.journal_entry_id).filter(Boolean) as string[])];
    if (!jeIds.length) {
      setFixUiByIssueId(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const m = await resolveJournalUiRefsByJournalIds(
        companyId,
        jeIds.map((jid) => ({ key: jid, journalEntryId: jid }))
      );
      if (cancelled) return;
      const next = new Map<string, AccountingUiRef>();
      for (const iss of fixIssues) {
        if (iss.journal_entry_id) {
          const ui = m.get(iss.journal_entry_id);
          if (ui) next.set(iss.id, ui);
        }
      }
      setFixUiByIssueId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, fixIssues]);

  const runTrace = useCallback(async () => {
    if (!companyId) {
      toast.error('No company');
      return;
    }
    setTraceLoading(true);
    try {
      const r = await runTraceSearch(companyId, traceQ, traceMode);
      setTrace(r);
      setSelectedJe(r.journals[0] || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Trace failed');
    } finally {
      setTraceLoading(false);
    }
  }, [companyId, traceQ, traceMode]);

  const exportFindings = useCallback(() => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            scannedAt: scanMeta?.scannedAt ?? null,
            companyId,
            summary,
            ruleCounts: scanMeta?.ruleCounts ?? {},
            /** Full last scan dataset — same rows that produced summary + ruleCounts */
            scanRows,
            gridFiltersOnly: {
              severity: filterSeverity,
              referenceType: filterRefType,
              module: filterModule,
              displayRefContains: filterDisplayRef,
            },
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `integrity-lab-${companyId?.slice(0, 8) || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [companyId, summary, scanRows, scanMeta, filterSeverity, filterRefType, filterModule, filterDisplayRef]);

  const pushErrorsToQueue = useCallback(async () => {
    if (!companyId) return;
    let n = 0;
    for (const row of scanRows) {
      if (!row.actionableForQueue) continue;
      const rolled = rollupDiagnosticsHits(row.hits);
      const primary = rolled.find((h) => h.severity === 'error') || rolled.find((h) => h.severity === 'warning');
      const firstRule = primary?.ruleId || row.ruleIds[0] || 'RULE_UNKNOWN';
      const sev = row.severity === 'error' ? 'error' : 'warning';
      const ins = await insertIntegrityIssue({
        company_id: companyId,
        branch_id: null,
        severity: sev,
        module: moduleGuess(row.referenceType),
        source_type: row.referenceType,
        source_id: row.referenceId,
        journal_entry_id: row.journalId,
        rule_code: firstRule,
        rule_message: row.severityReason.slice(0, 2000),
        suggested_action: primary?.suggestedAction || getRuleDefinition(firstRule)?.title || 'Review in trace',
        impact_summary: 'Trial Balance / reconciliation risk',
        bucket: 'misposted_journals',
        status: 'new',
        priority: row.severity === 'error' ? 10 : 6,
      });
      if (ins) n++;
    }
    toast.success(`Queued ${n} actionable item(s)`);
    loadFixQueue();
  }, [companyId, scanRows, loadFixQueue]);

  const openDrawerForJe = async (journalId: string, ruleIdsOverride?: string[]) => {
    if (!companyId) return;
    const full = await loadJournalWithLines(companyId, journalId);
    setDrawerJe(full);
    const row = scanRows.find((x) => x.journalId === journalId);
    const ex = explorerRows.find((x) => x.je.id === journalId);
    setDrawerRules(ruleIdsOverride ?? row?.ruleIds ?? ex?.ruleIds ?? []);
    setDrawerSeverityReason(row?.severityReason ?? '');
    setDrawerHits(row?.hits ?? []);
  };

  if (!allowed) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <Card className="max-w-lg border-red-900/40 bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-300">
              <ShieldAlert className="h-5 w-5" /> Developer Integrity Lab — access denied
            </CardTitle>
            <CardDescription className="text-gray-400">
              Allowed roles: owner, super admin, super_admin, developer, accounting_auditor. Local DEV: admin.
              Optional env: <code className="text-xs">VITE_ACCOUNTING_DIAGNOSTICS=1</code>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="p-8 text-gray-400 flex gap-2 items-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const traceForJe = trace && selectedJe ? trace.expectedVsActual?.find((e) => e.journalId === selectedJe.id) : null;
  const selectedTraceUi = trace && selectedJe ? trace.journalUiRefs?.[selectedJe.id] : undefined;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6 text-gray-100 pb-24">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Developer Integrity Lab</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-3xl">
            Forensic accounting trace, rule validation, and anomaly detection. Journal is GL source of truth — this
            module does not modify TB math. Diagnostic and guided review only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="border-gray-600" onClick={() => runScan()} disabled={scanLoading}>
            {scanLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Re-run scan
          </Button>
          <Button variant="outline" size="sm" className="border-gray-600" onClick={exportFindings}>
            <Download className="h-4 w-4 mr-1" /> Export findings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-violet-700 text-violet-300"
            onClick={() => setCurrentView('ar-ap-reconciliation-center')}
          >
            <Scale className="h-4 w-4 mr-1" /> Reconciliation Center
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-gray-800 bg-gray-900/40">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium text-gray-300">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
          <div>
            <Label className="text-xs text-gray-500">Branch</Label>
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="bg-gray-950 border-gray-700 h-9 mt-1">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">From</Label>
            <Input type="date" className="bg-gray-950 border-gray-700 h-9 mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-gray-500">To</Label>
            <Input type="date" className="bg-gray-950 border-gray-700 h-9 mt-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-gray-500">reference_type</Label>
            <Input
              className="bg-gray-950 border-gray-700 h-9 mt-1 font-mono text-xs"
              placeholder="e.g. sale"
              value={filterRefType}
              onChange={(e) => setFilterRefType(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Severity (feed)</Label>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="bg-gray-950 border-gray-700 h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="clean">Clean</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Module</Label>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="bg-gray-950 border-gray-700 h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="Purchases">Purchases</SelectItem>
                <SelectItem value="Studio / Worker">Studio / Worker</SelectItem>
                <SelectItem value="GL">GL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <Label className="text-xs text-gray-500">Display ref (feed filter)</Label>
            <Input
              className="bg-gray-950 border-gray-700 h-9 mt-1 font-mono text-xs"
              placeholder="SL-…, PUR-…, PAY-…, JE…"
              value={filterDisplayRef}
              onChange={(e) => setFilterDisplayRef(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full h-9" variant="secondary" onClick={() => runScan()}>
              Apply to scan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { k: 'scanned', label: 'Scanned JEs', v: summary?.scannedJournals ?? '—', tab: 'anomalies' },
          { k: 'clean', label: 'Clean', v: summary?.clean ?? '—', tab: 'anomalies', sev: 'clean' as const },
          { k: 'warn', label: 'Warnings', v: summary?.warning ?? '—', tab: 'anomalies', sev: 'warning' as const },
          { k: 'err', label: 'Errors', v: summary?.error ?? '—', tab: 'anomalies', sev: 'error' as const },
          { k: 'miss', label: 'Missing JE', v: (summary?.missingPostingSales ?? 0) + (summary?.missingPostingPurchases ?? 0), tab: 'rules' },
          { k: 'unl', label: 'Unlinked / weak', v: summary?.unlinkedOrWeak ?? '—', tab: 'anomalies' },
          { k: 'man', label: 'Manual control', v: summary?.manualControlHits ?? '—', tab: 'journal' },
          { k: 'tb', label: 'TB risk', v: summary?.trialBalanceRiskCount ?? '—', tab: 'anomalies', sev: 'error' as const },
        ].map((c) => (
          <button
            key={c.k}
            type="button"
            onClick={() => {
              setActiveTab(c.tab);
              if (c.sev) setFilterSeverity(c.sev);
            }}
            className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-left hover:bg-gray-800/80 transition-colors"
          >
            <div className="text-[10px] uppercase tracking-wider text-gray-500">{c.label}</div>
            <div className="text-xl font-semibold text-white mt-1">{c.v}</div>
          </button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-900 border border-gray-800 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="trace">A · Trace</TabsTrigger>
          <TabsTrigger value="anomalies">B · Anomaly feed</TabsTrigger>
          <TabsTrigger value="health">C · Account health</TabsTrigger>
          <TabsTrigger value="rules">D · Rule violations</TabsTrigger>
          <TabsTrigger value="journal">E · Journal explorer</TabsTrigger>
          <TabsTrigger value="fix">F · Fix queue</TabsTrigger>
          <TabsTrigger value="party-tieout">G · Party tie-out</TabsTrigger>
          <TabsTrigger value="coa-audit">H · COA audit</TabsTrigger>
          <TabsTrigger value="ob-sync">I · OB sync</TabsTrigger>
          <TabsTrigger value="gl-audit">J · GL Audit</TabsTrigger>
          <TabsTrigger value="inv-detail">K · Inventory</TabsTrigger>
          <TabsTrigger value="contact-recon">L · Contact Recon</TabsTrigger>
        </TabsList>

        <TabsContent value="trace" className="space-y-4">
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-lg">Trace transaction</CardTitle>
              <CardDescription>End-to-end source → expectation → posted GL → variance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <Select value={traceMode} onValueChange={(v) => setTraceMode(v as TraceMode)}>
                  <SelectTrigger className="w-[200px] bg-gray-950 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="uuid">UUID</SelectItem>
                    <SelectItem value="entry_no">JE number</SelectItem>
                    <SelectItem value="payment_ref">Payment ref</SelectItem>
                    <SelectItem value="sale">Sale no</SelectItem>
                    <SelectItem value="purchase">Purchase no</SelectItem>
                    <SelectItem value="reference">reference_type:id</SelectItem>
                    <SelectItem value="account_code">Account code</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="max-w-md bg-gray-950 border-gray-700"
                  placeholder="SL-…, PUR-…, PRD-…, PAY-…, JE…, UUID, type:uuid"
                  value={traceQ}
                  onChange={(e) => setTraceQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runTrace()}
                />
                <Button onClick={runTrace} disabled={traceLoading}>
                  {traceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                  Trace
                </Button>
              </div>

              {trace && (
                <div className="space-y-4 border-t border-gray-800 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <SevBadge s={trace.overall} />
                    <span className="text-sm text-gray-400">{trace.sourceDocNarrative}</span>
                  </div>

                  {trace.traceGuidance && (
                    <div className="rounded-lg border border-violet-900/50 bg-violet-950/20 p-4 space-y-3 text-sm">
                      <div className="text-xs font-semibold text-violet-300 uppercase tracking-wide">Trace resolution</div>
                      <div>
                        <span className="text-gray-500">Source: </span>
                        <span className={trace.traceGuidance.sourceResolved ? 'text-emerald-400' : 'text-amber-400'}>
                          {trace.traceGuidance.sourceResolved ? 'Found' : 'Not found'}
                        </span>
                        <span className="text-gray-300 ml-2">{trace.traceGuidance.sourceSummary}</span>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs mb-1">Expected posting (policy)</div>
                        <ul className="list-disc pl-5 text-gray-300 space-y-0.5">
                          {trace.traceGuidance.expectedPostingSummary.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs mb-1">Actual GL (this trace)</div>
                        <ul className="list-disc pl-5 text-gray-300 space-y-0.5">
                          {trace.traceGuidance.actualPostingSummary.map((line, i) => (
                            <li key={i} className="font-mono text-[11px]">
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs mb-1">Next actions</div>
                        <ol className="list-decimal pl-5 text-gray-300 space-y-1">
                          {trace.traceGuidance.nextSteps.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}

                  {/* A1 Source summary */}
                  <div>
                    <h4 className="text-xs font-semibold text-violet-300 uppercase tracking-wide mb-2">A1 · Source summary</h4>
                    <div className="flex flex-wrap gap-2">
                      {trace.entities.map((e) => (
                        <Badge key={`${e.kind}-${e.id}`} variant="secondary" className="bg-gray-800">
                          {e.kind}: {e.label} {e.status ? `· ${e.status}` : ''}
                        </Badge>
                      ))}
                      {!trace.entities.length && <span className="text-sm text-gray-500">No source entity resolved.</span>}
                    </div>
                  </div>

                  {/* A2 Expectation narrative */}
                  <div>
                    <h4 className="text-xs font-semibold text-violet-300 uppercase tracking-wide mb-2">A2 · Accounting expectation</h4>
                    <ul className="text-sm text-gray-300 list-disc pl-5 space-y-1">
                      <li>Draft sale / draft purchase → <strong>no GL</strong> expected.</li>
                      <li>Final sale / posted purchase → canonical document JE expected.</li>
                      <li>Pre-bill worker payment → Dr <strong>1180</strong> / Cr bank.</li>
                      <li>Stage bill → Dr <strong>5000</strong> / Cr <strong>2010</strong>.</li>
                      <li>Advance settlement → Dr <strong>2010</strong> / Cr <strong>1180</strong>.</li>
                      <li>Post-bill worker payment → Dr <strong>2010</strong> / Cr bank.</li>
                    </ul>
                  </div>

                  {/* A3 Journals */}
                  <div>
                    <h4 className="text-xs font-semibold text-violet-300 uppercase tracking-wide mb-2">A3 · Actual GL</h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {trace.journals.map((j) => {
                        const u = trace.journalUiRefs?.[j.id];
                        const label = u?.displayRef || j.entry_no || j.id.slice(0, 8);
                        return (
                          <Button
                            key={j.id}
                            size="sm"
                            variant={selectedJe?.id === j.id ? 'default' : 'outline'}
                            className="border-gray-600 max-w-[220px] truncate"
                            title={u?.technicalRef || j.id}
                            onClick={() => setSelectedJe(j)}
                          >
                            {label}
                          </Button>
                        );
                      })}
                    </div>
                    {selectedJe && selectedTraceUi ? (
                      <div className="mb-3 rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                        <div className="text-[10px] uppercase text-gray-500 mb-1">Resolved document (this JE)</div>
                        <AccountingRefDisplayCell ui={selectedTraceUi} />
                      </div>
                    ) : null}
                    {selectedJe && (
                      <pre className="text-xs bg-black/40 p-3 rounded-lg overflow-x-auto text-gray-300">
                        {JSON.stringify(
                          {
                            entry_no: selectedJe.entry_no,
                            entry_date: selectedJe.entry_date,
                            reference_type: selectedJe.reference_type,
                            reference_id: selectedJe.reference_id,
                            branch_id: selectedJe.branch_id,
                            payment_id: selectedJe.payment_id,
                            void: selectedJe.is_void,
                            lines: selectedJe.lines.map((l) => ({
                              code: l.account_code,
                              dr: l.debit,
                              cr: l.credit,
                            })),
                          },
                          null,
                          2
                        )}
                      </pre>
                    )}
                  </div>

                  {/* A4 Expected vs actual */}
                  {traceForJe && (
                    <div>
                      <h4 className="text-xs font-semibold text-violet-300 uppercase tracking-wide mb-2">A4 · Expected vs actual</h4>
                      <div className="grid md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-gray-500 text-xs mb-1">Expected</div>
                          <pre className="text-xs bg-black/30 p-2 rounded">{JSON.stringify(traceForJe.expected, null, 2)}</pre>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs mb-1">Actual</div>
                          <pre className="text-xs bg-black/30 p-2 rounded">{JSON.stringify(traceForJe.actual, null, 2)}</pre>
                        </div>
                      </div>
                      <p className={`mt-2 text-sm ${traceForJe.diffNote.includes('match') ? 'text-emerald-400' : 'text-red-300'}`}>
                        {traceForJe.diffNote}
                      </p>
                    </div>
                  )}

                  {/* A5 Impact */}
                  <div>
                    <h4 className="text-xs font-semibold text-violet-300 uppercase tracking-wide mb-2">A5 · Impact</h4>
                    <p className="text-sm text-gray-400">
                      Affects Trial Balance / COA balances for accounts touched; AR/AP tie-out via 1100/2000/1195; worker
                      position via 1180/2010. Use Reconciliation Center for operational vs GL cleanup.
                    </p>
                  </div>

                  {/* A6 Banner */}
                  <div className="rounded-lg border border-gray-700 p-3 flex items-center gap-2">
                    {trace.overall === 'error' && <XCircle className="h-5 w-5 text-red-400" />}
                    {trace.overall === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-400" />}
                    {trace.overall === 'clean' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                    {trace.overall === 'info' && <Info className="h-5 w-5 text-slate-400" />}
                    <span className="font-medium">Result: {trace.overall.toUpperCase()}</span>
                  </div>

                  {/* A7 Actions (navigation only — no silent GL edits) */}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="border-gray-600" onClick={() => setCurrentView('accounting')}>
                      Open accounting
                    </Button>
                    <Button variant="outline" size="sm" className="border-gray-600" onClick={() => setCurrentView('ar-ap-reconciliation-center')}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Reconciliation Center
                    </Button>
                    <Button variant="outline" size="sm" className="border-gray-600" disabled title="Use accounting module — reverse/repost is not auto-run from this lab">
                      Reverse / repost (manual)
                    </Button>
                  </div>

                  {trace.ruleHits.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-amber-200/90 mb-2">Rule hits</h4>
                      <ul className="space-y-2">
                        {trace.ruleHits.map((h, i) => (
                          <li key={`${h.ruleId}-${i}`} className="text-sm border border-gray-800 rounded p-2 bg-gray-950/50">
                            <SevBadge s={h.severity} /> <span className="font-mono text-xs text-violet-300">{h.ruleId}</span> {h.title}
                            <div className="text-gray-500 text-xs mt-1">{h.detail}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies">
          <ScrollArea className="h-[min(68vh,620px)] rounded-lg border border-gray-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-900 z-10 text-gray-400">
                <tr>
                  <th className="text-left p-2">Severity</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2 min-w-[200px]">Document</th>
                  <th className="text-left p-2">Rule</th>
                  <th className="text-left p-2">Why (rollup)</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnomalies.map((r) => (
                  <tr key={r.journalId} className="border-t border-gray-800/90 hover:bg-gray-900/40">
                    <td className="p-2">
                      <SevBadge s={r.severity} />
                    </td>
                    <td className="p-2 text-gray-400">{r.entryDate || '—'}</td>
                    <td className="p-2 align-top">
                      <AccountingRefDisplayCell ui={r.uiRef} />
                    </td>
                    <td className="p-2 text-violet-300 font-mono">{r.ruleIds[0] || '—'}</td>
                    <td className="p-2 text-gray-500 max-w-[220px] truncate" title={r.severityReason}>
                      {r.severityReason}
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant="ghost" className="h-7 text-violet-400" onClick={() => openDrawerForJe(r.journalId)}>
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="health" className="space-y-3">
          <Button size="sm" variant="outline" className="border-gray-600" onClick={loadHealth} disabled={healthLoading}>
            {healthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {health.map((h) => (
              <Card key={h.code} className="border-gray-800 bg-gray-900/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">
                    {h.code} — {h.name}
                  </CardTitle>
                  <CardDescription className="space-y-1">
                    <div>
                      <span className="text-gray-500">Journal balance (TB / GL):</span>{' '}
                      <span className="text-emerald-300 font-mono">{h.journalBalance?.toFixed(2) ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Stored COA cache:</span>{' '}
                      <span className="text-gray-200 font-mono">{h.storedBalance?.toFixed(2) ?? '—'}</span>
                    </div>
                    {h.balanceVariance !== undefined && Math.abs(h.balanceVariance) > 0.01 && (
                      <div className="text-amber-400">
                        Variance (stored − journal): <span className="font-mono">{h.balanceVariance.toFixed(2)}</span>
                      </div>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div>
                    Error/warning hits in <strong>same scan</strong>:{' '}
                    <span className="text-amber-400 font-medium">{h.anomalyCount}</span>
                  </div>
                  {h.latestAnomalies.map((a) => (
                    <button
                      key={a.journalId}
                      type="button"
                      className="w-full text-left p-2 rounded border border-gray-800 hover:bg-gray-800/40"
                      onClick={() => {
                        openDrawerForJe(a.journalId);
                        setActiveTab('anomalies');
                      }}
                    >
                      <div className="text-gray-200 text-xs font-medium truncate">{a.displayRef || a.entryNo || a.journalId.slice(0, 8)}</div>
                      {a.technicalRef ? (
                        <div className="text-[10px] text-gray-500 font-mono truncate">{a.technicalRef}</div>
                      ) : null}
                      <SevBadge s={a.severity} />
                    </button>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card className="border-gray-800 bg-gray-900/30">
            <CardHeader>
              <CardTitle className="text-base">Rule violation counts (current scan)</CardTitle>
              <CardDescription>
                Counts use the same rollup rules as the anomaly feed (excludes ignored_for_lab_rollup). One scan dataset.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2 text-sm">
              {INTEGRITY_RULE_REGISTRY.map((rule) => (
                <div
                  key={rule.id}
                  className="flex justify-between items-center border border-gray-800 rounded-lg p-3 bg-gray-950/40"
                >
                  <div>
                    <div className="font-mono text-violet-300 text-xs">{rule.id}</div>
                    <div>{rule.title}</div>
                    <div className="text-xs text-gray-500">{rule.module || '—'}</div>
                  </div>
                  <Badge variant="outline" className="text-lg font-mono border-gray-600">
                    {ruleCounts.get(rule.id) ?? 0}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="text-xs text-gray-500">
            Missing postings (final sale / posted purchase without JE): RPC{' '}
            <code className="text-gray-400">rpc_integrity_count_*_missing_je</code> — see migration 20260332.
          </div>
        </TabsContent>

        <TabsContent value="journal" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={explorerVoid} onValueChange={(v) => setExplorerVoid(v as 'all' | 'yes' | 'no')}>
              <SelectTrigger className="w-[140px] bg-gray-950 border-gray-700 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Void: all</SelectItem>
                <SelectItem value="no">Void: active</SelectItem>
                <SelectItem value="yes">Void: yes</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={explorerSuspicious} onChange={(e) => setExplorerSuspicious(e.target.checked)} />
              Suspicious only
            </label>
            <Button size="sm" onClick={loadExplorer} disabled={explorerLoading}>
              {explorerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load'}
            </Button>
          </div>
          <ScrollArea className="h-[min(60vh,560px)] border border-gray-800 rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-900 text-gray-400">
                <tr>
                  <th className="text-left p-2 min-w-[200px]">Document</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Badge</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {explorerRows.map((r) => (
                  <tr key={r.je.id} className="border-t border-gray-800 hover:bg-gray-900/40">
                    <td className="p-2 align-top">
                      <AccountingRefDisplayCell ui={r.uiRef} />
                    </td>
                    <td className="p-2">{r.je.entry_date}</td>
                    <td className="p-2">
                      <SevBadge s={r.severity} />
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => openDrawerForJe(r.je.id, r.ruleIds)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="fix" className="space-y-3">
          <Card className="border-amber-900/40 bg-amber-950/20">
            <CardHeader className="py-3">
              <CardTitle className="text-sm text-amber-200">Journal duplicate repair (global)</CardTitle>
              <CardDescription className="text-xs text-amber-200/70">
                Scans active <code className="text-[10px]">journal_entries</code>: (1) multiple primary JEs per{' '}
                <code className="text-[10px]">payment_id</code> excluding <code className="text-[10px]">payment_adjustment</code>, (2)
                duplicate <code className="text-[10px]">entry_no</code> (e.g. JE-0039), (3) duplicate{' '}
                <code className="text-[10px]">action_fingerprint</code>. Keeps oldest row per group, voids the rest, then runs
                payment-account sync.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-700 text-amber-100"
                  onClick={previewPostingDuplicates}
                  disabled={postingPreviewLoading || !companyId}
                >
                  {postingPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                  Preview duplicates
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-amber-900/50 text-amber-50 border border-amber-700"
                  onClick={runPostingDuplicateRepair}
                  disabled={postingRepairLoading || !companyId}
                >
                  {postingRepairLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wrench className="h-4 w-4 mr-1" />}
                  Void duplicates + sync accounts
                </Button>
              </div>
              {postingRepairJson ? (
                <pre className="text-[10px] text-gray-400 max-h-40 overflow-auto rounded border border-gray-800 bg-black/40 p-2">
                  {postingRepairJson}
                </pre>
              ) : null}
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={pushErrorsToQueue}>
              <ClipboardList className="h-4 w-4 mr-1" /> Push actionable items to queue
            </Button>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={hideResolved} onChange={(e) => setHideResolved(e.target.checked)} />
              Hide resolved / ignored_by_rule
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={hideReviewed} onChange={(e) => setHideReviewed(e.target.checked)} />
              Hide reviewed
            </label>
            <Button size="sm" variant="outline" className="border-gray-600" onClick={loadFixQueue} disabled={fixLoading}>
              Refresh queue
            </Button>
          </div>
          <ScrollArea className="h-[min(55vh,520px)] border border-gray-800 rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-900 text-gray-400">
                <tr>
                  <th className="text-left p-2">Priority</th>
                  <th className="text-left p-2 min-w-[200px]">Document</th>
                  <th className="text-left p-2">Rule</th>
                  <th className="text-left p-2">Problem</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fixIssues.map((iss) => (
                  <tr key={iss.id} className="border-t border-gray-800">
                    <td className="p-2">{iss.priority}</td>
                    <td className="p-2 align-top">
                      <AccountingRefDisplayCell ui={fixUiByIssueId.get(iss.id)} />
                    </td>
                    <td className="p-2 font-mono text-violet-300">{iss.rule_code}</td>
                    <td className="p-2 max-w-[240px] truncate">{iss.rule_message}</td>
                    <td className="p-2">{iss.status}</td>
                    <td className="p-2 flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => iss.journal_entry_id && openDrawerForJe(iss.journal_entry_id)}
                      >
                        JE
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-gray-600"
                        onClick={async () => {
                          await updateIntegrityIssueStatus(iss.id, 'reviewed', { last_reviewed_by: user?.id ?? null });
                          loadFixQueue();
                        }}
                      >
                        Reviewed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-gray-600 text-slate-400"
                        onClick={async () => {
                          await updateIntegrityIssueStatus(iss.id, 'ignored_by_rule', { last_reviewed_by: user?.id ?? null });
                          loadFixQueue();
                        }}
                      >
                        Ignore (rule)
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-emerald-400"
                        onClick={async () => {
                          await updateIntegrityIssueStatus(iss.id, 'resolved', { last_reviewed_by: user?.id ?? null });
                          loadFixQueue();
                        }}
                      >
                        Resolve
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fixIssues.length === 0 && <p className="p-6 text-center text-gray-500 text-sm">No queue rows (or table not migrated).</p>}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="party-tieout" className="space-y-4">
          <PartyTieOutRepairPanel branchId={effBranch} />
        </TabsContent>

        <TabsContent value="coa-audit" className="space-y-4">
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookMarked className="h-5 w-5 text-violet-400" />
                Chart of accounts audit
              </CardTitle>
              <CardDescription>
                Read-only checks: hierarchy rules, unexpected root accounts, orphan parent references, and parent/child
                statement-section alignment. GL truth is unchanged (journal SOT). Run after migration{' '}
                <code className="text-gray-500 text-[10px]">20260347_account_is_group_coa_headers</code> for{' '}
                <code className="text-gray-500 text-[10px]">is_group</code> on header rows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={runCoaAudit} disabled={coaAuditLoading || !companyId}>
                  {coaAuditLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                  Run full COA audit
                </Button>
                <Button variant="secondary" onClick={repairCoaStructure} disabled={coaSeedLoading || !companyId}>
                  {coaSeedLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wrench className="h-4 w-4 mr-1" />}
                  Ensure default COA + repair parents
                </Button>
                {coaAuditResult ? (
                  <Button
                    variant="outline"
                    className="border-gray-600"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(coaAuditResult, null, 2)], { type: 'application/json' });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `coa-audit-${coaAuditResult.companyId.slice(0, 8)}.json`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                      toast.success('Downloaded COA audit JSON');
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export JSON
                  </Button>
                ) : null}
              </div>

              {coaAuditResult ? (
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-gray-400">
                      Scanned <strong className="text-white">{coaAuditResult.scannedAccounts}</strong> accounts
                    </span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-400">
                      Issues <strong className={coaAuditResult.issueCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>{coaAuditResult.issueCount}</strong>
                    </span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-400">
                      Hierarchy rules <strong className="text-white">{coaAuditResult.hierarchyIssueCount}</strong>
                    </span>
                  </div>
                  <ScrollArea className="h-[min(420px,50vh)] rounded-md border border-gray-800">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-900 text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="text-left p-2 font-medium">Sev</th>
                          <th className="text-left p-2 font-medium">Category</th>
                          <th className="text-left p-2 font-medium">Code</th>
                          <th className="text-left p-2 font-medium">Account</th>
                          <th className="text-left p-2 font-medium">Rule</th>
                          <th className="text-left p-2 font-medium">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coaAuditResult.issues.map((iss, i) => (
                          <tr key={`${iss.code}-${iss.accountId ?? i}`} className="border-t border-gray-800/80 text-gray-300">
                            <td className="p-2 align-top">
                              {iss.severity === 'error' ? (
                                <Badge className="bg-red-900/80 text-red-200 border-0 text-[10px]">err</Badge>
                              ) : (
                                <Badge className="bg-amber-900/60 text-amber-200 border-0 text-[10px]">warn</Badge>
                              )}
                            </td>
                            <td className="p-2 align-top font-mono text-[10px] text-violet-300">{iss.category}</td>
                            <td className="p-2 align-top font-mono text-gray-400">{iss.accountCode || '—'}</td>
                            <td className="p-2 align-top max-w-[140px] truncate" title={iss.accountName}>
                              {iss.accountName || '—'}
                            </td>
                            <td className="p-2 align-top font-mono text-[10px] text-slate-400">{iss.code}</td>
                            <td className="p-2 align-top text-gray-400">{iss.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {coaAuditResult.issues.length === 0 && (
                      <p className="p-6 text-center text-gray-500 text-sm">No issues reported for this company.</p>
                    )}
                  </ScrollArea>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Run the audit to load results for the current company.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ob-sync" className="space-y-4">
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-5 w-5 text-emerald-400" />
                Contact Opening Balance GL Sync
              </CardTitle>
              <CardDescription>
                Posts/reconciles journal entries for all contacts with opening balances, creates AR/AP sub-ledger
                accounts, and syncs inventory opening stock to GL. Idempotent — safe to re-run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={async () => {
                  if (!companyId) return;
                  setObSyncLoading(true);
                  setObSyncResult(null);
                  try {
                    const { openingBalanceJournalService } = await import('@/app/services/openingBalanceJournalService');
                    const result = await openingBalanceJournalService.syncAllContactOpeningBalances(companyId);
                    setObSyncResult(result);
                  } catch (e: any) {
                    setObSyncResult({ totalContacts: 0, synced: 0, inventoryMovementsSynced: 0, errors: [e?.message || String(e)] });
                  } finally {
                    setObSyncLoading(false);
                  }
                }}
                disabled={obSyncLoading || !companyId}
              >
                {obSyncLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Run Opening Balance Sync
              </Button>

              {obSyncResult && (
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-gray-400">
                      Contacts: <strong className="text-white">{obSyncResult.totalContacts}</strong>
                    </span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-400">
                      GL synced: <strong className="text-emerald-400">{obSyncResult.synced}</strong>
                    </span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-400">
                      Sub-ledgers: <strong className="text-blue-400">{obSyncResult.subledgersCreated}</strong>
                    </span>
                    <span className="text-gray-600">·</span>
                    {(obSyncResult.inventoryJEsPosted ?? 0) > 0 ? (
                      <span className="text-gray-400">
                        Inventory JEs posted: <strong className="text-emerald-400">{obSyncResult.inventoryJEsPosted}</strong>
                        {(obSyncResult.inventoryTotalValue ?? 0) > 0 && (
                          <span className="text-gray-500"> (Rs.{obSyncResult.inventoryTotalValue?.toLocaleString()})</span>
                        )}
                      </span>
                    ) : (obSyncResult.inventoryJEsKept ?? 0) > 0 ? (
                      <span className="text-gray-400">
                        Inventory JEs kept: <strong className="text-blue-400">{obSyncResult.inventoryJEsKept}</strong>
                        {(obSyncResult.inventoryTotalValue ?? 0) > 0 && (
                          <span className="text-gray-500"> (Rs.{obSyncResult.inventoryTotalValue?.toLocaleString()})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-400">
                        Inventory: <strong className="text-amber-400">{obSyncResult.inventoryMovementsSynced ?? 0}</strong>
                      </span>
                    )}
                    {(obSyncResult.inventoryZeroCostSkipped ?? 0) > 0 && (
                      <>
                        <span className="text-gray-600">·</span>
                        <span className="text-gray-400">
                          Zero-cost skipped: <strong className="text-yellow-500">{obSyncResult.inventoryZeroCostSkipped}</strong>
                        </span>
                      </>
                    )}
                    {obSyncResult.errors.length > 0 && (
                      <>
                        <span className="text-gray-600">·</span>
                        <span className="text-gray-400">
                          Errors: <strong className="text-red-400">{obSyncResult.errors.length}</strong>
                        </span>
                      </>
                    )}
                  </div>
                  {obSyncResult.errors.length > 0 && (
                    <div className="text-xs text-red-400 space-y-1">
                      {obSyncResult.errors.map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                    </div>
                  )}
                  {obSyncResult.synced > 0 && obSyncResult.errors.length === 0 && (
                    <p className="text-sm text-emerald-400">All contact opening balances synced to GL successfully.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/40 mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">Data Repair — Stock Dedup + Shipping AR</CardTitle>
              <CardDescription>
                Removes duplicate sale stock movements and creates corrective JEs for sales where shipping was missing from AR.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={async () => {
                  if (!companyId) return;
                  setDataRepairLoading(true);
                  setDataRepairResult(null);
                  const log: string[] = [];
                  try {
                    const { supabase } = await import('@/lib/supabase');

                    // PART 1: Fix duplicate sale stock movements
                    log.push('=== Stock Dedup ===');
                    const { data: allMov } = await supabase
                      .from('stock_movements')
                      .select('id, product_id, variation_id, movement_type, quantity, reference_id, created_at')
                      .eq('company_id', companyId)
                      .eq('reference_type', 'sale')
                      .order('created_at', { ascending: true });

                    const groups = new Map<string, typeof allMov>();
                    for (const m of allMov || []) {
                      const mt = ((m as any).movement_type || '').toLowerCase().trim();
                      const key = `${(m as any).reference_id}|${(m as any).product_id}|${(m as any).variation_id || ''}|${mt}`;
                      if (!groups.has(key)) groups.set(key, []);
                      groups.get(key)!.push(m);
                    }
                    const toDelete: string[] = [];
                    for (const [, rows] of groups.entries()) {
                      if ((rows || []).length <= 1) continue;
                      for (let i = 1; i < (rows || []).length; i++) toDelete.push((rows![i] as any).id);
                    }
                    // Also remove positive qty 'sale' type (sync artifacts)
                    for (const m of allMov || []) {
                      const mt = ((m as any).movement_type || '').toLowerCase().trim();
                      if (mt === 'sale' && (m as any).quantity > 0 && !toDelete.includes((m as any).id))
                        toDelete.push((m as any).id);
                    }
                    if (toDelete.length > 0) {
                      for (let i = 0; i < toDelete.length; i += 20) {
                        await supabase.from('stock_movements').delete().in('id', toDelete.slice(i, i + 20));
                      }
                      log.push(`Deleted ${toDelete.length} duplicate/artifact stock movements`);
                    } else {
                      log.push('No duplicate stock movements found');
                    }

                    // PART 2: Fix missing shipping in AR
                    log.push('=== Shipping AR Repair ===');
                    const { data: salesShip } = await supabase
                      .from('sales')
                      .select('id, invoice_no, total, shipment_charges, branch_id')
                      .eq('company_id', companyId)
                      .eq('status', 'final')
                      .gt('shipment_charges', 0);

                    let repaired = 0;
                    for (const sale of salesShip || []) {
                      const shipping = Number((sale as any).shipment_charges) || 0;
                      if (shipping <= 0) continue;

                      const { data: jes } = await supabase
                        .from('journal_entries')
                        .select('id')
                        .eq('reference_type', 'sale')
                        .eq('reference_id', (sale as any).id)
                        .or('is_void.is.null,is_void.eq.false')
                        .limit(1);
                      if (!jes?.length) continue;

                      const { data: lines } = await supabase
                        .from('journal_entry_lines')
                        .select('account_id, debit, description')
                        .eq('journal_entry_id', (jes[0] as any).id)
                        .gt('debit', 0);

                      const arLine = (lines || []).find((l: any) =>
                        (l.description || '').toLowerCase().includes('receivable') || (l.description || '').toLowerCase().includes(' ar ')
                      );
                      if (!arLine) continue;

                      const gap = Math.round((Number((sale as any).total) + shipping - Number((arLine as any).debit)) * 100) / 100;
                      if (gap <= 0.01) continue;

                      const entryNo = `JE-SHIP-REPAIR-${(sale as any).invoice_no}`;
                      const { data: existing } = await supabase.from('journal_entries').select('id').eq('company_id', companyId).eq('entry_no', entryNo).or('is_void.is.null,is_void.eq.false').limit(1);
                      if (existing?.length) continue;

                      const { data: shipAcct } = await supabase.from('accounts').select('id').eq('company_id', companyId).eq('code', '4110').limit(1);
                      if (!shipAcct?.length) { log.push('No 4110 Shipping Income account'); break; }

                      const { data: newJe } = await supabase.from('journal_entries').insert({
                        company_id: companyId, branch_id: (sale as any).branch_id || null,
                        entry_no: entryNo, entry_date: new Date().toISOString().slice(0, 10),
                        description: `Shipping AR correction ${(sale as any).invoice_no}: +Rs ${gap}`,
                        reference_type: 'sale_adjustment', reference_id: (sale as any).id,
                        total_debit: gap, total_credit: gap,
                      }).select('id').single();

                      if (newJe?.id) {
                        await supabase.from('journal_entry_lines').insert([
                          { journal_entry_id: (newJe as any).id, account_id: (arLine as any).account_id, debit: gap, credit: 0, description: `AR shipping +Rs ${gap}` },
                          { journal_entry_id: (newJe as any).id, account_id: (shipAcct[0] as any).id, debit: 0, credit: gap, description: `Shipping income Rs ${gap}` },
                        ]);
                        log.push(`${(sale as any).invoice_no}: +Rs ${gap} → AR corrected`);
                        repaired++;
                      }
                    }
                    log.push(`Shipping repair: ${repaired} sales corrected`);
                  } catch (e: any) {
                    log.push(`ERROR: ${e?.message || String(e)}`);
                  }
                  setDataRepairResult(log);
                  setDataRepairLoading(false);
                }}
                disabled={dataRepairLoading || !companyId}
                variant="destructive"
              >
                {dataRepairLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Run Data Repair
              </Button>
              {dataRepairResult && (
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 text-xs font-mono space-y-0.5">
                  {dataRepairResult.map((line, i) => (
                    <p key={i} className={line.startsWith('===') ? 'text-blue-400 font-bold' : line.startsWith('ERROR') ? 'text-red-400' : 'text-gray-300'}>{line}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gl-audit" className="space-y-4">
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-400" />
                GL Balance Audit
              </CardTitle>
              <CardDescription>
                Compares stored account balances with journal-derived GL balances. Mismatches indicate data drift.
                Click "Sync All" to fix stored balances to match GL truth.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (!companyId) return;
                    setGlAuditLoading(true);
                    try {
                      const { data } = await supabase.rpc('gl_audit_all_accounts', { p_company_id: companyId }).throwOnError();
                      setGlAuditData(null); // will use direct query instead
                      // Direct query approach since RPC may not exist
                    } catch {
                      // Fallback: query directly
                      try {
                        const { data: accounts } = await supabase.from('accounts').select('id, code, name, balance').eq('company_id', companyId).eq('is_active', true);
                        const { data: entries } = await supabase.from('journal_entries').select('id').eq('company_id', companyId).or('is_void.is.null,is_void.eq.false');
                        const jeIds = (entries || []).map((e: any) => e.id);
                        const { data: lines } = jeIds.length > 0 ? await supabase.from('journal_entry_lines').select('account_id, debit, credit').in('journal_entry_id', jeIds) : { data: [] };
                        const glMap = new Map<string, number>();
                        for (const l of (lines || []) as any[]) {
                          glMap.set(l.account_id, (glMap.get(l.account_id) || 0) + (Number(l.debit) || 0) - (Number(l.credit) || 0));
                        }
                        const rows = (accounts || []).map((a: any) => {
                          const gl = Math.round((glMap.get(a.id) || 0) * 100) / 100;
                          const stored = Math.round((Number(a.balance) || 0) * 100) / 100;
                          return { code: a.code, name: a.name, gl_balance: gl, stored_balance: stored, mismatch: Math.round((gl - stored) * 100) / 100 };
                        }).filter((r: any) => r.gl_balance !== 0 || r.stored_balance !== 0);
                        rows.sort((a: any, b: any) => a.code.localeCompare(b.code));
                        setGlAuditData(rows);
                      } catch (e: any) {
                        console.error('GL audit failed:', e);
                      }
                    }
                    setGlAuditLoading(false);
                  }}
                  disabled={glAuditLoading || !companyId}
                >
                  {glAuditLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                  Run GL Audit
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (!companyId) return;
                    setGlSyncLoading(true);
                    try {
                      const { syncAccountsBalanceFromJournal } = await import('@/app/services/liveDataRepairService');
                      const { updated } = await syncAccountsBalanceFromJournal(companyId);
                      if (updated > 0) {
                        alert(`Synced ${updated} account balances to GL truth.`);
                        // Re-run audit
                        const btn = document.querySelector('[data-gl-audit-btn]') as HTMLButtonElement;
                        btn?.click();
                      } else alert('No mismatches to sync.');
                    } catch (e: any) { alert('Sync failed: ' + e?.message); }
                    setGlSyncLoading(false);
                  }}
                  disabled={glSyncLoading || !companyId}
                >
                  {glSyncLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Sync All Balances
                </Button>
              </div>
              {glAuditData && (
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 overflow-auto max-h-[60vh]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-900 text-gray-500 uppercase">
                      <tr>
                        <th className="text-left p-2">Code</th>
                        <th className="text-left p-2">Account</th>
                        <th className="text-right p-2">GL Balance</th>
                        <th className="text-right p-2">Stored</th>
                        <th className="text-right p-2">Mismatch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {glAuditData.map((r, i) => (
                        <tr key={r.code + i} className={`border-t border-gray-800/50 ${Math.abs(r.mismatch) > 0.01 ? 'bg-red-950/30' : ''}`}>
                          <td className="p-2 font-mono text-gray-400">{r.code}</td>
                          <td className="p-2 text-gray-300">{r.name}</td>
                          <td className="p-2 text-right text-white">{r.gl_balance.toLocaleString()}</td>
                          <td className="p-2 text-right text-gray-400">{r.stored_balance.toLocaleString()}</td>
                          <td className={`p-2 text-right font-bold ${Math.abs(r.mismatch) > 0.01 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {Math.abs(r.mismatch) > 0.01 ? r.mismatch.toLocaleString() : '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-2 text-xs text-gray-500 border-t border-gray-800">
                    {glAuditData.filter(r => Math.abs(r.mismatch) > 0.01).length} mismatches of {glAuditData.length} accounts
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inv-detail" className="space-y-4">
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-amber-400" />
                Inventory Detail (Per-Variation)
              </CardTitle>
              <CardDescription>
                Shows each product and variation with quantity, cost price, sale price, stock value, and profit margin.
                Cost is weighted average from actual purchases.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={async () => {
                  if (!companyId) return;
                  setInvDetailLoading(true);
                  try {
                    // Fetch products + variations
                    const { data: products } = await supabase.from('products').select('id, name, sku, cost_price, retail_price, has_variations').eq('company_id', companyId);
                    const prodIds = (products || []).map((p: any) => p.id);
                    const { data: variations } = prodIds.length > 0 ? await supabase.from('product_variations').select('id, product_id, sku, attributes, price, stock').in('product_id', prodIds) : { data: [] };
                    // Fetch weighted avg cost from stock_movements
                    const { data: movements } = prodIds.length > 0 ? await supabase.from('stock_movements').select('product_id, variation_id, quantity, unit_cost, total_cost').eq('company_id', companyId).in('movement_type', ['purchase', 'opening_stock']).in('product_id', prodIds) : { data: [] };
                    // Build cost maps
                    const prodCostAcc = new Map<string, { sum: number; qty: number }>();
                    const varCostAcc = new Map<string, { sum: number; qty: number }>();
                    for (const m of (movements || []) as any[]) {
                      const q = Math.abs(Number(m.quantity) || 0);
                      const c = Math.abs(Number(m.total_cost) || (q * (Number(m.unit_cost) || 0)));
                      const pk = m.product_id;
                      const acc = prodCostAcc.get(pk) || { sum: 0, qty: 0 };
                      acc.sum += c; acc.qty += q; prodCostAcc.set(pk, acc);
                      if (m.variation_id) {
                        const vk = m.variation_id;
                        const vacc = varCostAcc.get(vk) || { sum: 0, qty: 0 };
                        vacc.sum += c; vacc.qty += q; varCostAcc.set(vk, vacc);
                      }
                    }
                    // Fetch stock from stock_movements (actual stock = sum of all movements)
                    const { data: allMov } = prodIds.length > 0 ? await supabase.from('stock_movements').select('product_id, variation_id, quantity').eq('company_id', companyId).in('product_id', prodIds) : { data: [] };
                    const stockMap = new Map<string, number>();
                    const varStockMap = new Map<string, number>();
                    for (const m of (allMov || []) as any[]) {
                      const q = Number(m.quantity) || 0;
                      stockMap.set(m.product_id, (stockMap.get(m.product_id) || 0) + q);
                      if (m.variation_id) varStockMap.set(m.variation_id, (varStockMap.get(m.variation_id) || 0) + q);
                    }
                    // Build rows
                    const rows: typeof invDetailData extends (infer T)[] | null ? T[] : never[] = [];
                    for (const p of (products || []) as any[]) {
                      const varList = ((variations || []) as any[]).filter(v => v.product_id === p.id);
                      if (varList.length > 0) {
                        for (const v of varList) {
                          const qty = Math.round((varStockMap.get(v.id) || Number(v.stock) || 0) * 100) / 100;
                          const costAcc = varCostAcc.get(v.id) || prodCostAcc.get(p.id);
                          const cost = costAcc && costAcc.qty > 0 ? Math.round((costAcc.sum / costAcc.qty) * 100) / 100 : Number(p.cost_price) || 0;
                          const salePrice = Number(v.price) || Number(p.retail_price) || 0;
                          const stockValue = Math.round(qty * cost * 100) / 100;
                          const margin = salePrice > 0 ? Math.round(((salePrice - cost) / salePrice) * 10000) / 100 : 0;
                          const attrs = v.attributes && typeof v.attributes === 'object' ? Object.entries(v.attributes).filter(([k]) => !k.startsWith('__')).map(([k, val]) => `${k}: ${val}`).join(', ') : '';
                          rows.push({ product: p.name, sku: p.sku, variation: attrs || v.sku, var_sku: v.sku, qty, cost, sale_price: salePrice, stock_value: stockValue, margin });
                        }
                      } else {
                        const qty = Math.round((stockMap.get(p.id) || Number(p.current_stock) || 0) * 100) / 100;
                        const costAcc = prodCostAcc.get(p.id);
                        const cost = costAcc && costAcc.qty > 0 ? Math.round((costAcc.sum / costAcc.qty) * 100) / 100 : Number(p.cost_price) || 0;
                        const salePrice = Number(p.retail_price) || 0;
                        const stockValue = Math.round(qty * cost * 100) / 100;
                        const margin = salePrice > 0 ? Math.round(((salePrice - cost) / salePrice) * 10000) / 100 : 0;
                        rows.push({ product: p.name, sku: p.sku, variation: '—', var_sku: '—', qty, cost, sale_price: salePrice, stock_value: stockValue, margin });
                      }
                    }
                    rows.sort((a, b) => a.product.localeCompare(b.product) || a.variation.localeCompare(b.variation));
                    setInvDetailData(rows);
                  } catch (e: any) { console.error('Inventory detail failed:', e); }
                  setInvDetailLoading(false);
                }}
                disabled={invDetailLoading || !companyId}
              >
                {invDetailLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Load Inventory Detail
              </Button>
              {invDetailData && (
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 overflow-auto max-h-[60vh]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-900 text-gray-500 uppercase">
                      <tr>
                        <th className="text-left p-2">Product</th>
                        <th className="text-left p-2">Variation</th>
                        <th className="text-left p-2">SKU</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-right p-2">Avg Cost</th>
                        <th className="text-right p-2">Sale Price</th>
                        <th className="text-right p-2">Stock Value</th>
                        <th className="text-right p-2">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invDetailData.map((r, i) => (
                        <tr key={r.sku + r.var_sku + i} className="border-t border-gray-800/50">
                          <td className="p-2 text-white font-medium">{r.product}</td>
                          <td className="p-2 text-gray-400">{r.variation}</td>
                          <td className="p-2 font-mono text-gray-500">{r.var_sku}</td>
                          <td className={`p-2 text-right ${r.qty < 0 ? 'text-red-400' : r.qty > 0 ? 'text-white' : 'text-gray-600'}`}>{r.qty}</td>
                          <td className="p-2 text-right text-amber-300">{r.cost > 0 ? `Rs. ${r.cost.toLocaleString()}` : '—'}</td>
                          <td className="p-2 text-right text-blue-300">{r.sale_price > 0 ? `Rs. ${r.sale_price.toLocaleString()}` : '—'}</td>
                          <td className="p-2 text-right text-white font-medium">{r.stock_value > 0 ? `Rs. ${r.stock_value.toLocaleString()}` : r.stock_value < 0 ? `(Rs. ${Math.abs(r.stock_value).toLocaleString()})` : '—'}</td>
                          <td className={`p-2 text-right font-bold ${r.margin > 30 ? 'text-emerald-400' : r.margin > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
                            {r.margin > 0 ? `${r.margin}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-900 border-t border-gray-700">
                      <tr>
                        <td className="p-2 text-white font-bold" colSpan={3}>Total</td>
                        <td className="p-2 text-right text-white font-bold">{invDetailData.reduce((s, r) => s + r.qty, 0).toLocaleString()}</td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                        <td className="p-2 text-right text-white font-bold">Rs. {invDetailData.reduce((s, r) => s + r.stock_value, 0).toLocaleString()}</td>
                        <td className="p-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact-recon" className="space-y-4">
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-5 w-5 text-purple-400" />
                Contact Balance Reconciliation
              </CardTitle>
              <CardDescription>
                Compares each contact's operational balance (opening + sales due - paid - returns) vs GL balance
                (journal entries on AR/AP sub-ledger). Shows where mismatches occur and why.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (!companyId) return;
                    setContactReconLoading(true);
                    try {
                      // Fetch all customers/suppliers
                      const { data: contacts } = await supabase.from('contacts').select('id, name, code, type, opening_balance, supplier_opening_balance').eq('company_id', companyId).in('type', ['customer', 'supplier', 'both']);
                      // Fetch sub-ledger accounts
                      const { data: subAccounts } = await supabase.from('accounts').select('id, code, name, linked_contact_id').eq('company_id', companyId).eq('is_active', true).not('linked_contact_id', 'is', null);
                      const subMap = new Map<string, { id: string; code: string }>();
                      for (const a of (subAccounts || []) as any[]) subMap.set(a.linked_contact_id, { id: a.id, code: a.code });
                      // Fetch GL balances for all sub-ledger accounts
                      const subIds = (subAccounts || []).map((a: any) => a.id);
                      let glMap = new Map<string, number>();
                      if (subIds.length > 0) {
                        const { data: entries } = await supabase.from('journal_entries').select('id').eq('company_id', companyId).or('is_void.is.null,is_void.eq.false');
                        const jeIds = (entries || []).map((e: any) => e.id);
                        if (jeIds.length > 0) {
                          const { data: lines } = await supabase.from('journal_entry_lines').select('account_id, debit, credit').in('journal_entry_id', jeIds).in('account_id', subIds);
                          for (const l of (lines || []) as any[]) glMap.set(l.account_id, (glMap.get(l.account_id) || 0) + (Number(l.debit) || 0) - (Number(l.credit) || 0));
                        }
                      }
                      // Fetch sales data per customer
                      const { data: sales } = await supabase.from('sales').select('id, customer_id, total, paid_amount, due_amount, discount_amount, shipment_charges').eq('company_id', companyId).eq('status', 'final');
                      const salesByCustomer = new Map<string, { totalSales: number; totalPaid: number; totalDue: number }>();
                      for (const s of (sales || []) as any[]) {
                        if (!s.customer_id) continue;
                        const acc = salesByCustomer.get(s.customer_id) || { totalSales: 0, totalPaid: 0, totalDue: 0 };
                        acc.totalSales += Number(s.total) || 0;
                        acc.totalPaid += Number(s.paid_amount) || 0;
                        acc.totalDue += Number(s.due_amount) || 0;
                        salesByCustomer.set(s.customer_id, acc);
                      }
                      // Fetch returns per customer
                      const { data: returns } = await supabase.from('sale_returns').select('id, original_sale_id, total').eq('company_id', companyId).eq('status', 'final');
                      const saleCustomerMap = new Map<string, string>();
                      for (const s of (sales || []) as any[]) if (s.customer_id) saleCustomerMap.set(s.id, s.customer_id);
                      const returnsByCustomer = new Map<string, number>();
                      for (const r of (returns || []) as any[]) {
                        const custId = saleCustomerMap.get(r.original_sale_id);
                        if (custId) returnsByCustomer.set(custId, (returnsByCustomer.get(custId) || 0) + (Number(r.total) || 0));
                      }
                      // Build rows
                      const rows: typeof contactReconData extends (infer T)[] | null ? T[] : never[] = [];
                      for (const c of (contacts || []) as any[]) {
                        const isCustomer = c.type === 'customer' || c.type === 'both';
                        const opening = isCustomer ? (Number(c.opening_balance) || 0) : (Number(c.supplier_opening_balance) || 0);
                        const sd = salesByCustomer.get(c.id);
                        const salesDue = sd ? sd.totalDue : 0;
                        const totalReturns = returnsByCustomer.get(c.id) || 0;
                        const operational = Math.round((opening + salesDue - totalReturns) * 100) / 100;
                        const sub = subMap.get(c.id);
                        const glBal = sub ? Math.round((glMap.get(sub.id) || 0) * 100) / 100 : 0;
                        const diff = Math.round((operational - glBal) * 100) / 100;
                        rows.push({ name: c.name, code: c.code || '', type: c.type, opening, sales_due: salesDue, operational, gl_balance: glBal, diff, sub_account: sub?.code || 'NONE' });
                      }
                      rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
                      setContactReconData(rows);
                    } catch (e: any) { console.error('Contact recon failed:', e); }
                    setContactReconLoading(false);
                  }}
                  disabled={contactReconLoading || !companyId}
                >
                  {contactReconLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                  Run Contact Reconciliation
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (!companyId) return;
                    setContactReconLoading(true);
                    try {
                      const { openingBalanceJournalService } = await import('@/app/services/openingBalanceJournalService');
                      const result = await openingBalanceJournalService.syncAllContactOpeningBalances(companyId);
                      alert(`Synced ${result.synced} contacts, ${result.subledgersCreated} sub-ledgers, ${result.inventoryMovementsSynced} inventory. Errors: ${result.errors.length}`);
                    } catch (e: any) { alert('Sync failed: ' + e?.message); }
                    setContactReconLoading(false);
                  }}
                  disabled={contactReconLoading || !companyId}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Re-sync All Opening Balances
                </Button>
              </div>
              {contactReconData && (
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 overflow-auto max-h-[60vh]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-900 text-gray-500 uppercase">
                      <tr>
                        <th className="text-left p-2">Contact</th>
                        <th className="text-left p-2">Code</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Sub-Ledger</th>
                        <th className="text-right p-2">Opening</th>
                        <th className="text-right p-2">Sales Due</th>
                        <th className="text-right p-2">Operational</th>
                        <th className="text-right p-2">GL Balance</th>
                        <th className="text-right p-2">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactReconData.map((r, i) => (
                        <tr key={r.code + i} className={`border-t border-gray-800/50 ${Math.abs(r.diff) > 0.01 ? 'bg-red-950/30' : ''}`}>
                          <td className="p-2 text-white font-medium">{r.name}</td>
                          <td className="p-2 font-mono text-gray-500">{r.code}</td>
                          <td className="p-2 text-gray-400">{r.type}</td>
                          <td className="p-2 font-mono text-blue-400">{r.sub_account}</td>
                          <td className="p-2 text-right text-gray-400">{r.opening > 0 ? r.opening.toLocaleString() : '—'}</td>
                          <td className="p-2 text-right text-gray-400">{r.sales_due > 0 ? r.sales_due.toLocaleString() : '—'}</td>
                          <td className="p-2 text-right text-white">{r.operational.toLocaleString()}</td>
                          <td className="p-2 text-right text-amber-300">{r.gl_balance.toLocaleString()}</td>
                          <td className={`p-2 text-right font-bold ${Math.abs(r.diff) > 0.01 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {Math.abs(r.diff) > 0.01 ? r.diff.toLocaleString() : '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-2 text-xs text-gray-500 border-t border-gray-800">
                    {contactReconData.filter(r => Math.abs(r.diff) > 0.01).length} mismatches of {contactReconData.length} contacts
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={!!drawerJe} onOpenChange={(o) => !o && setDrawerJe(null)}>
        <SheetContent className="bg-gray-950 border-gray-800 w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white">Journal detail</SheetTitle>
            <SheetDescription>Evidence + rules; GL edits only via standard accounting flows.</SheetDescription>
          </SheetHeader>
          {drawerJe && (
            <div className="mt-4 space-y-3 text-sm">
              <pre className="text-xs bg-black/40 p-2 rounded overflow-x-auto text-gray-300">
                {JSON.stringify(
                  {
                    id: drawerJe.id,
                    entry_no: drawerJe.entry_no,
                    reference_type: drawerJe.reference_type,
                    reference_id: drawerJe.reference_id,
                    void: drawerJe.is_void,
                  },
                  null,
                  2
                )}
              </pre>
              <div>
                <div className="text-xs text-gray-500 mb-1">Rules (rollup)</div>
                <div className="flex flex-wrap gap-1">
                  {drawerRules.map((c) => (
                    <Badge key={c} variant="outline" className="font-mono text-[10px]">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
              {drawerSeverityReason ? (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Why this severity</div>
                  <p className="text-xs text-gray-300 whitespace-pre-wrap">{drawerSeverityReason}</p>
                </div>
              ) : null}
              {drawerHits.length > 0 ? (
                <div>
                  <div className="text-xs text-gray-500 mb-1">All hits (incl. ignored_for_lab_rollup)</div>
                  <ul className="text-xs space-y-1 text-gray-400 max-h-40 overflow-y-auto">
                    {drawerHits.map((h, i) => (
                      <li key={`${h.ruleId}-${i}`}>
                        <span className="font-mono text-violet-400">{h.ruleId}</span> [{h.severity}]
                        {h.ignoredForLabRollup ? <span className="text-slate-500"> · ignored_rollup</span> : null}: {h.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button size="sm" variant="outline" className="w-full border-gray-600" onClick={() => setCurrentView('ar-ap-reconciliation-center')}>
                Open Reconciliation Center
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
