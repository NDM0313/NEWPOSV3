import { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import type { TransactionDetail } from '../../../api/transactions';
import { supabase } from '../../../lib/supabase';
import { updateTransaction } from '../../../api/transactionEdit';

interface Props {
  detail: TransactionDetail;
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransactionEditSheet({ detail, companyId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [paymentDate, setPaymentDate] = useState(detail.paymentDate?.slice(0, 10) || detail.createdAt?.slice(0, 10) || '');
  const [amount, setAmount] = useState(detail.amount.toString());
  const [reference, setReference] = useState(detail.referenceNumber || '');
  const [notes, setNotes] = useState(detail.notes || '');
  
  // Accounts for dropdown
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(detail.paymentAccountId || '');

  const isManualJournal = detail.referenceType?.toLowerCase() === 'journal';

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('accounts')
      .select('id, name, type')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .in('type', ['cash', 'bank', 'mobile_wallet'])
      .order('name')
      .then(async ({ data }) => {
        if (cancelled) return;
        const list = data || [];
        // Always include the currently saved account even if its type is outside the filter
        const savedId = detail.paymentAccountId || '';
        if (savedId && !list.some((a) => a.id === savedId)) {
          const { data: savedAcc } = await supabase
            .from('accounts')
            .select('id, name, type')
            .eq('id', savedId)
            .maybeSingle();
          if (savedAcc && !cancelled) {
            list.unshift(savedAcc as { id: string; name: string; type: string });
          }
        }
        if (!cancelled) setAccounts(list.sort((a, b) => a.name.localeCompare(b.name)));
      });
    return () => { cancelled = true; };
  }, [companyId, detail.paymentAccountId]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Please enter a valid amount greater than zero.');
      }

      await updateTransaction(companyId, detail, {
        paymentDate,
        amount: numAmount,
        reference,
        notes,
        paymentAccountId: selectedAccountId,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating the transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full md:w-[28rem] bg-[#111827] rounded-t-2xl md:rounded-2xl border border-[#374151] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-semibold text-white">Edit Transaction</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#1F2937] rounded-lg text-[#9CA3AF]" disabled={loading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-sm text-[#EF4444]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6366F1]"
              disabled={loading}
            />
          </div>

          {!isManualJournal && (
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Payment Account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6366F1]"
                disabled={loading}
              >
                <option value="">Select Account</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6366F1]"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Reference Number</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6366F1]"
              disabled={loading}
              placeholder="e.g. Check No, Receipt No"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Notes / Description</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6366F1]"
              disabled={loading}
              placeholder="Additional details..."
            />
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 rounded-lg text-white font-semibold text-sm mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
