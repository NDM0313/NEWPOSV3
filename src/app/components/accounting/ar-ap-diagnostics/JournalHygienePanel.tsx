/**
 * Journal hygiene — duplicate/orphan JE detection (embedded in AR/AP Diagnostics hub).
 * Void actions require canApplyDeveloperRepair; no Phase 8 AR/AP duplicate checks.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, FileWarning, Loader2, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { canApplyDeveloperRepair } from '@/app/lib/developerAccountingAccess';
import {
  getIntegritySummary,
  voidDuplicateGroup,
  voidJournalEntries,
  type DuplicateGroup,
  type OrphanEntry,
} from '@/app/services/accountingIntegrityService';
import { useAccounting } from '@/app/context/AccountingContext';
import { toast } from 'sonner';

async function copyToClipboard(text: string, okMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMessage);
  } catch {
    toast.error('Copy failed');
  }
}

export function JournalHygienePanel() {
  const { companyId, userRole } = useSupabase();
  const accounting = useAccounting();
  const canVoid = canApplyDeveloperRepair(userRole);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getIntegritySummary>> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setSummary(await getIntegritySummary(companyId));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load journal hygiene');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dupes = summary?.duplicateGroups ?? [];
  const orphans = summary?.orphanEntries ?? [];

  const handleVoidDuplicateGroup = async (g: DuplicateGroup) => {
    if (!companyId || !canVoid) return;
    setActionLoading(g.je_ids[0]);
    try {
      const res = await voidDuplicateGroup(companyId, g.je_ids, g.reference_type);
      if (res.success) {
        toast.success(`Voided ${res.voided} duplicate(s). Kept earliest.`);
        await load();
        accounting.refreshEntries?.();
      } else toast.error(res.error || 'Void failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVoidOrphan = async (e: OrphanEntry) => {
    if (!companyId || !canVoid) return;
    setActionLoading(e.id);
    try {
      const reason =
        e.reference_type === 'sale_adjustment'
          ? 'PF-14.5B orphan (sale deleted)'
          : 'PF-14.5B orphan (payment deleted)';
      const res = await voidJournalEntries(companyId, [e.id], reason);
      if (res.success) {
        toast.success('Orphan entry voided.');
        await load();
        accounting.refreshEntries?.();
      } else toast.error(res.error || 'Void failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-3 text-xs text-amber-100/90 flex gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
        <div>
          <p className="font-semibold">Journal hygiene</p>
          <p className="text-gray-400 mt-0.5">
            Duplicate and orphan journal entries. For AR/AP variance use <strong className="text-gray-300">Overview &amp; Queues</strong> or{' '}
            <strong className="text-gray-300">Tie-out</strong>. Account balance sync lives in Accounting Developer Center → Repair Queue.
          </p>
          {!canVoid && (
            <p className="text-amber-200/90 mt-1">Read-only — void requires admin/developer apply permission.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="border-gray-600" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-xs font-medium text-gray-400 uppercase">Duplicate groups</div>
          <div className="text-2xl font-bold text-white mt-1">{dupes.length}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-xs font-medium text-gray-400 uppercase">Orphan entries</div>
          <div className="text-2xl font-bold text-white mt-1">{orphans.length}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-xs font-medium text-gray-400 uppercase">Voided (audit)</div>
          <div className="text-2xl font-bold text-amber-400/90 mt-1">
            {summary?.voidedCountByType.reduce((s, t) => s + t.count, 0) ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2">
          <Copy className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-white">Exact duplicate candidates</h3>
        </div>
        {dupes.length === 0 ? (
          <p className="p-6 text-center text-gray-500 text-sm">No duplicate groups found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Count</th>
                  <th className="px-4 py-3">Journal IDs</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dupes.map((g) => (
                  <tr key={g.je_ids[0]} className="border-b border-gray-800/50">
                    <td className="px-4 py-3 font-mono text-xs">{g.reference_type}</td>
                    <td className="px-4 py-3 text-amber-400">{g.count}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-300 break-all">{g.je_ids.join(', ')}</td>
                    <td className="px-4 py-3">
                      {canVoid ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-700 text-amber-400"
                          onClick={() => void handleVoidDuplicateGroup(g)}
                          disabled={actionLoading !== null}
                        >
                          {actionLoading === g.je_ids[0] ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-1" /> Void duplicates
                            </>
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-white">Orphan / uncertain entries</h3>
        </div>
        {orphans.length === 0 ? (
          <p className="p-6 text-center text-gray-500 text-sm">No orphan entries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((o) => (
                  <tr key={o.id} className="border-b border-gray-800/50">
                    <td className="px-4 py-3 font-mono text-xs">{o.entry_no ?? o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs">{o.reference_type}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{o.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      {canVoid ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-amber-400"
                          onClick={() => void handleVoidOrphan(o)}
                          disabled={actionLoading !== null}
                        >
                          {actionLoading === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Void'}
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
