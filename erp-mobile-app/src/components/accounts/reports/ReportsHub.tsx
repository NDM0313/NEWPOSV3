import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  Wallet,
  Landmark,
  Smartphone,
  Receipt,
  ShoppingCart,
  TrendingDown,
  Palette,
  Shirt,
  Package,
  ChevronRight,
  Users,
  Briefcase,
  ListFilter,
} from 'lucide-react';
import { getPaymentTransactions, type TransactionRow } from '../../../api/transactions';
import { ReportHeader } from './_shared/ReportHeader';
import { TransactionsTimeline } from './TransactionsTimeline';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { formatAmount } from './_shared/format';

export type LegacyReportKey =
  // party ledgers
  | 'customer-ledger'
  | 'supplier-ledger'
  | 'worker-ledger'
  // accounts
  | 'account-ledger'
  | 'daybook'
  | 'cash-summary'
  | 'bank-summary'
  | 'wallet-summary'
  | 'payables'
  | 'receivables'
  // operational
  | 'sales-report'
  | 'studio-sales'
  | 'purchase-report'
  | 'expense-report'
  | 'studio-report'
  | 'rental-report'
  | 'inventory-report';

interface ReportsHubProps {
  onBack: () => void;
  onOpenReport: (key: LegacyReportKey, opts?: { partyId?: string | null; accountId?: string | null; partyName?: string | null }) => void;
  companyId: string | null;
  branchId?: string | null;
  onNavigateToDocumentEdit?: (kind: 'sale' | 'purchase', documentId: string) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsHub({ onBack, onOpenReport, companyId, branchId, onNavigateToDocumentEdit }: ReportsHubProps) {
  const [view, setView] = useState<'hub' | 'timeline'>('hub');
  const [todayRows, setTodayRows] = useState<TransactionRow[]>([]);
  const [recentRows, setRecentRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const today = todayIso();
      const [todayRes, recentRes] = await Promise.all([
        getPaymentTransactions({ companyId, branchId: branchId ?? undefined, startDate: today, endDate: today, limit: 200 }),
        getPaymentTransactions({ companyId, branchId: branchId ?? undefined, limit: 8 }),
      ]);
      if (cancelled) return;
      setTodayRows(todayRes.data || []);
      setRecentRows(recentRes.data || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  const todayStats = useMemo(() => {
    let received = 0;
    let paid = 0;
    todayRows.forEach((r) => {
      if (r.direction === 'received') received += r.amount;
      else paid += r.amount;
    });
    return { received, paid, net: received - paid, count: todayRows.length };
  }, [todayRows]);

  if (view === 'timeline') {
    return (
      <TransactionsTimeline
        companyId={companyId}
        branchId={branchId}
        onBack={() => setView('hub')}
        onViewLedger={({ accountId }) => onOpenReport('account-ledger', { accountId })}
        onNavigateToDocumentEdit={onNavigateToDocumentEdit}
      />
    );
  }

  const headerStats = [
    { label: 'Received', value: `Rs. ${formatAmount(todayStats.received, 0)}`, color: 'text-[#BBF7D0]' },
    { label: 'Paid', value: `Rs. ${formatAmount(todayStats.paid, 0)}`, color: 'text-[#FCA5A5]' },
    { label: 'Net', value: `Rs. ${formatAmount(todayStats.net, 0)}` },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Reports"
        subtitle="Unified financial activity & statements"
        stats={loading ? undefined : headerStats}
      />

      <div className="p-4 space-y-5">
        <button
          onClick={() => setView('timeline')}
          className="w-full bg-gradient-to-br from-[#1F2937] to-[#111827] border border-[#374151] hover:border-[#6366F1] rounded-2xl p-4 text-left transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Transactions Timeline</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                All payments with date, time, from → to accounts, party & amount.
              </p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-[#6B7280]">
                <ListFilter className="w-3 h-3" /> Filters: date · direction · method · account
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#6B7280] shrink-0 mt-1" />
          </div>
        </button>

        <Section title="Recent transactions" right={
          <button onClick={() => setView('timeline')} className="text-xs text-[#6366F1] hover:underline">
            See all
          </button>
        }>
          {loading ? null : recentRows.length === 0 ? (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 text-center">
              <p className="text-sm text-[#9CA3AF]">No transactions yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentRows.slice(0, 5).map((t) => (
                <MiniTxRow key={t.id} tx={t} onClick={() => setDetailId(t.id)} />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Party ledgers">
          <div className="grid grid-cols-2 gap-3">
            <ReportTile
              title="Customer Ledger"
              description="Per-customer AR statement"
              gradient="from-[#6366F1] to-[#4F46E5]"
              icon={<Users className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('customer-ledger')}
            />
            <ReportTile
              title="Supplier Ledger"
              description="Per-supplier AP statement"
              gradient="from-[#F59E0B] to-[#D97706]"
              icon={<Briefcase className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('supplier-ledger')}
            />
            <ReportTile
              title="Worker Ledger"
              description="Payables to workers"
              gradient="from-[#10B981] to-[#059669]"
              icon={<Users className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('worker-ledger')}
            />
            <ReportTile
              title="Account Ledger"
              description="Running balance per GL"
              gradient="from-[#8B5CF6] to-[#6366F1]"
              icon={<BookOpen className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('account-ledger')}
            />
          </div>
        </Section>

        <Section title="Cash & bank">
          <div className="grid grid-cols-2 gap-3">
            <ReportTile
              title="Cash Summary"
              description="Cash account movements"
              gradient="from-[#10B981] to-[#059669]"
              icon={<Wallet className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('cash-summary')}
            />
            <ReportTile
              title="Bank Summary"
              description="Bank account activity"
              gradient="from-[#0EA5E9] to-[#0284C7]"
              icon={<Landmark className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('bank-summary')}
            />
            <ReportTile
              title="Wallet Summary"
              description="Mobile wallets"
              gradient="from-[#F97316] to-[#C2410C]"
              icon={<Smartphone className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('wallet-summary')}
            />
            <ReportTile
              title="Day Book / Roznamcha"
              description="Daily cash-in / cash-out"
              gradient="from-[#3B82F6] to-[#2563EB]"
              icon={<CalendarClock className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('daybook')}
            />
          </div>
        </Section>

        <Section title="Receivables & payables">
          <div className="grid grid-cols-2 gap-3">
            <ReportTile
              title="Receivables"
              description="Customer outstanding + aging"
              gradient="from-[#EC4899] to-[#DB2777]"
              icon={<ArrowDownLeft className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('receivables')}
            />
            <ReportTile
              title="Payables"
              description="Supplier dues + aging"
              gradient="from-[#F59E0B] to-[#D97706]"
              icon={<ArrowUpRight className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('payables')}
            />
          </div>
        </Section>

        <Section title="Operations">
          <div className="grid grid-cols-2 gap-3">
            <ReportTile
              title="Sales Report"
              description="Invoice & revenue activity"
              gradient="from-[#6366F1] to-[#4F46E5]"
              icon={<Receipt className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('sales-report')}
            />
            <ReportTile
              title="Purchase Report"
              description="Purchase orders / GRNs"
              gradient="from-[#F59E0B] to-[#D97706]"
              icon={<ShoppingCart className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('purchase-report')}
            />
            <ReportTile
              title="Expense Report"
              description="Expenses by category"
              gradient="from-[#F43F5E] to-[#E11D48]"
              icon={<TrendingDown className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('expense-report')}
            />
            <ReportTile
              title="Studio Report"
              description="Custom productions"
              gradient="from-[#8B5CF6] to-[#7C3AED]"
              icon={<Palette className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('studio-report')}
            />
            <ReportTile
              title="Rental Report"
              description="Rental bookings"
              gradient="from-[#F97316] to-[#C2410C]"
              icon={<Shirt className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('rental-report')}
            />
            <ReportTile
              title="Inventory Report"
              description="Stock movements (in / out)"
              gradient="from-[#475569] to-[#1E293B]"
              icon={<Package className="w-5 h-5 text-white" />}
              onClick={() => onOpenReport('inventory-report')}
            />
          </div>
        </Section>
      </div>

      {detailId && companyId && (
        <TransactionDetailSheet
          paymentId={detailId}
          companyId={companyId}
          onClose={() => setDetailId(null)}
          onViewLedger={({ accountId }) => {
            setDetailId(null);
            onOpenReport('account-ledger', { accountId });
          }}
        />
      )}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function ReportTile({
  title,
  description,
  gradient,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  gradient: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-[#1F2937] border border-[#374151] rounded-xl p-3.5 text-left hover:border-[#6366F1] transition-colors"
    >
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-2`}>{icon}</div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-[11px] text-[#9CA3AF] mt-0.5">{description}</p>
    </button>
  );
}

function MiniTxRow({ tx, onClick }: { tx: TransactionRow; onClick: () => void }) {
  const isReceived = tx.direction === 'received';
  const iconBg = isReceived ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]';
  const Icon = isReceived ? ArrowDownLeft : ArrowUpRight;
  const amountColor = isReceived ? 'text-[#10B981]' : 'text-[#EF4444]';
  const time = tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-left hover:border-[#6366F1] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{tx.partyName || tx.partyAccountName || tx.referenceType}</p>
            <p className="text-[11px] text-[#9CA3AF] truncate">
              {tx.paymentAccountName || '—'} {isReceived ? '→' : '←'} {tx.partyAccountName || tx.partyName || '—'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-bold ${amountColor}`}>
              {isReceived ? '+' : '−'} Rs. {formatAmount(tx.amount, 0)}
            </p>
            <p className="text-[11px] text-[#9CA3AF]">{time}</p>
          </div>
        </div>
      </button>
    </li>
  );
}
