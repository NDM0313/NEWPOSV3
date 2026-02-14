import { useState } from 'react';
import { ArrowLeft, DollarSign } from 'lucide-react';
import { User } from '../../App';
import { DateRangeSelector } from './DateRangeSelector';

interface ExpenseReportsProps {
  onBack: () => void;
  user: User;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  account: string;
}

export function ExpenseReports({ onBack, user }: ExpenseReportsProps) {
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-01-20');

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const expenses: Expense[] = [
    { id: 'e1', date: '2026-01-20', category: 'Utilities', description: 'Electricity Bill', amount: 15000, account: 'Cash' },
    { id: 'e2', date: '2026-01-18', category: 'Salaries', description: 'Staff Salary - January', amount: 120000, account: 'Bank' },
    { id: 'e3', date: '2026-01-15', category: 'Rent', description: 'Shop Rent', amount: 50000, account: 'Bank' },
    { id: 'e4', date: '2026-01-12', category: 'Transportation', description: 'Delivery Charges', amount: 8000, account: 'Cash' },
  ];

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#EF4444]" />
            <h1 className="text-lg font-semibold">Expense Reports</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <DateRangeSelector
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={handleDateChange}
        />

        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4">
          <p className="text-xs text-[#EF4444] mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-[#EF4444]">Rs. {total.toLocaleString()}</p>
        </div>

        <div className="space-y-3">
          {expenses.map((expense) => (
            <div key={expense.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-white">{expense.description}</p>
                  <p className="text-xs text-[#9CA3AF]">{expense.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#EF4444]">Rs. {expense.amount.toLocaleString()}</p>
                  <p className="text-xs text-[#6B7280]">{expense.date}</p>
                </div>
              </div>
              <span className="px-2 py-1 bg-[#3B82F6]/10 text-[#3B82F6] text-xs rounded-md font-medium">
                {expense.account}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}