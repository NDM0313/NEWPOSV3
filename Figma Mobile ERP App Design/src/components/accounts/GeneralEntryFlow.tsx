import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react';
import { User } from '../../App';
import { DateInputField } from '../shared/DateTimePicker';

interface GeneralEntryFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
}

interface EntryData {
  debitAccount: string;
  creditAccount: string;
  amount: number;
  date: string;
  description: string;
  reference?: string;
}

export function GeneralEntryFlow({ onBack, onComplete, user }: GeneralEntryFlowProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [entryData, setEntryData] = useState<EntryData>({
    debitAccount: '',
    creditAccount: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
  });

  // Mock accounts - In real app, fetch from backend
  const accounts = [
    { id: '1', name: 'Cash Account', type: 'Asset', balance: 450000 },
    { id: '2', name: 'Bank Account - HBL', type: 'Asset', balance: 850000 },
    { id: '3', name: 'Bank Account - MCB', type: 'Asset', balance: 400000 },
    { id: '4', name: 'Accounts Receivable', type: 'Asset', balance: 250000 },
    { id: '5', name: 'Inventory', type: 'Asset', balance: 500000 },
    { id: '6', name: 'Accounts Payable', type: 'Liability', balance: 180000 },
    { id: '7', name: 'Rent Expense', type: 'Expense', balance: 0 },
    { id: '8', name: 'Salary Expense', type: 'Expense', balance: 0 },
    { id: '9', name: 'Utility Expense', type: 'Expense', balance: 0 },
    { id: '10', name: 'Sales Revenue', type: 'Revenue', balance: 0 },
    { id: '11', name: 'Service Revenue', type: 'Revenue', balance: 0 },
    { id: '12', name: 'Owner Equity', type: 'Equity', balance: 0 },
  ];

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    // In real app, submit to backend
    console.log('General Entry:', {
      ...entryData,
      addedBy: user.name,
      addedByRole: user.role,
      createdAt: new Date().toISOString(),
    });
    onComplete();
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return entryData.debitAccount !== '';
      case 2:
        return entryData.creditAccount !== '' && entryData.creditAccount !== entryData.debitAccount;
      case 3:
        return entryData.amount > 0 && entryData.description.trim() !== '';
      default:
        return false;
    }
  };

  // Filter accounts based on search
  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset search when changing steps
  const handleStepChange = (newStep: number) => {
    setStep(newStep);
    setSearchQuery('');
  };

  const handleNextWithReset = () => {
    if (step < 3) handleStepChange(step + 1);
  };

  const handlePreviousWithReset = () => {
    if (step > 1) handleStepChange(step - 1);
  };

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={step === 1 ? onBack : handlePreviousWithReset}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">General Entry</h1>
            <p className="text-xs text-white/80">Manual journal entry</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${
                s <= step ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-white/80 mt-2">Step {step} of 3</p>
      </div>

      <div className="p-4">
        {/* Step 1: Select Debit Account */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">Select Debit Account</h2>
              <p className="text-xs text-[#9CA3AF]">Which account should be debited?</p>
            </div>

            {/* Search Bar */}
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
                    onClick={() => setEntryData({ ...entryData, debitAccount: account.name })}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      entryData.debitAccount === account.name
                        ? 'bg-[#EF4444]/20 border-[#EF4444]'
                        : 'bg-[#1F2937] border-[#374151] hover:border-[#EF4444]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{account.name}</p>
                        <p className="text-xs text-[#9CA3AF]">{account.type}</p>
                        {account.balance > 0 && (
                          <p className="text-xs text-[#6B7280] mt-1">Balance: Rs. {account.balance.toLocaleString()}</p>
                        )}
                      </div>
                      {entryData.debitAccount === account.name && (
                        <Check className="text-[#EF4444]" size={20} />
                      )}
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

        {/* Step 2: Select Credit Account */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">Select Credit Account</h2>
              <p className="text-xs text-[#9CA3AF]">Which account should be credited?</p>
              {entryData.debitAccount && (
                <div className="mt-3 p-2 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
                  <p className="text-xs text-[#9CA3AF]">Debit Account:</p>
                  <p className="text-sm text-white font-medium">{entryData.debitAccount}</p>
                </div>
              )}
            </div>

            {/* Search Bar */}
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
              {filteredAccounts.filter(acc => acc.name !== entryData.debitAccount).length > 0 ? (
                filteredAccounts
                  .filter(acc => acc.name !== entryData.debitAccount)
                  .map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setEntryData({ ...entryData, creditAccount: account.name })}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        entryData.creditAccount === account.name
                          ? 'bg-[#10B981]/20 border-[#10B981]'
                          : 'bg-[#1F2937] border-[#374151] hover:border-[#10B981]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{account.name}</p>
                          <p className="text-xs text-[#9CA3AF]">{account.type}</p>
                          {account.balance > 0 && (
                            <p className="text-xs text-[#6B7280] mt-1">Balance: Rs. {account.balance.toLocaleString()}</p>
                          )}
                        </div>
                        {entryData.creditAccount === account.name && (
                          <Check className="text-[#10B981]" size={20} />
                        )}
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

        {/* Step 3: Amount & Description */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Selected Accounts Summary */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-3">Selected Accounts</h2>
              <div className="space-y-2">
                <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
                  <p className="text-xs text-[#9CA3AF] mb-1">Debit Account</p>
                  <p className="text-sm text-white font-semibold">{entryData.debitAccount}</p>
                </div>
                <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg">
                  <p className="text-xs text-[#9CA3AF] mb-1">Credit Account</p>
                  <p className="text-sm text-white font-semibold">{entryData.creditAccount}</p>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Amount (Rs.) *
              </label>
              <input
                type="number"
                value={entryData.amount || ''}
                onChange={(e) => setEntryData({ ...entryData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-lg font-semibold placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            {/* Description */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Description *
              </label>
              <textarea
                value={entryData.description}
                onChange={(e) => setEntryData({ ...entryData, description: e.target.value })}
                placeholder="Enter entry description..."
                rows={4}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] resize-none"
              />
            </div>

            {/* Date */}
            <DateInputField
              label="Entry Date"
              value={entryData.date}
              onChange={(date) => setEntryData({ ...entryData, date })}
              pickerLabel="SELECT ENTRY DATE"
            />

            {/* Reference */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Reference / Voucher # (Optional)
              </label>
              <input
                type="text"
                value={entryData.reference}
                onChange={(e) => setEntryData({ ...entryData, reference: e.target.value })}
                placeholder="e.g., Invoice #123, Receipt #456"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            {/* User Info */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#8B5CF6] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </span>
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

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60]">
        <button
          onClick={step === 3 ? handleSubmit : handleNextWithReset}
          disabled={!canProceed()}
          className={`w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all ${
            step === 3
              ? 'bg-gradient-to-r from-[#10B981] to-[#059669]'
              : 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED]'
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