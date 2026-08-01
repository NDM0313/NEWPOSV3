/**
 * Dual-credit Agent FX wizard (Phase 2).
 * Gated: only mount / open when multiCurrencyEnabled === true.
 * Step 1: FC credit from agent → Dr wallet / Cr Agent AP
 * Step 2: Pay agent PKR from bank (createSupplierPayment on_account)
 * Step 3: Settle China purchase from funded TT wallet
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
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
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  resolveActiveImportCurrencies,
  type ImportDocCurrency,
} from '@/app/lib/importFxHelpers';
import { accountService } from '@/app/services/accountService';
import { purchaseService } from '@/app/services/purchaseService';
import {
  computePkrFromForeign,
  listMoneyExchangeAgents,
  listOpenFxCurrencyPurchases,
  listTtAgentWallets,
  recordFxCurrencyPurchaseOnCredit,
  settleChinaPurchaseFromWallet,
  settleFxCurrencyPurchaseWithAgent,
  type FxCurrencyPurchase,
} from '@/app/services/importFxAgentService';
import {
  isPartyTtAgentWalletAccount,
  isRoznamchaLiquidityAccount,
} from '@/app/lib/liquidityPaymentAccount';
import { cn } from '@/app/components/ui/utils';

type WizardStep = 1 | 2 | 3;

export function ImportFxAgentWizard(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { open, onOpenChange } = props;
  const { companyId, branchId } = useSupabase();
  const { accountingSettings } = useSettings();
  const multiCurrencyEnabled = accountingSettings?.multiCurrencyEnabled === true;
  const activeCurrencies = useMemo(
    () => resolveActiveImportCurrencies(accountingSettings),
    [accountingSettings]
  );
  const { formatCurrency } = useFormatCurrency();

  const [step, setStep] = useState<WizardStep>(1);
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string; type: string }[]>([]);
  const [wallets, setWallets] = useState<{ id: string; code: string; name: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; code: string; name: string }[]>([]);
  const [openCredits, setOpenCredits] = useState<FxCurrencyPurchase[]>([]);
  const [purchasesDue, setPurchasesDue] = useState<
    { id: string; label: string; due: number; supplier: string }[]
  >([]);

  // Step 1
  const [agentId, setAgentId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [docCurrency, setDocCurrency] = useState<ImportDocCurrency>('CNY');
  const [foreignAmount, setForeignAmount] = useState('');
  const [fxRate, setFxRate] = useState('');
  const [creditNotes, setCreditNotes] = useState('');
  const [lastCreditId, setLastCreditId] = useState<string | null>(null);

  // Step 2
  const [settleCreditId, setSettleCreditId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');

  // Step 3
  const [purchaseId, setPurchaseId] = useState('');
  const [supplierPayAmount, setSupplierPayAmount] = useState('');
  const [payWalletId, setPayWalletId] = useState('');

  const pkrPreview = useMemo(() => {
    const fc = Number(foreignAmount) || 0;
    const rate = Number(fxRate) || 0;
    return computePkrFromForeign(fc, rate);
  }, [foreignAmount, fxRate]);

  const selectedCredit = useMemo(
    () => openCredits.find((c) => c.id === settleCreditId) || null,
    [openCredits, settleCreditId]
  );

  const loadLookups = useCallback(async () => {
    if (!companyId || !multiCurrencyEnabled) return;
    try {
      const [a, w, accounts, credits] = await Promise.all([
        listMoneyExchangeAgents(companyId),
        listTtAgentWallets(companyId),
        accountService.getAllAccounts(companyId),
        listOpenFxCurrencyPurchases(companyId, true),
      ]);
      setAgents(a.filter((x) => x.type === 'money_exchange' || x.type === 'supplier' || x.type === 'both'));
      setWallets(w);
      setOpenCredits(credits);
      const banks = (accounts || [])
        .filter(
          (acc: { is_active?: boolean }) =>
            acc.is_active !== false &&
            isRoznamchaLiquidityAccount(acc as any) &&
            !isPartyTtAgentWalletAccount(acc as any)
        )
        .map((acc: { id: string; code?: string; name?: string }) => ({
          id: acc.id,
          code: String(acc.code || ''),
          name: String(acc.name || ''),
        }));
      setBankAccounts(banks);

      const listResult = await purchaseService.getAllPurchases(companyId, branchId || undefined, {
        limit: 80,
        offset: 0,
      });
      const rows = Array.isArray(listResult)
        ? listResult
        : ((listResult as { data?: any[] })?.data || []);
      setPurchasesDue(
        rows
          .filter((p: any) => Number(p.due_amount ?? p.due ?? 0) > 0.009)
          .slice(0, 40)
          .map((p: any) => ({
            id: String(p.id),
            label: String(p.po_no || p.draft_no || p.order_no || p.id).slice(0, 24),
            due: Number(p.due_amount ?? p.due ?? 0),
            supplier: String(p.supplier_name || p.supplierName || ''),
          }))
      );
    } catch (e: any) {
      console.error('[ImportFxAgentWizard] loadLookups', e);
      toast.error(e?.message || 'Failed to load FX wizard data');
    }
  }, [companyId, branchId, multiCurrencyEnabled]);

  useEffect(() => {
    if (open && multiCurrencyEnabled) {
      void loadLookups();
    }
    if (!open) {
      setStep(1);
      setBusy(false);
    }
  }, [open, multiCurrencyEnabled, loadLookups]);

  useEffect(() => {
    if (selectedCredit) {
      setSettleAmount(String(selectedCredit.due_amount_pkr || ''));
    }
  }, [selectedCredit]);

  if (!multiCurrencyEnabled) {
    return null;
  }

  const handleRecordCredit = async () => {
    if (!companyId) return;
    if (!agentId || !walletId) {
      toast.error('Select agent and TT wallet');
      return;
    }
    if (!(Number(foreignAmount) > 0) || !(Number(fxRate) > 0)) {
      toast.error('Enter foreign amount and FX rate');
      return;
    }
    setBusy(true);
    try {
      const result = await recordFxCurrencyPurchaseOnCredit(
        {
          companyId,
          branchId: branchId || null,
          agentContactId: agentId,
          walletAccountId: walletId,
          documentCurrency: docCurrency,
          foreignAmount: Number(foreignAmount),
          fxRateToBase: Number(fxRate),
          notes: creditNotes || null,
        },
        true
      );
      setLastCreditId(result.fxCurrencyPurchaseId);
      toast.success(
        `Wallet funded on credit: ${formatCurrency(result.amountPkr)} (${result.entryNo || 'JE'})`
      );
      await loadLookups();
      setSettleCreditId(result.fxCurrencyPurchaseId);
      setPayWalletId(walletId);
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message || 'FX credit purchase failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSettleAgent = async () => {
    if (!companyId || !settleCreditId) {
      toast.error('Select an open FX credit');
      return;
    }
    if (!bankAccountId) {
      toast.error('Select bank / cash account');
      return;
    }
    const amt = Number(settleAmount) || 0;
    if (!(amt > 0)) {
      toast.error('Enter settlement amount (PKR)');
      return;
    }
    setBusy(true);
    try {
      const result = await settleFxCurrencyPurchaseWithAgent(
        {
          companyId,
          branchId: branchId || null,
          fxCurrencyPurchaseId: settleCreditId,
          amountPkr: amt,
          paymentAccountId: bankAccountId,
        },
        true
      );
      toast.success(`Agent paid ${formatCurrency(amt)} (${result.referenceNumber})`);
      await loadLookups();
      setStep(3);
    } catch (e: any) {
      toast.error(e?.message || 'Agent settlement failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSettleSupplier = async () => {
    if (!companyId || !purchaseId) {
      toast.error('Select a China purchase with due');
      return;
    }
    if (!payWalletId) {
      toast.error('Select funded TT wallet');
      return;
    }
    const amt = Number(supplierPayAmount) || 0;
    if (!(amt > 0)) {
      toast.error('Enter PKR amount to pay supplier');
      return;
    }
    setBusy(true);
    try {
      const result = await settleChinaPurchaseFromWallet(
        {
          companyId,
          branchId: branchId || null,
          purchaseId,
          amountPkr: amt,
          walletAccountId: payWalletId,
        },
        true
      );
      toast.success(`Supplier settled ${formatCurrency(amt)} (${result.referenceNumber})`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Supplier settlement failed');
    } finally {
      setBusy(false);
    }
  };

  const stepLabel = step === 1 ? 'Buy FC on credit' : step === 2 ? 'Pay agent (PKR)' : 'Pay China supplier';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import FX — Agent dual credit</DialogTitle>
          <DialogDescription>
            Step {step} of 3: {stepLabel}. Books post in PKR only.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          {([1, 2, 3] as WizardStep[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={cn(
                'flex-1 text-xs py-1.5 rounded border',
                step === s ? 'bg-amber-600/20 border-amber-500 text-foreground' : 'border-border text-muted-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <Label>Money exchange agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.type === 'money_exchange' ? ' (agent)' : ` (${a.type})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>TT wallet (12xx)</Label>
              <Select value={walletId} onValueChange={setWalletId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select wallet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Currency</Label>
                <Select
                  value={docCurrency}
                  onValueChange={(v) => setDocCurrency(v as ImportDocCurrency)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCurrencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rate → PKR</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={fxRate}
                  onChange={(e) => setFxRate(e.target.value)}
                  placeholder="e.g. 42.8"
                />
              </div>
            </div>
            <div>
              <Label>Foreign amount</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={foreignAmount}
                onChange={(e) => setForeignAmount(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              PKR credit (Dr wallet / Cr Agent AP):{' '}
              <span className="text-foreground font-medium">{formatCurrency(pkrPreview)}</span>
            </p>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={creditNotes} onChange={(e) => setCreditNotes(e.target.value)} />
            </div>
            {lastCreditId && (
              <p className="text-xs text-muted-foreground">Last credit id: {lastCreditId.slice(0, 8)}…</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <Label>Open FX credit</Label>
              <Select
                value={settleCreditId}
                onValueChange={(id) => {
                  setSettleCreditId(id);
                  const row = openCredits.find((c) => c.id === id);
                  if (row) setSettleAmount(String(row.due_amount_pkr));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select open credit" />
                </SelectTrigger>
                <SelectContent>
                  {openCredits.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.document_no || c.id.slice(0, 8)} · due {formatCurrency(c.due_amount_pkr)} ·{' '}
                      {c.document_currency} {c.foreign_amount}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pay from (bank / cash)</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount PKR (partial OK)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Posts Dr Agent AP / Cr Bank via createSupplierPayment (on account), then updates FX credit paid/due.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <Label>China purchase (due)</Label>
              <Select
                value={purchaseId}
                onValueChange={(id) => {
                  setPurchaseId(id);
                  const row = purchasesDue.find((p) => p.id === id);
                  if (row) setSupplierPayAmount(String(row.due));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select purchase" />
                </SelectTrigger>
                <SelectContent>
                  {purchasesDue.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} · {p.supplier} · due {formatCurrency(p.due)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pay from TT wallet</Label>
              <Select value={payWalletId} onValueChange={setPayWalletId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select wallet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount PKR</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={supplierPayAmount}
                onChange={(e) => setSupplierPayAmount(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Posts Dr China AP / Cr TT wallet via createSupplierPayment (linked purchase).
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          {step > 1 && (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => (s - 1) as WizardStep)} disabled={busy}>
              Back
            </Button>
          )}
          {step === 1 && (
            <Button type="button" onClick={() => void handleRecordCredit()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record credit'}
            </Button>
          )}
          {step === 2 && (
            <Button type="button" onClick={() => void handleSettleAgent()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay agent'}
            </Button>
          )}
          {step === 3 && (
            <Button type="button" onClick={() => void handleSettleSupplier()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay supplier'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
