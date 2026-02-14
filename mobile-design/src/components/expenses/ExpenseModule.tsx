import { useState } from 'react';
import { ArrowLeft, Plus, Calendar, DollarSign, User, Filter, Search } from 'lucide-react';
import { User as UserType } from '../../App';
import { ExpenseEntryFlow } from './ExpenseEntryFlow';

interface ExpenseModuleProps {
  onBack: () => void;
  user: UserType;
}

interface Expense {
  id: string;
  category: string;
  categoryIcon: string;
  description: string;
  amount: number;
  paymentAccount: string;
  accountIcon: string;
  date: string;
  reference?: string;
  notes?: string;
  addedBy: string;
  addedByRole: string;
  createdAt: string;
  status: 'posted' | 'pending';
}

type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'older';

export function ExpenseModule({ onBack, user }: ExpenseModuleProps) {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock expenses data
  const expenses: Expense[] = [
    {
      id: '1',
      category: 'Rent Expense',
      categoryIcon: '🏢',
      description: 'Monthly office rent - January 2026',
      amount: 85000,
      paymentAccount: 'Bank Account - HBL',
      accountIcon: '🏦',
      date: '2026-01-19',
      reference: 'RENT-JAN-2026',
      addedBy: 'Ahmad Khan',
      addedByRole: 'Admin',
      createdAt: '2026-01-19T10:30:00',
      status: 'posted',
    },
    {
      id: '2',
      category: 'Utility Bills',
      categoryIcon: '⚡',
      description: 'Electricity bill - December 2025',
      amount: 12500,
      paymentAccount: 'Cash Account',
      accountIcon: '💵',
      date: '2026-01-18',
      reference: 'ELEC-DEC-2025',
      addedBy: 'Sara Ahmed',
      addedByRole: 'Manager',
      createdAt: '2026-01-18T14:20:00',
      status: 'posted',
    },
    {
      id: '3',
      category: 'Transportation',
      categoryIcon: '🚗',
      description: 'Delivery van fuel',
      amount: 8500,
      paymentAccount: 'Cash Account',
      accountIcon: '💵',
      date: '2026-01-18',
      addedBy: 'Ahmad Khan',
      addedByRole: 'Admin',
      createdAt: '2026-01-18T11:15:00',
      status: 'posted',
    },
    {
      id: '4',
      category: 'Office Supplies',
      categoryIcon: '📝',
      description: 'Stationery and printing materials',
      amount: 4200,
      paymentAccount: 'Cash Account',
      accountIcon: '💵',
      date: '2026-01-15',
      addedBy: 'Sara Ahmed',
      addedByRole: 'Manager',
      createdAt: '2026-01-15T09:45:00',
      status: 'posted',
    },
    {
      id: '5',
      category: 'Marketing & Advertising',
      categoryIcon: '📢',
      description: 'Facebook ads campaign',
      amount: 15000,
      paymentAccount: 'Bank Account - MCB',
      accountIcon: '🏦',
      date: '2026-01-12',
      reference: 'FB-ADS-JAN',
      addedBy: 'Ahmad Khan',
      addedByRole: 'Admin',
      createdAt: '2026-01-12T16:30:00',
      status: 'posted',
    },
    {
      id: '6',
      category: 'Maintenance & Repairs',
      categoryIcon: '🔧',
      description: 'AC servicing and maintenance',
      amount: 7800,
      paymentAccount: 'Cash Account',
      accountIcon: '💵',
      date: '2026-01-10',
      addedBy: 'Sara Ahmed',
      addedByRole: 'Manager',
      createdAt: '2026-01-10T13:20:00',
      status: 'posted',
    },
  ];

  const categories = [
    { value: 'all', label: 'All', icon: '📊' },
    { value: 'Rent Expense', label: 'Rent', icon: '🏢' },
    { value: 'Utility Bills', label: 'Utilities', icon: '⚡' },
    { value: 'Office Supplies', label: 'Supplies', icon: '📝' },
    { value: 'Transportation', label: 'Transport', icon: '🚗' },
    { value: 'Marketing & Advertising', label: 'Marketing', icon: '📢' },
    { value: 'Maintenance & Repairs', label: 'Repairs', icon: '🔧' },
  ];

  // Date grouping logic
  const getDateGroup = (dateStr: string): DateGroup => {
    const expenseDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    expenseDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    if (expenseDate.getTime() === today.getTime()) return 'today';
    if (expenseDate.getTime() === yesterday.getTime()) return 'yesterday';
    if (expenseDate >= weekAgo) return 'thisWeek';
    return 'older';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Filter and group expenses
  const filteredExpenses = expenses.filter(exp => {
    const matchesCategory = filterCategory === 'all' || exp.category === filterCategory;
    const matchesSearch = 
      exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.paymentAccount.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group by date
  const groupedExpenses = filteredExpenses.reduce((groups, expense) => {
    const group = getDateGroup(expense.date);
    if (!groups[group]) groups[group] = [];
    groups[group].push(expense);
    return groups;
  }, {} as Record<DateGroup, Expense[]>);

  // Calculate totals
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const todayExpenses = (groupedExpenses.today || []).reduce((sum, exp) => sum + exp.amount, 0);

  const groupLabels: Record<DateGroup, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    older: 'Older',
  };

  if (showAddExpense) {
    return (
      <ExpenseEntryFlow
        onBack={() => setShowAddExpense(false)}
        onComplete={() => setShowAddExpense(false)}
        user={user}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold">Expenses</h1>
              <p className="text-xs text-white/80">Track all business expenses</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddExpense(true)}
            className="p-2.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-xs text-white/70 mb-1">Total This Period</p>
            <p className="text-lg font-bold">Rs. {totalExpenses.toLocaleString()}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-xs text-white/70 mb-1">Today</p>
            <p className="text-lg font-bold">Rs. {todayExpenses.toLocaleString()}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={18} />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/40"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                filterCategory === cat.value
                  ? 'bg-white text-[#EF4444]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <span>{cat.icon}</span>
              <span className="text-xs font-medium">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Expense List */}
      <div className="p-4 space-y-4">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#1F2937] rounded-full flex items-center justify-center mx-auto mb-3">
              <DollarSign className="w-8 h-8 text-[#6B7280]" />
            </div>
            <p className="text-[#9CA3AF] text-sm">No expenses found</p>
            <p className="text-[#6B7280] text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {(['today', 'yesterday', 'thisWeek', 'older'] as DateGroup[]).map((group) => {
              const groupExpenses = groupedExpenses[group];
              if (!groupExpenses || groupExpenses.length === 0) return null;

              return (
                <div key={group}>
                  {/* Date Group Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-[#9CA3AF]" />
                    <h2 className="text-sm font-semibold text-white">{groupLabels[group]}</h2>
                    <div className="flex-1 h-px bg-[#374151]" />
                    <span className="text-xs text-[#6B7280]">
                      {groupExpenses.length} {groupExpenses.length === 1 ? 'expense' : 'expenses'}
                    </span>
                  </div>

                  {/* Expense Items */}
                  <div className="space-y-2">
                    {groupExpenses.map((expense) => (
                      <button
                        key={expense.id}
                        className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 text-left hover:border-[#EF4444]/50 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3 flex-1">
                            <span className="text-2xl">{expense.categoryIcon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white mb-1">{expense.category}</p>
                              <p className="text-xs text-[#9CA3AF] line-clamp-2">{expense.description}</p>
                            </div>
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-base font-bold text-[#EF4444]">
                              - Rs. {expense.amount.toLocaleString()}
                            </p>
                            {expense.status === 'posted' && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] text-xs rounded">
                                Posted
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-[#374151]">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{expense.accountIcon}</span>
                              <span className="text-xs text-[#9CA3AF]">{expense.paymentAccount}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-[#6B7280]" />
                              <span className="text-xs text-[#6B7280]">{expense.addedBy}</span>
                            </div>
                          </div>
                          <span className="text-xs text-[#6B7280]">{formatDate(expense.date)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Floating Add Button - Mobile */}
      <button
        onClick={() => setShowAddExpense(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-br from-[#EF4444] to-[#DC2626] rounded-full shadow-lg flex items-center justify-center z-20 hover:scale-110 transition-transform"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={3} />
      </button>
    </div>
  );
}
