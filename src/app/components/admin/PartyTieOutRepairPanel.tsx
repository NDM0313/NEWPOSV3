/**
 * Developer-only: single-party tie-out + repair candidates (not a dashboard).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Play, AlertTriangle } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import {
  runLivePartyTieOutCleanupScan,
  findSalePaymentContactBackfillCandidates,
  findPurchasePaymentContactBackfillCandidates,
  applyPaymentContactBackfills,
  type LivePartyTieOutCleanupReport,
} from '@/app/services/partyTieOutBulkCleanupService';
import { supabase } from '@/lib/supabase';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Badge } from '@/app/components/ui/badge';
import { runPartyBalanceTieOut, type PartyKind } from '@/app/services/partyBalanceTieOutService';
import {
  buildPartyTieOutRepairPlan,
  type PartyTieOutRepairBucket,
  type PartyTieOutRepairCandidate,
} from '@/app/services/partyTieOutRepairService';
import { toast } from 'sonner';

const BUCKET_LABELS: Record<PartyTieOutRepairBucket, string> = {
  missing_payment_contact_id: 'Missing payment contact',
  wrong_document_payment_contact: 'Wrong doc/payment contact',
  payment_without_je: 'Payment without JE',
  control_line_party_unresolved: 'Control line, party unresolved',
  worker_lifecycle_rule_failure: 'Worker lifecycle rule',
  residual_after_attribution: 'Residual / RPC slice',
  operational_vs_gl_slice: 'Operational vs GL slice',
};

function sevBadge(s: 'info' | 'warn' | 'error') {
  if (s === 'error') return <Badge className="bg-red-800 text-white text-[10px]">error</Badge>;
  if (s === 'warn') return <Badge className="bg-amber-800 text-white text-[10px]">warn</Badge>;
  return <Badge className="bg-slate-600 text-white text-[10px]">info</Badge>;
}

export function PartyTieOutRepairPanel({ branchId }: { branchId: string | null }) {
  const { companyId, user } = useSupabase();
  const [contacts, setContacts] = useState<{ id: string; name: string; type: string | null }[]>([]);
  const [partyId, setPartyId] = useState('');
  const [partyType, setPartyType] = useState<PartyKind>('customer');
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const [tieOut, setTieOut] = useState<Awaited<ReturnType<typeof runPartyBalanceTieOut>> | null>(null);
  const [repair, setRepair] = useState<ReturnType<typeof buildPartyTieOutRepairPlan> | null>(null);

  const [cleanupTop, setCleanupTop] = useState(12);
  const [cleanupMinVar, setCleanupMinVar] = useState(1);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupReport, setCleanupReport] = useState<LivePartyTieOutCleanupReport | null>(null);
  const [backfillPreview, setBackfillPreview] = useState<{ sale: number; purchase: number } | null>(null);
  const [backfillApplyLoading, setBackfillApplyLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, type')
        .eq('company_id', companyId)
        .order('name')
        .limit(800);
      if (cancelled || error) return;
      setContacts((data || []) as { id: string; name: string; type: string | null }[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return contacts.slice(0, 200);
    return contacts.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 200);
  }, [contacts, contactSearch]);

  const run = useCallback(async () => {
    if (!companyId || !partyId) {
      toast.error('Select a party');
      return;
    }
    setLoading(true);
    setTieOut(null);
    setRepair(null);
    try {
      const { data: row } = await supabase
        .from('contacts')
        .select('type')
        .eq('id', partyId)
        .eq('company_id', companyId)
        .maybeSingle();
      const ct = (row as { type?: string } | null)?.type?.toLowerCase() || '';
      const mismatch =
        (partyType === 'customer' && ct === 'supplier') ||
        (partyType === 'supplier' && ct === 'customer') ||
        (partyType === 'worker' && ct && ct !== 'worker' && ct !== 'both');
      if (mismatch) {
        toast.warning('Contact type may not match selected party role — results are still for this contact id.');
      }

      const result = await runPartyBalanceTieOut({
        companyId,
        partyType,
        partyId,
        branchId: branchId || undefined,
        asOfDate: asOf,
      });
      setTieOut(result);
      setRepair(buildPartyTieOutRepairPlan(result));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Tie-out failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, partyId, partyType, branchId, asOf]);

  const runCleanup = useCallback(async () => {
    if (!companyId) return;
    setCleanupLoading(true);
    setCleanupReport(null);
    setBackfillPreview(null);
    try {
      const rep = await runLivePartyTieOutCleanupScan(companyId, branchId, {
        topPerKind: Math.min(50, Math.max(1, cleanupTop)),
        minAbsVariance: Math.max(0, cleanupMinVar),
      });
      setCleanupReport(rep);
      const [s, p] = await Promise.all([
        findSalePaymentContactBackfillCandidates(companyId),
        findPurchasePaymentContactBackfillCandidates(companyId),
      ]);
      setBackfillPreview({ sale: s.length, purchase: p.length });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Cleanup scan failed');
    } finally {
      setCleanupLoading(false);
    }
  }, [companyId, branchId, cleanupTop, cleanupMinVar]);

  const previewBackfills = useCallback(async () => {
    if (!companyId) return;
    const [s, p] = await Promise.all([
      findSalePaymentContactBackfillCandidates(companyId),
      findPurchasePaymentContactBackfillCandidates(companyId),
    ]);
    setBackfillPreview({ sale: s.length, purchase: p.length });
    toast.info(`Backfill candidates: ${s.length} sale-linked, ${p.length} purchase-linked (contact_id NULL)`);
  }, [companyId]);

  const applyBackfills = useCallback(async () => {
    if (!companyId) return;
    if (!window.confirm('Apply ONLY NULL contact_id backfills from sale/purchase documents? This writes payments + party_repair_audit (revert via audit old_value).')) {
      return;
    }
    setBackfillApplyLoading(true);
    try {
      const [s, p] = await Promise.all([
        findSalePaymentContactBackfillCandidates(companyId),
        findPurchasePaymentContactBackfillCandidates(companyId),
      ]);
      const r1 = await applyPaymentContactBackfills(companyId, s, {
        dryRun: false,
        appliedByUserId: user?.id ?? null,
      });
      const r2 = await applyPaymentContactBackfills(companyId, p, {
        dryRun: false,
        appliedByUserId: user?.id ?? null,
      });
      toast.success(
        `Applied ${r1.applied + r2.applied} payment contact backfills (skipped ${r1.skipped + r2.skipped}). Audit rows: ${r1.auditIds.length + r2.auditIds.length}`
      );
      if (r1.errors.length || r2.errors.length) {
        toast.error([...r1.errors, ...r2.errors].slice(0, 3).join(' | '));
      }
      void runCleanup();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setBackfillApplyLoading(false);
    }
  }, [companyId, user?.id, runCleanup]);

  if (!companyId) {
    return <p className="text-sm text-gray-500">No company context.</p>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-gray-800 bg-gray-900/40 border-dashed border-amber-700/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-amber-100">Live tie-out cleanup (top mismatches)</CardTitle>
          <CardDescription>
            Ranks parties by |operational − GL slice|, deep-scans with repair buckets, proposes NULL{' '}
            <code className="text-gray-400">payments.contact_id</code> backfills from sale/purchase documents only (no GL
            edits).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-gray-400 text-xs">Top N per kind</Label>
            <Input
              type="number"
              min={1}
              max={50}
              className="w-24 bg-gray-950 border-gray-700"
              value={cleanupTop}
              onChange={(e) => setCleanupTop(Number(e.target.value) || 12)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-400 text-xs">Min |variance|</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              className="w-28 bg-gray-950 border-gray-700"
              value={cleanupMinVar}
              onChange={(e) => setCleanupMinVar(Number(e.target.value) || 0)}
            />
          </div>
          <Button variant="secondary" onClick={() => void runCleanup()} disabled={cleanupLoading}>
            {cleanupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run ranked scan
          </Button>
          <Button variant="outline" className="border-gray-600" onClick={() => void previewBackfills()}>
            Count backfill candidates
          </Button>
          <Button
            variant="destructive"
            className="bg-amber-900/40 text-amber-100 border border-amber-800 hover:bg-amber-900/60"
            onClick={() => void applyBackfills()}
            disabled={backfillApplyLoading}
          >
            {backfillApplyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Apply safe backfills
          </Button>
        </CardContent>
        {cleanupReport && (
          <CardContent className="pt-0 text-sm text-gray-300 space-y-3 border-t border-gray-800 mt-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div>
                <span className="text-gray-500">Coarse mismatch parties</span>
                <div className="text-white">{cleanupReport.beforeCoarseMismatchParties}</div>
              </div>
              <div>
                <span className="text-gray-500">Deep-scanned</span>
                <div className="text-white">{cleanupReport.summary.partiesDeepScanned}</div>
              </div>
              <div>
                <span className="text-gray-500">Repair candidates</span>
                <div className="text-white">{cleanupReport.summary.totalRepairCandidates}</div>
              </div>
              <div>
                <span className="text-gray-500">Manual review parties</span>
                <div className="text-white">{cleanupReport.summary.manualReviewPartyCount}</div>
              </div>
              <div>
                <span className="text-gray-500">Auto-fixable backfills (NULL contact)</span>
                <div className="text-emerald-300">{cleanupReport.summary.autoFixableBackfillCandidates}</div>
              </div>
              <div>
                <span className="text-gray-500">Parties w/ repair rows</span>
                <div className="text-white">{cleanupReport.afterPartiesWithIssues}</div>
              </div>
            </div>
            {backfillPreview && (
              <p className="text-[11px] text-gray-500">
                Current NULL-contact candidates: {backfillPreview.sale} sale-linked, {backfillPreview.purchase}{' '}
                purchase-linked (requires <code className="text-gray-400">party_repair_audit</code> migration).
              </p>
            )}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Top residual (collected JE scope)</div>
              <ul className="text-xs font-mono max-h-32 overflow-y-auto space-y-0.5">
                {cleanupReport.summary.topResidualParties.map((r) => (
                  <li key={`${r.partyType}-${r.partyId}`}>
                    {r.partyType} {r.name || r.partyId.slice(0, 8)}… residual {r.residual.toFixed(2)}
                  </li>
                ))}
                {!cleanupReport.summary.topResidualParties.length && (
                  <li className="text-gray-600">None above threshold in this scan.</li>
                )}
              </ul>
            </div>
            <ScrollArea className="h-48 border border-gray-800 rounded-md p-2">
              <table className="w-full text-[10px] text-left">
                <thead>
                  <tr className="text-gray-500">
                    <th className="p-1">Type</th>
                    <th className="p-1">Party</th>
                    <th className="p-1">|Op−GL|</th>
                    <th className="p-1">Repairs</th>
                  </tr>
                </thead>
                <tbody>
                  {cleanupReport.details.map((d) => (
                    <tr key={`${d.partyType}-${d.partyId}`} className="border-t border-gray-800/80">
                      <td className="p-1">{d.partyType}</td>
                      <td className="p-1 truncate max-w-[120px]">{d.name || d.partyId.slice(0, 8)}</td>
                      <td className="p-1">{d.absVariance.toFixed(2)}</td>
                      <td className="p-1">{d.repairCandidateCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        )}
      </Card>

      <Card className="border-gray-800 bg-gray-900/40">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Party tie-out repair
          </CardTitle>
          <CardDescription>
            One party: operational vs RPC GL vs extended collection; mismatch causes; repair-ready rows. Uses{' '}
            <code className="text-gray-400">runPartyBalanceTieOut</code> +{' '}
            <code className="text-gray-400">buildPartyTieOutRepairPlan</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-gray-400 text-xs">Party role</Label>
            <Select value={partyType} onValueChange={(v) => setPartyType(v as PartyKind)}>
              <SelectTrigger className="w-[140px] bg-gray-950 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-gray-400 text-xs">Contact</Label>
            <Input
              className="bg-gray-950 border-gray-700 mb-1"
              placeholder="Filter name…"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />
            <Select value={partyId || undefined} onValueChange={setPartyId}>
              <SelectTrigger className="bg-gray-950 border-gray-700">
                <SelectValue placeholder="Choose contact" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {filteredContacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.type ? `(${c.type})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-gray-400 text-xs">As-of date</Label>
            <Input
              type="date"
              className="w-[160px] bg-gray-950 border-gray-700"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </div>
          <Button onClick={() => void run()} disabled={loading || !partyId} className="gap-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run tie-out
          </Button>
        </CardContent>
      </Card>

      {tieOut && repair && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Balances</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 font-mono text-gray-300">
              <div>
                <span className="text-gray-500">Operational </span>
                {tieOut.operational.primaryReceivableOrPayable.value ?? '—'}
              </div>
              <div>
                <span className="text-gray-500">RPC GL slice </span>
                {tieOut.gl.rpcPartySlice.value ?? '—'}
              </div>
              <div>
                <span className="text-gray-500">Extended GL </span>
                {tieOut.gl.extendedOnControlAccount.value ?? '—'}
              </div>
              <div>
                <span className="text-gray-500">Extended − RPC </span>
                {tieOut.gl.extendedMinusRpcPartySlice.value ?? '—'}
              </div>
              <div>
                <span className="text-gray-500">Residual (unmapped) </span>
                {tieOut.residual.unmappedPartyOnControl.value ?? '—'}
              </div>
              {tieOut.workerGl && (
                <div className="pt-2 border-t border-gray-800 space-y-1 text-[11px]">
                  <div>
                    <span className="text-gray-500">2010 net </span>
                    {tieOut.workerGl.gl2010NetLiability.value}
                  </div>
                  <div>
                    <span className="text-gray-500">1180 net </span>
                    {tieOut.workerGl.gl1180NetAsset.value}
                  </div>
                  <div>
                    <span className="text-gray-500">Worker net (ext) </span>
                    {tieOut.workerGl.workerNetFromWpWa.value}
                  </div>
                </div>
              )}
              {tieOut.variances.operationalMinusRpcPartySlice != null && (
                <div>
                  <span className="text-gray-500">Op − RPC </span>
                  {tieOut.variances.operationalMinusRpcPartySlice}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Repair buckets ({repair.candidates.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[220px] pr-3">
                <ul className="text-sm space-y-2">
                  {(Object.keys(BUCKET_LABELS) as PartyTieOutRepairBucket[]).map((b) => {
                    const rows = repair.byBucket[b];
                    if (!rows.length) return null;
                    return (
                      <li key={b} className="border-b border-gray-800 pb-2">
                        <div className="font-medium text-gray-200">{BUCKET_LABELS[b]}</div>
                        <ul className="mt-1 space-y-1 text-gray-400">
                          {rows.map((r, i) => (
                            <li key={i} className="flex flex-wrap gap-1 items-start">
                              {sevBadge(r.severity)}
                              <span>{r.message}</span>
                              {r.readyToFixHint && (
                                <span className="text-emerald-600/90 block w-full text-xs">{r.readyToFixHint}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/40 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mismatch causes</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[160px]">
                <ul className="text-sm space-y-1 text-gray-300">
                  {tieOut.diagnostics.mismatchCauses.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      {sevBadge(c.severity)}
                      <span>
                        <code className="text-gray-500">{c.code}</code> {c.message}
                      </span>
                    </li>
                  ))}
                  {!tieOut.diagnostics.mismatchCauses.length && (
                    <li className="text-gray-500">None in this scope.</li>
                  )}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Linked docs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] text-xs font-mono text-gray-400">
                {tieOut.linked.sales?.length ? (
                  <div className="mb-2">
                    <div className="text-gray-500 mb-1">Sales</div>
                    {tieOut.linked.sales.map((s) => (
                      <div key={s.id}>
                        {s.invoice_no || s.id.slice(0, 8)} due {s.due_amount}
                      </div>
                    ))}
                  </div>
                ) : null}
                {tieOut.linked.purchases?.length ? (
                  <div className="mb-2">
                    <div className="text-gray-500 mb-1">Purchases</div>
                    {tieOut.linked.purchases.map((p) => (
                      <div key={p.id}>
                        {p.po_no || p.id.slice(0, 8)} due {p.due_amount}
                      </div>
                    ))}
                  </div>
                ) : null}
                {tieOut.linked.rentals?.length ? (
                  <div>
                    <div className="text-gray-500 mb-1">Rentals</div>
                    {tieOut.linked.rentals.map((r) => (
                      <div key={r.id}>
                        {r.booking_no || r.id.slice(0, 8)} due {r.due_amount}
                      </div>
                    ))}
                  </div>
                ) : null}
                {!tieOut.linked.sales?.length &&
                  !tieOut.linked.purchases?.length &&
                  !tieOut.linked.rentals?.length && <span className="text-gray-600">None loaded for this party type.</span>}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Linked payments</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] text-xs font-mono text-gray-400">
                {tieOut.linked.payments.map((p) => (
                  <div key={p.id} className="mb-1">
                    {p.reference_number || p.id.slice(0, 8)} {p.amount} {p.reference_type}{' '}
                    <Badge variant="outline" className="text-[9px] ml-1">
                      {p.tieToParty}
                    </Badge>
                  </div>
                ))}
                {!tieOut.linked.payments.length && <span className="text-gray-600">No payments for this contact.</span>}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/40 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Journal entries · worker lifecycle</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="py-1 pr-2">JE</th>
                      <th className="py-1 pr-2">Date</th>
                      <th className="py-1 pr-2">Ref</th>
                      {tieOut.party.type === 'worker' && (
                        <>
                          <th className="py-1 pr-2">Bucket</th>
                          <th className="py-1 pr-2">OK</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="font-mono text-gray-300">
                    {tieOut.linked.journalEntries.map((j) => (
                      <tr key={j.journal_entry_id} className="border-b border-gray-800/80">
                        <td className="py-1 pr-2">{j.entry_no || j.journal_entry_id.slice(0, 8)}</td>
                        <td className="py-1 pr-2">{j.entry_date?.slice(0, 10)}</td>
                        <td className="py-1 pr-2 truncate max-w-[180px]">
                          {j.reference_type}:{j.reference_id?.slice(0, 8) || '—'}
                        </td>
                        {tieOut.party.type === 'worker' && (
                          <>
                            <td className="py-1 pr-2 text-amber-200/90">{j.workerLifecycleBucket || '—'}</td>
                            <td className="py-1 pr-2">{j.workerRuleOk === false ? '✗' : j.workerRuleOk ? '✓' : '—'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/40 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ready-to-fix (flat)</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] text-sm">
                {repair.candidates.map((c: PartyTieOutRepairCandidate, i: number) => (
                  <div key={i} className="mb-3 border-b border-gray-800 pb-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      {sevBadge(c.severity)}
                      <Badge variant="outline" className="text-[10px]">
                        {BUCKET_LABELS[c.bucket]}
                      </Badge>
                      {c.sourceCode && (
                        <code className="text-[10px] text-gray-500">{c.sourceCode}</code>
                      )}
                    </div>
                    <p className="text-gray-300 mt-1">{c.message}</p>
                    {c.readyToFixHint && <p className="text-emerald-600/90 text-xs mt-1">{c.readyToFixHint}</p>}
                    {c.relatedIds?.length ? (
                      <p className="text-[10px] text-gray-500 mt-1">IDs: {c.relatedIds.join(', ')}</p>
                    ) : null}
                  </div>
                ))}
                {!repair.candidates.length && (
                  <p className="text-gray-500">No repair candidates in this run (within collected JEs).</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
