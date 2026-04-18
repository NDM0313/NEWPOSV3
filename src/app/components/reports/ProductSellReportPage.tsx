import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search as SearchIcon } from 'lucide-react';
import { ReportActions } from './ReportActions';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { exportToCSV, exportToExcel, exportToPDF, type ExportData } from '@/app/utils/exportUtils';
import {
  fetchProductSellReport,
  type ProductSellReportLine,
} from '@/app/services/productSellReportService';

export type ProductSellView =
  | 'detailed'
  | 'detailed_with_purchase'
  | 'by_date'
  | 'by_category'
  | 'by_brand';

const TABS: { key: ProductSellView; label: string }[] = [
  { key: 'detailed', label: 'Detailed' },
  { key: 'detailed_with_purchase', label: 'Detailed (With purchase)' },
  { key: 'by_date', label: 'Grouped (By Date)' },
  { key: 'by_category', label: 'By Category' },
  { key: 'by_brand', label: 'By Brand' },
];

type Props = {
  startDate: string;
  endDate: string;
  branchId?: string;
};

export const ProductSellReportPage: React.FC<Props> = ({ startDate, endDate, branchId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();

  const [view, setView] = useState<ProductSellView>('detailed');
  const [lines, setLines] = useState<ProductSellReportLine[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [saleCount, setSaleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const effectiveBranch = branchId && branchId !== 'all' ? branchId : null;

  useEffect(() => {
    if (!companyId) {
      setLines([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchProductSellReport(companyId, startDate, endDate, effectiveBranch)
      .then((res) => {
        if (cancelled) return;
        setLines(res.lines);
        setTruncated(res.truncated);
        setSaleCount(res.saleCount);
      })
      .catch(() => {
        if (!cancelled) setLines([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, startDate, endDate, effectiveBranch]);

  useEffect(() => {
    setPage(1);
  }, [view, search, pageSize, lines.length]);

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => {
      const hay = [
        l.invoiceNo,
        l.customerName,
        l.sku,
        l.productName,
        l.billNo,
        l.contactCode,
        l.contactNumber,
        l.contactEmail,
        l.categoryName,
        l.brandName,
        l.paymentMethod,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [lines, search]);

  const byDateRows = useMemo(() => {
    const m = new Map<
      string,
      { date: string; lineCount: number; qty: number; revenue: number; tax: number; discount: number; cost: number }
    >();
    for (const l of filteredLines) {
      const k = l.date || '—';
      if (!m.has(k))
        m.set(k, { date: k, lineCount: 0, qty: 0, revenue: 0, tax: 0, discount: 0, cost: 0 });
      const r = m.get(k)!;
      r.lineCount += 1;
      r.qty += l.quantity;
      r.revenue += l.lineTotal;
      r.tax += l.lineTax;
      r.discount += l.lineDiscount;
      r.cost += l.lineCost;
    }
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredLines]);

  const byCategoryRows = useMemo(() => {
    const m = new Map<
      string,
      { name: string; lineCount: number; qty: number; revenue: number; cost: number; margin: number }
    >();
    for (const l of filteredLines) {
      const k = l.categoryName || '—';
      if (!m.has(k)) m.set(k, { name: k, lineCount: 0, qty: 0, revenue: 0, cost: 0, margin: 0 });
      const r = m.get(k)!;
      r.lineCount += 1;
      r.qty += l.quantity;
      r.revenue += l.lineTotal;
      r.cost += l.lineCost;
      r.margin += l.lineMargin;
    }
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredLines]);

  const byBrandRows = useMemo(() => {
    const m = new Map<
      string,
      { name: string; lineCount: number; qty: number; revenue: number; cost: number; margin: number }
    >();
    for (const l of filteredLines) {
      const k = l.brandName || '—';
      if (!m.has(k)) m.set(k, { name: k, lineCount: 0, qty: 0, revenue: 0, cost: 0, margin: 0 });
      const r = m.get(k)!;
      r.lineCount += 1;
      r.qty += l.quantity;
      r.revenue += l.lineTotal;
      r.cost += l.lineCost;
      r.margin += l.lineMargin;
    }
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredLines]);

  const detailSlice = useMemo(() => {
    if (view !== 'detailed' && view !== 'detailed_with_purchase') return [];
    const start = (page - 1) * pageSize;
    return filteredLines.slice(start, start + pageSize);
  }, [view, filteredLines, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLines.length / pageSize));

  const totals = useMemo(() => {
    let revenue = 0;
    let tax = 0;
    let discount = 0;
    let qty = 0;
    let cost = 0;
    for (const l of filteredLines) {
      revenue += l.lineTotal;
      tax += l.lineTax;
      discount += l.lineDiscount;
      qty += l.quantity;
      cost += l.lineCost;
    }
    return {
      revenue: Math.round(revenue * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      qty: Math.round(qty * 1000) / 1000,
      cost: Math.round(cost * 100) / 100,
      margin: Math.round((revenue - cost) * 100) / 100,
      lines: filteredLines.length,
    };
  }, [filteredLines]);

  const buildExportDetailed = useCallback(
    (withPurchase: boolean): ExportData => {
      const baseHeaders = [
        'Date',
        'Customer name',
        'Invoice No.',
        'BILL NO',
        'SKU',
        'Product',
        'Quantity',
        'Unit Price',
        'Total',
        'Payment Method',
        'Contact ID',
        'Contact Number',
        'contact email',
        'Discount',
        'Tax',
        'Price inc. tax',
        'Category',
        'Brand',
      ];
      const extra = withPurchase ? ['Unit cost', 'Line cost', 'Line margin'] : [];
      const headers = [...baseHeaders, ...extra];
      const rows = filteredLines.map((l) => {
        const row: (string | number)[] = [
          l.date,
          l.customerName,
          l.invoiceNo,
          l.billNo,
          l.sku,
          l.productName,
          l.unitLabel,
          l.unitPrice,
          l.lineTotal,
          l.paymentMethod,
          l.contactCode,
          l.contactNumber,
          l.contactEmail,
          l.lineDiscount,
          l.lineTax,
          l.priceIncTaxPerUnit,
          l.categoryName,
          l.brandName,
        ];
        if (withPurchase) row.push(l.unitCost, l.lineCost, l.lineMargin);
        return row;
      });
      return {
        title: `Product Sell Report — ${withPurchase ? 'Detailed (with purchase)' : 'Detailed'} (${startDate} to ${endDate})`,
        headers,
        rows,
      };
    },
    [filteredLines, startDate, endDate]
  );

  const handleExportCsv = useCallback(() => {
    const withPurchase = view === 'detailed_with_purchase';
    if (view === 'detailed' || view === 'detailed_with_purchase') {
      exportToCSV(buildExportDetailed(withPurchase), 'Product_Sell_Report');
      return;
    }
    if (view === 'by_date') {
      exportToCSV(
        {
          title: 'Product Sell — By Date',
          headers: ['Date', 'Lines', 'Qty (sum)', 'Revenue', 'Tax', 'Discount', 'Cost (est.)'],
          rows: byDateRows.map((r) => [r.date, r.lineCount, r.qty, r.revenue, r.tax, r.discount, r.cost]),
        },
        'Product_Sell_By_Date'
      );
      return;
    }
    if (view === 'by_category') {
      exportToCSV(
        {
          title: 'Product Sell — By Category',
          headers: ['Category', 'Lines', 'Qty (sum)', 'Revenue', 'Cost (est.)', 'Margin (est.)'],
          rows: byCategoryRows.map((r) => [r.name, r.lineCount, r.qty, r.revenue, r.cost, r.margin]),
        },
        'Product_Sell_By_Category'
      );
      return;
    }
    exportToCSV(
      {
        title: 'Product Sell — By Brand',
        headers: ['Brand', 'Lines', 'Qty (sum)', 'Revenue', 'Cost (est.)', 'Margin (est.)'],
        rows: byBrandRows.map((r) => [r.name, r.lineCount, r.qty, r.revenue, r.cost, r.margin]),
      },
      'Product_Sell_By_Brand'
    );
  }, [view, buildExportDetailed, byDateRows, byCategoryRows, byBrandRows]);

  const handleExportExcel = useCallback(() => {
    const withPurchase = view === 'detailed_with_purchase';
    if (view === 'detailed' || view === 'detailed_with_purchase') {
      exportToExcel(buildExportDetailed(withPurchase), 'Product_Sell_Report');
      return;
    }
    if (view === 'by_date') {
      exportToExcel(
        {
          title: 'Product Sell — By Date',
          headers: ['Date', 'Lines', 'Qty (sum)', 'Revenue', 'Tax', 'Discount', 'Cost (est.)'],
          rows: byDateRows.map((r) => [r.date, r.lineCount, r.qty, r.revenue, r.tax, r.discount, r.cost]),
        },
        'Product_Sell_By_Date'
      );
      return;
    }
    if (view === 'by_category') {
      exportToExcel(
        {
          title: 'Product Sell — By Category',
          headers: ['Category', 'Lines', 'Qty (sum)', 'Revenue', 'Cost (est.)', 'Margin (est.)'],
          rows: byCategoryRows.map((r) => [r.name, r.lineCount, r.qty, r.revenue, r.cost, r.margin]),
        },
        'Product_Sell_By_Category'
      );
      return;
    }
    exportToExcel(
      {
        title: 'Product Sell — By Brand',
        headers: ['Brand', 'Lines', 'Qty (sum)', 'Revenue', 'Cost (est.)', 'Margin (est.)'],
        rows: byBrandRows.map((r) => [r.name, r.lineCount, r.qty, r.revenue, r.cost, r.margin]),
      },
      'Product_Sell_By_Brand'
    );
  }, [view, buildExportDetailed, byDateRows, byCategoryRows, byBrandRows]);

  const handleExportPdf = useCallback(() => {
    const withPurchase = view === 'detailed_with_purchase';
    if (view === 'detailed' || view === 'detailed_with_purchase') {
      exportToPDF(buildExportDetailed(withPurchase), 'Product_Sell_Report');
      return;
    }
    if (view === 'by_date') {
      exportToPDF(
        {
          title: 'Product Sell — By Date',
          headers: ['Date', 'Lines', 'Qty', 'Revenue', 'Tax', 'Discount', 'Cost'],
          rows: byDateRows.map((r) => [r.date, r.lineCount, r.qty, r.revenue, r.tax, r.discount, r.cost]),
        },
        'Product_Sell_By_Date'
      );
      return;
    }
    if (view === 'by_category') {
      exportToPDF(
        {
          title: 'Product Sell — By Category',
          headers: ['Category', 'Lines', 'Qty', 'Revenue', 'Cost', 'Margin'],
          rows: byCategoryRows.map((r) => [r.name, r.lineCount, r.qty, r.revenue, r.cost, r.margin]),
        },
        'Product_Sell_By_Category'
      );
      return;
    }
    exportToPDF(
      {
        title: 'Product Sell — By Brand',
        headers: ['Brand', 'Lines', 'Qty', 'Revenue', 'Cost', 'Margin'],
        rows: byBrandRows.map((r) => [r.name, r.lineCount, r.qty, r.revenue, r.cost, r.margin]),
      },
      'Product_Sell_By_Brand'
    );
  }, [view, buildExportDetailed, byDateRows, byCategoryRows, byBrandRows]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
        <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
        <span>Loading product sell report…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300" id="product-sell-report-root">
      <ReportActions
        title="Product Sell Report"
        onPdf={handleExportPdf}
        onExcel={handleExportExcel}
        onCsv={handleExportCsv}
      />

      {truncated && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Row cap reached: only the most recent <strong>4,000</strong> final invoices in this date range were loaded (
          <strong>{saleCount}</strong> invoices fetched). Narrow the date range or export in batches for full coverage.
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setView(t.key)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent',
              view === t.key
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-800 border-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, customer, SKU, product…"
            className="pl-9 bg-gray-950 border-gray-700 text-white"
          />
        </div>
        {(view === 'detailed' || view === 'detailed_with_purchase') && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-gray-950 border border-gray-700 rounded-md px-2 py-1.5 text-white"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/40 print:bg-white print:text-black">
        {view === 'detailed' && (
          <table className="w-full text-left text-xs min-w-[1100px]">
            <thead className="bg-gray-950/90 text-gray-400 uppercase tracking-wide border-b border-gray-800">
              <tr>
                <th className="px-2 py-2 whitespace-nowrap">Date</th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Invoice</th>
                <th className="px-2 py-2">Bill no</th>
                <th className="px-2 py-2">SKU</th>
                <th className="px-2 py-2 min-w-[140px]">Product</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Unit price</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2">Payment</th>
                <th className="px-2 py-2">Contact ID</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2 text-right">Discount</th>
                <th className="px-2 py-2 text-right">Tax</th>
                <th className="px-2 py-2 text-right">Price inc. tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-200">
              {detailSlice.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-10 text-center text-gray-500">
                    No line items in this period
                  </td>
                </tr>
              ) : (
                detailSlice.map((l) => (
                  <tr key={l.rowKey} className="hover:bg-gray-800/40">
                    <td className="px-2 py-2 whitespace-nowrap">{l.date ? formatDate(new Date(`${l.date}T12:00:00`)) : '—'}</td>
                    <td className="px-2 py-2 max-w-[120px] truncate" title={l.customerName}>
                      {l.customerName}
                    </td>
                    <td className="px-2 py-2 font-mono text-blue-300">{l.invoiceNo}</td>
                    <td className="px-2 py-2 font-mono text-gray-400">{l.billNo}</td>
                    <td className="px-2 py-2 font-mono">{l.sku}</td>
                    <td className="px-2 py-2">{l.productName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.unitLabel}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(l.unitPrice)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium text-white">
                      {formatCurrency(l.lineTotal)}
                    </td>
                    <td className="px-2 py-2 max-w-[100px] truncate" title={l.paymentMethod}>
                      {l.paymentMethod}
                    </td>
                    <td className="px-2 py-2 font-mono text-gray-400">{l.contactCode}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{l.contactNumber}</td>
                    <td className="px-2 py-2 max-w-[100px] truncate">{l.contactEmail}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(l.lineDiscount)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(l.lineTax)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(l.priceIncTaxPerUnit)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {detailSlice.length > 0 && (
              <tfoot className="bg-gray-950/95 border-t border-gray-800 text-gray-300 font-semibold">
                <tr>
                  <td colSpan={6} className="px-2 py-2 text-right">
                    Totals ({totals.lines} lines)
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{totals.qty}</td>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 text-right tabular-nums text-white">{formatCurrency(totals.revenue)}</td>
                  <td colSpan={3} />
                  <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totals.discount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totals.tax)}</td>
                  <td className="px-2 py-2" />
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {view === 'detailed_with_purchase' && (
          <table className="w-full text-left text-xs min-w-[1280px]">
            <thead className="bg-gray-950/90 text-gray-400 uppercase tracking-wide border-b border-gray-800">
              <tr>
                <th className="px-2 py-2 whitespace-nowrap">Date</th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Invoice</th>
                <th className="px-2 py-2">Bill no</th>
                <th className="px-2 py-2">SKU</th>
                <th className="px-2 py-2 min-w-[120px]">Product</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Unit price</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2 text-right">Unit cost</th>
                <th className="px-2 py-2 text-right">Line cost</th>
                <th className="px-2 py-2 text-right">Margin</th>
                <th className="px-2 py-2">Payment</th>
                <th className="px-2 py-2">Contact</th>
                <th className="px-2 py-2 text-right">Disc.</th>
                <th className="px-2 py-2 text-right">Tax</th>
                <th className="px-2 py-2 text-right">Price inc. tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-200">
              {detailSlice.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-4 py-10 text-center text-gray-500">
                    No line items
                  </td>
                </tr>
              ) : (
                detailSlice.map((l) => (
                  <tr key={l.rowKey} className="hover:bg-gray-800/40">
                    <td className="px-2 py-2 whitespace-nowrap">{l.date ? formatDate(new Date(`${l.date}T12:00:00`)) : '—'}</td>
                    <td className="px-2 py-2 max-w-[100px] truncate">{l.customerName}</td>
                    <td className="px-2 py-2 font-mono text-blue-300">{l.invoiceNo}</td>
                    <td className="px-2 py-2 font-mono">{l.billNo}</td>
                    <td className="px-2 py-2 font-mono">{l.sku}</td>
                    <td className="px-2 py-2">{l.productName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.unitLabel}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(l.unitPrice)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-white">{formatCurrency(l.lineTotal)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-amber-200/90">{formatCurrency(l.unitCost)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-amber-200/90">{formatCurrency(l.lineCost)}</td>
                    <td
                      className={cn(
                        'px-2 py-2 text-right tabular-nums font-medium',
                        l.lineMargin >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {formatCurrency(l.lineMargin)}
                    </td>
                    <td className="px-2 py-2 max-w-[90px] truncate">{l.paymentMethod}</td>
                    <td className="px-2 py-2 font-mono text-[10px] text-gray-400">{l.contactCode}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(l.lineDiscount)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(l.lineTax)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(l.priceIncTaxPerUnit)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {detailSlice.length > 0 && (
              <tfoot className="bg-gray-950/95 border-t border-gray-800 text-gray-300 font-semibold">
                <tr>
                  <td colSpan={8} className="px-2 py-2 text-right">
                    Totals
                  </td>
                  <td className="px-2 py-2 text-right text-white">{formatCurrency(totals.revenue)}</td>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 text-right text-amber-200/90">{formatCurrency(totals.cost)}</td>
                  <td
                    className={cn(
                      'px-2 py-2 text-right',
                      totals.margin >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}
                  >
                    {formatCurrency(totals.margin)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {view === 'by_date' && (
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="bg-gray-950/90 text-gray-400 border-b border-gray-800">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Lines</th>
                <th className="px-3 py-2 text-right">Qty (sum)</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Cost (est.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {byDateRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No data
                  </td>
                </tr>
              ) : (
                byDateRows.map((r) => (
                  <tr key={r.date} className="text-gray-200 hover:bg-gray-800/30">
                    <td className="px-3 py-2">{r.date ? formatDate(new Date(`${r.date}T12:00:00`)) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.lineCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.qty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.revenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.tax)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.discount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-200/90">{formatCurrency(r.cost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {view === 'by_category' && (
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="bg-gray-950/90 text-gray-400 border-b border-gray-800">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Lines</th>
                <th className="px-3 py-2 text-right">Qty (sum)</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">Cost (est.)</th>
                <th className="px-3 py-2 text-right">Margin (est.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {byCategoryRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No data
                  </td>
                </tr>
              ) : (
                byCategoryRows.map((r) => (
                  <tr key={r.name} className="text-gray-200 hover:bg-gray-800/30">
                    <td className="px-3 py-2 font-medium text-white">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.lineCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.qty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.revenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.cost)}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums font-medium',
                        r.margin >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {formatCurrency(r.margin)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {view === 'by_brand' && (
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="bg-gray-950/90 text-gray-400 border-b border-gray-800">
              <tr>
                <th className="px-3 py-2">Brand</th>
                <th className="px-3 py-2 text-right">Lines</th>
                <th className="px-3 py-2 text-right">Qty (sum)</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">Cost (est.)</th>
                <th className="px-3 py-2 text-right">Margin (est.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {byBrandRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No data
                  </td>
                </tr>
              ) : (
                byBrandRows.map((r) => (
                  <tr key={r.name} className="text-gray-200 hover:bg-gray-800/30">
                    <td className="px-3 py-2 font-medium text-white">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.lineCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.qty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.revenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.cost)}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums font-medium',
                        r.margin >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {formatCurrency(r.margin)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {(view === 'detailed' || view === 'detailed_with_purchase') && filteredLines.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
          <span>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredLines.length)} of{' '}
            {filteredLines.length} entries
          </span>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border-gray-700"
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="border-gray-700"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-600">
        Cost and margin use current <code className="text-gray-500">products.cost_price</code> (or legacy{' '}
        <code className="text-gray-500">cost</code>) × quantity — informational, not historical FIFO cost.
      </p>
    </div>
  );
};
