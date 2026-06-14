/**
 * Journal hygiene — duplicate/orphan JE detection (embedded in AR/AP Diagnostics hub).
 * Void actions require canApplyDeveloperRepair; no Phase 8 AR/AP duplicate checks.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, FileWarning, Loader2, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { canApplyDeveloperRepair } from '@/app/lib/developerAccountingAccess';
import {
  getActiveCorrectionReversalReview,
  getIntegritySummary,
  getVoidedJournalAuditBrowse,
  voidDuplicateGroup,
  voidJournalEntries,
  voidStaleCorrectionReversals,
  type ActiveCorrectionReversalReviewRow,
  type DuplicateGroup,
  type OrphanEntry,
  type StaleCorrectionReversalCandidate,
  type VoidedJournalAuditRow,
} from '@/app/services/accountingIntegrityService';
import {
  STALE_REVERSAL_VOID_LABEL,
  staleCorrectionReversalVoidConfirmMessage,
} from '@/app/lib/staleCorrectionReversalPolicy';
import { useAccounting } from '@/app/context/AccountingContext';
import { TransactionDetailModal } from '@/app/components/accounting/TransactionDetailModal';
import { toast } from 'sonner';
import { cn } from '@/app/components/ui/utils';

const VOIDED_PAGE_SIZE = 500;

function HygieneScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
      {children}
    </div>
  );
}

function HygieneTable({ children, minWidth = 960 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <table className="text-sm w-max min-w-full" style={{ minWidth }}>
      {children}
    </table>
  );
}

function CollapsibleHygieneSection(props: {
  title: string;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  borderClass?: string;
  bgClass?: string;
  children: React.ReactNode;
}) {
  const { title, subtitle, icon, count, expanded, onToggle, borderClass, bgClass, children } = props;
  return (
    <div className={cn('rounded-xl border', borderClass ?? 'border-gray-800', bgClass ?? 'bg-gray-900/50')}>
      <button
        type="button"
        className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-gray-900/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-2 min-w-0">
          {icon}
          <div className="min-w-0">
            <h3 className="font-semibold text-white">{title}</h3>
            {subtitle ? <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-gray-400">
          <span className="text-sm font-mono">{count}</span>
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>
      {expanded ? <div className="border-t border-gray-800/80">{children}</div> : null}
    </div>
  );
}

function ClickableRow(props: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <tr
      className={cn('border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/40 transition-colors', props.className)}
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onClick();
        }
      }}
      tabIndex={0}
      role="button"
    >
      {props.children}
    </tr>
  );
}

export function JournalHygienePanel() {
  const { companyId, userRole } = useSupabase();
  const accounting = useAccounting();
  const canVoid = canApplyDeveloperRepair(userRole);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getIntegritySummary>> | null>(null);
  const [voidedHistory, setVoidedHistory] = useState<VoidedJournalAuditRow[]>([]);
  const [voidedTotal, setVoidedTotal] = useState(0);
  const [correctionReview, setCorrectionReview] = useState<ActiveCorrectionReversalReviewRow[]>([]);
  const [voidedHistoryExpanded, setVoidedHistoryExpanded] = useState(true);
  const [dupesExpanded, setDupesExpanded] = useState(false);
  const [staleExpanded, setStaleExpanded] = useState(false);
  const [orphansExpanded, setOrphansExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRef, setDetailRef] = useState('');
  const [detailJeHint, setDetailJeHint] = useState<string | undefined>();

  const dupes = summary?.duplicateGroups ?? [];
  const orphans = summary?.orphanEntries ?? [];
  const staleReversals = summary?.staleCorrectionReversals ?? [];
  const voidedStatTotal = summary?.voidedCountByType.reduce((s, t) => s + t.count, 0) ?? 0;
  const needsActionTotal = dupes.length + orphans.length + staleReversals.length;

  const openTransactionDetail = useCallback((row: { id: string; entry_no?: string | null }) => {
    setDetailJeHint(row.id);
    setDetailRef(row.entry_no || row.id);
    setDetailOpen(true);
  }, []);

  const loadVoidedBrowse = useCallback(
    async (totalHint: number, append = false, existing: VoidedJournalAuditRow[] = []) => {
      if (!companyId) return;
      const offset = append ? existing.length : 0;
      const remaining = Math.max(totalHint - offset, 0);
      const limit = append
        ? Math.min(remaining, VOIDED_PAGE_SIZE)
        : Math.min(Math.max(totalHint, 1), VOIDED_PAGE_SIZE);
      if (limit <= 0) {
        setVoidedTotal(totalHint);
        if (!append) setVoidedHistory([]);
        return;
      }
      const browse = await getVoidedJournalAuditBrowse(companyId, { limit, offset });
      if (browse.error) {
        toast.error(browse.error);
        return;
      }
      setVoidedTotal(browse.total);
      setVoidedHistory(append ? [...existing, ...browse.rows] : browse.rows);
    },
    [companyId]
  );

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const s = await getIntegritySummary(companyId);
      setSummary(s);
      const actionable =
        s.duplicateGroups.length + s.orphanEntries.length + s.staleCorrectionReversals.length;
      const voided = s.voidedCountByType.reduce((sum, t) => sum + t.count, 0);

      setDupesExpanded(s.duplicateGroups.length > 0);
      setStaleExpanded(s.staleCorrectionReversals.length > 0);
      setOrphansExpanded(s.orphanEntries.length > 0);
      setVoidedHistoryExpanded(voided > 0 && actionable === 0);

      const [review] = await Promise.all([
        getActiveCorrectionReversalReview(companyId),
        loadVoidedBrowse(voided, false),
      ]);
      setCorrectionReview(review);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load journal hygiene');
    } finally {
      setLoading(false);
    }
  }, [companyId, loadVoidedBrowse]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const handleVoidStaleReversal = async (e: StaleCorrectionReversalCandidate) => {
    if (!companyId || !canVoid) return;
    if (!window.confirm(staleCorrectionReversalVoidConfirmMessage(e.entry_no, e.amount))) return;
    setActionLoading(e.id);
    try {
      const res = await voidStaleCorrectionReversals(companyId, [e.id], e.voidReasonSuggested);
      if (res.success) {
        toast.success('Reversal removed from live GL.');
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

  const handleLoadMoreVoided = async () => {
    setLoading(true);
    try {
      await loadVoidedBrowse(voidedTotal, true, voidedHistory);
    } finally {
      setLoading(false);
    }
  };

  const needsActionBanner = useMemo(() => {
    if (needsActionTotal === 0) {
      return (
        <p className="text-sm text-emerald-300/90 font-medium">
          All clear — no duplicates, orphans, or stale reversals need review.
        </p>
      );
    }
    return (
      <p className="text-sm text-amber-200/90 font-medium">
        Total needing review: <span className="text-white">{needsActionTotal}</span>
      </p>
    );
  }, [needsActionTotal]);

  const voidedFooterLabel = useMemo(() => {
    if (voidedTotal === 0) return null;
    if (voidedHistory.length >= voidedTotal) {
      return `Showing all ${voidedTotal} of ${voidedTotal} voided entries.`;
    }
    return `Showing ${voidedHistory.length} of ${voidedTotal} voided entries.`;
  }, [voidedHistory.length, voidedTotal]);

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
            Only <strong className="text-gray-300">Duplicates</strong>, <strong className="text-gray-300">Stale reversals</strong>, and{' '}
            <strong className="text-gray-300">Orphans</strong> below are actionable.{' '}
            <strong className="text-gray-300">Voided history</strong> is browse-only (already cancelled — not a fix queue).
          </p>
          {!canVoid && (
            <p className="text-amber-200/90 mt-1">Read-only — void requires admin/developer apply permission.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {needsActionBanner}
        <Button variant="outline" size="sm" className="border-gray-600" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Needs action</p>
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
            <div className="text-xs font-medium text-gray-400 uppercase">Stale reversals</div>
            <div className="text-2xl font-bold text-rose-400/90 mt-1">{staleReversals.length}</div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Audit reference</p>
        <div className="rounded-xl border border-gray-700/60 bg-gray-950/40 p-4 max-w-xs">
          <div className="text-xs font-medium text-gray-400 uppercase">Voided history (info)</div>
          <div className="text-2xl font-bold text-gray-300 mt-1">{voidedStatTotal}</div>
          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
            Not actionable — already cancelled. Browse in the section below.
          </p>
        </div>
      </div>

      <CollapsibleHygieneSection
        title="Exact duplicate candidates"
        icon={<Copy className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}
        count={dupes.length}
        expanded={dupesExpanded}
        onToggle={() => setDupesExpanded((v) => !v)}
      >
        {dupes.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm space-y-1">
            <p>No duplicate groups found.</p>
            <p className="text-xs text-gray-600">
              Scanned active <code className="text-gray-500">sale_adjustment</code> and{' '}
              <code className="text-gray-500">payment_adjustment</code> only — PF-14.5B scope.
            </p>
          </div>
        ) : (
          <HygieneScrollTable>
            <HygieneTable minWidth={720}>
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-4 py-3 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 whitespace-nowrap">Count</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[12rem]">Journal IDs</th>
                  <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dupes.map((g) => (
                  <tr key={g.je_ids[0]} className="border-b border-gray-800/50">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{g.reference_type}</td>
                    <td className="px-4 py-3 text-amber-400 whitespace-nowrap">{g.count}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-300 min-w-[12rem] max-w-[24rem] whitespace-normal break-words">
                      {g.je_ids.join(', ')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
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
            </HygieneTable>
          </HygieneScrollTable>
        )}
      </CollapsibleHygieneSection>

      <CollapsibleHygieneSection
        title="Stale payment reversals"
        subtitle={
          <>
            Active <code className="text-rose-200/80">correction_reversal</code> after payment/source already void — shows on Cash &amp; Trial Balance.{' '}
            <span className="text-gray-500">Urdu: void payment ke baad reversal zinda reh jati hai; yahan se live GL se hataen (soft void).</span>
          </>
        }
        icon={<Trash2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
        count={staleReversals.length}
        expanded={staleExpanded}
        onToggle={() => setStaleExpanded((v) => !v)}
        borderClass="border-rose-900/40"
        bgClass="bg-rose-950/10"
      >
        {staleReversals.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm space-y-1">
            <p>No stale reversal entries — good.</p>
            <p className="text-xs text-gray-600">
              If a payment was voided but its reversal still appears on Cash/Trial Balance, it will show here with{' '}
              <strong className="text-gray-500">{STALE_REVERSAL_VOID_LABEL}</strong>.
            </p>
          </div>
        ) : (
          <HygieneScrollTable>
            <HygieneTable minWidth={960}>
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-4 py-3 whitespace-nowrap sticky left-0 bg-gray-950/95 z-10">Entry</th>
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[10rem]">Payment / source</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[12rem]">Description</th>
                  <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staleReversals.map((e) => (
                  <ClickableRow key={e.id} onClick={() => openTransactionDetail(e)}>
                    <td className="px-4 py-3 font-mono text-xs text-rose-200 whitespace-nowrap sticky left-0 bg-gray-950/95 z-10">
                      {e.entry_no ?? e.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{e.entry_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">{e.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-gray-300 min-w-[10rem] whitespace-normal break-words">
                      {e.paymentRef ?? '—'}
                      {e.sourceEntryNo ? ` · src ${e.sourceEntryNo}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 min-w-[12rem] max-w-[24rem] whitespace-normal break-words">
                      {e.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                      {canVoid ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-rose-700 text-rose-300"
                          onClick={() => void handleVoidStaleReversal(e)}
                          disabled={actionLoading !== null}
                        >
                          {actionLoading === e.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            STALE_REVERSAL_VOID_LABEL
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-500">Admin only</span>
                      )}
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </HygieneTable>
          </HygieneScrollTable>
        )}

        <div className="border-t border-rose-900/20 px-4 py-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Active correction reversals (review)</p>
          {correctionReview.length === 0 ? (
            <p className="text-xs text-gray-500">No active correction reversals in GL.</p>
          ) : (
            <HygieneScrollTable>
              <HygieneTable minWidth={960}>
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="px-4 py-2 whitespace-nowrap sticky left-0 bg-gray-950/95 z-10">Entry</th>
                    <th className="px-4 py-2 whitespace-nowrap">Date</th>
                    <th className="px-4 py-2 whitespace-nowrap">Amount</th>
                    <th className="px-4 py-2 whitespace-nowrap min-w-[12rem]">Payment / source</th>
                    <th className="px-4 py-2 whitespace-nowrap min-w-[14rem]">Eligibility</th>
                  </tr>
                </thead>
                <tbody>
                  {correctionReview.map((row) => (
                    <ClickableRow key={row.id} onClick={() => openTransactionDetail(row)}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-300 whitespace-nowrap sticky left-0 bg-gray-950/95 z-10">
                        {row.entry_no ?? row.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{row.entry_date?.slice(0, 10) ?? '—'}</td>
                      <td className="px-4 py-2 text-xs font-mono whitespace-nowrap">{row.amount.toFixed(2)}</td>
                      <td className="px-4 py-2 text-xs text-gray-400 min-w-[12rem] whitespace-normal break-words">{row.sourceStatus}</td>
                      <td
                        className={cn(
                          'px-4 py-2 text-xs min-w-[14rem] max-w-[24rem] whitespace-normal break-words',
                          row.eligibilityStatus === 'eligible' ? 'text-emerald-400/90' : 'text-gray-500'
                        )}
                      >
                        {row.eligibilityLabel}
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </HygieneTable>
            </HygieneScrollTable>
          )}
        </div>
      </CollapsibleHygieneSection>

      <CollapsibleHygieneSection
        title="Orphan / uncertain entries"
        icon={<FileWarning className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
        count={orphans.length}
        expanded={orphansExpanded}
        onToggle={() => setOrphansExpanded((v) => !v)}
      >
        {orphans.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm space-y-1">
            <p>No orphan entries found.</p>
            <p className="text-xs text-gray-600">
              Orphans are active adjustment JEs whose linked sale or payment no longer exists.
            </p>
          </div>
        ) : (
          <HygieneScrollTable>
            <HygieneTable minWidth={720}>
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-4 py-3 whitespace-nowrap sticky left-0 bg-gray-950/95 z-10">Entry</th>
                  <th className="px-4 py-3 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[12rem]">Description</th>
                  <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((o) => (
                  <ClickableRow key={o.id} onClick={() => openTransactionDetail(o)}>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap sticky left-0 bg-gray-950/95 z-10">
                      {o.entry_no ?? o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{o.reference_type}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 min-w-[12rem] max-w-[24rem] whitespace-normal break-words">
                      {o.description ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
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
                  </ClickableRow>
                ))}
              </tbody>
            </HygieneTable>
          </HygieneScrollTable>
        )}
      </CollapsibleHygieneSection>

      <div className="rounded-xl border border-gray-700/50 bg-gray-950/30">
        <button
          type="button"
          className="w-full p-4 flex items-center justify-between gap-2 text-left hover:bg-gray-900/40 transition-colors"
          onClick={() => setVoidedHistoryExpanded((v) => !v)}
        >
          <div>
            <h3 className="font-semibold text-gray-200">Voided history (audit)</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {voidedStatTotal} cancelled journal(s) — read-only. Removed from live GL; Day Book Audit mode shows full trail.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-gray-400">
            <span className="text-sm font-mono">
              {voidedHistory.length}
              {voidedTotal > voidedHistory.length ? '+' : ''}
            </span>
            {voidedHistoryExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>
        {voidedHistoryExpanded && (
          <div className="border-t border-gray-800">
            {voidedHistory.length === 0 ? (
              <p className="p-6 text-center text-gray-500 text-sm">No voided journals in browse window.</p>
            ) : (
              <HygieneScrollTable>
                <HygieneTable minWidth={1024}>
                  <thead>
                    <tr className="border-b border-gray-800 text-left text-gray-500">
                      <th className="px-4 py-3 whitespace-nowrap sticky left-0 bg-gray-950/95 z-10">Entry</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 whitespace-nowrap">Type</th>
                      <th className="px-4 py-3 whitespace-nowrap">Voided at</th>
                      <th className="px-4 py-3 whitespace-nowrap min-w-[14rem]">Void reason</th>
                      <th className="px-4 py-3 whitespace-nowrap min-w-[14rem]">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voidedHistory.map((row) => (
                      <ClickableRow key={row.id} onClick={() => openTransactionDetail(row)}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-300 whitespace-nowrap sticky left-0 bg-gray-950/95 z-10">
                          {row.entry_no ?? row.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{row.entry_date?.slice(0, 10) ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{row.reference_type ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {row.voided_at ? row.voided_at.slice(0, 10) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 min-w-[14rem] max-w-[28rem] whitespace-normal break-words">
                          {row.void_reason ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 min-w-[14rem] max-w-[28rem] whitespace-normal break-words">
                          {row.description ?? '—'}
                        </td>
                      </ClickableRow>
                    ))}
                  </tbody>
                </HygieneTable>
              </HygieneScrollTable>
            )}
            {voidedFooterLabel ? (
              <div className="px-4 py-2 text-[11px] text-gray-600 border-t border-gray-800/60 flex flex-wrap items-center justify-between gap-2">
                <span>{voidedFooterLabel}</span>
                {voidedTotal > voidedHistory.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-gray-400"
                    onClick={() => void handleLoadMoreVoided()}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    Load more
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <TransactionDetailModal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailJeHint(undefined);
        }}
        referenceNumber={detailRef}
        journalEntryIdHint={detailJeHint}
      />
    </div>
  );
}
