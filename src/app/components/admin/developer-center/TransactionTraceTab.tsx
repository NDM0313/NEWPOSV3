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
import { TraceRepairCandidatesPanel } from '@/app/components/admin/developer-center/TraceRepairCandidateCard';
import {
  runTransactionTrace,
  type TraceMode,
  type TransactionTraceResult,
} from '@/app/services/accountingDeveloperCenterService';
import type { ReportModeVisibility, ReportVisibility } from '@/app/lib/transactionTraceReportVisibility';
import { suggestTraceActions } from '@/app/lib/transactionTraceSuggestedActions';
import { isCorrectionReversalReferenceType } from '@/app/lib/reportVisibilityContract';

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
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 bg-card text-left text-sm font-medium text-gray-200 hover:bg-muted/80"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {title}
      </button>
      {open && <div className="p-3 text-xs text-muted-foreground space-y-2">{children}</div>}
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

function modeVisLine(label: string, vis: ReportModeVisibility) {
  return (
    <div key={label} className="space-y-0.5">
      <p>
        {label} — normal {inclBadge(vis.normal.included)} · audit {inclBadge(vis.audit.included)}
      </p>
      <p className="text-muted-foreground pl-2">{vis.normal.reason}</p>
    </div>
  );
}

function renderReportVisibility(vis: ReportVisibility, journalRt?: string | null) {
  const suggested = suggestTraceActions({
    issueType: 'none',
    journalReferenceType: journalRt,
    normalHiddenAuditVisible:
      isCorrectionReversalReferenceType(journalRt) &&
      !vis.roznamcha.normal.included &&
      vis.roznamcha.audit.included,
  });
  return (
    <div className="space-y-2">
      {modeVisLine('Roznamcha', vis.roznamcha)}
      {modeVisLine('Account statement', vis.accountStatement)}
      {modeVisLine('Customer/supplier statement', vis.customerSupplierStatement)}
      {modeVisLine('Day Book', vis.dayBook)}
      <p>Dashboard: {vis.dashboard.note}</p>
      {vis.dashboard.impacted.length > 0 && <p>KPIs: {vis.dashboard.impacted.join(', ')}</p>}
      {suggested.length > 0 && (
        <div className="border-t border-border pt-2 mt-2">
          <p className="text-muted-foreground font-medium">Suggested safe actions</p>
          <ul className="list-disc pl-4 mt-1">
            {suggested.map((s) => (
              <li key={s.id}>
                <span className="text-gray-200">{s.label}</span> — {s.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
      <Card className="border-border bg-card/40">
        <CardHeader>
          <CardTitle className="text-lg">Transaction trace</CardTitle>
          <CardDescription>
            RCV/PAY/EXP/JE/SL/REN/UUID — operational doc → payment → JE → report visibility. Phase F repair queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <Select value={mode} onValueChange={(v) => setMode(v as TraceMode)}>
              <SelectTrigger className="w-[180px] bg-input-background border-border">
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
              className="flex-1 min-w-[200px] bg-input-background border-border"
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
              <TraceRepairCandidatesPanel
                candidates={repairCandidates}
                sourceTab="trace"
                onSendToQueue={(item) => {
                  sendToRepairQueue(item);
                  toast.success('Sent to Repair Queue');
                }}
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-muted-foreground">Overall:</span>
            <Badge>{trace.overall}</Badge>
            <span className="text-muted-foreground">Mode: {trace.mode}</span>
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
                <pre key={p.id} className="text-[10px] bg-input-background p-2 rounded overflow-x-auto">
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
                <pre key={p.id} className="text-[10px] bg-input-background p-2 rounded overflow-x-auto">
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
                <div key={j.id} className="mb-3 border border-border rounded p-2">
                  <p className="text-gray-200 font-medium">
                    {j.entry_no || j.id.slice(0, 8)} · {j.reference_type} · {j.entry_date}
                    {j.is_void ? ' (void)' : ''}
                  </p>
                  <table className="w-full mt-2">
                    <thead>
                      <tr className="text-muted-foreground">
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
                  <div key={row.journalId} className="rounded border border-border p-2 space-y-2">
                    <p className="text-muted-foreground font-medium">
                      {row.entryNo || row.journalId.slice(0, 8)}
                      {row.referenceType ? ` · ${row.referenceType}` : ''}
                    </p>
                    {renderReportVisibility(row.visibility, row.referenceType)}
                  </div>
                ))}
              </div>
            ) : trace.reportVisibility.length > 0 ? (
              <div className="space-y-2">
                {trace.reportVisibility.map((vis, i) => (
                  <div key={i}>{renderReportVisibility(vis, trace.journals[i]?.reference_type)}</div>
                ))}
              </div>
            ) : (
              <p>Run trace to evaluate report inclusion.</p>
            )}
            {trace.traceGuidance && (
              <div className="mt-3 border-t border-border pt-2">
                <p className="text-muted-foreground font-medium">Diagnosis / next steps</p>
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
