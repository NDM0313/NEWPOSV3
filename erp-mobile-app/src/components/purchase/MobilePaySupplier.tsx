import { useState, useEffect, useRef } from 'react';
import { X, Banknote, Building2, Wallet, Upload, FileText } from 'lucide-react';
import { getPaymentAccounts, recordSupplierPayment } from '../../api/accounts';
import { uploadPaymentAttachments, updatePaymentAttachments, MAX_FILE_SIZE_BYTES, ACCEPT_TYPES } from '../../api/paymentAttachments';

export interface MobilePaySupplierProps {
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  branchId: string;
  userId?: string | null;
  purchaseId: string;
  poNo: string;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
}

type PaymentMethod = 'cash' | 'bank' | 'wallet';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank: 'Bank',
  wallet: 'Wallet',
};

export function MobilePaySupplier({
  onClose,
  onSuccess,
  companyId,
  branchId,
  userId,
  purchaseId,
  poNo,
  supplierName,
  totalAmount,
  paidAmount,
  dueAmount,
}: MobilePaySupplierProps) {
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [accountId, setAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!companyId) return;
    getPaymentAccounts(companyId).then(({ data }) => {
      setAccounts((data || []).map((a) => ({ id: a.id, name: a.name, type: a.type })));
    });
  }, [companyId]);

  const filteredAccounts = accounts.filter((a) => {
    const t = (a.type || '').toLowerCase();
    if (paymentMethod === 'cash') return t === 'cash';
    if (paymentMethod === 'bank') return t === 'bank';
    return t === 'mobile_wallet' || t === 'asset';
  });

  useEffect(() => {
    const first = filteredAccounts[0];
    if (first && (!accountId || !filteredAccounts.some((a) => a.id === accountId))) {
      setAccountId(first.id);
    }
  }, [filteredAccounts, paymentMethod]);

  const isValid = amount > 0 && amount <= dueAmount && !!accountId && filteredAccounts.some((a) => a.id === accountId);

  const handlePayFull = () => setAmount(dueAmount);

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

  const handleSubmit = async () => {
    if (!isValid) {
      if (amount <= 0) setToast({ message: 'Enter a valid amount.', type: 'error' });
      else if (amount > dueAmount) setToast({ message: `Amount cannot exceed due (Rs. ${dueAmount.toLocaleString()}).`, type: 'error' });
      else setToast({ message: 'Select a payment account.', type: 'error' });
      return;
    }
    setIsSubmitting(true);
    const { data, error } = await recordSupplierPayment({
      companyId,
      branchId,
      purchaseId,
      amount,
      paymentDate,
      paymentAccountId: accountId,
      paymentMethod: paymentMethod === 'wallet' ? 'other' : paymentMethod,
      userId: userId ?? undefined,
      notes: notes.trim() || undefined,
    });
    if (data?.payment_id && attachmentFiles.length > 0) {
      try {
        const uploaded = await uploadPaymentAttachments(companyId, purchaseId, data.payment_id, attachmentFiles);
        if (uploaded.length > 0) {
          const updateErr = await updatePaymentAttachments(data.payment_id, uploaded);
          if (updateErr.error) setToast({ message: 'Payment saved but attachments could not be linked.', type: 'error' });
        }
        if (uploaded.length < attachmentFiles.length) {
          setToast({ message: `Payment saved. ${uploaded.length}/${attachmentFiles.length} file(s) uploaded.`, type: 'error' });
        }
      } catch (_e) {
        setToast({ message: 'Payment saved but attachment upload failed.', type: 'error' });
      }
    }
    setIsSubmitting(false);
    if (data) {
      setToast({ message: 'Payment recorded.', type: 'success' });
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
      <div className="flex items-center justify-between p-4 border-b border-[#374151] bg-[#1F2937] shrink-0">
        <div className="flex items-center gap-2">
          <Banknote className="w-6 h-6 text-[#10B981]" />
          <div>
            <h1 className="font-semibold text-white text-lg">Pay Supplier</h1>
            <p className="text-xs text-[#9CA3AF]">Record payment against purchase</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#374151] hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <p className="font-semibold text-white text-lg">{supplierName}</p>
          <p className="text-sm text-[#9CA3AF] mt-0.5">PO: {poNo}</p>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Total:</span>
              <span className="text-white">Rs. {totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Paid:</span>
              <span className="text-[#10B981]">Rs. {paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold mt-1 pt-2 border-t border-[#374151]">
              <span className="text-[#9CA3AF]">Due:</span>
              <span className="text-[#F59E0B]">Rs. {dueAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Amount (Rs.)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={dueAmount}
              step={1}
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              placeholder="0"
              className="flex-1 bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-[#10B981]"
            />
            <button
              type="button"
              onClick={handlePayFull}
              className="px-3 py-2 rounded-lg bg-[#10B981]/20 text-[#10B981] text-sm font-medium"
            >
              Full
            </button>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Payment Method *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'bank', 'wallet'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`flex items-center justify-center gap-1.5 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  paymentMethod === m
                    ? 'bg-[#10B981] border-[#10B981] text-white'
                    : 'bg-[#1F2937] border-[#374151] text-[#9CA3AF] hover:border-[#4B5563]'
                }`}
              >
                {m === 'cash' && <Banknote className="w-4 h-4" />}
                {m === 'bank' && <Building2 className="w-4 h-4" />}
                {m === 'wallet' && <Wallet className="w-4 h-4" />}
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Account</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-white"
          >
            {filteredAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Date</label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-white"
          />
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            rows={2}
            className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-white placeholder-[#6B7280]"
          />
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Attachments (optional)</label>
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

        {toast && (
          <div className={`fixed bottom-24 left-4 right-4 py-3 px-4 rounded-lg text-center text-sm font-medium z-10 ${toast.type === 'success' ? 'bg-[#10B981] text-white' : 'bg-[#EF4444] text-white'}`}>
            {toast.message}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#111827] border-t border-[#374151]">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className="w-full py-3.5 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2"
        >
          {isSubmitting ? 'Saving...' : `Pay Rs. ${amount.toLocaleString()}`}
        </button>
      </div>
    </div>
  );
}
