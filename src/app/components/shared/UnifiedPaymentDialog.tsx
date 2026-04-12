import React, { useState, useEffect } from 'react';
import { X, Wallet, Building2, CreditCard, AlertCircle, Check, ChevronDown, Upload, FileText, Calendar, Clock, Trash2, History, Banknote } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useAccounting, type PaymentMethod, type Account } from '@/app/context/AccountingContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { accountHelperService } from '@/app/services/accountHelperService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getAttachmentOpenUrl, getSupabaseStorageDashboardUrl } from '@/app/utils/paymentAttachmentUrl';
import { showStorageRlsToast, MAX_FILE_SIZE_BYTES, showFileTooLargeToast } from '@/app/utils/uploadTransactionAttachments';
import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';
import { dispatchAccountingEditCommitted } from '@/app/lib/unifiedTransactionEdit';
import { resolvePaymentIdForMutation } from '@/app/lib/paymentRowEditRouting';
import { rebuildManualReceiptFifoAllocations, rebuildManualSupplierFifoAllocations } from '@/app/services/paymentAllocationService';
import { syncJournalEntryDateByPaymentId } from '@/app/services/journalTransactionDateSyncService';

// ============================================
// 🎯 TYPES
// ============================================

export type PaymentContextType = 'supplier' | 'customer' | 'worker' | 'rental';

export interface PreviousPayment {
  id: string;
  date: string;
  amount: number;
  method: string;
  accountName?: string;
}

export interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  context: PaymentContextType;
  entityName: string;
  entityId?: string;
  outstandingAmount: number;
  totalAmount?: number; // Total invoice amount (for showing payment progress)
  paidAmount?: number; // Already paid amount
  previousPayments?: PreviousPayment[]; // Payment history for this invoice
  referenceNo?: string; // Invoice number (string) for display
  referenceId?: string; // UUID of sale/purchase/rental (for journal entry reference_id)
  /** Rental: booking advance vs balance — drives JE (Rental Advance vs revenue) and rental_payments.payment_type */
  rentalPaymentKind?: 'advance' | 'remaining';
  /** Pre-fill notes when dialog opens (e.g. rental advance explanation) */
  defaultPaymentNotes?: string;
  /** When context=worker and paying for specific stage (Pay Now), pass stageId so ledger uses markStageLedgerPaid */
  workerStageId?: string;
  onSuccess?: (paymentRef?: string, amountPaid?: number) => void;
  /** Pre-filled attachment files (e.g. from purchase form Attachments card) – included when recording payment */
  initialAttachmentFiles?: File[];
  /** When opened from ledger / transaction detail — shows which JE you are editing (e.g. JE-0073). */
  linkedJournalEntryNo?: string;
  // Edit mode props
  editMode?: boolean;
  paymentToEdit?: {
    id: string;
    amount: number;
    method: string;
    accountId?: string;
    date: string;
    referenceNumber?: string;
    notes?: string;
    attachments?: any; // saved: { url, name }[] or url string
    /** When id is `alloc:<uuid>`, parent payments.id (set by payment history normalizers) */
    parentPaymentId?: string;
  };
}

// Resolve URL and show image for existing attachment (medium size)
function ExistingAttachmentImage({ att }: { att: { url: string; name: string } }) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getAttachmentOpenUrl(att.url).then((url) => {
      if (!cancelled) setResolvedUrl(url);
    });
    return () => { cancelled = true; };
  }, [att.url]);
  if (!resolvedUrl) return <div className="h-24 bg-gray-800 rounded animate-pulse" />;
  return (
    <img
      src={resolvedUrl}
      alt={att.name}
      className="max-w-md max-h-48 w-auto h-auto object-contain rounded border border-gray-700"
    />
  );
}

// ============================================
// 🎯 UNIFIED PAYMENT DIALOG (REDESIGNED)
// ============================================

