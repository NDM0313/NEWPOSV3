import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { getAccounts, getJournalEntryForEdit, updateJournalEntryInPlace, type JournalEntryEditRow } from '../../../../api/accounts';
import {
  getTransactionDetail,
  updatePaymentTransactionInPlace,
  canEditTransaction,
  type TransactionDetail,
} from '../../../../api/transactions';
import { getPaymentAccounts } from '../../../../api/accounts';

interface EditTransactionSheetProps {
  open: boolean;
  companyId: string;
  mode: 'payment' | 'journal';
  targetId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditTransactionSheet({ open, companyId, mode, targetId, onClose, onSaved }: EditTransactionSheetProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<TransactionDetail | null>(null);
  const [journalDetail, setJournalDetail] = useState<JournalEntryEditRow | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    date: '',
    amount: '',
    description: '',
    paymentMethod: 'cash',
    paymentAccountId: '',
    referenceNumber: '',
    debitAccountId: '',
    creditAccountId: '',
    notes: '',
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getAccounts(companyId), getPaymentAccounts(companyId)])
      .then(async ([accRes, payRes]) => {
        if (cancelled) return;
        setAccounts((accRes.data || []).map((a) => ({ id: a.id, name: a.name })));
        setPaymentAccounts((payRes.data || []).map((a) => ({ id: a.id, name: a.name })));
        if (mode === 'payment') {
          const res = await getTransactionDetail(companyId, targetId);
          if (cancelled) return;
          if (res.error || !res.data) {
            setError(res.error || 'Transaction not found.');
            return;
          }
          const lockCheck = canEditTransaction(res.data.referenceType, 'payment_row');
          if (!lockCheck.editable) {
            setError(lockCheck.reason || 'This transaction is locked.');
            return;
          }
          setPaymentDetail(res.data);
          setForm({
            date: res.data.paymentDate ? String(res.data.paymentDate).slice(0, 10) : '',
            amount: String(res.data.amount || ''),
            description: '',
            paymentMethod: res.data.method || 'cash',
            paymentAccountId: res.data.paymentAccountId || '',
            referenceNumber: res.data.referenceNumber || '',
            debitAccountId: '',
            creditAccountId: '',
            notes: res.data.notes || '',
          });
        } else {
          const res = await getJournalEntryForEdit(companyId, targetId);
          if (cancelled) return;
          if (res.error || !res.data) {
            setError(res.error || 'Journal entry not found.');
            return;
          }
          const lockCheck = canEditTransaction(res.data.referenceType, 'journal_entry');
          if (!lockCheck.editable) {
            setError(lockCheck.reason || 'This transaction is locked.');
            return;
          }
          setJournalDetail(res.data);
          setForm({
            date: res.data.entryDate || '',
            amount: String(res.data.amount || ''),
            description: res.data.description || '',
            paymentMethod: 'cash',
            paymentAccountId: '',
            referenceNumber: '',
            debitAccountId: res.data.debitAccountId || '',
            creditAccountId: res.data.creditAccountId || '',
            notes: '',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, mode, open, targetId]);

  const canSave = useMemo(() => {
    const amount = Number(form.amount || 0);
    if (amount <= 0 || !form.date) return false;
    if (mode === 'payment') return !!form.paymentAccountId;
    return !!form.debitAccountId && !!form.creditAccountId && form.debitAccountId !== form.creditAccountId;
  }, [form.amount, form.date, form.paymentAccountId, form.debitAccountId, form.creditAccountId, mode]);

  const onSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === 'payment' && paymentDetail) {
        const res = await updatePaymentTransactionInPlace({
          companyId,
          paymentId: paymentDetail.paymentId,
          amount: Number(form.amount || 0),
          paymentDate: form.date,
          paymentAccountId: form.paymentAccountId,
          paymentMethod: form.paymentMethod,
          referenceNumber: form.referenceNumber || null,
          notes: form.notes || null,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      }
      if (mode === 'journal' && journalDetail) {
        const res = await updateJournalEntryInPlace({
          companyId,
          journalEntryId: journalDetail.id,
          entryDate: form.date,
          description: form.description || journalDetail.description || 'Entry update',
          debitAccountId: form.debitAccountId,
          creditAccountId: form.creditAccountId,
          amount: Number(form.amount || 0),
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-[#1F2937] sm:rounded-xl rounded-t-2xl border border-[#374151] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151]">
          <h3 className="text-sm font-semibold text-white">Edit Transaction</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[#374151] text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="py-8 flex items-center justify-center text-[#9CA3AF]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          {error && !loading && <div className="p-3 rounded-lg bg-[#EF4444]/20 border border-[#EF4444] text-[#FCA5A5] text-sm">{error}</div>}
          {!loading && !error && (
            <>
              <label className="block text-xs text-[#9CA3AF]">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
                className="w-full h-10 rounded bg-[#111827] border border-[#374151] text-white px-3 text-sm"
              />
              <label className="block text-xs text-[#9CA3AF]">Amount</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={form.amount}
                onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                className="w-full h-10 rounded bg-[#111827] border border-[#374151] text-white px-3 text-sm"
              />

              {mode === 'payment' && (
                <>
                  <label className="block text-xs text-[#9CA3AF]">Payment Account</label>
                  <select
                    value={form.paymentAccountId}
                    onChange={(e) => setForm((s) => ({ ...s, paymentAccountId: e.target.value }))}
                    className="w-full h-10 rounded bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                  >
                    <option value="">Select account</option>
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <label className="block text-xs text-[#9CA3AF]">Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm((s) => ({ ...s, paymentMethod: e.target.value }))}
                    className="w-full h-10 rounded bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                  <label className="block text-xs text-[#9CA3AF]">Reference #</label>
                  <input
                    type="text"
                    value={form.referenceNumber}
                    onChange={(e) => setForm((s) => ({ ...s, referenceNumber: e.target.value }))}
                    className="w-full h-10 rounded bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                  />
                  <label className="block text-xs text-[#9CA3AF]">Notes</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                    className="w-full rounded bg-[#111827] border border-[#374151] text-white px-3 py-2 text-sm"
                  />
                </>
              )}

              {mode === 'journal' && (
                <>
                  <label className="block text-xs text-[#9CA3AF]">Debit Account</label>
                  <select
                    value={form.debitAccountId}
                    onChange={(e) => setForm((s) => ({ ...s, debitAccountId: e.target.value }))}
                    className="w-full h-10 rounded bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                  >
                    <option value="">Select debit account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <label className="block text-xs text-[#9CA3AF]">Credit Account</label>
                  <select
                    value={form.creditAccountId}
                    onChange={(e) => setForm((s) => ({ ...s, creditAccountId: e.target.value }))}
                    className="w-full h-10 rounded bg-[#111827] border border-[#374151] text-white px-3 text-sm"
                  >
                    <option value="">Select credit account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <label className="block text-xs text-[#9CA3AF]">Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                    className="w-full rounded bg-[#111827] border border-[#374151] text-white px-3 py-2 text-sm"
                  />
                </>
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t border-[#374151]">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSave || saving || loading}
            className="w-full h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 text-white font-medium"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
