/**
 * Local-only Import FX W3 Demo UI — in-memory simulation; never posts accounting.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Ban, RefreshCw } from 'lucide-react';
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
  saveDemoAdvanceDraft,
  serializeDemoState,
  simulatePostAdvance,
  simulatePostUsdAcquisition,
  simulateReverseAdvance,
  simulateReverseUsdAcquisition,
  type ImportFxW3DemoState,
} from '@/app/lib/importFxW3DemoStore';
import type { ImportFxW3FundingType } from '@/app/lib/importFxCaseW3Helpers';

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
      return;
    }
    setFlash(`${label}: ${res.receipt?.message || 'Simulated — no accounting.'}`);
  };

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
            className={`rounded border px-3 py-2 text-sm ${
              error ? 'border-red-700 bg-red-950/40 text-red-100' : 'border-emerald-700 bg-emerald-950/30 text-emerald-100'
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
            <div>Wallet USD qty (simulated): {money(state.walletUsdQty)}</div>
          </Card>
          <Card title="4. Available Advance">
            <div className="text-lg font-semibold">PKR {money(availAdv)}</div>
            <div className="text-xs text-amber-200/70">Simulated clearing balance only</div>
          </Card>
          <Card title="5. Agent Credit">
            <div>Agent AP preview (simulated): PKR {money(state.agentApPreviewPkr)}</div>
          </Card>
          <Card title="6. USD Wallet Quantity">
            <div>Demo USD TT Wallet: {money(state.walletUsdQty)} USD</div>
            <div>Carrying on open sims: see history</div>
          </Card>
        </div>

        {/* Scenario A */}
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

        {/* Scenarios B–D */}
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
          </div>
          <div className="mt-3">
            <div className="text-xs font-medium mb-1">7. Accounting Preview</div>
            <PreviewLines lines={usdPreview.preview.lines} balanced={usdPreview.preview.balanced} />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              type="button"
              disabled={state.busy}
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

        {state.lastReceipt && (
          <Card title="Simulated receipt" accent="border-violet-700/50 bg-violet-950/25">
            <div>Event: {state.lastReceipt.eventNo}</div>
            <div>Fake journal preview: {state.lastReceipt.journalPreviewRef}</div>
            <div>PKR amount: {money(state.lastReceipt.amountPkr)}</div>
            <div>Clearing balance (simulated): {money(state.lastReceipt.clearingBalancePkr)}</div>
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
                          : `USD ${money(h.usdQty)} · carry PKR ${money(h.carryingPkr)} · ${h.fundingType}`}
                      </div>
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

        <Card title="9. Next Step">
          <p>
            After real W3 server migrations exist on a <strong>non-production</strong> database, use the live
            Import FX workspace Confirm &amp; Post. This demo never enables that path.
          </p>
          <p className="text-xs text-amber-200/70 flex items-start gap-1 mt-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Refresh resets demo unless the sessionStorage option above is checked.
          </p>
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
