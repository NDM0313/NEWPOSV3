/**
 * Ledger V2 — unified account statement view (mobile).
 * Lists GL accounts; selecting one loads unified account ledger when flags allow.
 */

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { usePermissions } from '../../../context/PermissionContext';
import * as accountsApi from '../../../api/accounts';
import { rpcGetUnifiedAccountLedger } from '../../../api/unifiedLedgerRpc';
import {
  effectiveReportLoaderSource,
  resolveReportMainLoaderSource,
} from '../../../lib/reportLoaderSource';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard } from './_shared/ReportShell';
import { formatAmount, dateRangeLabel, formatDate } from './_shared/format';
import { LoaderSourceBadge } from './_shared/LoaderSourceBadge';
import { getAccountLedgerLines } from '../../../api/reports';
import type { UnifiedLedgerRow } from '../../../types/unifiedReports';
import { formatLedgerLinePresentation } from '../../../lib/ledgerLinePresentation';

interface LedgerV2ReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  reportRefreshEpoch?: number;
}

export function LedgerV2Report({
  onBack,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
}: LedgerV2ReportProps) {
  const { canViewBalances } = usePermissions();
  const [accounts, setAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<accountsApi.AccountRow | null>(null);
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange());
  const [rows, setRows] = useState<UnifiedLedgerRow[]>([]);
  const [closing, setClosing] = useState(0);
  const [loaderSource, setLoaderSource] = useState<'legacy' | 'unified'>('legacy');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    accountsApi.getAccounts(companyId).then(({ data }) => {
      if (cancelled) return;
      setAccounts(data || []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, reportRefreshEpoch]);

  useEffect(() => {
    if (!companyId || !selected) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setError(null);
    (async () => {
      const resolved = await resolveReportMainLoaderSource(companyId, 'ledger_v2', { legacyAvailable: true });
      const source = effectiveReportLoaderSource(resolved);
      if (source === 'unified') {
        const unified = await rpcGetUnifiedAccountLedger({
          companyId,
          accountId: selected.id,
          branchId,
          dateFrom: range.from,
          dateTo: range.to,
          basis: 'official_gl',
        });
        if (cancelled) return;
        if (unified.error) {
          setError(unified.error);
          setLoaderSource('legacy');
        } else {
          setRows(unified.rows);
          setClosing(unified.closingBalance);
          setLoaderSource('unified');
        }
      } else {
        const legacy = await getAccountLedgerLines(companyId, selected.id, range.from, range.to, branchId);
        if (cancelled) return;
        if (legacy.error) setError(legacy.error);
        setRows(
          legacy.lines.map((l) => {
            const pres = formatLedgerLinePresentation(l, { viewedAccountName: selected.name });
            const description = pres.subline ? `${pres.title} · ${pres.subline}` : pres.title;
            return {
            journalEntryLineId: l.id,
            journalEntryId: l.journalEntryId,
            entryDate: l.date,
            entryNo: l.entryNo,
            referenceType: l.referenceType,
            description,
            debit: l.debit,
            credit: l.credit,
            runningBalance: l.runningBalance,
            paymentId: l.paymentId ?? null,
            accountCode: selected.code,
            accountName: selected.name,
            partyResolved: l.partyName ?? l.counterAccountName ?? null,
          };
          }),
        );
        setClosing(legacy.lines[legacy.lines.length - 1]?.runningBalance ?? legacy.openingBalance);
        setLoaderSource('legacy');
      }
      setDetailLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, selected, range.from, range.to, branchId, reportRefreshEpoch]);

  const filtered = accounts.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.code.includes(search),
  );

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={selected ? () => setSelected(null) : onBack}
        title={selected ? selected.name : 'Ledger V2'}
        subtitle={selected ? dateRangeLabel(range.from, range.to) : 'Unified GL account statements'}
        rightExtras={selected ? <LoaderSourceBadge source={loaderSource} hidden={!canViewBalances} /> : undefined}
      >
        {selected && <DateRangeBar value={range} onChange={setRange} companyId={companyId} branchId={branchId} />}
      </ReportHeader>
      <ReportShell loading={loading && !selected} error={error} empty={false}>
        {!selected ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accounts…"
                className="w-full bg-[#1F2937] border border-[#374151] rounded-lg pl-9 pr-3 py-2 text-sm text-white"
              />
            </div>
            <ReportCard className="divide-y divide-[#374151] max-h-[60vh] overflow-y-auto">
              {filtered.slice(0, 100).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#374151]/40"
                >
                  <p className="text-sm text-white">{a.name}</p>
                  <p className="text-xs text-[#6B7280]">{a.code}</p>
                </button>
              ))}
            </ReportCard>
          </div>
        ) : (
          <>
            {canViewBalances && !detailLoading && (
              <p className="text-sm text-[#9CA3AF] px-1 mb-2">
                Closing: Rs. {formatAmount(closing, 2)}
              </p>
            )}
            {detailLoading ? null : (
              <ReportCard className="divide-y divide-[#374151]">
                {rows.map((r) => (
                  <div key={r.journalEntryLineId} className="px-3 py-2 text-xs">
                    <div className="flex justify-between text-[#E5E7EB]">
                      <span>{formatDate(r.entryDate)}</span>
                      {canViewBalances && (
                        <span className="font-mono">{formatAmount(r.runningBalance, 2)}</span>
                      )}
                    </div>
                    <p className="text-[#9CA3AF] truncate">{r.description}</p>
                  </div>
                ))}
              </ReportCard>
            )}
          </>
        )}
      </ReportShell>
    </div>
  );
}
