import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Package, TrendingDown, DollarSign, AlertTriangle, 
  BarChart3, Search, Filter, Download, Warehouse, Loader2,
  ExternalLink, SlidersHorizontal, ArrowRightLeft, FileDown, Printer, List, Layers, Upload, Info
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn, formatBoxesPieces, formatDecimal } from "../ui/utils";
import { formatQty } from '@/app/utils/quantity';
import { useSupabase } from '../../context/SupabaseContext';
import { useSettings } from '../../context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { AdaptiveCurrencyValue } from '@/app/components/shared/AdaptiveCurrencyValue';
import { productService } from '../../services/productService';
import { inventoryService, createStockTransfer, InventoryOverviewRow, InventoryMovementRow } from '../../services/inventoryService';
import { branchService } from '@/app/services/branchService';
import { toast } from 'sonner';
import { exportToCSV, exportToExcel, exportToPDF, type ExportData } from '@/app/utils/exportUtils';
import { FullStockLedgerView } from '../products/FullStockLedgerView';
import { StockAdjustmentDrawer } from './StockAdjustmentDrawer';
import { ListToolbar } from '../ui/list-toolbar';
import { DatePicker } from '../ui/DatePicker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { groupStockMovements, ViewMode, GroupedMovementRow } from '../../utils/stockMovementGrouping';
import {
  DATA_INVALIDATED_EVENT,
  shouldAcceptInvalidation,
  shouldSkipInventoryReloadForReason,
  type DataInvalidationDetail,
} from '@/app/lib/dataInvalidationBus';
import { InventoryOverviewTable } from './InventoryOverviewTable';
import { ErpPage } from '../ui/erp-surfaces';

type InventoryTab = 'overview' | 'analytics';

