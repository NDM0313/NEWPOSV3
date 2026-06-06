import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';
import { useRepairQueue } from '@/app/components/admin/developer-center/RepairQueueContext';
import {
  loadPaymentTraceSnapshot,
  runTransactionTrace,
  type TraceMode,
  type TransactionTraceResult,
} from '@/app/services/accountingDeveloperCenterService';
import { detectTransactionTraceRepairCandidates } from '@/app/lib/transactionTraceRepairDiagnostics';
import { TraceRepairCandidatesPanel } from '@/app/components/admin/developer-center/TraceRepairCandidateCard';
import type { PaymentTraceView } from '@/app/lib/paymentTraceDiagnostics';

interface Props {
  companyId: string;
  initialQuery?: string;
}

export function PaymentTraceTab({ companyId, initialQuery = '' }: Props) {
  const { sendToRepairQueue } = useRepairQueue();
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<PaymentTraceView | null>(null);
  const [trace, setTrace] = useState<TransactionTraceResult | null>(null);

  const run = useCallback(async () => {
    if (!companyId || !query.trim()) {
      toast.error('Enter a payment reference');
      return;
    }
    setLoading(true);
    try {
      const mode = 'auto' as TraceMode;
      const [snapshot, fullTrace] = await Promise.all([
        loadPaymentTraceSnapshot(companyId, query, mode),
        runTransactionTrace(companyId, query.trim(), mode),
      ]);
      setView(snapshot);
      setTrace(fullTrace);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment trace failed');
      setView(null);
      setTrace(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, query]);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => {
    if (initialQuery && companyId) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, initialQuery]);

  const repairCandidates = trace ? detectTransactionTraceRepairCandidates(trace, 'payment') : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Payment ref (q)</label>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="HQ-RCV-0006 or PAY-0042" className="mt-1 bg-gray-950 border-gray-800" />
        </div>
        <Button type="button" size="sm" onClick={run} disabled={loading}>
          <Search className={`w-4 h-4 mr-1 ${loading ? 'animate-pulse' : ''}`} />
          Run diagnostic
        </Button>
        <span className="text-xs text-violet-400/90 ml-auto">Phase F — send safe repairs to Repair Queue</span>
      </div>

      {trace && (
        <Card className="border-violet-900/30 bg-violet-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Repair candidates</CardTitle>
            <CardDescription>Metadata-only repairs — dry-run required before apply</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <TraceRepairCandidatesPanel
              candidates={repairCandidates}
              sourceTab="payment"
              onSendToQueue={(item) => {
                sendToRepairQueue(item);
                toast.success('Sent to Repair Queue');
              }}
            />
          </CardContent>
        </Card>
      )}

      {view && (
        <Card className="border-gray-800 bg-gray-900/40">
          <CardHeader>
            <CardTitle className="text-base">Payment-first trace</CardTitle>
            <CardDescription>
              Primary: {view.primaryPaymentRef || view.primaryPaymentId || '—'} · {view.reportVisibilitySummary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {view.sections.map((section) => (
              <div key={section.id} className="border border-gray-800 rounded-lg p-3">
                <h3 className="text-sm font-medium text-gray-200 mb-2">{section.title}</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {section.rows.map((row, i) => (
                    <React.Fragment key={`${section.id}-${i}`}>
                      <dt className="text-gray-500">{row.label}</dt>
                      <dd className="text-gray-300 font-mono break-all">{row.value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
