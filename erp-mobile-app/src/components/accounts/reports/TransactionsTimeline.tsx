import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Search,
  Loader2,
  CalendarDays,
  RefreshCw,
  Share2,
  Copy,
  Ban,
} from 'lucide-react';
import {
  getPaymentTransactions,
  getJournalTimelineEntries,
  type TransactionRow,
  type GetTransactionsFilters,
} from '../../../api/transactions';
import { compareTransactionRowDesc } from '../../../utils/chronologicalSort';
import { getMyExpenseJournalEntries } from '../../../api/myActivity';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { EditTransactionSheet } from './_shared/EditTransactionSheet';
import { canEditTransaction } from '../../../api/transactions';
import {
  canCancelTransactionRow,
  cancelTransactionWithReversal,
  getCancelEligibility,
  resolveJournalEntryIdFromPayment,
  type CancelEligibility,
} from '../../../api/transactionCancel';
import { dispatchMobileAccountingInvalidated } from '../../../lib/dataInvalidationBus';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { TimelinePreviewPdf } from '../../shared/TimelinePreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';
import {
  formatPaymentDateTime,
  formatPaymentDateTimeLine,
  formatEventDateGroupLabel,
  getTransactionEventDateKey,
} from '../../../utils/transactionDisplayDate';
import { TransactionActivityRow } from './_shared/TransactionActivityRow';
import { resolveTimelinePresentation } from '../../../lib/transactionTimelinePresentation';
import {
  DateRangeBar,
  makeInitialRange,
  type DateRangePreset,
  type DateRangeValue,
} from './_shared/DateRangeBar';
import { useAccountingAttachmentActions } from '../../../hooks/useAccountingAttachmentActions';
import { AttachmentIndicatorButton } from '../../shared/AttachmentIndicatorButton';
import { LongPressCard } from '../../common/LongPressCard';
import { ConfirmActionSheet } from '../../common/ConfirmActionSheet';
import {
  resolveCopyPrefillFromTransactionRow,
  type CopyTransactionPrefill,
} from '../../../lib/copyTransactionPrefill';

interface TransactionsTimelineProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  /** When incremented (from parent invalidation), refetch list without remounting. */
  reportRefreshEpoch?: number;
  onViewLedger?: (info: { partyId?: string | null; partyName?: string | null; accountId?: string | null }) => void;
  onNavigateToDocumentEdit?: (kind: 'sale' | 'purchase', documentId: string) => void;
  /** Optional initial filters (e.g. open with only today's payments). */
  initialFilters?: Partial<GetTransactionsFilters>;
  /** Custom header title */
  title?: string;
  /** Optional subtitle under title */
  subtitle?: string;
  /** Optional user for share attribution. */
  userName?: string;
  /** When set, only show rows created by this user (auth uid and/or profile id). */
  scopeUser?: { authId: string; profileId?: string | null };
  /** Merge expense journal entries created by scope user. */
  includeOwnExpenses?: boolean;
  /** Hide edit actions (worker My Activity). */
  readOnly?: boolean;
  /** Presets hidden from DateRangeBar (e.g. My Activity hides week/quarter/year/custom). */
  hideDatePresets?: DateRangePreset[];
  /** Initial date preset; defaults to month. */
  defaultDatePreset?: DateRangePreset;
  onCopyTransaction?: (prefill: CopyTransactionPrefill) => void;
}

function isRowByUser(row: TransactionRow, scope: { authId: string; profileId?: string | null }): boolean {
  const cb = row.createdBy;
  if (!cb) return false;
  if (cb === scope.authId) return true;
  if (scope.profileId && cb === scope.profileId) return true;
  return false;
}

