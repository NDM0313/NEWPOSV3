import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  BookOpen,
  ArrowLeftRight,
  Users,
  Wrench,
  Truck,
  Receipt,
  BarChart3,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  BookMarked,
  ArrowUpRight,
  ArrowDownLeft,
  ScanText,
  type LucideIcon,
} from 'lucide-react';
import type { User } from '../../types';
import { useResponsive } from '../../hooks/useResponsive';
import { getJournalEntries, getAccounts, type JournalEntryLineRow } from '../../api/accounts';
import { MOBILE_DATA_INVALIDATED_EVENT, shouldAcceptMobileInvalidation, type MobileInvalidationDetail } from '../../lib/dataInvalidationBus';
import { localNowDateString } from '../../utils/localDate';
import {
  type EntrySourceKind,
  type PaymentType,
  classifyJournalSource,
  resolveCashFlowDirection,
  cashFlowDirectionLabel,
  sourceLabel,
} from '../../lib/cashFlowDirection';
import { duplicateViewForSourceKind } from '../../lib/duplicateEntryRouting';
import { usePermissions } from '../../context/PermissionContext';
import { useAccountingAttachmentActions } from '../../hooks/useAccountingAttachmentActions';
import { AttachmentIndicatorButton } from '../shared/AttachmentIndicatorButton';
import { LongPressCard } from '../common/LongPressCard';
import { allowsDayBookUnifiedEdit } from '../../lib/journalEntryEditPolicy';

export type { EntrySourceKind };
export { sourceLabel };

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
  paymentNotes?: string | null;
  paymentType?: PaymentType | null;
  paymentReferenceNumber?: string | null;
  hasAttachments?: boolean;
}

export type AccountsDashboardMode = 'full' | 'party';

interface AccountsDashboardProps {
  user: User;
  companyId?: string | null;
  branchId?: string | null;
  mode?: AccountsDashboardMode;
  onGeneralEntry: () => void;
  onAccountTransfer: () => void;
  onSupplierPayment: () => void;
  onClientPayment: () => void;
  onWorkerPayment: () => void;
  onCourierPayment: () => void;
  onExpenseEntry: () => void;
  onScanReceipt?: () => void;
  onViewReports: () => void;
  onChartOfAccounts: () => void;
  onEntryClick: (entry: AccountEntry) => void;
  onMyActivity?: () => void;
  /** Long-press Duplicate — parent routes by sourceKind. */
  onDuplicateEntry?: (entry: AccountEntry) => void;
}

function mapReferenceTypeToEntryType(ref: string): AccountEntry['type'] {
  const r = (ref || '').toLowerCase();
  if (r === 'transfer') return 'transfer';
  if (r === 'payment' || r === 'manual_payment') return 'supplier-payment';
  if (r === 'worker_payment') return 'worker-payment';
  if (r === 'expense' || r === 'expense_payment') return 'expense';
  return 'general';
}

export function classifySource(
  referenceType: string,
  paymentId: string | null | undefined,
  paymentType?: string | null,
  paymentReferenceNumber?: string | null,
): EntrySourceKind {
  return classifyJournalSource({
    referenceType,
    paymentId,
    paymentType,
    paymentReferenceNumber,
  });
}

export function entryDirection(entry: AccountEntry): 'in' | 'out' | 'neutral' {
  const sourceKind =
    entry.sourceKind ??
    classifySource(
      String(entry.referenceType || ''),
      entry.paymentId ?? null,
      entry.paymentType,
      entry.paymentReferenceNumber ?? entry.entryNumber,
    );
  return resolveCashFlowDirection({ paymentType: entry.paymentType, sourceKind });
}

export { cashFlowDirectionLabel };

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

type EntryDisplayConfig = { label: string; color: string; bg: string; icon: LucideIcon };

