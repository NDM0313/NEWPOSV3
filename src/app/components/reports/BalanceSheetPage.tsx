import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, FileText, FileSpreadsheet, Calendar } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, BalanceSheetResult } from '@/app/services/accountingReportsService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';

// Group account items into standard Balance Sheet subgroups with subtotals
type GroupKey = string;
interface GroupedItem {
  groupLabel: string;
  items: { name: string; amount: number; code?: string }[];
  subtotal: number;
}

function groupAssets(items: { name: string; amount: number; code?: string }[]): GroupedItem[] {
  const groups: Record<GroupKey, { label: string; items: typeof items }> = {
    cash_bank: { label: 'Cash & Bank', items: [] },
    inventory: { label: 'Inventory', items: [] },
    receivables: { label: 'Receivables', items: [] },
    other: { label: 'Other Assets', items: [] },
  };
  items.forEach((i) => {
    const n = (i.name || '').toLowerCase();
    const c = (i.code || '').toLowerCase();
    if (n.includes('cash') || n.includes('bank') || n.includes('wallet') || c.includes('1000') || c.includes('1010') || c.includes('1020')) {
      groups.cash_bank.items.push(i);
    } else if (n.includes('inventory') || n.includes('stock') || c.includes('1200') || c.includes('1300')) {
      groups.inventory.items.push(i);
    } else if (n.includes('receivable') || n.includes('receivables') || c.includes('1100')) {
      groups.receivables.items.push(i);
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

function groupLiabilities(items: { name: string; amount: number; code?: string }[]): GroupedItem[] {
  const groups: Record<GroupKey, { label: string; items: typeof items }> = {
    payables: { label: 'Payables', items: [] },
    courier: { label: 'Courier Payables', items: [] },
    other: { label: 'Other Liabilities', items: [] },
  };
  items.forEach((i) => {
    const n = (i.name || '').toLowerCase();
    if (n.includes('courier')) {
      groups.courier.items.push(i);
    } else if (n.includes('payable') || n.includes('payables')) {
      groups.payables.items.push(i);
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
}: {
  title: string;
  grouped: GroupedItem[];
  formatCurrency: (n: number) => string;
  sectionTotal: number;
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
                <li key={i.code || i.name} className="flex justify-between text-sm">
                  <span className="text-gray-300">{i.name}</span>
                  <span className="text-white tabular-nums">{formatCurrency(i.amount)}</span>
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
        />
        <SectionBlock
          title={data.liabilities.label}
          grouped={groupedLiabilities.length > 0 ? groupedLiabilities : [{ groupLabel: 'Liabilities', items: data.liabilities.items, subtotal: data.liabilities.total }]}
          formatCurrency={formatCurrency}
          sectionTotal={data.liabilities.total}
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
    </div>
  );
};
