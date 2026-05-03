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
  type LucideIcon,
} from 'lucide-react';
import type { User } from '../../types';
import { useResponsive } from '../../hooks/useResponsive';
import { getJournalEntries, getAccounts, type JournalEntryLineRow } from '../../api/accounts';
import { MOBILE_DATA_INVALIDATED_EVENT, shouldAcceptMobileInvalidation, type MobileInvalidationDetail } from '../../lib/dataInvalidationBus';

/** Derived from journal_entries.reference_type (+ payment_id) for badges and filters. */
export type EntrySourceKind =
  | 'sale'
  | 'sale_reversal'
  | 'purchase'
  | 'purchase_reversal'
  | 'payment_supplier'
  | 'payment_worker'
  | 'payment_customer'
  | 'studio_stage'
  | 'studio_stage_reversal'
  | 'rental'
  | 'expense'
  | 'transfer'
  | 'opening_balance'
  | 'sale_return'
  | 'journal_manual'
  | 'general';

export interface AccountEntry {
  id: string;
  entryNumber: string;
  type: 'general' | 'transfer' | 'supplier-payment' | 'worker-payment' | 'expense';
  date: string;
  description: string;
  amount: number;
  debitAccount: string;
  creditAccount: string;
  /** Single-line summary for list rows (handles multi-line document JEs). */
  accountsSummary?: string;
  lineCount?: number;
  sourceKind?: EntrySourceKind;
  sourceLabel?: string;
  postedAt?: string | null;
  addedBy: string;
  addedByRole: string;
  createdAt: string;
  status: 'posted' | 'pending' | 'cancelled';
  referenceType?: string | null;
  referenceId?: string | null;
  paymentId?: string | null;
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
  const r = (ref || '').toLowerCase();
  if (r === 'transfer') return 'transfer';
  if (r === 'payment' || r === 'manual_payment') return 'supplier-payment';
  if (r === 'worker_payment') return 'worker-payment';
  if (r === 'expense' || r === 'expense_payment') return 'expense';
  return 'general';
}

export function classifySource(referenceType: string, paymentId: string | null | undefined): EntrySourceKind {
  const r = (referenceType || '').toLowerCase();
  const hasPay = Boolean(paymentId);
  if (r === 'sale') return 'sale';
  if (r === 'sale_reversal') return 'sale_reversal';
  if (r === 'purchase' || r === 'purchase_order') return 'purchase';
  if (r === 'purchase_reversal' || r === 'purchase_cancel') return 'purchase_reversal';
  if (r === 'worker_payment') return 'payment_worker';
  if (r === 'payment' || r === 'manual_payment' || r === 'supplier_payment') return hasPay ? 'payment_supplier' : 'general';
  if (r === 'customer_payment' || r === 'receipt' || r === 'sale_payment') return 'payment_customer';
  if (r === 'studio_production_stage') return 'studio_stage';
  if (r === 'studio_production_stage_reversal') return 'studio_stage_reversal';
  if (r === 'rental' || r === 'rental_payment') return 'rental';
  if (r === 'expense' || r === 'expense_payment') return 'expense';
  if (r === 'transfer') return 'transfer';
  if (r === 'opening_balance' || r === 'opening_stock') return 'opening_balance';
  if (r === 'sale_return') return 'sale_return';
  if (r === 'journal' || r === 'manual_journal' || r === 'general_journal') return 'journal_manual';
  return 'general';
}

export function sourceLabel(kind: EntrySourceKind): string {
  const labels: Record<EntrySourceKind, string> = {
    sale: 'Sale',
    sale_reversal: 'Sale cancel',
    purchase: 'Purchase',
    purchase_reversal: 'Purchase cancel',
    payment_supplier: 'Supplier payment',
    payment_worker: 'Worker payment',
    payment_customer: 'Customer receipt',
    studio_stage: 'Studio stage',
    studio_stage_reversal: 'Studio reversal',
    rental: 'Rental',
    expense: 'Expense',
    transfer: 'Transfer',
    opening_balance: 'Opening balance',
    sale_return: 'Sale return',
    journal_manual: 'Manual JE',
    general: 'Journal',
  };
  return labels[kind] ?? 'Journal';
}

