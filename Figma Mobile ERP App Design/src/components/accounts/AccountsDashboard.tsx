import { useState } from 'react';
import { 
  Search, 
  Plus, 
  BookOpen, 
  ArrowLeftRight, 
  Users, 
  Wrench, 
  Receipt, 
  BarChart3,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock
} from 'lucide-react';
import { User } from '../../App';
import { useResponsive } from '../../hooks/useResponsive';

export interface AccountEntry {
  id: string;
  entryNumber: string;
  type: 'general' | 'transfer' | 'supplier-payment' | 'worker-payment' | 'expense';
  date: string;
  description: string;
  amount: number;
  debitAccount: string;
  creditAccount: string;
  addedBy: string;
  addedByRole: string;
  createdAt: string;
  status: 'posted' | 'pending' | 'cancelled';
}

interface AccountsDashboardProps {
  user: User;
  onGeneralEntry: () => void;
  onAccountTransfer: () => void;
  onSupplierPayment: () => void;
  onWorkerPayment: () => void;
  onExpenseEntry: () => void;
  onViewReports: () => void;
  onEntryClick: (entry: AccountEntry) => void;
}

export function AccountsDashboard({
  user,
  onGeneralEntry,
  onAccountTransfer,
  onSupplierPayment,
  onWorkerPayment,
  onExpenseEntry,
  onViewReports,
  onEntryClick,
}: AccountsDashboardProps) {
  const responsive = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data - In real app, fetch from backend
  const mockEntries: AccountEntry[] = [
    {
      id: '1',
      entryNumber: 'JE-0001',
      type: 'general',
      date: '2026-01-19',
      description: 'Office rent payment for January',
      amount: 50000,
      debitAccount: 'Rent Expense',
      creditAccount: 'Cash Account',
      addedBy: 'Admin User',
      addedByRole: 'Admin',
      createdAt: '2026-01-19 10:30 AM',
      status: 'posted',
    },
    {
      id: '2',
      entryNumber: 'TRF-0001',
      type: 'transfer',
      date: '2026-01-19',
      description: 'Transfer to bank account',
      amount: 100000,
      debitAccount: 'Bank Account - HBL',
      creditAccount: 'Cash Account',
      addedBy: 'Manager Ali',
      addedByRole: 'Manager',
      createdAt: '2026-01-19 11:00 AM',
      status: 'posted',
    },
    {
      id: '3',
      entryNumber: 'SUP-0001',
      type: 'supplier-payment',
      date: '2026-01-18',
      description: 'Payment to Fabric Supplier - Sana Textiles',
      amount: 75000,
      debitAccount: 'Accounts Payable - Sana Textiles',
      creditAccount: 'Bank Account - HBL',
      addedBy: 'Admin User',
      addedByRole: 'Admin',
      createdAt: '2026-01-18 03:15 PM',
      status: 'posted',
    },
    {
      id: '4',
      entryNumber: 'WKR-0001',
      type: 'worker-payment',
      date: '2026-01-18',
      description: 'Weekly payment to Dyer - Master Ali',
      amount: 15000,
      debitAccount: 'Worker Payments - Dyeing',
      creditAccount: 'Cash Account',
      addedBy: 'Manager Ali',
      addedByRole: 'Manager',
      createdAt: '2026-01-18 05:00 PM',
      status: 'posted',
    },
    {
      id: '5',
      entryNumber: 'EXP-0001',
      type: 'expense',
      date: '2026-01-17',
      description: 'Office supplies and stationery',
      amount: 8500,
      debitAccount: 'Office Supplies Expense',
      creditAccount: 'Cash Account',
      addedBy: 'Staff Member',
      addedByRole: 'Staff',
      createdAt: '2026-01-17 02:30 PM',
      status: 'posted',
    },
  ];

  // Quick stats
  const stats = {
    todayEntries: mockEntries.filter(e => e.date === '2026-01-19').length,
    totalAmount: mockEntries.reduce((sum, e) => sum + e.amount, 0),
    cashBalance: 450000,
    bankBalance: 1250000,
  };

  const getEntryTypeConfig = (type: AccountEntry['type']) => {
    switch (type) {
      case 'general':
        return { label: 'General Entry', color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10', icon: BookOpen };
      case 'transfer':
        return { label: 'Transfer', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', icon: ArrowLeftRight };
      case 'supplier-payment':
        return { label: 'Supplier Payment', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', icon: Users };
      case 'worker-payment':
        return { label: 'Worker Payment', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', icon: Wrench };
      case 'expense':
        return { label: 'Expense', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', icon: Receipt };
    }
  };

  const filteredEntries = mockEntries.filter(entry => 
    entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.entryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.debitAccount.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.creditAccount.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#8B5CF6]/20 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-[#8B5CF6]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">Today</p>
          </div>
          <p className="text-xl font-bold text-white">{stats.todayEntries}</p>
          <p className="text-xs text-[#6B7280]">Entries</p>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#10B981]/20 rounded-lg flex items-center justify-center">
              <Wallet size={16} className="text-[#10B981]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">Cash</p>
          </div>
          <p className="text-lg font-bold text-white">Rs. {(stats.cashBalance / 1000).toFixed(0)}k</p>
          <p className="text-xs text-[#6B7280]">Available</p>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-[#3B82F6]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">Bank</p>
          </div>
          <p className="text-lg font-bold text-white">Rs. {(stats.bankBalance / 1000).toFixed(0)}k</p>
          <p className="text-xs text-[#6B7280]">Balance</p>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#F59E0B]/20 rounded-lg flex items-center justify-center">
              <TrendingDown size={16} className="text-[#F59E0B]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">Total</p>
          </div>
          <p className="text-lg font-bold text-white">Rs. {(stats.totalAmount / 1000).toFixed(0)}k</p>
          <p className="text-xs text-[#6B7280]">Transactions</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
        
        {/* Account Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
            <input
              type="text"
              placeholder="Search accounts (Cash, Bank, Supplier, etc.)..."
              className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ActionButton
            icon={BookOpen}
            label="General Entry"
            color="bg-[#8B5CF6]"
            onClick={onGeneralEntry}
          />
          <ActionButton
            icon={ArrowLeftRight}
            label="Account Transfer"
            color="bg-[#3B82F6]"
            onClick={onAccountTransfer}
          />
          <ActionButton
            icon={Users}
            label="Supplier Payment"
            color="bg-[#F59E0B]"
            onClick={onSupplierPayment}
          />
          <ActionButton
            icon={Wrench}
            label="Worker Payment"
            color="bg-[#10B981]"
            onClick={onWorkerPayment}
          />
          <ActionButton
            icon={Receipt}
            label="Expense Entry"
            color="bg-[#EF4444]"
            onClick={onExpenseEntry}
          />
          <ActionButton
            icon={BarChart3}
            label="Reports"
            color="bg-[#6366F1]"
            onClick={onViewReports}
          />
        </div>
      </div>

      {/* Search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
          <input
            type="text"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>
      </div>

      {/* Recent Entries */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Recent Entries</h2>
        <div className="space-y-2">
          {filteredEntries.map((entry) => {
            const typeConfig = getEntryTypeConfig(entry.type);
            const TypeIcon = typeConfig.icon;

            return (
              <div
                key={entry.id}
                onClick={() => onEntryClick(entry)}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6] transition-colors cursor-pointer"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${typeConfig.bg} rounded-lg flex items-center justify-center`}>
                      <TypeIcon size={20} className={typeConfig.color} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-white">{entry.entryNumber}</p>
                        <span className={`px-2 py-0.5 ${typeConfig.bg} ${typeConfig.color} rounded text-xs font-medium`}>
                          {typeConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-[#D1D5DB]">{entry.description}</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-white">Rs. {entry.amount.toLocaleString()}</p>
                </div>

                {/* Account Info */}
                <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-[#374151]">
                  <div>
                    <p className="text-xs text-[#9CA3AF] mb-1">Debit</p>
                    <p className="text-sm text-white">{entry.debitAccount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9CA3AF] mb-1">Credit</p>
                    <p className="text-sm text-white">{entry.creditAccount}</p>
                  </div>
                </div>

                {/* User Tracking */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-[#8B5CF6] rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-xs">
                        {entry.addedBy.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="text-[#9CA3AF]">Added By:</p>
                      <p className="text-white font-medium">{entry.addedBy}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#9CA3AF]">{entry.date}</p>
                    <p className="text-[#6B7280]">{entry.createdAt}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Action Button Component
interface ActionButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  color: string;
  onClick: () => void;
}

function ActionButton({ icon: Icon, label, color, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`${color} hover:opacity-90 rounded-xl p-4 transition-all active:scale-95 flex flex-col items-center gap-2 min-h-[100px]`}
    >
      <Icon size={24} className="text-white" />
      <span className="text-sm font-semibold text-white text-center">{label}</span>
    </button>
  );
}