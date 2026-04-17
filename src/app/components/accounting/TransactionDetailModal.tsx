'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, FileText, Paperclip, Image as ImageIcon, File, Pencil, RotateCcw, Trash2, ArrowLeftRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { accountingService } from '@/app/services/accountingService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { format } from 'date-fns';
import { cn } from '@/app/components/ui/utils';
import { getAttachmentOpenUrl } from '@/app/utils/paymentAttachmentUrl';
import type { AccountingEntry, PaymentMethod } from '@/app/context/AccountingContext';
import { toast } from 'sonner';
import { getManualReceiptAllocationSummary, type ManualReceiptAllocationSummary } from '@/app/services/paymentAllocationService';
import { UnifiedPaymentDialog, type PaymentDialogProps } from '@/app/components/shared/UnifiedPaymentDialog';
import { getSaleDisplayNumber, getPurchaseDisplayNumber } from '@/app/lib/documentDisplayNumbers';
import { contactService } from '@/app/services/contactService';
import { useAccounting } from '@/app/context/AccountingContext';
import {
  resolveUnifiedJournalEdit,
  inferTransactionKind,
  unifiedEditButtonLabel,
  dispatchAccountingEditCommitted,
} from '@/app/lib/unifiedTransactionEdit';
import { journalReversalBlockedReason } from '@/app/lib/journalEntryEditPolicy';
import { resolvePaymentIdForMutation } from '@/app/lib/paymentRowEditRouting';
import { getPaymentChainMutationBlockReason } from '@/app/services/paymentChainMutationGuard';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import {
  fetchPaymentDeepTrace,
  buildPaymentPostingExpectedVsActual,
  type PaymentDeepTrace,
} from '@/app/services/truthLabTraceWorkbenchService';

function rowMethodToPaymentMethod(m: unknown): PaymentMethod {
  const x = String(m || '').toLowerCase();
  if (x.includes('bank')) return 'Bank';
  if (x.includes('jazz') || x.includes('wallet') || x.includes('easypaisa')) return 'Mobile Wallet';
  return 'Cash';
}

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceNumber: string; // Can be journal_entry_id (UUID) or reference_no (string)
  /** PF-14.3B: When opening from grouped journal row, pass all entries in the document thread to show edit trail. */
  groupEntries?: AccountingEntry[];
  /** After load, open the same unified editor as the primary Edit action (journal / payment / source). */
  autoLaunchUnifiedEdit?: boolean;
  onAutoLaunchUnifiedEditConsumed?: () => void;
}

