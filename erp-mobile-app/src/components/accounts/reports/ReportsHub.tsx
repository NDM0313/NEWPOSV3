import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  Truck,
  Scale,
  TrendingUp,
  BarChart3,
  Layers,
} from 'lucide-react';
import { getPaymentTransactions, type TransactionRow } from '../../../api/transactions';
import { ReportHeader } from './_shared/ReportHeader';
import { TransactionsTimeline } from './TransactionsTimeline';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { formatAmount } from './_shared/format';
import { formatPaymentDateTime } from '../../../utils/transactionDisplayDate';
import { useAccountingAttachmentActions } from '../../../hooks/useAccountingAttachmentActions';
import { AttachmentIndicatorButton } from '../../shared/AttachmentIndicatorButton';
import { LongPressCard } from '../../common/LongPressCard';
import { canEditTransaction } from '../../../api/transactions';
import { TransactionActivityRow } from './_shared/TransactionActivityRow';
import {
  resolveCopyPrefillFromTransactionRow,
  type CopyTransactionPrefill,
} from '../../../lib/copyTransactionPrefill';
import { Copy } from 'lucide-react';
import {
  type LegacyReportKey,
  type ReportHubMode,
  type ReportHubSection,
  type ReportCatalogEntry,
  type ReportIconKey,
  REPORT_SECTION_LABELS,
  reportsBySection,
} from '../../../lib/reportsHubCatalog';

export type { LegacyReportKey, ReportHubMode };

const SECTION_ORDER: ReportHubSection[] = [
  'party-ledgers',
  'financial-statements',
  'cash-bank',
  'receivables-payables',
  'operations',
];

const REPORT_ICONS: Record<ReportIconKey, ReactNode> = {
  users: <Users className="w-5 h-5 text-white" />,
  briefcase: <Briefcase className="w-5 h-5 text-white" />,
  'book-open': <BookOpen className="w-5 h-5 text-white" />,
  scale: <Scale className="w-5 h-5 text-white" />,
  'trending-up': <TrendingUp className="w-5 h-5 text-white" />,
  'bar-chart': <BarChart3 className="w-5 h-5 text-white" />,
  wallet: <Wallet className="w-5 h-5 text-white" />,
  layers: <Layers className="w-5 h-5 text-white" />,
  landmark: <Landmark className="w-5 h-5 text-white" />,
  smartphone: <Smartphone className="w-5 h-5 text-white" />,
  'calendar-clock': <CalendarClock className="w-5 h-5 text-white" />,
  'arrow-down-left': <ArrowDownLeft className="w-5 h-5 text-white" />,
  'arrow-up-right': <ArrowUpRight className="w-5 h-5 text-white" />,
  receipt: <Receipt className="w-5 h-5 text-white" />,
  'shopping-cart': <ShoppingCart className="w-5 h-5 text-white" />,
  'trending-down': <TrendingDown className="w-5 h-5 text-white" />,
  palette: <Palette className="w-5 h-5 text-white" />,
  shirt: <Shirt className="w-5 h-5 text-white" />,
  package: <Package className="w-5 h-5 text-white" />,
  truck: <Truck className="w-5 h-5 text-white" />,
};

