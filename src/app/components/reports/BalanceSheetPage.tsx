import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, FileText, FileSpreadsheet, Calendar, Users } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, BalanceSheetResult, type BalanceSheetLineItem } from '@/app/services/accountingReportsService';
import type { BalanceSheetAssetGroup } from '@/app/lib/accountHierarchy';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';
import { fetchControlAccountBreakdown, type ControlAccountBreakdownResult } from '@/app/services/controlAccountBreakdownService';
import { supabase } from '@/lib/supabase';

// Group account items into standard Balance Sheet subgroups with subtotals
type GroupKey = string;
interface GroupedItem {
  groupLabel: string;
  items: BalanceSheetLineItem[];
  subtotal: number;
}

function groupAssets(items: BalanceSheetLineItem[]): GroupedItem[] {
  const groups: Record<GroupKey, { label: string; items: BalanceSheetLineItem[] }> = {
    cash_bank: { label: 'Cash & Cash Equivalents', items: [] },
    inventory: { label: 'Inventory', items: [] },
    receivables: { label: 'Receivables', items: [] },
    advances: { label: 'Advances & prepayments', items: [] },
    other: { label: 'Other Assets', items: [] },
  };
  items.forEach((i) => {
    const g = i.bs_asset_group as BalanceSheetAssetGroup | undefined;
    if (g === 'cash_bank') {
      groups.cash_bank.items.push(i);
      return;
    }
    if (g === 'inventory') {
      groups.inventory.items.push(i);
      return;
    }
    if (g === 'receivables') {
      groups.receivables.items.push(i);
      return;
    }
    if (g === 'advances') {
      groups.advances.items.push(i);
      return;
    }
    if (g === 'other') {
      groups.other.items.push(i);
      return;
    }
    const n = (i.name || '').toLowerCase();
    const c = (i.code || '').toLowerCase();
    if (n.includes('cash') || n.includes('bank') || n.includes('wallet') || c.includes('1000') || c.includes('1010') || c.includes('1020')) {
      groups.cash_bank.items.push(i);
    } else if (n.includes('inventory') || n.includes('stock') || c.includes('1200') || c.includes('1300')) {
      groups.inventory.items.push(i);
    } else if (n.includes('receivable') || n.includes('receivables') || c.includes('1100')) {
      groups.receivables.items.push(i);
    } else if (n.includes('advance') && n.includes('worker')) {
      groups.advances.items.push(i);
    } else {
      groups.other.items.push(i);
    }
  });
  return Object.entries(groups)
    .filter(([, g]) => g.items.length > 0)
    .map(([, g]) => ({
      groupLabel: g.label,
      items: g.items,
      subtotal: g.items.reduce((s, i) => s + i.amount, 0),
    }));
}

function groupLiabilities(items: BalanceSheetLineItem[]): GroupedItem[] {
  const groups: Record<GroupKey, { label: string; items: BalanceSheetLineItem[] }> = {
    trade_payables: { label: 'Trade & other payables', items: [] },
    payroll_related: { label: 'Payroll & worker', items: [] },
    deposits_and_advances: { label: 'Deposits & advances held', items: [] },
    courier: { label: 'Courier payables', items: [] },
    other: { label: 'Other liabilities', items: [] },
  };
  items.forEach((i) => {
    const lg = i.bs_liability_group;
    if (lg === 'courier') {
      groups.courier.items.push(i);
      return;
    }
    if (lg === 'payroll_related') {
      groups.payroll_related.items.push(i);
      return;
    }
    if (lg === 'deposits_and_advances') {
      groups.deposits_and_advances.items.push(i);
      return;
    }
    if (lg === 'trade_payables') {
      groups.trade_payables.items.push(i);
      return;
    }
    const n = (i.name || '').toLowerCase();
    if (n.includes('courier')) {
      groups.courier.items.push(i);
    } else if (n.includes('worker') && n.includes('payable')) {
      groups.payroll_related.items.push(i);
    } else if (n.includes('deposit') || n.includes('rental advance')) {
      groups.deposits_and_advances.items.push(i);
    } else if (n.includes('payable') || n.includes('payables')) {
      groups.trade_payables.items.push(i);
    } else {
      groups.other.items.push(i);
    }
  });
  return Object.entries(groups)
    .filter(([, g]) => g.items.length > 0)
    .map(([, g]) => ({
      groupLabel: g.label,
      items: g.items,
      subtotal: g.items.reduce((s, i) => s + i.amount, 0),
    }));
}

