/**
 * PF-14.5B: Accounting Integrity Test Lab – duplicate/orphan diagnosis and safe void.
 * Business views exclude voided entries; this page shows candidates and allows void (no delete).
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Copy,
  Loader2,
  RefreshCw,
  FileWarning,
  Info,
  Trash2,
  FileSearch,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { canAccessDeveloperIntegrityLab } from '@/app/lib/developerAccountingAccess';
import {
  getIntegritySummary,
  voidDuplicateGroup,
  voidJournalEntries,
  type DuplicateGroup,
  type OrphanEntry,
} from '@/app/services/accountingIntegrityService';
import {
  getLiveDataRepairSummary,
  getUnbalancedJournalEntries,
  getAccountBalanceMismatches,
  syncAccountsBalanceFromJournal,
  getReceivablesReconciliation,
  getPayablesReconciliation,
  type UnbalancedJe,
  type AccountBalanceMismatch,
} from '@/app/services/liveDataRepairService';
import { useAccounting } from '@/app/context/AccountingContext';
import { toast } from 'sonner';

export type AccountingIntegrityTestLabProps = {
  /** Jump to Journal Entries (audit) with search text — e.g. journal UUID for full trace. */
  onOpenJournalTrace?: (searchFragment: string) => void;
};

async function copyToClipboard(text: string, okMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMessage);
  } catch {
    toast.error('Copy failed');
  }
}

function TraceIconButton({
  title,
  fragment,
  onOpenJournalTrace,
}: {
  title: string;
  fragment: string;
  onOpenJournalTrace?: (s: string) => void;
}) {
  if (!onOpenJournalTrace || !fragment.trim()) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-blue-400 hover:text-blue-300"
      title={title}
      onClick={() => onOpenJournalTrace(fragment.trim())}
    >
      <FileSearch className="h-3.5 w-3.5" />
    </Button>
  );
}

