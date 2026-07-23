import { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { CustomSelect } from '../../common';
import type { TransactionDetail } from '../../../api/transactions';
import { getPaymentAccounts } from '../../../api/accounts';
import { supabase } from '../../../lib/supabase';
import { updateTransaction } from '../../../api/transactionEdit';
import { DateTimeInputField } from '../../shared/DateTimePicker';
import { localNowDateTimeString } from '../../../utils/localDate';

interface Props {
  detail: TransactionDetail;
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function toDateTimeLocalValue(datePart: string, eventTimestamp?: string | null): string {
  const date = String(datePart || '').slice(0, 10);
  if (!date) return localNowDateTimeString();
  if (datePart.includes('T')) return datePart.slice(0, 16);
  const ts = eventTimestamp ? new Date(eventTimestamp) : null;
  if (ts && !Number.isNaN(ts.getTime())) {
    const h = String(ts.getHours()).padStart(2, '0');
    const m = String(ts.getMinutes()).padStart(2, '0');
    return `${date}T${h}:${m}`;
  }
  return `${date}T${localNowDateTimeString().slice(11, 16)}`;
}

export function TransactionEditSheet({ detail, companyId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [paymentDate, setPaymentDate] = useState(() =>
    toDateTimeLocalValue(
      detail.paymentDate?.slice(0, 10) || detail.createdAt?.slice(0, 10) || '',
      detail.createdAt,
    ),
  );
  const [amount, setAmount] = useState(detail.amount.toString());
  const [reference, setReference] = useState(detail.referenceNumber || '');
  const [notes, setNotes] = useState(detail.notes || '');
  
  // Accounts for dropdown
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(detail.paymentAccountId || '');

  const isManualJournal = detail.referenceType?.toLowerCase() === 'journal';

  useEffect(() => {
    let cancelled = false;
    getPaymentAccounts(companyId).then(async ({ data }) => {
      if (cancelled) return;
      const list = (data || []).map((a) => ({ id: a.id, name: a.name, type: a.type }));
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
        paymentDate: paymentDate.slice(0, 10),
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
        <div className="sticky top-0 z-10 flow-screen-header bg-[#111827] border-b border-[#1F2937] flex items-center justify-between px-4 py-3">
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

          <DateTimeInputField
            label="Date"
            value={
              paymentDate.includes('T')
                ? paymentDate
                : paymentDate
                  ? `${paymentDate}T${localNowDateTimeString().slice(11, 16)}`
                  : localNowDateTimeString()
            }
            onChange={setPaymentDate}
            disabled={loading}
          />

          {!isManualJournal && (
            <div>
              <CustomSelect
                label="Payment Account"
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                options={[
                  { value: '', label: 'Select Account' },
                  ...accounts.map((acc) => ({ value: acc.id, label: acc.name, subtitle: acc.type })),
                ]}
                disabled={loading}
                zIndexClass="z-[100]"
              />
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