function summarizeJournalLines(lines: JournalEntryLineRow[] | undefined): {
  lineCount: number;
  debitAccount: string;
  creditAccount: string;
  accountsSummary: string;
} {
  const raw = lines ?? [];
  const lineCount = raw.length;
  if (lineCount === 0) {
    return { lineCount: 0, debitAccount: '—', creditAccount: '—', accountsSummary: 'No lines' };
  }

  const named = (l: JournalEntryLineRow) =>
    l.account?.name?.trim() ||
    (l.account && typeof (l.account as { code?: string }).code === 'string'
      ? String((l.account as { code?: string }).code)
      : 'Account');

  if (lineCount <= 2) {
    const debitLine = raw.find((l) => Number(l.debit || 0) > 0);
    const creditLine = raw.find((l) => Number(l.credit || 0) > 0);
    const d = debitLine ? named(debitLine) : '—';
    const c = creditLine ? named(creditLine) : '—';
    return {
      lineCount,
      debitAccount: d,
      creditAccount: c,
      accountsSummary: `${d} → ${c}`,
    };
  }

  let maxDr = 0;
  let maxCr = 0;
  let maxDrName = '—';
  let maxCrName = '—';
  for (const l of raw) {
    const dr = Number(l.debit || 0);
    const cr = Number(l.credit || 0);
    if (dr > maxDr) {
      maxDr = dr;
      maxDrName = named(l);
    }
    if (cr > maxCr) {
      maxCr = cr;
      maxCrName = named(l);
    }
  }
  return {
    lineCount,
    debitAccount: maxDrName,
    creditAccount: maxCrName,
    accountsSummary: `${lineCount} lines · ${maxDrName} / ${maxCrName} (largest)`,
  };
}

/**
 * Classify an entry as cash-in (green) vs cash-out (red) using the broad reference type
 * semantics. Supplier / worker payments and expenses flow OUT; transfers are neutral; a
 * general entry is best classified by comparing cash/bank account movement, but since
 * the dashboard row only surfaces the summed amount we infer direction from type.
 */
function entryDirection(type: AccountEntry['type'], sourceKind?: EntrySourceKind): 'in' | 'out' | 'neutral' {
  if (sourceKind === 'sale_reversal' || sourceKind === 'purchase_reversal' || sourceKind === 'studio_stage_reversal') {
    return 'neutral';
  }
  if (type === 'supplier-payment' || type === 'worker-payment' || type === 'expense') return 'out';
  if (type === 'transfer') return 'neutral';
  return 'in';
}

type EntryDisplayConfig = { label: string; color: string; bg: string; icon: LucideIcon };

