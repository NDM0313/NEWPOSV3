/**
 * Import FX Case workspace (Wave W1).
 * Draft / resume / confirm Arrangement only. Money stages shown as blocked until later waves.
 * Path 21 Agent FX wizard remains available separately.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { SearchableSelect } from '@/app/components/ui/searchable-select';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import {
  resolveActiveImportCurrencies,
  type ImportDocCurrency,
} from '@/app/lib/importFxHelpers';
import { formatImportFxServerError } from '@/app/lib/importFxServerGate';
import {
  isMoneyStageBlockedInW1,
  isW1ConfirmableStage,
  stageLabel,
  stageStatusTone,
} from '@/app/lib/importFxCaseHelpers';
import { contactService } from '@/app/services/contactService';
import {
  cancelImportFxCaseUnposted,
  confirmImportFxCaseStage,
  createImportFxCase,
  getImportFxCase,
  IMPORT_FX_STAGE_ORDER,
  listImportFxCases,
  updateImportFxCaseDraft,
  type ImportFxArrangementType,
  type ImportFxCase,
  type ImportFxCaseEvent,
  type ImportFxCaseStage,
  type ImportFxStageCode,
} from '@/app/services/importFxCaseService';
import { cn } from '@/app/components/ui/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function toneClass(tone: ReturnType<typeof stageStatusTone>): string {
  switch (tone) {
    case 'green':
      return 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'amber':
      return 'border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-200';
    case 'red':
      return 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-300';
    default:
      return 'border-border bg-muted/40 text-muted-foreground';
  }
}

export function ImportFxCaseWorkspace({ open, onOpenChange }: Props) {
  const { companyId, branchId, user } = useSupabase();
  const { accountingSettings } = useSettings();
  const multiCurrencyEnabled = accountingSettings?.multiCurrencyEnabled === true;
  const activeCurrencies = useMemo(
    () => resolveActiveImportCurrencies(accountingSettings),
    [accountingSettings]
  );

  const [loadingList, setLoadingList] = useState(false);
  const [cases, setCases] = useState<ImportFxCase[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [caseRow, setCaseRow] = useState<ImportFxCase | null>(null);
  const [stages, setStages] = useState<ImportFxCaseStage[]>([]);
  const [events, setEvents] = useState<ImportFxCaseEvent[]>([]);
  const [activeStage, setActiveStage] = useState<ImportFxStageCode>('ARRANGEMENT');
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  const [agentOptions, setAgentOptions] = useState<{ id: string; name: string }[]>([]);
  const [agentId, setAgentId] = useState<string>('');
  const [thirdPartyId, setThirdPartyId] = useState<string>('');
  const [arrangementType, setArrangementType] =
    useState<ImportFxArrangementType>('POOLED_USD_CNY');
  const [plannedCurrency, setPlannedCurrency] = useState<ImportDocCurrency | string>('USD');
  const [plannedUsd, setPlannedUsd] = useState('');
  const [expectedPkrPerUsd, setExpectedPkrPerUsd] = useState('');
  const [expectedCnyPerUsd, setExpectedCnyPerUsd] = useState('');
  const [expectedCny, setExpectedCny] = useState('');
  const [expectedFees, setExpectedFees] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');

  const loadAgents = useCallback(async () => {
    if (!companyId) return;
    try {
      const contacts = await contactService.getContacts(companyId);
      const agents = (contacts || [])
        .filter((c: { type?: string }) => String(c.type || '').toLowerCase() === 'money_exchange')
        .map((c: { id: string; name?: string; code?: string }) => ({
          id: c.id,
          name: `${c.name || 'Agent'}${c.code ? ` (${c.code})` : ''}`,
        }));
      setAgentOptions(agents);
    } catch {
      setAgentOptions([]);
    }
  }, [companyId]);

  const refreshList = useCallback(async () => {
    if (!companyId || !multiCurrencyEnabled) return;
    setLoadingList(true);
    try {
      const { rows } = await listImportFxCases({
        companyId,
        branchId: branchId ?? null,
        search: search.trim() || null,
        limit: 50,
      });
      setCases(rows);
    } catch (e) {
      toast.error(formatImportFxServerError(e));
    } finally {
      setLoadingList(false);
    }
  }, [companyId, branchId, multiCurrencyEnabled, search]);

  const loadDetail = useCallback(
    async (caseId: string) => {
      if (!companyId) return;
      setDetailLoading(true);
      try {
        const detail = await getImportFxCase(companyId, caseId);
        setCaseRow(detail.case);
        setStages(detail.stages);
        setEvents(detail.events);
        setAgentId(detail.case.agent_contact_id || '');
        setThirdPartyId(detail.case.third_party_contact_id || '');
        setArrangementType(detail.case.arrangement_type || 'POOLED_USD_CNY');
        setPlannedCurrency(detail.case.planned_source_currency || 'USD');
        setPlannedUsd(
          detail.case.planned_usd_amount != null ? String(detail.case.planned_usd_amount) : ''
        );
        setExpectedPkrPerUsd(
          detail.case.expected_pkr_per_usd != null ? String(detail.case.expected_pkr_per_usd) : ''
        );
        setExpectedCnyPerUsd(
          detail.case.expected_cny_per_usd != null ? String(detail.case.expected_cny_per_usd) : ''
        );
        setExpectedCny(
          detail.case.expected_cny_amount != null ? String(detail.case.expected_cny_amount) : ''
        );
        setExpectedFees(
          detail.case.expected_fees_pkr != null ? String(detail.case.expected_fees_pkr) : ''
        );
        setExpectedDate(detail.case.expected_completion_date || '');
        setNotes(detail.case.notes || '');
        const firstOpen =
          detail.stages.find((s) => s.stage_status !== 'COMPLETED' && s.stage_status !== 'CANCELLED')
            ?.stage_code || 'ARRANGEMENT';
        setActiveStage(firstOpen);
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      } finally {
        setDetailLoading(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    if (!open || !multiCurrencyEnabled) return;
    void loadAgents();
    void refreshList();
  }, [open, multiCurrencyEnabled, loadAgents, refreshList]);

  useEffect(() => {
    if (!open || !selectedCaseId) return;
    void loadDetail(selectedCaseId);
  }, [open, selectedCaseId, loadDetail]);

  const activeStageRow = useMemo(
    () => stages.find((s) => s.stage_code === activeStage) || null,
    [stages, activeStage]
  );

  const runBusy = async (fn: () => Promise<void>) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!companyId) return;
    await runBusy(async () => {
      const created = await createImportFxCase({
        companyId,
        branchId: branchId ?? null,
        arrangementType,
        agentContactId: agentId || null,
        thirdPartyContactId: thirdPartyId || null,
        plannedSourceCurrency: plannedCurrency || null,
        plannedUsdAmount: plannedUsd ? Number(plannedUsd) : null,
        expectedPkrPerUsd: expectedPkrPerUsd ? Number(expectedPkrPerUsd) : null,
        expectedCnyPerUsd: expectedCnyPerUsd ? Number(expectedCnyPerUsd) : null,
        expectedCnyAmount: expectedCny ? Number(expectedCny) : null,
        expectedFeesPkr: expectedFees ? Number(expectedFees) : null,
        expectedCompletionDate: expectedDate || null,
        notes: notes || null,
        createdBy: user?.id ?? null,
      });
      toast.success(`Case ${created.caseNo} created (draft)`);
      setSelectedCaseId(created.caseId);
      await refreshList();
    });
  };

  const handleSaveDraft = async () => {
    if (!companyId || !selectedCaseId) return;
    await runBusy(async () => {
      await updateImportFxCaseDraft({
        companyId,
        caseId: selectedCaseId,
        agentContactId: agentId || null,
        thirdPartyContactId: thirdPartyId || null,
        plannedSourceCurrency: plannedCurrency || null,
        plannedUsdAmount: plannedUsd ? Number(plannedUsd) : null,
        expectedPkrPerUsd: expectedPkrPerUsd ? Number(expectedPkrPerUsd) : null,
        expectedCnyPerUsd: expectedCnyPerUsd ? Number(expectedCnyPerUsd) : null,
        expectedCnyAmount: expectedCny ? Number(expectedCny) : null,
        expectedFeesPkr: expectedFees ? Number(expectedFees) : null,
        expectedCompletionDate: expectedDate || null,
        notes: notes || null,
        updatedBy: user?.id ?? null,
        clearAgent: !agentId,
        clearThirdParty: !thirdPartyId,
      });
      toast.success('Draft saved — no journal posted');
      await loadDetail(selectedCaseId);
      await refreshList();
    });
  };

  const handleConfirmArrangement = async () => {
    if (!companyId || !selectedCaseId) return;
    if (!isW1ConfirmableStage(activeStage)) {
      toast.error('W1: only Arrangement can be confirmed. Money stages ship in later waves.');
      return;
    }
    await runBusy(async () => {
      await updateImportFxCaseDraft({
        companyId,
        caseId: selectedCaseId,
        agentContactId: agentId || null,
        thirdPartyContactId: thirdPartyId || null,
        plannedSourceCurrency: plannedCurrency || null,
        plannedUsdAmount: plannedUsd ? Number(plannedUsd) : null,
        expectedPkrPerUsd: expectedPkrPerUsd ? Number(expectedPkrPerUsd) : null,
        expectedCnyPerUsd: expectedCnyPerUsd ? Number(expectedCnyPerUsd) : null,
        expectedCnyAmount: expectedCny ? Number(expectedCny) : null,
        expectedFeesPkr: expectedFees ? Number(expectedFees) : null,
        expectedCompletionDate: expectedDate || null,
        notes: notes || null,
        updatedBy: user?.id ?? null,
      });
      const result = await confirmImportFxCaseStage({
        companyId,
        caseId: selectedCaseId,
        stageCode: 'ARRANGEMENT',
        notes: notes || null,
        createdBy: user?.id ?? null,
        clientOperationId: crypto.randomUUID(),
      });
      toast.success(
        result.idempotentReplay
          ? 'Arrangement already confirmed'
          : `Arrangement confirmed → ${result.operationalStatus} (no journal)`
      );
      await loadDetail(selectedCaseId);
      await refreshList();
    });
  };

  const handleCancel = async () => {
    if (!companyId || !selectedCaseId) return;
    await runBusy(async () => {
      await cancelImportFxCaseUnposted({
        companyId,
        caseId: selectedCaseId,
        notes: notes || 'Cancelled unposted case',
        updatedBy: user?.id ?? null,
      });
      toast.success('Unposted case cancelled');
      await loadDetail(selectedCaseId);
      await refreshList();
    });
  };

  if (!open) return null;

  if (!multiCurrencyEnabled) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-3">
          <p className="text-foreground font-medium">Multi Currency is OFF</p>
          <p className="text-sm text-muted-foreground">
            Enable Multi Currency in Settings to use Import FX Cases.
          </p>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-2 md:p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Import FX Cases</h2>
            <p className="text-xs text-muted-foreground">
              Wave W1 — draft / resume / arrangement only. No money journals. Path 21 Agent FX stays
              separate.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12">
          {/* List */}
          <aside className="md:col-span-3 border-r border-border p-3 space-y-2 overflow-y-auto">
            <div className="flex gap-2">
              <Input
                placeholder="Search case no…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
              <Button variant="outline" size="icon" onClick={() => void refreshList()} disabled={loadingList}>
                {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              className="w-full h-9 gap-1"
              variant="secondary"
              onClick={() => {
                setSelectedCaseId(null);
                setCaseRow(null);
                setStages([]);
                setEvents([]);
                setActiveStage('ARRANGEMENT');
              }}
            >
              <Plus className="h-4 w-4" /> New draft
            </Button>
            <div className="space-y-1">
              {cases.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCaseId(c.id)}
                  className={cn(
                    'w-full text-left rounded-md border px-2 py-2 text-sm transition-colors',
                    selectedCaseId === c.id
                      ? 'border-orange-600 bg-orange-500/10'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <div className="font-medium text-foreground">{c.case_no}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.operational_status} · {c.accounting_status}
                  </div>
                </button>
              ))}
              {!loadingList && cases.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">No cases yet.</p>
              )}
            </div>
          </aside>

          {/* Timeline */}
          <nav className="md:col-span-3 border-r border-border p-3 overflow-y-auto space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Timeline</p>
            {IMPORT_FX_STAGE_ORDER.map((s) => {
              const row = stages.find((x) => x.stage_code === s.code);
              const status = (row?.stage_status || 'NOT_STARTED') as ImportFxCaseStage['stage_status'];
              const blocked = isMoneyStageBlockedInW1(s.code);
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => setActiveStage(s.code)}
                  className={cn(
                    'w-full text-left rounded-md border px-2 py-2 text-sm',
                    activeStage === s.code ? 'ring-1 ring-orange-600' : '',
                    toneClass(stageStatusTone(status))
                  )}
                >
                  <div className="font-medium">{s.label}</div>
                  <div className="text-[11px] opacity-80">
                    {status}
                    {blocked ? ' · W2+ money' : ''}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Center form */}
          <main className="md:col-span-4 p-4 overflow-y-auto space-y-4">
            {detailLoading && selectedCaseId ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading case…
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold text-foreground">{stageLabel(activeStage)}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {caseRow
                      ? `${caseRow.case_no} · ops ${caseRow.operational_status} · acct ${caseRow.accounting_status}`
                      : 'New case — Save creates a draft with no journal.'}
                  </p>
                  {activeStageRow && (
                    <p className="text-xs mt-1 text-muted-foreground">
                      Stage status: {activeStageRow.stage_status}
                    </p>
                  )}
                </div>

                {isMoneyStageBlockedInW1(activeStage) ? (
                  <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                    This money stage is designed for later waves (W2–W5). W1 only persists the case
                    shell and Arrangement planning. Use Path 21 <strong>Agent FX</strong> for same-session
                    credit settle until those waves ship.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!selectedCaseId && (
                      <div className="space-y-1">
                        <Label>Arrangement type</Label>
                        <Select
                          value={arrangementType}
                          onValueChange={(v) => setArrangementType(v as ImportFxArrangementType)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="POOLED_USD_CNY">Pooled USD → CNY</SelectItem>
                            <SelectItem value="PATH_21_AGENT_DUAL_CREDIT">Path 21 Agent Dual Credit</SelectItem>
                            <SelectItem value="AGENT_PREPAID">Agent prepaid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label>Agent (money_exchange)</Label>
                      <SearchableSelect
                        options={agentOptions}
                        value={agentId}
                        onValueChange={setAgentId}
                        placeholder="Select agent…"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Third party (optional)</Label>
                      <SearchableSelect
                        options={agentOptions}
                        value={thirdPartyId}
                        onValueChange={setThirdPartyId}
                        placeholder="Converter / custodian…"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Planned currency</Label>
                        <Select value={String(plannedCurrency)} onValueChange={setPlannedCurrency}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {activeCurrencies.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.label || c.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Expected completion</Label>
                        <Input
                          type="date"
                          value={expectedDate}
                          onChange={(e) => setExpectedDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Planned USD</Label>
                        <Input value={plannedUsd} onChange={(e) => setPlannedUsd(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Expected CNY</Label>
                        <Input value={expectedCny} onChange={(e) => setExpectedCny(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>PKR / USD (expected)</Label>
                        <Input
                          value={expectedPkrPerUsd}
                          onChange={(e) => setExpectedPkrPerUsd(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>CNY / USD (expected)</Label>
                        <Input
                          value={expectedCnyPerUsd}
                          onChange={(e) => setExpectedCnyPerUsd(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label>Expected fees (PKR)</Label>
                        <Input value={expectedFees} onChange={(e) => setExpectedFees(e.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Notes</Label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {!selectedCaseId ? (
                    <Button onClick={() => void handleCreate()} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Create Draft Case
                    </Button>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => void handleSaveDraft()} disabled={busy}>
                        Save Draft
                      </Button>
                      {isW1ConfirmableStage(activeStage) && (
                        <Button onClick={() => void handleConfirmArrangement()} disabled={busy}>
                          Confirm Arrangement
                        </Button>
                      )}
                      {caseRow?.accounting_status === 'NOT_POSTED' &&
                        caseRow.operational_status !== 'CANCELLED' && (
                          <Button variant="destructive" onClick={() => void handleCancel()} disabled={busy}>
                            Cancel Unposted
                          </Button>
                        )}
                    </>
                  )}
                </div>
              </>
            )}
          </main>

          {/* Right summary */}
          <aside className="md:col-span-2 border-l border-border p-3 overflow-y-auto space-y-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Live summary</p>
            <div className="space-y-1 text-muted-foreground">
              <div>Planned USD: {plannedUsd || '—'}</div>
              <div>Expected CNY: {expectedCny || '—'}</div>
              <div>PKR/USD: {expectedPkrPerUsd || '—'}</div>
              <div>Fees PKR: {expectedFees || '—'}</div>
              <div className="pt-2 text-xs">
                Journal preview: <span className="text-foreground">none (W1 planning)</span>
              </div>
              <div className="text-xs">Accounting: {caseRow?.accounting_status || 'NOT_POSTED'}</div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Recent events</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {events.slice(0, 12).map((e) => (
                  <li key={e.id} className="text-[11px] text-muted-foreground border-b border-border/50 pb-1">
                    <span className="text-foreground">{e.event_type}</span>
                    {e.posts_journal ? ' · JE!' : ' · no JE'}
                  </li>
                ))}
                {events.length === 0 && <li className="text-[11px] text-muted-foreground">No events</li>}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
