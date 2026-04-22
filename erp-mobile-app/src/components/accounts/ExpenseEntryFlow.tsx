import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { User } from '../../types';
import { createExpense } from '../../api/expenses';
import {
  MobilePaymentSheet,
  type MobilePaymentSheetSubmitPayload,
  type MobilePaymentSheetSubmitResult,
} from '../shared/MobilePaymentSheet';

interface ExpenseEntryFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
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

export function ExpenseEntryFlow({ onBack, onComplete, user, companyId, branchId }: ExpenseEntryFlowProps) {
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [showSheet, setShowSheet] = useState(false);

  const handleSubmit = async (payload: MobilePaymentSheetSubmitPayload): Promise<MobilePaymentSheetSubmitResult> => {
    if (!companyId || !branchId) {
      return { success: false, error: 'Company and branch required.' };
    }
    const methodForApi = payload.method === 'wallet' ? 'other' : payload.method;
    const { data, error } = await createExpense({
      companyId,
      branchId,
      category,
      description: description.trim() || category,
      amount: payload.amount,
      paymentMethod: methodForApi,
      userId: user.id,
      expenseDate: payload.paymentDate,
      paymentAccountId: payload.accountId,
    });
    return {
      success: !!data,
      error: error ?? null,
      paymentId: data?.id ?? null,
      referenceNumber: data?.expense_no ?? null,
      partyAccountName: category,
    };
  };

  const canContinue = category && description.trim();

  if (showSheet && companyId && branchId) {
    return (
      <MobilePaymentSheet
        mode="expense"
        companyId={companyId}
        branchId={branchId}
        userId={user.id}
        partyName={category}
        referenceNo={description.slice(0, 40)}
        hideSummary
        hidePayFull
        allowOverpayment
        onClose={() => setShowSheet(false)}
        onSuccess={onComplete}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Expense Entry</h1>
            <p className="text-xs text-white/80">Select a category and describe the expense</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Expense Category *</h3>
          <div className="grid grid-cols-2 gap-3">
            {expenseCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.name)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  category === c.name ? `${c.color} border-white/50` : 'bg-[#1F2937] border-[#374151] hover:border-[#EF4444]/50'
                }`}
              >
                <span className="text-2xl block mb-2">{c.icon}</span>
                <p className="text-xs font-semibold text-white">{c.name}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the expense..."
            rows={4}
            className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444] resize-none"
          />
        </div>
      </div>

      <div className="fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60] fixed-bottom-above-nav">
        <button
          onClick={() => setShowSheet(true)}
          disabled={!canContinue}
          className="w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-[#EF4444] to-[#DC2626]"
        >
          Continue to Payment
        </button>
      </div>
    </div>
  );
}
