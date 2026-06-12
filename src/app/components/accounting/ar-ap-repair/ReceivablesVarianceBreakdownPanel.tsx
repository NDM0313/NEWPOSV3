import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
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
  refreshToken = 0,
}: Props) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<ReceivablesVarianceBreakdown | null>(null);

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

  const residual = breakdown?.buckets.find((b) => b.key === 'residual_unexplained');
  const showResidualWarn = residual != null && Math.abs(residual.amount) >= 0.02;

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

  return (
    <div id="receivables-variance-breakdown" className="rounded-xl border border-amber-500/30 bg-amber-950/15 scroll-mt-4">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-amber-950/25"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <h3 className="text-sm font-semibold text-amber-100">Receivables variance breakdown</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Explains Operational − GL raw gap
            {varianceTotal != null ? ` (${formatCurrency(varianceTotal)})` : ''}
          </p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>

      {open ? (
        <div className="px-4 pb-4 space-y-3 border-t border-amber-500/20">
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

              {showResidualWarn ? (
                <p className="text-xs text-amber-300/90 bg-amber-950/40 border border-amber-700/40 rounded p-2">
                  Residual bucket is non-zero — refresh or review individual buckets. Buckets should reconcile to the
                  variance card.
                </p>
              ) : null}

              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800 bg-gray-900/40">
                      <th className="text-left py-2 px-3">Bucket</th>
                      <th className="text-right py-2 px-3">Amount</th>
                      <th className="text-right py-2 px-3">Count</th>
                      <th className="text-right py-2 px-3">Trace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.buckets.map((bucket) => (
                      <tr key={bucket.key} className="border-b border-gray-800/70">
                        <td className="py-2 px-3 text-gray-300">{bucket.label}</td>
                        <td
                          className={cn(
                            'py-2 px-3 text-right tabular-nums',
                            Math.abs(bucket.amount) < 0.01 ? 'text-gray-500' : 'text-amber-200'
                          )}
                        >
                          {formatCurrency(bucket.amount)}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-500">{bucket.lineCount || '—'}</td>
                        <td className="py-2 px-3 text-right">
                          {bucket.sampleJournalEntryIds[0] ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-violet-300 hover:text-violet-200"
                              onClick={() => onTraceJournal(bucket.sampleJournalEntryIds[0])}
                            >
                              <Search className="w-3 h-3 mr-1" />
                              JE
                            </Button>
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
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {hasOrderAdvanceLinks
                      ? 'Order advances on AR (needs finalize)'
                      : 'Negative AR contacts (zeroed in operational sum)'}
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-gray-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-800">
                          <th className="text-left py-2 px-3">Contact</th>
                          <th className="text-right py-2 px-3">Signed AR</th>
                          <th className="text-right py-2 px-3">Clamped loss</th>
                          <th className="text-right py-2 px-3">Fix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.negativeClampedContacts.map((c) => (
                          <tr key={c.contactId} className="border-b border-gray-800/70 align-top">
                            <td className="py-2 px-3 text-gray-300">
                              <div>{c.contactName}</div>
                              {c.linkedUnpostedSales.map((s) => (
                                <div key={s.saleId} className="text-[10px] text-gray-500 mt-1">
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
                              {c.linkedUnpostedSales.length > 0 && onOpenSale ? (
                                <div className="flex flex-col gap-1 items-end">
                                  {c.linkedUnpostedSales.map((s) => (
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
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-gray-500 py-4">
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
    <div className="rounded border border-gray-800 bg-gray-950/50 p-2">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={cn('tabular-nums text-sm', highlight ? 'text-amber-200 font-medium' : 'text-gray-200')}>{value}</p>
    </div>
  );
}
