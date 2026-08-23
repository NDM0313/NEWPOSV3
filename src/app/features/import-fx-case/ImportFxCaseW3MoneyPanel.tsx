/**
 * W3 Agent Advance + USD Acquisition panels (actual posting when server migration installed).
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { useSettings } from '@/app/context/SettingsContext';
import {
  buildAdvanceJournalPreview,
  buildUsdAcquisitionJournalPreview,
  computeUsdCarryingPkr,
  splitFundingAmounts,
  W3_CLEARING_HELP,
  W3_MIGRATION_NOT_INSTALLED,
  type ImportFxW3FundingType,
} from '@/app/lib/importFxCaseW3Helpers';
import {
  getImportFxCaseMoneyOverview,
  postImportFxAgentAdvance,
  postImportFxUsdAcquisition,
  postImportFxUsdAcquisitionWithRouting,
  probeImportFxW3Capability,
  reverseImportFxAgentAdvance,
  reverseImportFxUsdAcquisition,
} from '@/app/services/importFxCaseW3Service';
import { isLiquidityPaymentAccount } from '@/app/lib/liquidityPaymentAccount';
import { isPartyTtAgentWalletAccount } from '@/app/lib/liquidityPaymentAccount';
import { ImportFxW3DemoEntryLink } from '@/app/features/import-fx-case/ImportFxW3DemoPage';
import { ImportFxCaseW31RoutingFields } from '@/app/features/import-fx-case/ImportFxCaseW31RoutingFields';
import {
  validateRoutingAllocation,
  type ImportFxW31RoutingMode,
  type W31DistributionDraftRow,
} from '@/app/lib/importFxCaseW31Helpers';
import type { ImportFxCaseAttachmentMeta } from '@/app/services/importFxCaseService';

type AccountOpt = {
  id: string;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  is_group?: boolean | null;
  is_active?: boolean | null;
};

type Props = {
  mode: 'ADVANCE' | 'USD_ACQUISITION';
  companyId: string;
  branchId: string | null;
  caseId: string;
  caseNo?: string | null;
  agentName?: string | null;
  plannedAdvancePkr?: number | null;
  plannedUsd?: number | null;
  plannedPkrPerUsd?: number | null;
  clearingAccountId?: string | null;
  custodyControlAccountId?: string | null;
  agentContactId?: string | null;
  contactOptions?: { id: string; name?: string | null; type?: string | null }[];
  accounts: AccountOpt[];
  userId?: string | null;
  readOnly?: boolean;
  onPosted?: () => void;
  attachments?: ImportFxCaseAttachmentMeta[];
  onRegisterAttachment?: (fileName: string) => Promise<void> | void;
  attachmentBusy?: boolean;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export const W3_SOFT_PATH21_REF_TIP =
  'External reference filled — if this was already posted via Agent FX / Path 21, do not double-post.';

function isClearingCandidate(a: AccountOpt): boolean {
  return (
    !!a &&
    !a.is_group &&
    a.is_active !== false &&
    String(a.type || '').toLowerCase() === 'asset' &&
    String(a.code || '').trim() !== '1180'
  );
}

export function ImportFxCaseW3MoneyPanel(props: Props) {
  const {
    mode,
    companyId,
    branchId,
    caseId,
    agentName,
    plannedAdvancePkr,
    plannedUsd,
    plannedPkrPerUsd,
    clearingAccountId,
    custodyControlAccountId,
    agentContactId,
    contactOptions = [],
    accounts,
    userId,
    readOnly,
    onPosted,
    attachments = [],
    onRegisterAttachment,
    attachmentBusy,
  } = props;

  const { updateAccountingSettings } = useSettings();

  const [installed, setInstalled] = useState<boolean | null>(null);
  const [custodyRouting, setCustodyRouting] = useState(false);
  const [installMsg, setInstallMsg] = useState('');
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearingSaving, setClearingSaving] = useState(false);
  const [attachName, setAttachName] = useState('');

  // Advance form
  const [advDate, setAdvDate] = useState(todayIsoDate());
  const [advAmount, setAdvAmount] = useState('');
  const [paymentSourceId, setPaymentSourceId] = useState('');
  const [advRef, setAdvRef] = useState('');
  const [advNotes, setAdvNotes] = useState('');

  // USD form
  const [usdDate, setUsdDate] = useState(todayIsoDate());
  const [usdQty, setUsdQty] = useState(String(plannedUsd || ''));
  const [pkrPerUsd, setPkrPerUsd] = useState(String(plannedPkrPerUsd || ''));
  const [walletId, setWalletId] = useState('');
  const [fundingType, setFundingType] = useState<ImportFxW3FundingType>('CREDIT');
  const [routingMode, setRoutingMode] = useState<ImportFxW31RoutingMode>('COMPANY_WALLET');
  const [holderContactId, setHolderContactId] = useState('');
  const [retainedUsd, setRetainedUsd] = useState('');
  const [distributionRows, setDistributionRows] = useState<W31DistributionDraftRow[]>([]);
  const [advanceApply, setAdvanceApply] = useState('');
  const [usdRef, setUsdRef] = useState('');
  const [usdNotes, setUsdNotes] = useState('');

  const cashAccounts = useMemo(
    () => accounts.filter((a) => isLiquidityPaymentAccount(a as any) && !a.is_group && a.is_active !== false),
    [accounts]
  );
  const wallets = useMemo(
    () => accounts.filter((a) => isPartyTtAgentWalletAccount(a as any) && a.is_active !== false),
    [accounts]
  );
  const clearingCandidates = useMemo(() => accounts.filter(isClearingCandidate), [accounts]);

  const clearingLabel = useMemo(() => {
    const a = accounts.find((x) => x.id === clearingAccountId);
    return a
      ? `${a.code || ''} ${a.name || ''}`.trim() || 'Agent FX Advance / Settlement Clearing'
      : 'Agent FX Advance / Settlement Clearing (not configured)';
  }, [accounts, clearingAccountId]);

  const refresh = async () => {
    const cap = await probeImportFxW3Capability(true);
    setInstalled(cap.installed);
    setCustodyRouting(!!cap.custodyRouting);
    setInstallMsg(cap.message || '');
    if (!cap.installed) {
      setOverview(null);
      return;
    }
    const ov = await getImportFxCaseMoneyOverview(companyId, caseId);
    if ((ov as any).success === false) {
      setOverview(null);
      return;
    }
    setOverview(ov as Record<string, unknown>);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, caseId]);

  const carrying = computeUsdCarryingPkr(Number(usdQty) || 0, Number(pkrPerUsd) || 0);
  const split = splitFundingAmounts(
    fundingType,
    carrying,
    fundingType === 'MIXED' ? Number(advanceApply) || 0 : undefined
  );

  const advPreview = buildAdvanceJournalPreview({
    clearingLabel,
    paymentSourceLabel:
      cashAccounts.find((a) => a.id === paymentSourceId)?.name || 'Cash/Bank',
    amountPkr: Number(advAmount) || 0,
  });

  const debitAssetLabel = (() => {
    if (!custodyRouting || routingMode === 'COMPANY_WALLET') {
      return wallets.find((a) => a.id === walletId)?.name || 'USD/TT Wallet';
    }
    const ctrl = accounts.find((x) => x.id === custodyControlAccountId);
    return ctrl
      ? `${ctrl.code || ''} ${ctrl.name || ''}`.trim() || 'USD Custody Control'
      : 'USD Custody Control (not configured)';
  })();

  const usdPreview = buildUsdAcquisitionJournalPreview({
    walletLabel: debitAssetLabel,
    clearingLabel,
    agentApLabel: 'Agent AP',
    carryingPkr: carrying,
    advanceAppliedPkr: split.advanceAppliedPkr,
    agentApCreatedPkr: split.agentApCreatedPkr,
  });

  const softPath21Tip =
    mode === 'ADVANCE'
      ? Boolean(advRef.trim()) && W3_SOFT_PATH21_REF_TIP
      : Boolean(usdRef.trim()) && W3_SOFT_PATH21_REF_TIP;

  const advConfirmBlockedReason = (() => {
    if (readOnly) return 'Blocked: case is read-only';
    if (!clearingAccountId) return 'Blocked: clearing account not set';
    if (!(Number(advAmount) > 0)) return 'Blocked: enter a positive PKR amount';
    if (!paymentSourceId) return 'Blocked: select payment source (Cash/Bank)';
    if (!advPreview.balanced) return 'Blocked: journal preview is not balanced';
    return null;
  })();

  const routingValidation = custodyRouting
    ? validateRoutingAllocation({
        routingMode,
        acquiredUsd: Number(usdQty) || 0,
        retainedUsd:
          routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE'
            ? Number(retainedUsd) || 0
            : Number(usdQty) || 0,
        distributionRows,
        destinationWalletId: walletId || null,
        holderContactId: holderContactId || null,
        agentContactId: agentContactId || null,
      })
    : null;

  const usdConfirmBlockedReason = (() => {
    if (readOnly) return 'Blocked: case is read-only';
    if ((fundingType === 'ADVANCE' || fundingType === 'MIXED') && !clearingAccountId) {
      return 'Blocked: clearing account not set (required for ADVANCE/MIXED)';
    }
    if (!(Number(usdQty) > 0) || !(Number(pkrPerUsd) > 0)) {
      return 'Blocked: USD quantity and PKR/USD rate required';
    }
    if (custodyRouting) {
      if (routingMode !== 'COMPANY_WALLET' && !custodyControlAccountId) {
        return 'Blocked: Import FX USD Custody Control not configured in Settings';
      }
      if (routingValidation && !routingValidation.ok) {
        return `Blocked: ${routingValidation.message}`;
      }
    } else if (!walletId) {
      return 'Blocked: select destination USD/TT wallet';
    }
    if (!usdPreview.balanced) return 'Blocked: journal preview is not balanced';
    return null;
  })();

  const handleClearingChange = async (accountId: string) => {
    if (readOnly || clearingSaving) return;
    setClearingSaving(true);
    try {
      await updateAccountingSettings({
        agentFxAdvanceClearingAccountId: accountId || null,
      });
      toast.success(
        accountId
          ? 'Clearing account saved — Confirm & Post can unlock'
          : 'Clearing account cleared'
      );
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save clearing account');
    } finally {
      setClearingSaving(false);
    }
  };

  const handleRegisterAttach = async () => {
    if (!onRegisterAttachment || readOnly) return;
    const name = attachName.trim();
    if (!name) {
      toast.error('Enter a file name or reference (metadata only)');
      return;
    }
    await onRegisterAttachment(name);
    setAttachName('');
  };

  const runPostAdvance = async () => {
    if (readOnly || busy) return;
    if (!clearingAccountId) {
      toast.error('Configure Agent FX Advance / Settlement Clearing before posting.');
      return;
    }
    if (!paymentSourceId || !(Number(advAmount) > 0)) {
      toast.error('Payment source and positive PKR amount are required');
      return;
    }
    setBusy(true);
    try {
      const res = await postImportFxAgentAdvance({
        companyId,
        branchId,
        caseId,
        postingDate: advDate,
        amountPkr: Number(advAmount),
        paymentSourceAccountId: paymentSourceId,
        externalReference: advRef || undefined,
        notes: advNotes || undefined,
        clientOperationId: crypto.randomUUID(),
        createdBy: userId,
      });
      if ((res as any).success === false) {
        toast.error(String((res as any).code || (res as any).error || 'Advance post failed'));
        return;
      }
      toast.success(
        (res as any).idempotent_replay
          ? 'Advance already posted (idempotent replay)'
          : `Advance posted · JE ${(res as any).entry_no || (res as any).journal_entry_id}`
      );
      setConfirmOpen(false);
      setAdvAmount('');
      await refresh();
      onPosted?.();
    } catch (e: any) {
      toast.error(e?.message || 'Advance post failed');
    } finally {
      setBusy(false);
    }
  };

  const runPostUsd = async () => {
    if (readOnly || busy) return;
    if (!(Number(usdQty) > 0) || !(Number(pkrPerUsd) > 0)) {
      toast.error('USD quantity and PKR/USD rate are required');
      return;
    }
    if ((fundingType === 'ADVANCE' || fundingType === 'MIXED') && !clearingAccountId) {
      toast.error('Clearing account required for ADVANCE/MIXED funding');
      return;
    }
    if (usdConfirmBlockedReason) {
      toast.error(usdConfirmBlockedReason);
      return;
    }
    setBusy(true);
    try {
      const clientOperationId = crypto.randomUUID();
      let res: Record<string, unknown>;
      if (custodyRouting) {
        const holder =
          routingMode === 'AGENT_CUSTODY'
            ? agentContactId || null
            : routingMode === 'THIRD_PARTY_CUSTODY'
              ? holderContactId || null
              : routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE'
                ? holderContactId || agentContactId || null
                : null;
        res = await postImportFxUsdAcquisitionWithRouting({
          companyId,
          branchId,
          caseId,
          acquisitionDate: usdDate,
          usdQuantity: Number(usdQty),
          pkrPerUsd: Number(pkrPerUsd),
          routingMode,
          destinationWalletAccountId:
            routingMode === 'COMPANY_WALLET' ||
            (routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE' && walletId)
              ? walletId || null
              : null,
          holderContactId: holder,
          retainedUsdQty:
            routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE' ? Number(retainedUsd) || 0 : null,
          distributionRows: distributionRows.map((r) => ({
            recipient_contact_id: r.recipient_contact_id,
            recipient_role: r.recipient_role || null,
            purpose: r.purpose,
            linked_purchase_id: r.linked_purchase_id || null,
            usd_qty: r.usd_qty,
            notes: r.notes || null,
            reference: r.reference || null,
          })),
          fundingType,
          advanceAppliedPkr: fundingType === 'MIXED' ? split.advanceAppliedPkr : undefined,
          useFifo: true,
          externalReference: usdRef || undefined,
          notes: usdNotes || undefined,
          clientOperationId,
          createdBy: userId,
        });
      } else {
        if (!walletId) {
          toast.error('Select destination USD/TT wallet');
          setBusy(false);
          return;
        }
        res = await postImportFxUsdAcquisition({
          companyId,
          branchId,
          caseId,
          acquisitionDate: usdDate,
          usdQuantity: Number(usdQty),
          pkrPerUsd: Number(pkrPerUsd),
          destinationWalletAccountId: walletId,
          fundingType,
          advanceAppliedPkr: fundingType === 'MIXED' ? split.advanceAppliedPkr : undefined,
          useFifo: true,
          externalReference: usdRef || undefined,
          notes: usdNotes || undefined,
          clientOperationId,
          createdBy: userId,
        });
      }
      if ((res as any).success === false) {
        toast.error(String((res as any).code || (res as any).error || 'USD acquisition failed'));
        return;
      }
      toast.success(
        (res as any).idempotent_replay
          ? 'USD acquisition already posted (idempotent replay)'
          : `USD acquisition posted · JE ${(res as any).entry_no || (res as any).journal_entry_id}`
      );
      setConfirmOpen(false);
      setDistributionRows([]);
      setRetainedUsd('');
      await refresh();
      onPosted?.();
    } catch (e: any) {
      toast.error(e?.message || 'USD acquisition failed');
    } finally {
      setBusy(false);
    }
  };

  if (installed === false) {
    return (
      <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4 text-sm space-y-2">
        <p className="font-medium">{W3_MIGRATION_NOT_INSTALLED}</p>
        <p className="text-xs opacity-90">
          {installMsg || 'Apply W3 migrations to a non-production database to enable Confirm & Post.'}
        </p>
        <p className="text-xs opacity-90">
          Frontend currently must not post to production. Local apply: create `.env.db.local` (localhost only)
          then run the W3 local apply script when available.
        </p>
        <div className="pt-1">
          <ImportFxW3DemoEntryLink />
        </div>
      </div>
    );
  }

  if (installed === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking W3 server capability…
      </div>
    );
  }

  const unapplied = Number(overview?.unapplied_advance_pkr || 0);
  const postedAdv = Number(overview?.posted_advance_pkr || 0);
  const postedUsd = Number(overview?.posted_usd_qty || 0);
  const advances = (overview?.advances as any[]) || [];
  const acquisitions = (overview?.acquisitions as any[]) || [];

  const attachmentBlock = onRegisterAttachment ? (
    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 min-w-0">
      <p className="text-sm font-medium text-foreground">Attachments</p>
      <p className="text-[11px] text-muted-foreground">
        Metadata reference only — no file is uploaded in this pass.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 min-w-0">
        <Input
          value={attachName}
          onChange={(e) => setAttachName(e.target.value)}
          placeholder="e.g. advance-receipt.pdf"
          disabled={readOnly || busy || attachmentBusy}
          className="min-w-0"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={readOnly || busy || attachmentBusy || !attachName.trim()}
          onClick={() => void handleRegisterAttach()}
        >
          {attachmentBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Register reference
        </Button>
      </div>
      {attachments.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {attachments.map((a) => (
            <li key={a.id} className="border-b border-border/50 pb-1">
              <span className="text-foreground">{a.file_name || 'unnamed'}</span>
              {a.is_metadata_only !== false ? ' · metadata only' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;

  const clearingPicker = (
    <div className="space-y-1 sm:col-span-2">
      <Label>Agent FX Advance / Settlement Clearing</Label>
      <select
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={clearingAccountId || ''}
        onChange={(e) => void handleClearingChange(e.target.value)}
        disabled={readOnly || busy || clearingSaving}
      >
        <option value="">Not configured — Confirm & Post disabled</option>
        {clearingCandidates.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground">
        Same setting as Settings → Accounting. Asset accounts only; do not pick Worker Advance (1180) or TT
        wallets.
      </p>
    </div>
  );

  return (
    <div className="space-y-4 min-w-0">
      {mode === 'ADVANCE' && (
        <>
          <div className="rounded-lg border border-border p-3 text-sm space-y-1">
            <div>Agent: {agentName || '—'}</div>
            <div>Planned W2 advance: {plannedAdvancePkr != null ? plannedAdvancePkr : '—'}</div>
            <div>Actual posted advance: {postedAdv}</div>
            <div>Unapplied advance: {unapplied}</div>
            <div className="text-xs text-muted-foreground">{W3_CLEARING_HELP}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {clearingPicker}
            <div className="space-y-1">
              <Label>Posting date</Label>
              <Input
                type="date"
                value={advDate}
                onChange={(e) => setAdvDate(e.target.value)}
                disabled={readOnly || busy}
              />
            </div>
            <div className="space-y-1">
              <Label>Actual PKR amount</Label>
              <Input
                type="number"
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                disabled={readOnly || busy}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Payment source (Cash/Bank)</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={paymentSourceId}
                onChange={(e) => setPaymentSourceId(e.target.value)}
                disabled={readOnly || busy}
              >
                <option value="">Select…</option>
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>External reference</Label>
              <Input value={advRef} onChange={(e) => setAdvRef(e.target.value)} disabled={readOnly || busy} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={advNotes} onChange={(e) => setAdvNotes(e.target.value)} disabled={readOnly || busy} />
            </div>
          </div>

          {attachmentBlock}

          <div className="rounded-lg border border-border p-3 text-xs space-y-1">
            <p className="font-medium text-sm">Accounting preview</p>
            {advPreview.lines.map((l, i) => (
              <div key={i}>
                {l.side} {l.account} · PKR {l.amount}
              </div>
            ))}
            <div>Balanced: {advPreview.balanced ? 'yes' : 'no'} · posts_journal: true</div>
            {softPath21Tip && (
              <p className="text-muted-foreground border-t border-border/60 pt-1 mt-1">{softPath21Tip}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={readOnly || busy || Boolean(advConfirmBlockedReason)}
                onClick={() => setConfirmOpen(true)}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm & Post Agent Advance
              </Button>
            </div>
            {advConfirmBlockedReason && (
              <p className="text-xs text-amber-700 dark:text-amber-300">{advConfirmBlockedReason}</p>
            )}
          </div>

          {confirmOpen && (
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 space-y-2 text-sm">
              <p className="font-medium">This is an actual financial posting.</p>
              <p>
                Agent: {agentName || '—'} · PKR {advAmount}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void runPostAdvance()}>
                  Post now
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Advance history</p>
            {advances
              .filter((a) => a.status === 'POSTED')
              .map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-border p-2 text-xs flex flex-wrap gap-2 justify-between"
                >
                  <span>
                    {a.posting_date} · PKR {a.amount_pkr} · remaining {a.remaining_unapplied_pkr} · JE{' '}
                    {a.journal_entry_id || '—'}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={readOnly || busy || Number(a.remaining_unapplied_pkr) < Number(a.amount_pkr)}
                    title={
                      Number(a.remaining_unapplied_pkr) < Number(a.amount_pkr)
                        ? 'Blocked: advance has applications'
                        : 'Reverse full event'
                    }
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          const res = await reverseImportFxAgentAdvance({
                            companyId,
                            advanceId: a.id,
                            clientOperationId: crypto.randomUUID(),
                            createdBy: userId,
                          });
                          if ((res as any).success === false) {
                            toast.error(String((res as any).code || (res as any).error || 'Reverse failed'));
                          } else {
                            toast.success('Advance reversed');
                            await refresh();
                            onPosted?.();
                          }
                        } catch (e: any) {
                          toast.error(e?.message || 'Reverse failed');
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    Reverse
                  </Button>
                </div>
              ))}
          </div>
        </>
      )}

      {mode === 'USD_ACQUISITION' && (
        <>
          <div className="rounded-lg border border-border p-3 text-sm space-y-1">
            <div>Expected W2 USD: {plannedUsd != null ? plannedUsd : '—'}</div>
            <div>Actual USD acquired: {postedUsd}</div>
            <div>Available advance PKR: {unapplied}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(fundingType === 'ADVANCE' || fundingType === 'MIXED') && clearingPicker}
            <div className="space-y-1">
              <Label>Acquisition date</Label>
              <Input
                type="date"
                value={usdDate}
                onChange={(e) => setUsdDate(e.target.value)}
                disabled={readOnly || busy}
              />
            </div>
            <div className="space-y-1">
              <Label>Funding method</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={fundingType}
                onChange={(e) => setFundingType(e.target.value as ImportFxW3FundingType)}
                disabled={readOnly || busy}
              >
                <option value="CREDIT">Use Agent Credit</option>
                <option value="ADVANCE">Apply Advance</option>
                <option value="MIXED">Mixed Funding</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>USD quantity</Label>
              <Input
                type="number"
                value={usdQty}
                onChange={(e) => setUsdQty(e.target.value)}
                disabled={readOnly || busy}
              />
            </div>
            <div className="space-y-1">
              <Label>PKR per 1 USD</Label>
              <Input
                type="number"
                value={pkrPerUsd}
                onChange={(e) => setPkrPerUsd(e.target.value)}
                disabled={readOnly || busy}
              />
            </div>
            {custodyRouting ? (
              <div className="sm:col-span-2">
                <ImportFxCaseW31RoutingFields
                  routingMode={routingMode}
                  onRoutingModeChange={setRoutingMode}
                  wallets={wallets}
                  walletId={walletId}
                  onWalletIdChange={setWalletId}
                  contacts={contactOptions}
                  holderContactId={holderContactId}
                  onHolderContactIdChange={setHolderContactId}
                  agentContactId={agentContactId}
                  agentName={agentName}
                  retainedUsd={retainedUsd}
                  onRetainedUsdChange={setRetainedUsd}
                  acquiredUsd={Number(usdQty) || 0}
                  distributionRows={distributionRows}
                  onDistributionRowsChange={setDistributionRows}
                  custodyControlConfigured={!!custodyControlAccountId}
                />
              </div>
            ) : (
              <div className="space-y-1 sm:col-span-2">
                <Label>Destination USD/TT wallet</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  disabled={readOnly || busy}
                >
                  <option value="">Select…</option>
                  {wallets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  W3.1 custody routing not installed — single wallet mode only.
                </p>
              </div>
            )}
            {fundingType === 'MIXED' && (
              <div className="space-y-1">
                <Label>Advance apply PKR</Label>
                <Input
                  type="number"
                  value={advanceApply}
                  onChange={(e) => setAdvanceApply(e.target.value)}
                  disabled={readOnly || busy}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>External reference</Label>
              <Input value={usdRef} onChange={(e) => setUsdRef(e.target.value)} disabled={readOnly || busy} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={usdNotes} onChange={(e) => setUsdNotes(e.target.value)} disabled={readOnly || busy} />
            </div>
          </div>

          {attachmentBlock}

          <div className="rounded-lg border border-border p-3 text-xs space-y-1">
            <div>Total PKR carrying (server will recompute): {carrying}</div>
            <div>Advance applied: {split.advanceAppliedPkr}</div>
            <div>Agent AP to create: {split.agentApCreatedPkr}</div>
            <p className="font-medium text-sm pt-1">Accounting preview</p>
            {usdPreview.lines.map((l, i) => (
              <div key={i}>
                {l.side} {l.account} · PKR {l.amount}
              </div>
            ))}
            <div>Balanced: {usdPreview.balanced ? 'yes' : 'no'} · fee: 0 · posts_journal: true</div>
            {softPath21Tip && (
              <p className="text-muted-foreground border-t border-border/60 pt-1 mt-1">{softPath21Tip}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Button
              type="button"
              disabled={readOnly || busy || Boolean(usdConfirmBlockedReason)}
              onClick={() => setConfirmOpen(true)}
            >
              Confirm & Post USD Acquisition
            </Button>
            {usdConfirmBlockedReason && (
              <p className="text-xs text-amber-700 dark:text-amber-300">{usdConfirmBlockedReason}</p>
            )}
          </div>

          {confirmOpen && (
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 space-y-2 text-sm">
              <p className="font-medium">This is an actual financial posting.</p>
              <p>
                USD {usdQty} @ {pkrPerUsd} → PKR {carrying} · {fundingType}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void runPostUsd()}>
                  Post now
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Posted acquisitions</p>
            {acquisitions
              .filter((a) => a.status === 'POSTED')
              .map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-border p-2 text-xs flex flex-wrap gap-2 justify-between"
                >
                  <span>
                    {a.acquisition_date} · USD {a.usd_quantity} · PKR {a.carrying_pkr} · {a.funding_type} · JE{' '}
                    {a.journal_entry_id || '—'}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={readOnly || busy}
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          const res = await reverseImportFxUsdAcquisition({
                            companyId,
                            acquisitionId: a.id,
                            clientOperationId: crypto.randomUUID(),
                            createdBy: userId,
                          });
                          if ((res as any).success === false) {
                            toast.error(String((res as any).code || (res as any).error || 'Reverse failed'));
                          } else {
                            toast.success('USD acquisition reversed');
                            await refresh();
                            onPosted?.();
                          }
                        } catch (e: any) {
                          toast.error(e?.message || 'Reverse failed');
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    Reverse
                  </Button>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
