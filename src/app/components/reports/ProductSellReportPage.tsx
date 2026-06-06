import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ReportActions } from './ReportActions';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { exportToCSV, exportToExcel, type ExportData } from '@/app/utils/exportUtils';
import {
  fetchProductSellReport,
  type ProductSellReportLine,
} from '@/app/services/productSellReportService';
import { branchService } from '@/app/services/branchService';
import { PdfPreviewModal, type PdfPreviewOrientation } from '@/app/components/shared/PdfPreviewModal';
import { TabularReportPreview } from './shared/TabularReportPreview';
import { buildTabularPrintSnapshot } from './shared/buildTabularPrintSnapshot';
import { useReportExport } from './shared/useReportExport';

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

type ColumnDef = { key: string; label: string; align?: 'left' | 'right' };

const DETAILED_COLS: ColumnDef[] = [
  { key: 'date', label: 'Date' },
  { key: 'customer', label: 'Customer' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'billNo', label: 'Bill no' },
  { key: 'branch', label: 'Branch' },
  { key: 'salesman', label: 'Salesman' },
  { key: 'sku', label: 'SKU' },
  { key: 'product', label: 'Product' },
  { key: 'qty', label: 'Qty', align: 'right' },
  { key: 'unitPrice', label: 'Unit price', align: 'right' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'payment', label: 'Payment' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'discount', label: 'Discount', align: 'right' },
  { key: 'tax', label: 'Tax', align: 'right' },
  { key: 'priceIncTax', label: 'Price inc. tax', align: 'right' },
];

const PURCHASE_EXTRA_COLS: ColumnDef[] = [
  { key: 'unitCost', label: 'Unit cost', align: 'right' },
  { key: 'lineCost', label: 'Line cost', align: 'right' },
  { key: 'margin', label: 'Margin', align: 'right' },
];

const BY_DATE_COLS: ColumnDef[] = [
  { key: 'date', label: 'Date' },
  { key: 'lineCount', label: 'Lines', align: 'right' },
  { key: 'qty', label: 'Qty (sum)', align: 'right' },
  { key: 'revenue', label: 'Revenue', align: 'right' },
  { key: 'tax', label: 'Tax', align: 'right' },
  { key: 'discount', label: 'Discount', align: 'right' },
  { key: 'cost', label: 'Cost (est.)', align: 'right' },
];

const BY_CATEGORY_COLS: ColumnDef[] = [
  { key: 'name', label: 'Category' },
  { key: 'lineCount', label: 'Lines', align: 'right' },
  { key: 'qty', label: 'Qty (sum)', align: 'right' },
  { key: 'revenue', label: 'Revenue', align: 'right' },
  { key: 'cost', label: 'Cost (est.)', align: 'right' },
  { key: 'margin', label: 'Margin (est.)', align: 'right' },
];

const BY_BRAND_COLS: ColumnDef[] = [
  { key: 'name', label: 'Brand' },
  { key: 'lineCount', label: 'Lines', align: 'right' },
  { key: 'qty', label: 'Qty (sum)', align: 'right' },
  { key: 'revenue', label: 'Revenue', align: 'right' },
  { key: 'cost', label: 'Cost (est.)', align: 'right' },
  { key: 'margin', label: 'Margin (est.)', align: 'right' },
];

const DEFAULT_VISIBLE_DETAILED: Record<string, boolean> = {
  date: true,
  customer: true,
  invoice: true,
  billNo: true,
  branch: false,
  salesman: false,
  sku: true,
  product: true,
  qty: true,
  unitPrice: false,
  total: true,
  payment: false,
  phone: false,
  email: false,
  discount: false,
  tax: false,
  priceIncTax: false,
  unitCost: false,
  lineCost: false,
  margin: true,
};

function columnsForView(view: ProductSellView): ColumnDef[] {
  if (view === 'detailed_with_purchase') {
    const base = DETAILED_COLS.slice(0, 11);
    return [...base, ...PURCHASE_EXTRA_COLS, ...DETAILED_COLS.slice(11)];
  }
  if (view === 'by_date') return BY_DATE_COLS;
  if (view === 'by_category') return BY_CATEGORY_COLS;
  if (view === 'by_brand') return BY_BRAND_COLS;
  return DETAILED_COLS;
}

function customerExportLabel(l: ProductSellReportLine): string {
  const code = l.contactCode && l.contactCode !== '—' ? l.contactCode : '';
  return code ? `${l.customerName}\n${code}` : l.customerName;
}

