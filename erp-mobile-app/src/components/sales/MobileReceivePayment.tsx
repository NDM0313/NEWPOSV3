import { useState, useEffect, useRef } from 'react';
import { X, Check, Wallet, Building2, Banknote, ChevronDown, ChevronUp, AlertTriangle, Upload, FileText } from 'lucide-react';
import { getPaymentAccounts } from '../../api/accounts';
import { useRecordCustomerPayment } from '../../hooks/useRecordCustomerPayment';
import { uploadPaymentAttachments, updatePaymentAttachments, MAX_FILE_SIZE_BYTES, ACCEPT_TYPES } from '../../api/paymentAttachments';

export interface MobileReceivePaymentProps {
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  branchId: string | null;
  userId?: string | null;
  /** Sale (invoice) id */
  referenceId: string;
  referenceNo: string;
  customerName: string;
  customerId: string | null;
  totalAmount: number;
  alreadyPaid: number;
  outstandingAmount: number;
}

type PaymentMethod = 'cash' | 'bank' | 'wallet';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank: 'Bank',
  wallet: 'Wallet',
};

export function MobileReceivePayment({
  onClose,
  onSuccess,
  companyId,
  userId,
  referenceId,
  referenceNo,
  customerName,
  customerId,
  totalAmount,
  alreadyPaid,
  outstandingAmount,
}: MobileReceivePaymentProps) {
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [accountId, setAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string; balance: number }>>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { submit, isSubmitting } = useRecordCustomerPayment();

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
    const methodType = paymentMethod === 'cash' ? 'cash' : paymentMethod === 'bank' ? 'bank' : null;
    const filtered = methodType
      ? accounts.filter((a) => a.type === methodType)
      : accounts.filter((a) => a.type === 'mobile_wallet' || a.type === 'asset');
    const first = filtered[0];
    if (first && (!accountId || !filtered.some((a) => a.id === accountId))) {
      setAccountId(first.id);
    }
  }, [accounts, paymentMethod]);

  const filteredAccounts = accounts.filter((a) => {
    if (paymentMethod === 'cash') return a.type === 'cash';
    if (paymentMethod === 'bank') return a.type === 'bank';
    return a.type === 'mobile_wallet' || a.type === 'asset';
  });

  useEffect(() => {
    const first = filteredAccounts[0];
    if (first && !filteredAccounts.some((a) => a.id === accountId)) {
      setAccountId(first.id);
    }
  }, [filteredAccounts, accountId]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const amountExceedsBalance = selectedAccount && amount > selectedAccount.balance && selectedAccount.balance >= 0;

  const isValid =
    amount > 0 &&
    amount <= outstandingAmount &&
    !!accountId &&
    filteredAccounts.some((a) => a.id === accountId);

  const handlePayFull = () => setAmount(outstandingAmount);

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

  const handleReceivePayment = async () => {
    if (!isValid) {
      if (amount <= 0) setToast({ message: 'Enter a valid amount.', type: 'error' });
      else if (amount > outstandingAmount) setToast({ message: `Amount cannot exceed outstanding (Rs. ${outstandingAmount.toLocaleString()}).`, type: 'error' });
      else if (!accountId) setToast({ message: 'Select a payment account.', type: 'error' });
      return;
    }
    const methodStr = paymentMethod === 'wallet' ? 'wallet' : paymentMethod;
    const { success, error, paymentId } = await submit({
      companyId,
      customerId,
      referenceId,
      amount,
      accountId,
      paymentMethod: methodStr,
      paymentDate,
      notes: notes.trim() || null,
      createdBy: userId ?? null,
    });
    if (success && paymentId && attachmentFiles.length > 0) {
      try {
        const uploaded = await uploadPaymentAttachments(companyId, referenceId, paymentId, attachmentFiles);
        if (uploaded.length > 0) {
          const updateErr = await updatePaymentAttachments(paymentId, uploaded);
          if (updateErr.error) setToast({ message: 'Payment saved but attachments could not be linked.', type: 'error' });
        }
        if (uploaded.length < attachmentFiles.length) {
          setToast({ message: `Payment saved. ${uploaded.length}/${attachmentFiles.length} file(s) uploaded.`, type: 'error' });
        }
      } catch (_e) {
        setToast({ message: 'Payment saved but attachment upload failed.', type: 'error' });
      }
    }
    if (success) {
      setToast({ message: 'Payment received successfully.', type: 'success' });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } else {
      setToast({ message: error || 'Payment failed.', type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#111827]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#374151] bg-[#1F2937] shrink-0">
        <div className="flex items-center gap-2">
          <Banknote className="w-6 h-6 text-[#3B82F6]" />
          <div>
            <h1 className="font-semibold text-white text-lg">Receive Payment from Customer</h1>
            <p className="text-xs text-[#9CA3AF]">Complete transaction details</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#374151] hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {/* Customer summary card */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#9CA3AF]">Customer Details</span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#10B981]/20 text-[#10B981]">CUSTOMER</span>
          </div>
          <p className="font-semibold text-white text-lg">{customerName}</p>
          <p className="text-sm text-[#9CA3AF] mt-0.5">Ref: {referenceNo}</p>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Total Amount:</span>
              <span className="text-white">Rs. {totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Already Paid:</span>
              <span className="text-[#10B981]">Rs. {alreadyPaid.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-semibold mt-1 pt-2 border-t border-[#374151]">
              <span className="text-[#9CA3AF]">Outstanding Amount:</span>
              <span className="text-[#F59E0B]">Rs. {outstandingAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Payment amount - standard mobile keyboard */}
        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Payment Amount *</label>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={outstandingAmount}
              step={0.01}
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              placeholder="Rs. 0.00"
              className="flex-1 min-w-0 h-12 px-4 rounded-lg bg-[#1F2937] border border-[#374151] text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6]"
            />
            <button
              type="button"
              onClick={handlePayFull}
              className="shrink-0 px-4 py-2.5 rounded-lg border border-[#3B82F6] text-[#3B82F6] text-sm font-medium hover:bg-[#3B82F6]/10 transition-colors"
            >
              Pay Full
            </button>
          </div>
        </div>

        {/* Payment method segmented */}
        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Payment Method *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'bank', 'wallet'] as const).map((method) => (
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
                {method === 'wallet' && <Wallet className="w-4 h-4" />}
                {METHOD_LABELS[method]}
              </button>
            ))}
          </div>
        </div>

        {/* Account dropdown */}
        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Select Account *</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full h-12 px-4 rounded-lg bg-[#1F2937] border border-[#374151] text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6] appearance-none pr-10 bg-[length:20px] bg-[right_0.75rem_center] bg-no-repeat"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
          >
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

        {/* Optional sections (collapsible) */}
        <div className="border border-[#374151] rounded-xl overflow-hidden bg-[#1F2937]">
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#9CA3AF] hover:bg-[#374151]/50"
          >
            <span>Payment Date, Notes</span>
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
                      <li key={idx} className="flex items-center gap-2 py-1.5 px-2 rounded bg-[#111827] border border-[#374151] text-sm text-white">
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

      {/* Toast */}
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

      {/* Sticky bottom actions */}
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
          onClick={handleReceivePayment}
          disabled={!isValid || isSubmitting}
          className="flex-1 py-3 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          {isSubmitting ? (
            <span className="animate-pulse">Processing...</span>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Receive Payment
            </>
          )}
        </button>
      </div>
    </div>
  );
}
