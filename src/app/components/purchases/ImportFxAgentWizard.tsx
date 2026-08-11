/**
 * Dual-credit Agent FX wizard (Phase 2).
 * Gated: only mount / open when multiCurrencyEnabled === true.
 * Step 1: FC credit from agent → Dr wallet / Cr Agent AP
 * Step 2: Pay agent PKR from bank (createSupplierPayment on_account)
 * Step 3: Settle China purchase from funded TT wallet
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CreditCard, Loader2, Upload, Wallet, X } from 'lucide-react';
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
import { DateTimePicker } from '@/app/components/ui/DateTimePicker';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  resolveActiveImportCurrencies,
  type ImportDocCurrency,
} from '@/app/lib/importFxHelpers';
import { formatImportFxServerError } from '@/app/lib/importFxServerGate';
import {
  assertAgentDistinctFromSupplier,
  filterSearchableOptionsByQuery,
} from '@/app/lib/importFxPartyLedgerRoleFilter';
import { suggestedChinaSettleAmountPkr } from '@/app/lib/importFxWizardHelpers';
import { accountService } from '@/app/services/accountService';
import { contactService } from '@/app/services/contactService';
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
import { formatLocalDateTimeYYYYMMDDHHmm } from '@/app/utils/localDate';
import { prepareAttachmentFilesForUpload } from '@/app/utils/imageCompression';
import { handleAttachmentPaste } from '@/app/utils/pasteAttachmentFiles';
import {
  MAX_FILE_SIZE_BYTES as ATTACHMENT_MAX_BYTES,
  uploadUnifiedStylePaymentAttachments,
} from '@/app/utils/uploadTransactionAttachments';
import { cn } from '@/app/components/ui/utils';

type WizardStep = 1 | 2 | 3;

function paymentDateFromDateTime(value: string): string {
  const s = String(value || '').trim();
  if (s.length >= 10) return s.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

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
  const submittingRef = useRef(false);
  /** One UUID per Step-1 intent; reused on retry; rotated after success / new intent. */
  const step1ClientOpRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `fx1-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const step2ClientOpRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `fx2-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const step3ClientOpRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `fx3-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const newClientOp = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `fx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [agents, setAgents] = useState<
    { id: string; name: string; type: string; code?: string | null; phone?: string | null }[]
  >([]);
  const [wallets, setWallets] = useState<{ id: string; code: string; name: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; code: string; name: string }[]>([]);
  const [openCredits, setOpenCredits] = useState<FxCurrencyPurchase[]>([]);
  const [purchasesDue, setPurchasesDue] = useState<
    { id: string; label: string; due: number; supplier: string; supplierId: string }[]
  >([]);

  // Step 1
  const [agentId, setAgentId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [docCurrency, setDocCurrency] = useState<ImportDocCurrency>('CNY');
  const [foreignAmount, setForeignAmount] = useState('');
  const [fxRate, setFxRate] = useState('');
  const [creditNotes, setCreditNotes] = useState('');
  const [lastCreditId, setLastCreditId] = useState<string | null>(null);
  /** Survives after FX credit becomes paid (openCredits no longer lists it). */
  const [creditAmountPkrSnapshot, setCreditAmountPkrSnapshot] = useState(0);
  const [creditAgentContactIdSnapshot, setCreditAgentContactIdSnapshot] = useState<string | null>(
    null
  );

  // Step 2
  const [settleCreditId, setSettleCreditId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');

  // Step 3
  const [purchaseId, setPurchaseId] = useState('');
  const [supplierPayAmount, setSupplierPayAmount] = useState('');
  const [payWalletId, setPayWalletId] = useState('');

  // Shared payment meta (Step 2 + 3) — AddEntryV2-aligned
  const [paymentDateTime, setPaymentDateTime] = useState(() =>
    formatLocalDateTimeYYYYMMDDHHmm(new Date())
  );
  const [paymentNotes, setPaymentNotes] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [processingAttachments, setProcessingAttachments] = useState(false);

  // Quick-create money_exchange agent (when search/list empty)
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [creatingAgent, setCreatingAgent] = useState(false);

  const pkrPreview = useMemo(() => {
    const fc = Number(foreignAmount) || 0;
    const rate = Number(fxRate) || 0;
    return computePkrFromForeign(fc, rate);
  }, [foreignAmount, fxRate]);

  const selectedCredit = useMemo(
    () => openCredits.find((c) => c.id === settleCreditId) || null,
    [openCredits, settleCreditId]
  );

  const activeCreditAmountPkr = useMemo(() => {
    if (creditAmountPkrSnapshot > 0) return creditAmountPkrSnapshot;
    const fromOpen = Number(selectedCredit?.amount_pkr) || 0;
    if (fromOpen > 0) return fromOpen;
    return Number(settleAmount) || 0;
  }, [creditAmountPkrSnapshot, selectedCredit, settleAmount]);

  const selectedPurchase = useMemo(
    () => purchasesDue.find((p) => p.id === purchaseId) || null,
    [purchasesDue, purchaseId]
  );

  const suggestedStep3Amount = useMemo(
    () =>
      suggestedChinaSettleAmountPkr({
        creditAmountPkr: activeCreditAmountPkr,
        purchaseDue: selectedPurchase?.due || 0,
      }),
    [activeCreditAmountPkr, selectedPurchase]
  );

  const mergeAttachmentFiles = useCallback(async (incoming: File[]) => {
    if (!incoming.length) return;
    setProcessingAttachments(true);
    try {
      const files = await prepareAttachmentFilesForUpload(incoming, ATTACHMENT_MAX_BYTES);
      if (files.length) setAttachmentFiles((prev) => [...prev, ...files]);
    } catch (e: any) {
      toast.error(e?.message || 'Attachment failed');
    } finally {
      setProcessingAttachments(false);
    }
  }, []);

  const uploadPaymentAttachments = useCallback(async () => {
    if (!companyId || attachmentFiles.length === 0) return null;
    const up = await uploadUnifiedStylePaymentAttachments(companyId, 'supplier', attachmentFiles);
    return up.length ? up : null;
  }, [companyId, attachmentFiles]);

  const loadLookups = useCallback(async () => {
    if (!companyId || !multiCurrencyEnabled) return;
    try {
      const [a, w, accounts, credits] = await Promise.all([
        listMoneyExchangeAgents(companyId),
        listTtAgentWallets(companyId),
        accountService.getAllAccounts(companyId),
        listOpenFxCurrencyPurchases(companyId),
      ]);
      setAgents(a);
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
            supplierId: String(p.supplier_id || p.supplierId || ''),
          }))
      );
    } catch (e: any) {
      console.error('[ImportFxAgentWizard] loadLookups', e);
      toast.error(formatImportFxServerError(e, 'Failed to load FX wizard data'));
    }
  }, [companyId, branchId, multiCurrencyEnabled]);

  useEffect(() => {
    if (open && multiCurrencyEnabled) {
      void loadLookups();
    }
    if (!open) {
      setStep(1);
      setBusy(false);
      submittingRef.current = false;
      step1ClientOpRef.current = newClientOp();
      step2ClientOpRef.current = newClientOp();
      step3ClientOpRef.current = newClientOp();
      setAddAgentOpen(false);
      setNewAgentName('');
      setNewAgentPhone('');
      setCreditAmountPkrSnapshot(0);
      setCreditAgentContactIdSnapshot(null);
      setPaymentDateTime(formatLocalDateTimeYYYYMMDDHHmm(new Date()));
      setPaymentNotes('');
      setAttachmentFiles([]);
      setSupplierPayAmount('');
      setPurchaseId('');
    }
  }, [open, multiCurrencyEnabled, loadLookups]);

  useEffect(() => {
    if (selectedCredit) {
      setSettleAmount(String(selectedCredit.due_amount_pkr || ''));
      if (Number(selectedCredit.amount_pkr) > 0) {
        setCreditAmountPkrSnapshot(Number(selectedCredit.amount_pkr));
      }
      if (selectedCredit.agent_contact_id) {
        setCreditAgentContactIdSnapshot(String(selectedCredit.agent_contact_id));
      }
    }
  }, [selectedCredit]);

  if (!multiCurrencyEnabled) {
    return null;
  }

  const handleCreateMoneyExchangeAgent = async () => {
    if (!companyId || creatingAgent) return;
    const name = newAgentName.trim();
    if (!name) {
      toast.error('Agent name is required');
      return;
    }
    setCreatingAgent(true);
    try {
      const created = await contactService.createContact({
        company_id: companyId,
        name,
        type: 'money_exchange',
        phone: newAgentPhone.trim() || undefined,
        is_active: true,
      });
      const id = String((created as { id?: string })?.id || '');
      await loadLookups();
      if (id) setAgentId(id);
      setAddAgentOpen(false);
      setNewAgentName('');
      setNewAgentPhone('');
      toast.success(`Agent created: ${name}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create money-exchange agent');
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleRecordCredit = async () => {
    if (!companyId || submittingRef.current) return;
    if (!agentId || !walletId) {
      toast.error('Select agent and TT wallet');
      return;
    }
    if (!(Number(foreignAmount) > 0) || !(Number(fxRate) > 0)) {
      toast.error('Enter foreign amount and FX rate');
      return;
    }
    if (purchaseId) {
      const pur = purchasesDue.find((p) => p.id === purchaseId);
      const same = assertAgentDistinctFromSupplier(agentId, pur?.supplierId);
      if (same) {
        toast.error(same);
        return;
      }
    }
    submittingRef.current = true;
    setBusy(true);
    try {
      const result = await recordFxCurrencyPurchaseOnCredit({
        companyId,
        branchId: branchId || null,
        agentContactId: agentId,
        walletAccountId: walletId,
        documentCurrency: docCurrency,
        foreignAmount: Number(foreignAmount),
        fxRateToBase: Number(fxRate),
        notes: creditNotes || null,
        linkedPurchaseId: purchaseId || null,
        clientOperationId: step1ClientOpRef.current,
      });
      step1ClientOpRef.current = newClientOp();
      setLastCreditId(result.fxCurrencyPurchaseId);
      setCreditAmountPkrSnapshot(Number(result.amountPkr) || 0);
      setCreditAgentContactIdSnapshot(agentId || null);
      toast.success(
        `Wallet funded on credit: ${formatCurrency(result.amountPkr)} (${result.entryNo || 'JE'})`
      );
      await loadLookups();
      setSettleCreditId(result.fxCurrencyPurchaseId);
      setPayWalletId(walletId);
      setStep(2);
    } catch (e: any) {
      toast.error(formatImportFxServerError(e, 'FX credit purchase failed'));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const handleSettleAgent = async () => {
    if (!companyId || !settleCreditId || submittingRef.current) {
      if (!settleCreditId) toast.error('Select an open FX credit');
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
    submittingRef.current = true;
    setBusy(true);
    try {
      const fundedPkr =
        Number(selectedCredit?.amount_pkr) ||
        creditAmountPkrSnapshot ||
        amt;
      setCreditAmountPkrSnapshot(fundedPkr);
      if (selectedCredit?.agent_contact_id) {
        setCreditAgentContactIdSnapshot(String(selectedCredit.agent_contact_id));
      } else if (agentId) {
        setCreditAgentContactIdSnapshot(agentId);
      }
      const attachments = await uploadPaymentAttachments();
      const result = await settleFxCurrencyPurchaseWithAgent({
        companyId,
        branchId: branchId || null,
        fxCurrencyPurchaseId: settleCreditId,
        amountPkr: amt,
        paymentAccountId: bankAccountId,
        paymentDate: paymentDateFromDateTime(paymentDateTime),
        notes: paymentNotes.trim() || null,
        attachments,
        clientOperationId: step2ClientOpRef.current,
      });
      step2ClientOpRef.current = newClientOp();
      toast.success(`Agent paid ${formatCurrency(amt)} (${result.referenceNumber})`);
      await loadLookups();
      setAttachmentFiles([]);
      const nextAmt = suggestedChinaSettleAmountPkr({
        creditAmountPkr: fundedPkr,
        purchaseDue: selectedPurchase?.due || 0,
      });
      setSupplierPayAmount(String(nextAmt > 0 ? nextAmt : amt));
      setStep(3);
    } catch (e: any) {
      toast.error(formatImportFxServerError(e, 'Agent settlement failed'));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const handleSettleSupplier = async () => {
    if (!companyId || !purchaseId || submittingRef.current) {
      if (!purchaseId) toast.error('Select a China purchase with due');
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
    const pur = purchasesDue.find((p) => p.id === purchaseId);
    const purchaseDue = Number(pur?.due) || 0;
    if (purchaseDue > 0 && amt > purchaseDue + 0.009) {
      toast.error(`Amount cannot exceed purchase due (${formatCurrency(purchaseDue)})`);
      return;
    }
    if (activeCreditAmountPkr > 0 && amt > activeCreditAmountPkr + 0.009) {
      toast.error(
        `Amount cannot exceed this FX credit (${formatCurrency(activeCreditAmountPkr)}). Use partial or fund more credit.`
      );
      return;
    }
    const credit =
      openCredits.find((c) => c.id === settleCreditId) ||
      openCredits.find((c) => c.id === lastCreditId) ||
      null;
    const agentFromCredit =
      credit?.agent_contact_id || creditAgentContactIdSnapshot || agentId;
    const same = assertAgentDistinctFromSupplier(agentFromCredit, pur?.supplierId);
    if (same) {
      toast.error(same);
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    try {
      const attachments = await uploadPaymentAttachments();
      const result = await settleChinaPurchaseFromWallet({
        companyId,
        branchId: branchId || null,
        purchaseId,
        amountPkr: amt,
        walletAccountId: payWalletId,
        agentContactId: agentFromCredit || null,
        paymentDate: paymentDateFromDateTime(paymentDateTime),
        notes: paymentNotes.trim() || null,
        attachments,
        clientOperationId: step3ClientOpRef.current,
      });
      step3ClientOpRef.current = newClientOp();
      toast.success(`Supplier settled ${formatCurrency(amt)} (${result.referenceNumber})`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(formatImportFxServerError(e, 'Supplier settlement failed'));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const labelClass = 'block text-sm font-semibold text-muted-foreground mb-2';
  const cardInnerClass = 'bg-muted/40 border border-border rounded-xl p-4';
  const amountInputClass =
    'w-full bg-card border-2 border-border rounded-lg pl-4 pr-4 py-3 text-foreground text-xl font-bold placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors';

  const paymentMetaFields = (
    <div className={cn(cardInnerClass, 'space-y-4')}>
      <div>
        <Label className={labelClass}>
          Payment date &amp; time <span className="text-red-400">*</span>
        </Label>
        <DateTimePicker
          value={paymentDateTime}
          onChange={(v) => setPaymentDateTime(v || paymentDateTime)}
          required
        />
      </div>
      <div>
        <Label className={labelClass}>Description / Notes</Label>
        <textarea
          value={paymentNotes}
          onChange={(e) => setPaymentNotes(e.target.value)}
          placeholder="Optional narration"
          className="w-full bg-card border-2 border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none min-h-[88px]"
        />
      </div>
      <div>
        <Label className={labelClass}>Attachments (Optional)</Label>
        <div
          tabIndex={0}
          role="button"
          className="outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          onPaste={(e) => {
            handleAttachmentPaste(e, (files) => void mergeAttachmentFiles(files), {
              maxBytes: ATTACHMENT_MAX_BYTES,
            });
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('ring-2', 'ring-blue-500/50');
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('ring-2', 'ring-blue-500/50');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('ring-2', 'ring-blue-500/50');
            const list = e.dataTransfer?.files;
            if (list?.length) void mergeAttachmentFiles(Array.from(list));
          }}
        >
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-blue-500 hover:bg-muted/40 transition-all text-center">
              <Upload className="mx-auto mb-2 text-muted-foreground" size={24} />
              <p className="text-xs text-muted-foreground mb-0.5">
                <span className="text-blue-400 font-medium">Click to upload</span>, drag and drop, or
                paste
              </p>
              <p className="text-xs text-muted-foreground">
                {processingAttachments ? 'Compressing…' : 'PDF, PNG, JPG · Paste (Ctrl+V)'}
              </p>
            </div>
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                void (async () => {
                  const list = e.target.files;
                  if (!list?.length) return;
                  await mergeAttachmentFiles(Array.from(list));
                  e.target.value = '';
                })();
              }}
            />
          </label>
        </div>
        {attachmentFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachmentFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between bg-card border border-border rounded-lg p-2"
              >
                <span className="text-xs truncate text-foreground">{file.name}</span>
                <button
                  type="button"
                  className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const stepLabel = step === 1 ? 'Buy FC on credit' : step === 2 ? 'Pay agent (PKR)' : 'Pay China supplier';
  const stepIcon = step === 1 ? <CreditCard className="w-5 h-5 text-blue-400" /> : <Wallet className="w-5 h-5 text-blue-400" />;
  const primaryLabel =
    step === 1 ? 'Record credit' : step === 2 ? 'Pay agent' : 'Pay supplier';
  const onPrimary =
    step === 1
      ? () => void handleRecordCredit()
      : step === 2
        ? () => void handleSettleAgent()
        : () => void handleSettleSupplier();

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200"
        onClick={() => !busy && onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          className="bg-card border border-border/80 rounded-2xl shadow-2xl shadow-black/40 w-full max-w-[700px] h-[850px] pointer-events-auto animate-in zoom-in-95 duration-200 my-6 max-h-[92vh] overflow-y-auto ring-1 ring-white/5"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-fx-wizard-title"
        >
          <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 sticky top-0 z-10">
            <div className="flex items-center gap-3 min-w-0">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as WizardStep)}
                  disabled={busy}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  aria-label="Back"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                {stepIcon}
              </div>
              <div className="min-w-0">
                <h2 id="import-fx-wizard-title" className="text-lg font-bold text-foreground truncate">
                  Import FX — Agent dual credit
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Step {step} of 3: {stepLabel}. Books post in PKR only.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-muted rounded-lg shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div className="flex gap-2" role="tablist" aria-label="Wizard steps">
              {([1, 2, 3] as WizardStep[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={step === s}
                  onClick={() => setStep(s)}
                  disabled={busy}
                  className={cn(
                    'flex-1 text-sm font-semibold py-2.5 rounded-xl border-2 transition-all',
                    step === s
                      ? 'border-blue-500 bg-gradient-to-br from-blue-500/15 to-gray-900/80 text-foreground ring-1 ring-blue-500/30'
                      : 'border-border/80 bg-muted/40 text-muted-foreground hover:border-gray-600'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div className={cardInnerClass}>
                  <Label className={labelClass}>Money exchange agent</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Contact type <span className="text-foreground font-medium">money_exchange</span> —
                    not a CoA account. Do not pick the China supplier here.
                  </p>
                  <SearchableSelect
                    value={agentId}
                    onValueChange={setAgentId}
                    placeholder="Select money-exchange agent"
                    searchPlaceholder="Search agent contact…"
                    emptyText={
                      agents.length === 0
                        ? 'No money_exchange contacts yet'
                        : 'No matching agent found'
                    }
                    enableAddNew
                    addNewLabel="Add New Agent"
                    onAddNew={(searchText) => {
                      setNewAgentName(searchText?.trim() || '');
                      setNewAgentPhone('');
                      setAddAgentOpen(true);
                    }}
                    options={agents.map((a) => ({
                      id: a.id,
                      name: `${a.name} (money_exchange)`,
                      code: a.code || '',
                      phone: a.phone || '',
                      role: 'money_exchange',
                    }))}
                    filterFn={(opt, q) =>
                      filterSearchableOptionsByQuery([opt], q, ['name', 'code', 'phone', 'role'])
                        .length > 0
                    }
                  />
                </div>

                <div className={cardInnerClass}>
                  <Label className={labelClass}>TT wallet account (12xx)</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    FC wallet / T/T where currency is credited (e.g. HAMID IK RMB, WALI T/T).
                  </p>
                  <SearchableSelect
                    value={walletId}
                    onValueChange={setWalletId}
                    placeholder="Select TT wallet"
                    searchPlaceholder="Search wallet…"
                    emptyText="No matching wallet found"
                    options={wallets.map((w) => ({
                      id: w.id,
                      name: `${w.code} — ${w.name}`,
                      code: w.code,
                      walletName: w.name,
                    }))}
                    filterFn={(opt, q) =>
                      filterSearchableOptionsByQuery([opt], q, ['name', 'code', 'walletName'])
                        .length > 0
                    }
                  />
                </div>

                <div className={cardInnerClass}>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className={labelClass}>Currency</Label>
                      <Select
                        value={docCurrency}
                        onValueChange={(v) => setDocCurrency(v as ImportDocCurrency)}
                      >
                        <SelectTrigger className="bg-card border-2 border-border h-11">
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
                      <Label className={labelClass}>Rate → PKR</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={fxRate}
                        onChange={(e) => setFxRate(e.target.value)}
                        placeholder="e.g. 42.8"
                        className="bg-card border-2 border-border h-11"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <Label className={labelClass}>Foreign amount</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={foreignAmount}
                      onChange={(e) => setForeignAmount(e.target.value)}
                      className="bg-card border-2 border-border h-11"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">
                      PKR credit (Dr wallet / Cr Agent AP)
                    </span>
                    <span className="text-base font-bold text-emerald-400 tabular-nums">
                      {formatCurrency(pkrPreview)}
                    </span>
                  </div>
                </div>

                <div className={cardInnerClass}>
                  <Label className={labelClass}>Notes (optional)</Label>
                  <Input
                    value={creditNotes}
                    onChange={(e) => setCreditNotes(e.target.value)}
                    className="bg-card border-2 border-border"
                    placeholder="Optional"
                  />
                  {lastCreditId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last credit id: {lastCreditId.slice(0, 8)}…
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className={cardInnerClass}>
                  <Label className={labelClass}>Open FX credit</Label>
                  <SearchableSelect
                    value={settleCreditId}
                    onValueChange={(id) => {
                      setSettleCreditId(id);
                      const row = openCredits.find((c) => c.id === id);
                      if (row) {
                        setSettleAmount(String(row.due_amount_pkr));
                        setCreditAmountPkrSnapshot(Number(row.amount_pkr) || 0);
                        if (row.agent_contact_id) {
                          setCreditAgentContactIdSnapshot(String(row.agent_contact_id));
                        }
                      }
                    }}
                    placeholder="Select open credit"
                    searchPlaceholder="Search credit…"
                    emptyText="No matching credit found"
                    options={openCredits.map((c) => ({
                      id: c.id,
                      name: `${c.document_no || c.id.slice(0, 8)} · due ${formatCurrency(c.due_amount_pkr)} · ${c.document_currency} ${c.foreign_amount}`,
                      document_no: c.document_no || '',
                      currency: c.document_currency || '',
                    }))}
                    filterFn={(opt, q) =>
                      filterSearchableOptionsByQuery([opt], q, ['name', 'document_no', 'currency'])
                        .length > 0
                    }
                  />
                </div>

                <div className={cardInnerClass}>
                  <Label className={labelClass}>Pay from (bank / cash)</Label>
                  <SearchableSelect
                    value={bankAccountId}
                    onValueChange={setBankAccountId}
                    placeholder="Select account"
                    searchPlaceholder="Search account…"
                    emptyText="No matching account found"
                    options={bankAccounts.map((b) => ({
                      id: b.id,
                      name: `${b.code} — ${b.name}`,
                      code: b.code,
                      accountName: b.name,
                    }))}
                    filterFn={(opt, q) =>
                      filterSearchableOptionsByQuery([opt], q, ['name', 'code', 'accountName'])
                        .length > 0
                    }
                  />
                </div>

                <div className={cardInnerClass}>
                  <Label className={labelClass}>
                    Amount PKR <span className="text-red-400">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">Partial OK</p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className={amountInputClass}
                  />
                </div>

                {paymentMetaFields}

                <p className="text-xs text-muted-foreground px-1">
                  Posts Dr Agent AP / Cr Bank via createSupplierPayment (on account), then updates FX
                  credit paid/due.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className={cardInnerClass}>
                  <Label className={labelClass}>China purchase (due)</Label>
                  <SearchableSelect
                    value={purchaseId}
                    onValueChange={(id) => {
                      setPurchaseId(id);
                      const row = purchasesDue.find((p) => p.id === id);
                      const suggested = suggestedChinaSettleAmountPkr({
                        creditAmountPkr: activeCreditAmountPkr,
                        purchaseDue: row?.due || 0,
                      });
                      setSupplierPayAmount(suggested > 0 ? String(suggested) : '');
                    }}
                    placeholder="Select purchase"
                    searchPlaceholder="Search purchase…"
                    emptyText="No matching purchase found"
                    options={purchasesDue.map((p) => ({
                      id: p.id,
                      name: `${p.label} · ${p.supplier} · due ${formatCurrency(p.due)}`,
                      label: p.label,
                      supplier: p.supplier,
                      po: p.label,
                    }))}
                    filterFn={(opt, q) =>
                      filterSearchableOptionsByQuery([opt], q, ['name', 'label', 'supplier', 'po'])
                        .length > 0
                    }
                  />
                </div>

                <div className={cardInnerClass}>
                  <Label className={labelClass}>Pay from TT wallet</Label>
                  <SearchableSelect
                    value={payWalletId}
                    onValueChange={setPayWalletId}
                    placeholder="Select wallet"
                    searchPlaceholder="Search wallet…"
                    emptyText="No matching wallet found"
                    options={wallets.map((w) => ({
                      id: w.id,
                      name: `${w.code} — ${w.name}`,
                      code: w.code,
                      walletName: w.name,
                    }))}
                    filterFn={(opt, q) =>
                      filterSearchableOptionsByQuery([opt], q, ['name', 'code', 'walletName'])
                        .length > 0
                    }
                  />
                </div>

                <div className={cardInnerClass}>
                  <Label className={labelClass}>
                    Amount PKR <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={supplierPayAmount}
                    onChange={(e) => setSupplierPayAmount(e.target.value)}
                    className={amountInputClass}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Suggested from FX credit:{' '}
                    <span className="text-foreground font-medium">
                      {formatCurrency(activeCreditAmountPkr || suggestedStep3Amount)}
                    </span>
                    {selectedPurchase ? (
                      <> (purchase due {formatCurrency(selectedPurchase.due)})</>
                    ) : null}
                    . Not the full purchase bill.
                  </p>
                </div>

                {paymentMetaFields}

                <p className="text-xs text-muted-foreground px-1">
                  Posts Dr China AP / Cr TT wallet via createSupplierPayment (linked purchase).
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-border sticky bottom-0 bg-card pb-1">
              <Button
                type="button"
                variant="outline"
                className="border-border text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-border"
                  onClick={() => setStep((s) => (s - 1) as WizardStep)}
                  disabled={busy}
                >
                  Back
                </Button>
              )}
              <Button
                type="button"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={onPrimary}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {addAgentOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] animate-in fade-in duration-150"
            onClick={() => !creatingAgent && setAddAgentOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-card border border-border/80 rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md pointer-events-auto animate-in zoom-in-95 duration-150 ring-1 ring-white/5"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Add money-exchange agent</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    New contact with type money_exchange
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddAgentOpen(false)}
                  disabled={creatingAgent}
                  className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted rounded-lg"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className={cardInnerClass}>
                  <Label className={labelClass}>Name</Label>
                  <Input
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g. Hamid Exchange"
                    autoFocus
                    className="bg-card border-2 border-border"
                  />
                </div>
                <div className={cardInnerClass}>
                  <Label className={labelClass}>Phone (optional)</Label>
                  <Input
                    value={newAgentPhone}
                    onChange={(e) => setNewAgentPhone(e.target.value)}
                    placeholder="Optional"
                    className="bg-card border-2 border-border"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border text-muted-foreground"
                    onClick={() => setAddAgentOpen(false)}
                    disabled={creatingAgent}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => void handleCreateMoneyExchangeAgent()}
                    disabled={creatingAgent || !newAgentName.trim()}
                  >
                    {creatingAgent ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create agent'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
