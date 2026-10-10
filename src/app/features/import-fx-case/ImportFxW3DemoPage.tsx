/**
 * Local-only Import FX W3 Demo UI — in-memory simulation; never posts accounting.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Ban, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  evaluateImportFxW3DemoActivation,
  IMPORT_FX_W3_DEMO_PATH,
  isImportFxW3DemoAllowed,
} from '@/app/lib/importFxW3DemoGate';
import {
  availableDemoAdvancePkr,
  createInitialImportFxW3DemoState,
  DEMO_STORAGE_KEY,
  deserializeDemoState,
  previewAdvanceDemo,
  previewUsdDemo,
  runDemoW31Scenario,
  saveDemoAdvanceDraft,
  serializeDemoState,
  simulatePostAdvance,
  simulatePostUsdAcquisition,
  simulateReverseAdvance,
  simulateReverseUsdAcquisition,
  type ImportFxW3DemoState,
} from '@/app/lib/importFxW3DemoStore';
import type { ImportFxW3FundingType } from '@/app/lib/importFxCaseW3Helpers';
import { W31_ROUTING_QUESTION } from '@/app/lib/importFxCaseW31Helpers';

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Card(props: { title: string; children: ReactNode; accent?: string }) {
  return (
    <section
      className={`rounded-lg border p-3 sm:p-4 ${props.accent || 'border-amber-700/50 bg-amber-950/20'}`}
    >
      <h2 className="text-sm font-semibold text-amber-100 mb-2">{props.title}</h2>
      <div className="text-sm text-amber-50/90 space-y-1">{props.children}</div>
    </section>
  );
}

function PreviewLines(props: {
  lines: { side: 'Dr' | 'Cr'; account: string; amount: number }[];
  balanced?: boolean;
}) {
  return (
    <div className="font-mono text-xs sm:text-sm whitespace-pre-wrap break-words bg-black/30 rounded p-2 border border-amber-800/40">
      {props.lines.map((l, i) => (
        <div key={i}>
          {l.side} {l.account} — PKR {money(l.amount)}
        </div>
      ))}
      {props.balanced === false && (
        <div className="text-red-300 mt-1">Unbalanced preview</div>
      )}
      <div className="text-[11px] text-amber-200/70 mt-2">Simulated preview only — NOT POSTED</div>
    </div>
  );
}

export function ImportFxW3DemoPage() {
  const activation = evaluateImportFxW3DemoActivation();
  const [persistLocal, setPersistLocal] = useState(false);
  const [state, setState] = useState<ImportFxW3DemoState>(() => createInitialImportFxW3DemoState());
  const [usdDate, setUsdDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [usdQty, setUsdQty] = useState('15000');
  const [pkrPerUsd, setPkrPerUsd] = useState('287.5');
  const [fundingType, setFundingType] = useState<ImportFxW3FundingType>('CREDIT');
  const [advanceApply, setAdvanceApply] = useState('');
  const [usdRef, setUsdRef] = useState('');
  const [usdNotes, setUsdNotes] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [showDemoConfirmPost, setShowDemoConfirmPost] = useState(false);
  const [demoConfirmMode, setDemoConfirmMode] = useState<'ADVANCE' | 'USD_ACQUISITION'>('ADVANCE');
  const alertRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activation.allowed) return;
    try {
      const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
      const restored = deserializeDemoState(raw);
      if (restored) {
        setState(restored);
        setPersistLocal(true);
      }
    } catch {
      /* ignore */
    }
  }, [activation.allowed]);

  useEffect(() => {
    if (!activation.allowed || !persistLocal) return;
    try {
      sessionStorage.setItem(DEMO_STORAGE_KEY, serializeDemoState(state));
    } catch {
      /* ignore */
    }
  }, [state, persistLocal, activation.allowed]);

  const availAdv = availableDemoAdvancePkr(state);
  const advAmount = Number(state.draftAdvance.amountPkr) || 0;
  const advPreview = useMemo(() => previewAdvanceDemo(state, advAmount), [state, advAmount]);

  const usdN = Number(usdQty) || 0;
  const rateN = Number(pkrPerUsd) || 0;
  const applyN =
    fundingType === 'MIXED'
      ? Number(advanceApply) || 0
      : fundingType === 'ADVANCE'
        ? undefined
        : 0;
  const usdPreview = useMemo(
    () => previewUsdDemo(fundingType, usdN, rateN, applyN),
    [fundingType, usdN, rateN, applyN]
  );

  if (!activation.allowed) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8">
        <div className="max-w-xl mx-auto border border-red-800/60 rounded-lg p-6 bg-red-950/30">
          <div className="flex items-center gap-2 text-red-200 font-semibold mb-2">
            <Ban className="h-5 w-5" /> W3 Demo Mode blocked
          </div>
          <p className="text-sm text-red-100/90">{activation.reason}</p>
          <p className="text-xs text-zinc-400 mt-3">
            Host: {activation.hostname || '(none)'} · Flag: {activation.flagOn ? 'on' : 'off'}
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            Production domains and authenticated financial services are not used by this page when blocked.
          </p>
        </div>
      </div>
    );
  }

  const run = (label: string, fn: () => ReturnType<typeof simulatePostAdvance>) => {
    setError('');
    setFlash('');
    const res = fn();
    setState(res.state);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      // Errors used to render only near the top — scroll so the message is visible.
      requestAnimationFrame(() => {
        alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return;
    }
    const okMsg = `${label}: OK — saved to Event History only (demo). Accounting NOT posted.`;
    setFlash(okMsg);
    toast.success(okMsg);
  };

  const usdAdvanceShortfall =
    fundingType !== 'CREDIT' && usdPreview.advanceAppliedPkr > availAdv + 1e-9
      ? usdPreview.advanceAppliedPkr - availAdv
      : 0;

  const resetAll = () => {
    try {
      sessionStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setPersistLocal(false);
    setState(createInitialImportFxW3DemoState());
    setError('');
    setFlash('Demo reset — all values are fake again.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-amber-950/40 to-zinc-950 text-amber-50 overflow-x-hidden">
      <header className="sticky top-0 z-50 border-b border-amber-600/50 bg-amber-900/95 backdrop-blur px-3 py-2 sm:px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 justify-between">
          <div>
            <div className="text-xs sm:text-sm font-bold tracking-wide text-amber-50">
              W3 DEMO MODE — Nothing on this screen is saved or financially posted.
            </div>
            <div className="text-[11px] text-amber-100/80">
              Case {state.caseNo} · Agent {state.agentName} · Accounting {state.accountingStatus}
            </div>
          </div>
          <span className="inline-flex items-center rounded px-2 py-1 text-xs font-bold bg-amber-400 text-zinc-900 border border-amber-200">
            DEMO — NOT POSTED
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-3 sm:p-4 space-y-4 pb-24">
        <div className="rounded-lg border border-amber-700/40 bg-black/20 p-3 text-sm space-y-1">
          <p className="font-medium text-amber-100">Expected workflow (education)</p>
          <ol className="list-decimal pl-5 space-y-1 text-amber-50/85 text-xs sm:text-sm">
            <li>Arrangement was planned in W2.</li>
            <li>Agent advance may be posted first, but demo only here.</li>
            <li>USD may be acquired on advance, credit or mixed funding.</li>
            <li>Actual W3 posting will create Agent AP/clearing and USD wallet entries.</li>
            <li>W4 will later transfer USD to China and convert it to CNY.</li>
            <li>W5 will later allocate CNY to suppliers.</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" disabled className="opacity-60">
              W4 (disabled)
            </Button>
            <Button type="button" variant="outline" disabled className="opacity-60">
              W5 (disabled)
            </Button>
            <Button type="button" variant="outline" disabled className="opacity-60">
              W6 (disabled)
            </Button>
          </div>
          <p className="text-[11px] text-amber-200/70 pt-1">
            Labels: <strong>Planned</strong> = W2 numbers · <strong>Simulated</strong> = this demo ·{' '}
            <strong>Actually Posted</strong> = never on this screen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={persistLocal}
              onChange={(e) => {
                const on = e.target.checked;
                setPersistLocal(on);
                if (!on) {
                  try {
                    sessionStorage.removeItem(DEMO_STORAGE_KEY);
                  } catch {
                    /* ignore */
                  }
                }
              }}
            />
            Keep demo in this browser tab (sessionStorage only — still not a database)
          </label>
          <Button type="button" size="sm" variant="secondary" onClick={resetAll}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset demo
          </Button>
        </div>

        {(error || flash) && (
          <div
            ref={alertRef}
            role="alert"
            className={`sticky top-14 z-40 rounded border px-3 py-2 text-sm shadow-lg ${
              error ? 'border-red-700 bg-red-950/90 text-red-100' : 'border-emerald-700 bg-emerald-950/90 text-emerald-100'
            }`}
          >
            {error || flash}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <Card title="1. Planned Arrangement">
            <div>Planned USD: {money(state.plannedUsd)} (fake)</div>
            <div>Expected CNY: {money(state.expectedCny)} (fake)</div>
            <div>Funding intention: {state.fundingIntention}</div>
            <div>PKR per USD: {state.pkrPerUsd}</div>
            <div>Expected PKR cost: {money(state.expectedPkrCost)}</div>
            <div>Assignment: {state.assignment}</div>
            <div>Arrangement: confirmed (demo)</div>
          </Card>
          <Card title="2. Actual Agent Funding">
            <div>Simulated advances: {state.advances.filter((a) => a.status === 'SIMULATED').length}</div>
            <div>Actually Posted: never</div>
          </Card>
          <Card title="3. USD Acquisition">
            <div>Simulated lots: {state.acquisitions.filter((a) => a.status === 'SIMULATED').length}</div>
            <div>Company wallet USD (sim): {money(state.walletUsdQty)}</div>
            <div>Held by agent USD (sim): {money(state.agentHeldUsdQty)}</div>
            <div>Held by third party USD (sim): {money(state.thirdPartyHeldUsdQty)}</div>
          </Card>
          <Card title="4. Available Advance">
            <div className="text-lg font-semibold">PKR {money(availAdv)}</div>
            <div className="text-xs text-amber-200/70">Simulated clearing balance only</div>
          </Card>
          <Card title="5. Agent Credit">
            <div>Agent AP preview (simulated): PKR {money(state.agentApPreviewPkr)}</div>
            <div className="text-[11px] text-amber-200/70">Separate from custody quantity</div>
          </Card>
          <Card title="6. Custody positions (operational)">
            <div>Open positions: {state.custodyPositions.filter((c) => c.status === 'OPEN').length}</div>
            <div className="text-[11px] text-amber-200/70">
              Custody ≠ Supplier AP. DEMO — NOT POSTED.
            </div>
          </Card>
        </div>

        {/* Scenario A */}
        <div id="import-fx-w3-demo-scenario-a">
        <Card title="Scenario A — Agent Advance" accent="border-sky-700/50 bg-sky-950/25">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Posting date</Label>
              <Input
                type="date"
                value={state.draftAdvance.postingDate}
                onChange={(e) =>
                  setState(saveDemoAdvanceDraft(state, { ...state.draftAdvance, postingDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Payment source</Label>
              <Input
                value={state.draftAdvance.paymentSourceLabel}
                onChange={(e) =>
                  setState(
                    saveDemoAdvanceDraft(state, {
                      ...state.draftAdvance,
                      paymentSourceLabel: e.target.value,
                    })
                  )
                }
              />
            </div>
            <div>
              <Label>PKR advance</Label>
              <Input
                inputMode="decimal"
                value={state.draftAdvance.amountPkr}
                onChange={(e) =>
                  setState(saveDemoAdvanceDraft(state, { ...state.draftAdvance, amountPkr: e.target.value }))
                }
                placeholder="e.g. 2000000"
              />
            </div>
            <div>
              <Label>Reference</Label>
              <Input
                value={state.draftAdvance.reference}
                onChange={(e) =>
                  setState(saveDemoAdvanceDraft(state, { ...state.draftAdvance, reference: e.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Input
                value={state.draftAdvance.notes}
                onChange={(e) =>
                  setState(saveDemoAdvanceDraft(state, { ...state.draftAdvance, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs font-medium mb-1">7. Accounting Preview</div>
            <PreviewLines lines={advPreview.lines} balanced={advPreview.balanced} />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFlash('Demo draft kept in memory only.')}
            >
              Save Demo Draft
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFlash('Preview only — no post.')}
            >
              Preview Entry
            </Button>
            <Button
              type="button"
              disabled={state.busy}
              onClick={() => run('Advance simulated', () => simulatePostAdvance(state))}
            >
              Simulate Post — No Accounting
            </Button>
          </div>
        </Card>
        </div>

        {/* Scenarios B–D */}
        <div id="import-fx-w3-demo-scenario-usd">
        <Card title="Scenarios B–D — USD Acquisition" accent="border-emerald-700/50 bg-emerald-950/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Posting date</Label>
              <Input type="date" value={usdDate} onChange={(e) => setUsdDate(e.target.value)} />
            </div>
            <div>
              <Label>Funding</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={fundingType}
                onChange={(e) => setFundingType(e.target.value as ImportFxW3FundingType)}
              >
                <option value="CREDIT">B — USD on Credit</option>
                <option value="ADVANCE">C — Fully Advance Funded</option>
                <option value="MIXED">D — Mixed Funding</option>
              </select>
            </div>
            <div>
              <Label>USD quantity</Label>
              <Input value={usdQty} onChange={(e) => setUsdQty(e.target.value)} />
            </div>
            <div>
              <Label>PKR per USD</Label>
              <Input value={pkrPerUsd} onChange={(e) => setPkrPerUsd(e.target.value)} />
            </div>
            {fundingType === 'MIXED' && (
              <div>
                <Label>Advance applied (PKR)</Label>
                <Input value={advanceApply} onChange={(e) => setAdvanceApply(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Reference</Label>
              <Input value={usdRef} onChange={(e) => setUsdRef(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Input value={usdNotes} onChange={(e) => setUsdNotes(e.target.value)} />
            </div>
          </div>
          <div className="mt-2 text-xs space-y-1">
            <div>Carrying value: PKR {money(usdPreview.carryingPkr)}</div>
            <div>Advance applied: PKR {money(usdPreview.advanceAppliedPkr)}</div>
            <div>Agent credit: PKR {money(usdPreview.agentApCreatedPkr)}</div>
            <div>Available demo advance: PKR {money(availAdv)}</div>
            {usdAdvanceShortfall > 0 && (
              <p className="text-red-300 flex items-start gap-1 pt-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Cannot simulate: need PKR {money(usdPreview.advanceAppliedPkr)} advance but only{' '}
                {money(availAdv)} is available (short PKR {money(usdAdvanceShortfall)}). Switch Funding to
                “B — USD on Credit”, use Mixed with a smaller advance apply, or Simulate more Advance in
                Scenario A first.
              </p>
            )}
          </div>
          <div className="mt-3">
            <div className="text-xs font-medium mb-1">7. Accounting Preview</div>
            <PreviewLines lines={usdPreview.preview.lines} balanced={usdPreview.preview.balanced} />
          </div>
          {error && (
            <div role="alert" className="mt-3 rounded border border-red-700 bg-red-950/50 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              type="button"
              disabled={state.busy || usdAdvanceShortfall > 0}
              title={
                usdAdvanceShortfall > 0
                  ? `Insufficient demo advance (need ${usdPreview.advanceAppliedPkr}, available ${availAdv})`
                  : undefined
              }
              onClick={() =>
                run('USD acquisition simulated', () =>
                  simulatePostUsdAcquisition(state, {
                    postingDate: usdDate,
                    usdQty: usdN,
                    pkrPerUsd: rateN,
                    fundingType,
                    advanceAppliedPkr: fundingType === 'MIXED' ? Number(advanceApply) || 0 : null,
                    reference: usdRef,
                    notes: usdNotes,
                  })
                )
              }
            >
              Simulate Post — No Accounting
            </Button>
          </div>
        </Card>
        </div>

        <div id="import-fx-w3-demo-scenario-w31">
          <Card title="W3.1 Custody & Routing scenarios" accent="border-cyan-700/50 bg-cyan-950/20">
            <p className="text-xs text-cyan-100/90 mb-2">
              {W31_ROUTING_QUESTION} — all buttons are DEMO — NOT POSTED. No database, journal, payment or
              supplier settlement was created.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['AGENT_HOLD_50K', '1) Hold 50k by agent'],
                  ['COMPANY_WALLET_50K', '2) Company wallet 50k'],
                  ['THIRD_PARTY_50K', '3) Third party 50k'],
                  ['SPLIT_10_8_5_27', '4) Split 10+8+5+27'],
                  ['SUPPLIER_INTERMEDIARY', '5) Supplier as intermediary'],
                  ['OVER_ALLOCATION', '6) Over-allocation (expect fail)'],
                  ['DUPLICATE_REPLAY', '7) Duplicate submit replay'],
                  ['REVERSE_BLOCKED', '8) Reverse blocked after consume'],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={state.busy}
                  onClick={() =>
                    run(label, () => runDemoW31Scenario(state, key))
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            {state.custodyPositions.length > 0 && (
              <div className="mt-3 text-xs space-y-1">
                <div className="font-medium">Custody positions (operational)</div>
                {state.custodyPositions.map((c) => (
                  <div key={c.id}>
                    {c.holderType} · {c.holderLabel} · USD {money(c.usdQty)} · PKR {money(c.pkrCarrying)} ·{' '}
                    {c.status}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {state.lastReceipt && (
          <Card title="Simulated receipt" accent="border-violet-700/50 bg-violet-950/25">
            <div>Event: {state.lastReceipt.eventNo}</div>
            <div>Fake journal preview: {state.lastReceipt.journalPreviewRef}</div>
            <div>PKR amount: {money(state.lastReceipt.amountPkr)}</div>
            <div>Clearing balance (simulated): {money(state.lastReceipt.clearingBalancePkr)}</div>
            {state.lastReceipt.replayed && (
              <div className="text-amber-200 font-medium">Idempotent replay — original result returned</div>
            )}
            <div>Timestamp: {state.lastReceipt.timestamp}</div>
            <div className="font-semibold text-violet-200">{state.lastReceipt.message}</div>
          </Card>
        )}

        <Card title="8. Event History">
          {state.history.length === 0 ? (
            <p className="text-xs text-amber-200/70">No simulated events yet.</p>
          ) : (
            <ul className="space-y-2 text-xs sm:text-sm">
              {state.history
                .slice()
                .reverse()
                .map((h) => (
                  <li
                    key={h.id}
                    className="border border-amber-800/40 rounded p-2 flex flex-col sm:flex-row sm:items-center gap-2 justify-between"
                  >
                    <div className="min-w-0 break-words">
                      <div className="font-medium">
                        {h.eventNo} · {h.kind} · {h.status}
                      </div>
                      <div className="text-amber-100/80">
                        {h.kind === 'ADVANCE'
                          ? `PKR ${money(h.amountPkr)} · rem ${money(h.remainingUnappliedPkr)}`
                          : `USD ${money(h.usdQty)} · carry PKR ${money(h.carryingPkr)} · ${h.fundingType}${
                              h.routingLabel ? ` · ${h.routingLabel}` : ''
                            }`}
                      </div>
                      {h.kind === 'USD_ACQUISITION' && (
                        <div className="text-[11px] text-cyan-200/80">
                          {(h.statusLabels || []).join(' · ')}
                          {h.distributionLines?.length
                            ? ` · ${h.distributionLines.length} instruction(s); supplierApReduced=${h.supplierApReduced}`
                            : ''}
                        </div>
                      )}
                      <div className="text-[11px]">{h.journalPreviewRef} · posts_journal: false</div>
                    </div>
                    {h.status === 'SIMULATED' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() =>
                          run(
                            'Reversal simulated',
                            () =>
                              h.kind === 'ADVANCE'
                                ? simulateReverseAdvance(state, h.id)
                                : simulateReverseUsdAcquisition(state, h.id)
                          )
                        }
                      >
                        Simulate Reversal — No Accounting
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title="9. Next Step (this demo)" accent="border-violet-700/50 bg-violet-950/20">
          {(() => {
            const advCount = state.history.filter((h) => h.kind === 'ADVANCE' && h.status === 'SIMULATED').length;
            const usdCount = state.history.filter(
              (h) => h.kind === 'USD_ACQUISITION' && h.status === 'SIMULATED'
            ).length;
            const demoDone = advCount > 0 || usdCount > 0;
            return (
              <div className="space-y-3">
                <p className="text-sm font-medium text-violet-100">
                  {demoDone
                    ? 'Demo loop complete on this page — simulations only (no journals).'
                    : 'Finish Scenario A and/or B–D with Simulate Post, then use the actions below.'}
                </p>
                <ul className="text-xs sm:text-sm space-y-1 list-disc pl-5 text-amber-50/90">
                  <li>
                    Simulated advances: <strong>{advCount}</strong>
                  </li>
                  <li>
                    Simulated USD acquisitions: <strong>{usdCount}</strong>
                  </li>
                  <li>W4–W6: still disabled (not in this demo)</li>
                  <li>
                    Live ERP Confirm &amp; Post (real journals): still deferred — use{' '}
                    <strong>Confirm &amp; Post (demo)</strong> on this page instead
                  </li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      document
                        .getElementById('import-fx-w3-demo-scenario-a')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      toast.message('Scrolled to Scenario A — Agent Advance');
                    }}
                  >
                    Go to Scenario A
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      document
                        .getElementById('import-fx-w3-demo-scenario-usd')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      toast.message('Scrolled to USD Acquisition scenarios');
                    }}
                  >
                    Go to USD scenarios
                  </Button>
                  <Button type="button" variant="outline" onClick={resetAll}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset demo
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowDemoConfirmPost(true);
                      requestAnimationFrame(() => {
                        document
                          .getElementById('import-fx-w3-demo-confirm-post')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      });
                      toast.message('Opened demo Confirm & Post — still NOT POSTED to accounting');
                    }}
                  >
                    Confirm &amp; Post (demo)
                  </Button>
                </div>
                {showDemoConfirmPost && (
                  <div
                    id="import-fx-w3-demo-confirm-post"
                    className="rounded-lg border border-violet-500/60 bg-violet-950/40 p-3 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-violet-50">
                          Confirm &amp; Post — demo only
                        </div>
                        <div className="text-[11px] text-violet-200/80">
                          Same label as live W3 UI. This control never writes journals or Supabase money RPCs.
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded px-2 py-1 text-[11px] font-bold bg-amber-400 text-zinc-900">
                        DEMO — NOT POSTED
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={demoConfirmMode === 'ADVANCE' ? 'default' : 'outline'}
                        onClick={() => setDemoConfirmMode('ADVANCE')}
                      >
                        Advance / Funding
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={demoConfirmMode === 'USD_ACQUISITION' ? 'default' : 'outline'}
                        onClick={() => setDemoConfirmMode('USD_ACQUISITION')}
                      >
                        USD Acquisition
                      </Button>
                    </div>
                    {demoConfirmMode === 'ADVANCE' ? (
                      <p className="text-xs text-amber-50/85">
                        Uses Scenario A draft (PKR advance ={' '}
                        {state.draftAdvance.amountPkr || '(empty — enter amount in Scenario A first)'}).
                      </p>
                    ) : (
                      <p className="text-xs text-amber-50/85">
                        Uses USD form above ({usdQty} USD @ {pkrPerUsd} PKR, funding {fundingType}). Available
                        advance PKR {money(availAdv)}.
                      </p>
                    )}
                    {demoConfirmMode === 'USD_ACQUISITION' && usdAdvanceShortfall > 0 && (
                      <p className="text-xs text-red-300 flex items-start gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        Insufficient demo advance for this funding mode. Switch to Credit or add more advance
                        first.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={
                          state.busy ||
                          (demoConfirmMode === 'USD_ACQUISITION' && usdAdvanceShortfall > 0)
                        }
                        onClick={() => {
                          if (demoConfirmMode === 'ADVANCE') {
                            run('Confirm & Post (demo advance)', () => simulatePostAdvance(state));
                          } else {
                            run('Confirm & Post (demo USD)', () =>
                              simulatePostUsdAcquisition(state, {
                                postingDate: usdDate,
                                usdQty: usdN,
                                pkrPerUsd: rateN,
                                fundingType,
                                advanceAppliedPkr:
                                  fundingType === 'MIXED' ? Number(advanceApply) || 0 : null,
                                reference: usdRef,
                                notes: usdNotes,
                              })
                            );
                          }
                        }}
                      >
                        Confirm &amp; Post
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowDemoConfirmPost(false)}
                      >
                        Hide panel
                      </Button>
                    </div>
                    <p className="text-[11px] text-amber-200/70">
                      Real ERP Confirm &amp; Post (Purchases → Import FX Cases → Advance) stays blocked until
                      the separate live W3 finish pass on a non-production database.
                    </p>
                  </div>
                )}
                <p className="text-xs text-amber-200/70 flex items-start gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Demo Confirm &amp; Post only updates Event History on this page. It does not unlock live
                  money posting in the main ERP workspace.
                </p>
              </div>
            );
          })()}
        </Card>
      </main>
    </div>
  );
}

/** Tiny entry used from authenticated ERP when demo is allowed. */
export function ImportFxW3DemoEntryLink() {
  if (!isImportFxW3DemoAllowed()) return null;
  return (
    <a
      href={IMPORT_FX_W3_DEMO_PATH}
      className="inline-flex items-center rounded-md border border-amber-500/60 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-800/50"
    >
      Open W3 Demo
    </a>
  );
}

export default ImportFxW3DemoPage;