function mapRentalRowForPaymentDialog(row: Record<string, any>) {
  const customer = row.customer || {};
  return {
    id: String(row.id),
    rentalNo: String(row.rental_no || row.booking_no || ''),
    customerName: String(row.customer_name || customer.name || 'Customer'),
    customerId: String(row.customer_id || customer.id || ''),
    totalAmount: Number(row.total_amount ?? row.rental_charges ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
    dueAmount: Number(row.due_amount ?? 0),
  };
}

/** Resolve party name, document labels, due amounts, and ledger ref when opening UnifiedPaymentDialog from a journal row. */
async function enrichLedgerPaymentEditorFields(args: {
  full: {
    id: string;
    referenceNo: string;
    contactId?: string | null;
    referenceId?: string | null;
    referenceType?: string | null;
  };
  payContactId?: string | null;
  dialogContext: PaymentDialogProps['context'];
  transactionSnapshot: { entry_no?: string; reference_number?: string } | null | undefined;
}): Promise<{
  entityName: string;
  entityId?: string;
  referenceNo?: string;
  referenceId?: string;
  outstandingAmount: number;
  totalAmount?: number;
  paidAmount?: number;
  linkedJournalEntryNo?: string;
}> {
  const prt = String(args.full.referenceType || '').toLowerCase();
  const prid = args.full.referenceId ? String(args.full.referenceId) : '';
  const contactId = (args.full.contactId || args.payContactId || '').trim() || undefined;

  let entityName =
    args.dialogContext === 'supplier'
      ? 'Supplier'
      : args.dialogContext === 'worker'
        ? 'Worker'
        : args.dialogContext === 'rental'
          ? 'Rental'
          : 'Customer';
  let entityId: string | undefined = contactId;
  let totalAmount: number | undefined;
  let paidAmount: number | undefined;
  let outstandingAmount = 0;
  let referenceId: string | undefined =
    prt === 'sale' || prt === 'sale_extra_expense' || prt === 'purchase'
      ? prid || undefined
      : prt === 'manual_receipt'
        ? prid || contactId
        : prid || undefined;

  const docBits: string[] = [];

  if (contactId) {
    try {
      const c = await contactService.getContact(contactId);
      const n = String((c as { name?: string })?.name || '').trim();
      if (n) entityName = n;
    } catch {
      /* ignore */
    }
  }

  if ((prt === 'sale' || prt === 'sale_extra_expense') && prid) {
    try {
      const { saleService } = await import('@/app/services/saleService');
      const sale = await saleService.getSaleById(prid);
      if (sale) {
        const dn = getSaleDisplayNumber(sale as Parameters<typeof getSaleDisplayNumber>[0]);
        if (dn) docBits.push(prt === 'sale_extra_expense' ? `Sale (extra) ${dn}` : `Sale ${dn}`);
        totalAmount = Number((sale as { total?: number }).total) || 0;
        paidAmount = Number((sale as { paid_amount?: number }).paid_amount) || 0;
        outstandingAmount = Math.max(0, Number((sale as { due_amount?: number }).due_amount) || 0);
        const sid = String((sale as { customer_id?: string }).customer_id || '').trim();
        if (sid) entityId = sid;
        const cn = String((sale as { customer_name?: string }).customer_name || '').trim();
        if (cn) entityName = cn;
      }
    } catch {
      /* ignore */
    }
  } else if (prt === 'purchase' && prid) {
    try {
      const { purchaseService } = await import('@/app/services/purchaseService');
      const pu = await purchaseService.getPurchase(prid);
      if (pu) {
        const dn = getPurchaseDisplayNumber(pu as Parameters<typeof getPurchaseDisplayNumber>[0]);
        if (dn) docBits.push(`PO ${dn}`);
        totalAmount = Number((pu as { total?: number }).total) || 0;
        paidAmount = Number((pu as { paid_amount?: number }).paid_amount) || 0;
        outstandingAmount = Math.max(0, Number((pu as { due_amount?: number }).due_amount) || 0);
        const supId = String((pu as { supplier_id?: string }).supplier_id || '').trim();
        if (supId) entityId = supId;
        const sname = String(
          (pu as { supplier?: { name?: string } }).supplier?.name ||
            (pu as { supplier_name?: string }).supplier_name ||
            ''
        ).trim();
        if (sname) entityName = sname;
      }
    } catch {
      /* ignore */
    }
  } else if (prt === 'manual_receipt') {
    docBits.push('Manual customer receipt');
  } else if (prt === 'manual_payment' || prt === 'on_account') {
    docBits.push('Supplier payment');
  } else if (prt === 'payment_adjustment' || prt === 'payment') {
    docBits.push('Payment chain');
  } else if (prt === 'worker_payment' || prt === 'worker_advance_settlement') {
    docBits.push('Worker payment');
  }

  const v = String(args.full.referenceNo || '').trim();
  if (v) docBits.push(`Voucher ${v}`);

  const referenceNo = docBits.length ? docBits.join(' · ') : v || undefined;

  const linkedJournalEntryNo =
    String(args.transactionSnapshot?.entry_no || args.transactionSnapshot?.reference_number || '').trim() || undefined;

  return {
    entityName,
    entityId,
    referenceId,
    referenceNo,
    outstandingAmount,
    totalAmount,
    paidAmount,
    linkedJournalEntryNo,
  };
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  referenceNumber,
  groupEntries,
  autoLaunchUnifiedEdit = false,
  onAutoLaunchUnifiedEditConsumed,
}) => {
  const { companyId, branchId } = useSupabase();
  const { openDrawer, setCurrentView } = useNavigation();
  const accounting = useAccounting();
  const [transaction, setTransaction] = useState<any>(null);
  /** Active PF-07 reversal child exists for loaded header — locks edit/reverse like Journal list. */
  const [txnHasActiveCorrectionReversal, setTxnHasActiveCorrectionReversal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null);
  const [journalQuickEditOpen, setJournalQuickEditOpen] = useState(false);
  const [editEntryDate, setEditEntryDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingJournalEdit, setSavingJournalEdit] = useState(false);
  /** Effective journal lines for payment (original + account-adjustment JEs merged) so Bank shows after Cash→Bank edit */
  const [effectiveLines, setEffectiveLines] = useState<any[]>([]);
  const [manualReceiptSummary, setManualReceiptSummary] = useState<ManualReceiptAllocationSummary | null>(null);
  const [manualReceiptEditorOpen, setManualReceiptEditorOpen] = useState(false);
  const [supplierManualEditorOpen, setSupplierManualEditorOpen] = useState(false);
  const [rentalPaymentEditorOpen, setRentalPaymentEditorOpen] = useState(false);
  const [rentalForPaymentDialog, setRentalForPaymentDialog] = useState<ReturnType<typeof mapRentalRowForPaymentDialog> | null>(
    null
  );
  const [genericPaymentEditor, setGenericPaymentEditor] = useState<{
    context: PaymentDialogProps['context'];
    entityName: string;
    entityId?: string;
    referenceId?: string;
    referenceNo?: string;
    outstandingAmount: number;
    totalAmount?: number;
    paidAmount?: number;
    rentalPaymentKind?: 'advance' | 'remaining';
    linkedJournalEntryNo?: string;
    paymentToEdit: NonNullable<PaymentDialogProps['paymentToEdit']>;
  } | null>(null);
  const autoLaunchConsumedRef = useRef(false);
  const hasChildEditorOpen =
    journalQuickEditOpen ||
    manualReceiptEditorOpen ||
    supplierManualEditorOpen ||
    rentalPaymentEditorOpen ||
    !!genericPaymentEditor;

  const [paymentTraceOpen, setPaymentTraceOpen] = useState(false);
  const [paymentTrace, setPaymentTrace] = useState<PaymentDeepTrace | null>(null);
  const [paymentTraceLoading, setPaymentTraceLoading] = useState(false);

  const loadPaymentTrace = useCallback(async () => {
    if (!companyId || !transaction?.id) return;
    setPaymentTraceLoading(true);
    try {
      const t = await fetchPaymentDeepTrace(companyId, { journalEntryId: String(transaction.id) });
      setPaymentTrace(t);
    } catch (err) {
      console.error(err);
      toast.error('Could not load payment trace');
    } finally {
      setPaymentTraceLoading(false);
    }
  }, [companyId, transaction?.id]);

  useEffect(() => {
    if (paymentTraceOpen && companyId && transaction?.id) {
      void loadPaymentTrace();
    }
  }, [paymentTraceOpen, companyId, transaction?.id, loadPaymentTrace]);

  const postingVsActual = useMemo(
    () => buildPaymentPostingExpectedVsActual(paymentTrace),
    [paymentTrace]
  );

  const [paymentChainBlockReason, setPaymentChainBlockReason] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !transaction?.id) {
      setPaymentChainBlockReason(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await getPaymentChainMutationBlockReason(companyId, String(transaction.id));
      if (!cancelled) setPaymentChainBlockReason(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, transaction?.id]);

  useEffect(() => {
    autoLaunchConsumedRef.current = false;
  }, [referenceNumber]);

  useEffect(() => {
    if (isOpen && referenceNumber && companyId) {
      loadTransaction();
    }
  }, [isOpen, referenceNumber, companyId]);

  useEffect(() => {
    if (!isOpen) {
      setManualReceiptEditorOpen(false);
      setSupplierManualEditorOpen(false);
      setRentalPaymentEditorOpen(false);
      setGenericPaymentEditor(null);
      setRentalForPaymentDialog(null);
      setTxnHasActiveCorrectionReversal(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!transaction || String(transaction.reference_type || '').toLowerCase() !== 'manual_receipt') {
      setManualReceiptSummary(null);
      return;
    }
    const pid = transaction.payment_id ?? (Array.isArray(transaction.payment) ? transaction.payment[0]?.id : transaction.payment?.id);
    if (!pid) {
      setManualReceiptSummary(null);
      return;
    }
    getManualReceiptAllocationSummary(pid)
      .then((s) => setManualReceiptSummary(s))
      .catch(() => setManualReceiptSummary(null));
  }, [transaction]);

  useEffect(() => {
    if (!transaction || !companyId) {
      setEffectiveLines([]);
      return;
    }
    const paymentId = transaction.payment_id ?? (transaction.payment?.[0]?.id ?? transaction.payment?.id);
    if (!paymentId) {
      setEffectiveLines([]);
      return;
    }
    const payment = Array.isArray(transaction.payment) ? transaction.payment[0] : transaction.payment;
    const currentPaymentAccountId = (payment as any)?.payment_account_id ?? null;
    accountingService.getEffectiveJournalLinesForPayment(paymentId, companyId, currentPaymentAccountId).then(setEffectiveLines);
  }, [transaction, companyId]);

  const paymentForReversalPolicy = useMemo(() => {
    if (!transaction) return null;
    return Array.isArray(transaction.payment) ? transaction.payment[0] : transaction.payment;
  }, [transaction]);

  const transactionForUnifiedPolicy = useMemo(() => {
    if (!transaction) return null;
    return { ...transaction, has_active_correction_reversal: txnHasActiveCorrectionReversal };
  }, [transaction, txnHasActiveCorrectionReversal]);

  const journalSourceReverseBlockReason = useMemo(() => {
    if (!transaction) return null;
    return journalReversalBlockedReason(
      {
        reference_type: transaction.reference_type,
        reference_id: transaction.reference_id,
        payment_id: transaction.payment_id,
        is_void: transaction.is_void,
        payment_chain_is_historical: transaction.payment_chain_is_historical,
        hasActiveCorrectionReversal: txnHasActiveCorrectionReversal,
      },
      paymentForReversalPolicy
    );
  }, [transaction, paymentForReversalPolicy, txnHasActiveCorrectionReversal]);

  const openJournalQuickEdit = () => {
    if (!transaction) return;
    setEditEntryDate(
      transaction.entry_date ? format(new Date(transaction.entry_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
    );
    setEditDescription(String(transaction.description || ''));
    setJournalQuickEditOpen(true);
  };

  const saveJournalQuickEdit = async () => {
    if (!companyId || !transaction?.id) return;
    setSavingJournalEdit(true);
    try {
      const res = await accountingService.updateManualJournalEntry(companyId, transaction.id, {
        entry_date: editEntryDate,
        description: editDescription,
      });
      if (!res.ok) {
        toast.error(res.error || 'Could not save journal');
        return;
      }
      toast.success('Journal updated');
      setJournalQuickEditOpen(false);
      await loadTransaction();
      dispatchAccountingEditCommitted();
    } finally {
      setSavingJournalEdit(false);
    }
  };

  const runUnifiedEdit = useCallback(async () => {
    if (!transaction || !transactionForUnifiedPolicy || !companyId) return;
    const blockReason = await getPaymentChainMutationBlockReason(companyId, String(transaction.id));
    if (blockReason) {
      toast.error(blockReason);
      return;
    }
    const pay = Array.isArray(transaction?.payment) ? transaction.payment[0] : transaction?.payment;
    const resolution = resolveUnifiedJournalEdit(transactionForUnifiedPolicy, pay);

    if (resolution.kind === 'blocked') {
      toast.message(resolution.reason);
      return;
    }
    if (resolution.kind === 'noop') {
      toast.message(resolution.reason);
      return;
    }

    const pr = pay as
      | {
          id?: string;
          voided_at?: string | null;
          reference_type?: string;
          reference_id?: string;
        }
      | undefined;

    try {
      switch (resolution.kind) {
        case 'manual_journal_editor':
          openJournalQuickEdit();
          return;
        case 'document_editor': {
          if (resolution.sourceType === 'sale') {
            const { saleService } = await import('@/app/services/saleService');
            const full = await saleService.getSaleById(resolution.sourceId);
            openDrawer('edit-sale', undefined, { sale: full });
            onClose();
            return;
          }
          if (resolution.sourceType === 'purchase') {
            const { purchaseService } = await import('@/app/services/purchaseService');
            const full = await purchaseService.getPurchase(resolution.sourceId);
            openDrawer('edit-purchase', undefined, { purchase: full });
            onClose();
            return;
          }
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('pendingRentalDetailsId', resolution.sourceId);
          }
          setCurrentView('rentals');
          onClose();
          toast.info('Opening Rentals — use the booking drawer to edit.');
          return;
        }
        case 'payment_editor': {
          const pid =
            (transaction.payment_id as string | undefined) ||
            (pr?.id ? resolvePaymentIdForMutation({ id: pr.id, parentPaymentId: (pr as any).parentPaymentId }) : '') ||
            (String(transaction.reference_type || '').toLowerCase() === 'payment_adjustment'
              ? String(transaction.reference_id || '').trim()
              : '');
          if (!pid) {
            toast.error('Could not resolve payment id for editing.');
            return;
          }
          const { saleService } = await import('@/app/services/saleService');
          const full = await saleService.getPaymentById(pid);
          if (!full) {
            toast.error('Payment row not found.');
            return;
          }
          const prt = String(full.referenceType || '').toLowerCase();
          const prid = full.referenceId ? String(full.referenceId) : '';
          const dialogContext: PaymentDialogProps['context'] =
            prt === 'purchase' || prt === 'manual_payment' || prt === 'on_account'
              ? 'supplier'
              : prt === 'worker_payment' || prt === 'worker_advance_settlement'
                ? 'worker'
                : prt === 'rental'
                  ? 'rental'
                  : 'customer'; // includes sale, sale_extra_expense, payment, payment_adjustment, etc.
          if (resolution.context === 'rental' || prt === 'rental') {
            const rentalId = resolution.sourceId || prid;
            if (!rentalId) {
              toast.error('Missing rental reference on payment.');
              return;
            }
            const { rentalService } = await import('@/app/services/rentalService');
            const row = await rentalService.getRental(rentalId);
            setRentalForPaymentDialog(mapRentalRowForPaymentDialog(row as any));
            setRentalPaymentEditorOpen(true);
            return;
          }
          const enriched = await enrichLedgerPaymentEditorFields({
            full: {
              id: full.id,
              referenceNo: full.referenceNo,
              contactId: full.contactId,
              referenceId: full.referenceId,
              referenceType: full.referenceType,
            },
            payContactId: (pay as { contact_id?: string } | undefined)?.contact_id,
            dialogContext,
            transactionSnapshot: transaction,
          });

          setGenericPaymentEditor({
            context: dialogContext,
            entityName: enriched.entityName,
            entityId: enriched.entityId,
            referenceNo: enriched.referenceNo,
            referenceId: enriched.referenceId,
            outstandingAmount: enriched.outstandingAmount,
            totalAmount: enriched.totalAmount,
            paidAmount: enriched.paidAmount,
            linkedJournalEntryNo: enriched.linkedJournalEntryNo,
            paymentToEdit: {
              id: full.id,
              amount: full.amount,
              method: rowMethodToPaymentMethod(full.method),
              accountId: full.accountId,
              date: String(full.date || '').slice(0, 10),
              referenceNumber: full.referenceNo,
              notes: full.notes,
            },
          });
          return;
        }
        case 'transfer_editor':
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('openAddEntryV2', { detail: { entryType: 'internal_transfer' } }));
          }
          setCurrentView('accounting');
          onClose();
          return;
        case 'adjustment_editor':
          if (resolution.sourceType === 'expense' && resolution.sourceId) {
            setCurrentView('expenses');
            onClose();
            toast.info(`Open expense ${resolution.sourceId.slice(0, 8)}… to edit this component.`);
            return;
          }
          // Component/adjustment rows should not open full sale/purchase editor.
          // Keep edits scoped to the adjustment transaction itself.
          openJournalQuickEdit();
          toast.info('Editing adjustment header (date/notes). Use Reverse for amount/account correction flow where needed.');
          return;
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not open editor');
    }
  }, [transaction, transactionForUnifiedPolicy, companyId, openDrawer, setCurrentView, onClose]);

  useEffect(() => {
    if (!autoLaunchUnifiedEdit || !isOpen || loading || !transaction) return;
    if (autoLaunchConsumedRef.current) return;
    autoLaunchConsumedRef.current = true;
    void (async () => {
      await runUnifiedEdit();
      onAutoLaunchUnifiedEditConsumed?.();
    })();
  }, [autoLaunchUnifiedEdit, isOpen, loading, transaction, runUnifiedEdit, onAutoLaunchUnifiedEditConsumed]);

  const loadTransaction = async () => {
    if (!referenceNumber || !companyId) return;

    setLoading(true);
    setTxnHasActiveCorrectionReversal(false);
    try {
      // CRITICAL FIX: Prioritize entry_no lookup (JE-0058) over UUID lookup
      // UUID format: 8-4-4-4-12 hex characters
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referenceNumber);
      const looksLikeEntryNo = /^[A-Z]+-\d+$/i.test(referenceNumber.trim()); // JE-0058, EXP-0001, etc.
      
      console.log('[TRANSACTION DETAIL] Loading transaction:', {
        referenceNumber,
        isUUID,
        looksLikeEntryNo,
        companyId
      });

      let data = null;
      
      // PRIORITY 1: If it looks like entry_no (JE-0058), use reference lookup first
      if (looksLikeEntryNo) {
        console.log('[TRANSACTION DETAIL] Looks like entry_no, using reference lookup first...');
        data = await accountingService.getEntryByReference(referenceNumber, companyId);
        console.log('[TRANSACTION DETAIL] Reference lookup result:', data ? 'FOUND' : 'NOT FOUND');
      }
      
      // PRIORITY 2: If UUID, try ID-based lookup
      if (!data && isUUID) {
        console.log('[TRANSACTION DETAIL] Looks like UUID, using ID lookup...');
        data = await accountingService.getEntryById(referenceNumber, companyId);
        console.log('[TRANSACTION DETAIL] ID lookup result:', data ? 'FOUND' : 'NOT FOUND');
      }
      
      // PRIORITY 3: Fallback to reference lookup (for any other format)
      if (!data && !looksLikeEntryNo) {
        console.log('[TRANSACTION DETAIL] Trying reference lookup as fallback...');
        data = await accountingService.getEntryByReference(referenceNumber, companyId);
        console.log('[TRANSACTION DETAIL] Reference lookup result:', data ? 'FOUND' : 'NOT FOUND');
      }

      // Modal double-entry truth must come from posted journal_entry_lines for the selected JE, not merged payment transforms.
      if (data?.id) {
        const posted = await accountingService.getPostedJournalLinesForEntry(companyId, data.id);
        if (posted.length) {
          data = { ...data, lines: posted };
        }
      }

      let hasActiveRev = false;
      if (data?.id) {
        const revId = await accountingService.findActiveCorrectionReversalJournalId(companyId, data.id);
        hasActiveRev = Boolean(revId);
      }
      setTxnHasActiveCorrectionReversal(hasActiveRev);
      setTransaction(data);

      if (!data) {
        setTxnHasActiveCorrectionReversal(false);
        console.error('[TRANSACTION DETAIL] Transaction not found:', referenceNumber);
        console.error('[TRANSACTION DETAIL] Tried:', {
          entryNoLookup: looksLikeEntryNo,
          uuidLookup: isUUID,
          referenceLookup: true
        });
      }
    } catch (error: any) {
      console.error('[TRANSACTION DETAIL] Error loading transaction:', error);
      setTransaction(null);
      setTxnHasActiveCorrectionReversal(false);
    } finally {
      setLoading(false);
    }
  };

  const handleReverseJournal = async () => {
    if (!transaction?.id || !companyId) return;
    if (journalSourceReverseBlockReason) {
      toast.error(journalSourceReverseBlockReason);
      return;
    }
    const blockReason = await getPaymentChainMutationBlockReason(companyId, String(transaction.id));
    if (blockReason) {
      toast.error(blockReason);
      return;
    }
    if (!window.confirm('Create a reversal entry for this journal? This posts an offsetting entry.')) return;
    const ok = await accounting.createReversalEntry(transaction.id);
    if (ok) {
      toast.success('Reversal posted');
      await loadTransaction();
      dispatchAccountingEditCommitted();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rentalPaymentsChanged'));
    } else {
      toast.error('Could not post reversal');
    }
  };

  // Void/Cancel: mark JE as void (excluded from GL, reports, balances)
  const handleVoidJournal = async () => {
    if (!transaction?.id || !companyId) return;
    if (!window.confirm('Kya aap is entry ko VOID/CANCEL karna chahte hain? Ye GL, reports aur balances se hat jayegi. Is action ko undo nahi kiya ja sakta.')) return;
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('journal_entries')
        .update({ is_void: true, void_reason: 'manual_void', voided_at: new Date().toISOString() })
        .eq('id', transaction.id);
      if (error) throw error;
      toast.success('Entry void/cancel ho gayi hai — GL se remove ho gayi');
      await loadTransaction();
      dispatchAccountingEditCommitted();
      accounting.refreshEntries?.();
    } catch (e: any) {
      toast.error('Void failed: ' + (e?.message || 'Unknown error'));
    }
  };

  // Edit: swap debit/credit accounts on a JE (for wrong account selection fix)
  const [editingAccounts, setEditingAccounts] = useState(false);
  const [accountsList, setAccountsList] = useState<{ id: string; code: string; name: string }[]>([]);
  const [editLineChanges, setEditLineChanges] = useState<Record<string, string>>({});
  const [accountSearch, setAccountSearch] = useState<Record<string, string>>({});

  const handleLoadAccountsForEdit = async () => {
    if (!companyId) return;
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase.from('accounts').select('id, code, name').eq('company_id', companyId).eq('is_active', true).order('code');
    setAccountsList((data || []) as any[]);
    setEditingAccounts(true);
    setEditLineChanges({});
  };

  const handleSaveAccountEdits = async () => {
    if (!transaction?.id || Object.keys(editLineChanges).length === 0) return;
    try {
      const { supabase } = await import('@/lib/supabase');
      for (const [lineId, newAccountId] of Object.entries(editLineChanges)) {
        const { error } = await supabase
          .from('journal_entry_lines')
          .update({ account_id: newAccountId })
          .eq('id', lineId);
        if (error) throw error;
      }
      toast.success(`${Object.keys(editLineChanges).length} line(s) ka account update ho gaya`);
      setEditingAccounts(false);
      setEditLineChanges({});
      await loadTransaction();
      dispatchAccountingEditCommitted();
      accounting.refreshEntries?.();
    } catch (e: any) {
      toast.error('Account edit failed: ' + (e?.message || 'Unknown error'));
    }
  };

  if (!transaction && !loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Transaction Not Found</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 text-gray-400">
            Transaction with reference {referenceNumber} not found.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const rawJournalLines = Array.isArray(transaction?.lines)
    ? transaction.lines
    : transaction?.lines
      ? [transaction.lines]
      : [];
  // Modal double-entry truth must come from posted journal_entry_lines for the selected JE, not merged payment transforms.
  // Do not use getEffectiveJournalLinesForPayment as the primary grid — only as optional auxiliary context below.
  const journalLines = rawJournalLines;
  const payment = Array.isArray(transaction?.payment) 
    ? transaction.payment[0] 
    : transaction?.payment;
  const paymentContactName = String((payment as { contact?: { name?: string } })?.contact?.name || '').trim();
  const sale = Array.isArray(transaction?.sale) 
    ? transaction.sale[0] 
    : transaction?.sale;

  return (
    <>
    <Dialog open={isOpen && !hasChildEditorOpen} onOpenChange={onClose}>
      <DialogContent className="!w-[800px] !max-w-[800px] sm:!max-w-[800px] max-h-[95vh] overflow-auto bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Transaction Details</h2>
              <p className="text-sm text-gray-400 mt-1">Reference: {referenceNumber}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={20} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading transaction details...</div>
        ) : transaction ? (
          <div className="space-y-6">
            {paymentChainBlockReason ? (
              <div className="rounded-lg border border-amber-600/45 bg-amber-950/35 px-3 py-2 text-sm text-amber-100/95 leading-relaxed">
                <span className="font-semibold text-amber-200">Historical payment line — </span>
                {paymentChainBlockReason} Open the <strong className="text-gray-200">latest</strong> journal row for this
                receipt to edit or reverse.
              </div>
            ) : null}
            {journalSourceReverseBlockReason && !paymentChainBlockReason ? (
              <div className="rounded-lg border border-gray-600/50 bg-gray-900/60 px-3 py-2 text-sm text-gray-300 leading-relaxed">
                <span className="font-semibold text-gray-200">Source-controlled — </span>
                {journalSourceReverseBlockReason}
              </div>
            ) : null}
            {/* PF-14.3B: Document trail (original + adjustments) when opened from grouped row */}
            {groupEntries && groupEntries.length > 1 && (
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Document trail (same sale / payment)</h3>
                <p className="text-xs text-gray-500 mb-3">Original entry and any edit or payment adjustments – one logical document.</p>
                <ul className="space-y-2">
                  {[...groupEntries]
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((e) => {
                      const refType = e.metadata?.referenceType ?? '';
                      const label = refType === 'sale' ? 'Original sale' : refType === 'sale_adjustment' ? 'Sale edit' : refType === 'payment_adjustment' ? 'Payment edit' : refType === 'payment' ? 'Payment' : 'Entry';
                      const isPrimary = e.referenceNo === referenceNumber || e.id === referenceNumber;
                      return (
                        <li
                          key={e.id}
                          className={cn(
                            'flex items-center justify-between rounded px-3 py-2 text-sm',
                            isPrimary ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-gray-800/50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-medium w-24">{label}</span>
                            <span className="text-white">{e.referenceNo}</span>
                            <span className="text-gray-500">{format(new Date(e.date), 'dd MMM yyyy')}</span>
                            <span className="text-gray-400 max-w-[200px] truncate">{e.description || '—'}</span>
                          </div>
                          <span className={cn('font-medium tabular-nums', e.amount >= 0 ? 'text-green-400' : 'text-red-400')}>
                            Rs {Math.abs(e.amount).toLocaleString()}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}

            {/* SECTION A: BASIC INFO */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <FileText size={16} />
                  Basic Information
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    if (paymentChainBlockReason) return null;
                    if (!transactionForUnifiedPolicy) return null;
                    const r = resolveUnifiedJournalEdit(transactionForUnifiedPolicy, payment);
                    if (r.kind === 'noop' || r.kind === 'blocked') return null;
                    return (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => void runUnifiedEdit()}
                      >
                        <Pencil size={14} />
                        {unifiedEditButtonLabel(r)}
                      </Button>
                    );
                  })()}
                  {(transaction.payment_id ||
                    String(transaction.reference_type || '').toLowerCase() === 'payment_adjustment') && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1 border-sky-600/40 text-sky-300"
                      onClick={() => setPaymentTraceOpen(true)}
                    >
                      Full payment trace
                    </Button>
                  )}
                  {transaction.id &&
                    !transaction.is_void &&
                    String(transaction.reference_type || '').toLowerCase() !== 'correction_reversal' &&
                    !journalSourceReverseBlockReason && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 border-amber-500/40 text-amber-300"
                        disabled={!!paymentChainBlockReason}
                        title={paymentChainBlockReason || 'Create offsetting correction_reversal JE'}
                        onClick={() => void handleReverseJournal()}
                      >
                        <RotateCcw size={14} />
                        Reverse
                      </Button>
                    )}
                  {/* Void/Cancel: completely remove from GL */}
                  {transaction.id && !transaction.is_void && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1 border-red-500/40 text-red-300"
                      onClick={() => void handleVoidJournal()}
                    >
                      <Trash2 size={14} />
                      Void / Cancel
                    </Button>
                  )}
                  {/* Edit Accounts: only for payment/expense/manual — NOT for sale/purchase/return (those are auto-posted) */}
                  {transaction.id && !transaction.is_void && !editingAccounts && (() => {
                    const rt = String(transaction.reference_type || '').toLowerCase();
                    const allowEdit = !rt.startsWith('sale') && !rt.startsWith('purchase') && rt !== 'shipment' && !rt.startsWith('opening_balance') && rt !== 'commission_batch' && rt !== 'stock_adjustment';
                    if (!allowEdit) return null;
                    return (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 border-blue-500/40 text-blue-300"
                        onClick={() => void handleLoadAccountsForEdit()}
                      >
                        <ArrowLeftRight size={14} />
                        Edit Accounts
                      </Button>
                    );
                  })()}
                  {editingAccounts && (
                    <>
                      <Button size="sm" className="gap-1 bg-blue-600" onClick={() => void handleSaveAccountEdits()} disabled={Object.keys(editLineChanges).length === 0}>
                        Save Account Changes
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditingAccounts(false); setEditLineChanges({}); }}>
                        Cancel Edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Reference Number:</span>
                  <p className="text-white font-medium">{transaction.entry_no || referenceNumber}</p>
                </div>
                <div>
                  <span className="text-gray-400">Transaction date:</span>
                  <p className="text-white">
                    {transaction.entry_date ? format(new Date(transaction.entry_date), 'dd MMM yyyy') : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Posted at:</span>
                  <p className="text-white text-xs">
                    {transaction.created_at ? format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm') : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Last updated:</span>
                  <p className="text-white text-xs">
                    {(transaction as { updated_at?: string }).updated_at
                      ? format(new Date((transaction as { updated_at?: string }).updated_at!), 'dd MMM yyyy HH:mm')
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Source link:</span>
                  <p className="text-white font-mono text-xs break-all">
                    {transaction.reference_type || '—'}
                    {transaction.reference_id ? ` · ${String(transaction.reference_id).slice(0, 8)}…` : ''}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Transaction kind:</span>
                  <p className="text-white text-xs uppercase tracking-wide">
                    {inferTransactionKind(transactionForUnifiedPolicy || transaction, payment).replace(/_/g, ' ')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Module:</span>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 ml-2">
                    {transaction.reference_type === 'sale' || transaction.reference_type === 'sale_adjustment'
                      ? 'Sales'
                      : transaction.reference_type === 'purchase' || transaction.reference_type === 'purchase_adjustment'
                        ? 'Purchases'
                        : transaction.reference_type === 'expense' || transaction.reference_type === 'extra_expense'
                          ? 'Expense'
                          : transaction.reference_type === 'payment' || transaction.reference_type === 'payment_adjustment'
                            ? 'Payment'
                            : transaction.reference_type === 'manual_receipt'
                              ? 'Customer receipt'
                              : transaction.reference_type === 'manual_payment' || transaction.reference_type === 'on_account'
                                ? 'Supplier payment'
                                : transaction.reference_type === 'rental'
                                  ? 'Rental'
                                  : transaction.reference_type === 'journal'
                                    ? 'Manual journal'
                                    : 'Accounting'}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-400">Created By:</span>
                  <p className="text-white">{transaction.created_by ? 'User' : 'System'}</p>
                </div>
                {(transaction as any).branch && (
                  <div>
                    <span className="text-gray-400">Branch:</span>
                    <p className="text-white">
                      {(transaction as any).branch.code 
                        ? `${(transaction as any).branch.code} | ${(transaction as any).branch.name}`
                        : (transaction as any).branch.name}
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-gray-400">Description:</span>
                  <p className="text-white">{transaction.description || 'No description'}</p>
                </div>
              </div>
            </div>

            {/* SECTION B: LINKED RECORDS */}
            {(sale || payment) && (
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Linked Records</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {sale && (
                    <>
                      <div>
                        <span className="text-gray-400">Invoice Number:</span>
                        <p className="text-white font-medium">{sale.invoice_no}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Customer:</span>
                        <p className="text-white">{sale.customer_name}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Total Amount:</span>
                        <p className="text-white">Rs {parseFloat(sale.total || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Paid Amount:</span>
                        <p className="text-green-400">Rs {parseFloat(sale.paid_amount || 0).toLocaleString()}</p>
                      </div>
                    </>
                  )}
                  {payment && (
                    <>
                      <div>
                        <span className="text-gray-400">Payment Reference:</span>
                        <p className="text-white font-medium">{payment.reference_number}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Payment Method:</span>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 ml-2 capitalize">
                          {payment.payment_method}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-gray-400">Payment Amount:</span>
                        <p className="text-white">Rs {parseFloat(payment.amount || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Payment Date:</span>
                        <p className="text-white">
                          {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                        </p>
                      </div>
                      {/* CRITICAL FIX: Show attachment icon if payment has attachments */}
                      {payment.attachments && (
                        <div className="col-span-2">
                          <span className="text-gray-400">Attachments:</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Array.isArray(payment.attachments) ? (
                              payment.attachments.map((att: any, idx: number) => {
                                const url = att.url || att.fileUrl || att;
                                const name = att.name || att.fileName || `Attachment ${idx + 1}`;
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                return (
                                  <button
                                    key={idx}
                                    onClick={async () => {
                                      const openUrl = await getAttachmentOpenUrl(url);
                                      setSelectedAttachment(openUrl);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 transition-colors"
                                  >
                                    {isImage ? <ImageIcon size={16} /> : <File size={16} />}
                                    <span className="text-sm">{name}</span>
                                    <Paperclip size={14} />
                                  </button>
                                );
                              })
                            ) : typeof payment.attachments === 'string' ? (
                              <button
                                onClick={async () => {
                                  const openUrl = await getAttachmentOpenUrl(payment.attachments);
                                  setSelectedAttachment(openUrl);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 transition-colors"
                              >
                                <Paperclip size={16} />
                                <span className="text-sm">View Attachment</span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {manualReceiptSummary && (
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600/40">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">Receipt allocation (FIFO)</h3>
                <p className="text-xs text-slate-500 mb-3">
                  One payment record; amounts below are invoice apply lines only (not separate bank deposits).
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <span className="text-slate-400">Receipt total</span>
                    <p className="text-white font-medium tabular-nums">Rs {manualReceiptSummary.receiptTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Allocated to invoices</span>
                    <p className="text-emerald-400 font-medium tabular-nums">Rs {manualReceiptSummary.allocatedTotal.toLocaleString()}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Unapplied customer credit</span>
                    <p className="text-amber-300 font-medium tabular-nums">Rs {manualReceiptSummary.unapplied.toLocaleString()}</p>
                  </div>
                </div>
                {manualReceiptSummary.lines.length > 0 ? (
                  <ul className="space-y-1.5 text-xs border-t border-slate-700 pt-3">
                    {manualReceiptSummary.lines.map((l) => (
                      <li key={`${l.saleId}-${l.allocationOrder}`} className="flex justify-between gap-2 text-slate-300">
                        <span>
                          #{l.allocationOrder} — {l.invoiceNo || l.saleId.slice(0, 8)}
                          <Badge className="ml-2 bg-blue-500/15 text-blue-300 border-blue-500/30 text-[10px]">manual receipt</Badge>
                        </span>
                        <span className="tabular-nums text-white">Rs {l.amount.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">No invoice allocations — full amount is unapplied credit (no open invoices or zero due).</p>
                )}
              </div>
            )}

            {/* SECTION C: JOURNAL ENTRIES (MOST IMPORTANT) */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Journal Entries (Double Entry)</h3>
              {journalLines.length > 0 ? (
                <p className="text-xs text-gray-400 mb-2">
                  Posted lines for this journal entry (journal_entry_lines). Same basis as GL.
                </p>
              ) : (
                <p className="text-xs text-amber-400/90 mb-2">
                  No posted lines returned for this journal entry — check RLS or line data. (Merged payment &quot;effective&quot;
                  lines are shown below only as secondary context, not as posted double-entry.)
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr className="text-xs font-semibold text-gray-400 uppercase">
                      <th className="px-4 py-2 text-left">Account Name</th>
                      <th className="px-4 py-2 text-right">Debit</th>
                      <th className="px-4 py-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalLines.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-center text-gray-500 text-sm">
                          No posted lines in this grid.
                        </td>
                      </tr>
                    )}
                    {journalLines.map((line: any, idx: number) => {
                      const account = line.account || {};
                      const typeLower = String(account.type || '').toLowerCase();
                      const nameLower = String(account.name || '').toLowerCase();
                      const codeStr = String(account.code || '').trim();
                      const isApPartyLine =
                        (!!paymentContactName &&
                          ((typeLower.includes('liability') && nameLower.includes('payable')) || codeStr === '2000')) ||
                        nameLower.includes('accounts payable');
                      const partySuffix = isApPartyLine && paymentContactName ? ` — ${paymentContactName}` : '';
                      return (
                        <tr key={line.id || line.account_id || idx} className="border-b border-gray-700">
                          <td className="px-4 py-3 text-sm text-white">
                            {editingAccounts && line.id ? (
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Search account..."
                                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white mb-1"
                                  value={accountSearch[line.id] ?? (editLineChanges[line.id] ? accountsList.find(a => a.id === editLineChanges[line.id])?.name || '' : `${account.name || ''} (${account.code || ''})`)}
                                  onChange={(e) => {
                                    setAccountSearch(prev => ({ ...prev, [line.id]: e.target.value }));
                                  }}
                                  onFocus={() => setAccountSearch(prev => ({ ...prev, [line.id]: '' }))}
                                />
                                {accountSearch[line.id] !== undefined && (
                                  <div className="absolute z-50 w-full max-h-48 overflow-y-auto bg-gray-800 border border-gray-600 rounded shadow-lg">
                                    {accountsList
                                      .filter(a => {
                                        const q = (accountSearch[line.id] || '').toLowerCase();
                                        if (!q) return true;
                                        return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
                                      })
                                      .slice(0, 20)
                                      .map(a => (
                                        <button
                                          key={a.id}
                                          type="button"
                                          className={cn(
                                            'w-full text-left px-2 py-1.5 text-xs hover:bg-gray-700 transition-colors',
                                            (editLineChanges[line.id] || line.account_id || account.id) === a.id ? 'bg-blue-900/40 text-blue-300' : 'text-gray-300'
                                          )}
                                          onClick={() => {
                                            setEditLineChanges(prev => ({ ...prev, [line.id]: a.id }));
                                            setAccountSearch(prev => { const n = { ...prev }; delete n[line.id]; return n; });
                                          }}
                                        >
                                          <span className="font-mono text-gray-500 mr-1">{a.code}</span>
                                          {a.name}
                                        </button>
                                      ))}
                                  </div>
                                )}
                                {editLineChanges[line.id] && accountSearch[line.id] === undefined && (
                                  <div className="text-[10px] text-blue-400">Changed → {accountsList.find(a => a.id === editLineChanges[line.id])?.code} {accountsList.find(a => a.id === editLineChanges[line.id])?.name}</div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium">
                                  {account.name || 'Unknown Account'}
                                  {account.code ? ` (${account.code})` : ''}
                                  {partySuffix}
                                </p>
                              </div>
                            )}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-sm text-right tabular-nums",
                            line.debit > 0 ? "text-green-400 font-medium" : "text-gray-500"
                          )}>
                            {line.debit > 0 ? line.debit.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) : '-'}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-sm text-right tabular-nums",
                            line.credit > 0 ? "text-red-400 font-medium" : "text-gray-500"
                          )}>
                            {line.credit > 0 ? line.credit.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-900">
                    <tr className="font-semibold text-white">
                      <td className="px-4 py-2 text-right">Total:</td>
                      <td className="px-4 py-2 text-right text-green-400">
                        {journalLines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-2 text-right text-red-400">
                        {journalLines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {effectiveLines.length > 0 && (transaction.payment_id || payment?.id) && (
                <div className="mt-4 rounded-lg border border-gray-700/80 bg-gray-900/40 p-3">
                  <p className="text-xs font-medium text-gray-400 mb-2">
                    Auxiliary: effective payment accounts (merged JEs — not primary posted truth)
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    Use only to explain cash/bank account changes across payment_adjustment entries. The double-entry table
                    above is authoritative.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs uppercase">
                          <th className="text-left py-1">Account</th>
                          <th className="text-right py-1">Debit</th>
                          <th className="text-right py-1">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {effectiveLines.map((line: any, idx: number) => {
                          const account = line.account || {};
                          return (
                            <tr key={line.account_id || idx} className="border-b border-gray-800/80">
                              <td className="py-1.5 text-gray-200">
                                {(account.name || '—') + (account.code ? ` (${account.code})` : '')}
                              </td>
                              <td className="py-1.5 text-right tabular-nums text-gray-300">
                                {line.debit > 0 ? Number(line.debit).toLocaleString() : '—'}
                              </td>
                              <td className="py-1.5 text-right tabular-nums text-gray-300">
                                {line.credit > 0 ? Number(line.credit).toLocaleString() : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3">Double-entry: total debit must equal total credit.</p>
            </div>

            {/* SECTION D: EXTRA CONTEXT (if applicable) */}
            {transaction.description?.toLowerCase().includes('discount') && (
              <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
                <h3 className="text-sm font-semibold text-yellow-400 mb-2">Sales Discount Applied</h3>
                <p className="text-sm text-gray-300">
                  This transaction includes a sales discount. The discount amount reduces Accounts Receivable.
                </p>
              </div>
            )}

            {transaction.description?.toLowerCase().includes('expense') && (
              <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30">
                <h3 className="text-sm font-semibold text-orange-400 mb-2">Extra Expense Recorded</h3>
                <p className="text-sm text-gray-300">
                  This transaction records an extra expense (e.g., stitching, packing) linked to the sale.
                </p>
              </div>
            )}

            {transaction.description?.toLowerCase().includes('commission') && (
              <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/30">
                <h3 className="text-sm font-semibold text-purple-400 mb-2">Commission Expense</h3>
                <p className="text-sm text-gray-300">
                  This transaction records commission expense for the salesperson.
                </p>
              </div>
            )}
          </div>
        ) : null}

        <Dialog open={journalQuickEditOpen} onOpenChange={setJournalQuickEditOpen}>
          <DialogContent className="max-w-md bg-gray-900 border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Edit manual journal</DialogTitle>
              <p className="text-xs text-gray-400 font-normal">Updates transaction date and description only. Line-level changes use accounting adjustments.</p>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-gray-400">Transaction date</Label>
                <Input type="date" value={editEntryDate} onChange={(e) => setEditEntryDate(e.target.value)} className="bg-gray-950 border-gray-700 mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Description / notes</Label>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="bg-gray-950 border-gray-700 mt-1" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setJournalQuickEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void saveJournalQuickEdit()} disabled={savingJournalEdit}>
                  {savingJournalEdit ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Attachment Viewer Modal */}
        {selectedAttachment && (
          <div 
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedAttachment(null)}
          >
            <div className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center">
              <button
                onClick={() => setSelectedAttachment(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-gray-900/80 rounded-full p-2"
              >
                <X size={24} />
              </button>
              {/\.(jpg|jpeg|png|gif|webp)$/i.test(selectedAttachment) ? (
                <img 
                  src={selectedAttachment} 
                  alt="Attachment" 
                  className="max-w-full max-h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <iframe
                  src={selectedAttachment}
                  className="w-full h-full border-0"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {manualReceiptEditorOpen &&
      payment?.id &&
      String(transaction?.reference_type || '').toLowerCase() === 'manual_receipt' &&
      transaction?.reference_id && (
        <UnifiedPaymentDialog
          isOpen={manualReceiptEditorOpen}
          onClose={() => setManualReceiptEditorOpen(false)}
          context="customer"
          entityName="Customer"
          entityId={String(transaction.reference_id)}
          outstandingAmount={0}
          linkedJournalEntryNo={
            String(transaction?.entry_no || transaction?.reference_number || '').trim() || undefined
          }
          editMode
          paymentToEdit={{
            id: String(payment.id),
            amount: Number((payment as any).amount) || 0,
            method: rowMethodToPaymentMethod((payment as any).payment_method),
            accountId: (payment as any).payment_account_id ?? undefined,
            date: String((payment as any).payment_date || '').slice(0, 10),
            referenceNumber: (payment as any).reference_number,
            notes: (payment as any).notes ?? undefined,
            attachments: (payment as any).attachments,
          }}
          onSuccess={() => {
            setManualReceiptEditorOpen(false);
            void loadTransaction();
            dispatchAccountingEditCommitted({ customerId: String(transaction.reference_id) });
          }}
        />
      )}

    {supplierManualEditorOpen &&
      payment?.id &&
      ['manual_payment', 'on_account'].includes(String(transaction?.reference_type || '').toLowerCase()) &&
      transaction?.reference_id && (
        <UnifiedPaymentDialog
          isOpen={supplierManualEditorOpen}
          onClose={() => setSupplierManualEditorOpen(false)}
          context="supplier"
          entityName="Supplier"
          entityId={String(transaction.reference_id)}
          outstandingAmount={0}
          linkedJournalEntryNo={
            String(transaction?.entry_no || transaction?.reference_number || '').trim() || undefined
          }
          editMode
          paymentToEdit={{
            id: resolvePaymentIdForMutation({
              id: String((payment as any).id),
              parentPaymentId: (payment as any).parentPaymentId,
            }),
            amount: Number((payment as any).amount) || 0,
            method: rowMethodToPaymentMethod((payment as any).payment_method),
            accountId: (payment as any).payment_account_id ?? undefined,
            date: String((payment as any).payment_date || '').slice(0, 10),
            referenceNumber: (payment as any).reference_number,
            notes: (payment as any).notes ?? undefined,
            attachments: (payment as any).attachments,
          }}
          onSuccess={() => {
            setSupplierManualEditorOpen(false);
            void loadTransaction();
            dispatchAccountingEditCommitted({ supplierId: String(transaction.reference_id) });
          }}
        />
      )}

    {rentalPaymentEditorOpen && rentalForPaymentDialog && payment?.id && (
      <UnifiedPaymentDialog
        isOpen={rentalPaymentEditorOpen}
        onClose={() => {
          setRentalPaymentEditorOpen(false);
          setRentalForPaymentDialog(null);
        }}
        context="rental"
        entityName={rentalForPaymentDialog.customerName}
        entityId={rentalForPaymentDialog.customerId || rentalForPaymentDialog.id}
        outstandingAmount={rentalForPaymentDialog.dueAmount}
        totalAmount={rentalForPaymentDialog.totalAmount}
        paidAmount={rentalForPaymentDialog.paidAmount}
        referenceNo={rentalForPaymentDialog.rentalNo}
        referenceId={rentalForPaymentDialog.id}
        rentalPaymentKind="remaining"
        linkedJournalEntryNo={
          String(transaction?.entry_no || transaction?.reference_number || '').trim() || undefined
        }
        editMode
        paymentToEdit={{
          id: resolvePaymentIdForMutation({
            id: String((payment as any).id),
            parentPaymentId: (payment as any).parentPaymentId,
          }),
          amount: Number((payment as any).amount) || 0,
          method: rowMethodToPaymentMethod((payment as any).payment_method),
          accountId: (payment as any).payment_account_id ?? undefined,
          date: String((payment as any).payment_date || '').slice(0, 10),
          referenceNumber: (payment as any).reference_number,
          notes: (payment as any).notes ?? undefined,
          attachments: (payment as any).attachments,
        }}
        onSuccess={() => {
          setRentalPaymentEditorOpen(false);
          setRentalForPaymentDialog(null);
          void loadTransaction();
          dispatchAccountingEditCommitted();
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rentalPaymentsChanged'));
        }}
      />
    )}

    <Sheet open={paymentTraceOpen} onOpenChange={setPaymentTraceOpen}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto bg-gray-950 border-gray-800 text-gray-200">
        <SheetHeader>
          <SheetTitle className="text-white">Payment / GL trace</SheetTitle>
          <p className="text-xs text-gray-500 font-normal">
            Read-only chain from Truth Lab services — mutations, journal entries, allocations. Use AR/AP Truth Lab for deep
            analysis.
          </p>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm">
          {paymentTraceLoading ? (
            <p className="text-gray-400">Loading trace…</p>
          ) : paymentTrace?.errors?.length ? (
            <p className="text-amber-300 text-xs">{paymentTrace.errors.join(' · ')}</p>
          ) : null}
          {paymentTrace?.payment && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 space-y-1 text-xs">
              <p>
                <span className="text-gray-500">Payment id:</span>{' '}
                <span className="font-mono text-gray-200">{String((paymentTrace.payment as { id?: string }).id || '')}</span>
              </p>
              <p>
                <span className="text-gray-500">Reference:</span>{' '}
                <span className="text-gray-200">
                  {String((paymentTrace.payment as { reference_number?: string }).reference_number || '—')}
                </span>
              </p>
              <p>
                <span className="text-gray-500">payment_account_id:</span>{' '}
                <span className="font-mono text-gray-200">
                  {String((paymentTrace.payment as { payment_account_id?: string }).payment_account_id || '—')}
                </span>
              </p>
            </div>
          )}
          {postingVsActual && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1">Expected vs actual (heuristic)</p>
              <p className="text-xs text-gray-300 leading-relaxed">{postingVsActual.narrative}</p>
            </div>
          )}
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              Linked journal entries: <span className="text-gray-300">{paymentTrace?.journalEntries?.length ?? 0}</span>
            </p>
            <p>
              Journal lines: <span className="text-gray-300">{paymentTrace?.journalLines?.length ?? 0}</span>
            </p>
            <p>
              transaction_mutations: <span className="text-gray-300">{paymentTrace?.transactionMutations?.length ?? 0}</span>
            </p>
            <p>
              payment_allocations: <span className="text-gray-300">{paymentTrace?.allocations?.length ?? 0}</span>
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-gray-700"
            onClick={() => {
              setPaymentTraceOpen(false);
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/test/ar-ap-truth-lab');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
          >
            Open AR/AP Truth Lab
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    {genericPaymentEditor && (
      <UnifiedPaymentDialog
        isOpen
        onClose={() => setGenericPaymentEditor(null)}
        context={genericPaymentEditor.context}
        entityName={genericPaymentEditor.entityName}
        entityId={genericPaymentEditor.entityId}
        outstandingAmount={genericPaymentEditor.outstandingAmount}
        totalAmount={genericPaymentEditor.totalAmount}
        paidAmount={genericPaymentEditor.paidAmount}
        referenceNo={genericPaymentEditor.referenceNo}
        referenceId={genericPaymentEditor.referenceId}
        rentalPaymentKind={genericPaymentEditor.rentalPaymentKind}
        linkedJournalEntryNo={genericPaymentEditor.linkedJournalEntryNo}
        editMode
        paymentToEdit={genericPaymentEditor.paymentToEdit}
        onSuccess={() => {
          setGenericPaymentEditor(null);
          void loadTransaction();
          dispatchAccountingEditCommitted({
            customerId: genericPaymentEditor.context === 'customer' ? genericPaymentEditor.entityId : undefined,
            supplierId: genericPaymentEditor.context === 'supplier' ? genericPaymentEditor.entityId : undefined,
          });
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rentalPaymentsChanged'));
        }}
      />
    )}
    </>
  );
};
