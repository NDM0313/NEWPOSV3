import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { User } from '../../App';

interface ExpenseEntryFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
}

interface ExpenseData {
  category: string;
  description: string;
  amount: number;
  paymentAccount: string;
  date: string;
  notes: string;
}

export function ExpenseEntryFlow({ onBack, onComplete, user }: ExpenseEntryFlowProps) {
  const [step, setStep] = useState(1);
  const [expenseData, setExpenseData] = useState<ExpenseData>({
    category: '',
    description: '',
    amount: 0,
    paymentAccount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const expenseCategories = [
    { id: '1', name: 'Rent Expense', icon: '🏢', color: 'bg-[#8B5CF6]' },
    { id: '2', name: 'Salary Expense', icon: '💼', color: 'bg-[#3B82F6]' },
    { id: '3', name: 'Utility Bills', icon: '⚡', color: 'bg-[#F59E0B]' },
    { id: '4', name: 'Office Supplies', icon: '📝', color: 'bg-[#10B981]' },
    { id: '5', name: 'Transportation', icon: '🚗', color: 'bg-[#EC4899]' },
    { id: '6', name: 'Marketing & Advertising', icon: '📢', color: 'bg-[#EF4444]' },
    { id: '7', name: 'Maintenance & Repairs', icon: '🔧', color: 'bg-[#6366F1]' },
    { id: '8', name: 'Other Expenses', icon: '📊', color: 'bg-[#6B7280]' },
  ];

  const paymentAccounts = [
    { id: '1', name: 'Cash Account', balance: 450000, icon: '💵' },
    { id: '2', name: 'Bank Account - HBL', balance: 850000, icon: '🏦' },
    { id: '3', name: 'Bank Account - MCB', balance: 400000, icon: '🏦' },
  ];

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    // In real app, submit to backend and create accounting entry
    console.log('Expense Entry:', {
      ...expenseData,
      addedBy: user.name,
      addedByRole: user.role,
      createdAt: new Date().toISOString(),
    });
    onComplete();
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return expenseData.category !== '' && expenseData.description.trim() !== '';
      case 2:
        return expenseData.amount > 0 && expenseData.paymentAccount !== '';
      case 3:
        return true;
      default:
        return false;
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    return expenseCategories.find(c => c.name === categoryName)?.icon || '📊';
  };

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={step === 1 ? onBack : handlePrevious}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">Add Expense</h1>
            <p className="text-xs text-white/80">Record new business expense</p>
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
        {/* Step 1: Category & Description */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">Expense Category</h2>
              <p className="text-xs text-[#9CA3AF]">Select category and describe the expense</p>
            </div>

            {/* Category Selection */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Select Category *</h3>
              <div className="grid grid-cols-2 gap-3">
                {expenseCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setExpenseData({ ...expenseData, category: category.name })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      expenseData.category === category.name
                        ? `${category.color} border-white/50`
                        : 'bg-[#1F2937] border-[#374151] hover:border-[#EF4444]/50'
                    }`}
                  >
                    <span className="text-2xl block mb-2">{category.icon}</span>
                    <p className="text-xs font-semibold text-white">{category.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Description *
              </label>
              <textarea
                value={expenseData.description}
                onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                placeholder="Describe the expense..."
                rows={4}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444] resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 2: Amount & Payment Account */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Selected Category */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{getCategoryIcon(expenseData.category)}</span>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Category</p>
                  <p className="text-sm font-semibold text-white">{expenseData.category}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-[#374151]">
                <p className="text-xs text-[#9CA3AF] mb-1">Description</p>
                <p className="text-sm text-white">{expenseData.description}</p>
              </div>
            </div>

            {/* Amount */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Amount (Rs.) *
              </label>
              <input
                type="number"
                value={expenseData.amount || ''}
                onChange={(e) => setExpenseData({ ...expenseData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-lg font-semibold placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444]"
              />
            </div>

            {/* Payment Account */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Payment Account *</h3>
              <div className="space-y-2">
                {paymentAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => setExpenseData({ ...expenseData, paymentAccount: account.name })}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                      expenseData.paymentAccount === account.name
                        ? 'bg-[#EF4444]/20 border-[#EF4444]'
                        : 'bg-[#1F2937] border-[#374151] hover:border-[#EF4444]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{account.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-white">{account.name}</p>
                          <p className="text-xs text-[#9CA3AF]">Balance: Rs. {account.balance.toLocaleString()}</p>
                        </div>
                      </div>
                      {expenseData.paymentAccount === account.name && (
                        <Check className="text-[#EF4444]" size={20} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Date & Notes */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-4">Expense Summary</h2>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-[#374151]">
                  <span className="text-3xl">{getCategoryIcon(expenseData.category)}</span>
                  <div>
                    <p className="text-xs text-[#9CA3AF]">Category</p>
                    <p className="text-sm font-semibold text-white">{expenseData.category}</p>
                  </div>
                </div>
                <div className="pb-3 border-b border-[#374151]">
                  <p className="text-xs text-[#9CA3AF] mb-1">Description</p>
                  <p className="text-sm text-white">{expenseData.description}</p>
                </div>
                <div className="flex justify-between pb-3 border-b border-[#374151]">
                  <span className="text-sm text-[#9CA3AF]">Amount</span>
                  <span className="text-lg text-[#EF4444] font-bold">Rs. {expenseData.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#9CA3AF]">Payment Account</span>
                  <span className="text-sm text-white font-medium">{expenseData.paymentAccount}</span>
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Expense Date *
              </label>
              <input
                type="date"
                value={expenseData.date}
                onChange={(e) => setExpenseData({ ...expenseData, date: e.target.value })}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white focus:outline-none focus:border-[#EF4444]"
              />
              <p className="text-xs text-[#6B7280] mt-2">You can select a past date if needed</p>
            </div>

            {/* Notes */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={expenseData.notes}
                onChange={(e) => setExpenseData({ ...expenseData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444] resize-none"
              />
            </div>

            {/* User Info */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#EF4444] rounded-full flex items-center justify-center">
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

            {/* Info Box */}
            <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-xl p-4">
              <p className="text-xs text-[#93C5FD]">
                💡 This expense will be automatically posted to your accounts ledger
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60]">
        <button
          onClick={step === 3 ? handleSubmit : handleNext}
          disabled={!canProceed()}
          className={`w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all ${
            step === 3
              ? 'bg-gradient-to-r from-[#10B981] to-[#059669]'
              : 'bg-gradient-to-r from-[#EF4444] to-[#DC2626]'
          }`}
        >
          {step === 3 ? (
            <>
              <Check size={18} />
              Save Expense
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