function expenseInDateRange(entryDate: string, from: string, to: string): boolean {
  const d = entryDate.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function expenseToTransactionRow(ex: {
  id: string;
  entryNo: string;
  entryDate: string;
  description: string;
  amount: number;
  referenceType: string;
  createdBy?: string | null;
  createdByName?: string | null;
  expenseId?: string | null;
  categoryLabel?: string | null;
}): TransactionRow {
  const categoryLabel = ex.categoryLabel?.trim() || null;
  return {
    id: `expense-${ex.id}`,
    paymentId: ex.id,
    createdAt: `${ex.entryDate}T12:00:00.000Z`,
    paymentDate: ex.entryDate,
    direction: 'paid',
    referenceType: ex.referenceType || 'expense',
    referenceId: ex.expenseId || ex.id,
    referenceNumber: ex.entryNo,
    amount: ex.amount,
    method: 'other',
    paymentAccountId: null,
    paymentAccountName: null,
    partyAccountId: null,
    partyAccountName: null,
    partyId: null,
    partyName: categoryLabel || ex.description || 'Expense',
    branchId: null,
    branchName: null,
    notes: ex.description,
    journalEntryId: ex.id,
    entryNo: ex.entryNo,
    createdBy: ex.createdBy ?? null,
    createdByName: ex.createdByName ?? null,
    attachments: null,
    expenseCategoryLabel: categoryLabel,
  };
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  other: 'Other',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function displayReference(tx: TransactionRow): string {
  const ref = (tx.referenceNumber || tx.entryNo || '').trim();
  if (!ref || UUID_RE.test(ref)) return tx.referenceType ? tx.referenceType.replace('_', ' ').toUpperCase() : 'TX';
  return ref;
}

function compareTransactionsWithinDay(a: TransactionRow, b: TransactionRow): number {
  return compareTransactionRowDesc(a, b);
}

function groupByDate(rows: TransactionRow[]): Array<{ key: string; label: string; items: TransactionRow[] }> {
  const out: Array<{ key: string; label: string; items: TransactionRow[] }> = [];
  const map: Record<string, TransactionRow[]> = {};
  rows.forEach((r) => {
    const key = getTransactionEventDateKey(r.paymentDate, r.createdAt) || 'unknown';
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });
  Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .forEach((k) => {
      const label = k === 'unknown' ? 'Unknown date' : formatEventDateGroupLabel(k);
      const items = [...map[k]].sort(compareTransactionsWithinDay);
      out.push({ key: k, label, items });
    });
  return out;
}

/** Client-side search mirror (party, reference, notes) — matches API filter fields. */
function matchesTransactionSearch(tx: TransactionRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    tx.partyName,
    tx.partyAccountName,
    tx.paymentAccountName,
    tx.expenseCategoryLabel,
    tx.referenceNumber,
    tx.entryNo,
    tx.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function TransactionsTimeline({
  onBack,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
  onViewLedger,
  onNavigateToDocumentEdit: _onNavigateToDocumentEdit,
  initialFilters,
  title = 'Transactions',
  subtitle,
  userName,
  scopeUser,
  includeOwnExpenses = false,
  readOnly = false,
  hideDatePresets,
  defaultDatePreset = 'currentFinancialYear',
  onCopyTransaction,
}: TransactionsTimelineProps) {
  const preview = usePdfPreview(companyId);
  const attachmentActions = useAccountingAttachmentActions(companyId, branchId);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<'all' | 'received' | 'paid'>(initialFilters?.direction ?? 'all');
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
    const initial = makeInitialRange(defaultDatePreset);
    if (initialFilters?.startDate || initialFilters?.endDate) {
      return {
        from: initialFilters.startDate ?? initial.from,
        to: initialFilters.endDate ?? initial.to,
        preset: 'custom',
      };
    }
    return initial;
  });
  const startDate = dateRange.from;
  const endDate = dateRange.to;
  const [method, setMethod] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ mode: 'payment' | 'journal'; id: string } | null>(null);
  const [pendingCancel, setPendingCancel] = useState<CancelEligibility | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadRows = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const payRes = await getPaymentTransactions({
        companyId,
        branchId: branchId ?? undefined,
        direction,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        method: method === 'all' ? undefined : method,
        search: debouncedSearch || undefined,
        limit: 300,
      });
      if (payRes.error) setError(payRes.error);
      let merged = payRes.data || [];

      if (direction === 'all' || direction === 'paid') {
        if (method === 'all' || method === 'other') {
          const jeRes = await getJournalTimelineEntries({
            companyId,
            branchId: branchId ?? undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            search: debouncedSearch || undefined,
            limit: 300,
          });
          if (jeRes.error && !payRes.error) setError(jeRes.error);
          const payJeIds = new Set(
            merged.map((r) => r.journalEntryId).filter((id): id is string => !!id),
          );
          const journalOnly = (jeRes.data || []).filter(
            (r) => !r.journalEntryId || !payJeIds.has(r.journalEntryId),
          );
          merged = [...merged, ...journalOnly];
        }
      }

      if (scopeUser) {
        merged = merged.filter((r) => isRowByUser(r, scopeUser));
      }
      if (includeOwnExpenses && scopeUser) {
        const expRes = await getMyExpenseJournalEntries(
          companyId,
          scopeUser.authId,
          branchId ?? undefined,
          80,
          scopeUser.profileId,
        );
        const expenseRows = (expRes.data || [])
          .filter((ex) => expenseInDateRange(ex.entryDate, startDate, endDate))
          .map(expenseToTransactionRow);
        merged = [...merged, ...expenseRows];
      }
      merged.sort(compareTransactionRowDesc);
      setRows(merged);
    } finally {
      setLoading(false);
    }
  }, [
    companyId,
    branchId,
    direction,
    startDate,
    endDate,
    method,
    debouncedSearch,
    scopeUser,
    includeOwnExpenses,
  ]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, reportRefreshEpoch]);

  const filteredRows = useMemo(() => {
    if (!debouncedSearch) return rows;
    return rows.filter((r) => matchesTransactionSearch(r, debouncedSearch));
  }, [rows, debouncedSearch]);

  const stats = useMemo(() => {
    let received = 0;
    let paid = 0;
    filteredRows.forEach((r) => {
      if (r.direction === 'received') received += r.amount;
      else paid += r.amount;
    });
    return { received, paid, net: received - paid, count: filteredRows.length };
  }, [filteredRows]);

  const groups = useMemo(() => groupByDate(filteredRows), [filteredRows]);

  const refresh = () => {
    void loadRows();
  };

  const beginCancelForRow = async (tx: TransactionRow) => {
    if (!companyId || readOnly) return;
    const hint = canCancelTransactionRow(tx);
    if (!hint.show) return;
    setCancelError(null);
    setCancelBusy(true);
    try {
      let jeId = hint.journalEntryId;
      if (!jeId) {
        const payId = String(tx.paymentId || tx.id || '').trim();
        if (payId) jeId = await resolveJournalEntryIdFromPayment(companyId, payId);
      }
      if (!jeId) {
        setCancelError('No journal entry linked to this transaction.');
        return;
      }
      const eligibility = await getCancelEligibility(companyId, jeId);
      if (!eligibility.allowed) {
        setCancelError(eligibility.reason || 'Cancel not allowed for this transaction.');
        return;
      }
      setPendingCancel(eligibility);
    } finally {
      setCancelBusy(false);
    }
  };

  const executeCancel = async () => {
    if (!pendingCancel || !companyId) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const result = await cancelTransactionWithReversal({
        companyId,
        branchId: branchId ?? null,
        journalEntryId: pendingCancel.journalEntryId,
      });
      if (!result.ok) {
        setCancelError(result.error || 'Cancel failed.');
        return;
      }
      setPendingCancel(null);
      refresh();
      dispatchMobileAccountingInvalidated({
        companyId,
        branchId: branchId ?? null,
        reason: 'transaction-cancelled',
      });
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white truncate">{title}</h1>
            <p className="text-xs text-white/80">{subtitle ?? `${stats.count} transactions`}</p>
          </div>
          <button
            onClick={refresh}
            className="p-2 hover:bg-white/10 rounded-lg text-white"
            aria-label="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          {!readOnly && (
            <button
              onClick={preview.openPreview}
              disabled={preview.loading || filteredRows.length === 0}
              className="p-2 hover:bg-white/10 rounded-lg text-white disabled:opacity-50"
              aria-label="Share PDF"
            >
              <Share2 className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Received" value={stats.received} color="text-[#BBF7D0]" />
          <StatCard label="Paid" value={stats.paid} color="text-[#FECACA]" />
          <StatCard label="Net" value={stats.net} color={stats.net >= 0 ? 'text-[#BBF7D0]' : 'text-[#FECACA]'} />
        </div>

        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
          <input
            type="text"
            placeholder="Search by party, reference, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-white/40"
          />
        </div>

        <div className="mt-3">
          <DateRangeBar
            value={dateRange}
            onChange={setDateRange}
            hidePresets={hideDatePresets}
            companyId={companyId}
            branchId={branchId}
          />
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {(['all', 'received', 'paid'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                direction === d ? 'bg-white text-[#4F46E5]' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {d === 'all' ? 'All' : d === 'received' ? 'Received' : 'Paid'}
            </button>
          ))}
          {(['all', 'cash', 'bank', 'card', 'other'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                method === m ? 'bg-white text-[#4F46E5]' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {m === 'all' ? 'All methods' : METHOD_LABEL[m] ?? m}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-10 text-[#9CA3AF]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {error && !loading && <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-sm text-[#EF4444]">{error}</div>}
        {!loading && !error && groups.length === 0 && (
          <div className="py-12 text-center">
            <CalendarDays className="w-10 h-10 text-[#6B7280] mx-auto mb-3" />
            <p className="text-sm text-[#9CA3AF]">No transactions found for the current filters.</p>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key}>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">{g.label}</h3>
              <span className="text-xs text-[#6B7280]">{g.items.length} tx</span>
            </div>
            <ul className="space-y-2">
              {g.items.map((t) => {
                const rowReadOnly = readOnly || t.id.startsWith('expense-');
                const source = t.id.startsWith('journal-') ? 'journal_entry' : 'payment_row';
                const editability = canEditTransaction(t.referenceType, source);
                const rowAttachParams = { transactionRow: t };
                const copyPrefill = resolveCopyPrefillFromTransactionRow(t);
                const showCopy = Boolean(onCopyTransaction && copyPrefill);
                const cancelHint = canCancelTransactionRow(t);
                const showCancel = !rowReadOnly && cancelHint.show;
                return (
                  <LongPressCard
                    key={t.id}
                    onTap={() =>
                      setDetailId(
                        t.id.startsWith('expense-') || t.id.startsWith('journal-')
                          ? t.journalEntryId ?? t.paymentId ?? t.id.replace(/^journal-/, '')
                          : t.id,
                      )
                    }
                    onEdit={
                      !rowReadOnly && editability.editable
                        ? () => {
                            if (editability.kind === 'journal' && !t.journalEntryId) return;
                            setEditTarget({
                              mode: editability.kind === 'journal' ? 'journal' : 'payment',
                              id: editability.kind === 'journal' ? t.journalEntryId! : t.id,
                            });
                          }
                        : undefined
                    }
                    onDelete={undefined}
                    canEdit={!rowReadOnly && editability.editable}
                    canDelete={false}
                    customMenuItems={[
                      ...attachmentActions.buildLongPressMenuItems(rowAttachParams, {
                        canAdd: !rowReadOnly && editability.editable,
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
                      ...(showCancel
                        ? [
                            {
                              label: cancelHint.label,
                              icon: <Ban className="w-4 h-4" />,
                              onClick: () => void beginCancelForRow(t),
                              variant: 'danger' as const,
                              show: true,
                            },
                          ]
                        : []),
                    ]}
                  >
                    <TransactionRowCard
                      tx={t}
                      showAttachmentIcon={attachmentActions.hasAnyAttachmentHint({ transactionRow: t })}
                      onAttachmentClick={() => void attachmentActions.previewAttachments(rowAttachParams)}
                      onCopy={
                        showCopy && copyPrefill
                          ? () => onCopyTransaction!(copyPrefill)
                          : undefined
                      }
                    />
                  </LongPressCard>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {detailId && companyId && (
        <TransactionDetailSheet
          paymentId={detailId}
          companyId={companyId}
          branchId={branchId}
          onClose={() => setDetailId(null)}
          onViewLedger={onViewLedger}
          onCancelled={() => {
            refresh();
          }}
        />
      )}
      {editTarget && companyId && (
        <EditTransactionSheet
          open={true}
          companyId={companyId}
          mode={editTarget.mode}
          targetId={editTarget.id}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            refresh();
            dispatchMobileAccountingInvalidated({
              companyId,
              branchId: branchId ?? null,
              reason: 'transaction-edited',
            });
          }}
        />
      )}

      <ConfirmActionSheet
        open={!!pendingCancel}
        title={pendingCancel?.confirmTitle ?? 'Cancel?'}
        description={pendingCancel?.confirmDescription ?? ''}
        confirmLabel={pendingCancel?.confirmLabel ?? 'Yes, Cancel'}
        cancelLabel="No"
        busy={cancelBusy}
        error={cancelError}
        onCancel={() => {
          if (cancelBusy) return;
          setPendingCancel(null);
          setCancelError(null);
        }}
        onConfirm={() => void executeCancel()}
      />

      {cancelError && !pendingCancel ? (
        <div className="fixed left-4 right-4 bottom-36 z-30 p-3 rounded-xl bg-[#7F1D1D] border border-[#EF4444] text-sm text-white shadow-lg">
          {cancelError}
          <button
            type="button"
            className="ml-3 underline text-xs"
            onClick={() => setCancelError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {attachmentActions.AttachmentPreviewPortal}
      {attachmentActions.AddAttachmentSheetPortal}
      {attachmentActions.ToastBanner}

      {preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          title={title}
          filename={`${title.replace(/\s+/g, '_')}_${startDate || 'all'}_${endDate || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`${title} · ${stats.count} tx`}
        >
          <TimelinePreviewPdf
            brand={preview.brand}
            title={title}
            subtitle={
              startDate || endDate
                ? `${startDate || 'earliest'} → ${endDate || 'now'}`
                : 'All transactions'
            }
            totals={{
              inAmount: stats.received,
              outAmount: stats.paid,
              net: stats.net,
              count: stats.count,
            }}
            groups={groups.map((g) => ({
              date: g.label,
              rows: g.items.map((t) => {
                const { time } = formatPaymentDateTime(t.paymentDate, t.createdAt);
                const pres = resolveTimelinePresentation(t);
                return {
                  time,
                  party: pres.title,
                  reference: `${displayReference(t)} ${t.referenceType ? '· ' + t.referenceType.replace('_', ' ') : ''}`.trim(),
                  fromAccount: pres.from !== '—' ? pres.from : undefined,
                  toAccount: pres.to !== '—' ? pres.to : undefined,
                  amount: t.amount,
                  direction: pres.isReceived ? ('in' as const) : ('out' as const),
                  notes: t.notes ?? undefined,
                };
              }),
            }))}
            generatedBy={userName || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}
      {!loading && !error && filteredRows.length > 0 && (
        // sticky (not fixed) so the bar tracks the content column width — on tablet
        // a fixed bar spans the full viewport and overlaps the sidebar area.
        <div className="sticky bottom-24 z-20 mx-4">
          <div className="rounded-xl border border-[#374151] bg-[#111827]/95 backdrop-blur px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-[#9CA3AF]">Floating balance</span>
            <span className={`text-sm font-bold ${stats.net >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              Rs. {Math.abs(stats.net).toLocaleString('en-PK', { maximumFractionDigits: 0 })} {stats.net >= 0 ? 'IN' : 'OUT'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
      <p className="text-[10px] font-medium text-white/80 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-bold ${color}`}>
        Rs. {Math.abs(value).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

function TransactionRowCard({
  tx,
  onCopy,
  showAttachmentIcon = false,
  onAttachmentClick,
}: {
  tx: TransactionRow;
  onCopy?: () => void;
  showAttachmentIcon?: boolean;
  onAttachmentClick?: () => void;
}) {
  const dateTimeLine = formatPaymentDateTimeLine(tx.paymentDate, tx.createdAt);

  return (
    <li>
      <div className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-3 transition-colors hover:border-[#4B5563]">
        <div className="w-full text-left">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <TransactionActivityRow
                tx={tx}
                amountDecimals={2}
                timeLabel={dateTimeLine}
                attachmentSlot={
                  showAttachmentIcon && onAttachmentClick ? (
                    <AttachmentIndicatorButton onClick={() => onAttachmentClick()} size="sm" />
                  ) : null
                }
              />
              <p className="text-xs text-[#9CA3AF] truncate mt-1">
                {displayReference(tx)}
                {tx.referenceType ? <span className="ml-1 capitalize">· {tx.referenceType.replace('_', ' ')}</span> : null}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#6B7280]">
                <span className="truncate">
                  {tx.createdByName ? (
                    <span className="text-[#9CA3AF]">Created by {tx.createdByName}</span>
                  ) : null}
                </span>
                <span className="shrink-0 flex items-center gap-1.5">
                  {tx.method && <span className="uppercase">{METHOD_LABEL[tx.method] ?? tx.method}</span>}
                  {tx.branchName && <span className="truncate max-w-[80px]">{tx.branchName}</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
        {onCopy ? (
          <div className="mt-2 flex justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={onCopy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4B5563] text-white"
            >
              Copy
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
