import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Search, ArrowLeftRight } from 'lucide-react';
import { User } from '../../App';
import { DateInputField } from '../shared/DateTimePicker';

interface AccountTransferFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
}

interface TransferData {
  fromAccount: string;
  toAccount: string;
  amount: number;
  date: string;
  reference: string;
  notes: string;
}

export function AccountTransferFlow({ onBack, onComplete, user }: AccountTransferFlowProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [transferData, setTransferData] = useState<TransferData>({
    fromAccount: '',
    toAccount: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  });

  // Payment accounts only (Cash, Bank, Wallet, etc.)
  const paymentAccounts = [
    { id: '1', name: 'Cash Account', balance: 450000, icon: '💵' },
    { id: '2', name: 'Bank Account - HBL', balance: 850000, icon: '🏦' },
    { id: '3', name: 'Bank Account - MCB', balance: 400000, icon: '🏦' },
    { id: '4', name: 'JazzCash Wallet', balance: 25000, icon: '📱' },
    { id: '5', name: 'EasyPaisa Wallet', balance: 15000, icon: '📱' },
    { id: '6', name: 'Petty Cash', balance: 10000, icon: '💰' },
  ];

  const getAccount = (name: string) => paymentAccounts.find(a => a.name === name);

  // Filter accounts based on search
  const filteredAccounts = paymentAccounts.filter(account =>
    account.name.toLowerCase().includes(searchQuery.toLowerCase())
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

  const handleSubmit = () => {
    console.log('Account Transfer:', {
      ...transferData,
      addedBy: user.name,
      addedByRole: user.role,
      createdAt: new Date().toISOString(),
    });
    onComplete();
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return transferData.fromAccount !== '';
      case 2:
        return transferData.toAccount !== '' && transferData.toAccount !== transferData.fromAccount;
      case 3:
        return transferData.amount > 0;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#3B82F6] to-[#2563EB] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={step === 1 ? onBack : handlePreviousWithReset}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">Account Transfer</h1>
            <p className="text-xs text-white/80">Move funds between accounts</p>
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
        {/* Step 1: From Account */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">Transfer From</h2>
              <p className="text-xs text-[#9CA3AF]">Select source account</p>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>

            <div className="space-y-2">
              {filteredAccounts.length > 0 ? (
                filteredAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => setTransferData({ ...transferData, fromAccount: account.name })}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      transferData.fromAccount === account.name
                        ? 'bg-[#EF4444]/20 border-[#EF4444]'
                        : 'bg-[#1F2937] border-[#374151] hover:border-[#EF4444]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{account.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-white">{account.name}</p>
                          <p className="text-xs text-[#9CA3AF]">Balance: Rs. {account.balance.toLocaleString()}</p>
                        </div>
                      </div>
                      {transferData.fromAccount === account.name && (
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

        {/* Step 2: To Account */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">Transfer To</h2>
              <p className="text-xs text-[#9CA3AF]">Select destination account</p>
              {transferData.fromAccount && (
                <div className="mt-3 p-2 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg flex items-center gap-2">
                  <span className="text-xl">{getAccount(transferData.fromAccount)?.icon}</span>
                  <div>
                    <p className="text-xs text-[#9CA3AF]">From:</p>
                    <p className="text-sm text-white font-medium">{transferData.fromAccount}</p>
                  </div>
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
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>

            <div className="space-y-2">
              {filteredAccounts.filter(acc => acc.name !== transferData.fromAccount).length > 0 ? (
                filteredAccounts
                  .filter(acc => acc.name !== transferData.fromAccount)
                  .map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setTransferData({ ...transferData, toAccount: account.name })}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        transferData.toAccount === account.name
                          ? 'bg-[#10B981]/20 border-[#10B981]'
                          : 'bg-[#1F2937] border-[#374151] hover:border-[#10B981]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{account.icon}</span>
                          <div>
                            <p className="text-sm font-semibold text-white">{account.name}</p>
                            <p className="text-xs text-[#9CA3AF]">Balance: Rs. {account.balance.toLocaleString()}</p>
                          </div>
                        </div>
                        {transferData.toAccount === account.name && (
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

        {/* Step 3: Amount & Details */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Transfer Preview */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getAccount(transferData.fromAccount)?.icon}</span>
                  <div>
                    <p className="text-xs text-[#9CA3AF]">From</p>
                    <p className="text-sm text-white font-medium">{transferData.fromAccount}</p>
                  </div>
                </div>
                
                <ArrowLeftRight className="text-[#3B82F6]" size={24} />
                
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getAccount(transferData.toAccount)?.icon}</span>
                  <div>
                    <p className="text-xs text-[#9CA3AF]">To</p>
                    <p className="text-sm text-white font-medium">{transferData.toAccount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Transfer Amount (Rs.) *
              </label>
              <input
                type="number"
                value={transferData.amount || ''}
                onChange={(e) => setTransferData({ ...transferData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-lg font-semibold placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
              <p className="text-xs text-[#9CA3AF] mt-2">
                Available: Rs. {getAccount(transferData.fromAccount)?.balance.toLocaleString()}
              </p>
            </div>

            {/* Date */}
            <DateInputField
              label="Transfer Date"
              value={transferData.date}
              onChange={(date) => setTransferData({ ...transferData, date })}
              pickerLabel="SELECT TRANSFER DATE"
            />

            {/* Reference */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Reference # (Optional)
              </label>
              <input
                type="text"
                value={transferData.reference}
                onChange={(e) => setTransferData({ ...transferData, reference: e.target.value })}
                placeholder="e.g., TRF-001, Cheque #123"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            {/* Notes */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={transferData.notes}
                onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] resize-none"
              />
            </div>

            {/* User Info */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#3B82F6] rounded-full flex items-center justify-center">
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
              : 'bg-gradient-to-r from-[#3B82F6] to-[#2563EB]'
          }`}
        >
          {step === 3 ? (
            <>
              <Check size={18} />
              Confirm Transfer
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