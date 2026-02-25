import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react';
import type { User } from '../../types';
import { DateInputField } from '../shared/DateTimePicker';
import { getAccounts, createJournalEntry } from '../../api/accounts';
import { addPending } from '../../lib/offlineStore';

interface GeneralEntryFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
}

interface EntryData {
  debitAccountId: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountName: string;
  amount: number;
  date: string;
  description: string;
  reference?: string;
}

export function GeneralEntryFlow({ onBack, onComplete, user, companyId, branchId }: GeneralEntryFlowProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string; balance: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryData, setEntryData] = useState<EntryData>({
    debitAccountId: '',
    debitAccountName: '',
    creditAccountId: '',
    creditAccountName: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
  });

  useEffect(() => {
    if (!companyId) return;
    getAccounts(companyId).then((r) => {
      if (r.data?.length) setAccounts(r.data.map((a) => ({ id: a.id, name: a.name, type: a.type, balance: a.balance })));
    });
  }, [companyId]);

  const handleNextWithReset = () => {
    if (step < 3) {
      setStep(step + 1);
      setSearchQuery('');
    }
  };

  const handlePreviousWithReset = () => {
    if (step > 1) {
      setStep(step - 1);
      setSearchQuery('');
    }
  };

  const handleSubmit = async () => {
    if (!companyId || !entryData.debitAccountId || !entryData.creditAccountId || entryData.amount <= 0 || !entryData.description.trim()) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      companyId,
      branchId: branchId ?? undefined,
      entryDate: entryData.date,
      description: entryData.description.trim(),
      referenceType: 'general',
      lines: [
        { accountId: entryData.debitAccountId, debit: entryData.amount, credit: 0 },
        { accountId: entryData.creditAccountId, debit: 0, credit: entryData.amount },
      ],
      userId: user.id,
    };
    if (!navigator.onLine) {
      const effectiveBranchId = branchId ?? '';
      try {
        await addPending('journal_entry', payload, companyId, effectiveBranchId);
        onComplete();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save offline.');
      }
      setSubmitting(false);
      return;
    }
    const { error: err } = await createJournalEntry(payload);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    onComplete();
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return entryData.debitAccountId !== '';
      case 2:
        return entryData.creditAccountId !== '' && entryData.creditAccountId !== entryData.debitAccountId;
      case 3:
        return entryData.amount > 0 && entryData.description.trim() !== '';
      default:
        return false;
    }
  };

  const filteredAccounts = accounts.filter(
    (a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={step === 1 ? onBack : handlePreviousWithReset} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">General Entry</h1>
            <p className="text-xs text-white/80">Manual journal entry</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>
        <p className="text-xs text-white/80 mt-2">Step {step} of 3</p>
      </div>

      <div className="p-4">
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">Select Debit Account</h2>
              <p className="text-xs text-[#9CA3AF]">Which account should be debited?</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
              />
            </div>
            <div className="space-y-2">
              {filteredAccounts.length > 0 ? (
                filteredAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => setEntryData({ ...entryData, debitAccountId: account.id, debitAccountName: account.name })}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      entryData.debitAccountId === account.id ? 'bg-[#EF4444]/20 border-[#EF4444]' : 'bg-[#1F2937] border-[#374151] hover:border-[#EF4444]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{account.name}</p>
                        <p className="text-xs text-[#9CA3AF]">{account.type}</p>
                        {account.balance > 0 && <p className="text-xs text-[#6B7280] mt-1">Balance: Rs. {account.balance.toLocaleString()}</p>}
                      </div>
                      {entryData.debitAccountId === account.id && <Check className="text-[#EF4444]" size={20} />}
                    </div>
                  </button>
                ))
              ) : (
                <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">No accounts found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">Select Credit Account</h2>
              <p className="text-xs text-[#9CA3AF]">Which account should be credited?</p>
              {entryData.debitAccountName && (
                <div className="mt-3 p-2 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
                  <p className="text-xs text-[#9CA3AF]">Debit Account:</p>
                  <p className="text-sm text-white font-medium">{entryData.debitAccountName}</p>
                </div>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
              />
            </div>
            <div className="space-y-2">
              {filteredAccounts.filter((acc) => acc.id !== entryData.debitAccountId).length > 0 ? (
                filteredAccounts
                  .filter((acc) => acc.id !== entryData.debitAccountId)
                  .map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setEntryData({ ...entryData, creditAccountId: account.id, creditAccountName: account.name })}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        entryData.creditAccountId === account.id ? 'bg-[#10B981]/20 border-[#10B981]' : 'bg-[#1F2937] border-[#374151] hover:border-[#10B981]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{account.name}</p>
                          <p className="text-xs text-[#9CA3AF]">{account.type}</p>
                          {account.balance > 0 && <p className="text-xs text-[#6B7280] mt-1">Balance: Rs. {account.balance.toLocaleString()}</p>}
                        </div>
                        {entryData.creditAccountId === account.id && <Check className="text-[#10B981]" size={20} />}
                      </div>
                    </button>
                  ))
              ) : (
                <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">No accounts found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {error && <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-sm text-[#EF4444]">{error}</div>}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-3">Selected Accounts</h2>
              <div className="space-y-2">
                <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
                  <p className="text-xs text-[#9CA3AF] mb-1">Debit Account</p>
                  <p className="text-sm text-white font-semibold">{entryData.debitAccountName}</p>
                </div>
                <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg">
                  <p className="text-xs text-[#9CA3AF] mb-1">Credit Account</p>
                  <p className="text-sm text-white font-semibold">{entryData.creditAccountName}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Amount (Rs.) *</label>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9.]*"
                min="0"
                step="0.01"
                value={entryData.amount || ''}
                onChange={(e) => setEntryData({ ...entryData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full max-w-full min-w-0 px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-lg font-semibold placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] box-border"
              />
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Description *</label>
              <textarea
                value={entryData.description}
                onChange={(e) => setEntryData({ ...entryData, description: e.target.value })}
                placeholder="Enter entry description..."
                rows={4}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] resize-none"
              />
            </div>

            <DateInputField label="Entry Date" value={entryData.date} onChange={(date) => setEntryData({ ...entryData, date })} pickerLabel="SELECT ENTRY DATE" />

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Reference / Voucher # (Optional)</label>
              <input
                type="text"
                value={entryData.reference}
                onChange={(e) => setEntryData({ ...entryData, reference: e.target.value })}
                placeholder="e.g., Invoice #123, Receipt #456"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#8B5CF6] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">{user.name.split(' ').map((n) => n[0]).join('')}</span>
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Added By</p>
                  <p className="text-sm text-white font-medium">{user.name}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60] fixed-bottom-above-nav">
        <button
          onClick={step === 3 ? handleSubmit : handleNextWithReset}
          disabled={!canProceed() || submitting}
          className={`w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all ${
            step === 3 ? 'bg-gradient-to-r from-[#10B981] to-[#059669]' : 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED]'
          }`}
        >
          {step === 3 ? (
            <>
              <Check size={18} />
              Save Entry
            </>
          ) : (
            <>
              Next
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
