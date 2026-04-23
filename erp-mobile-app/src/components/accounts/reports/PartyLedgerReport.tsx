import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ArrowDownLeft, ArrowUpRight, Users, Search } from 'lucide-react';
import type { User } from '../../../types';
import {
  getContactsByType,
  getContactSubAccountId,
  getAccountLedgerLines,
  type LedgerLine,
  type PartyRow,
} from '../../../api/reports';
import { getWorkersWithPayable, getWorkerLedgerEntries } from '../../../api/accounts';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

export type PartyLedgerKind = 'customer' | 'supplier' | 'worker';

interface PartyLedgerReportProps {
  onBack: () => void;
  kind: PartyLedgerKind;
  companyId: string | null;
  user: User;
}

interface LocalParty {
  id: string;
  name: string;
  meta?: string;
  balance: number;
}

const KIND_LABELS: Record<PartyLedgerKind, { title: string; plural: string; gradient: 'indigo' | 'rose' | 'emerald' | 'amber' }> = {
  customer: { title: 'Customer Ledger', plural: 'customers', gradient: 'indigo' },
  supplier: { title: 'Supplier Ledger', plural: 'suppliers', gradient: 'amber' },
  worker: { title: 'Worker Ledger', plural: 'workers', gradient: 'emerald' },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const displayEntryNo = (value: string, fallbackType?: string) => {
  const v = (value || '').trim();
  if (!v || UUID_RE.test(v)) return (fallbackType || 'entry').replace('_', ' ').toUpperCase();
  return v;
};

export function PartyLedgerReport({ onBack, kind, companyId, user }: PartyLedgerReportProps) {
  const cfg = KIND_LABELS[kind];
  const [parties, setParties] = useState<LocalParty[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LocalParty | null>(null);
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));

  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [opening, setOpening] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        if (kind === 'worker') {
          const { data } = await getWorkersWithPayable(companyId);
          if (cancelled) return;
          setParties(
            (data || []).map((w) => ({
              id: w.id,
              name: w.name,
              meta: w.type || w.phone || undefined,
              balance: Number(w.totalPayable || 0),
            })),
          );
        } else {
          const { data } = await getContactsByType(companyId, kind);
          if (cancelled) return;
          setParties(
            (data as PartyRow[]).map((p) => ({
              id: p.id,
              name: p.name,
              meta: [p.code, p.phone].filter(Boolean).join(' · ') || undefined,
              balance: Number(p.balance || 0),
            })),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, kind]);

  useEffect(() => {
    if (!companyId || !selected) {
      setLines([]);
      setOpening(0);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    (async () => {
      try {
        if (kind === 'worker') {
          const { data } = await getWorkerLedgerEntries(companyId, selected.id);
          if (cancelled) return;
          const filtered = (data || []).filter((r) => {
            if (!range.from && !range.to) return true;
            const d = r.created_at.slice(0, 10);
            if (range.from && d < range.from) return false;
            if (range.to && d > range.to) return false;
            return true;
          });
          let running = 0;
          const arr: LedgerLine[] = [];
          for (const r of filtered.slice().reverse()) {
            // For workers: credit = payable (worker earns), debit = payment to worker
            const isPayment = r.reference_type === 'payment' || r.status === 'paid';
            const debit = isPayment ? r.amount : 0;
            const credit = isPayment ? 0 : r.amount;
            running += debit - credit;
            arr.push({
              id: r.id,
              date: r.created_at.slice(0, 10),
              createdAt: r.created_at,
              entryNo: r.reference_id || r.reference_type,
              description: r.notes || r.reference_type,
              reference: r.reference_id || '',
              referenceType: r.reference_type,
              journalEntryId: '',
              sourceReferenceId: r.reference_id ?? null,
              debit,
              credit,
              runningBalance: running,
            });
          }
          setOpening(0);
          setLines(arr);
        } else {
          const subId = await getContactSubAccountId(companyId, selected.id);
          if (cancelled) return;
          if (!subId) {
            setOpening(0);
            setLines([]);
            setDetailError('No sub-ledger account found for this party yet.');
            return;
          }
          const { openingBalance, lines: rows, error } = await getAccountLedgerLines(
            companyId,
            subId,
            range.from || undefined,
            range.to || undefined,
          );
          if (cancelled) return;
          setOpening(openingBalance);
          setLines(rows);
          if (error) setDetailError(error);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, selected, kind, range.from, range.to]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    const closing = lines.length ? lines[lines.length - 1].runningBalance : opening;
    return { debit, credit, closing };
  }, [lines, opening]);

  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.meta ?? '').toLowerCase().includes(q),
    );
  }, [parties, search]);

  // List view
  if (!selected) {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <ReportHeader
          onBack={onBack}
          title={cfg.title}
          subtitle={`Select ${cfg.plural === 'customers' ? 'a customer' : cfg.plural === 'suppliers' ? 'a supplier' : 'a worker'}`}
          gradient={cfg.gradient}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${cfg.plural}...`}
              className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/60"
            />
          </div>
        </ReportHeader>

        <ReportShell loading={loading} empty={!loading && filteredParties.length === 0} emptyLabel={`No ${cfg.plural} found.`}>
          <ul className="space-y-2">
            {filteredParties.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelected(p)}
                  className="w-full bg-[#1F2937] border border-[#374151] hover:border-[#6366F1] rounded-xl p-3.5 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#111827] border border-[#374151] flex items-center justify-center">
                      <Users className="w-4 h-4 text-[#9CA3AF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      {p.meta && <p className="text-[11px] text-[#9CA3AF] truncate">{p.meta}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-bold ${
                          Math.abs(p.balance) < 0.01
                            ? 'text-[#9CA3AF]'
                            : p.balance > 0
                            ? kind === 'supplier' || kind === 'worker'
                              ? 'text-[#F59E0B]'
                              : 'text-[#10B981]'
                            : 'text-[#EF4444]'
                        }`}
                      >
                        Rs. {formatAmount(Math.abs(p.balance), 0)}
                      </p>
                      <p className="text-[10px] text-[#6B7280]">
                        {Math.abs(p.balance) < 0.01
                          ? 'Settled'
                          : kind === 'customer'
                          ? p.balance > 0
                            ? 'Receivable'
                            : 'Advance'
                          : p.balance > 0
                          ? 'Payable'
                          : 'Advance'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </ReportShell>
      </div>
    );
  }

  // Detail view
  const stats = [
    { label: 'Opening', value: `Rs. ${formatAmount(opening, 0)}` },
    { label: 'Debit', value: `Rs. ${formatAmount(totals.debit, 0)}`, color: 'text-[#FDE68A]' },
    { label: 'Credit', value: `Rs. ${formatAmount(totals.credit, 0)}`, color: 'text-[#BBF7D0]' },
    { label: 'Closing', value: `Rs. ${formatAmount(totals.closing, 0)}` },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={() => setSelected(null)}
        title={selected.name}
        subtitle={selected.meta || cfg.title}
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient={cfg.gradient}
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>

      <ReportShell
        loading={detailLoading}
        error={detailError}
        empty={!detailLoading && lines.length === 0}
        emptyLabel="No ledger activity for this period."
      >
        <ReportCard>
          <ReportSectionTitle
            title="Ledger activity"
            subtitle={dateRangeLabel(range.from, range.to)}
            right={`${lines.length} entries`}
          />
          <ul className="divide-y divide-[#374151]">
            {lines.map((l) => {
              const isDebit = l.debit > 0;
              const amount = isDebit ? l.debit : l.credit;
              return (
                <li key={l.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        isDebit ? 'bg-[#F59E0B]/15 text-[#F59E0B]' : 'bg-[#10B981]/15 text-[#10B981]'
                      }`}
                    >
                      {isDebit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-semibold text-white truncate">{l.description || '—'}</p>
                      </div>
                      <p className="text-[11px] text-[#9CA3AF] truncate">
                        {formatDate(l.date)} · {displayEntryNo(l.entryNo, l.referenceType)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isDebit ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                        {isDebit ? '+' : '−'} Rs. {formatAmount(amount, 0)}
                      </p>
                      <p className="text-[10px] text-[#9CA3AF]">Bal Rs. {formatAmount(l.runningBalance, 0)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </ReportCard>
      </ReportShell>

      {preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          title={cfg.title}
          filename={`${cfg.title.replace(/\s+/g, '_')}_${selected.name.replace(/\s+/g, '_')}_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`${cfg.title} — ${selected.name} · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title={cfg.title}
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={selected.name}
            partyMeta={selected.meta}
            openingBalance={opening}
            closingBalance={totals.closing}
            totals={{ debit: totals.debit, credit: totals.credit }}
            rows={lines.map((l) => ({
              date: l.date,
              reference: displayEntryNo(l.entryNo, l.referenceType),
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              balance: l.runningBalance,
            }))}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}
