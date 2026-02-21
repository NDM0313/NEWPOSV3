import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react';
import type { User } from '../../types';
import { getPaymentAccounts } from '../../api/accounts';
import { createExpense } from '../../api/expenses';

interface ExpenseEntryFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
}

interface ExpenseData {
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentAccountId: string;
  paymentAccountName: string;
  reference: string;
  notes: string;
}

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

const getAccountIcon = (type: string) => (type === 'cash' ? '💵' : type === 'bank' ? '🏦' : '📱');

export function ExpenseEntryFlow({ onBack, onComplete, user, companyId, branchId }: ExpenseEntryFlowProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentAccounts, setPaymentAccounts] = useState<{ id: string; name: string; balance: number; type: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseData>({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: 0,
    paymentAccountId: '',
    paymentAccountName: '',
    reference: '',
    notes: '',
  });

  useEffect(() => {
    if (!companyId) return;
    getPaymentAccounts(companyId).then((r) => {
      if (r.data?.length) setPaymentAccounts(r.data.map((a) => ({ id: a.id, name: a.name, balance: a.balance, type: a.type })));
    });
  }, [companyId]);

  const getCategoryIcon = (categoryName: string) => expenseCategories.find((c) => c.name === categoryName)?.icon || '📊';
  const filteredAccounts = paymentAccounts.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

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

  const handleSubmit = async () => {
    if (!companyId || !branchId || !expenseData.category || !expenseData.description.trim() || expenseData.amount <= 0 || !expenseData.paymentAccountId) return;
    setSubmitting(true);
    setError(null);
    const acc = paymentAccounts.find((a) => a.id === expenseData.paymentAccountId);
    const paymentMethod = acc?.type === 'cash' ? 'cash' : acc?.type === 'bank' ? 'bank' : 'other';
    const { error: err } = await createExpense({
      companyId,
      branchId,
      category: expenseData.category,
      description: expenseData.description.trim(),
      amount: expenseData.amount,
      paymentMethod,
      userId: user.id,
      expenseDate: expenseData.date,
    });
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
        return expenseData.category && expenseData.description.trim();
      case 2:
        return expenseData.amount > 0 && expenseData.paymentAccountId;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={step === 1 ? onBack : handlePreviousWithReset} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Expense Entry</h1>
            <p className="text-xs text-white/80">Record business expense</p>
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
              <h2 className="text-sm font-semibold text-white mb-2">Expense Details</h2>
              <p className="text-xs text-[#9CA3AF]">Select category and describe expense</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Expense Category *</h3>
              <div className="grid grid-cols-2 gap-3">
                {expenseCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setExpenseData({ ...expenseData, category: category.name })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      expenseData.category === category.name ? `${category.color} border-white/50` : 'bg-[#1F2937] border-[#374151] hover:border-[#EF4444]/50'
                    }`}
                  >
                    <span className="text-2xl block mb-2">{category.icon}</span>
                    <p className="text-xs font-semibold text-white">{category.name}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Description *</label>
              <textarea
                value={expenseData.description}
                onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                placeholder="Describe the expense..."
                rows={4}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444] resize-none"
              />
            </div>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Expense Date</label>
              <input type="date" value={expenseData.date} onChange={(e) => setExpenseData({ ...expenseData, date: e.target.value })} className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white focus:outline-none focus:border-[#EF4444]" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getCategoryIcon(expenseData.category)}</span>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Category</p>
                  <p className="text-sm font-semibold text-white">{expenseData.category}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Expense Amount (Rs.) *</label>
              <input
                type="number"
                value={expenseData.amount || ''}
                onChange={(e) => setExpenseData({ ...expenseData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-lg font-semibold placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444]"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20"
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Payment Account *</h3>
              <div className="space-y-2">
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setExpenseData({ ...expenseData, paymentAccountId: account.id, paymentAccountName: account.name })}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                        expenseData.paymentAccountId === account.id ? 'bg-[#EF4444]/20 border-[#EF4444]' : 'bg-[#1F2937] border-[#374151] hover:border-[#EF4444]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getAccountIcon(account.type)}</span>
                          <div>
                            <p className="text-sm font-semibold text-white">{account.name}</p>
                            <p className="text-xs text-[#9CA3AF]">Balance: Rs. {account.balance.toLocaleString()}</p>
                          </div>
                        </div>
                        {expenseData.paymentAccountId === account.id && <Check className="text-[#EF4444]" size={20} />}
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
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {error && <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-sm text-[#EF4444]">{error}</div>}
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
                  <span className="text-lg text-white font-bold">Rs. {expenseData.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-[#374151]">
                  <span className="text-sm text-[#9CA3AF]">Payment Account</span>
                  <span className="text-sm text-white font-medium">{expenseData.paymentAccountName}</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-[#374151]">
                  <span className="text-sm text-[#9CA3AF]">Date</span>
                  <span className="text-sm text-white">{expenseData.date}</span>
                </div>
              </div>
            </div>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Reference / Receipt # (Optional)</label>
                <input
                  type="text"
                  value={expenseData.reference}
                  onChange={(e) => setExpenseData({ ...expenseData, reference: e.target.value })}
                  placeholder="e.g., Receipt #123, Bill #456"
                  className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Notes (Optional)</label>
                <textarea
                  value={expenseData.notes}
                  onChange={(e) => setExpenseData({ ...expenseData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                  className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444] resize-none"
                />
              </div>
            </div>
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#EF4444] rounded-full flex items-center justify-center">
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
            step === 3 ? 'bg-gradient-to-r from-[#10B981] to-[#059669]' : 'bg-gradient-to-r from-[#EF4444] to-[#DC2626]'
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