function CustomerCell({ name, code }: { name: string; code: string }) {
  const showCode = code && code !== '—';
  return (
    <div className="min-w-0 max-w-[140px]">
      <div className="text-sm truncate" title={name}>
        {name}
      </div>
      {showCode ? (
        <div className="text-xs font-mono text-gray-500 truncate" title={code}>
          {code}
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  startDate: string;
  endDate: string;
  branchId?: string;
};

export const ProductSellReportPage: React.FC<Props> = ({ startDate, endDate, branchId }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const reportExport = useReportExport({ companyId, documentType: 'ledger' });
  const [printOrientation, setPrintOrientation] = useState<PdfPreviewOrientation>('portrait');

  const [view, setView] = useState<ProductSellView>('detailed');

  useEffect(() => {
    setPrintOrientation(reportExport.reportExportSettings.productSellOrientation);
  }, [reportExport.reportExportSettings.productSellOrientation]);
  const [lines, setLines] = useState<ProductSellReportLine[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [saleCount, setSaleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_DETAILED);

  const effectiveBranch = branchId && branchId !== 'all' ? branchId : null;
  const periodLabel = `${startDate.slice(0, 10)} → ${endDate.slice(0, 10)}`;

  useEffect(() => {
    if (companyId) void reportExport.ensureBrand();
  }, [companyId, reportExport.ensureBrand]);

  useEffect(() => {
    if (!companyId) return;
    branchService
      .getAllBranches(companyId)
      .then((branches) => {
        if (branches.length > 1) {
          setVisibleColumns((prev) => ({ ...prev, branch: true }));
        }
      })
      .catch(() => {});
  }, [companyId]);

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
        l.branchName,
        l.salesmanName,
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

  const activeColumns = useMemo(() => columnsForView(view), [view]);
  const columnsList = useMemo(() => activeColumns.map((c) => ({ key: c.key, label: c.label })), [activeColumns]);
  const visibleCols = useMemo(
    () => activeColumns.filter((c) => visibleColumns[c.key] !== false).map((c) => c.key),
    [activeColumns, visibleColumns],
  );

  const fmtDateCell = useCallback(
    (d: string) => (d ? formatDate(new Date(`${d}T12:00:00`)) : '—'),
    [formatDate],
  );

  const lineCellValue = useCallback(
    (l: ProductSellReportLine, key: string, forExport = false): string | number => {
      switch (key) {
        case 'date':
          return forExport ? l.date : fmtDateCell(l.date);
        case 'customer':
          return forExport ? customerExportLabel(l) : l.customerName;
        case 'invoice':
          return l.invoiceNo;
        case 'billNo':
          return l.billNo;
        case 'branch':
          return l.branchName;
        case 'salesman':
          return l.salesmanName;
        case 'sku':
          return l.sku;
        case 'product':
          return l.productName;
        case 'qty':
          return l.unitLabel;
        case 'unitPrice':
          return l.unitPrice;
        case 'total':
          return l.lineTotal;
        case 'payment':
          return l.paymentMethod;
        case 'phone':
          return l.contactNumber;
        case 'email':
          return l.contactEmail;
        case 'discount':
          return l.lineDiscount;
        case 'tax':
          return l.lineTax;
        case 'priceIncTax':
          return l.priceIncTaxPerUnit;
        case 'unitCost':
          return l.unitCost;
        case 'lineCost':
          return l.lineCost;
        case 'margin':
          return l.lineMargin;
        default:
          return '';
      }
    },
    [fmtDateCell],
  );

  const groupedCellValue = useCallback(
    (row: Record<string, string | number>, key: string): string | number => {
      if (key === 'date') return fmtDateCell(String(row.date ?? ''));
      return row[key] ?? '';
    },
    [fmtDateCell],
  );

  const exportRows = useMemo(() => {
    if (view === 'detailed' || view === 'detailed_with_purchase') return filteredLines;
    if (view === 'by_date') return byDateRows;
    if (view === 'by_category') return byCategoryRows;
    return byBrandRows;
  }, [view, filteredLines, byDateRows, byCategoryRows, byBrandRows]);

  const exportCellValue = useCallback(
    (row: ProductSellReportLine | Record<string, string | number>, key: string, forExport?: boolean): string | number => {
      if (view === 'detailed' || view === 'detailed_with_purchase') {
        return lineCellValue(row as ProductSellReportLine, key, forExport);
      }
      return groupedCellValue(row as Record<string, string | number>, key);
    },
    [view, lineCellValue, groupedCellValue],
  );

  const currencyFormatCell = useCallback(
    (key: string, value: string | number): string | number => {
      if (typeof value !== 'number') return value;
      if (view === 'detailed' || view === 'detailed_with_purchase') {
        if (['unitPrice', 'total', 'discount', 'tax', 'priceIncTax', 'unitCost', 'lineCost', 'margin'].includes(key)) {
          return formatCurrency(value);
        }
        return value;
      }
      if (key !== 'lineCount' && key !== 'qty') return formatCurrency(value);
      return value;
    },
    [view, formatCurrency],
  );

  const exportTitle = useMemo(() => {
    if (view === 'detailed' || view === 'detailed_with_purchase') {
      return `Product Sell Report — ${view === 'detailed_with_purchase' ? 'Detailed (with purchase)' : 'Detailed'} (${periodLabel})`;
    }
    if (view === 'by_date') return `Product Sell — By Date (${periodLabel})`;
    if (view === 'by_category') return `Product Sell — By Category (${periodLabel})`;
    return `Product Sell — By Brand (${periodLabel})`;
  }, [view, periodLabel]);

  const buildExportData = useCallback((): ExportData => {
    const snap = buildTabularPrintSnapshot({
      allColumns: activeColumns,
      visibleColumns,
      rows: exportRows,
      cellValue: exportCellValue,
    });
    return {
      title: exportTitle,
      headers: snap.columns.map((c) => c.label),
      rows: snap.rows,
    };
  }, [activeColumns, visibleColumns, exportRows, exportCellValue, exportTitle]);

  const previewTable = useMemo(
    () =>
      buildTabularPrintSnapshot({
        allColumns: activeColumns,
        visibleColumns,
        rows: exportRows,
        cellValue: exportCellValue,
        formatCell: currencyFormatCell,
      }),
    [activeColumns, visibleColumns, exportRows, exportCellValue, currencyFormatCell],
  );

  const handleExportCsv = useCallback(() => {
    exportToCSV(buildExportData(), 'Product_Sell_Report');
  }, [buildExportData]);

  const handleExportExcel = useCallback(() => {
    exportToExcel(buildExportData(), 'Product_Sell_Report');
  }, [buildExportData]);

  const handleWhatsapp = useCallback(() => {
    reportExport.shareViaWhatsApp({
      title: 'Product Sell Report',
      reference: `PSR-${startDate.slice(0, 10)}`,
      period: periodLabel,
    });
  }, [reportExport, startDate, periodLabel]);

  const renderLineCell = (l: ProductSellReportLine, key: string) => {
    switch (key) {
      case 'customer':
        return <CustomerCell name={l.customerName} code={l.contactCode} />;
      case 'invoice':
        return <span className="font-mono text-blue-300">{l.invoiceNo}</span>;
      case 'billNo':
        return <span className="font-mono text-gray-400">{l.billNo}</span>;
      case 'branch':
        return (
          <span className="truncate max-w-[100px] block" title={l.branchName}>
            {l.branchName}
          </span>
        );
      case 'salesman':
        return (
          <span className="truncate max-w-[100px] block" title={l.salesmanName}>
            {l.salesmanName}
          </span>
        );
      case 'sku':
        return <span className="font-mono">{l.sku}</span>;
      case 'total':
        return <span className="font-medium text-white">{formatCurrency(l.lineTotal)}</span>;
      case 'unitPrice':
      case 'discount':
      case 'tax':
      case 'priceIncTax':
      case 'unitCost':
      case 'lineCost':
        return formatCurrency(Number(lineCellValue(l, key)));
      case 'margin':
        return (
          <span className={cn('font-medium', l.lineMargin >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {formatCurrency(l.lineMargin)}
          </span>
        );
      case 'qty':
        return <span className="tabular-nums">{l.unitLabel}</span>;
      case 'date':
        return <span className="whitespace-nowrap">{fmtDateCell(l.date)}</span>;
      default:
        return String(lineCellValue(l, key));
    }
  };

  const renderGroupedCell = (row: Record<string, string | number>, key: string) => {
    const v = groupedCellValue(row, key);
    if (key === 'name') return <span className="font-medium text-white">{v}</span>;
    if (typeof v === 'number' && key !== 'lineCount' && key !== 'qty') {
      const cls = key === 'margin' ? (v >= 0 ? 'text-emerald-400' : 'text-red-400') : key === 'cost' ? 'text-amber-200/90' : '';
      return <span className={cn('tabular-nums', cls)}>{formatCurrency(v)}</span>;
    }
    if (key === 'qty') return <span className="tabular-nums">{Number(v).toLocaleString()}</span>;
    return String(v);
  };

  const tabLabel = TABS.find((t) => t.key === view)?.label ?? view;
  const previewSubtitle = `${tabLabel} · ${filteredLines.length} line(s)`;
  const reportCompact = filteredLines.length <= 50;

  const previewStats = [
    { label: 'Lines', value: String(totals.lines) },
    { label: 'Revenue', value: formatCurrency(totals.revenue) },
    { label: 'Tax', value: formatCurrency(totals.tax) },
    { label: 'Discount', value: formatCurrency(totals.discount) },
  ];

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
        onPrint={reportExport.openPreview}
        onOpenPdfPreview={reportExport.openPreview}
        onExcel={handleExportExcel}
        onCsv={handleExportCsv}
        onWhatsapp={handleWhatsapp}
        pdfLoading={reportExport.loadingBrand}
        previewContentRef={reportExport.printRef}
        previewDocumentType="ledger"
        previewFormat={reportExport.printFormat}
        previewReference={`ProductSell-${startDate.slice(0, 10)}`}
      />

      {reportExport.previewOpen && reportExport.brand ? (
        <PdfPreviewModal
          open={reportExport.previewOpen}
          onClose={reportExport.closePreview}
          title="Product Sell Report"
          documentType="ledger"
          reference={`ProductSell-${startDate.slice(0, 10)}`}
          format={reportExport.printFormat}
          orientation={printOrientation}
          showOrientationToggle
          onOrientationChange={setPrintOrientation}
          fitSinglePage={reportCompact}
          pageNumbers={reportExport.reportExportSettings.showReportFooter !== false}
        >
          <TabularReportPreview
            brand={reportExport.brand}
            title="Product Sell Report"
            subtitle={previewSubtitle}
            periodLabel={periodLabel}
            generatedAt={new Date().toLocaleString()}
            columns={previewTable.columns}
            rows={previewTable.rows}
            fieldVisibility={reportExport.fieldVisibility}
            showHeader={reportExport.reportExportSettings.showReportHeader !== false}
            showFooter={reportExport.reportExportSettings.showReportFooter !== false}
            compact={reportCompact}
            fontSize={reportExport.reportFontSize}
            orientation={printOrientation}
            stats={previewStats}
          />
        </PdfPreviewModal>
      ) : null}

      <div ref={reportExport.printRef} className="sr-only">
        {reportExport.brand ? (
          <TabularReportPreview
            brand={reportExport.brand}
            title="Product Sell Report"
            subtitle={previewSubtitle}
            periodLabel={periodLabel}
            generatedAt={new Date().toLocaleString()}
            columns={previewTable.columns}
            rows={previewTable.rows}
            fieldVisibility={reportExport.fieldVisibility}
            showHeader={reportExport.reportExportSettings.showReportHeader !== false}
            showFooter={reportExport.reportExportSettings.showReportFooter !== false}
            compact={reportCompact}
            fontSize={reportExport.reportFontSize}
            orientation={printOrientation}
            stats={previewStats}
          />
        ) : null}
      </div>

      {truncated && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Row cap reached: only the most recent <strong>4,000</strong> final invoices in this date range were loaded (
          <strong>{saleCount}</strong> invoices fetched). Narrow the date range or export in batches for full coverage.
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-3 no-print">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setView(t.key)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent',
              view === t.key
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-800 border-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ListToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search invoice, customer, SKU, product…',
        }}
        rowsSelector={{
          value: pageSize,
          onChange: setPageSize,
          totalItems: filteredLines.length,
          options: [25, 50, 100, 200],
          showAllOption: false,
        }}
        columnsManager={{
          columns: columnsList,
          visibleColumns,
          onToggle: (key) => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] })),
          onShowAll: () =>
            setVisibleColumns(Object.fromEntries(activeColumns.map((c) => [c.key, true]))),
        }}
      />

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/40 print:bg-white print:text-black">
        {(view === 'detailed' || view === 'detailed_with_purchase') && (
          <table className="w-full text-left text-base min-w-[900px] leading-snug">
            <thead className="bg-gray-950/90 text-gray-400 uppercase tracking-wide border-b border-gray-800">
              <tr>
                {activeColumns
                  .filter((c) => visibleCols.includes(c.key))
                  .map((c) => (
                    <th
                      key={c.key}
                      className={cn('px-2 py-2 whitespace-nowrap', c.align === 'right' && 'text-right')}
                    >
                      {c.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-200">
              {detailSlice.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length || 1} className="px-4 py-10 text-center text-gray-500">
                    No line items in this period
                  </td>
                </tr>
              ) : (
                detailSlice.map((l) => (
                  <tr key={l.rowKey} className="hover:bg-gray-800/40">
                    {visibleCols.map((key) => (
                      <td
                        key={key}
                        className={cn(
                          'px-2 py-2',
                          activeColumns.find((c) => c.key === key)?.align === 'right' && 'text-right tabular-nums',
                        )}
                      >
                        {renderLineCell(l, key)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {detailSlice.length > 0 && visibleCols.includes('total') ? (
              <tfoot className="bg-gray-950/95 border-t border-gray-800 text-gray-300 font-semibold">
                <tr>
                  {visibleCols.map((key, idx) => {
                    if (key === 'total') {
                      return (
                        <td key={key} className="px-2 py-2 text-right tabular-nums text-white">
                          {formatCurrency(totals.revenue)}
                        </td>
                      );
                    }
                    if (idx === 0) {
                      return (
                        <td key={key} colSpan={1} className="px-2 py-2">
                          Totals ({totals.lines} lines)
                        </td>
                      );
                    }
                    if (key === 'qty') {
                      return (
                        <td key={key} className="px-2 py-2 text-right tabular-nums">
                          {totals.qty}
                        </td>
                      );
                    }
                    if (key === 'discount') {
                      return (
                        <td key={key} className="px-2 py-2 text-right tabular-nums">
                          {formatCurrency(totals.discount)}
                        </td>
                      );
                    }
                    if (key === 'tax') {
                      return (
                        <td key={key} className="px-2 py-2 text-right tabular-nums">
                          {formatCurrency(totals.tax)}
                        </td>
                      );
                    }
                    if (key === 'margin' && view === 'detailed_with_purchase') {
                      return (
                        <td
                          key={key}
                          className={cn(
                            'px-2 py-2 text-right',
                            totals.margin >= 0 ? 'text-emerald-400' : 'text-red-400',
                          )}
                        >
                          {formatCurrency(totals.margin)}
                        </td>
                      );
                    }
                    if (key === 'lineCost' && view === 'detailed_with_purchase') {
                      return (
                        <td key={key} className="px-2 py-2 text-right text-amber-200/90">
                          {formatCurrency(totals.cost)}
                        </td>
                      );
                    }
                    return <td key={key} className="px-2 py-2" />;
                  })}
                </tr>
              </tfoot>
            ) : null}
          </table>
        )}

        {view === 'by_date' && (
          <GroupedTable
            columns={activeColumns}
            visibleCols={visibleCols}
            rows={byDateRows}
            renderCell={renderGroupedCell}
            emptyLabel="No data"
          />
        )}

        {view === 'by_category' && (
          <GroupedTable
            columns={activeColumns}
            visibleCols={visibleCols}
            rows={byCategoryRows}
            renderCell={renderGroupedCell}
            emptyLabel="No data"
          />
        )}

        {view === 'by_brand' && (
          <GroupedTable
            columns={activeColumns}
            visibleCols={visibleCols}
            rows={byBrandRows}
            renderCell={renderGroupedCell}
            emptyLabel="No data"
          />
        )}
      </div>

      {(view === 'detailed' || view === 'detailed_with_purchase') && filteredLines.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400 no-print">
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

      <p className="text-[10px] text-gray-600 no-print">
        Cost and margin use current <code className="text-gray-500">products.cost_price</code> (or legacy{' '}
        <code className="text-gray-500">cost</code>) × quantity — informational, not historical FIFO cost.
      </p>
    </div>
  );
};

function GroupedTable({
  columns,
  visibleCols,
  rows,
  renderCell,
  emptyLabel,
}: {
  columns: ColumnDef[];
  visibleCols: string[];
  rows: Record<string, string | number>[];
  renderCell: (row: Record<string, string | number>, key: string) => React.ReactNode;
  emptyLabel: string;
}) {
  const visible = columns.filter((c) => visibleCols.includes(c.key));
  return (
    <table className="w-full text-left text-base min-w-[640px] leading-snug">
      <thead className="bg-gray-950/90 text-gray-400 border-b border-gray-800">
        <tr>
          {visible.map((c) => (
            <th
              key={c.key}
              className={cn('px-3 py-2', c.align === 'right' && 'text-right')}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={visible.length || 1} className="px-4 py-8 text-center text-gray-500">
              {emptyLabel}
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i} className="text-gray-200 hover:bg-gray-800/30">
              {visible.map((c) => (
                <td
                  key={c.key}
                  className={cn('px-3 py-2', c.align === 'right' && 'text-right tabular-nums')}
                >
                  {renderCell(r, c.key)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