function groupEquity(items: { name: string; amount: number; code?: string }[]): GroupedItem[] {
  const groups: Record<GroupKey, { label: string; items: typeof items }> = {
    capital: { label: 'Owner Capital', items: [] },
    retained: { label: 'Retained Earnings', items: [] },
    other: { label: 'Other Equity', items: [] },
  };
  items.forEach((i) => {
    const n = (i.name || '').toLowerCase();
    if (n.includes('capital') || n.includes('owner')) {
      groups.capital.items.push(i);
    } else if (n.includes('retained') || n.includes('earnings') || n.includes('profit') || n.includes('net income')) {
      groups.retained.items.push(i);
    } else {
      groups.other.items.push(i);
    }
  });
  return Object.entries(groups)
    .filter(([, g]) => g.items.length > 0)
    .map(([, g]) => ({
      groupLabel: g.label,
      items: g.items,
      subtotal: g.items.reduce((s, i) => s + i.amount, 0),
    }));
}

const toExport = (r: BalanceSheetResult, formatCurrency: (n: number) => string): ExportData => {
  const rows: (string | number)[][] = [
    ['Section', 'Group', 'Account', 'Code', 'Amount'],
    ...r.assets.items.map((i) => [r.assets.label, '', i.name, i.code || '', formatCurrency(i.amount)]),
    ['Total Assets', '', '', '', formatCurrency(r.totalAssets)],
    [],
    ...r.liabilities.items.map((i) => [r.liabilities.label, '', i.name, i.code || '', formatCurrency(i.amount)]),
    ['Total Liabilities', '', '', '', formatCurrency(r.liabilities.total)],
    [],
    ...r.equity.items.map((i) => [r.equity.label, '', i.name, i.code || '', formatCurrency(i.amount)]),
    ['Total Equity', '', '', '', formatCurrency(r.equity.total)],
    [],
    ['Total Liabilities & Equity', '', '', '', formatCurrency(r.totalLiabilitiesAndEquity)],
    ['Difference (should be 0)', '', '', '', formatCurrency(r.difference)],
  ];
  return {
    title: `Balance Sheet as at ${r.asOfDate}`,
    headers: ['Section', 'Group', 'Account', 'Code', 'Amount'],
    rows,
  };
};