/** Shared with AccountsModule entry detail header. */
export function getAccountEntryDisplayConfig(entry: AccountEntry): EntryDisplayConfig {
  const k = entry.sourceKind ?? classifySource(String(entry.referenceType || ''), entry.paymentId ?? null);
  const lbl = entry.sourceLabel ?? sourceLabel(k);
  if (k === 'sale') return { label: lbl, color: 'text-[#60A5FA]', bg: 'bg-[#3B82F6]/15', icon: BookOpen };
  if (k === 'sale_reversal') return { label: lbl, color: 'text-[#FBBF24]', bg: 'bg-[#D97706]/20', icon: BookOpen };
  if (k === 'purchase' || k === 'purchase_reversal') return { label: lbl, color: 'text-[#FB923C]', bg: 'bg-[#EA580C]/15', icon: Receipt };
  if (k === 'studio_stage' || k === 'studio_stage_reversal') {
    return { label: lbl, color: 'text-[#C4B5FD]', bg: 'bg-[#7C3AED]/20', icon: BookOpen };
  }
  if (k === 'payment_customer') return { label: lbl, color: 'text-[#34D399]', bg: 'bg-[#059669]/20', icon: Wallet };
  if (k === 'payment_worker') return { label: lbl, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', icon: Wrench };
  if (k === 'payment_supplier') return { label: lbl, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', icon: Users };
  if (k === 'rental') return { label: lbl, color: 'text-[#A78BFA]', bg: 'bg-[#6D28D9]/20', icon: BookOpen };
  if (k === 'expense') return { label: lbl, color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', icon: Receipt };
  if (k === 'transfer') return { label: lbl, color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', icon: ArrowLeftRight };
  if (k === 'opening_balance' || k === 'journal_manual') {
    return { label: lbl, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10', icon: BookOpen };
  }
  switch (entry.type) {
    case 'transfer':
      return { label: 'Transfer', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', icon: ArrowLeftRight };
    case 'supplier-payment':
      return { label: 'Supplier Payment', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', icon: Users };
    case 'worker-payment':
      return { label: 'Worker Payment', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', icon: Wrench };
    case 'expense':
      return { label: 'Expense', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', icon: Receipt };
      default:
        return { label: lbl, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10', icon: BookOpen };
  }
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

  const loadDashboardData = async () => {
    if (!companyId) return;
    setLoading(true);
    const [jeRes, accRes] = await Promise.all([
      getJournalEntries(companyId, branchId, 30),
      getAccounts(companyId),
    ]);
    if (jeRes.error) {
      setEntries([]);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const mapped: AccountEntry[] = jeRes.data.map((e) => {
        const sourceKind = classifySource(e.reference_type, e.payment_id);
        const { lineCount, debitAccount, creditAccount, accountsSummary } = summarizeJournalLines(
          e.lines as JournalEntryLineRow[] | undefined
        );
        const amt = e.total_debit || e.total_credit || 0;
        const postedAt = e.posted_at || e.created_at || null;
        return {
          id: e.id,
          entryNumber: e.entry_no,
          type: mapReferenceTypeToEntryType(e.reference_type),
          date: e.entry_date,
          description: e.description,
          amount: amt,
          debitAccount,
          creditAccount,
          accountsSummary,
          lineCount,
          sourceKind,
          sourceLabel: sourceLabel(sourceKind),
          postedAt,
          addedBy: user.name,
          addedByRole: user.role,
          createdAt: postedAt || e.entry_date,
          status: 'posted' as const,
          referenceType: e.reference_type,
          referenceId: e.reference_id,
          paymentId: e.payment_id ?? null,
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
  };

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      await loadDashboardData();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [companyId, branchId, user.name, user.role]);

  useEffect(() => {
    if (!companyId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onInvalidated = (event: Event) => {
      const detail = (event as CustomEvent<MobileInvalidationDetail>).detail;
      if (
        !shouldAcceptMobileInvalidation(detail, {
          domain: ['accounting', 'sales', 'purchases', 'contacts'],
          companyId,
          branchId: branchId ?? null,
        })
      ) {
        return;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void loadDashboardData();
      }, 240);
    };
    window.addEventListener(MOBILE_DATA_INVALIDATED_EVENT, onInvalidated as EventListener);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(MOBILE_DATA_INVALIDATED_EVENT, onInvalidated as EventListener);
    };
  }, [branchId, companyId, user.name, user.role]);

  const getEntryTypeConfig = (entry: AccountEntry) => getAccountEntryDisplayConfig(entry);

  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.entryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (entry.sourceLabel || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (entry.accountsSummary || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
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
              const typeConfig = getEntryTypeConfig(entry);
              const TypeIcon = typeConfig.icon;
              const direction = entryDirection(entry.type, entry.sourceKind);
              const DirIcon = direction === 'out' ? ArrowUpRight : direction === 'in' ? ArrowDownLeft : ArrowLeftRight;
              const dirColor = direction === 'out' ? 'text-[#EF4444]' : direction === 'in' ? 'text-[#10B981]' : 'text-[#93C5FD]';
              const postedShort = entry.postedAt
                ? new Date(entry.postedAt).toLocaleString('en-PK', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';
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
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-semibold text-white truncate">{entry.entryNumber}</p>
                        <span className={`px-2 py-0.5 ${typeConfig.bg} ${typeConfig.color} rounded text-[10px] font-medium shrink-0`}>
                          {typeConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#D1D5DB] truncate">{entry.description}</p>
                      <p className="text-[10px] text-[#6B7280] mt-0.5 break-words">
                        {entry.accountsSummary}
                        {' · '}
                        <span className="text-[#9CA3AF]">Entry date {entry.date}</span>
                        {postedShort ? (
                          <>
                            {' · '}
                            <span className="text-[#9CA3AF]">Posted {postedShort}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`flex items-center gap-1 justify-end ${dirColor}`}>
                        <DirIcon size={14} />
                        <p className="text-sm font-bold">Rs. {entry.amount.toLocaleString()}</p>
                      </div>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">
                        {direction === 'out' ? 'Out' : direction === 'in' ? 'In' : 'Net'}
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
