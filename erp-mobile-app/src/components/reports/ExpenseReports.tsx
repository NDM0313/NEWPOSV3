import { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, Search, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import * as expensesApi from '../../api/expenses';

interface ExpenseReportsProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

export function ExpenseReports({ onBack, user: _user, companyId, branchId }: ExpenseReportsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenses, setExpenses] = useState<expensesApi.ExpenseRow[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    expensesApi.getExpenses(companyId, branchId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setExpenses(error ? [] : data || []);
    });
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const inRange = expenses.filter((e) => {
    const d = e.expense_date?.slice(0, 10) ?? '';
    return d >= dateFrom && d <= dateTo;
  });
  const filtered = inRange.filter(
    (e) =>
      (e.category ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const total = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-base text-white">Expense Reports</h1>
            <p className="text-xs text-[#9CA3AF]">{dateFrom} to {dateTo}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9CA3AF] mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg px-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9CA3AF] mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg px-3 text-sm text-white"
            />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by category or description..."
            className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444]"
          />
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <span className="text-sm text-[#9CA3AF]">Total Expenses</span>
          <p className="text-xl font-bold text-[#EF4444]">Rs. {total.toLocaleString()}</p>
          <p className="text-xs text-[#6B7280]">{filtered.length} records</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#EF4444] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <div key={e.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">{e.category ?? '—'}</p>
                    <p className="text-sm text-[#9CA3AF]">{e.description ?? '—'}</p>
                    <p className="text-xs text-[#6B7280]">{e.expense_date?.slice(0, 10)} · {e.expense_no ?? ''}</p>
                  </div>
                  <p className="font-semibold text-[#EF4444]">Rs. {(e.amount || 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No expenses in this period</p>
          </div>
        )}
      </div>
    </div>
  );
}