interface ReportsHubProps {
  onBack: () => void;
  onOpenReport: (
    key: LegacyReportKey,
    opts?: { partyId?: string | null; accountId?: string | null; partyName?: string | null },
  ) => void;
  companyId: string | null;
  branchId?: string | null;
  onNavigateToDocumentEdit?: (kind: 'sale' | 'purchase', documentId: string) => void;
  reportRefreshEpoch?: number;
  fullAccounting?: boolean;
  canViewCustomerLedger?: boolean;
  canViewSupplierLedger?: boolean;
  hubMode: ReportHubMode;
  onHubModeChange: (mode: ReportHubMode) => void;
  onCopyTransaction?: (prefill: CopyTransactionPrefill) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ReportHubModeToggle({
  mode,
  onChange,
}: {
  mode: ReportHubMode;
  onChange: (mode: ReportHubMode) => void;
}) {
  const options: { id: ReportHubMode; label: string }[] = [
    { id: 'easy', label: 'Easy' },
    { id: 'standard', label: 'Standard' },
    { id: 'advanced', label: 'Advanced' },
  ];
  return (
    <div className="flex rounded-lg border border-white/25 overflow-hidden bg-white/10">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === opt.id ? 'bg-white text-[#4F46E5]' : 'text-white/90 hover:bg-white/10'
          } ${opt.id !== 'easy' ? 'border-l border-white/20' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ReportsHub({
  onBack,
  onOpenReport,
  companyId,
  branchId,
  onNavigateToDocumentEdit,
  reportRefreshEpoch = 0,
  fullAccounting = true,
  canViewCustomerLedger = true,
  canViewSupplierLedger = false,
  hubMode,
  onHubModeChange,
  onCopyTransaction,
}: ReportsHubProps) {
  const [view, setView] = useState<'hub' | 'timeline'>('hub');
  const [todayRows, setTodayRows] = useState<TransactionRow[]>([]);
  const [recentRows, setRecentRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const attachmentActions = useAccountingAttachmentActions(companyId, branchId);

  const catalogSections = useMemo(
    () =>
      reportsBySection(hubMode, {
        fullAccounting,
        canViewCustomerLedger,
        canViewSupplierLedger,
      }),
    [hubMode, fullAccounting, canViewCustomerLedger, canViewSupplierLedger],
  );

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    if (!fullAccounting) {
      setLoading(false);
      setTodayRows([]);
      setRecentRows([]);
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
  }, [companyId, branchId, reportRefreshEpoch, fullAccounting]);

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
        reportRefreshEpoch={reportRefreshEpoch}
        companyId={companyId}
        branchId={branchId}
        onBack={() => setView('hub')}
        onViewLedger={({ accountId }) => onOpenReport('account-ledger', { accountId })}
        onNavigateToDocumentEdit={onNavigateToDocumentEdit}
        onCopyTransaction={onCopyTransaction}
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
        subtitle={
          hubMode === 'easy'
            ? 'Daily cash & customer activity'
            : hubMode === 'advanced'
              ? 'Full financial statements & operations'
              : 'Unified financial activity & statements'
        }
        stats={loading ? undefined : headerStats}
      >
        <ReportHubModeToggle mode={hubMode} onChange={onHubModeChange} />
      </ReportHeader>

      <div className="p-4 space-y-5">
        {fullAccounting && (
          <>
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

            <Section
              title="Recent transactions"
              right={
                <button onClick={() => setView('timeline')} className="text-xs text-[#6366F1] hover:underline">
                  See all
                </button>
              }
            >
              {loading ? null : recentRows.length === 0 ? (
                <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 text-center">
                  <p className="text-sm text-[#9CA3AF]">No transactions yet.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {recentRows.slice(0, 5).map((t) => {
                    const editability = canEditTransaction(t.referenceType, 'payment_row');
                    const rowAttachParams = { transactionRow: t };
                    const copyPrefill = resolveCopyPrefillFromTransactionRow(t);
                    const showCopy = Boolean(onCopyTransaction && copyPrefill);
                    return (
                      <LongPressCard
                        key={t.id}
                        onTap={() => setDetailId(t.id)}
                        canEdit={false}
                        canDelete={false}
                        customMenuItems={[
                          ...attachmentActions.buildLongPressMenuItems(rowAttachParams, {
                            canAdd: editability.editable,
                          }),
                          ...(showCopy && copyPrefill
                            ? [
                                {
                                  label: 'Copy transaction',
                                  icon: <Copy className="w-4 h-4" />,
                                  onClick: () => onCopyTransaction!(copyPrefill),
                                  show: true,
                                },
                              ]
                            : []),
                        ]}
                      >
                        <MiniTxRow
                          tx={t}
                          showAttachmentIcon={attachmentActions.hasAnyAttachmentHint({ transactionRow: t })}
                          onAttachmentClick={() => void attachmentActions.previewAttachments(rowAttachParams)}
                        />
                      </LongPressCard>
                    );
                  })}
                </ul>
              )}
            </Section>
          </>
        )}

        {SECTION_ORDER.map((sectionKey) => {
          const tiles = catalogSections[sectionKey];
          if (!tiles?.length) return null;
          return (
            <Section key={sectionKey} title={REPORT_SECTION_LABELS[sectionKey]}>
              <div className="grid grid-cols-2 gap-3">
                {tiles.map((entry) => (
                  <CatalogReportTile key={entry.key} entry={entry} onOpen={() => onOpenReport(entry.key)} />
                ))}
              </div>
            </Section>
          );
        })}
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

      {attachmentActions.AttachmentPreviewPortal}
      {attachmentActions.AddAttachmentSheetPortal}
      {attachmentActions.ToastBanner}
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

function CatalogReportTile({ entry, onOpen }: { entry: ReportCatalogEntry; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="bg-[#1F2937] border border-[#374151] rounded-xl p-3.5 text-left hover:border-[#6366F1] transition-colors"
    >
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${entry.gradient} flex items-center justify-center mb-2`}>
        {REPORT_ICONS[entry.icon]}
      </div>
      <p className="text-sm font-semibold text-white">{entry.title}</p>
      <p className="text-[11px] text-[#9CA3AF] mt-0.5">{entry.description}</p>
    </button>
  );
}

function MiniTxRow({
  tx,
  showAttachmentIcon = false,
  onAttachmentClick,
}: {
  tx: TransactionRow;
  showAttachmentIcon?: boolean;
  onAttachmentClick?: () => void;
}) {
  const time = formatPaymentDateTime(tx.paymentDate, tx.createdAt).time;
  return (
    <li>
      <div className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-3 text-left hover:border-[#6366F1] transition-colors">
        <TransactionActivityRow
          tx={tx}
          timeLabel={time}
          attachmentSlot={
            showAttachmentIcon && onAttachmentClick ? (
              <AttachmentIndicatorButton onClick={() => onAttachmentClick()} size="sm" />
            ) : null
          }
        />
      </div>
    </li>
  );
}
