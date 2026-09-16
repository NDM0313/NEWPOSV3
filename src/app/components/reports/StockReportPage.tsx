/**
 * Stock Report Page
 * Display-only flat table showing every product/variation as its own row.
 * Summary cards: Closing Stock (cost & retail), Potential Profit, Profit Margin %.
 * Movement aggregates: Total Sold, Transferred, Adjusted per row.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, Loader2, FileBarChart, TrendingUp, DollarSign, Percent, BarChart3,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { useSupabase } from '../../context/SupabaseContext';
import { useSettings } from '../../context/SettingsContext';
import { useNavigation } from '../../context/NavigationContext';
import {
  inventoryService,
  InventoryOverviewRow,
  MovementAggregate,
} from '../../services/inventoryService';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { exportToCSV, exportToExcel, ExportData } from '../../utils/exportUtils';
import { ListToolbar } from '../ui/list-toolbar';
import { Pagination } from '../ui/pagination';
import { toast } from 'sonner';
import { PdfPreviewModal, type PdfPreviewOrientation } from '@/app/components/shared/PdfPreviewModal';
import { TabularReportPreview } from './shared/TabularReportPreview';
import { buildTabularPrintSnapshot } from './shared/buildTabularPrintSnapshot';
import { useReportExport } from './shared/useReportExport';
import { formatQty } from '@/app/utils/quantity';

// --------------- Types ---------------

interface StockReportRow {
  productId: string;
  variationId: string | null;
  sku: string;
  productName: string;
  variationLabel: string;
  category: string;
  unit: string;
  sellingPrice: number;
  purchasePrice: number;
  currentStock: number;
  stockValueAtCost: number;
  stockValueAtRetail: number;
  totalSold: number;
  totalTransferred: number;
  totalAdjusted: number;
}

// --------------- Component ---------------

export const StockReportPage = () => {
  const { companyId, branchId } = useSupabase();
  const { inventorySettings } = useSettings();
  const { setCurrentView } = useNavigation();
  const { formatCurrency } = useFormatCurrency();
  const reportExport = useReportExport({ companyId, documentType: 'ledger', reportKind: 'stock' });
  const [printOrientation, setPrintOrientation] = useState<PdfPreviewOrientation>('landscape');
  const tabularPrint = reportExport.tabularPrintOptions;
  const enablePacking = inventorySettings.enablePacking;

  useEffect(() => {
    setPrintOrientation(tabularPrint.orientation);
  }, [tabularPrint.orientation]);

  // Data state
  const [overviewRows, setOverviewRows] = useState<InventoryOverviewRow[]>([]);
  const [aggregates, setAggregates] = useState<MovementAggregate[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter/UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    sku: true, product: true, variation: true, category: true, unit: true,
    sellingPrice: true, purchasePrice: true, currentStock: true,
    stockValueCost: true, stockValueRetail: true,
    totalSold: true, totalTransferred: true, totalAdjusted: true,
  });

  // --------------- Data Loading ---------------

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const br = branchId === 'all' ? null : branchId || null;
      const [overview, movAgg] = await Promise.all([
        inventoryService.getInventoryOverview(companyId, br),
        inventoryService.getMovementAggregates(companyId, br),
      ]);
      setOverviewRows(overview);
      setAggregates(movAgg);
    } catch (err: any) {
      console.error('[STOCK REPORT] Load error:', err);
      toast.error('Failed to load stock report: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    if (companyId) void reportExport.ensureBrand();
  }, [companyId, reportExport.ensureBrand]);

  useEffect(() => {
    if (companyId) loadData();
    else setLoading(false);
  }, [companyId, loadData]);

  useEffect(() => {
    const refresh = () => { if (companyId) loadData(); };
    window.addEventListener('inventory-updated', refresh);
    window.addEventListener('products-updated', refresh);
    return () => {
      window.removeEventListener('inventory-updated', refresh);
      window.removeEventListener('products-updated', refresh);
    };
  }, [companyId, loadData]);

  // --------------- Flatten rows ---------------

  const flatRows = useMemo(() => {
    const aggMap = new Map<string, MovementAggregate>();
    aggregates.forEach(a => {
      aggMap.set(`${a.productId}:${a.variationId || ''}`, a);
    });

    const rows: StockReportRow[] = [];
    overviewRows.forEach(product => {
      if (product.hasVariations && product.variations?.length) {
        product.variations.forEach(v => {
          const agg = aggMap.get(`${product.productId}:${v.id}`) || { totalSold: 0, totalTransferred: 0, totalAdjusted: 0 };
          const attrEntries = typeof v.attributes === 'object' && v.attributes !== null
            ? Object.entries(v.attributes).filter(([, val]) => String(val).trim() !== '')
            : [];
          const attrLabel = attrEntries.map(([, val]) => val).join(' / ') || '-';
          rows.push({
            productId: product.productId,
            variationId: v.id,
            sku: v.sku || product.sku,
            productName: product.name,
            variationLabel: attrLabel,
            category: product.category,
            unit: product.unit,
            sellingPrice: v.sellingPrice,
            purchasePrice: v.purchasePrice,
            currentStock: v.stock,
            stockValueAtCost: v.stockValueAtCost,
            stockValueAtRetail: v.retailStockValue,
            totalSold: agg.totalSold,
            totalTransferred: agg.totalTransferred,
            totalAdjusted: agg.totalAdjusted,
          });
        });
      } else {
        const agg = aggMap.get(`${product.productId}:`) || { totalSold: 0, totalTransferred: 0, totalAdjusted: 0 };
        rows.push({
          productId: product.productId,
          variationId: null,
          sku: product.sku,
          productName: product.name,
          variationLabel: '-',
          category: product.category,
          unit: product.unit,
          sellingPrice: product.sellingPrice,
          purchasePrice: product.avgCost,
          currentStock: product.stock,
          stockValueAtCost: product.stockValue,
          stockValueAtRetail: product.stock * product.sellingPrice,
          totalSold: agg.totalSold,
          totalTransferred: agg.totalTransferred,
          totalAdjusted: agg.totalAdjusted,
        });
      }
    });
    return rows;
  }, [overviewRows, aggregates]);

  // --------------- Filters ---------------

  const uniqueCategories = useMemo(() => {
    const set = new Set(flatRows.map(r => r.category).filter(Boolean));
    return Array.from(set).sort();
  }, [flatRows]);

  const filteredRows = useMemo(() => {
    let list = flatRows;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(r =>
        r.productName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.variationLabel.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') list = list.filter(r => r.category === categoryFilter);
    if (statusFilter !== 'all') {
      list = list.filter(r => {
        if (statusFilter === 'Out') return r.currentStock <= 0;
        if (statusFilter === 'Low') return r.currentStock > 0 && r.currentStock <= 5;
        if (statusFilter === 'OK') return r.currentStock > 5;
        return true;
      });
    }
    return list;
  }, [flatRows, searchTerm, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize) || 1);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // --------------- Summary Cards ---------------

  const summary = useMemo(() => {
    const closingCost = filteredRows.reduce((s, r) => s + r.stockValueAtCost, 0);
    const closingRetail = filteredRows.reduce((s, r) => s + r.stockValueAtRetail, 0);
    const potentialProfit = closingRetail - closingCost;
    const profitMargin = closingRetail > 0 ? (potentialProfit / closingRetail) * 100 : 0;
    return { closingCost, closingRetail, potentialProfit, profitMargin };
  }, [filteredRows]);

  // --------------- Columns ---------------

  const filterActiveCount = [categoryFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length;

  const columnsList = useMemo(() => [
    { key: 'sku', label: 'SKU', align: 'left' as const },
    { key: 'product', label: 'Product', align: 'left' as const },
    { key: 'variation', label: 'Variation', align: 'left' as const },
    { key: 'category', label: 'Category', align: 'left' as const },
    { key: 'unit', label: 'Unit', align: 'center' as const },
    { key: 'purchasePrice', label: 'Purchase Price', align: 'right' as const },
    { key: 'sellingPrice', label: 'Selling Price', align: 'right' as const },
    { key: 'currentStock', label: 'Current Stock', align: 'center' as const },
    { key: 'stockValueCost', label: 'Value (Cost)', align: 'right' as const },
    { key: 'stockValueRetail', label: 'Value (Retail)', align: 'right' as const },
    { key: 'totalSold', label: 'Total Sold', align: 'center' as const },
    { key: 'totalTransferred', label: 'Total Transferred', align: 'center' as const },
    { key: 'totalAdjusted', label: 'Total Adjusted', align: 'center' as const },
  ], []);

  const visibleCols = columnsList.filter(c => visibleColumns[c.key] !== false).map(c => c.key);

  const stockRowValue = useCallback(
    (row: StockReportRow, key: string, forExport = false): string | number => {
      switch (key) {
        case 'sku': return row.sku;
        case 'product': return row.productName;
        case 'variation': return row.variationLabel;
        case 'category': return row.category;
        case 'unit': return row.unit;
        case 'purchasePrice': return forExport ? row.purchasePrice : formatCurrency(row.purchasePrice);
        case 'sellingPrice': return forExport ? row.sellingPrice : formatCurrency(row.sellingPrice);
        case 'currentStock': return row.currentStock;
        case 'stockValueCost': return forExport ? row.stockValueAtCost : formatCurrency(row.stockValueAtCost);
        case 'stockValueRetail': return forExport ? row.stockValueAtRetail : formatCurrency(row.stockValueAtRetail);
        case 'totalSold': return row.totalSold;
        case 'totalTransferred': return row.totalTransferred;
        case 'totalAdjusted': return row.totalAdjusted;
        default: return '';
      }
    },
    [formatCurrency],
  );

  const stockCurrencyFormatCell = useCallback(
    (key: string, value: string | number): string | number => {
      if (typeof value !== 'number') return value;
      if (['purchasePrice', 'sellingPrice', 'stockValueCost', 'stockValueRetail'].includes(key)) {
        return formatCurrency(value);
      }
      return value;
    },
    [formatCurrency],
  );

  const buildStockExportData = useCallback((): ExportData => {
    const snap = buildTabularPrintSnapshot({
      allColumns: columnsList,
      visibleColumns,
      rows: filteredRows,
      cellValue: stockRowValue,
    });
    return {
      title: 'Stock Report',
      headers: snap.columns.map((c) => c.label),
      rows: snap.rows,
    };
  }, [columnsList, visibleColumns, filteredRows, stockRowValue]);

  const previewTable = useMemo(
    () =>
      buildTabularPrintSnapshot({
        allColumns: columnsList,
        visibleColumns,
        rows: filteredRows,
        cellValue: stockRowValue,
        formatCell: stockCurrencyFormatCell,
      }),
    [columnsList, visibleColumns, filteredRows, stockRowValue, stockCurrencyFormatCell],
  );

  // --------------- Export ---------------

  const handleExportCSV = useCallback(() => {
    exportToCSV(buildStockExportData(), 'Stock_Report');
    toast.success('CSV exported');
  }, [buildStockExportData]);

  const handleExportExcel = useCallback(() => {
    exportToExcel(buildStockExportData(), 'Stock_Report');
    toast.success('Excel exported');
  }, [buildStockExportData]);

  const handleExportPDF = useCallback(async () => {
    await reportExport.preparePrint();
    void reportExport.openPreview();
  }, [reportExport]);

  // --------------- Number formatting ---------------

  const fmtQty = formatQty;

  // --------------- Render ---------------

  return (
    <div className="flex flex-col h-full min-h-0 bg-secondary">
      {reportExport.previewOpen && reportExport.brand ? (
        <PdfPreviewModal
          open={reportExport.previewOpen}
          onClose={reportExport.closePreview}
          title="Stock Report"
          documentType="ledger"
          reference="Stock"
          format={reportExport.printFormat}
          orientation={printOrientation}
          showOrientationToggle
          onOrientationChange={setPrintOrientation}
          fitSinglePage={filteredRows.length <= 50}
          pageNumbers={tabularPrint.showFooter}
        >
          <TabularReportPreview
            brand={reportExport.brand}
            title="Stock Report"
            subtitle={`${filteredRows.length} product row(s)`}
            generatedAt={new Date().toLocaleString()}
            columns={previewTable.columns}
            rows={previewTable.rows}
            fieldVisibility={tabularPrint.fieldVisibility}
            showHeader={tabularPrint.showHeader}
            showFooter={tabularPrint.showFooter}
            compact={filteredRows.length <= 50}
            fontSize={tabularPrint.fontSize}
            dataListFontSize={tabularPrint.dataListFontSize}
            tableHeaderFontSize={tabularPrint.tableHeaderFontSize}
            summaryFontSize={tabularPrint.summaryFontSize}
            columnPaddingPx={tabularPrint.columnPaddingPx}
            showCurrencySymbol={tabularPrint.showCurrencySymbol}
            fontFamily={tabularPrint.fontFamily}
            margins={tabularPrint.margins}
            orientation={printOrientation}
            stats={[
              { label: 'Closing (Cost)', value: formatCurrency(summary.closingCost) },
              { label: 'Closing (Retail)', value: formatCurrency(summary.closingRetail) },
              { label: 'Potential Profit', value: formatCurrency(summary.potentialProfit) },
              { label: 'Margin %', value: `${summary.profitMargin.toFixed(2)}%` },
            ]}
          />
        </PdfPreviewModal>
      ) : null}

      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileBarChart className="text-blue-400" size={24} />
            Stock Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete inventory overview with stock values and movement summary</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 border-border text-muted-foreground" onClick={() => setCurrentView('inventory')}>
            <Package size={16} />
            Inventory
          </Button>
          <Button variant="outline" className="gap-2 border-border text-muted-foreground" onClick={() => setCurrentView('inventory-analytics-test')}>
            <BarChart3 size={16} />
            Analytics
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="shrink-0 px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Closing Stock (Purchase Price)"
          value={formatCurrency(summary.closingCost)}
          icon={<DollarSign size={20} />}
          color="blue"
        />
        <SummaryCard
          title="Closing Stock (Sale Price)"
          value={formatCurrency(summary.closingRetail)}
          icon={<DollarSign size={20} />}
          color="green"
        />
        <SummaryCard
          title="Potential Profit"
          value={formatCurrency(summary.potentialProfit)}
          icon={<TrendingUp size={20} />}
          color="emerald"
        />
        <SummaryCard
          title="Profit Margin %"
          value={`${summary.profitMargin.toFixed(2)}%`}
          icon={<Percent size={20} />}
          color="purple"
        />
      </div>

      {/* Toolbar */}
      <div className="shrink-0 border-b border-border">
        <ListToolbar
          search={{ value: searchTerm, onChange: setSearchTerm, placeholder: 'Search by product name, SKU, or variation...' }}
          rowsSelector={{
            value: pageSize,
            onChange: handlePageSizeChange,
            totalItems: filteredRows.length,
            options: [25, 50, 100],
            showAllOption: false,
          }}
          columnsManager={{
            columns: columnsList,
            visibleColumns,
            onToggle: (key) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] })),
            onShowAll: () => setVisibleColumns(prev => Object.fromEntries(Object.keys(prev).map(k => [k, true]))),
          }}
          filter={{
            isOpen: filterOpen,
            onToggle: () => setFilterOpen(o => !o),
            activeCount: filterActiveCount,
            renderPanel: () => (
              <div className="absolute right-0 top-12 w-72 bg-card border border-border rounded-lg shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Filters</h3>
                  <button onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); }} className="text-xs text-blue-400 hover:text-blue-300">Clear All</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground block font-medium mb-1">Category</label>
                    <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full rounded-md bg-muted border border-border text-foreground text-sm px-3 py-2">
                      <option value="all">All categories</option>
                      {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block font-medium mb-1">Stock Status</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full rounded-md bg-muted border border-border text-foreground text-sm px-3 py-2">
                      <option value="all">All</option>
                      <option value="OK">In Stock</option>
                      <option value="Low">Low Stock</option>
                      <option value="Out">Out of Stock</option>
                    </select>
                  </div>
                </div>
              </div>
            ),
          }}
          exportConfig={{
            onExportCSV: handleExportCSV,
            onExportExcel: handleExportExcel,
            onExportPDF: handleExportPDF,
          }}
        />
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col px-6 py-4">
        <div className="flex-1 min-h-0 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full min-w-[1200px] text-base leading-snug">
              <thead className="bg-muted/40 border-b border-border sticky top-0 z-10">
                <tr>
                  {visibleCols.includes('sku') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-left min-w-[120px]">SKU</th>}
                  {visibleCols.includes('product') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-left min-w-[180px]">Product</th>}
                  {visibleCols.includes('variation') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-left min-w-[140px]">Variation</th>}
                  {visibleCols.includes('category') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-left">Category</th>}
                  {visibleCols.includes('unit') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-center">Unit</th>}
                  {visibleCols.includes('purchasePrice') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-right">Purchase Price</th>}
                  {visibleCols.includes('sellingPrice') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-right">Selling Price</th>}
                  {visibleCols.includes('currentStock') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-center">Current Stock</th>}
                  {visibleCols.includes('stockValueCost') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-right">Value (Cost)</th>}
                  {visibleCols.includes('stockValueRetail') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-right">Value (Retail)</th>}
                  {visibleCols.includes('totalSold') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-center">Total Sold</th>}
                  {visibleCols.includes('totalTransferred') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-center">Total Transferred</th>}
                  {visibleCols.includes('totalAdjusted') && <th className="px-4 py-3 text-base font-medium text-muted-foreground uppercase text-center">Total Adjusted</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={visibleCols.length} className="px-6 py-12 text-center">
                      <Loader2 size={40} className="mx-auto text-blue-500 animate-spin mb-2" />
                      <p className="text-muted-foreground text-sm">Loading stock report...</p>
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 && filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCols.length} className="px-6 py-12 text-center">
                      <Package size={40} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground text-sm">No products found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <tr key={`${row.productId}-${row.variationId || 'base'}-${idx}`} className="hover:bg-accent/30 transition-colors">
                      {visibleCols.includes('sku') && (
                        <td className="px-4 py-3 text-muted-foreground font-mono text-base whitespace-nowrap">{row.sku}</td>
                      )}
                      {visibleCols.includes('product') && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground text-base leading-tight">{row.productName}</div>
                        </td>
                      )}
                      {visibleCols.includes('variation') && (
                        <td className="px-4 py-3">
                          {row.variationLabel !== '-' ? (
                            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs">{row.variationLabel}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      )}
                      {visibleCols.includes('category') && (
                        <td className="px-4 py-3">
                          <Badge className="bg-muted/50 text-muted-foreground border-gray-600 text-xs">{row.category}</Badge>
                        </td>
                      )}
                      {visibleCols.includes('unit') && (
                        <td className="px-4 py-3 text-center text-muted-foreground text-base">{row.unit}</td>
                      )}
                      {visibleCols.includes('purchasePrice') && (
                        <td className={cn('px-4 py-3 text-right text-base font-medium tabular-nums', row.purchasePrice < 0 ? 'text-red-400' : 'text-[var(--erp-money-positive)]')}>
                          {formatCurrency(row.purchasePrice)}
                        </td>
                      )}
                      {visibleCols.includes('sellingPrice') && (
                        <td className={cn('px-4 py-3 text-right text-base font-medium tabular-nums', row.sellingPrice < 0 ? 'text-red-400' : 'text-[var(--erp-money-positive)]')}>
                          {formatCurrency(row.sellingPrice)}
                        </td>
                      )}
                      {visibleCols.includes('currentStock') && (
                        <td className="px-4 py-3 text-center">
                          <span className={cn('font-semibold tabular-nums text-base', row.currentStock <= 0 ? 'text-red-400' : 'text-foreground')}>
                            {fmtQty(row.currentStock)}
                          </span>
                        </td>
                      )}
                      {visibleCols.includes('stockValueCost') && (
                        <td className={cn('px-4 py-3 text-right text-base font-medium tabular-nums', row.stockValueAtCost < 0 ? 'text-red-400' : 'text-[var(--erp-money-positive)]')}>
                          {formatCurrency(row.stockValueAtCost)}
                        </td>
                      )}
                      {visibleCols.includes('stockValueRetail') && (
                        <td className={cn('px-4 py-3 text-right text-base font-medium tabular-nums', row.stockValueAtRetail < 0 ? 'text-red-400' : 'text-[var(--erp-money-positive)]')}>
                          {formatCurrency(row.stockValueAtRetail)}
                        </td>
                      )}
                      {visibleCols.includes('totalSold') && (
                        <td className="px-4 py-3 text-center text-base tabular-nums text-muted-foreground">{fmtQty(row.totalSold)}</td>
                      )}
                      {visibleCols.includes('totalTransferred') && (
                        <td className="px-4 py-3 text-center text-base tabular-nums text-muted-foreground">{fmtQty(row.totalTransferred)}</td>
                      )}
                      {visibleCols.includes('totalAdjusted') && (
                        <td className="px-4 py-3 text-center text-base tabular-nums text-muted-foreground">
                          <span className={row.totalAdjusted < 0 ? 'text-red-400' : row.totalAdjusted > 0 ? 'text-[var(--erp-money-positive)]' : ''}>
                            {fmtQty(row.totalAdjusted)}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {/* Table Footer Totals */}
              {!loading && filteredRows.length > 0 && (
                <tfoot className="bg-input-background/70 border-t-2 border-border">
                  <tr className="font-semibold text-base">
                    {visibleCols.includes('sku') && <td className="px-4 py-3 text-muted-foreground">Totals</td>}
                    {visibleCols.includes('product') && <td className="px-4 py-3 text-muted-foreground">{filteredRows.length} rows</td>}
                    {visibleCols.includes('variation') && <td className="px-4 py-3" />}
                    {visibleCols.includes('category') && <td className="px-4 py-3" />}
                    {visibleCols.includes('unit') && <td className="px-4 py-3" />}
                    {visibleCols.includes('purchasePrice') && <td className="px-4 py-3" />}
                    {visibleCols.includes('sellingPrice') && <td className="px-4 py-3" />}
                    {visibleCols.includes('currentStock') && (
                      <td className="px-4 py-3 text-center text-foreground tabular-nums">
                        {fmtQty(filteredRows.reduce((s, r) => s + r.currentStock, 0))}
                      </td>
                    )}
                    {visibleCols.includes('stockValueCost') && (
                      <td className="px-4 py-3 text-right text-[var(--erp-money-positive)] tabular-nums">
                        {formatCurrency(filteredRows.reduce((s, r) => s + r.stockValueAtCost, 0))}
                      </td>
                    )}
                    {visibleCols.includes('stockValueRetail') && (
                      <td className="px-4 py-3 text-right text-[var(--erp-money-positive)] tabular-nums">
                        {formatCurrency(filteredRows.reduce((s, r) => s + r.stockValueAtRetail, 0))}
                      </td>
                    )}
                    {visibleCols.includes('totalSold') && (
                      <td className="px-4 py-3 text-center text-foreground tabular-nums">
                        {fmtQty(filteredRows.reduce((s, r) => s + r.totalSold, 0))}
                      </td>
                    )}
                    {visibleCols.includes('totalTransferred') && (
                      <td className="px-4 py-3 text-center text-foreground tabular-nums">
                        {fmtQty(filteredRows.reduce((s, r) => s + r.totalTransferred, 0))}
                      </td>
                    )}
                    {visibleCols.includes('totalAdjusted') && (
                      <td className="px-4 py-3 text-center text-foreground tabular-nums">
                        {fmtQty(filteredRows.reduce((s, r) => s + r.totalAdjusted, 0))}
                      </td>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredRows.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
};

// --------------- Summary Card Sub-Component ---------------

const SummaryCard = ({ title, value, icon, color }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'emerald' | 'purple';
}) => {
  const colorMap = {
    blue: 'text-blue-400 bg-blue-500/10',
    green: 'text-[var(--erp-money-positive)] bg-green-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colorMap[color])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
          <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default StockReportPage;
