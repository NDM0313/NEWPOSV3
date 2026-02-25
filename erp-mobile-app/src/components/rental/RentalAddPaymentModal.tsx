import { useState } from 'react';
import { X } from 'lucide-react';

interface RentalAddPaymentModalProps {
  dueAmount: number;
  onClose: () => void;
  onConfirm: (amount: number, method: string, reference?: string) => void;
  loading: boolean;
}

export function RentalAddPaymentModal({ dueAmount, onClose, onConfirm, loading }: RentalAddPaymentModalProps) {
  const [amount, setAmount] = useState(dueAmount > 0 ? String(dueAmount) : '');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');

  const handleSubmit = () => {
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      alert('Enter a valid amount.');
      return;
    }
    onConfirm(num, method, reference.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-[#1F2937] rounded-t-2xl sm:rounded-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#374151]">
          <h2 className="text-lg font-semibold text-white">Add Payment</h2>
          <button onClick={onClose} className="p-2 text-[#9CA3AF] hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-[#9CA3AF]">Due: Rs. {dueAmount.toLocaleString()}</p>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-1">Amount (Rs.)</label>
            <input
              type="number"
              inputMode="decimal"
              pattern="[0-9.]*"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full max-w-full min-w-0 h-12 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white text-lg box-border"
            />
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-1">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full max-w-full min-w-0 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white box-border"
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-1">Reference (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cheque no, transaction id…"
              className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-white placeholder-[#6B7280]"
            />
          </div>
        </div>
        <div className="p-4 border-t border-[#374151] flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-[#374151] text-[#9CA3AF] rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {loading ? 'Saving…' : 'Add Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
