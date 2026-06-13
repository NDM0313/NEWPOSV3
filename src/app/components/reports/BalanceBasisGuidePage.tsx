/**
 * Balance Basis Guide — explains Operational vs Party GL signed vs Control GL (Balance Sheet).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Info,
  Loader2,
  Search,
} from 'lucide-react';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { cn } from '@/app/components/ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  filterBalanceBasisGuideRows,
  formatRowGapExplanation,
  rowHasGap,
  sortBalanceBasisGuideRows,
  sumBalanceBasisGuideTotals,
  type BalanceBasisGuideRow,
  type BalanceBasisGuideSortKey,
  type BalanceBasisGuideTypeFilter,
  type SortDirection,
} from '@/app/lib/balanceBasisGuideLogic';
import {
  balanceBasisGuideToCsv,
  loadBalanceBasisGuideReport,
  type BalanceBasisGuideReportResult,
} from '@/app/services/balanceBasisGuideReportService';

type Props = {
  asOfDate: string;
  branchId?: string | null;
};

function StatCard({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 bg-gray-950/50',
        highlight ? 'border-emerald-700/40' : 'border-gray-800'
      )}
    >
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={cn('tabular-nums text-lg font-semibold mt-1', highlight ? 'text-emerald-200' : 'text-gray-100')}>
        {value}
      </p>
      <p className="text-[10px] text-gray-600 mt-1">{note}</p>
    </div>
  );
}

function VarianceLine({ label, value, formatCurrency }: { label: string; value: number | null; formatCurrency: (n: number) => string }) {
  if (value == null) return null;
  const nearZero = Math.abs(value) < 0.01;
  return (
    <p className="text-xs text-gray-500 mt-2">
      {label}:{' '}
      <span className={cn('tabular-nums font-medium', nearZero ? 'text-emerald-400' : 'text-amber-300')}>
        {formatCurrency(value)}
      </span>
      {nearZero ? ' (aligned)' : ''}
    </p>
  );
}

export function BalanceBasisGuidePage({ asOfDate, branchId }: Props) {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<BalanceBasisGuideReportResult | null>(null);
  const [introOpen, setIntroOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<BalanceBasisGuideTypeFilter>('all');
  const [hideZeroOperational, setHideZeroOperational] = useState(false);
  const [showOnlyWithGap, setShowOnlyWithGap] = useState(false);
  const [sortKey, setSortKey] = useState<BalanceBasisGuideSortKey>('contactName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const load = useCallback(async () => {
    if (!companyId) {
      setReport(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await loadBalanceBasisGuideReport(companyId, { branchId, asOfDate });
      setReport(res);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, asOfDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    if (!report) return [];
    const filtered = filterBalanceBasisGuideRows(report.rows, {
      search,
      typeFilter,
      hideZeroOperational,
      showOnlyWithGap,
    });
    return sortBalanceBasisGuideRows(filtered, sortKey, sortDirection);
  }, [report, search, typeFilter, hideZeroOperational, showOnlyWithGap, sortKey, sortDirection]);

  const filteredTotals = useMemo(() => {
    if (!report) return null;
    const rowSums = sumBalanceBasisGuideTotals(filteredRows);
    return {
      ...rowSums,
      receivablesControl: report.totals.receivablesControl,
      payablesControl: report.totals.payablesControl,
    };
  }, [report, filteredRows]);

  const toggleSort = (key: BalanceBasisGuideSortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection(key === 'contactName' ? 'asc' : 'desc');
    }
  };

  const SortHeader = ({ col, label, align = 'right' }: { col: BalanceBasisGuideSortKey; label: string; align?: 'left' | 'right' }) => (
    <th className={cn('py-2 px-3 cursor-pointer select-none hover:text-gray-300', align === 'right' ? 'text-right' : 'text-left')}>
      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort(col)}>
        {label}
        {sortKey === col ? (
          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : null}
      </button>
    </th>
  );

  const exportCsv = () => {
    const csv = balanceBasisGuideToCsv(filteredRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-basis-guide-${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = report?.totals;
  const control = report?.controlAccounts;

  return (
    <div className="space-y-4">
      <ReportBasisBanner
        basis="effective_party"
        detail="Operational columns = MAX(0, party GL) per contact — follow-up view (Contacts / collections). Not used on Balance Sheet."
      />
      <ReportBasisBanner
        basis="official_gl"
        detail="Control GL columns = posted journal on 1100 AR / 2000 AP / 2010 Worker Payable — same source as Balance Sheet and Trial Balance."
      />

      <div className="rounded-xl border border-blue-600/30 bg-blue-950/20">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-blue-950/30"
          onClick={() => setIntroOpen((v) => !v)}
        >
          <div>
            <h2 className="text-sm font-semibold text-blue-100">How to read this report</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Three bases: Operational (clamped) | Party GL signed | Control GL (Balance Sheet)
            </p>
          </div>
          {introOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>
        {introOpen ? (
          <div className="px-4 pb-4 space-y-3 border-t border-blue-600/20 text-xs text-blue-100/90">
            <div className="flex gap-2 pt-3">
              <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
              <div className="space-y-2">
                <p>
                  <strong>Operational (clamped)</strong> — per contact, only positive balances count toward follow-up
                  (MAX(0, signed)). Customer advances and supplier credits show as 0 operational but remain on GL.
                </p>
                <p>
                  <strong>Party GL signed</strong> — full sub-ledger balance from journals (1100 / 2000 / 2010 party
                  accounts). Sum of all parties should match control accounts.
                </p>
                <p>
                  <strong>Control GL</strong> — main accounts 1100, 2000, 2010 on Trial Balance / Balance Sheet. This
                  is the official books balance.
                </p>
                <p className="text-amber-200/90">
                  Example: Operational payables 109k vs Control AP −547k is normal when many suppliers have credit
                  balances — operational hides negatives; Balance Sheet uses signed control GL.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
              <div className="rounded border border-cyan-700/40 bg-cyan-950/20 p-2">
                <strong className="text-cyan-200">Operational</strong>
                <p className="text-gray-400 mt-1">Collections / payments follow-up — not on Balance Sheet</p>
              </div>
              <div className="rounded border border-emerald-700/40 bg-emerald-950/20 p-2">
                <strong className="text-emerald-200">Party GL signed</strong>
                <p className="text-gray-400 mt-1">Per-contact journal sub-ledger (+ and −)</p>
              </div>
              <div className="rounded border border-sky-700/40 bg-sky-950/20 p-2">
                <strong className="text-sky-200">Control GL</strong>
                <p className="text-gray-400 mt-1">Balance Sheet line (1100 / 2000 / 2010)</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-gray-500">As of: {asOfDate}</p>

      {error ? (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-sm text-amber-200">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : report && totals ? (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-200">Receivables</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <StatCard
                label="Operational (clamped)"
                value={formatCurrency(totals.receivablesOperational)}
                note="MAX(0, AR) per contact — follow-up only"
              />
              <StatCard
                label="Party GL signed"
                value={formatCurrency(totals.receivablesPartySigned)}
                note="Sum of party AR sub-ledgers"
                highlight
              />
              <StatCard
                label="Control AR 1100 (Balance Sheet)"
                value={totals.receivablesControl != null ? formatCurrency(totals.receivablesControl) : '—'}
                note="Official posted GL — Trial Balance / BS"
              />
            </div>
            <VarianceLine label="Party vs control" value={totals.receivablesPartyVsControl} formatCurrency={formatCurrency} />
            <VarianceLine
              label="Operational vs signed (hidden credits/advances)"
              value={totals.receivablesOperationalVsSigned}
              formatCurrency={formatCurrency}
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-200">Payables</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <StatCard
                label="Operational (clamped)"
                value={formatCurrency(totals.payablesOperational)}
                note="MAX(0, AP+worker) per contact"
              />
              <StatCard
                label="Party GL signed"
                value={formatCurrency(totals.payablesPartySigned)}
                note="Sum of supplier + worker sub-ledgers"
                highlight
              />
              <StatCard
                label="Control AP 2000 (Balance Sheet)"
                value={totals.payablesControl != null ? formatCurrency(totals.payablesControl) : '—'}
                note="Official posted GL — Trial Balance / BS"
              />
            </div>
            <VarianceLine label="Party vs control" value={totals.payablesPartyVsControl} formatCurrency={formatCurrency} />
            <VarianceLine
              label="Operational vs signed (hidden credits/advances)"
              value={totals.payablesOperationalVsSigned}
              formatCurrency={formatCurrency}
            />
            <p className="text-[10px] text-gray-600">See Balance Sheet → Accounts Payable (2000) for the liability line.</p>
          </section>

          {control ? (
            <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Control accounts (Balance Sheet source)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div className="rounded border border-gray-800 p-2">
                  <p className="text-gray-500 text-xs">{control.ar1100.code} {control.ar1100.name}</p>
                  <p className="tabular-nums font-medium text-gray-100">
                    {control.ar1100.balanceDrMinusCr != null ? formatCurrency(control.ar1100.balanceDrMinusCr) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-600">Dr − Cr (asset)</p>
                </div>
                <div className="rounded border border-gray-800 p-2">
                  <p className="text-gray-500 text-xs">{control.ap2000.code} {control.ap2000.name}</p>
                  <p className="tabular-nums font-medium text-gray-100">
                    {control.ap2000.balanceCrMinusDr != null ? formatCurrency(control.ap2000.balanceCrMinusDr) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-600">Cr − Dr (liability)</p>
                </div>
                <div className="rounded border border-gray-800 p-2">
                  <p className="text-gray-500 text-xs">{control.wp2010.code} {control.wp2010.name}</p>
                  <p className="tabular-nums font-medium text-gray-100">
                    {control.wp2010.balanceCrMinusDr != null ? formatCurrency(control.wp2010.balanceCrMinusDr) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-600">Cr − Dr (liability)</p>
                </div>
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search name, code, account…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-gray-900 border-gray-700"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(['all', 'customers', 'suppliers', 'workers'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium capitalize',
                    typeFilter === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={hideZeroOperational} onChange={(e) => setHideZeroOperational(e.target.checked)} />
              Hide zero operational
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={showOnlyWithGap} onChange={(e) => setShowOnlyWithGap(e.target.checked)} />
              Only with gap
            </label>
            <Button size="sm" variant="outline" className="border-gray-700 gap-1.5" onClick={exportCsv}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 bg-gray-900/50 text-left">
                  <th className="py-2 px-3 w-8" />
                  <SortHeader col="contactName" label="Contact" align="left" />
                  <th className="py-2 px-3 text-left">Code / GL</th>
                  <th className="py-2 px-3 text-left">Type</th>
                  <SortHeader col="glArSigned" label="AR signed" />
                  <SortHeader col="operationalReceivable" label="AR operational" />
                  <SortHeader col="hiddenCreditAr" label="Hidden AR" />
                  <SortHeader col="glApSigned" label="AP signed" />
                  <SortHeader col="operationalPayable" label="AP operational" />
                  <SortHeader col="hiddenCreditAp" label="Hidden AP" />
                  <th className="py-2 px-3 text-right">Doc due AR</th>
                  <th className="py-2 px-3 text-right">Doc due AP</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-gray-500">
                      No contacts match filters
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <ContactRow
                      key={row.contactId}
                      row={row}
                      formatCurrency={formatCurrency}
                      expanded={expandedId === row.contactId}
                      onToggle={() => setExpandedId((id) => (id === row.contactId ? null : row.contactId))}
                    />
                  ))
                )}
              </tbody>
              {filteredTotals && filteredRows.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-gray-700 bg-gray-900/80 font-medium text-gray-200">
                    <td className="py-2 px-3" colSpan={4}>
                      Totals ({filteredRows.length} rows)
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(filteredTotals.receivablesPartySigned)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(filteredTotals.receivablesOperational)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-amber-300/90">
                      {formatCurrency(filteredTotals.receivablesOperationalVsSigned)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(filteredTotals.payablesPartySigned)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(filteredTotals.payablesOperational)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-amber-300/90">
                      {formatCurrency(filteredTotals.payablesOperationalVsSigned)}
                    </td>
                    <td className="py-2 px-3" colSpan={2} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ContactRow({
  row,
  formatCurrency,
  expanded,
  onToggle,
}: {
  row: BalanceBasisGuideRow;
  formatCurrency: (n: number) => string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasGap = rowHasGap(row);
  const apSignedTotal = row.glApSigned + row.glWorkerSigned;
  return (
    <>
      <tr className={cn('border-b border-gray-800/80 hover:bg-gray-900/40', hasGap && 'bg-amber-950/10')}>
        <td className="py-2 px-3">
          {hasGap ? (
            <button type="button" onClick={onToggle} className="text-gray-500 hover:text-gray-300">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : null}
        </td>
        <td className="py-2 px-3 font-medium text-gray-100">{row.contactName}</td>
        <td className="py-2 px-3 text-gray-400 text-xs">
          {row.contactCode || '—'}
          {row.subledgerAccountHint ? ` / ${row.subledgerAccountHint}` : ''}
        </td>
        <td className="py-2 px-3 text-gray-500 capitalize text-xs">{row.contactType}</td>
        <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(row.glArSigned)}</td>
        <td className="py-2 px-3 text-right tabular-nums text-cyan-300/90">{formatCurrency(row.operationalReceivable)}</td>
        <td className={cn('py-2 px-3 text-right tabular-nums', Math.abs(row.hiddenCreditAr) > 0.009 && 'text-amber-300')}>
          {formatCurrency(row.hiddenCreditAr)}
        </td>
        <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(apSignedTotal)}</td>
        <td className="py-2 px-3 text-right tabular-nums text-cyan-300/90">{formatCurrency(row.operationalPayable)}</td>
        <td className={cn('py-2 px-3 text-right tabular-nums', Math.abs(row.hiddenCreditAp) > 0.009 && 'text-amber-300')}>
          {formatCurrency(row.hiddenCreditAp)}
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-gray-500">{formatCurrency(row.documentDueReceivable)}</td>
        <td className="py-2 px-3 text-right tabular-nums text-gray-500">{formatCurrency(row.documentDuePayable)}</td>
      </tr>
      {expanded && hasGap ? (
        <tr className="bg-amber-950/5">
          <td colSpan={12} className="py-2 px-4 text-xs text-amber-100/80 font-mono">
            {formatRowGapExplanation(row)}
          </td>
        </tr>
      ) : null}
    </>
  );
}
