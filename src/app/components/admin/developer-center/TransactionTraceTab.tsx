import React, { useState } from 'react';
import { Search, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { useRepairQueue } from '@/app/components/admin/developer-center/RepairQueueContext';
import { detectTransactionTraceRepairCandidates } from '@/app/lib/transactionTraceRepairDiagnostics';
import {
  runTransactionTrace,
  type TraceMode,
  type TransactionTraceResult,
} from '@/app/services/accountingDeveloperCenterService';

interface Props {
  companyId: string;
  initialQuery?: string;
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-900/80 text-left text-sm font-medium text-gray-200 hover:bg-gray-800/80"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {title}
      </button>
      {open && <div className="p-3 text-xs text-gray-400 space-y-2">{children}</div>}
    </div>
  );
}

function inclBadge(included: boolean) {
  return included ? (
    <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800">included</Badge>
  ) : (
    <Badge className="bg-slate-800 text-slate-400 border-slate-700">excluded</Badge>
  );
}

export function TransactionTraceTab({ companyId, initialQuery = '' }: Props) {
  const { sendToRepairQueue } = useRepairQueue();
  const [mode, setMode] = useState<TraceMode>('auto');
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [trace, setTrace] = useState<TransactionTraceResult | null>(null);

  const run = async () => {
    if (!companyId || !query.trim()) {
      toast.error('Enter a reference, JE number, or UUID');
      return;
    }
    setLoading(true);
    try {
      const result = await runTransactionTrace(companyId, query.trim(), mode);
      setTrace(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Trace failed');
      setTrace(null);
    } finally {
      setLoading(false);
    }
  };

  const copyJson = () => {
    if (!trace) return;
    void navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
    toast.success('Trace JSON copied');
  };

  const visibilityRows = trace?.reportVisibilityByJournal?.length
    ? trace.reportVisibilityByJournal
    : (trace?.reportVisibility || []).map((visibility, i) => ({
        journalId: trace?.journals[i]?.id || `row-${i}`,
        entryNo: trace?.journals[i]?.entry_no ?? null,
        referenceType: trace?.journals[i]?.reference_type ?? null,
        visibility,
      }));

  const repairCandidates = trace ? detectTransactionTraceRepairCandidates(trace, 'trace') : [];

  return (
    <div className="space-y-4">
      <Card className="border-gray-800 bg-gray-900/40">
        <CardHeader>
          <CardTitle className="text-lg">Transaction trace</CardTitle>
          <CardDescription>
            RCV/PAY/EXP/JE/SL/REN/UUID — operational doc → payment → JE → report visibility. Phase F repair queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <Select value={mode} onValueChange={(v) => setMode(v as TraceMode)}>
              <SelectTrigger className="w-[180px] bg-gray-950 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="entry_no">JE number</SelectItem>
                <SelectItem value="payment_ref">Payment ref</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
                <SelectItem value="uuid">UUID</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="HQ-RCV-0006, JE-0012, payment UUID…"
              className="flex-1 min-w-[200px] bg-gray-950 border-gray-700"
              onKeyDown={(e) => e.key === 'Enter' && void run()}
            />
            <Button type="button" onClick={() => void run()} disabled={loading}>
              <Search className="w-4 h-4 mr-1" />
              Trace
            </Button>
            <Button type="button" variant="outline" onClick={copyJson} disabled={!trace}>
              <Copy className="w-4 h-4 mr-1" />
              Copy JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {trace && (
        <div className="space-y-2">
          <Card className="border-violet-900/30 bg-violet-950/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Repair candidates</CardTitle>
              <CardDescription>Safe metadata repairs — always dry-run before apply</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {repairCandidates.filter((c) => c.canQueue).length === 0 ? (
                <p className="text-xs text-gray-500">{repairCandidates[0]?.reason || 'No safe repair available'}</p>
              ) : (
                repairCandidates
                  .filter((c) => c.canQueue && c.queueItem)
                  .map((c) => (
                    <div
                      key={`${c.queueItem!.actionId}-${JSON.stringify(c.queueItem!.params)}`}
                      className="flex flex-wrap items-center gap-2 text-xs"
                    >
                      <span className="text-gray-400 flex-1 min-w-[200px]">{c.reason}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => {
                          sendToRepairQueue(c.queueItem!);
                          toast.success('Sent to Repair Queue');
                        }}
                      >
                        Send to queue
                      </Button>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-gray-500">Overall:</span>
            <Badge>{trace.overall}</Badge>
            <span className="text-gray-600">Mode: {trace.mode}</span>
          </div>

          <Section title="1 · Operational entities" defaultOpen>
            {trace.entities.length === 0 ? (
              <p>No operational document resolved.</p>
            ) : (
              <ul className="list-disc pl-4 space-y-1">
                {trace.entities.map((e) => (
                  <li key={`${e.kind}-${e.id}`}>
                    {e.kind}: <span className="text-gray-200">{e.label}</span>
                    {e.status ? ` · ${e.status}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="2 · Payments">
            {trace.payments.length === 0 ? (
              <p>No payment rows.</p>
            ) : (
              trace.payments.map((p) => (
                <pre key={p.id} className="text-[10px] bg-gray-950 p-2 rounded overflow-x-auto">
                  {JSON.stringify(p, null, 2)}
                </pre>
              ))
            )}
          </Section>

          <Section title="3 · Rental payments">
            {trace.rentalPayments.length === 0 ? (
              <p>No rental_payment rows.</p>
            ) : (
              trace.rentalPayments.map((p) => (
                <pre key={p.id} className="text-[10px] bg-gray-950 p-2 rounded overflow-x-auto">
                  {JSON.stringify(p, null, 2)}
                </pre>
              ))
            )}
          </Section>

          <Section title="4–6 · Journal entries, lines, accounts" defaultOpen>
            {trace.journals.length === 0 ? (
              <p>No journal entries.</p>
            ) : (
              trace.journals.map((j) => (
                <div key={j.id} className="mb-3 border border-gray-800 rounded p-2">
                  <p className="text-gray-200 font-medium">
                    {j.entry_no || j.id.slice(0, 8)} · {j.reference_type} · {j.entry_date}
                    {j.is_void ? ' (void)' : ''}
                  </p>
                  <table className="w-full mt-2">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left">Code</th>
                        <th className="text-left">Account</th>
                        <th className="text-right">Dr</th>
                        <th className="text-right">Cr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(j.lines || []).map((l, i) => (
                        <tr key={i}>
                          <td>{l.account_code}</td>
                          <td>{l.account_name}</td>
                          <td className="text-right">{l.debit}</td>
                          <td className="text-right">{l.credit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </Section>

          <Section title="7 · Branch chain">
            {trace.branchChain.length === 0 ? (
              <p>No branch ids on resolved rows.</p>
            ) : (
              <ul className="list-disc pl-4">
                {trace.branchChain.map((b, i) => (
                  <li key={i}>
                    {b.layer}: {b.branchId || 'null'} — {b.label}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="8–11 · Report visibility & diagnosis" defaultOpen>
            {trace.multipleEntryNoMatches.length > 0 && (
              <div className="mb-3 rounded border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-amber-200/90">
                Multiple journal entries share entry_no:{' '}
                <span className="font-mono">{trace.multipleEntryNoMatches.join(', ')}</span>. Visibility below is
                listed per matched JE — verify each row separately.
              </div>
            )}
            {visibilityRows.length > 0 ? (
              <div className="space-y-4">
                {visibilityRows.map((row) => (
                  <div key={row.journalId} className="rounded border border-gray-800 p-2 space-y-2">
                    <p className="text-gray-300 font-medium">
                      {row.entryNo || row.journalId.slice(0, 8)}
                      {row.referenceType ? ` · ${row.referenceType}` : ''}
                    </p>
                    <p>
                      Roznamcha {inclBadge(row.visibility.roznamcha.included)} — {row.visibility.roznamcha.reason}
                    </p>
                    <p>
                      Account Statement {inclBadge(row.visibility.accountStatement.included)} —{' '}
                      {row.visibility.accountStatement.reason}
                    </p>
                    <p>
                      Day Book {inclBadge(row.visibility.dayBook.included)} — {row.visibility.dayBook.reason}
                    </p>
                    <p>Dashboard: {row.visibility.dashboard.note}</p>
                    {row.visibility.dashboard.impacted.length > 0 && (
                      <p>KPIs: {row.visibility.dashboard.impacted.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : trace.reportVisibility.length > 0 ? (
              <div className="space-y-2">
                {trace.reportVisibility.map((vis, i) => (
                  <div key={i} className="space-y-2">
                    <p>
                      Roznamcha {inclBadge(vis.roznamcha.included)} — {vis.roznamcha.reason}
                    </p>
                    <p>
                      Account Statement {inclBadge(vis.accountStatement.included)} — {vis.accountStatement.reason}
                    </p>
                    <p>
                      Day Book {inclBadge(vis.dayBook.included)} — {vis.dayBook.reason}
                    </p>
                    <p>Dashboard: {vis.dashboard.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>Run trace to evaluate report inclusion.</p>
            )}
            {trace.traceGuidance && (
              <div className="mt-3 border-t border-gray-800 pt-2">
                <p className="text-gray-300 font-medium">Diagnosis / next steps</p>
                <ul className="list-disc pl-4 mt-1">
                  {trace.traceGuidance.nextSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {trace.ruleHits.length > 0 && (
            <Section title="Rule hits (advisory)">
              <ul className="list-disc pl-4">
                {trace.ruleHits.map((h, i) => (
                  <li key={i}>
                    {h.ruleId}: {h.detail}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
