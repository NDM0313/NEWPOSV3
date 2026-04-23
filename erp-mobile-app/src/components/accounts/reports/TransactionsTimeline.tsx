import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Loader2,
  CalendarDays,
  RefreshCw,
  Share2,
} from 'lucide-react';
import {
  getPaymentTransactions,
  type TransactionRow,
  type GetTransactionsFilters,
} from '../../../api/transactions';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { TimelinePreviewPdf } from '../../shared/TimelinePreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

interface TransactionsTimelineProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  onViewLedger?: (info: { partyId?: string | null; partyName?: string | null; accountId?: string | null }) => void;
  /** Optional initial filters (e.g. open with only today's payments). */
  initialFilters?: Partial<GetTransactionsFilters>;
  /** Custom header title */
  title?: string;
  /** Optional user for share attribution. */
  userName?: string;
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

function formatDate(dateStr: string): { date: string; time: string } {
  if (!dateStr) return { date: '', time: '' };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { date: dateStr, time: '' };
  const date = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
}

function groupByDate(rows: TransactionRow[]): Array<{ key: string; label: string; items: TransactionRow[] }> {
  const out: Array<{ key: string; label: string; items: TransactionRow[] }> = [];
  const map: Record<string, TransactionRow[]> = {};
  rows.forEach((r) => {
    const key = r.paymentDate || r.createdAt.slice(0, 10);
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });
  Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .forEach((k) => {
      const d = new Date(k);
      const label = Number.isNaN(d.getTime())
        ? k
        : d.toLocaleDateString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
      out.push({ key: k, label, items: map[k] });
    });
  return out;
}

export function TransactionsTimeline({
  onBack,
  companyId,
  branchId,
  onViewLedger,
  initialFilters,
  title = 'Transactions',
  userName,
}: TransactionsTimelineProps) {
  const preview = usePdfPreview(companyId);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<'all' | 'received' | 'paid'>(initialFilters?.direction ?? 'all');
  const [startDate, setStartDate] = useState<string>(initialFilters?.startDate ?? '');
  const [endDate, setEndDate] = useState<string>(initialFilters?.endDate ?? '');
  const [method, setMethod] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    getPaymentTransactions({
      companyId,
      branchId: branchId ?? undefined,
      direction,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      method: method === 'all' ? undefined : method,
      search: search || undefined,
      limit: 300,
    })
      .then(({ data, error }) => {
        if (error) setError(error);
        setRows(data || []);
      })
      .finally(() => setLoading(false));
  }, [companyId, branchId, direction, startDate, endDate, method, search]);

  const stats = useMemo(() => {
    let received = 0;
    let paid = 0;
    rows.forEach((r) => {
      if (r.direction === 'received') received += r.amount;
      else paid += r.amount;
    });
    return { received, paid, net: received - paid, count: rows.length };
  }, [rows]);

  const groups = useMemo(() => groupByDate(rows), [rows]);

  const refresh = () => {
    if (!companyId) return;
    setLoading(true);
    getPaymentTransactions({
      companyId,
      branchId: branchId ?? undefined,
      direction,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      method: method === 'all' ? undefined : method,
      search: search || undefined,
      limit: 300,
    })
      .then(({ data, error }) => {
        if (error) setError(error);
        setRows(data || []);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white truncate">{title}</h1>
            <p className="text-xs text-white/80">{stats.count} transactions</p>
          </div>
          <button
            onClick={refresh}
            className="p-2 hover:bg-white/10 rounded-lg text-white"
            aria-label="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={preview.openPreview}
            disabled={preview.loading || rows.length === 0}
            className="p-2 hover:bg-white/10 rounded-lg text-white disabled:opacity-50"
            aria-label="Share PDF"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-2 rounded-lg text-white ${showFilters ? 'bg-white/25' : 'hover:bg-white/10'}`}
            aria-label="Toggle filters"
          >
            <Filter className="w-5 h-5" />
          </button>
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

        {showFilters && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-white/80">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="text-xs text-white/80">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              />
            </div>
          </div>
        )}
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
              {g.items.map((t) => (
                <TransactionRowCard key={t.id} tx={t} onClick={() => setDetailId(t.id)} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {detailId && companyId && (
        <TransactionDetailSheet
          paymentId={detailId}
          companyId={companyId}
          onClose={() => setDetailId(null)}
          onViewLedger={onViewLedger}
        />
      )}

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
                const { time } = formatDate(t.createdAt || t.paymentDate);
                const isReceived = t.direction === 'received';
                return {
                  time,
                  party: t.partyName || t.partyAccountName || t.referenceType,
                  reference: `${displayReference(t)} ${t.referenceType ? '· ' + t.referenceType.replace('_', ' ') : ''}`.trim(),
                  fromAccount: isReceived ? t.paymentAccountName ?? undefined : (t.partyAccountName ?? t.partyName) ?? undefined,
                  toAccount: isReceived ? (t.partyAccountName ?? t.partyName) ?? undefined : t.paymentAccountName ?? undefined,
                  amount: t.amount,
                  direction: isReceived ? ('in' as const) : ('out' as const),
                  notes: t.notes ?? undefined,
                };
              }),
            }))}
            generatedBy={userName || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}
      {!loading && !error && rows.length > 0 && (
        <div className="fixed left-4 right-4 bottom-24 z-20">
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

function TransactionRowCard({ tx, onClick }: { tx: TransactionRow; onClick: () => void }) {
  const isReceived = tx.direction === 'received';
  const amountColor = isReceived ? 'text-[#10B981]' : 'text-[#EF4444]';
  const pillBg = isReceived ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30' : 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30';
  const Icon = isReceived ? ArrowDownLeft : ArrowUpRight;
  const { date, time } = formatDate(tx.createdAt || tx.paymentDate);
  const from = isReceived ? (tx.paymentAccountName ?? '—') : (tx.partyAccountName ?? tx.partyName ?? '—');
  const to = isReceived ? (tx.partyAccountName ?? tx.partyName ?? '—') : (tx.paymentAccountName ?? '—');

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full bg-[#1F2937] hover:bg-[#243044] border border-[#374151] rounded-xl p-3 text-left transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={`shrink-0 mt-0.5 w-9 h-9 rounded-full flex items-center justify-center ${pillBg}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {tx.partyName || tx.partyAccountName || tx.referenceType}
                </p>
                <p className="text-xs text-[#9CA3AF] truncate">
                  {displayReference(tx)}
                  {tx.referenceType ? <span className="ml-1 capitalize">· {tx.referenceType.replace('_', ' ')}</span> : null}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${amountColor}`}>
                  {isReceived ? '+' : '−'} Rs. {tx.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-[#9CA3AF]">{time}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
              <span className="truncate max-w-[45%]">{from}</span>
              <span className="text-[#6366F1]">→</span>
              <span className="truncate max-w-[45%]">{to}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-[#6B7280]">
              <span>{date}</span>
              {tx.method && <span className="uppercase">{METHOD_LABEL[tx.method] ?? tx.method}</span>}
              {tx.branchName && <span className="truncate max-w-[40%]">{tx.branchName}</span>}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}
