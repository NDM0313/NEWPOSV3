import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Wallet, Landmark, Smartphone } from 'lucide-react';
import type { User } from '../../../types';
import * as accountsApi from '../../../api/accounts';
import { getAccountLedgerLines, type LedgerLine } from '../../../api/reports';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

export type AccountKind = 'cash' | 'bank' | 'wallet';

interface AccountSummaryReportProps {
  onBack: () => void;
  companyId: string | null;
  user: User;
  kind: AccountKind;
  onViewLedger?: (accountId: string) => void;
  /** Ledger movements scoped like web account ledger (includes NULL branch_id JEs). */
  branchId?: string | null;
}

const KIND_CONFIG: Record<AccountKind, { title: string; subtitle: string; types: string[]; gradient: 'indigo' | 'emerald' | 'amber' | 'slate' | 'rose'; icon: typeof Wallet }> = {
  cash: { title: 'Cash Summary', subtitle: 'All cash account movements', types: ['cash'], gradient: 'emerald', icon: Wallet },
  bank: { title: 'Bank Summary', subtitle: 'Bank account activity', types: ['bank'], gradient: 'indigo', icon: Landmark },
  wallet: { title: 'Wallet Summary', subtitle: 'Mobile wallet activity', types: ['mobile_wallet'], gradient: 'amber', icon: Smartphone },
};

export function AccountSummaryReport({ onBack, companyId, user, kind, onViewLedger, branchId }: AccountSummaryReportProps) {
  const cfg = KIND_CONFIG[kind];
  const Icon = cfg.icon;
  const [accounts, setAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [movements, setMovements] = useState<Record<string, { inAmount: number; outAmount: number; net: number; count: number; lines: LedgerLine[] }>>({});
  const [movementsRefreshNonce, setMovementsRefreshNonce] = useState(0);
  const [movementsRefreshBusy, setMovementsRefreshBusy] = useState(false);
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
      const list = (data || []).filter((a) => cfg.types.includes(a.type));
      setAccounts(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, kind]);

  useEffect(() => {
    if (!companyId || accounts.length === 0) {
      setMovements({});
      setMovementsRefreshBusy(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const out: typeof movements = {};
      try {
        await Promise.all(
          accounts.map(async (a) => {
            const { lines } = await getAccountLedgerLines(
              companyId,
              a.id,
              range.from || undefined,
              range.to || undefined,
              branchId ?? null,
            );
            const debit = lines.reduce((s, l) => s + l.debit, 0);
            const credit = lines.reduce((s, l) => s + l.credit, 0);
            out[a.id] = {
              inAmount: debit,
              outAmount: credit,
              net: debit - credit,
              count: lines.length,
              lines,
            };
          }),
        );
        if (!cancelled) setMovements(out);
      } finally {
        if (!cancelled) setMovementsRefreshBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, accounts, range.from, range.to, branchId, movementsRefreshNonce]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') setMovementsRefreshNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [companyId]);

  const totals = useMemo(() => {
    let inAmt = 0;
    let outAmt = 0;
    let count = 0;
    for (const a of accounts) {
      const m = movements[a.id];
      if (!m) continue;
      inAmt += m.inAmount;
      outAmt += m.outAmount;
      count += m.count;
    }
    return { inAmt, outAmt, net: inAmt - outAmt, count };
  }, [movements, accounts]);

  const pdfRows = useMemo(() => {
    return accounts.flatMap((a) => {
      const m = movements[a.id];
      if (!m) return [];
      return m.lines.map((l) => ({
        date: l.date,
        reference: `${a.code}·${l.entryNo}`,
        description: `${a.name} — ${l.description}`,
        debit: l.debit,
        credit: l.credit,
        balance: l.runningBalance,
      }));
    });
  }, [accounts, movements]);

  const closing = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts]);

  const stats = [
    { label: 'Accounts', value: String(accounts.length) },
    { label: 'Inflow', value: `Rs. ${formatAmount(totals.inAmt, 0)}`, color: 'text-[#BBF7D0]' },
    { label: 'Outflow', value: `Rs. ${formatAmount(totals.outAmt, 0)}`, color: 'text-[#FCA5A5]' },
    { label: 'Net', value: `Rs. ${formatAmount(totals.net, 0)}` },
  ];

  const summarySubtitle =
    branchId && branchId !== 'all' && branchId !== 'default'
      ? `${cfg.subtitle} · scoped branch + company-wide JEs`
      : cfg.subtitle;

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title={cfg.title}
        subtitle={summarySubtitle}
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient={cfg.gradient}
        onRefresh={() => {
          setMovementsRefreshBusy(true);
          setMovementsRefreshNonce((n) => n + 1);
        }}
        refreshing={movementsRefreshBusy}
      >
        <DateRangeBar value={range} onChange={setRange} />
      </ReportHeader>

      <ReportShell loading={loading} empty={!loading && accounts.length === 0} emptyLabel="No accounts of this type.">
        <ReportCard className="overflow-hidden">
          <ReportSectionTitle title="Accounts" right={`${accounts.length}`} />
          <ul className="divide-y divide-[#374151]">
            {accounts.map((a) => {
              const m = movements[a.id] ?? { inAmount: 0, outAmount: 0, net: 0, count: 0 };
              return (
                <li key={a.id}>
                  <button
                    onClick={() => onViewLedger?.(a.id)}
                    className="w-full px-4 py-3 text-left hover:bg-[#243044] transition-colors"
                    disabled={!onViewLedger}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#111827] border border-[#374151] flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[#9CA3AF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          <span className="font-mono text-[11px] text-[#9CA3AF] mr-2">{a.code}</span>
                          {a.name}
                        </p>
                        <div className="mt-1 grid grid-cols-3 gap-2">
                          <p className="text-[11px] text-[#BBF7D0]">+ Rs. {formatAmount(m.inAmount, 0)}</p>
                          <p className="text-[11px] text-[#FCA5A5]">− Rs. {formatAmount(m.outAmount, 0)}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{m.count} txns</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${a.balance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          Rs. {formatAmount(a.balance, 0)}
                        </p>
                        <p className="text-[10px] text-[#9CA3AF]">Current</p>
                      </div>
                      {onViewLedger && <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0 self-center" />}
                    </div>
                  </button>
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
          filename={`${cfg.title.replace(/\s+/g, '_')}_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`${cfg.title} · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title={cfg.title}
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={cfg.title}
            partyMeta={`${accounts.length} accounts`}
            openingBalance={0}
            closingBalance={closing}
            totals={{ debit: totals.inAmt, credit: totals.outAmt }}
            rows={pdfRows}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}
