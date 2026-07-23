import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Info, Loader2, Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useNavigation } from '@/app/context/NavigationContext';
import { markOpenArApHybridRepair } from '@/app/lib/arApHybridRepairNav';
import {
  fetchGlCorrectionResolveSnapshot,
  type GlCorrectionResolveSnapshot,
} from '@/app/lib/glCorrectionResolveStatus';
import {
  fetchReceivablesVarianceBreakdown,
  type ReceivablesVarianceBreakdown,
} from '@/app/services/arApVarianceBreakdownService';

type Props = {
  companyId: string | null;
  branchId: string | null | undefined;
  asOfDate: string;
  varianceTotal: number | null;
  formatCurrency: (n: number) => string;
  onTraceJournal: (journalEntryId: string) => void;
  onOpenSale?: (saleId: string, invoiceNo?: string) => void;
  onGoToUnpostedOrders?: () => void;
  onOpenPartyLedger?: (contactId: string, contactName: string) => void;
  onGoToFinancialTrace?: () => void;
  refreshToken?: number;
};

export function ReceivablesVarianceBreakdownPanel({
  companyId,
  branchId,
  asOfDate,
  varianceTotal,
  formatCurrency,
  onTraceJournal,
  onOpenSale,
  onGoToUnpostedOrders,
  onOpenPartyLedger,
  onGoToFinancialTrace,
  refreshToken = 0,
}: Props) {
  const { setCurrentView } = useNavigation();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<ReceivablesVarianceBreakdown | null>(null);
  const [resolveSnapshot, setResolveSnapshot] = useState<GlCorrectionResolveSnapshot | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await fetchReceivablesVarianceBreakdown(companyId, branchId, asOfDate);
      setBreakdown(data);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, asOfDate]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    if (!companyId) {
      setResolveSnapshot(null);
      return;
    }
    let cancelled = false;
    void fetchGlCorrectionResolveSnapshot(companyId, branchId).then((snap) => {
      if (!cancelled) setResolveSnapshot(snap);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, refreshToken]);

  const openHybridRepair = () => {
    markOpenArApHybridRepair();
    setCurrentView('ar-ap-reconciliation-center');
  };

  const residual = breakdown?.buckets.find((b) => b.key === 'residual_unexplained');
  const showResidualWarn = residual != null && Math.abs(residual.amount) >= 0.02;

  const varianceAbs = Math.abs(breakdown?.varianceTotal ?? varianceTotal ?? 0);
  const glCorrectionsClear = resolveSnapshot != null && resolveSnapshot.openGlCorrectionCount === 0;
  const isFullyReconciled = glCorrectionsClear && varianceAbs < 1.01 && !showResidualWarn;
  const isDocumentedResidual =
    resolveSnapshot?.hqSlApplied === true &&
    resolveSnapshot.openGlCorrectionCount === 0 &&
    varianceAbs >= 0.5 &&
    varianceAbs <= 1.5;

  const borderTone = isFullyReconciled
    ? 'border-emerald-500/30 bg-emerald-950/15'
    : 'border-amber-500/30 bg-amber-950/15';

  const orderAdvanceTotal = useMemo(() => {
    if (!breakdown?.negativeClampedContacts.length) return 0;
    return breakdown.negativeClampedContacts.reduce((sum, c) => {
      if (!c.linkedUnpostedSales.length) return sum;
      return sum + c.clampedLoss;
    }, 0);
  }, [breakdown?.negativeClampedContacts]);

  const hasOrderAdvanceLinks = useMemo(
    () => breakdown?.negativeClampedContacts.some((c) => c.linkedUnpostedSales.length > 0) ?? false,
    [breakdown?.negativeClampedContacts]
  );

  const unmapped1100 = breakdown?.buckets.find((b) => b.key === 'unmapped_control_1100')?.amount ?? 0;
  const subtreeGap = breakdown?.buckets.find((b) => b.key === 'subtree_scope_gap')?.amount ?? 0;
  const structural1100NetsZero =
    breakdown?.ok === true &&
    Math.abs(unmapped1100 + subtreeGap) < 1 &&
    (Math.abs(unmapped1100) >= 0.01 || Math.abs(subtreeGap) >= 0.01);

  const isLikelyWalkInResidual = (contactName: string, clampedLoss: number) => {
    const walkIn = /walk-in/i.test(contactName);
    const nearOneFifty = clampedLoss >= 140 && clampedLoss <= 160;
    return walkIn && nearOneFifty && resolveSnapshot?.hqSlApplied === true;
  };

  return (
    <div id="receivables-variance-breakdown" className={cn('rounded-xl border scroll-mt-4', borderTone)}>
      <button
        type="button"
        className={cn(
          'w-full flex items-center justify-between gap-3 p-4 text-left',
          isFullyReconciled ? 'hover:bg-emerald-950/25' : 'hover:bg-amber-950/25'
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <h3 className={cn('text-sm font-semibold', isFullyReconciled ? 'text-emerald-100' : 'text-amber-100')}>
            Receivables variance breakdown
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Explains Operational − GL raw gap
            {varianceTotal != null ? ` (${formatCurrency(varianceTotal)})` : ''}
            {resolveSnapshot && resolveSnapshot.openGlCorrectionCount > 0
              ? ` · ${resolveSnapshot.openGlCorrectionCount} GL repair(s) pending`
              : null}
          </p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open ? (
        <div
          className={cn(
            'px-4 pb-4 space-y-3 border-t',
            isFullyReconciled ? 'border-emerald-500/20' : 'border-amber-500/20'
          )}
        >
          {isFullyReconciled ? (
            <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/30 p-3 text-xs text-emerald-100/90 flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <p>
                GL corrections applied and variance reconciled. Contacts GL roll-up should match after refresh.
                {resolveSnapshot?.hqSlEntryNo ? (
                  <span className="block text-muted-foreground mt-1 font-mono">HQ-SL fix: {resolveSnapshot.hqSlEntryNo}</span>
                ) : null}
              </p>
            </div>
          ) : null}

          {isDocumentedResidual && !isFullyReconciled ? (
            <div className="rounded-lg border border-blue-600/40 bg-primary/10 p-3 text-xs text-primary dark:text-blue-100 flex gap-2">
              <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
              <p>
                HQ-SL GL correction applied ({resolveSnapshot?.hqSlEntryNo ?? 'JV'}). ~Rs 1 raw party GL residual from
                JE-0168 chain is expected — not an open repair target.
              </p>
            </div>
          ) : null}

          {resolveSnapshot && resolveSnapshot.openGlCorrectionCount > 0 ? (
            <div className="rounded-lg border border-violet-600/40 bg-violet-950/25 p-3 text-xs text-violet-100/90 space-y-2">
              <p>
                <strong>{resolveSnapshot.openGlCorrectionCount}</strong> whitelisted GL correction
                {resolveSnapshot.openGlCorrectionCount === 1 ? '' : 's'} still pending — apply via Hybrid Repair below.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-violet-600/50 text-violet-200"
                onClick={openHybridRepair}
              >
                Open Hybrid Repair
              </Button>
            </div>
          ) : null}
          {loading && !breakdown ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
          ) : breakdown?.ok ? (
            <>
              {hasOrderAdvanceLinks && orderAdvanceTotal > 0 ? (
                <div className="rounded-lg border border-amber-700/40 bg-amber-950/35 p-3 text-xs text-amber-100/90 space-y-2">
                  <p>
                    <strong>{formatCurrency(orderAdvanceTotal)}</strong> = customers jinka payment AR par Cr ho gaya lekin
                    sale abhi <strong>order</strong> hai (invoice JE nahi). <strong>Fix:</strong> Section 1a se sale{' '}
                    <strong>Finalize</strong> karein — variance clear hogi.
                  </p>
                  {onGoToUnpostedOrders ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-amber-600/50 text-amber-200"
                      onClick={onGoToUnpostedOrders}
                    >
                      Go to unposted orders (1a)
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Stat label="Operational (clamped)" value={formatCurrency(breakdown.operationalClamped ?? 0)} />
                <Stat label="Operational (signed)" value={formatCurrency(breakdown.operationalSigned ?? 0)} />
                <Stat label="GL raw" value={formatCurrency(breakdown.glArRaw ?? 0)} />
                <Stat label="Variance" value={formatCurrency(breakdown.varianceTotal ?? 0)} highlight />
              </div>

              {structural1100NetsZero ? (
                <div className="rounded-lg border border-blue-600/40 bg-primary/10 p-3 text-xs text-primary dark:text-blue-100 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
                  <p>
                    Structural 1100 scope pair ({formatCurrency(unmapped1100)} + {formatCurrency(subtreeGap)}) nets to
                    zero — not two separate fixes. Trace individual JEs below (e.g. JV-000205) in unmapped/manual queues.
                  </p>
                </div>
              ) : null}

              {showResidualWarn ? (
                <p className="text-xs text-amber-300/90 bg-amber-950/40 border border-amber-700/40 rounded p-2">
                  Residual bucket is non-zero — refresh or review individual buckets. Buckets should reconcile to the
                  variance card.
                </p>
              ) : null}

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border bg-card/40">
                      <th className="text-left py-2 px-3">Bucket</th>
                      <th className="text-right py-2 px-3">Amount</th>
                      <th className="text-right py-2 px-3">Count</th>
                      <th className="text-right py-2 px-3">Trace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.buckets.map((bucket) => (
                      <tr key={bucket.key} className="border-b border-border/70">
                        <td className="py-2 px-3 text-muted-foreground">{bucket.label}</td>
                        <td
                          className={cn(
                            'py-2 px-3 text-right tabular-nums',
                            Math.abs(bucket.amount) < 0.01 ? 'text-muted-foreground' : 'text-amber-200'
                          )}
                        >
                          {formatCurrency(bucket.amount)}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{bucket.lineCount || '—'}</td>
                        <td className="py-2 px-3 text-right">
                          {bucket.sampleJournalEntryIds.length > 0 ? (
                            <div className="flex flex-wrap gap-1 justify-end">
                              {bucket.sampleJournalEntryIds.map((jeId) => (
                                <Button
                                  key={jeId}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-violet-300 hover:text-violet-200 px-2"
                                  onClick={() => onTraceJournal(jeId)}
                                >
                                  <Search className="w-3 h-3 mr-1" />
                                  JE
                                </Button>
                              ))}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {breakdown.negativeClampedContacts.length > 0 ? (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {hasOrderAdvanceLinks
                      ? 'Order advances on AR (needs finalize)'
                      : 'Negative AR contacts (zeroed in operational sum)'}
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left py-2 px-3">Contact</th>
                          <th className="text-right py-2 px-3">Signed AR</th>
                          <th className="text-right py-2 px-3">Clamped loss</th>
                          <th className="text-right py-2 px-3">Fix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.negativeClampedContacts.map((c) => (
                          <tr key={c.contactId} className="border-b border-border/70 align-top">
                            <td className="py-2 px-3 text-muted-foreground">
                              <div>{c.contactName}</div>
                              {c.linkedUnpostedSales.map((s) => (
                                <div key={s.saleId} className="text-[10px] text-muted-foreground mt-1">
                                  {c.contactName} · {s.invoiceNo} {s.status || 'order'} · advance{' '}
                                  {formatCurrency(s.paidAmount)}
                                </div>
                              ))}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums text-red-300">
                              {formatCurrency(c.signedAr)}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums text-amber-200">
                              {formatCurrency(c.clampedLoss)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex flex-col gap-1 items-end">
                                {c.linkedUnpostedSales.length > 0 && onOpenSale
                                  ? c.linkedUnpostedSales.map((s) => (
                                      <Button
                                        key={s.saleId}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] border-amber-600/40 text-amber-200"
                                        onClick={() => onOpenSale(s.saleId, s.invoiceNo)}
                                      >
                                        <ExternalLink className="w-3 h-3 mr-1" />
                                        Open {s.invoiceNo}
                                      </Button>
                                    ))
                                  : null}
                                {onOpenPartyLedger && c.contactId ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] border-gray-600 text-muted-foreground"
                                    onClick={() => onOpenPartyLedger(c.contactId, c.contactName)}
                                  >
                                    Party statement
                                  </Button>
                                ) : null}
                                {isLikelyWalkInResidual(c.contactName, c.clampedLoss) && onGoToFinancialTrace ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[10px] text-blue-700 dark:text-blue-300"
                                    onClick={onGoToFinancialTrace}
                                  >
                                    HQ-SL resolved (trace)
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground py-4">
              {breakdown?.error || 'Variance breakdown unavailable — apply migration 20260619120000_ar_ap_variance_breakdown.sql'}
            </p>
          )}

          <Button type="button" variant="outline" size="sm" className="border-gray-600" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Refresh breakdown
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded border border-border bg-muted/40 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('tabular-nums text-sm', highlight ? 'text-amber-200 font-medium' : 'text-gray-200')}>{value}</p>
    </div>
  );
}
