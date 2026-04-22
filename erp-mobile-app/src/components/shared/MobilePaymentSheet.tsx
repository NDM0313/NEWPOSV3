import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Check,
  Wallet,
  Building2,
  Banknote,
  CreditCard,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Upload,
  FileText,
} from 'lucide-react';
import { getPaymentAccounts } from '../../api/accounts';
import { getBranches } from '../../api/branches';
import { MAX_FILE_SIZE_BYTES, ACCEPT_TYPES } from '../../api/paymentAttachments';
import { TransactionSuccessModal, type TransactionSuccessData } from './TransactionSuccessModal';
import { PdfPreviewModal } from './PdfPreviewModal';
import { ReceiptPreviewPdf } from './ReceiptPreviewPdf';
import { usePdfPreview } from './usePdfPreview';

export type PaymentSheetMode =
  | 'receive'
  | 'pay-supplier'
  | 'pay-worker'
  | 'rental'
  | 'expense';

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'wallet';

export interface MobilePaymentSheetSubmitPayload {
  amount: number;
  method: PaymentMethod;
  accountId: string;
  accountName: string;
  paymentDate: string;
  reference: string;
  notes: string;
  attachments: File[];
  companyId: string;
  branchId: string | null;
  userId: string | null;
}

export interface MobilePaymentSheetSubmitResult {
  success: boolean;
  error?: string | null;
  paymentId?: string | null;
  referenceNumber?: string | null;
  /** Optional AR/AP child account name for the success receipt. */
  partyAccountName?: string | null;
}

export interface MobilePaymentSheetProps {
  mode: PaymentSheetMode;
  companyId: string;
  branchId: string | null;
  userId?: string | null;
  /** Customer / supplier / worker / expense category / rental customer name. */
  partyName?: string | null;
  /** Reference number for display (sale/invoice/PO/booking). */
  referenceNo?: string | null;
  /** For receive/pay flows — gross total of the underlying document. */
  totalAmount?: number | null;
  /** Amount already paid against the doc. */
  alreadyPaid?: number | null;
  /** Outstanding / due amount. */
  outstandingAmount?: number | null;
  /** Allow the user to enter more than the outstanding (e.g. advance). */
  allowOverpayment?: boolean;
  /** Pre-filled amount — default is the outstanding. */
  initialAmount?: number;
  /** Heading override — default derived from mode. */
  title?: string;
  /** Subtitle text. */
  subtitle?: string;
  /** Label for the CTA button. */
  submitLabel?: string;
  /** Party chip / pill label (CUSTOMER / SUPPLIER / WORKER). */
  partyKindLabel?: string;
  /** Disable the "Pay Full" shortcut. */
  hidePayFull?: boolean;
  /** Hide the total/paid summary (e.g. for expense). */
  hideSummary?: boolean;

  onClose: () => void;
  onSuccess: () => void;
  /** Provided by caller — the actual DB write. */
  onSubmit: (payload: MobilePaymentSheetSubmitPayload) => Promise<MobilePaymentSheetSubmitResult>;
  /** Navigate to the party ledger, filtered by payment. */
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  wallet: 'Wallet',
};

function defaultTitle(mode: PaymentSheetMode): string {
  switch (mode) {
    case 'receive':
      return 'Receive Payment from Customer';
    case 'pay-supplier':
      return 'Pay Supplier';
    case 'pay-worker':
      return 'Pay Worker';
    case 'rental':
      return 'Add Rental Payment';
    case 'expense':
      return 'Record Expense';
    default:
      return 'Payment';
  }
}

function defaultSubtitle(mode: PaymentSheetMode): string {
  return mode === 'expense' ? 'Record a business expense' : 'Complete transaction details';
}

function defaultPartyLabel(mode: PaymentSheetMode): string {
  switch (mode) {
    case 'receive':
    case 'rental':
      return 'CUSTOMER';
    case 'pay-supplier':
      return 'SUPPLIER';
    case 'pay-worker':
      return 'WORKER';
    case 'expense':
      return 'CATEGORY';
    default:
      return '';
  }
}

function defaultSubmitLabel(mode: PaymentSheetMode): string {
  switch (mode) {
    case 'receive':
    case 'rental':
      return 'Receive Payment';
    case 'pay-supplier':
    case 'pay-worker':
      return 'Pay Now';
    case 'expense':
      return 'Save Expense';
    default:
      return 'Save';
  }
}