export function AccountingIntegrityTestLab({ onOpenJournalTrace }: AccountingIntegrityTestLabProps) {
  const { companyId, userRole } = useSupabase();
  const { setCurrentView } = useNavigation();
  const devLabAllowed = canAccessDeveloperIntegrityLab(userRole);
  const accounting = useAccounting();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    duplicateGroups: DuplicateGroup[];
    orphanEntries: OrphanEntry[];
    voidedCountByType: { reference_type: string; count: number }[];
    activeCountByType: { reference_type: string; count: number }[];
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [phase8Summary, setPhase8Summary] = useState<Awaited<ReturnType<typeof getLiveDataRepairSummary>> | null>(null);
  const [phase8Unbalanced, setPhase8Unbalanced] = useState<UnbalancedJe[]>([]);
  const [phase8Mismatches, setPhase8Mismatches] = useState<AccountBalanceMismatch[]>([]);
  const [phase8Recv, setPhase8Recv] = useState<Awaited<ReturnType<typeof getReceivablesReconciliation>> | null>(null);
  const [phase8Pay, setPhase8Pay] = useState<Awaited<ReturnType<typeof getPayablesReconciliation>> | null>(null);
  const [phase8Loading, setPhase8Loading] = useState(false);
  const [phase8SyncLoading, setPhase8SyncLoading] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const s = await getIntegritySummary(companyId);
      setSummary(s);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load integrity summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const loadPhase8 = async () => {
    if (!companyId) return;
    setPhase8Loading(true);
    try {
      const [summary, unbalanced, mismatches, recv, pay] = await Promise.all([
        getLiveDataRepairSummary(companyId),
        getUnbalancedJournalEntries(companyId),
        getAccountBalanceMismatches(companyId),
        getReceivablesReconciliation(companyId),
        getPayablesReconciliation(companyId),
      ]);
      setPhase8Summary(summary);
      setPhase8Unbalanced(unbalanced);
      setPhase8Mismatches(mismatches);
      setPhase8Recv(recv);
      setPhase8Pay(pay);
    } catch (e: any) {
      toast.error(e?.message || 'Phase 8 load failed');
    } finally {
      setPhase8Loading(false);
    }
  };

  const handleSyncAccountsBalance = async () => {
    if (!companyId) return;
    setPhase8SyncLoading(true);
    try {
      const { updated, errors } = await syncAccountsBalanceFromJournal(companyId);
      if (errors.length) toast.error(errors.slice(0, 3).join('; '));
      if (updated > 0) {
        toast.success(`Synced ${updated} account balance(s) from journal.`);
        await loadPhase8();
        accounting.refreshEntries?.();
      } else if (errors.length === 0) toast.info('No account mismatches to sync.');
    } catch (e: any) {
      toast.error(e?.message || 'Sync failed');
    } finally {
      setPhase8SyncLoading(false);
    }
  };

  const handleVoidDuplicateGroup = async (g: DuplicateGroup) => {
    if (!companyId) return;
    setActionLoading(g.je_ids[0]);
    try {
      const res = await voidDuplicateGroup(companyId, g.je_ids, g.reference_type);
      if (res.success) {
        toast.success(`Voided ${res.voided} duplicate(s). Kept earliest.`);
        await load();
        accounting.refreshEntries?.();
      } else {
        toast.error(res.error || 'Void failed');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleVoidOrphan = async (e: OrphanEntry) => {
    if (!companyId) return;
    setActionLoading(e.id);
    try {
      const reason = e.reference_type === 'sale_adjustment' ? 'PF-14.5B orphan (sale deleted)' : 'PF-14.5B orphan (payment deleted)';
      const res = await voidJournalEntries(companyId, [e.id], reason);
      if (res.success) {
        toast.success('Orphan entry voided.');
        await load();
        accounting.refreshEntries?.();
      } else {
        toast.error(res.error || 'Void failed');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleVoidAllOrphans = async () => {
    if (!companyId || !summary?.orphanEntries.length) return;
    setActionLoading('all_orphans');
    try {
      const saleOrphans = summary.orphanEntries.filter((o) => o.reference_type === 'sale_adjustment');
      const payOrphans = summary.orphanEntries.filter((o) => o.reference_type === 'payment_adjustment');
      let voided = 0;
      if (saleOrphans.length) {
        const r = await voidJournalEntries(companyId, saleOrphans.map((o) => o.id), 'PF-14.5B orphan (sale deleted)');
        if (r.success) voided += saleOrphans.length;
      }
      if (payOrphans.length) {
        const r = await voidJournalEntries(companyId, payOrphans.map((o) => o.id), 'PF-14.5B orphan (payment deleted)');
        if (r.success) voided += payOrphans.length;
      }
      toast.success(`Voided ${voided} orphan(s).`);
      await load();
      accounting.refreshEntries?.();
    } finally {
      setActionLoading(null);
    }
  };

  if (!companyId) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-gray-400">
        Select a company first.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const dupes = summary?.duplicateGroups ?? [];
  const orphans = summary?.orphanEntries ?? [];

  return (
    <div className="space-y-6 max-w-[1600px]">
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
        <p className="text-sm text-gray-300 leading-relaxed">
          <span className="font-medium text-white">Yeh tab kis liye hai:</span> yahan sirf <span className="text-amber-200/90">tez diagnosis</span> hai —
          duplicate journal groups, orphan adjustments (jahan sale/payment delete ho chuka lekin JE zinda ho), aur Phase 8 live mismatch signals.
          Void <span className="text-gray-400">safe audit trail</span> ke sath hota hai; delete nahi.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-400">Poori tracing / developer tools alag hain:</span>{' '}
          Sidebar → <span className="text-gray-400">Accounting Integrity Lab</span> (Phase 2 QA, zyada checks){devLabAllowed ? ', aur Developer Integrity Lab (RULE scan, fix queue).' : '.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-200"
            onClick={() => setCurrentView('accounting-integrity-lab')}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Accounting Integrity Lab (full)
          </Button>
          {devLabAllowed && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-violet-700/50 text-violet-200"
              onClick={() => setCurrentView('developer-integrity-lab')}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Developer Integrity Lab
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">Accounting Integrity Test Lab</h2>
            <p className="text-xs text-gray-400">
              PF-14.5B: duplicates & orphans; void safely. Neeche har row par poora ID + copy; journal trace icon se Journal Entries (audit) filter.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 shrink-0" onClick={load} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Duplicate groups</div>
          <div className="text-2xl font-bold text-white mt-1">{dupes.length}</div>
          <div className="text-xs text-gray-500 mt-1">Same ref + description, count &gt; 1</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Orphan entries</div>
          <div className="text-2xl font-bold text-white mt-1">{orphans.length}</div>
          <div className="text-xs text-gray-500 mt-1">Missing sale/payment link</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Voided (audit)</div>
          <div className="text-2xl font-bold text-amber-400/90 mt-1">
            {summary?.voidedCountByType.reduce((s, t) => s + t.count, 0) ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">Excluded from business views</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 min-w-0 sm:col-span-2 lg:col-span-1">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Active JEs by type</div>
          <div className="text-[11px] text-gray-300 mt-1 max-h-28 overflow-y-auto leading-snug space-y-0.5 font-mono">
            {summary?.activeCountByType.length
              ? summary.activeCountByType.map((t) => (
                  <div key={t.reference_type} className="flex justify-between gap-2 border-b border-gray-800/40 pb-0.5">
                    <span className="text-gray-400 truncate">{t.reference_type}</span>
                    <span className="text-white shrink-0">{t.count}</span>
                  </div>
                ))
              : '—'}
          </div>
        </div>
      </div>

      {/* 1. Exact duplicate candidates */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Exact duplicate candidates</h3>
          </div>
          <p className="text-xs text-gray-400">Keep earliest; void rest. No delete.</p>
        </div>
        <div className="overflow-x-auto">
          {dupes.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">No duplicate groups found.</div>
          ) : (
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-4 py-3 w-[100px]">Type</th>
                  <th className="px-4 py-3 min-w-[200px]">Root / doc ID</th>
                  <th className="px-4 py-3 min-w-[220px]">Journal IDs (group)</th>
                  <th className="px-4 py-3 min-w-[160px]">Description</th>
                  <th className="px-4 py-3">Count</th>
                  <th className="px-4 py-3">Earliest</th>
                  <th className="px-4 py-3 w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dupes.map((g) => (
                  <tr key={g.je_ids[0]} className="border-b border-gray-800/50 hover:bg-gray-800/30 align-top">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{g.reference_type}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1 min-w-0">
                        <span className="font-mono text-[11px] text-gray-200 break-all">{g.root_id || '—'}</span>
                        {g.root_id ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Copy root ID"
                            onClick={() => copyToClipboard(g.root_id, 'Root ID copied')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <TraceIconButton title="Journal: filter by root id" fragment={g.root_id} onOpenJournalTrace={onOpenJournalTrace} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1 min-w-0">
                        <span className="font-mono text-[11px] text-gray-300 break-all">{g.je_ids.join(', ')}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          title="Copy all journal IDs"
                          onClick={() => copyToClipboard(g.je_ids.join('\n'), 'Journal IDs copied')}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <TraceIconButton title="Journal: first JE in group" fragment={g.je_ids[0] || ''} onOpenJournalTrace={onOpenJournalTrace} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs break-words" title={g.description}>
                      {g.description}
                    </td>
                    <td className="px-4 py-3 text-amber-400 whitespace-nowrap">{g.count}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{g.earliest_created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-700 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => handleVoidDuplicateGroup(g)}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === g.je_ids[0] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                        Void duplicates
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 2. Orphan / uncertain entries */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-white">Orphan / uncertain entries</h3>
          </div>
          {orphans.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-700 text-amber-400"
              onClick={handleVoidAllOrphans}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'all_orphans' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Void all orphans
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          {orphans.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">No orphan entries found.</div>
          ) : (
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-4 py-3">Entry no</th>
                  <th className="px-4 py-3">JE id</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 min-w-[200px]">Reference ID</th>
                  <th className="px-4 py-3 min-w-[160px]">Description</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((o) => (
                  <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 align-top">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{o.entry_no ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1 min-w-0">
                        <span className="font-mono text-[11px] text-gray-200 break-all">{o.id}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          title="Copy JE id"
                          onClick={() => copyToClipboard(o.id, 'Journal entry id copied')}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <TraceIconButton title="Journal: filter by JE id" fragment={o.id} onOpenJournalTrace={onOpenJournalTrace} />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{o.reference_type}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1 min-w-0">
                        <span className="font-mono text-[11px] text-gray-300 break-all">{o.reference_id ?? '—'}</span>
                        {o.reference_id ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Copy reference id"
                            onClick={() => copyToClipboard(o.reference_id!, 'Reference id copied')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <TraceIconButton title="Journal: filter by reference id" fragment={o.reference_id || ''} onOpenJournalTrace={onOpenJournalTrace} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs break-words">{o.description ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{o.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-amber-400 hover:bg-amber-500/10"
                        onClick={() => handleVoidOrphan(o)}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Void'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Phase 8 – Live data repair (detection + safe sync) */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <span className="font-medium text-white">Phase 8 – Live data repair</span>
          <Button
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300"
            onClick={loadPhase8}
            disabled={!companyId || phase8Loading}
          >
            {phase8Loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw size={14} />}
            Load detection
          </Button>
        </div>
        <div className="p-4 space-y-4">
          {phase8Summary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <div className="rounded-lg bg-gray-800/50 p-2">
                <p className="text-gray-500">TB difference</p>
                <p className={phase8Summary.trialBalanceDifference === 0 ? 'text-green-400' : 'text-amber-400'}>{phase8Summary.trialBalanceDifference}</p>
              </div>
              <div className="rounded-lg bg-gray-800/50 p-2">
                <p className="text-gray-500">Unbalanced JEs</p>
                <p className={phase8Summary.unbalancedCount === 0 ? 'text-green-400' : 'text-amber-400'}>{phase8Summary.unbalancedCount}</p>
              </div>
              <div className="rounded-lg bg-gray-800/50 p-2">
                <p className="text-gray-500">Account mismatches</p>
                <p className={phase8Summary.accountMismatchCount === 0 ? 'text-green-400' : 'text-amber-400'}>{phase8Summary.accountMismatchCount}</p>
              </div>
              <div className="rounded-lg bg-gray-800/50 p-2">
                <p className="text-gray-500">AR vs receivables</p>
                <p className={phase8Summary.receivablesDifference === 0 ? 'text-green-400' : 'text-amber-400'}>{phase8Summary.receivablesDifference}</p>
              </div>
              <div className="rounded-lg bg-gray-800/50 p-2">
                <p className="text-gray-500">AP vs payables</p>
                <p className={phase8Summary.payablesDifference === 0 ? 'text-green-400' : 'text-amber-400'}>{phase8Summary.payablesDifference}</p>
              </div>
            </div>
          )}
          {phase8Unbalanced.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-gray-400 text-sm font-medium mb-2">Unbalanced journal entries (review manually)</p>
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-1 pr-2">Entry</th>
                    <th className="pb-1 min-w-[200px]">JE id (copy / journal)</th>
                    <th className="pb-1">Debit</th>
                    <th className="pb-1">Credit</th>
                    <th className="pb-1">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {phase8Unbalanced.slice(0, 10).map((u) => (
                    <tr key={u.id} className="border-t border-gray-800/50 align-top">
                      <td className="py-1 font-mono whitespace-nowrap pr-2">{u.entry_no ?? '—'}</td>
                      <td className="py-1">
                        <div className="flex items-start gap-1 min-w-0">
                          <span className="font-mono text-[11px] break-all text-gray-300">{u.id}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Copy JE id"
                            onClick={() => copyToClipboard(u.id, 'JE id copied')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <TraceIconButton title="Journal: filter by JE id" fragment={u.id} onOpenJournalTrace={onOpenJournalTrace} />
                        </div>
                      </td>
                      <td className="py-1 whitespace-nowrap">{u.sum_debit}</td>
                      <td className="py-1 whitespace-nowrap">{u.sum_credit}</td>
                      <td className="py-1 text-amber-400 whitespace-nowrap">{u.difference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {phase8Unbalanced.length > 10 && <p className="text-gray-500 text-xs mt-1">+{phase8Unbalanced.length - 10} more</p>}
            </div>
          )}
          {phase8Mismatches.length > 0 && (
            <div>
              <p className="text-gray-400 text-sm font-medium mb-2">Account balance vs journal (safe repair: sync from journal)</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500"><th className="pb-1">Account</th><th className="pb-1">Stored</th><th className="pb-1">Journal</th><th className="pb-1">Diff</th></tr></thead>
                <tbody>
                  {phase8Mismatches.slice(0, 10).map((m) => (
                    <tr key={m.account_id} className="border-t border-gray-800/50"><td className="py-1">{m.account_code} {m.account_name}</td><td>{m.stored_balance}</td><td>{m.journal_balance}</td><td className="text-amber-400">{m.difference}</td></tr>
                  ))}
                </tbody>
              </table>
              <Button size="sm" variant="outline" className="mt-2 border-amber-500/50 text-amber-400" onClick={handleSyncAccountsBalance} disabled={phase8SyncLoading}>
                {phase8SyncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sync account balances from journal'}
              </Button>
            </div>
          )}
          {phase8Recv != null && (
            <p className="text-gray-400 text-sm">Receivables: document due = {phase8Recv.document_total_due}, AR (journal) = {phase8Recv.ar_balance_from_journal}, difference = {phase8Recv.difference}</p>
          )}
          {phase8Pay != null && (
            <p className="text-gray-400 text-sm">Payables: document due = {phase8Pay.document_total_due}, AP (journal) = {phase8Pay.ap_balance_from_journal}, difference = {phase8Pay.difference}</p>
          )}
        </div>
      </div>

      {/* Ledger impact note */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-400">
          <p className="font-medium text-gray-300">Ledger impact</p>
          <p className="mt-1">Voided entries are excluded from Journal Entries, Day Book, Account Ledger, and running balances. They remain in the database for audit. After voiding, refresh the main accounting views to see corrected totals.</p>
        </div>
      </div>
    </div>
  );
}

export default AccountingIntegrityTestLab;
