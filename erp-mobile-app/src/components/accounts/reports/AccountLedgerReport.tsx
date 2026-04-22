import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ArrowDownLeft, ArrowUpRight, Wallet, Search } from 'lucide-react';
import type { User } from '../../../types';
import * as accountsApi from '../../../api/accounts';
import { getAccountLedgerLines, type LedgerLine } from '../../../api/reports';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

interface AccountLedgerReportProps {
  onBack: () => void;
  companyId: string | null;
  initialAccountId?: string | null;
  user: User;
  filterTypes?: ('cash' | 'bank' | 'mobile_wallet' | 'asset' | 'liability' | 'equity' | 'income' | 'expense')[];
  titleOverride?: string;
}

export function AccountLedgerReport({ onBack, companyId, initialAccountId, user, filterTypes, titleOverride }: AccountLedgerReportProps) {
  const [accounts, setAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<accountsApi.AccountRow | null>(null);
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));

  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [opening, setOpening] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    accountsApi.getAccounts(companyId).then(({ data }) => {
      if (cancelled) return;
      const list = (data || []).filter((a) => !filterTypes || filterTypes.includes(a.type as never));
      setAccounts(list);
      setLoading(false);
      if (initialAccountId) {
        const found = list.find((a) => a.id === initialAccountId);
        if (found) setSelected(found);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, initialAccountId, filterTypes]);

  useEffect(() => {
    if (!companyId || !selected) {
      setLines([]);
      setOpening(0);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getAccountLedgerLines(companyId, selected.id, range.from || undefined, range.to || undefined).then(
      ({ openingBalance, lines }) => {
        if (cancelled) return;
        setOpening(openingBalance);
        setLines(lines);
        setDetailLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [companyId, selected, range.from, range.to]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    const closing = lines.length ? lines[lines.length - 1].runningBalance : opening;
    return { debit, credit, closing };
  }, [lines, opening]);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.code ?? '').toLowerCase().includes(q) ||
        (a.type ?? '').toLowerCase().includes(q),
    );
  }, [accounts, search]);

  if (!selected) {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <ReportHeader
          onBack={onBack}
          title={titleOverride ?? 'Account Ledger'}
          subtitle="Select an account"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts..."
              className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/60"
            />
          </div>
        </ReportHeader>

        <ReportShell loading={loading} empty={!loading && filteredAccounts.length === 0} emptyLabel="No accounts found.">
          <ul className="space-y-2">
            {filteredAccounts.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setSelected(a)}
                  className="w-full bg-[#1F2937] border border-[#374151] hover:border-[#6366F1] rounded-xl p-3.5 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-[#9CA3AF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        <span className="text-[#9CA3AF] font-mono text-[11px] mr-2">{a.code}</span>
                        {a.name}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] capitalize">{a.type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${a.balance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        Rs. {formatAmount(a.balance, 0)}
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
        subtitle={`${selected.code} · ${selected.type}`}
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>

      <ReportShell loading={detailLoading} empty={!detailLoading && lines.length === 0} emptyLabel="No ledger activity for this period.">
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
                      <p className="text-sm font-semibold text-white truncate">{l.description || '—'}</p>
                      <p className="text-[11px] text-[#9CA3AF] truncate">
                        {formatDate(l.date)} · {l.entryNo} · {l.referenceType || '—'}
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
          title={titleOverride ?? 'Account Ledger'}
          filename={`Account_Ledger_${selected.code}_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`${selected.code} — ${selected.name} · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title={titleOverride ?? 'Account Ledger'}
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={`${selected.code} — ${selected.name}`}
            partyMeta={selected.type}
            openingBalance={opening}
            closingBalance={totals.closing}
            totals={{ debit: totals.debit, credit: totals.credit }}
            rows={lines.map((l) => ({
              date: l.date,
              reference: l.entryNo,
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
