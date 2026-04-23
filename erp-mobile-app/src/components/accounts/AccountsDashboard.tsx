import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  BookOpen,
  ArrowLeftRight,
  Users,
  Wrench,
  Receipt,
  BarChart3,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  BookMarked,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import type { User } from '../../types';
import { useResponsive } from '../../hooks/useResponsive';
import { getJournalEntries, getAccounts } from '../../api/accounts';

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
  companyId?: string | null;
  branchId?: string | null;
  onGeneralEntry: () => void;
  onAccountTransfer: () => void;
  onSupplierPayment: () => void;
  onWorkerPayment: () => void;
  onExpenseEntry: () => void;
  onViewReports: () => void;
  onChartOfAccounts: () => void;
  onEntryClick: (entry: AccountEntry) => void;
}

function mapReferenceTypeToEntryType(ref: string): AccountEntry['type'] {
  if (ref === 'transfer') return 'transfer';
  if (ref === 'payment') return 'supplier-payment';
  if (ref === 'expense') return 'expense';
  return 'general';
}

/**
 * Classify an entry as cash-in (green) vs cash-out (red) using the broad reference type
 * semantics. Supplier / worker payments and expenses flow OUT; transfers are neutral; a
 * general entry is best classified by comparing cash/bank account movement, but since
 * the dashboard row only surfaces the summed amount we infer direction from type.
 */
function entryDirection(type: AccountEntry['type']): 'in' | 'out' | 'neutral' {
  if (type === 'supplier-payment' || type === 'worker-payment' || type === 'expense') return 'out';
  if (type === 'transfer') return 'neutral';
  return 'in';
}