/** Shared with AccountsModule entry detail header. */
export function getAccountEntryDisplayConfig(entry: AccountEntry): EntryDisplayConfig {
  const k =
    entry.sourceKind ??
    classifySource(
      String(entry.referenceType || ''),
      entry.paymentId ?? null,
      entry.paymentType,
      entry.paymentReferenceNumber ?? entry.entryNumber,
    );
  const lbl = entry.sourceLabel ?? sourceLabel(k);
  if (k === 'sale') return { label: lbl, color: 'text-[#60A5FA]', bg: 'bg-[#3B82F6]/15', icon: BookOpen };
  if (k === 'sale_reversal') return { label: lbl, color: 'text-[#FBBF24]', bg: 'bg-[#D97706]/20', icon: BookOpen };
  if (k === 'purchase' || k === 'purchase_reversal') return { label: lbl, color: 'text-[#FB923C]', bg: 'bg-[#EA580C]/15', icon: Receipt };
  if (k === 'studio_stage' || k === 'studio_stage_reversal') {
    return { label: lbl, color: 'text-[#C4B5FD]', bg: 'bg-[#7C3AED]/20', icon: BookOpen };
  }
  if (k === 'payment_customer') return { label: lbl, color: 'text-[#34D399]', bg: 'bg-[#059669]/20', icon: Wallet };
  if (k === 'payment_worker') return { label: lbl, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', icon: Wrench };
  if (k === 'payment_courier') return { label: lbl, color: 'text-[#A5B4FC]', bg: 'bg-[#6366F1]/20', icon: Truck };
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
  mode = 'full',
  onGeneralEntry,
  onAccountTransfer,
  onSupplierPayment,
  onClientPayment,
  onWorkerPayment,
  onCourierPayment,
  onExpenseEntry,
  onScanReceipt,
  onViewReports,
  onChartOfAccounts,
  onEntryClick,
  onMyActivity,
  onDuplicateEntry,
}: AccountsDashboardProps) {
  useResponsive();
  const { canViewBalances } = usePermissions();
  const attachmentActions = useAccountingAttachmentActions(companyId ?? null, branchId);
  const isPartyMode = mode === 'party';
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [stats, setStats] = useState({ todayEntries: 0, totalAmount: 0, cashBalance: 0, bankBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [duplicateHint, setDuplicateHint] = useState<string | null>(null);

  const loadDashboardData = async () => {
    if (isPartyMode) {
      setLoading(false);
      return;
    }
    if (!companyId) return;
    setLoading(true);
    const [jeRes, accRes] = await Promise.all([
      getJournalEntries(companyId, branchId, 30),
      getAccounts(companyId),
    ]);
    if (jeRes.error) {
      setEntries([]);
    } else {
      const today = localNowDateString();
      const mapped: AccountEntry[] = jeRes.data.map((e) => {
        const paymentRef =
          e.payment_reference_number && String(e.payment_reference_number).trim()
            ? String(e.payment_reference_number).trim()
            : null;
        const expenseDocNo =
          e.display_expense_no && String(e.display_expense_no).trim()
            ? String(e.display_expense_no).trim()
            : null;
        const sourceKind = classifySource(
          e.reference_type,
          e.payment_id,
          e.payment_type,
          paymentRef,
        );
        const { lineCount, debitAccount, creditAccount, accountsSummary } = summarizeJournalLines(
          e.lines as JournalEntryLineRow[] | undefined
        );
        const amt = e.total_debit || e.total_credit || 0;
        const postedAt = e.posted_at || e.created_at || null;
        return {
          id: e.id,
          entryNumber:
            String(e.reference_type || '').toLowerCase().replace(/\s+/g, '_') === 'expense' && expenseDocNo
              ? expenseDocNo
              : paymentRef || e.entry_no,
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
          paymentNotes: e.payment_notes ?? null,
          paymentType: e.payment_type ?? null,
          paymentReferenceNumber: paymentRef,
          hasAttachments: e.hasAttachments ?? false,
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
    if (!companyId || isPartyMode) return;
    let cancelled = false;
    (async () => {
      await loadDashboardData();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [companyId, branchId, user.name, user.role, isPartyMode]);

  useEffect(() => {
    if (!companyId || isPartyMode) return;
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
  }, [branchId, companyId, user.name, user.role, isPartyMode]);

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
    if (!canViewBalances) return '****';
    if (Math.abs(n) >= 1_000_000) return `Rs. ${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `Rs. ${(n / 1_000).toFixed(0)}k`;
    return `Rs. ${n.toLocaleString()}`;
  };

  if (isPartyMode) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#9CA3AF] px-1">
          Payments you received or paid, and expenses you posted. Company-wide ledgers are not available for your role.
        </p>
        {onMyActivity && (
          <ActionButton
            icon={Clock}
            label="My Activity"
            color="from-[#6366F1] to-[#4F46E5]"
            onClick={onMyActivity}
          />
        )}
      </div>
    );
  }

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
          <p className="text-2xl font-bold text-white">{stats.todayEntries}</p>
          <p className="text-xs text-[#6B7280]">Entries</p>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-[#10B981]/15 to-[#1F2937] border border-[#10B981]/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#10B981]/25 rounded-lg flex items-center justify-center">
              <Wallet size={16} className="text-[#6EE7B7]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">Cash</p>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.cashBalance)}</p>
          <p className="text-xs text-[#6B7280]">Available</p>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-[#3B82F6]/15 to-[#1F2937] border border-[#3B82F6]/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#3B82F6]/25 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-[#93C5FD]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">Bank</p>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.bankBalance)}</p>
          <p className="text-xs text-[#6B7280]">Balance</p>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-[#F59E0B]/15 to-[#1F2937] border border-[#F59E0B]/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#F59E0B]/25 rounded-lg flex items-center justify-center">
              <TrendingDown size={16} className="text-[#FCD34D]" />
            </div>
            <p className="text-xs text-[#9CA3AF]">30 Day</p>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.totalAmount)}</p>
          <p className="text-xs text-[#6B7280]">Volume</p>
        </div>
      </div>

      {/* Quick actions — horizontal scroll pills with colored halo on the icon only */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3 px-1">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {onScanReceipt && (
            <ActionButton
              icon={ScanText}
              label="Scan Receipt"
              color="from-[#0EA5E9] to-[#0284C7]"
              onClick={onScanReceipt}
            />
          )}
          <ActionButton icon={BookOpen} label="General Entry" color="from-[#8B5CF6] to-[#7C3AED]" onClick={onGeneralEntry} />
          <ActionButton icon={ArrowLeftRight} label="Account Transfer" color="from-[#3B82F6] to-[#2563EB]" onClick={onAccountTransfer} />
          <ActionButton icon={Users} label="Supplier Payment" color="from-[#F59E0B] to-[#D97706]" onClick={onSupplierPayment} />
          <ActionButton icon={ArrowDownLeft} label="Client Payment" color="from-[#3B82F6] to-[#2563EB]" onClick={onClientPayment} />
          <ActionButton icon={Wrench} label="Worker Payment" color="from-[#10B981] to-[#059669]" onClick={onWorkerPayment} />
          <ActionButton icon={Truck} label="Courier Payment" color="from-[#6366F1] to-[#4F46E5]" onClick={onCourierPayment} />
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
              const direction = entryDirection(entry);
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
              const canAddAttachment = allowsDayBookUnifiedEdit(
                entry.referenceType ?? '',
                entry.paymentId ?? null,
              );
              const rowAttachParams = {
                journalEntryId: entry.id,
                paymentId: entry.paymentId,
                referenceType: entry.referenceType,
                referenceId: entry.referenceId,
                hasAttachments: entry.hasAttachments,
              };
              return (
                <LongPressCard
                  key={entry.id}
                  onTap={() => onEntryClick(entry)}
                  customMenuItems={attachmentActions.buildLongPressMenuItems(rowAttachParams, {
                    canAdd: canAddAttachment,
                  })}
                  canEdit={false}
                  canDelete={false}
                  onDuplicate={
                    onDuplicateEntry && duplicateViewForSourceKind(entry.sourceKind)
                      ? () => onDuplicateEntry(entry)
                      : onDuplicateEntry
                        ? () => {
                            setDuplicateHint('This entry type cannot be duplicated.');
                            window.setTimeout(() => setDuplicateHint(null), 2800);
                          }
                        : undefined
                  }
                >
                  <div className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-xl p-3 hover:border-[#8B5CF6] transition-all active:scale-[0.99] cursor-pointer">
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
                      <div className="flex items-center gap-1 justify-end">
                        {attachmentActions.hasAnyAttachmentHint(rowAttachParams) && companyId ? (
                          <AttachmentIndicatorButton
                            onClick={() => void attachmentActions.previewAttachments(rowAttachParams)}
                            size="sm"
                          />
                        ) : null}
                        <div className={`flex items-center gap-1 ${dirColor}`}>
                          <DirIcon size={14} />
                          <p className="text-base font-bold">Rs. {entry.amount.toLocaleString()}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">
                        {cashFlowDirectionLabel(direction)}
                      </p>
                    </div>
                  </div>
                  </div>
                </LongPressCard>
              );
            })}
          </div>
        )}
      </div>

      {attachmentActions.AttachmentPreviewPortal}
      {attachmentActions.AddAttachmentSheetPortal}
      {attachmentActions.ToastBanner}
      {duplicateHint ? (
        <div className="fixed bottom-28 left-4 right-4 z-[120] mx-auto max-w-md p-3 rounded-lg bg-amber-500/90 text-[#111827] text-sm shadow-lg">
          {duplicateHint}
        </div>
      ) : null}
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
