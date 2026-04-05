'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, FileText, Paperclip, Image as ImageIcon, File, Pencil, RotateCcw } from 'lucide-react';
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
import { useAccounting } from '@/app/context/AccountingContext';
import {
  resolveUnifiedJournalEdit,
  inferTransactionKind,
  unifiedEditButtonLabel,
  dispatchAccountingEditCommitted,
} from '@/app/lib/unifiedTransactionEdit';
import { resolvePaymentIdForMutation } from '@/app/lib/paymentRowEditRouting';

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
    paymentToEdit: NonNullable<PaymentDialogProps['paymentToEdit']>;
  } | null>(null);
  const autoLaunchConsumedRef = useRef(false);
  const hasChildEditorOpen =
    journalQuickEditOpen ||
    manualReceiptEditorOpen ||
    supplierManualEditorOpen ||
    rentalPaymentEditorOpen ||
    !!genericPaymentEditor;

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
    if (!transaction || !companyId) return;
    const pay = Array.isArray(transaction?.payment) ? transaction.payment[0] : transaction?.payment;
    const resolution = resolveUnifiedJournalEdit(transaction, pay);

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
            (pr?.id ? resolvePaymentIdForMutation({ id: pr.id, parentPaymentId: (pr as any).parentPaymentId }) : '');
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
          setGenericPaymentEditor({
            context: resolution.context,
            entityName:
              resolution.context === 'supplier'
                ? 'Supplier'
                : resolution.context === 'worker'
                  ? 'Worker'
                  : 'Customer',
            entityId:
              resolution.sourceId ||
              (full as { contactId?: string | null }).contactId ||
              prid ||
              (pay as any)?.contact_id ||
              undefined,
            referenceId:
              prt === 'sale' || prt === 'purchase'
                ? prid
                : undefined,
            outstandingAmount: 0,
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
  }, [transaction, companyId, openDrawer, setCurrentView, onClose]);

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

      setTransaction(data);
      
      if (!data) {
        console.error('[TRANSACTION DETAIL] Transaction not found:', referenceNumber);
        console.error('[TRANSACTION DETAIL] Tried:', {
          entryNoLookup: looksLikeEntryNo,
          uuidLookup: isUUID,
          referenceLookup: true
        });
      }
    } catch (error: any) {
      console.error('[TRANSACTION DETAIL] Error loading transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReverseJournal = async () => {
    if (!transaction?.id) return;
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
  // Always show this journal entry's posted lines in the double-entry table. Effective payment lines merge
  // multiple JEs and can mis-attribute debits (e.g. supplier Dr AP / Cr Bank shown as Bank/Bank).
  const journalLines = rawJournalLines.length > 0 ? rawJournalLines : effectiveLines;
  const payment = Array.isArray(transaction?.payment) 
    ? transaction.payment[0] 
    : transaction?.payment;
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
                    const r = resolveUnifiedJournalEdit(transaction, payment);
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
                  {transaction.id &&
                    !transaction.is_void &&
                    String(transaction.reference_type || '').toLowerCase() !== 'correction_reversal' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 border-amber-500/40 text-amber-300"
                        onClick={() => void handleReverseJournal()}
                      >
                        <RotateCcw size={14} />
                        Reverse / void offset
                      </Button>
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
                    {inferTransactionKind(transaction, payment).replace(/_/g, ' ')}
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
              {rawJournalLines.length > 0 ? (
                <p className="text-xs text-gray-400 mb-2">
                  Posted lines for this journal entry (journal_entry_lines). Same basis as GL.
                </p>
              ) : effectiveLines.length > 0 ? (
                <p className="text-xs text-blue-400/90 mb-2">
                  No lines on this entry record — showing effective payment postings (merged JEs).
                </p>
              ) : null}
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
                    {journalLines.map((line: any, idx: number) => {
                      const account = line.account || {};
                      return (
                        <tr key={line.id || line.account_id || idx} className="border-b border-gray-700">
                          <td className="px-4 py-3 text-sm text-white">
                            <div>
                              <p className="font-medium">{account.name || 'Unknown Account'}</p>
                              {account.code && (
                                <p className="text-xs text-gray-400">{account.code}</p>
                              )}
                            </div>
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