function SectionBlock({
  title,
  grouped,
  formatCurrency,
  sectionTotal,
  onPartyDrilldown,
}: {
  title: string;
  grouped: GroupedItem[];
  formatCurrency: (n: number) => string;
  sectionTotal: number;
  onPartyDrilldown?: (kind: 'ar' | 'ap') => void;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
      <ul className="space-y-3">
        {grouped.map((g) => (
          <li key={g.groupLabel}>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{g.groupLabel}</div>
            <ul className="space-y-1.5 pl-2">
              {g.items.map((i) => (
                <li key={i.code || i.name} className="flex justify-between items-center gap-2 text-sm">
                  <span className="text-gray-300 flex items-center gap-2 min-w-0">
                    {i.name}
                    {i.drilldownControl && onPartyDrilldown && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-indigo-400 shrink-0"
                        onClick={() => onPartyDrilldown(i.drilldownControl!)}
                      >
                        <Users className="w-3.5 h-3.5 mr-1" /> Parties
                      </Button>
                    )}
                  </span>
                  <span className="text-white tabular-nums shrink-0">{formatCurrency(i.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between text-sm font-medium text-gray-300 border-t border-gray-700/50 mt-1.5 pt-1.5">
              Subtotal <span className="tabular-nums">{formatCurrency(g.subtotal)}</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="flex justify-between font-medium text-white border-t border-gray-700 mt-3 pt-2">
        Total {title} <span className="tabular-nums">{formatCurrency(sectionTotal)}</span>
      </p>
    </div>
  );
}

export const BalanceSheetPage: React.FC<{
  asOfDate?: string;
  branchId?: string;
}> = ({ asOfDate: initialAsOfDate, branchId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const defaultDate = initialAsOfDate || new Date().toISOString().slice(0, 10);
  const [asOfDate, setAsOfDate] = useState(defaultDate);
  const [data, setData] = useState<BalanceSheetResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [partyKind, setPartyKind] = useState<'ar' | 'ap' | null>(null);
  const [partyLoading, setPartyLoading] = useState(false);
  const [partyBreakdown, setPartyBreakdown] = useState<ControlAccountBreakdownResult | null>(null);

  useEffect(() => {
    if (!companyId || !asOfDate) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    accountingReportsService
      .getBalanceSheet(companyId, asOfDate, branchId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId, asOfDate, branchId]);

  const groupedAssets = useMemo(() => (data ? groupAssets(data.assets.items) : []), [data]);
  const groupedLiabilities = useMemo(() => (data ? groupLiabilities(data.liabilities.items) : []), [data]);
  const groupedEquity = useMemo(() => (data ? groupEquity(data.equity.items) : []), [data]);

  const handleExportPDF = () => {
    if (!data) return;
    exportToPDF(toExport(data, formatCurrency), 'Balance_Sheet');
  };
  const handleExportExcel = () => {
    if (!data) return;
    exportToExcel(toExport(data, formatCurrency), 'Balance_Sheet');
  };

  const openPartyDrilldown = async (kind: 'ar' | 'ap') => {
    if (!companyId) return;
    setPartyKind(kind);
    setPartyLoading(true);
    setPartyBreakdown(null);
    try {
      const code = kind === 'ar' ? '1100' : '2000';
      const { data: acc } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('company_id', companyId)
        .eq('code', code)
        .maybeSingle();
      if (!acc?.id) {
        setPartyBreakdown(null);
        return;
      }
      const b = await fetchControlAccountBreakdown({
        companyId,
        branchId: branchId === 'all' ? null : branchId ?? null,
        accountId: acc.id,
        accountCode: String(acc.code || code),
        accountName: String(acc.name || ''),
        controlKind: kind === 'ar' ? 'ar' : 'ap',
      });
      setPartyBreakdown(b);
    } catch {
      setPartyBreakdown(null);
    } finally {
      setPartyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center text-gray-400">
        <p className="font-medium">No data for the selected period</p>
        <p className="text-sm text-gray-500 mt-1">Adjust the date or ensure journal entries exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <label className="text-sm text-gray-400 whitespace-nowrap">As at date</label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value.slice(0, 10))}
              className="w-[160px] h-9 bg-gray-800 border-gray-700 text-white text-sm"
            />
          </div>
          {data.difference !== 0 && (
            <span className="text-amber-400 text-sm">Difference: {formatCurrency(data.difference)}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1">
            <FileText size={14} /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1">
            <FileSpreadsheet size={14} /> Excel
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionBlock
          title={data.assets.label}
          grouped={groupedAssets.length > 0 ? groupedAssets : [{ groupLabel: 'Assets', items: data.assets.items, subtotal: data.totalAssets }]}
          formatCurrency={formatCurrency}
          sectionTotal={data.totalAssets}
          onPartyDrilldown={openPartyDrilldown}
        />
        <SectionBlock
          title={data.liabilities.label}
          grouped={groupedLiabilities.length > 0 ? groupedLiabilities : [{ groupLabel: 'Liabilities', items: data.liabilities.items, subtotal: data.liabilities.total }]}
          formatCurrency={formatCurrency}
          sectionTotal={data.liabilities.total}
          onPartyDrilldown={openPartyDrilldown}
        />
        <SectionBlock
          title={data.equity.label}
          grouped={groupedEquity.length > 0 ? groupedEquity : [{ groupLabel: 'Equity', items: data.equity.items, subtotal: data.equity.total }]}
          formatCurrency={formatCurrency}
          sectionTotal={data.equity.total}
        />
      </div>
      <div className="rounded-xl border border-gray-700 bg-gray-800/30 p-4 flex justify-between items-center">
        <span className="font-medium text-white">Total Liabilities + Equity</span>
        <span className="text-white tabular-nums">{formatCurrency(data.totalLiabilitiesAndEquity)}</span>
      </div>

      <Dialog open={partyKind !== null} onOpenChange={(o) => !o && setPartyKind(null)}>
        <DialogContent className="max-w-lg bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>
              {partyKind === 'ar' ? 'Receivables — party breakdown' : partyKind === 'ap' ? 'Payables — party breakdown' : 'Party breakdown'}
            </DialogTitle>
          </DialogHeader>
          {partyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : partyBreakdown?.partyRows?.length ? (
            <ul className="space-y-2 max-h-[360px] overflow-y-auto text-sm">
              {partyBreakdown.partyRows.map((r) => (
                <li key={r.contactId} className="flex justify-between gap-2 border-b border-gray-800 pb-2">
                  <span className="text-gray-300 truncate">{r.name}</span>
                  <span className="tabular-nums text-white shrink-0">{formatCurrency(r.glAmount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No party rows or data unavailable (ensure GL mapping RPC is applied).</p>
          )}
          {partyBreakdown?.partySectionNote && (
            <p className="text-xs text-amber-200/90">{partyBreakdown.partySectionNote}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
