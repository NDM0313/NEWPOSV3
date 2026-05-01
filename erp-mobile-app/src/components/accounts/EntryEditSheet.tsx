import { useState, useEffect, useLayoutEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { updateTransaction } from '../../api/transactionEdit';
import { allowsDayBookUnifiedEdit } from '../../lib/journalEntryEditPolicy';
import type { AccountEntry } from './AccountsDashboard';

interface Props {
  entry: AccountEntry;
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EntryEditSheet({ entry, companyId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — all start empty, filled once data is loaded
  const [paymentDate, setPaymentDate] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Loaded data
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>([]);
  const [journalLines, setJournalLines] = useState<any[]>([]);
  const [direction, setDirection] = useState<'received' | 'paid'>('paid');
  const [resolvedPaymentId, setResolvedPaymentId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const refType = (entry.referenceType || 'journal').toLowerCase();
  const isManualJournal = refType === 'journal';

  const policyAllowsEdit = allowsDayBookUnifiedEdit(
    entry.referenceType,
    entry.paymentId ?? null,
  );

  useLayoutEffect(() => {
    if (!policyAllowsEdit) {
      onClose();
    }
  }, [policyAllowsEdit, onClose]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      if (!policyAllowsEdit) {
        setLoading(false);
        return;
      }
      setLoading(true);

      // 1) Load liquidity accounts (cash, bank, mobile_wallet) in parallel with other data
      const accountsPromise = supabase
        .from('accounts')
        .select('id, name, type')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .in('type', ['cash', 'bank', 'mobile_wallet'])
        .order('name');

      // 2) Load journal lines
      const jLinesPromise = supabase
        .from('journal_entry_lines')
        .select('account_id, debit, credit')
        .eq('journal_entry_id', entry.id);

      // 3) Resolve reference_id if not already provided
      let currentRefId = entry.referenceId;
      if (!isManualJournal && !currentRefId) {
        const { data: jeRow } = await supabase
          .from('journal_entries')
          .select('reference_id')
          .eq('id', entry.id)
          .maybeSingle();
        if (jeRow?.reference_id) {
          currentRefId = jeRow.reference_id;
        }
      }

      // Run accounts + journal lines fetch in parallel
      const [accRes, jLinesRes] = await Promise.all([accountsPromise, jLinesPromise]);

      if (cancelled) return;

      if (accRes.data) {
        setAccounts(accRes.data);
      }
      if (jLinesRes.data) {
        setJournalLines(jLinesRes.data);
      }

      // 4) Set default form values
      setPaymentDate(entry.date?.slice(0, 10) || '');
      setAmount(entry.amount.toString());
      setNotes(entry.description || '');

      let paymentAccountResolved = false;

      // 5) If linked to a payment, load it and pre-fill account/reference/notes
      if (!isManualJournal && currentRefId) {
        const { data: pRow } = await supabase
          .from('payments')
          .select('id, payment_account_id, reference_number, notes, direction, payment_date')
          .eq('id', currentRefId)
          .maybeSingle();

        if (cancelled) return;
        if (pRow) {
          setResolvedPaymentId(pRow.id);
          setReference(pRow.reference_number || '');
          setNotes(pRow.notes || entry.description || '');
          setDirection(pRow.direction === 'in' ? 'received' : 'paid');
          if (pRow.payment_date) {
            setPaymentDate(String(pRow.payment_date).slice(0, 10));
          }

          // ── KEY FIX: always pre-select the saved account ──
          // Even if it's not in the cash/bank/mobile_wallet filter list,
          // we must show it selected (same as web's getAccountsForPaymentSelect).
          const savedAccId = pRow.payment_account_id || '';
          if (savedAccId) {
            paymentAccountResolved = true;
            setSelectedAccountId(savedAccId);

            // Check if saved account exists in already-fetched list
            const alreadyInList = (accRes.data || []).some((a: any) => a.id === savedAccId);
            if (!alreadyInList) {
              // Fetch the saved account separately and prepend it to the list
              const { data: savedAcc } = await supabase
                .from('accounts')
                .select('id, name, type')
                .eq('id', savedAccId)
                .maybeSingle();
              if (savedAcc && !cancelled) {
                setAccounts((prev) => {
                  const alreadyThere = prev.some((a) => a.id === savedAcc.id);
                  return alreadyThere ? prev : [savedAcc, ...prev];
                });
              }
            }
          }
        }
      }

      // 6) JE linked to purchase/sale/etc.: reference_id may not be payments.id — infer cash/bank line from journal.
      if (!isManualJournal && !paymentAccountResolved && jLinesRes.data?.length) {
        const lineRows = jLinesRes.data as { account_id: string; debit: number; credit: number }[];
        const ids = [...new Set(lineRows.map((l) => l.account_id).filter(Boolean))];
        const { data: liqAccs } = await supabase
          .from('accounts')
          .select('id, name, type')
          .eq('company_id', companyId)
          .in('id', ids)
          .in('type', ['cash', 'bank', 'mobile_wallet']);
        if (!cancelled && liqAccs?.length) {
          const lid = new Set(liqAccs.map((a) => a.id));
          const creditLiquidity = lineRows.find((l) => lid.has(l.account_id) && Number(l.credit) > 0);
          const debitLiquidity = lineRows.find((l) => lid.has(l.account_id) && Number(l.debit) > 0);
          const chosen =
            creditLiquidity?.account_id ||
            debitLiquidity?.account_id ||
            liqAccs[0].id;
          setSelectedAccountId(chosen);
          setAccounts((prev) => {
            const missing = liqAccs.filter((a) => !prev.some((p) => p.id === a.id));
            return missing.length ? [...missing, ...prev] : prev;
          });
        }
      }

      setLoading(false);
      setIsReady(true);
    }

    loadAll();
    return () => { cancelled = true; };
  }, [entry.id, companyId, policyAllowsEdit]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Please enter a valid amount greater than zero.');
      }

      // If we found a real payment ID, treat as payment edit.
      // Otherwise fall back to journal-only edit so we don't send a wrong ID to payments table.
      const hasRealPayment = !!resolvedPaymentId;
      const effectiveRefType = hasRealPayment ? refType : 'journal';

      const syntheticDetail: any = {
        id: entry.id,
        journalEntryId: entry.id,
        paymentId: resolvedPaymentId ?? entry.id,
        referenceType: effectiveRefType,
        amount: entry.amount,
        direction,
        referenceNumber: reference,
        journalLines: journalLines.map(l => ({
          accountId: l.account_id,
          debit: Number(l.debit),
          credit: Number(l.credit),
        })),
        createdAt: entry.createdAt,
      };

      await updateTransaction(companyId, syntheticDetail, {
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
      setSaving(false);
    }
  };

  if (!policyAllowsEdit) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full md:w-[28rem] bg-[#111827] rounded-t-2xl md:rounded-2xl border border-[#374151] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-semibold text-white">Edit Entry</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#1F2937] rounded-lg text-[#9CA3AF]" disabled={saving}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#9CA3AF]">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
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
                disabled={saving}
              />
            </div>

            {!isManualJournal && (
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Payment Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6366F1]"
                  disabled={saving}
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
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">Reference Number</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6366F1]"
                disabled={saving}
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
                disabled={saving}
                placeholder="Additional details..."
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !isReady}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 rounded-lg text-white font-semibold text-sm mt-4"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