export const InventoryDashboardNew = () => {
  const { companyId, branchId, user } = useSupabase();
  const { inventorySettings } = useSettings();
  const { formatCurrency } = useFormatCurrency();
  const enablePacking = inventorySettings.enablePacking;
  const [activeTab, setActiveTab] = useState<InventoryTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [overviewRows, setOverviewRows] = useState<InventoryOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewFilterOpen, setOverviewFilterOpen] = useState(false);
  const [overviewCategoryFilter, setOverviewCategoryFilter] = useState('all');
  const [overviewStatusFilter, setOverviewStatusFilter] = useState('all');
  const [overviewMovementFilter, setOverviewMovementFilter] = useState('all');
  const [importInventoryModalOpen, setImportInventoryModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<Array<{ sku: string; quantity: number; productId?: string; name?: string }>>([]);
  const [importing, setImporting] = useState(false);

  // Packing OFF: sirf Stock; Unit, Boxes, Pieces HIDE. Packing ON: Boxes, Pieces, Unit, Stock sab show.
  const overviewColumnOrder = useMemo(() => {
    const base = ['product', 'sku', 'category', 'stockQty'] as const;
    const packingCols = enablePacking ? (['boxes', 'pieces', 'unit'] as const) : [];
    return [...base, ...packingCols, 'avgCost', 'sellingPrice', 'stockValue', 'movement', 'status', 'actions'] as const;
  }, [enablePacking]);
  const [visibleOverviewColumns, setVisibleOverviewColumns] = useState<Record<string, boolean>>({
    product: true, sku: true, category: true, stockQty: true, boxes: true, pieces: true,
    unit: true, avgCost: true, sellingPrice: true, stockValue: true, movement: true, status: true, actions: true,
  });
  const overviewColumnsList = useMemo(() => [
    { key: 'product', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'category', label: 'Category' },
    { key: 'stockQty', label: 'Stock' },
    ...(enablePacking ? [{ key: 'boxes', label: 'Boxes' }, { key: 'pieces', label: 'Pieces' }, { key: 'unit', label: 'Unit' }] : []),
    { key: 'avgCost', label: 'Avg Cost' },
    { key: 'sellingPrice', label: 'Selling Price' },
    { key: 'stockValue', label: 'Stock Value' },
    { key: 'movement', label: 'Movement' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ], [enablePacking]);
  const toggleOverviewColumn = (key: string) => {
    setVisibleOverviewColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const showAllOverviewColumns = () => {
    setVisibleOverviewColumns((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, true])));
  };

  // Ledger & Adjustment modals
  const [ledgerProduct, setLedgerProduct] = useState<InventoryOverviewRow | null>(null);
  const [adjustmentProduct, setAdjustmentProduct] = useState<InventoryOverviewRow | null>(null);
  const [stockDrawerMode, setStockDrawerMode] = useState<'adjust' | 'transfer'>('adjust');

  // Analytics tab
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('detailed'); // 'detailed' | 'grouped'
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    productId: '',
    movementType: '',
  });
  
  // Grouped movements (computed from raw movements)
  const displayedMovements = useMemo(() => {
    if (viewMode === 'grouped') {
      return groupStockMovements(movements);
    }
    return movements;
  }, [movements, viewMode]);

  // Stock Overview: single source of truth from inventoryService
  const loadOverview = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const rows = await inventoryService.getInventoryOverview(
        companyId,
        branchId === 'all' ? null : branchId || null
      );
      setOverviewRows(rows);
    } catch (error: any) {
      console.error('[INVENTORY DASHBOARD] Error loading overview:', error);
      toast.error('Failed to load inventory: ' + (error.message || 'Unknown error'));
      setOverviewRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    if (companyId) loadOverview();
    else setLoading(false);
  }, [companyId, loadOverview]);

  // Stock Analytics: load movements with filters
  const loadMovements = useCallback(async () => {
    if (!companyId) return;
    try {
      setMovementsLoading(true);
      const list = await inventoryService.getInventoryMovements({
        companyId,
        branchId: branchId === 'all' ? undefined : branchId || undefined,
        productId: filters.productId || undefined,
        movementType: filters.movementType || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      setMovements(list);
    } catch (error: any) {
      toast.error('Failed to load movements: ' + (error.message || 'Unknown error'));
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  }, [companyId, branchId, filters.dateFrom, filters.dateTo, filters.productId, filters.movementType]);

  // Listen for purchase/sale events to refresh inventory
  // 🔒 FIX: Use refs to avoid dependency issues and ensure events are always handled
  useEffect(() => {
    const handlePurchaseSaved = () => {
      console.log('[INVENTORY] Purchase saved - refreshing inventory');
      // Force refresh both tabs
      loadOverview();
      if (activeTab === 'analytics') {
        loadMovements();
      }
    };

    const handlePurchaseDeleted = () => {
      console.log('[INVENTORY] Purchase deleted - refreshing inventory');
      loadOverview();
      if (activeTab === 'analytics') {
        loadMovements();
      }
    };

    const handleSaleSaved = () => {
      console.log('[INVENTORY] Sale saved - refreshing inventory');
      loadOverview();
      if (activeTab === 'analytics') {
        loadMovements();
      }
    };

    const handleSaleDeleted = () => {
      console.log('[INVENTORY] Sale deleted - refreshing inventory');
      loadOverview();
      if (activeTab === 'analytics') {
        loadMovements();
      }
    };

    // Also listen for payment events (payments can affect inventory indirectly)
    const handlePaymentAdded = () => {
      /* Payments do not change stock — saleService posts stock on finalize only */
    };

    const handleProductsUpdated = () => {
      loadOverview();
      if (activeTab === 'analytics') loadMovements();
    };
    const handleAccountingChanged = () => {
      loadOverview();
      if (activeTab === 'analytics') loadMovements();
    };

    window.addEventListener('purchaseSaved', handlePurchaseSaved);
    window.addEventListener('purchaseDeleted', handlePurchaseDeleted);
    window.addEventListener('saleSaved', handleSaleSaved);
    window.addEventListener('saleDeleted', handleSaleDeleted);
    window.addEventListener('paymentAdded', handlePaymentAdded);
    window.addEventListener('products-updated', handleProductsUpdated);
    window.addEventListener('accountingEntriesChanged', handleAccountingChanged);

    return () => {
      window.removeEventListener('purchaseSaved', handlePurchaseSaved);
      window.removeEventListener('purchaseDeleted', handlePurchaseDeleted);
      window.removeEventListener('saleSaved', handleSaleSaved);
      window.removeEventListener('saleDeleted', handleSaleDeleted);
      window.removeEventListener('paymentAdded', handlePaymentAdded);
      window.removeEventListener('products-updated', handleProductsUpdated);
      window.removeEventListener('accountingEntriesChanged', handleAccountingChanged);
    };
    // 🔒 FIX: Remove loadOverview and loadMovements from dependencies to prevent re-registration
    // These functions are stable (useCallback), but including them causes unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // Only depend on activeTab, functions are stable

  useEffect(() => {
    if (!companyId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void loadOverview();
        if (activeTab === 'analytics') void loadMovements();
      }, 400);
    };
    const onInvalidated = (ev: Event) => {
      if (isBulkImportActive()) return;
      const detail = (ev as CustomEvent<DataInvalidationDetail>).detail;
      if (
        detail?.domain === 'accounting' &&
        shouldSkipInventoryReloadForReason(detail?.reason)
      ) {
        return;
      }
      if (
        !shouldAcceptInvalidation(detail, {
          domain: ['inventory', 'sales', 'purchases', 'accounting', 'rentals', 'studio'],
          companyId,
          branchId: branchId === 'all' ? null : branchId ?? null,
        })
      ) {
        return;
      }
      bump();
    };
    window.addEventListener(DATA_INVALIDATED_EVENT, onInvalidated as EventListener);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(DATA_INVALIDATED_EVENT, onInvalidated as EventListener);
    };
  }, [companyId, branchId, activeTab, loadOverview, loadMovements]);

  useEffect(() => {
    if (companyId && activeTab === 'analytics') loadMovements();
  }, [companyId, activeTab, loadMovements]);

  const lowStockItems = useMemo(() => 
    overviewRows.filter(p => p.status === 'Low' || p.status === 'Out'),
    [overviewRows]
  );
  const slowMovingItems = useMemo(() => 
    overviewRows.filter(p => p.movement === 'Slow' || p.movement === 'Dead'),
    [overviewRows]
  );
  const totalStockValue = useMemo(() => 
    overviewRows.reduce((sum, p) => sum + p.stockValue, 0),
    [overviewRows]
  );
  const potentialProfit = useMemo(() => 
    overviewRows.reduce((sum, p) => sum + (p.stock * (p.sellingPrice - p.avgCost)), 0),
    [overviewRows]
  );

  const filteredProducts = useMemo(() => {
    let list = overviewRows.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (overviewCategoryFilter !== 'all') list = list.filter(p => p.category === overviewCategoryFilter);
    if (overviewStatusFilter !== 'all') list = list.filter(p => p.status === overviewStatusFilter);
    if (overviewMovementFilter !== 'all') list = list.filter(p => p.movement === overviewMovementFilter);
    return list;
  }, [overviewRows, searchTerm, overviewCategoryFilter, overviewStatusFilter, overviewMovementFilter]);

  const displayedProducts = useMemo(() => {
    const size = typeof pageSize === 'number' && pageSize > 0 ? pageSize : filteredProducts.length;
    return filteredProducts.slice(0, size);
  }, [filteredProducts, pageSize]);

  const overviewFilterActiveCount = [
    overviewCategoryFilter !== 'all',
    overviewStatusFilter !== 'all',
    overviewMovementFilter !== 'all',
  ].filter(Boolean).length;

  const uniqueCategories = useMemo(() => {
    const set = new Set(overviewRows.map(p => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [overviewRows]);

  const handleAdjustSave = useCallback(async (data: {
    productId: string;
    branchId: string;
    type: 'add' | 'subtract';
    quantity: number;
    reason: string;
    notes: string;
    movementAt: string;
    newStock: number;
    variationId?: string | null;
  }) => {
    if (!companyId) return;
    try {
      const qty = data.type === 'add' ? data.quantity : -data.quantity;
      await productService.createStockMovement({
        company_id: companyId,
        branch_id: data.branchId,
        product_id: data.productId,
        variation_id: data.variationId ?? undefined,
        movement_type: 'adjustment',
        quantity: qty,
        notes: `${data.reason}: ${data.notes}`,
        reference_type: 'adjustment',
        created_by: user?.id,
        created_at: data.movementAt,
      });
      toast.success('Stock adjustment saved');
      setAdjustmentProduct(null);
      loadOverview();
    } catch (error: any) {
      toast.error('Adjustment failed: ' + (error.message || 'Unknown error'));
    }
  }, [companyId, user?.id, loadOverview]);

  const handleTransferSave = useCallback(async (data: {
    productId: string;
    fromBranchId: string;
    toBranchId: string;
    quantity: number;
    notes: string;
    variationId?: string | null;
  }) => {
    if (!companyId) return;
    try {
      const branchList = await branchService.getBranchesCached(companyId);
      const fromName = branchList.find((b) => b.id === data.fromBranchId)?.name ?? null;
      const toName = branchList.find((b) => b.id === data.toBranchId)?.name ?? null;
      const { error } = await createStockTransfer({
        companyId,
        productId: data.productId,
        variationId: data.variationId,
        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,
        quantity: data.quantity,
        notes: data.notes || null,
        createdBy: user?.id,
        fromBranchName: fromName,
        toBranchName: toName,
      });
      if (error) {
        toast.error('Transfer failed: ' + error);
        return;
      }
      toast.success('Stock transferred successfully');
      setAdjustmentProduct(null);
      loadOverview();
    } catch (error: unknown) {
      toast.error('Transfer failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [companyId, user?.id, loadOverview]);

  const exportOverviewCsv = useCallback(() => {
    const headers = enablePacking
      ? ['Product', 'SKU', 'Category', 'Stock', 'Boxes', 'Pieces', 'Unit', 'Avg Cost', 'Selling Price', 'Stock Value', 'Status', 'Movement']
      : ['Product', 'SKU', 'Category', 'Stock', 'Avg Cost', 'Selling Price', 'Stock Value', 'Status', 'Movement'];
    const rows = filteredProducts.map(p => {
      if (enablePacking) {
        return [p.name, p.sku, p.category, p.stock, p.boxes ?? 0, p.pieces ?? 0, p.stock, p.avgCost, p.sellingPrice, p.stockValue, p.status, p.movement].join(',');
      } else {
        return [p.name, p.sku, p.category, p.stock, p.avgCost, p.sellingPrice, p.stockValue, p.status, p.movement].join(',');
      }
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Export downloaded');
  }, [filteredProducts, enablePacking]);

  const exportMovementsCsv = useCallback((mode: ViewMode = viewMode) => {
    // Use displayedMovements (already grouped if mode is 'grouped')
    const dataToExport = mode === 'grouped' ? groupStockMovements(movements) : movements;
    
    const headers = enablePacking
      ? ['Date', 'Product', 'SKU', 'Type', 'Qty Change', 'Box Change', 'Piece Change', 'Before Qty', 'After Qty', 'Unit Cost', 'Notes', 'View Mode']
      : ['Date', 'Product', 'SKU', 'Type', 'Qty Change', 'Before Qty', 'After Qty', 'Unit Cost', 'Notes', 'View Mode'];
    const rows = dataToExport.map(m => {
      const isGrouped = (m as any).is_grouped === true;
      const movementCount = (m as any).movement_count || 1;
      const notes = isGrouped && movementCount > 1 
        ? `${m.notes || ''} (${movementCount} movements grouped)`
        : (m.notes || '');
      
      if (enablePacking) {
        return [
          m.created_at?.slice(0, 19) || '',
          m.product?.name ?? '',
          m.product?.sku ?? '',
          m.movement_type ?? '',
          m.quantity ?? '',
          (m as any).box_change != null ? Math.round(Number((m as any).box_change)) : '',
          (m as any).piece_change != null ? Math.round(Number((m as any).piece_change)) : '',
          m.before_qty ?? '',
          m.after_qty ?? '',
          m.unit_cost ?? '',
          notes.replace(/,/g, ';'),
          mode === 'grouped' ? 'Grouped' : 'Detailed',
        ].join(',');
      } else {
        return [
          m.created_at?.slice(0, 19) || '',
          m.product?.name ?? '',
          m.product?.sku ?? '',
          m.movement_type ?? '',
          m.quantity ?? '',
          m.before_qty ?? '',
          m.after_qty ?? '',
          m.unit_cost ?? '',
          notes.replace(/,/g, ';'),
          mode === 'grouped' ? 'Grouped' : 'Detailed',
        ].join(',');
      }
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Export downloaded');
  }, [movements, enablePacking]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 flex justify-between items-start border-b border-border pb-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <Warehouse size={32} className="text-blue-500" />
            Inventory Management
          </h2>
          <p className="text-muted-foreground mt-1">Stock levels, movement analysis, and reorder alerts</p>
        </div>
        
        <div className="flex gap-3">
          {activeTab === 'overview' && (
            <>
              <Button variant="outline" className="gap-2 border-border text-muted-foreground" onClick={exportOverviewCsv}>
                <FileDown size={16} /> Export CSV
              </Button>
              <Button variant="outline" className="gap-2 border-border text-muted-foreground" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </Button>
            </>
          )}
          {activeTab === 'analytics' && (
            <>
              <Button variant="outline" className="gap-2 border-border text-muted-foreground" onClick={loadMovements}>
                <Filter size={16} /> Apply Filters
              </Button>
              <Button variant="outline" className="gap-2 border-border text-muted-foreground" onClick={() => exportMovementsCsv(viewMode)}>
                <Download size={16} /> Export CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-border">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "pb-3 text-sm font-medium transition-all relative",
              activeTab === 'overview'
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Package size={16} className="inline mr-2" />
            Stock Overview
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "pb-3 text-sm font-medium transition-all relative",
              activeTab === 'analytics'
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 size={16} className="inline mr-2" />
            Stock Analytics
          </button>
        </div>
      </div>

      {/* OVERVIEW TAB - scrollable content */}
      {activeTab === 'overview' && (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="space-y-6 animate-in fade-in duration-300 p-px">
          {/* Summary cards at top: Slow Moving, Low/Out of Stock, Total Stock Value */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <TrendingDown className="text-orange-400" size={20} />
                </div>
                <div>
                  <h3 className="text-foreground font-bold">Slow Moving</h3>
                  <p className="text-2xl font-bold text-foreground mt-1">{slowMovingItems.length}</p>
                  <p className="text-sm text-muted-foreground">items</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="text-red-400" size={20} />
                </div>
                <div>
                  <h3 className="text-foreground font-bold">Low / Out of Stock</h3>
                  <p className="text-2xl font-bold text-foreground mt-1">{lowStockItems.length}</p>
                  <p className="text-sm text-muted-foreground">items</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 min-w-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <DollarSign className="text-[var(--erp-money-positive)]" size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-foreground font-bold">Total Stock Value</h3>
                  <AdaptiveCurrencyValue value={totalStockValue} className="text-2xl font-bold text-foreground mt-1" as="p" />
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-card border border-border rounded-xl p-6 min-w-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-sm">Total Stock Value</p>
                  <AdaptiveCurrencyValue value={totalStockValue} className="text-2xl font-bold text-foreground mt-1" as="p" />
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <DollarSign className="text-blue-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 min-w-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-sm">Potential Profit</p>
                  <AdaptiveCurrencyValue value={potentialProfit} className="text-2xl font-bold text-foreground mt-1" as="p" />
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <TrendingDown className="text-[var(--erp-money-positive)]" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Low Stock Items</p>
                  <h3 className="text-2xl font-bold text-foreground mt-1">{lowStockItems.length}</h3>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="text-red-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total SKUs</p>
                  <h3 className="text-2xl font-bold text-foreground mt-1">{overviewRows.length}</h3>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Package className="text-purple-400" size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* Search & Actions Bar - same as ProductsPage (ListToolbar has same bar styling) */}
          <ListToolbar
              search={{
                value: searchTerm,
                onChange: setSearchTerm,
                placeholder: 'Search by product name, SKU, or category...',
              }}
              rowsSelector={{
                value: pageSize,
                onChange: setPageSize,
                totalItems: filteredProducts.length,
              }}
              columnsManager={{
                columns: overviewColumnsList,
                visibleColumns: visibleOverviewColumns,
                onToggle: toggleOverviewColumn,
                onShowAll: showAllOverviewColumns,
              }}
              filter={{
                isOpen: overviewFilterOpen,
                onToggle: () => setOverviewFilterOpen((o) => !o),
                activeCount: overviewFilterActiveCount,
                renderPanel: () => (
                  <div className="absolute right-0 top-12 w-72 bg-card border border-border rounded-lg shadow-2xl p-4 z-50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-foreground">Overview filters</h3>
                      <button
                        onClick={() => {
                          setOverviewCategoryFilter('all');
                          setOverviewStatusFilter('all');
                          setOverviewMovementFilter('all');
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block font-medium">Category</label>
                        <select
                          value={overviewCategoryFilter}
                          onChange={(e) => setOverviewCategoryFilter(e.target.value)}
                          className="w-full rounded-md bg-muted border border-border text-foreground text-sm px-3 py-2"
                        >
                          <option value="all">All categories</option>
                          {uniqueCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block font-medium">Status</label>
                        <select
                          value={overviewStatusFilter}
                          onChange={(e) => setOverviewStatusFilter(e.target.value)}
                          className="w-full rounded-md bg-muted border border-border text-foreground text-sm px-3 py-2"
                        >
                          <option value="all">All status</option>
                          <option value="OK">OK</option>
                          <option value="Low">Low</option>
                          <option value="Out">Out</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block font-medium">Movement</label>
                        <select
                          value={overviewMovementFilter}
                          onChange={(e) => setOverviewMovementFilter(e.target.value)}
                          className="w-full rounded-md bg-muted border border-border text-foreground text-sm px-3 py-2"
                        >
                          <option value="all">All</option>
                          <option value="Fast">Fast</option>
                          <option value="Medium">Medium</option>
                          <option value="Slow">Slow</option>
                          <option value="Dead">Dead</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ),
              }}
              importConfig={{ onImport: () => setImportInventoryModalOpen(true) }}
              exportConfig={{
                onExportCSV: () => {
                  const headers = enablePacking ? ['Product', 'SKU', 'Category', 'Stock', 'Unit', 'Avg Cost', 'Selling Price', 'Stock Value', 'Movement', 'Status'] : ['Product', 'SKU', 'Category', 'Stock', 'Avg Cost', 'Selling Price', 'Stock Value', 'Movement', 'Status'];
                  const rows = filteredProducts.map((p) =>
                    enablePacking
                      ? [p.name, p.sku, p.category, p.stock, p.stock, p.avgCost, p.sellingPrice, p.stockValue, p.movement, p.status]
                      : [p.name, p.sku, p.category, p.stock, p.avgCost, p.sellingPrice, p.stockValue, p.movement, p.status]
                  );
                  const data: ExportData = { headers, rows, title: 'Inventory Overview' };
                  try { exportToCSV(data, 'inventory-overview'); toast.success('Inventory exported as CSV'); } catch (e) { toast.error('Export failed'); }
                },
                onExportExcel: () => {
                  const headers = enablePacking ? ['Product', 'SKU', 'Category', 'Stock', 'Unit', 'Avg Cost', 'Selling Price', 'Stock Value', 'Movement', 'Status'] : ['Product', 'SKU', 'Category', 'Stock', 'Avg Cost', 'Selling Price', 'Stock Value', 'Movement', 'Status'];
                  const rows = filteredProducts.map((p) =>
                    enablePacking
                      ? [p.name, p.sku, p.category, p.stock, p.stock, p.avgCost, p.sellingPrice, p.stockValue, p.movement, p.status]
                      : [p.name, p.sku, p.category, p.stock, p.avgCost, p.sellingPrice, p.stockValue, p.movement, p.status]
                  );
                  const data: ExportData = { headers, rows, title: 'Inventory Overview' };
                  try { exportToExcel(data, 'inventory-overview'); toast.success('Inventory exported as Excel'); } catch (e) { toast.error('Export failed'); }
                },
                onExportPDF: () => {
                  const headers = enablePacking ? ['Product', 'SKU', 'Category', 'Stock', 'Unit', 'Avg Cost', 'Selling Price', 'Stock Value', 'Movement', 'Status'] : ['Product', 'SKU', 'Category', 'Stock', 'Avg Cost', 'Selling Price', 'Stock Value', 'Movement', 'Status'];
                  const rows = filteredProducts.map((p) =>
                    enablePacking
                      ? [p.name, p.sku, p.category, p.stock, p.stock, p.avgCost, p.sellingPrice, p.stockValue, p.movement, p.status]
                      : [p.name, p.sku, p.category, p.stock, p.avgCost, p.sellingPrice, p.stockValue, p.movement, p.status]
                  );
                  const data: ExportData = { headers, rows, title: 'Inventory Overview' };
                  try { exportToPDF(data, 'inventory-overview'); toast.success('PDF opened for print'); } catch (e) { toast.error('Export failed'); }
                },
              }}
            />

          <InventoryOverviewTable
            products={displayedProducts}
            loading={loading}
            visibleCols={overviewColumnOrder.filter((k) => visibleOverviewColumns[k] !== false)}
            columnsList={overviewColumnsList}
            enablePacking={enablePacking}
            alwaysShowVariations
            actionsMode="labels"
            onLedger={setLedgerProduct}
            onAdjust={(product) => { setStockDrawerMode('adjust'); setAdjustmentProduct(product); }}
            onTransfer={(product) => { setStockDrawerMode('transfer'); setAdjustmentProduct(product); }}
            className="print:border print:rounded min-w-0"
          />
          </div>
        </div>
      )}

      {/* Full Stock Ledger modal */}
      {ledgerProduct && (
        <FullStockLedgerView
          isOpen={!!ledgerProduct}
          onClose={() => setLedgerProduct(null)}
          productId={ledgerProduct.productId}
          productName={ledgerProduct.name}
          productSku={ledgerProduct.sku}
          currentStock={ledgerProduct.stock}
        />
      )}

      {/* Stock Adjustment drawer */}
      <StockAdjustmentDrawer
        open={!!adjustmentProduct}
        onClose={() => setAdjustmentProduct(null)}
        product={adjustmentProduct ? {
          id: adjustmentProduct.productId,
          name: adjustmentProduct.name,
          sku: adjustmentProduct.sku,
          currentStock: adjustmentProduct.stock,
          unit: adjustmentProduct.unit,
          hasVariations: adjustmentProduct.hasVariations,
          variations: adjustmentProduct.variations?.map((v) => ({
            id: v.id,
            attributes: v.attributes,
            sku: v.sku,
            stock: v.stock ?? 0,
          })),
        } : null}
        onAdjust={handleAdjustSave}
        onTransfer={handleTransferSave}
        initialMode={stockDrawerMode}
      />

      {/* Import Inventory CSV modal */}
      <Dialog open={importInventoryModalOpen} onOpenChange={(open) => { if (!open) { setImportInventoryModalOpen(false); setImportRows([]); } }}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Upload size={20} />
              Import Inventory (Opening Balance)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1">
            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">How it works</h3>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Upload a CSV with <code className="bg-muted px-1 rounded">sku</code> and <code className="bg-muted px-1 rounded">quantity</code> (or <code className="bg-muted px-1 rounded">qty</code>)</li>
                    <li>• SKU must match existing products in your catalog (Products page)</li>
                    <li>• Quantities will be added as <strong>opening balance</strong> stock movements</li>
                    <li>• Rows with unknown SKUs will be skipped (no product match)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Example */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Example format</label>
              <div className="bg-muted/50 border border-border rounded-lg p-3 font-mono text-xs overflow-x-auto">
                <pre className="text-muted-foreground">{`sku,quantity
PROD-001,10
PROD-002,5
PROD-003,20`}</pre>
              </div>
            </div>

            {/* Step 1: Download Template */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Step 1: Download Template</label>
              <Button
                type="button"
                variant="outline"
                className="h-10 bg-muted border-border hover:bg-muted text-foreground gap-2"
                onClick={() => {
                  const template = `sku,quantity
PROD-001,10
PROD-002,5
PROD-003,20`;
                  const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'inventory_import_template.csv';
                  a.style.display = 'none';
                  document.body.appendChild(a);
                  a.click();
                  setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }, 100);
                  toast.success('Template downloaded');
                }}
              >
                <Download size={16} />
                Download CSV Template
              </Button>
            </div>

            {/* Step 2: Upload */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Step 2: Upload your file</label>
              <input
                type="file"
                accept=".csv"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-muted file:text-foreground file:text-sm file:cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const text = String(reader.result ?? '');
                  const lines = text.split(/\r?\n/).filter(Boolean);
                  const header = (lines[0] ?? '').toLowerCase().split(',').map((h) => h.trim());
                  const skuIdx = header.findIndex((h) => h === 'sku');
                  const qtyIdx = header.findIndex((h) => h === 'quantity' || h === 'qty');
                  if (skuIdx < 0 || qtyIdx < 0) {
                    toast.error('CSV must have columns: sku, quantity (or qty)');
                    return;
                  }
                  const rows: Array<{ sku: string; quantity: number; productId?: string; name?: string }> = [];
                  for (let i = 1; i < lines.length; i++) {
                    const cells = lines[i].split(',').map((c) => c.trim());
                    const sku = cells[skuIdx] ?? '';
                    const qty = parseInt(cells[qtyIdx] ?? '0', 10);
                    if (!sku || isNaN(qty) || qty < 0) continue;
                    const product = overviewRows.find((p) => p.sku === sku);
                    rows.push({ sku, quantity: qty, productId: product?.productId, name: product?.name });
                  }
                  setImportRows(rows);
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
              />
            </div>

            {/* Preview */}
            {importRows.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Preview</label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-muted-foreground">SKU</th>
                      <th className="text-left px-3 py-2 text-muted-foreground">Product</th>
                      <th className="text-right px-3 py-2 text-muted-foreground">Qty</th>
                      <th className="text-center px-3 py-2 text-muted-foreground w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{r.sku}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.name ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatQty(r.quantity)}</td>
                        <td className="px-3 py-1.5 text-center">
                          {r.productId ? (
                            <span className="text-[var(--erp-money-positive)] text-xs">✓</span>
                          ) : (
                            <span className="text-amber-400 text-xs">No match</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importRows.length > 20 && <p className="text-xs text-muted-foreground px-3 py-1">+ {importRows.length - 20} more</p>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {importRows.filter((r) => r.productId).length} of {importRows.length} rows match existing products. Only matched rows will be imported.
              </p>
            </div>
            )}
          </div>
          <DialogFooter className="gap-2 shrink-0 pt-4 border-t border-border">
            <Button variant="outline" className="border-border" onClick={() => { setImportInventoryModalOpen(false); setImportRows([]); }}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500"
              disabled={importRows.length === 0 || importing || importRows.every((r) => !r.productId)}
              onClick={async () => {
                const valid = importRows.filter((r) => r.productId && r.quantity > 0);
                if (!companyId || valid.length === 0) return;
                setImporting(true);
                try {
                  const branchIdOrNull = branchId && branchId !== 'all' ? branchId : null;
                  const overviewByProductId = new Map(overviewRows.map((p) => [p.productId, p]));
                  const result = await inventoryService.bulkImportOpeningInventory(
                    companyId,
                    branchIdOrNull,
                    valid.map((row) => ({
                      productId: row.productId!,
                      quantity: row.quantity,
                      unitCost: overviewByProductId.get(row.productId!)?.avgCost ?? 0,
                    }))
                  );
                  await loadOverview();
                  const glMsg =
                    result.openingGlPosted + result.openingGlKept > 0
                      ? ` · ${result.openingGlPosted + result.openingGlKept} opening GL entr${result.openingGlPosted + result.openingGlKept === 1 ? 'y' : 'ies'}`
                      : '';
                  toast.success(`Imported ${result.processed} item(s) as opening balance${glMsg}.`);
                  if (result.openingGlSkippedZeroCost > 0) {
                    toast.warning(`${result.openingGlSkippedZeroCost} item(s) skipped GL — zero cost price.`);
                  }
                  if (result.failed > 0) {
                    toast.error(`${result.failed} row(s) failed.`);
                  }
                  setImportInventoryModalOpen(false);
                  setImportRows([]);
                } catch (err: any) {
                  toast.error('Import failed: ' + (err?.message ?? 'Unknown error'));
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? 'Importing…' : `Apply ${importRows.filter((r) => r.productId).length} row(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ANALYTICS TAB - scrollable content */}
      {activeTab === 'analytics' && (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="space-y-6 animate-in fade-in duration-300 p-px">
          {/* Filters */}
          <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">From Date</label>
              <DatePicker
                value={filters.dateFrom}
                onChange={(v) => setFilters(f => ({ ...f, dateFrom: v }))}
                placeholder="From"
                className="w-40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">To Date</label>
              <DatePicker
                value={filters.dateTo}
                onChange={(v) => setFilters(f => ({ ...f, dateTo: v }))}
                placeholder="To"
                className="w-40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Movement Type</label>
              <select
                value={filters.movementType}
                onChange={(e) => setFilters(f => ({ ...f, movementType: e.target.value }))}
                className="h-9 px-3 rounded-md bg-input-background border border-border text-foreground text-sm w-40"
              >
                <option value="">All</option>
                <option value="purchase">Purchase</option>
                <option value="sale">Sale</option>
                <option value="adjustment">Adjustment</option>
                <option value="transfer">Transfer</option>
                <option value="return">Return</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Product</label>
              <select
                value={filters.productId}
                onChange={(e) => setFilters(f => ({ ...f, productId: e.target.value }))}
                className="h-9 px-3 rounded-md bg-input-background border border-border text-foreground text-sm min-w-[180px]"
              >
                <option value="">All products</option>
                {overviewRows.map((p) => (
                  <option key={p.id} value={p.productId}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>
            <Button onClick={loadMovements} className="gap-2">
              <Filter size={16} /> Apply
            </Button>
          </div>

          {/* Movements Table - scroll when needed */}
          <div className="bg-card border border-border rounded-xl overflow-hidden min-w-0">
            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Stock Movements</h3>
                  <p className="text-sm text-muted-foreground mt-1">Filter by date, product, and movement type</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('detailed')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
                        viewMode === 'detailed'
                          ? "bg-blue-600 text-white"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title="Detailed mode shows all individual movements (audit trail)"
                    >
                      <List size={14} />
                      Detailed
                    </button>
                    <button
                      onClick={() => setViewMode('grouped')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
                        viewMode === 'grouped'
                          ? "bg-blue-600 text-white"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title="Grouped mode shows net effect per document (user-friendly)"
                    >
                      <Layers size={14} />
                      Grouped
                    </button>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2 border-border text-muted-foreground" onClick={() => exportMovementsCsv(viewMode)}>
                    <Download size={16} /> Export CSV
                  </Button>
                </div>
              </div>
              
              {/* Informational Banner */}
              <div className={cn(
                "p-3 rounded-lg text-xs border",
                viewMode === 'detailed'
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  : "bg-purple-500/10 border-purple-500/30 text-purple-400"
              )}>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {viewMode === 'detailed' ? (
                      <List size={14} />
                    ) : (
                      <Layers size={14} />
                    )}
                  </div>
                  <div>
                    <strong className="font-semibold">
                      {viewMode === 'detailed' ? 'Detailed Mode' : 'Grouped Mode'}
                    </strong>
                    <span className="ml-2">
                      {viewMode === 'detailed'
                        ? 'Shows all individual movements for complete audit trail. Multiple edits of the same sale/purchase appear as separate rows.'
                        : 'Shows net effect per document. Multiple edits of the same sale/purchase are grouped into a single row with net quantity change.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-muted/40 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Variation</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-muted-foreground uppercase">Qty Change</th>
                  {enablePacking && (
                    <>
                      <th className="px-6 py-4 text-center text-xs font-medium text-muted-foreground uppercase">Box Change</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-muted-foreground uppercase">Piece Change</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-center text-xs font-medium text-muted-foreground uppercase">Before Qty</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-muted-foreground uppercase">After Qty</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase">Unit Cost</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase max-w-[200px]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movementsLoading ? (
                  <tr>
                    <td colSpan={enablePacking ? 11 : 9} className="px-6 py-12 text-center">
                      <Loader2 size={32} className="mx-auto text-blue-500 animate-spin" />
                      <p className="text-muted-foreground text-sm mt-2">Loading movements...</p>
                    </td>
                  </tr>
                ) : displayedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={enablePacking ? 11 : 9} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      No movements found. Adjust filters or ensure stock_movements has data.
                    </td>
                  </tr>
                ) : (
                  displayedMovements.map((m) => {
                    const isGrouped = (m as any).is_grouped === true;
                    const movementCount = (m as any).movement_count || 1;
                    return (
                    <tr key={m.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground text-sm whitespace-nowrap">
                        {m.created_at ? new Date(m.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-foreground">{m.product?.name ?? '-'}</p>
                          <p className="text-xs text-muted-foreground">{m.product?.sku ?? ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-sm">
                        {(m as any).variation_id && (m as any).variation ? (
                          <span>
                            {typeof (m as any).variation?.attributes === 'object' && (m as any).variation?.attributes !== null
                              ? Object.entries((m as any).variation.attributes).map(([k, val]) => `${k}: ${val}`).join(', ')
                              : '—'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={cn(
                          "border text-xs",
                          m.movement_type === 'sale' ? "bg-red-500/20 text-red-400 border-red-500/30" :
                          m.movement_type === 'purchase' ? "bg-green-500/20 text-[var(--erp-money-positive)] border-green-500/30" :
                          m.movement_type === 'adjustment' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                          "bg-gray-500/20 text-muted-foreground border-gray-500/30"
                        )}>
                          {m.movement_type ?? '-'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-foreground">
                        {m.quantity != null ? (Number(m.quantity) >= 0 ? '+' : '') + formatQty(m.quantity) : '-'}
                      </td>
                      {enablePacking && (
                        <>
                          <td className="px-6 py-4 text-center text-muted-foreground">{(m as any).box_change != null ? Math.round(Number((m as any).box_change)) : '-'}</td>
                          <td className="px-6 py-4 text-center text-muted-foreground">{(m as any).piece_change != null ? Math.round(Number((m as any).piece_change)) : '-'}</td>
                        </>
                      )}
                      <td className="px-6 py-4 text-center text-muted-foreground">{m.before_qty ?? '-'}</td>
                      <td className="px-6 py-4 text-center text-muted-foreground">{m.after_qty ?? '-'}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">
                        {m.unit_cost != null ? formatCurrency(Number(m.unit_cost)) : '-'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-sm max-w-[200px] truncate" title={m.notes || ''}>
                        <div className="flex items-center gap-2">
                          {m.notes || '-'}
                          {isGrouped && movementCount > 1 && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5 py-0.5">
                              {movementCount} edits
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};