function successTitle(mode: PaymentSheetMode): string {
  switch (mode) {
    case 'receive':
      return 'Payment Received Successfully';
    case 'pay-supplier':
      return 'Supplier Payment Saved';
    case 'pay-worker':
      return 'Worker Payment Saved';
    case 'rental':
      return 'Rental Payment Saved';
    case 'expense':
      return 'Expense Saved';
    default:
      return 'Saved Successfully';
  }
}

function shareHeading(mode: PaymentSheetMode): string {
  switch (mode) {
    case 'receive':
      return 'Payment Received';
    case 'pay-supplier':
      return 'Supplier Payment';
    case 'pay-worker':
      return 'Worker Payment';
    case 'rental':
      return 'Rental Payment';
    case 'expense':
      return 'Expense Receipt';
    default:
      return 'Payment Receipt';
  }
}

export function MobilePaymentSheet(props: MobilePaymentSheetProps) {
  const {
    mode,
    companyId,
    branchId,
    userId,
    partyName,
    referenceNo,
    totalAmount,
    alreadyPaid,
    outstandingAmount,
    allowOverpayment = false,
    initialAmount,
    title,
    subtitle,
    submitLabel,
    partyKindLabel,
    hidePayFull = false,
    hideSummary = false,
    onClose,
    onSuccess,
    onSubmit,
    onViewLedger,
  } = props;

  const resolvedTitle = title ?? defaultTitle(mode);
  const resolvedSubtitle = subtitle ?? defaultSubtitle(mode);
  const resolvedSubmit = submitLabel ?? defaultSubmitLabel(mode);
  const resolvedPartyLabel = partyKindLabel ?? defaultPartyLabel(mode);

  const baseAmount = initialAmount ?? outstandingAmount ?? 0;
  const [amount, setAmount] = useState<number>(baseAmount > 0 ? baseAmount : 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [accountId, setAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [accounts, setAccounts] = useState<
    Array<{ id: string; name: string; type: string; balance: number }>
  >([]);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<
    (TransactionSuccessData & { fromAccountName?: string; toAccountName?: string; paymentIdRaw?: string | null }) | null
  >(null);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!toast) return;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [toast]);

  useEffect(() => {
    if (!companyId) return;
    getPaymentAccounts(companyId).then(({ data }) => {
      const list = (data || []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance ?? 0,
      }));
      setAccounts(list);
    });
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    getBranches(companyId).then(({ data }) => {
      const b = data?.find((x) => x.id === branchId);
      setBranchName(b?.name ?? null);
    });
  }, [companyId, branchId]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (paymentMethod === 'cash') return a.type === 'cash';
      if (paymentMethod === 'bank') return a.type === 'bank';
      if (paymentMethod === 'card') return a.type === 'bank';
      return a.type === 'mobile_wallet' || a.type === 'asset';
    });
  }, [accounts, paymentMethod]);

  useEffect(() => {
    const first = filteredAccounts[0];
    if (first && !filteredAccounts.some((a) => a.id === accountId)) {
      setAccountId(first.id);
    }
  }, [filteredAccounts, accountId]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const dueDisplay = outstandingAmount ?? 0;
  const amountExceedsBalance =
    mode !== 'receive' && mode !== 'rental' && selectedAccount && amount > selectedAccount.balance && selectedAccount.balance >= 0;

  const amountExceedsDue =
    !allowOverpayment && mode !== 'expense' && mode !== 'pay-worker' && outstandingAmount != null && amount > outstandingAmount;

  const isValid =
    amount > 0 &&
    !!accountId &&
    filteredAccounts.some((a) => a.id === accountId) &&
    (allowOverpayment || mode === 'expense' || mode === 'pay-worker' || outstandingAmount == null || amount <= outstandingAmount);

  const handlePayFull = () => {
    if (outstandingAmount && outstandingAmount > 0) setAmount(outstandingAmount);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const next: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size <= MAX_FILE_SIZE_BYTES) next.push(f);
      else setToast({ message: `${f.name} exceeds 10MB. Skipped.`, type: 'error' });
    }
    setAttachmentFiles((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (!isValid) {
      if (amount <= 0) setToast({ message: 'Enter a valid amount.', type: 'error' });
      else if (amountExceedsDue)
        setToast({
          message: `Amount cannot exceed outstanding (Rs. ${(outstandingAmount || 0).toLocaleString()}).`,
          type: 'error',
        });
      else if (!accountId) setToast({ message: 'Select a payment account.', type: 'error' });
      return;
    }

    const acct = accounts.find((a) => a.id === accountId);
    setSubmitting(true);
    try {
      const result = await onSubmit({
        amount,
        method: paymentMethod,
        accountId,
        accountName: acct?.name ?? '',
        paymentDate,
        reference: reference.trim(),
        notes: notes.trim(),
        attachments: attachmentFiles,
        companyId,
        branchId,
        userId: userId ?? null,
      });

      if (!result.success) {
        setToast({ message: result.error || 'Operation failed.', type: 'error' });
        return;
      }

      const partyAccountName =
        result.partyAccountName ??
        (partyName
          ? mode === 'pay-supplier'
            ? `Payable — ${partyName}`
            : mode === 'pay-worker'
            ? `Worker Payable — ${partyName}`
            : mode === 'receive' || mode === 'rental'
            ? `Receivable — ${partyName}`
            : partyName
          : null);

      setSuccess({
        type: 'payment',
        title: successTitle(mode),
        transactionNo: result.referenceNumber ?? null,
        amount,
        partyName: partyName ?? null,
        date: new Date().toISOString(),
        branch: branchName ?? undefined,
        entityId: result.paymentId ?? null,
        fromAccountName: acct?.name ?? '',
        toAccountName: partyAccountName ?? undefined,
        paymentIdRaw: result.paymentId ?? null,
      });
    } catch (err) {
      const msg = (err as { message?: string })?.message || 'Operation failed.';
      setToast({ message: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const closeSuccess = () => {
    setSuccess(null);
    onSuccess();
    onClose();
  };

  const handleShareReceipt = async () => {
    if (!success) return;
    await preview.openPreview();
  };

  const handleViewLedger = () => {
    if (onViewLedger && success) {
      onViewLedger({ paymentId: success.paymentIdRaw ?? null, partyName: success.partyName ?? null });
    }
    closeSuccess();
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#111827]">
      <div className="flex items-center justify-between p-4 border-b border-[#374151] bg-[#1F2937] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Banknote className="w-6 h-6 text-[#3B82F6] shrink-0" />
          <div className="min-w-0">
            <h1 className="font-semibold text-white text-lg truncate">{resolvedTitle}</h1>
            <p className="text-xs text-[#9CA3AF] truncate">{resolvedSubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#374151] hover:text-white transition-colors shrink-0"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {partyName && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#9CA3AF]">
                {mode === 'expense' ? 'Expense Details' : `${resolvedPartyLabel ? resolvedPartyLabel[0] + resolvedPartyLabel.slice(1).toLowerCase() : 'Party'} Details`}
              </span>
              {resolvedPartyLabel && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#10B981]/20 text-[#10B981]">
                  {resolvedPartyLabel}
                </span>
              )}
            </div>
            <p className="font-semibold text-white text-lg">{partyName}</p>
            {referenceNo && <p className="text-sm text-[#9CA3AF] mt-0.5">Ref: {referenceNo}</p>}
            {!hideSummary && (
              <div className="mt-3 space-y-1 text-sm">
                {totalAmount != null && (
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Total Amount:</span>
                    <span className="text-white">
                      Rs. {totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {alreadyPaid != null && (
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Already Paid:</span>
                    <span className="text-[#10B981]">
                      Rs. {alreadyPaid.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {outstandingAmount != null && (
                  <div className="flex justify-between font-semibold mt-1 pt-2 border-t border-[#374151]">
                    <span className="text-[#9CA3AF]">
                      {mode === 'receive' || mode === 'rental' ? 'Outstanding Amount:' : 'Amount Due:'}
                    </span>
                    <span className="text-[#F59E0B]">
                      Rs. {outstandingAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
            {mode === 'expense' ? 'Amount *' : 'Payment Amount *'}
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              placeholder="Rs. 0.00"
              className="flex-1 min-w-0 h-12 px-4 rounded-lg bg-[#1F2937] border border-[#374151] text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
            />
            {!hidePayFull && dueDisplay > 0 && (
              <button
                type="button"
                onClick={handlePayFull}
                className="shrink-0 px-4 py-2.5 rounded-lg border border-[#3B82F6] text-[#3B82F6] text-sm font-medium hover:bg-[#3B82F6]/10 transition-colors"
              >
                Pay Full
              </button>
            )}
          </div>
          {amountExceedsDue && (
            <p className="mt-2 flex items-center gap-2 text-sm text-[#EF4444]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Amount exceeds outstanding balance.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Payment Method *</label>
          <div className="grid grid-cols-4 gap-2">
            {(['cash', 'bank', 'card', 'wallet'] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`flex items-center justify-center gap-1.5 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  paymentMethod === method
                    ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                    : 'bg-[#1F2937] border-[#374151] text-[#9CA3AF] hover:border-[#4B5563]'
                }`}
              >
                {method === 'cash' && <Banknote className="w-4 h-4" />}
                {method === 'bank' && <Building2 className="w-4 h-4" />}
                {method === 'card' && <CreditCard className="w-4 h-4" />}
                {method === 'wallet' && <Wallet className="w-4 h-4" />}
                {METHOD_LABELS[method]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Select Account *</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full h-12 px-4 rounded-lg bg-[#1F2937] border border-[#374151] text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6] appearance-none pr-10 bg-[length:20px] bg-[right_0.75rem_center] bg-no-repeat"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            }}
          >
            {filteredAccounts.length === 0 && <option value="">No matching accounts</option>}
            {filteredAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} • Balance: Rs. {acc.balance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </option>
            ))}
          </select>
          {amountExceedsBalance && (
            <p className="mt-2 flex items-center gap-2 text-sm text-[#F59E0B]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Warning: Amount exceeds account balance
            </p>
          )}
        </div>

        <div className="border border-[#374151] rounded-xl overflow-hidden bg-[#1F2937]">
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#9CA3AF] hover:bg-[#374151]/50"
          >
            <span>Payment Date, Reference, Notes, Attachments</span>
            {showOptional ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showOptional && (
            <div className="px-4 pb-4 space-y-4 border-t border-[#374151] pt-4">
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-[#111827] border border-[#374151] text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Reference (Optional)</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Cheque no, transaction id..."
                  className="w-full h-11 px-3 rounded-lg bg-[#111827] border border-[#374151] text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add payment notes, remarks, or additional details..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-[#374151] text-white placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Attachments (Optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_TYPES}
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-[#374151] rounded-lg p-4 text-center text-[#6B7280] text-sm hover:border-[#4B5563] hover:bg-[#374151]/30 transition-colors flex flex-col items-center gap-2"
                >
                  <Upload className="w-5 h-5 text-[#9CA3AF]" />
                  <span>Click to upload or drag and drop</span>
                  <span className="text-xs">PDF, PNG, JPG up to 10MB</span>
                </button>
                {attachmentFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {attachmentFiles.map((file, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 py-1.5 px-2 rounded bg-[#111827] border border-[#374151] text-sm text-white"
                      >
                        <FileText className="w-4 h-4 shrink-0 text-[#9CA3AF]" />
                        <span className="truncate flex-1 min-w-0">{file.name}</span>
                        <span className="text-xs text-[#6B7280] shrink-0">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="p-1 rounded text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#374151]"
                          aria-label="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={`fixed left-4 right-4 z-50 py-3 px-4 rounded-lg text-sm font-medium text-center shadow-lg ${
            toast.type === 'success' ? 'bg-[#10B981] text-white' : 'bg-[#EF4444] text-white'
          }`}
          style={{ bottom: '5.5rem' }}
          role="status"
        >
          {toast.message}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#111827] border-t border-[#374151] flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-lg border border-[#374151] text-[#9CA3AF] font-medium hover:bg-[#374151] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isValid || submitting}
          className="flex-1 py-3 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          {submitting ? (
            <span className="animate-pulse">Processing...</span>
          ) : (
            <>
              <Check className="w-5 h-5" />
              {resolvedSubmit}
            </>
          )}
        </button>
      </div>

      {success && (
        <TransactionSuccessModal
          isOpen={!!success}
          data={success}
          onClose={closeSuccess}
          onShareReceipt={handleShareReceipt}
          onViewLedger={onViewLedger ? handleViewLedger : undefined}
          onBack={closeSuccess}
        />
      )}

      {preview.brand && success && (
        <PdfPreviewModal
          open={preview.open}
          title={shareHeading(mode)}
          filename={`Receipt_${success.transactionNo ?? success.paymentIdRaw ?? Date.now()}.pdf`}
          onClose={() => {
            preview.close();
            closeSuccess();
          }}
          whatsAppFallbackText={`${shareHeading(mode)} · Rs. ${(success.amount ?? 0).toLocaleString('en-PK')} — ${success.partyName ?? ''}`}
        >
          <ReceiptPreviewPdf
            brand={preview.brand}
            heading={shareHeading(mode)}
            partyName={success.partyName ?? 'Party'}
            amount={success.amount ?? 0}
            dateTime={success.date ?? new Date().toISOString()}
            fromAccountName={
              mode === 'receive' || mode === 'rental' ? success.toAccountName : success.fromAccountName
            }
            toAccountName={
              mode === 'receive' || mode === 'rental' ? success.fromAccountName : success.toAccountName
            }
            referenceNumber={success.transactionNo ?? null}
            method={METHOD_LABELS[paymentMethod]}
            notes={notes.trim() || null}
            branchName={success.branch ?? null}
            generatedBy="User"
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}