export const UnifiedPaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  context,
  entityName,
  entityId,
  outstandingAmount,
  totalAmount,
  paidAmount = 0,
  previousPayments = [],
  referenceNo,
  referenceId, // CRITICAL FIX: UUID for journal entry reference_id
  rentalPaymentKind = 'remaining',
  defaultPaymentNotes = '',
  workerStageId,
  onSuccess,
  initialAttachmentFiles,
  linkedJournalEntryNo,
  editMode = false,
  paymentToEdit
}) => {
  // Derive outstanding from total - paid when caller passes 0 but total/paid suggest otherwise.
  // In edit mode, add back the original payment amount — it will be replaced, so the user
  // should be allowed up to (current outstanding + original payment).
  const effectiveOutstanding = (() => {
    let base =
      totalAmount != null && paidAmount != null && outstandingAmount === 0 && (totalAmount - paidAmount) > 0
        ? Math.max(0, totalAmount - paidAmount)
        : outstandingAmount;
    if (editMode && paymentToEdit) {
      base += paymentToEdit.amount;
    }
    return base;
  })();

  const accounting = useAccounting();
  const settings = useSettings();
  const { formatCurrency } = useFormatCurrency();
  const { branchId, companyId, user } = useSupabase();
  const { getNumberingConfig } = useDocumentNumbering();
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 🎯 NEW: Date & Time states (combined as datetime-local)
  const [paymentDateTime, setPaymentDateTime] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  
  // New files to upload
  const [attachments, setAttachments] = useState<File[]>([]);
  // Existing attachments (when editing) – from DB, so they show and are re-sent on save
  const [existingAttachments, setExistingAttachments] = useState<{ url: string; name: string }[]>([]);
  const prevOpenRef = React.useRef(false);
  /** After user taps Cash/Bank/Wallet in edit mode, stop forcing the saved payment_account_id + inferred method. */
  const userPickedPaymentMethodRef = React.useRef(false);

  // Reset form when dialog opens; set attachments from initialAttachmentFiles only when opening (so purchase-form files are not overwritten)
  React.useEffect(() => {
    if (isOpen) {
      const justOpened = !prevOpenRef.current;
      prevOpenRef.current = true;
      if (editMode && paymentToEdit) {
        setAmount(paymentToEdit.amount);
        setPaymentMethod((paymentToEdit.method.charAt(0).toUpperCase() + paymentToEdit.method.slice(1)) as PaymentMethod || 'Cash');
        setSelectedAccount(String(paymentToEdit.accountId || '').trim());
        setNotes(paymentToEdit.notes || '');
        let raw: any = paymentToEdit.attachments;
        if (typeof raw === 'string' && raw.trim()) {
          const trimmed = raw.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
              raw = JSON.parse(raw);
            } catch {
              raw = null;
            }
          }
        }
        const list: { url: string; name: string }[] = [];
        if (Array.isArray(raw)) {
          raw.forEach((a: any) => {
            const url = typeof a === 'string' ? a : (a?.url || a?.fileUrl || a?.href);
            const name = (typeof a === 'object' && a?.name) ? a.name : (typeof a === 'object' && (a?.fileName || a?.file_name)) ? (a.fileName || a.file_name) : 'Attachment';
            if (url) list.push({ url, name });
          });
        } else if (typeof raw === 'object' && raw && !Array.isArray(raw) && (raw.url || raw.fileUrl)) {
          list.push({ url: raw.url || raw.fileUrl || '', name: raw.name || raw.fileName || 'Attachment' });
        } else if (typeof raw === 'string' && raw) {
          list.push({ url: raw, name: 'Attachment' });
        }
        setExistingAttachments(list);
        const paymentDate = new Date(paymentToEdit.date);
        const year = paymentDate.getFullYear();
        const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
        const day = String(paymentDate.getDate()).padStart(2, '0');
        const hours = String(paymentDate.getHours() || 0).padStart(2, '0');
        const minutes = String(paymentDate.getMinutes() || 0).padStart(2, '0');
        setPaymentDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      } else {
        // Pay Now (workerStageId): do not pre-fill job amount so we never record job amount as payment by mistake
        setAmount(workerStageId ? 0 : Math.max(0, effectiveOutstanding));
        setPaymentMethod('Cash');
        setSelectedAccount('');
        setNotes(defaultPaymentNotes || '');
        setExistingAttachments([]);
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setPaymentDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      }
      if (justOpened) {
        setAttachments(initialAttachmentFiles?.length ? [...initialAttachmentFiles] : []);
      }
    } else {
      prevOpenRef.current = false;
    }
  }, [isOpen, editMode, paymentToEdit, initialAttachmentFiles, effectiveOutstanding, workerStageId, defaultPaymentNotes]);

  React.useEffect(() => {
    if (!isOpen) userPickedPaymentMethodRef.current = false;
  }, [isOpen]);

  // Refresh accounts when dialog opens so user-assigned accounts (user_account_access) are visible after RLS
  React.useEffect(() => {
    if (isOpen && companyId) {
      accounting.refreshEntries().catch(() => {});
    }
  }, [isOpen, companyId]);

  // Normalize payment method for matching DB types (cash, bank, mobile_wallet)
  const normalizePaymentType = (t: string) => String(t || '').toLowerCase().trim().replace(/\s+/g, '_');

  // 🎯 Filter accounts based on payment method AND branch
  // Match UI (Cash/Bank/Mobile Wallet) and DB (cash/bank/mobile_wallet); include 10xx/102x sub-accounts (e.g. 1011-NDM for Bank)
  const getFilteredAccounts = (): Account[] => {
    const methodNorm = normalizePaymentType(paymentMethod);
    const isCash = methodNorm === 'cash';
    const isBank = methodNorm === 'bank';
    const isWallet = methodNorm === 'mobile_wallet' || methodNorm === 'mobilewallet';

    return accounting.accounts.filter(account => {
      if (account.isActive === false) return false;

      const accType = normalizePaymentType(String((account as any).type ?? account.accountType ?? ''));
      const accCode = String((account as any).code ?? '');
      const accName = (account.name || '').toLowerCase();

      const typeMatches =
        accType === methodNorm ||
        (isCash && (accType === 'cash' || accCode === '1000' || accName.includes('cash'))) ||
        (isBank && (accType === 'bank' || accCode === '1010' || accName.includes('bank') || accCode.startsWith('101'))) ||
        (isWallet && (accType === 'mobile_wallet' || accType === 'wallet' || accCode === '1020' || accName.includes('wallet') || accCode.startsWith('102')));

      if (!typeMatches) return false;

      // Include if: no branch restriction (global) OR matches current branch (compare by ID when available) OR branch is "all"
      const accountBranch = (account as any).branchId || account.branch || '';
      const isGlobal = !accountBranch || accountBranch === 'global' || accountBranch === '';
      const isBranchSpecific = branchId && branchId !== 'all' && (accountBranch === branchId || accountBranch === String(branchId));
      const showAllBranches = !branchId || branchId === 'all';

      return isGlobal || isBranchSpecific || showAllBranches;
    });
  };

  /** Align UI payment method with a saved GL row (e.g. Petty Cash under Cash) when filter bucket was wrong. */
  const inferPaymentMethodForSavedAccount = (account: Account): PaymentMethod => {
    const accType = normalizePaymentType(String((account as any).type ?? account.accountType ?? ''));
    const accCode = String((account as any).code ?? '');
    const accName = (account.name || '').toLowerCase();
    if (
      accType === 'mobile_wallet' ||
      accType === 'wallet' ||
      accCode === '1020' ||
      accName.includes('wallet') ||
      accCode.startsWith('102')
    ) {
      return 'Mobile Wallet';
    }
    if (accType === 'bank' || accCode === '1010' || accName.includes('bank') || accCode.startsWith('101')) {
      return 'Bank';
    }
    return 'Cash';
  };

  /** Dropdown options: normal filter + saved payment account when edit mode would otherwise hide it (branch / type edge). */
  const getAccountsForPaymentSelect = (): Account[] => {
    const filtered = getFilteredAccounts();
    if (!editMode || !paymentToEdit?.accountId || userPickedPaymentMethodRef.current) return filtered;
    const savedId = String(paymentToEdit.accountId).trim();
    if (!savedId || filtered.some((a) => a.id === savedId)) return filtered;
    const saved = accounting.accounts.find((a) => a.id === savedId);
    if (!saved) return filtered;
    return [saved, ...filtered];
  };

  // Reset account selection when payment method changes + Auto-select default account (never clobber edit prefill)
  React.useEffect(() => {
    if (!companyId || !isOpen) return;

    const filteredAccounts = getFilteredAccounts();
    const savedEditId = editMode && paymentToEdit?.accountId ? String(paymentToEdit.accountId).trim() : '';

    if (savedEditId) {
      if (accounting.accounts.length === 0) {
        return;
      }
      const savedRow = accounting.accounts.find((a) => a.id === savedEditId);
      if (savedRow && !userPickedPaymentMethodRef.current) {
        const inFiltered = filteredAccounts.some((a) => a.id === savedEditId);
        if (!inFiltered) {
          const inferred = inferPaymentMethodForSavedAccount(savedRow);
          if (inferred !== paymentMethod) {
            setPaymentMethod(inferred);
            return;
          }
        }
        setSelectedAccount(savedEditId);
        return;
      }
      if (!savedRow) {
        setSelectedAccount(savedEditId);
        return;
      }
      // Edit mode but user chose a different payment method — fall through to default account for that method
    }

    if (filteredAccounts.length === 0) {
      setSelectedAccount('');
      return;
    }

    const defaultPayment = settings.defaultAccounts?.paymentMethods?.find((p) => p.method === paymentMethod);

    if (defaultPayment?.defaultAccount) {
      const matchingAccount = filteredAccounts.find((acc) => acc.name === defaultPayment.defaultAccount);
      if (matchingAccount) {
        setSelectedAccount(matchingAccount.id);
        return;
      }
    }

    if (paymentMethod === 'Cash') {
      const cashAccount = filteredAccounts.find(
        (acc) => acc.code === '1000' || acc.name.toLowerCase() === 'cash'
      );
      if (cashAccount) {
        setSelectedAccount(cashAccount.id);
        return;
      }
    }

    if (paymentMethod === 'Bank') {
      const bankAccount = filteredAccounts.find(
        (acc) => acc.code === '1010' || acc.name.toLowerCase() === 'bank'
      );
      if (bankAccount) {
        setSelectedAccount(bankAccount.id);
        return;
      }
    }

    if (filteredAccounts.length > 0) {
      setSelectedAccount(filteredAccounts[0].id);
      return;
    }

    setSelectedAccount('');
  }, [
    paymentMethod,
    settings.defaultAccounts,
    accounting.accounts,
    companyId,
    isOpen,
    branchId,
    editMode,
    paymentToEdit?.accountId,
    paymentToEdit?.id,
  ]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    e.target.value = '';
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-select amount on focus (global numeric input behavior)
  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (amount > 0) {
      e.target.select();
    }
  };

  // Handle amount change (0 = empty display)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setAmount(value);
  };

  // Get context-specific labels
  const getContextLabels = () => {
    switch (context) {
      case 'supplier':
        return {
          title: 'Make Payment to Supplier',
          entityLabel: 'Supplier',
          actionButton: 'Make Payment',
          successMessage: 'Payment made successfully',
          badge: 'bg-red-500/10 text-red-400 border-red-500/20',
          icon: '💰'
        };
      case 'customer':
        return {
          title: 'Receive Payment from Customer',
          entityLabel: 'Customer',
          actionButton: 'Receive Payment',
          successMessage: 'Payment received successfully',
          badge: 'bg-green-500/10 text-green-400 border-green-500/20',
          icon: '💵'
        };
      case 'worker':
        return {
          title: 'Pay Worker',
          entityLabel: 'Worker',
          actionButton: 'Make Payment',
          successMessage: 'Worker payment completed',
          badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          icon: '👷'
        };
      case 'rental':
        if (rentalPaymentKind === 'advance') {
          return {
            title: 'Receive rental advance',
            entityLabel: 'Rental booking',
            actionButton: 'Receive payment',
            successMessage: 'Rental advance recorded',
            badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            icon: '🏠'
          };
        }
        return {
          title: 'Pay Rental',
          entityLabel: 'Rental',
          actionButton: 'Make Payment',
          successMessage: 'Rental payment completed',
          badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          icon: '🏠'
        };
    }
  };

  const labels = getContextLabels();

  // 🎯 Validation - Account ALWAYS required. On-account (no referenceId): any positive amount; document-linked: cap by outstanding
  const canSubmit = 
    amount > 0 && 
    selectedAccount !== '' &&
    !isProcessing &&
    (referenceId ? amount <= effectiveOutstanding : true);

  // Handle payment submission
  const handleSubmit = async () => {
    // 🔧 FIX 4: PAYMENT ACCOUNT VALIDATION (MANDATORY)
    if (!selectedAccount || selectedAccount === '') {
      toast.error('Payment account is required. Please select an account.');
      return;
    }
    
    if (amount <= 0) {
      toast.error('Payment amount must be greater than zero.');
      return;
    }
    
    if (referenceId && amount > effectiveOutstanding) {
      toast.error(`Payment amount cannot exceed outstanding amount of ${effectiveOutstanding.toLocaleString()}`);
      return;
    }
    
    if (!canSubmit) return;

    setIsProcessing(true);

    try {
      let success = false;
      let workerPaymentRef: string | undefined;

      // EDIT MODE: Update existing payment (keep existing attachments + upload new ones)
      if (editMode && paymentToEdit) {
        const paymentDate = paymentDateTime.split('T')[0];
        let mergedAttachments: { url: string; name: string }[] = [...existingAttachments];
        if (attachments.length > 0 && companyId) {
          let anyUploadFailed = false;
          try {
            const bucket = 'payment-attachments';
            const prefix = `${companyId}/${referenceId}/${Date.now()}`;
            for (let i = 0; i < attachments.length; i++) {
              const file = attachments[i];
              if (file.size > MAX_FILE_SIZE_BYTES) {
                anyUploadFailed = true;
                showFileTooLargeToast(file.name);
                continue;
              }
              const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
              const path = `${prefix}_${i}_${safeName}`;
              const { error: upError } = await supabase.storage.from(bucket).upload(path, file, {
                upsert: true,
                contentType: file.type || 'application/octet-stream',
              });
              if (!upError) {
                const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
                mergedAttachments.push({ url: urlData?.publicUrl || path, name: file.name });
              } else {
                anyUploadFailed = true;
                console.warn('[UnifiedPaymentDialog] Edit: upload failed', upError);
                const em = String(upError?.message || '').toLowerCase();
                if (em.includes('exceeded') && (em.includes('maximum') || em.includes('size'))) showFileTooLargeToast(file.name);
                else if (em.includes('row-level security') || em.includes('policy')) showStorageRlsToast();
                else if (em.includes('bucket not found')) {
                  toast.warning('Storage bucket "payment-attachments" not found. Create it in Supabase, then run migration 20.', {
                    duration: 10000,
                    action: { label: 'Open Storage', onClick: () => window.open(getSupabaseStorageDashboardUrl(), '_blank') },
                  });
                }
              }
            }
            if (anyUploadFailed) toast.warning('Some attachments could not be uploaded; payment will save without them.', { duration: 5000 });
          } catch (e) {
            console.warn('[UnifiedPaymentDialog] Edit: attachment upload failed', e);
            toast.warning('Attachment upload failed; payment will save without new files.');
          }
        }
        const updatePayload = {
          amount,
          paymentMethod,
          accountId: selectedAccount,
          paymentDate,
          referenceNumber: (paymentToEdit as any).referenceNumber ?? undefined,
          notes: notes || undefined,
          attachments: mergedAttachments.length ? mergedAttachments : undefined,
        };
        let paymentIdForUpdate: string;
        try {
          paymentIdForUpdate = resolvePaymentIdForMutation({
            id: paymentToEdit.id,
            parentPaymentId: paymentToEdit.parentPaymentId,
          });
        } catch (e: any) {
          toast.error(e?.message || 'Invalid payment id — refresh payment history and try again.');
          setIsProcessing(false);
          return;
        }
        if (context === 'customer' && referenceId) {
          const { tracePaymentEditFlow } = await import('@/app/lib/paymentEditFlowTrace');
          tracePaymentEditFlow('UnifiedPaymentDialog.edit.sale_purchase_routed', {
            route: 'saleService.updatePayment',
            paymentId: paymentIdForUpdate,
            referenceId,
            updatePayload,
          });
          const { saleService } = await import('@/app/services/saleService');
          await saleService.updatePayment(paymentIdForUpdate, referenceId, updatePayload);
          success = true;
        } else if (context === 'supplier' && referenceId) {
          const { tracePaymentEditFlow } = await import('@/app/lib/paymentEditFlowTrace');
          tracePaymentEditFlow('UnifiedPaymentDialog.edit.sale_purchase_routed', {
            route: 'purchaseService.updatePayment',
            paymentId: paymentIdForUpdate,
            referenceId,
            updatePayload,
          });
          const { purchaseService } = await import('@/app/services/purchaseService');
          await purchaseService.updatePayment(paymentIdForUpdate, referenceId, updatePayload);
          success = true;
        } else if (context === 'rental' && referenceId && companyId) {
          const { rentalService } = await import('@/app/services/rentalService');
          await rentalService.updateRentalPayment(referenceId, paymentIdForUpdate, companyId, {
            amount,
            paymentDate,
            method: paymentMethod,
            reference: (paymentToEdit as any).referenceNumber ?? notes,
            notes: notes || undefined,
            accountId: selectedAccount,
          });
          success = true;
        } else {
          // Manual / on-account payment edits may not have source referenceId.
          let preManualAmount: number | null = null;
          let preManualBranch: string | null = null;
          let preManualAccountId: string | null = null;
          if (editMode && paymentToEdit) {
            const { data: preRow } = await supabase
              .from('payments')
              .select('amount, branch_id, payment_account_id')
              .eq('id', paymentIdForUpdate)
              .single();
            if (preRow) {
              preManualAmount = Number((preRow as { amount?: number }).amount ?? 0);
              preManualBranch = (preRow as { branch_id?: string | null }).branch_id ?? null;
              const pa = (preRow as { payment_account_id?: string | null }).payment_account_id;
              preManualAccountId = pa && String(pa).trim() ? String(pa) : null;
            }
          }
          const paymentMethodMap: Record<string, string> = {
            cash: 'cash',
            bank: 'bank',
            'mobile wallet': 'wallet',
            wallet: 'wallet',
            easypaisa: 'wallet',
            jazzcash: 'wallet',
          };
          const pm = String(paymentMethod || '').toLowerCase().trim();
          const normalizedPm = paymentMethodMap[pm] || 'cash';
          const patch: any = {
            amount,
            payment_method: normalizedPm,
            payment_account_id: selectedAccount || null,
            payment_date: paymentDate,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          };
          if (mergedAttachments.length) patch.attachments = mergedAttachments;
          const { data: updatedPayment, error: upErr } = await supabase
            .from('payments')
            .update(patch)
            .eq('id', paymentIdForUpdate)
            .select('id, company_id, reference_type')
            .single();
          if (upErr) throw upErr;
          const rt = String((updatedPayment as any)?.reference_type || '').toLowerCase();
          {
            const { tracePaymentEditFlow } = await import('@/app/lib/paymentEditFlowTrace');
            tracePaymentEditFlow('UnifiedPaymentDialog.edit.manual_patch_done', {
              paymentId: paymentIdForUpdate,
              context,
              reference_type: rt,
              preManualAmount,
              preManualAccountId,
              newAmount: amount,
              newAccountId: selectedAccount,
            });
          }
          if (rt === 'manual_receipt') await rebuildManualReceiptFifoAllocations({ paymentId: paymentIdForUpdate });
          if (rt === 'manual_payment') await rebuildManualSupplierFifoAllocations({ paymentId: paymentIdForUpdate });
          if (companyId && paymentDate) {
            await syncJournalEntryDateByPaymentId({
              companyId,
              paymentId: paymentIdForUpdate,
              entryDate: paymentDate,
            });
          }
          // Supplier Add Entry / on-account manual_payment: amount edit updated `payments` only — GL must get a delta JE (same as purchase-linked path).
          const deltaLiquidityId =
            preManualAccountId ||
            (paymentToEdit?.accountId && String(paymentToEdit.accountId).trim() ? String(paymentToEdit.accountId) : null);
          if (
            editMode &&
            context === 'supplier' &&
            rt === 'manual_payment' &&
            preManualAmount != null &&
            companyId &&
            deltaLiquidityId &&
            Math.abs(preManualAmount - amount) > 0.009
          ) {
            try {
              const { tracePaymentEditFlow } = await import('@/app/lib/paymentEditFlowTrace');
              tracePaymentEditFlow('UnifiedPaymentDialog.edit.manual_amount_adjust', {
                paymentId: paymentIdForUpdate,
                kind: 'manual_payment',
                preManualAmount,
                amount,
                deltaLiquidityId,
              });
              const { postPaymentAmountAdjustment } = await import('@/app/services/paymentAdjustmentService');
              const { resolvePayablePostingAccountId } = await import('@/app/services/partySubledgerAccountService');
              const apId = entityId ? await resolvePayablePostingAccountId(companyId, entityId) : null;
              const { data: { user } } = await supabase.auth.getUser();
              await postPaymentAmountAdjustment({
                context: 'purchase',
                companyId,
                branchId:
                  preManualBranch && String(preManualBranch).trim() && preManualBranch !== 'all'
                    ? preManualBranch
                    : null,
                paymentId: paymentIdForUpdate,
                referenceId: paymentIdForUpdate,
                oldAmount: preManualAmount,
                newAmount: amount,
                paymentAccountId: deltaLiquidityId,
                invoiceNoOrRef: String((paymentToEdit as any).referenceNumber || 'Supplier payment'),
                entryDate: paymentDate,
                createdBy: (user as any)?.id ?? null,
                payableAccountId: apId || undefined,
              });
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
              }
            } catch (adjErr) {
              console.warn('[UnifiedPaymentDialog] Supplier manual_payment amount adjustment JE failed:', adjErr);
            }
          }
          // Customer Add Entry / on-account manual_receipt: same class as supplier manual — update `payments` + FIFO only; original JE lines unchanged without a delta JE.
          if (
            editMode &&
            context === 'customer' &&
            rt === 'manual_receipt' &&
            preManualAmount != null &&
            companyId &&
            deltaLiquidityId &&
            Math.abs(preManualAmount - amount) > 0.009
          ) {
            try {
              const { tracePaymentEditFlow } = await import('@/app/lib/paymentEditFlowTrace');
              tracePaymentEditFlow('UnifiedPaymentDialog.edit.manual_amount_adjust', {
                paymentId: paymentIdForUpdate,
                kind: 'manual_receipt',
                preManualAmount,
                amount,
                deltaLiquidityId,
              });
              const { postPaymentAmountAdjustment } = await import('@/app/services/paymentAdjustmentService');
              const { resolveReceivablePostingAccountId } = await import('@/app/services/partySubledgerAccountService');
              const arId = entityId ? await resolveReceivablePostingAccountId(companyId, entityId) : null;
              const { data: { user } } = await supabase.auth.getUser();
              await postPaymentAmountAdjustment({
                context: 'sale',
                companyId,
                branchId:
                  preManualBranch && String(preManualBranch).trim() && preManualBranch !== 'all'
                    ? preManualBranch
                    : null,
                paymentId: paymentIdForUpdate,
                referenceId: paymentIdForUpdate,
                oldAmount: preManualAmount,
                newAmount: amount,
                paymentAccountId: deltaLiquidityId,
                invoiceNoOrRef: String((paymentToEdit as any).referenceNumber || 'Customer receipt'),
                entryDate: paymentDate,
                createdBy: (user as any)?.id ?? null,
                receivableAccountId: arId || undefined,
              });
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
              }
            } catch (adjErr) {
              console.warn('[UnifiedPaymentDialog] Customer manual_receipt amount adjustment JE failed:', adjErr);
            }
          }
          // PF-14: manual receipt/payment account change — post Dr new / Cr old for final amount (after any amount delta above).
          if (
            editMode &&
            companyId &&
            preManualAccountId &&
            selectedAccount &&
            preManualAccountId !== selectedAccount &&
            amount > 0.009
          ) {
            if (context === 'customer' && rt === 'manual_receipt') {
              try {
                const { tracePaymentEditFlow } = await import('@/app/lib/paymentEditFlowTrace');
                tracePaymentEditFlow('UnifiedPaymentDialog.edit.manual_account_transfer', {
                  paymentId: paymentIdForUpdate,
                  kind: 'manual_receipt',
                  preManualAccountId,
                  selectedAccount,
                  amount,
                });
                const { postPaymentAccountAdjustment } = await import('@/app/services/paymentAdjustmentService');
                const { data: { user } } = await supabase.auth.getUser();
                await postPaymentAccountAdjustment({
                  context: 'sale',
                  companyId,
                  branchId:
                    preManualBranch && String(preManualBranch).trim() && preManualBranch !== 'all'
                      ? preManualBranch
                      : null,
                  paymentId: paymentIdForUpdate,
                  referenceId: paymentIdForUpdate,
                  oldAccountId: preManualAccountId,
                  newAccountId: selectedAccount,
                  amount,
                  invoiceNoOrRef: String((paymentToEdit as any).referenceNumber || 'Customer receipt'),
                  entryDate: paymentDate,
                  createdBy: (user as any)?.id ?? null,
                });
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
                }
              } catch (accErr) {
                console.warn('[UnifiedPaymentDialog] Customer manual_receipt account transfer JE failed:', accErr);
              }
            }
            if (context === 'supplier' && rt === 'manual_payment') {
              try {
                const { tracePaymentEditFlow } = await import('@/app/lib/paymentEditFlowTrace');
                tracePaymentEditFlow('UnifiedPaymentDialog.edit.manual_account_transfer', {
                  paymentId: paymentIdForUpdate,
                  kind: 'manual_payment',
                  preManualAccountId,
                  selectedAccount,
                  amount,
                });
                const { postPaymentAccountAdjustment } = await import('@/app/services/paymentAdjustmentService');
                const { data: { user } } = await supabase.auth.getUser();
                await postPaymentAccountAdjustment({
                  context: 'purchase',
                  companyId,
                  branchId:
                    preManualBranch && String(preManualBranch).trim() && preManualBranch !== 'all'
                      ? preManualBranch
                      : null,
                  paymentId: paymentIdForUpdate,
                  referenceId: paymentIdForUpdate,
                  oldAccountId: preManualAccountId,
                  newAccountId: selectedAccount,
                  amount,
                  invoiceNoOrRef: String((paymentToEdit as any).referenceNumber || 'Supplier payment'),
                  entryDate: paymentDate,
                  createdBy: (user as any)?.id ?? null,
                });
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
                }
              } catch (accErr) {
                console.warn('[UnifiedPaymentDialog] Supplier manual_payment account transfer JE failed:', accErr);
              }
            }
          }
          success = true;
        }
      } else {
        // ADD MODE: Create new payment
        // Route to appropriate accounting function based on context
        switch (context) {
          case 'supplier': {
          const isOnAccount = !referenceId;
          if (!selectedAccount) {
            toast.error('Please select an account for payment');
            setIsProcessing(false);
            return;
          }
          if (!companyId) {
            toast.error('Company ID is required');
            setIsProcessing(false);
            return;
          }
          try {
            let attachmentPayload: { url: string; name: string }[] = [];
            const storagePrefixRef = referenceId || entityId || 'on-account';
            if (attachments.length > 0 && companyId) {
              let anyUploadFailed = false;
              try {
                const bucket = 'payment-attachments';
                const prefix = `${companyId}/${storagePrefixRef}/${Date.now()}`;
                for (let i = 0; i < attachments.length; i++) {
                  const file = attachments[i];
                  if (file.size > MAX_FILE_SIZE_BYTES) {
                    anyUploadFailed = true;
                    showFileTooLargeToast(file.name);
                    continue;
                  }
                  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                  const path = `${prefix}_${i}_${safeName}`;
                  const { error: upError } = await supabase.storage.from(bucket).upload(path, file, {
                    upsert: true,
                    contentType: file.type || 'application/octet-stream',
                  });
                  if (!upError) {
                    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
                    attachmentPayload.push({ url: urlData?.publicUrl || path, name: file.name });
                  } else {
                    anyUploadFailed = true;
                    console.warn('[UnifiedPaymentDialog] Supplier upload failed', upError);
                    const em = String(upError?.message || '').toLowerCase();
                    if (em.includes('exceeded') && (em.includes('maximum') || em.includes('size'))) showFileTooLargeToast(file.name);
                    else if (em.includes('row-level security') || em.includes('policy')) showStorageRlsToast();
                    else if (em.includes('bucket not found')) {
                      toast.warning('Storage bucket "payment-attachments" not found. Create it in Supabase, then run migration 20.', {
                        duration: 10000,
                        action: { label: 'Open Storage', onClick: () => window.open(getSupabaseStorageDashboardUrl(), '_blank') },
                      });
                    }
                  }
                }
                if (anyUploadFailed) toast.warning('Some attachments could not be uploaded; payment will save without them.', { duration: 5000 });
              } catch (storageErr) {
                console.warn('[UnifiedPaymentDialog] Attachment upload failed:', storageErr);
                toast.warning('Attachment upload failed; payment will save without attachments.');
              }
            }
            const { purchaseService } = await import('@/app/services/purchaseService');
            let paymentRefNo: string;
            if (isOnAccount) {
              if (!entityId) {
                toast.error('Contact is required for on-account payment');
                setIsProcessing(false);
                return;
              }
              let effectiveBranchId = branchId && branchId !== 'all' ? branchId : null;
              if (!effectiveBranchId && companyId) {
                const { branchService } = await import('@/app/services/branchService');
                const branches = await branchService.getAllBranches(companyId);
                effectiveBranchId = branches?.[0]?.id ?? null;
              }
              if (!effectiveBranchId) {
                toast.error('Branch is required. Please create at least one branch.');
                setIsProcessing(false);
                return;
              }
              // Canonical path: recordOnAccountPayment creates 1 payment + 1 JE (no second JE)
              const onAccountData = await purchaseService.recordOnAccountPayment(
                entityId,
                entityName,
                amount,
                paymentMethod,
                selectedAccount,
                companyId,
                effectiveBranchId,
                paymentDateTime.split('T')[0],
                { notes: notes.trim() || undefined, attachments: attachmentPayload.length ? attachmentPayload : undefined }
              );
              paymentRefNo = onAccountData?.reference_number || `PAY-${Date.now()}`;
              success = true;
            } else {
              // Canonical path: recordPayment creates 1 payment + 1 JE (do not call recordSupplierPayment – would create duplicate JE)
              const recordedPayment = await purchaseService.recordPayment(
                referenceId,
                amount,
                paymentMethod,
                selectedAccount,
                companyId,
                branchId && branchId !== 'all' ? branchId : undefined,
                undefined,
                { notes: notes.trim() || undefined, attachments: attachmentPayload.length ? attachmentPayload : undefined }
              );
              paymentRefNo = (recordedPayment as any)?.reference_number || referenceNo || `PUR-${Date.now()}`;
              success = true;
            }
          } catch (paymentError: any) {
            console.error('[UNIFIED PAYMENT] Error recording purchase payment:', paymentError);
            toast.error('Payment failed', {
              description: paymentError.message || 'Unable to record payment. Please try again.'
            });
            setIsProcessing(false);
            return;
          }
          }
          break;

        case 'customer': {
          const customerOnAccount = !referenceId;
          if (!selectedAccount) {
            toast.error('Please select an account for payment');
            setIsProcessing(false);
            return;
          }
          if (!companyId) {
            toast.error('Company ID is required');
            setIsProcessing(false);
            return;
          }
          let effectiveBranchId = branchId && branchId !== 'all' ? branchId : null;
          if (!effectiveBranchId && companyId) {
            try {
              const { branchService } = await import('@/app/services/branchService');
              const branches = await branchService.getAllBranches(companyId);
              effectiveBranchId = branches?.[0]?.id ?? null;
            } catch {
              effectiveBranchId = null;
            }
          }
          if (!customerOnAccount && !effectiveBranchId) {
            toast.error('Branch ID is required');
            setIsProcessing(false);
            return;
          }
          try {
            let attachmentPayload: { url: string; name: string }[] = [];
            const storagePrefixRef = referenceId || entityId || 'on-account';
            if (attachments.length > 0 && companyId) {
              let anyUploadFailed = false;
              try {
                const bucket = 'payment-attachments';
                const prefix = `${companyId}/${storagePrefixRef}/${Date.now()}`;
                for (let i = 0; i < attachments.length; i++) {
                  const file = attachments[i];
                  if (file.size > MAX_FILE_SIZE_BYTES) {
                    anyUploadFailed = true;
                    showFileTooLargeToast(file.name);
                    continue;
                  }
                  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                  const path = `${prefix}_${i}_${safeName}`;
                  const { error: upError } = await supabase.storage.from(bucket).upload(path, file, {
                    upsert: true,
                    contentType: file.type || 'application/octet-stream',
                  });
                  if (!upError) {
                    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
                    attachmentPayload.push({ url: urlData?.publicUrl || path, name: file.name });
                  } else {
                    anyUploadFailed = true;
                    console.warn('[UnifiedPaymentDialog] Customer upload failed', upError);
                    const em = String(upError?.message || '').toLowerCase();
                    if (em.includes('exceeded') && (em.includes('maximum') || em.includes('size'))) showFileTooLargeToast(file.name);
                    else if (em.includes('row-level security') || em.includes('policy')) showStorageRlsToast();
                    else if (em.includes('bucket not found')) {
                      toast.warning('Storage bucket "payment-attachments" not found. Create it in Supabase, then run migration 20.', {
                        duration: 10000,
                        action: { label: 'Open Storage', onClick: () => window.open(getSupabaseStorageDashboardUrl(), '_blank') },
                      });
                    }
                  }
                }
                if (anyUploadFailed) toast.warning('Some attachments could not be uploaded; payment will save without them.', { duration: 5000 });
              } catch (storageErr) {
                console.warn('[UnifiedPaymentDialog] Attachment upload failed, saving payment without attachments:', storageErr);
                toast.warning('Attachment upload failed; payment will save without attachments.');
              }
            }
            const { saleService } = await import('@/app/services/saleService');
            if (customerOnAccount) {
              if (!entityId) {
                toast.error('Contact is required for on-account payment');
                setIsProcessing(false);
                return;
              }
              let branchForPayment = effectiveBranchId;
              if (!branchForPayment && companyId) {
                const { branchService } = await import('@/app/services/branchService');
                const branches = await branchService.getAllBranches(companyId);
                branchForPayment = branches?.[0]?.id ?? null;
              }
              if (!branchForPayment) {
                toast.error('Branch is required. Please create at least one branch.');
                setIsProcessing(false);
                return;
              }
              const onAccountData = await saleService.recordOnAccountPayment(
                entityId,
                entityName,
                amount,
                paymentMethod,
                selectedAccount,
                companyId,
                branchForPayment,
                paymentDateTime.split('T')[0],
                { notes: notes.trim() || undefined, attachments: attachmentPayload.length ? attachmentPayload : undefined }
              );
              if (!onAccountData?.id) {
                toast.error('Payment saved but missing id.');
                success = false;
              } else {
                // Journal is created inside recordOnAccountPayment (single canonical path).
                success = true;
              }
            } else {
              await saleService.recordPayment(
                referenceId,
                amount,
                paymentMethod,
                selectedAccount,
                companyId,
                effectiveBranchId || branchId || '',
                paymentDateTime.split('T')[0],
                undefined,
                { notes: notes.trim() || undefined, attachments: attachmentPayload.length ? attachmentPayload : undefined }
              );
              success = await accounting.recordSalePayment({
                saleId: referenceId,
                invoiceNo: referenceNo || `INV-${Date.now()}`,
                customerName: entityName,
                customerId: entityId,
                amount,
                paymentMethod,
                accountId: selectedAccount
              });
            }
          } catch (paymentError: any) {
            console.error('[UNIFIED PAYMENT] Error recording payment:', paymentError);
            toast.error('Payment failed', {
              description: paymentError.message || 'Unable to record payment. Please try again.'
            });
            setIsProcessing(false);
            return;
          }
          break;
        }

        case 'worker': {
          // Canonical path: workerPaymentService creates payment + journal + ledger (Roznamcha shows via payments)
          const result = await accounting.recordWorkerPayment({
            workerName: entityName,
            workerId: entityId,
            amount,
            paymentMethod,
            paymentAccountId: selectedAccount,
            stageId: workerStageId,
            stageAmount: workerStageId ? effectiveOutstanding : undefined,
          });
          success = Boolean(result);
          if (result && typeof result === 'object' && result.referenceNumber) workerPaymentRef = result.referenceNumber;
          break;
        }

        case 'rental':
          if (!referenceId || !companyId) {
            toast.error('Rental ID and Company are required');
            setIsProcessing(false);
            return;
          }
          try {
            const { rentalService } = await import('@/app/services/rentalService');
            const payDay = paymentDateTime.split('T')[0];
            const noteText =
              notes?.trim() ||
              (rentalPaymentKind === 'advance' && referenceNo
                ? `Advance received for rental booking ${referenceNo}`
                : undefined);
            const journalSince = new Date(Date.now() - 8_000).toISOString();
            const rp = await rentalService.addPayment(
              referenceId,
              companyId,
              amount,
              paymentMethod,
              noteText,
              user?.id ?? undefined,
              {
                paymentType: rentalPaymentKind === 'advance' ? 'advance' : 'remaining',
                paymentDate: payDay,
                paymentAccountId: selectedAccount,
              }
            );
            if (rentalPaymentKind === 'advance') {
              await accounting
                .recordRentalBooking({
                  bookingId: referenceId,
                  customerName: entityName,
                  customerId: entityId || '',
                  advanceAmount: amount,
                  securityDepositAmount: 0,
                  securityDepositType: 'Document',
                  paymentMethod,
                  paymentAccountId: selectedAccount,
                  paymentDate: payDay,
                })
                .catch((err) => {
                  console.warn('[UnifiedPaymentDialog] Rental advance JE failed (payment recorded):', err);
                });
            } else {
              await accounting
                .recordRentalDelivery({
                  bookingId: referenceId,
                  customerName: entityName,
                  customerId: entityId || '',
                  remainingAmount: amount,
                  paymentMethod,
                  paymentAccountId: selectedAccount,
                  paymentDate: payDay,
                })
                .catch((err) => {
                  console.warn('[UnifiedPaymentDialog] Ledger posting failed (payment recorded):', err);
                });
            }
            const jeId = await rentalService.findLatestJournalEntryForRental(companyId, referenceId, journalSince);
            if (rp?.id && jeId) {
              await rentalService.linkJournalEntryToRentalPayment(rp.id, jeId);
            }
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('rentalPaymentsChanged'));
            }
            success = true;
          } catch (rentalError: any) {
            toast.error(rentalError?.message || 'Rental payment failed');
            setIsProcessing(false);
            return;
          }
          break;
        }
      }

      if (success) {
        const selectedAccountDetails = accounting.accounts.find(a => a.id === selectedAccount);
        const accountInfo = selectedAccountDetails ? ` from ${selectedAccountDetails.name}` : '';
        toast.success(labels.successMessage, {
          description: `${formatCurrency(amount)} via ${paymentMethod}${accountInfo} on ${paymentDateTime}`
        });
        if (companyId) dispatchContactBalancesRefresh(companyId);
        dispatchAccountingEditCommitted(
          context === 'customer' && entityId
            ? { customerId: String(entityId) }
            : context === 'supplier' && entityId
              ? { supplierId: String(entityId) }
              : undefined
        );
        if (context === 'worker') onSuccess?.(workerPaymentRef, amount);
        else onSuccess?.();
        onClose();
      } else {
        toast.error('Payment failed', {
          description: 'Unable to process payment. Please try again.'
        });
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error('Payment failed', {
        description: error?.message || 'An error occurred while processing payment.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — match AddEntryV2 (click-outside + aria) */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog shell — same tokens as AddEntryV2 */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          className="bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl shadow-black/40 w-full max-w-4xl pointer-events-auto animate-in zoom-in-95 duration-200 my-6 max-h-[92vh] overflow-y-auto ring-1 ring-white/5"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl">
                {labels.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {editMode ? 'Edit Payment' : labels.title}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Complete transaction details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body - TWO COLUMN LAYOUT */}
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* LEFT COLUMN */}
              <div className="space-y-4">
                
                {/* Entity Info Card */}
                <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-400">{labels.entityLabel} Details</span>
                    <Badge variant="outline" className={labels.badge}>
                      {context.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold text-white mb-1">{entityName}</p>
                  {editMode ? (
                    <div className="space-y-1.5 mb-2 text-[11px] leading-snug">
                      {linkedJournalEntryNo ? (
                        <p className="text-gray-300">
                          <span className="text-gray-500">Ledger entry</span>{' '}
                          <span className="font-mono text-amber-200/90">{linkedJournalEntryNo}</span>
                        </p>
                      ) : null}
                      {referenceNo ? (
                        <p className="text-gray-300">
                          <span className="text-gray-500">Document / context</span>{' '}
                          <span className="text-gray-100">{referenceNo}</span>
                        </p>
                      ) : null}
                      {paymentToEdit?.referenceNumber ? (
                        <p className="text-gray-300">
                          <span className="text-gray-500">Payment voucher</span>{' '}
                          <span className="font-mono text-sky-200/90">{paymentToEdit.referenceNumber}</span>
                        </p>
                      ) : (
                        <p className="text-amber-400/85 text-[10px]">Payment voucher: — (check notes below)</p>
                      )}
                    </div>
                  ) : (
                    referenceNo && (
                      <p className="text-xs text-gray-500 font-mono bg-gray-900/50 px-2 py-1 rounded inline-block">
                        Ref: {referenceNo}
                      </p>
                    )
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                    {/* Show total amount if provided */}
                    {totalAmount !== undefined && totalAmount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Total Amount</span>
                        <span className="text-sm font-semibold text-white">
                          {formatCurrency(totalAmount)}
                        </span>
                      </div>
                    )}
                    {/* Show paid amount if any */}
                    {paidAmount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Already Paid</span>
                        <span className="text-sm font-semibold text-green-400">
                          {formatCurrency(paidAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                      <span className="text-xs text-gray-400">Due / outstanding</span>
                      <span className="text-xl font-bold text-yellow-400">
                        {formatCurrency(effectiveOutstanding)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 pt-1">Amount owed on this document or party for this payment context.</p>
                  </div>
                </div>
                
                {/* 🎯 Payment History Section (if previous payments exist) */}
                {previousPayments.length > 0 && (
                  <div className="bg-gradient-to-br from-green-950/20 to-gray-900/50 border border-green-900/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <History size={14} className="text-green-400" />
                      <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">
                        Already Received Payments ({previousPayments.length})
                      </span>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {previousPayments.map((payment, index) => (
                        <div key={payment.id || index} className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                              <Banknote size={12} className="text-green-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">
                                {new Date(payment.date).toLocaleDateString('en-GB', { 
                                  day: '2-digit', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                              </p>
                              {payment.accountName && (
                                <p className="text-[10px] text-gray-500">{payment.method} • {payment.accountName}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-green-400">
                            {formatCurrency(payment.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment Amount */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Payment Amount <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">
                      {settings.company?.currency === 'PKR' || !settings.company?.currency ? 'Rs.' : settings.company.currency}
                    </span>
                    <input
                      type="number"
                      value={amount === 0 ? '' : amount}
                      onChange={handleAmountChange}
                      onFocus={handleAmountFocus}
                      placeholder="0.00"
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg pl-14 pr-4 py-3 text-white text-xl font-bold placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                      min="0"
                      max={effectiveOutstanding}
                      step="0.01"
                    />
                  </div>
                  {amount > effectiveOutstanding && (
                    <div className="flex items-center gap-2 mt-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                      <AlertCircle size={14} />
                      <span>Amount cannot exceed outstanding balance</span>
                    </div>
                  )}
                  {amount > 0 && amount <= effectiveOutstanding && (
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-gray-400">Remaining Balance</span>
                      <span className="text-green-400 font-semibold">
                        {formatCurrency(effectiveOutstanding - amount)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Payment Method - COMPACT */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Payment Method <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        userPickedPaymentMethodRef.current = true;
                        setPaymentMethod('Cash');
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all ${
                        paymentMethod === 'Cash'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                      }`}
                    >
                      <Wallet size={18} className={paymentMethod === 'Cash' ? 'text-blue-400' : 'text-gray-400'} />
                      <span className={`text-xs font-medium ${paymentMethod === 'Cash' ? 'text-blue-400' : 'text-gray-400'}`}>
                        Cash
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        userPickedPaymentMethodRef.current = true;
                        setPaymentMethod('Bank');
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all ${
                        paymentMethod === 'Bank'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                      }`}
                    >
                      <Building2 size={18} className={paymentMethod === 'Bank' ? 'text-blue-400' : 'text-gray-400'} />
                      <span className={`text-xs font-medium ${paymentMethod === 'Bank' ? 'text-blue-400' : 'text-gray-400'}`}>
                        Bank
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        userPickedPaymentMethodRef.current = true;
                        setPaymentMethod('Mobile Wallet');
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all ${
                        paymentMethod === 'Mobile Wallet'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                      }`}
                    >
                      <CreditCard size={18} className={paymentMethod === 'Mobile Wallet' ? 'text-blue-400' : 'text-gray-400'} />
                      <span className={`text-xs font-medium ${paymentMethod === 'Mobile Wallet' ? 'text-blue-400' : 'text-gray-400'}`}>
                        Wallet
                      </span>
                    </button>
                  </div>
                </div>

                {/* Account Selection */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Select Account <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-2.5 pr-10 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    >
                      <option value="" className="text-gray-500">
                        {paymentMethod === 'Cash' && 'Select Cash Account'}
                        {paymentMethod === 'Bank' && 'Select Bank Account'}
                        {paymentMethod === 'Mobile Wallet' && 'Select Wallet Account'}
                      </option>
                      {getAccountsForPaymentSelect().map((account) => (
                        <option key={account.id} value={account.id} className="text-white bg-gray-900">
                          {account.name} • GL: {formatCurrency(account.balance)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  </div>
                  {getAccountsForPaymentSelect().length === 0 && (
                    <p className="text-xs text-amber-500/90 mt-1.5 flex items-center gap-1">
                      <AlertCircle size={11} />
                      No accounts available. Ensure account access is assigned in User Management → Edit User → Account Access, and that your admin has applied the accounts RLS migration on the server.
                    </p>
                  )}
                  {selectedAccount === '' && getAccountsForPaymentSelect().length > 0 && (
                    <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                      <AlertCircle size={11} />
                      Please select an account to proceed
                    </p>
                  )}
                  {selectedAccount && (() => {
                    const account = accounting.accounts.find(a => a.id === selectedAccount);
                    const bal = account ? Number(account.balance) || 0 : 0;
                    if (account && amount > bal) {
                      return (
                        <div className="space-y-2 mt-3">
                          <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/80 px-3 py-2">
                            <span className="text-xs text-gray-400">Account balance (GL)</span>
                            <span className="text-sm font-bold text-emerald-400 tabular-nums">{formatCurrency(bal)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-orange-400 text-xs bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
                            <AlertCircle size={14} />
                            <span>Payment amount exceeds this account&apos;s GL (journal) balance.</span>
                          </div>
                        </div>
                      );
                    }
                    if (account) {
                      return (
                        <div className="mt-3 space-y-2">
                          <div className="text-xs text-gray-400">
                            Selected: <span className="text-white font-medium">{account.name}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                            <span className="text-xs text-gray-400">Account balance (GL)</span>
                            <span className="text-base font-bold text-emerald-400 tabular-nums">{formatCurrency(bal)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">
                
                {/* Date & Time */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Payment Date & Time <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      type="datetime-local"
                      value={paymentDateTime}
                      onChange={(e) => setPaymentDateTime(e.target.value)}
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Attachments */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Attachments (Optional)
                  </label>

                  {/* Existing attachments (edit mode) – saved in DB; show image preview for images */}
                  {existingAttachments.length > 0 && (
                    <div className="mb-3 space-y-2">
                      <p className="text-xs text-gray-500 mb-2">Saved attachments (included on save):</p>
                      <div className="flex flex-col gap-2">
                        {existingAttachments.map((att, idx) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name || '');
                          return (
                            <div key={idx} className="flex flex-col gap-1.5 p-2 rounded-lg bg-gray-800/50 border border-gray-700">
                              {isImage ? (
                                <ExistingAttachmentImage att={att} />
                              ) : null}
                              <div className="flex items-center justify-between gap-2">
                                {!isImage && <FileText size={14} className="text-blue-400 shrink-0" />}
                                <span className="text-xs text-gray-200 truncate flex-1">{att.name}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="shrink-0 border-gray-600 text-gray-300 hover:bg-gray-700 text-xs h-7"
                                  onClick={async () => {
                                    const url = await getAttachmentOpenUrl(att.url);
                                    window.open(url, '_blank');
                                  }}
                                >
                                  Open in new tab
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Upload Area */}
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900/50 transition-all text-center">
                      <Upload className="mx-auto mb-2 text-gray-500" size={24} />
                      <p className="text-xs text-gray-400 mb-0.5">
                        <span className="text-blue-400 font-medium">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-600">PDF, PNG, JPG up to 10MB</p>
                    </div>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                    />
                  </label>

                  {/* New files to upload */}
                  {attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg p-2"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="text-blue-400 flex-shrink-0" size={16} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-white font-medium truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add payment notes, remarks, or additional details..."
                    rows={5}
                    className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-5 border-t border-gray-800 bg-gray-950/50">
            <div className="text-xs text-gray-400">
              {(existingAttachments.length > 0 || attachments.length > 0) && (
                <span className="flex items-center gap-1.5">
                  <FileText size={12} />
                  {existingAttachments.length > 0 && `${existingAttachments.length} saved`}
                  {existingAttachments.length > 0 && attachments.length > 0 && ' · '}
                  {attachments.length > 0 && `${attachments.length} new file${attachments.length > 1 ? 's' : ''}`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 text-sm"
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="bg-blue-600 hover:bg-blue-500 text-white min-w-[150px] px-5 py-2.5 text-sm font-semibold"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check size={16} />
                    {editMode ? 'Update Payment' : labels.actionButton}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};