export function AccountsDashboard({
  user,
  companyId,
  branchId,
  onGeneralEntry,
  onAccountTransfer,
  onSupplierPayment,
  onWorkerPayment,
  onExpenseEntry,
  onViewReports,
  onChartOfAccounts,
  onEntryClick,
}: AccountsDashboardProps) {
  useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [stats, setStats] = useState({ todayEntries: 0, totalAmount: 0, cashBalance: 0, bankBalance: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [jeRes, accRes] = await Promise.all([
        getJournalEntries(companyId, branchId, 30),
        getAccounts(companyId),
      ]);
      if (cancelled) return;
      if (jeRes.error) {
        setEntries([]);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const mapped: AccountEntry[] = jeRes.data.map((e) => {
          const debitLine = e.lines?.find((l) => (l.debit || 0) > 0);
          const creditLine = e.lines?.find((l) => (l.credit || 0) > 0);
          const amt = e.total_debit || e.total_credit || 0;
          return {
            id: e.id,
            entryNumber: e.entry_no,
            type: mapReferenceTypeToEntryType(e.reference_type),
            date: e.entry_date,
            description: e.description,
            amount: amt,
            debitAccount: debitLine?.account?.name ?? '—',
            creditAccount: creditLine?.account?.name ?? '—',
            addedBy: user.name,
            addedByRole: user.role,
            createdAt: e.entry_date,
            status: 'posted' as const,
          };
        });
        setEntries(mapped);
        setStats((s) => ({
          ...s,
          todayEntries: mapped.filter((e) => e.date === today).length,
          totalAmount: mapped.reduce((sum, e) => sum + e.amount, 0),
        }));
      }
      if (accRes.data?.length) {
        const cash = accRes.data.find((a) => a.type === 'cash' || a.name.toLowerCase().includes('cash'));
        const bank = accRes.data.find((a) => a.type === 'bank' || a.name.toLowerCase().includes('bank'));
        setStats((s) => ({
          ...s,
          cashBalance: cash?.balance ?? 0,
          bankBalance: bank?.balance ?? 0,
        }));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [companyId, branchId, user.name, user.role]);

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

  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.entryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.debitAccount.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.creditAccount.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [entries, searchQuery],
  );

  const formatCurrency = (n: number): string => {
    if (Math.abs(n) >= 1_000_000) return `Rs. ${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `Rs. ${(n / 1_000).toFixed(0)}k`;
    return `Rs. ${n.toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      {/* KPI tiles — full-bleed, gradient accents, no hover clutter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#8B5CF6]/15 to-[#1F2937] border border-[#8B5CF6]/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#8B5CF6]/25 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-[#C4B5FD]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">Today</p>
          </div>
          <p className="text-xl font-bold text-white">{stats.todayEntries}</p>
          <p className="text-xs text-[#6B7280]">Entries</p>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-[#10B981]/15 to-[#1F2937] border border-[#10B981]/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#10B981]/25 rounded-lg flex items-center justify-center">
              <Wallet size={16} className="text-[#6EE7B7]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">Cash</p>
          </div>
          <p className="text-lg font-bold text-white">{formatCurrency(stats.cashBalance)}</p>
          <p className="text-xs text-[#6B7280]">Available</p>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-[#3B82F6]/15 to-[#1F2937] border border-[#3B82F6]/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#3B82F6]/25 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-[#93C5FD]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">Bank</p>
          </div>
          <p className="text-lg font-bold text-white">{formatCurrency(stats.bankBalance)}</p>
          <p className="text-xs text-[#6B7280]">Balance</p>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-[#F59E0B]/15 to-[#1F2937] border border-[#F59E0B]/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#F59E0B]/25 rounded-lg flex items-center justify-center">
              <TrendingDown size={16} className="text-[#FCD34D]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">30 Day</p>
          </div>
          <p className="text-lg font-bold text-white">{formatCurrency(stats.totalAmount)}</p>
          <p className="text-xs text-[#6B7280]">Volume</p>
        </div>
      </div>

      {/* Quick actions — horizontal scroll pills with colored halo on the icon only */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3 px-1">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ActionButton icon={BookOpen} label="General Entry" color="from-[#8B5CF6] to-[#7C3AED]" onClick={onGeneralEntry} />
          <ActionButton icon={ArrowLeftRight} label="Account Transfer" color="from-[#3B82F6] to-[#2563EB]" onClick={onAccountTransfer} />
          <ActionButton icon={Users} label="Supplier Payment" color="from-[#F59E0B] to-[#D97706]" onClick={onSupplierPayment} />
          <ActionButton icon={Wrench} label="Worker Payment" color="from-[#10B981] to-[#059669]" onClick={onWorkerPayment} />
          <ActionButton icon={Receipt} label="Expense Entry" color="from-[#EF4444] to-[#DC2626]" onClick={onExpenseEntry} />
          <ActionButton icon={BookMarked} label="Chart" color="from-[#F59E0B] to-[#D97706]" onClick={onChartOfAccounts} />
          <ActionButton icon={BarChart3} label="Reports" color="from-[#6366F1] to-[#4F46E5]" onClick={onViewReports} />
        </div>
      </div>

      {/* Single search bar — previously two identical inputs */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
          <input
            type="text"
            placeholder="Search entry # or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
          />
        </div>
      </div>

      {/* Recent entries — compact rows with cash-in/cash-out arrows */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold text-white">Recent Entries</h2>
          {filteredEntries.length > 0 && (
            <span className="text-xs text-[#6B7280]">{filteredEntries.length} shown</span>
          )}
        </div>
        {loading ? (
          <div className="py-8 text-center text-[#9CA3AF]">Loading...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-8 text-center text-[#9CA3AF]">No entries yet</div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry) => {
              const typeConfig = getEntryTypeConfig(entry.type);
              const TypeIcon = typeConfig.icon;
              const direction = entryDirection(entry.type);
              const DirIcon = direction === 'out' ? ArrowUpRight : direction === 'in' ? ArrowDownLeft : ArrowLeftRight;
              const dirColor = direction === 'out' ? 'text-[#EF4444]' : direction === 'in' ? 'text-[#10B981]' : 'text-[#93C5FD]';
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onEntryClick(entry)}
                  className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-xl p-3 hover:border-[#8B5CF6] transition-all active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${typeConfig.bg} rounded-lg flex items-center justify-center shrink-0`}>
                      <TypeIcon size={18} className={typeConfig.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-white truncate">{entry.entryNumber}</p>
                        <span className={`px-2 py-0.5 ${typeConfig.bg} ${typeConfig.color} rounded text-[10px] font-medium shrink-0`}>
                          {typeConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#D1D5DB] truncate">{entry.description}</p>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">
                        {entry.debitAccount} → {entry.creditAccount} • {entry.date}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`flex items-center gap-1 justify-end ${dirColor}`}>
                        <DirIcon size={14} />
                        <p className="text-sm font-bold">Rs. {entry.amount.toLocaleString()}</p>
                      </div>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">
                        {direction === 'out' ? 'Out' : direction === 'in' ? 'In' : 'Transfer'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  /** Tailwind "from-..." and "to-..." gradient endpoint classes (e.g. "from-[#8B5CF6] to-[#7C3AED]"). */
  color: string;
  onClick: () => void;
}

function ActionButton({ icon: Icon, label, color, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`bg-gradient-to-br ${color} hover:opacity-95 rounded-xl p-4 transition-all active:scale-95 flex flex-col items-center gap-2 min-h-[96px] shadow-md shadow-black/20`}
    >
      <Icon size={22} className="text-white" />
      <span className="text-xs font-semibold text-white text-center leading-tight">{label}</span>
    </button>
  );
}
