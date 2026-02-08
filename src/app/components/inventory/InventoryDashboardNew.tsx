import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Package, TrendingDown, DollarSign, AlertTriangle, 
  BarChart3, Search, Filter, Download, Warehouse, Loader2,
  ExternalLink, SlidersHorizontal, FileDown, Printer, List, Layers, Upload
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { useSupabase } from '../../context/SupabaseContext';
import { useSettings } from '../../context/SettingsContext';
import { productService } from '../../services/productService';
import { inventoryService, InventoryOverviewRow, InventoryMovementRow } from '../../services/inventoryService';
import { toast } from 'sonner';
import { FullStockLedgerView } from '../products/FullStockLedgerView';
import { StockAdjustmentDrawer } from './StockAdjustmentDrawer';
import { ListToolbar } from '../ui/list-toolbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { groupStockMovements, ViewMode, GroupedMovementRow } from '../../utils/stockMovementGrouping';

type InventoryTab = 'overview' | 'analytics';

export const InventoryDashboardNew = () => {
  const { companyId, branchId, user } = useSupabase();
  const { inventorySettings } = useSettings();
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
      console.log('[INVENTORY] Payment added - refreshing inventory');
      loadOverview();
      if (activeTab === 'analytics') {
        loadMovements();
      }
    };

    window.addEventListener('purchaseSaved', handlePurchaseSaved);
    window.addEventListener('purchaseDeleted', handlePurchaseDeleted);
    window.addEventListener('saleSaved', handleSaleSaved);
    window.addEventListener('saleDeleted', handleSaleDeleted);
    window.addEventListener('paymentAdded', handlePaymentAdded);

    return () => {
      window.removeEventListener('purchaseSaved', handlePurchaseSaved);
      window.removeEventListener('purchaseDeleted', handlePurchaseDeleted);
      window.removeEventListener('saleSaved', handleSaleSaved);
      window.removeEventListener('saleDeleted', handleSaleDeleted);
      window.removeEventListener('paymentAdded', handlePaymentAdded);
    };
    // 🔒 FIX: Remove loadOverview and loadMovements from dependencies to prevent re-registration
    // These functions are stable (useCallback), but including them causes unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // Only depend on activeTab, functions are stable

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
    type: 'add' | 'subtract';
    quantity: number;
    reason: string;
    notes: string;
    date: string;
    newStock: number;
  }) => {
    if (!companyId) return;
    try {
      // Inventory = movement-based only; do not update product.current_stock
      const qty = data.type === 'add' ? data.quantity : -data.quantity;
      await productService.createStockMovement({
        company_id: companyId,
        branch_id: branchId === 'all' ? undefined : branchId || undefined,
        product_id: data.productId,
        movement_type: 'adjustment',
        quantity: qty,
        notes: `${data.reason}: ${data.notes}`,
        reference_type: 'adjustment',
        created_by: user?.id,
      });
      toast.success('Stock adjustment saved');
      setAdjustmentProduct(null);
      loadOverview();
    } catch (error: any) {
      toast.error('Adjustment failed: ' + (error.message || 'Unknown error'));
    }
  }, [companyId, branchId, user?.id, loadOverview]);

  const exportOverviewCsv = useCallback(() => {
    const headers = enablePacking
      ? ['Product', 'SKU', 'Category', 'Stock', 'Boxes', 'Pieces', 'Unit', 'Avg Cost', 'Selling Price', 'Stock Value', 'Status', 'Movement']
      : ['Product', 'SKU', 'Category', 'Stock', 'Avg Cost', 'Selling Price', 'Stock Value', 'Status', 'Movement'];
    const rows = filteredProducts.map(p => {
      if (enablePacking) {
        return [p.name, p.sku, p.category, p.stock, p.boxes ?? 0, p.pieces ?? 0, p.unit, p.avgCost, p.sellingPrice, p.stockValue, p.status, p.movement].join(',');
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
          m.box_change ?? '',
          m.piece_change ?? '',
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

  const getMovementBadge = (movement: string) => {
    switch(movement) {
      case 'Fast': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Slow': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Dead': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 flex justify-between items-start border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Warehouse size={32} className="text-blue-500" />
            Inventory Management
          </h2>
          <p className="text-gray-400 mt-1">Stock levels, movement analysis, and reorder alerts</p>
        </div>
        
        <div className="flex gap-3">
          {activeTab === 'overview' && (
            <>
              <Button variant="outline" className="gap-2 border-gray-700 text-gray-300" onClick={exportOverviewCsv}>
                <FileDown size={16} /> Export CSV
              </Button>
              <Button variant="outline" className="gap-2 border-gray-700 text-gray-300" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </Button>
            </>
          )}
          {activeTab === 'analytics' && (
            <>
              <Button variant="outline" className="gap-2 border-gray-700 text-gray-300" onClick={loadMovements}>
                <Filter size={16} /> Apply Filters
              </Button>
              <Button variant="outline" className="gap-2 border-gray-700 text-gray-300" onClick={() => exportMovementsCsv(viewMode)}>
                <Download size={16} /> Export CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-gray-800">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "pb-3 text-sm font-medium transition-all relative",
              activeTab === 'overview'
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-gray-400 hover:text-white"
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
                : "text-gray-400 hover:text-white"
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
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <TrendingDown className="text-orange-400" size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold">Slow Moving</h3>
                  <p className="text-2xl font-bold text-white mt-1">{slowMovingItems.length}</p>
                  <p className="text-sm text-gray-400">items</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="text-red-400" size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold">Low / Out of Stock</h3>
                  <p className="text-2xl font-bold text-white mt-1">{lowStockItems.length}</p>
                  <p className="text-sm text-gray-400">items</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <DollarSign className="text-green-400" size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold">Total Stock Value</h3>
                  <p className="text-2xl font-bold text-white mt-1">Rs {totalStockValue.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Stock Value</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    Rs {totalStockValue.toLocaleString()}
                  </h3>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <DollarSign className="text-blue-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Potential Profit</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    Rs {potentialProfit.toLocaleString()}
                  </h3>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <TrendingDown className="text-green-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Low Stock Items</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{lowStockItems.length}</h3>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="text-red-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total SKUs</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{overviewRows.length}</h3>
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
                  <div className="absolute right-0 top-12 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 z-50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-white">Overview filters</h3>
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
                        <label className="text-xs text-gray-400 mb-2 block font-medium">Category</label>
                        <select
                          value={overviewCategoryFilter}
                          onChange={(e) => setOverviewCategoryFilter(e.target.value)}
                          className="w-full rounded-md bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2"
                        >
                          <option value="all">All categories</option>
                          {uniqueCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-2 block font-medium">Status</label>
                        <select
                          value={overviewStatusFilter}
                          onChange={(e) => setOverviewStatusFilter(e.target.value)}
                          className="w-full rounded-md bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2"
                        >
                          <option value="all">All status</option>
                          <option value="OK">OK</option>
                          <option value="Low">Low</option>
                          <option value="Out">Out</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-2 block font-medium">Movement</label>
                        <select
                          value={overviewMovementFilter}
                          onChange={(e) => setOverviewMovementFilter(e.target.value)}
                          className="w-full rounded-md bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2"
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
                      ? [p.name, p.sku, p.category, p.stock, p.unit, p.avgCost, p.sellingPrice, p.stockValue, p.movement, p.status].join(',')
                      : [p.name, p.sku, p.category, p.stock, p.avgCost, p.sellingPrice, p.stockValue, p.movement, p.status].join(',')
                  );
                  const csv = [headers.join(','), ...rows].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `inventory-overview-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                },
                onExportExcel: () => {},
                onExportPDF: () => {},
              }}
            />

          {/* Stock Table - horizontal and vertical scroll when needed */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-auto print:border print:rounded min-w-0">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-950/50 border-b border-gray-800">
                <tr>
                  {overviewColumnOrder.filter((key) => visibleOverviewColumns[key] !== false).map((key) => {
                    const align = ['avgCost', 'sellingPrice', 'stockValue'].includes(key) ? 'text-right' : ['stockQty', 'unit', 'boxes', 'pieces', 'movement', 'status', 'actions'].includes(key) ? 'text-center' : 'text-left';
                    const label = overviewColumnsList.find((c) => c.key === key)?.label ?? key;
                    return (
                      <th key={key} className={`px-4 py-2.5 ${align} text-xs font-medium text-gray-400 uppercase ${key === 'actions' ? 'print:hidden' : ''}`}>
                        {label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={overviewColumnOrder.filter((k) => visibleOverviewColumns[k] !== false).length} className="px-6 py-12 text-center">
                      <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                      <p className="text-gray-400 text-sm">Loading inventory...</p>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={overviewColumnOrder.filter((k) => visibleOverviewColumns[k] !== false).length} className="px-6 py-12 text-center">
                      <Package size={48} className="mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400 text-sm">No products found</p>
                      <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                ) : (
                  displayedProducts.flatMap((product) => {
                    const visibleCols = overviewColumnOrder.filter((k) => visibleOverviewColumns[k] !== false);
                    const renderProductCell = (key: string) => {
                      switch (key) {
                        case 'product':
                          return (
                            <td key={key} className="px-4 py-2">
                              <div className="font-medium text-white text-sm">{product.name}</div>
                              {product.hasVariations && (product as any).variations?.length > 0 && (
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  <span className="bg-gray-800/50 border border-gray-700 px-1.5 py-0.5 rounded text-[10px]">
                                    SUM of {((product as any).variations as any[]).length} variations
                                  </span>
                                </p>
                              )}
                            </td>
                          );
                        case 'sku':
                          return <td key={key} className="px-4 py-2"><span className="text-gray-400 font-mono text-xs">{product.sku}</span></td>;
                        case 'category':
                          return <td key={key} className="px-4 py-2"><span className="text-gray-400 text-sm">{product.category}</span></td>;
                        case 'stockQty':
                          return (
                            <td key={key} className="px-4 py-2 text-center">
                              <span className={cn("font-bold font-mono text-sm tabular-nums", product.stock < 0 ? "text-red-400" : product.status === 'Out' || product.status === 'Low' ? "text-red-400" : "text-white")}>{product.stock}</span>
                              {enablePacking && <span className="text-gray-500 text-xs ml-1">{product.unit || 'pcs'}</span>}
                            </td>
                          );
                        case 'boxes':
                          return <td key={key} className="px-4 py-2 text-center text-gray-400 text-sm">{product.boxes ?? 0}</td>;
                        case 'pieces':
                          return <td key={key} className="px-4 py-2 text-center text-gray-400 text-sm">{product.pieces ?? 0}</td>;
                        case 'unit':
                          return <td key={key} className="px-4 py-2 text-center text-gray-400 text-sm">{product.unit || 'pcs'}</td>;
                        case 'avgCost':
                          return (
                            <td key={key} className={cn('px-4 py-2 text-right text-sm font-medium tabular-nums', product.avgCost < 0 ? 'text-red-400' : 'text-green-400')}>
                              {product.avgCost.toLocaleString()}
                            </td>
                          );
                        case 'sellingPrice':
                          return (
                            <td key={key} className={cn('px-4 py-2 text-right text-sm font-medium tabular-nums', product.sellingPrice < 0 ? 'text-red-400' : 'text-green-400')}>
                              {product.sellingPrice.toLocaleString()}
                            </td>
                          );
                        case 'stockValue':
                          return (
                            <td key={key} className={cn('px-4 py-2 text-right text-sm tabular-nums', product.stockValue < 0 ? 'text-red-400' : 'text-gray-300')}>
                              {product.stockValue.toLocaleString()}
                            </td>
                          );
                        case 'movement':
                          return (
                            <td key={key} className="px-4 py-2 text-center">
                              <Badge className={cn("border text-xs", getMovementBadge(product.movement))}>{product.movement}</Badge>
                            </td>
                          );
                        case 'status':
                          return (
                            <td key={key} className="px-4 py-2 text-center">
                              {product.status === 'Out' ? (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-xs">Out</Badge>
                              ) : product.status === 'Low' ? (
                                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 border text-xs"><AlertTriangle size={10} className="mr-0.5" /> Low</Badge>
                              ) : (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border text-xs">OK</Badge>
                              )}
                            </td>
                          );
                        case 'actions':
                          return (
                            <td key={key} className="px-4 py-2 text-center print:hidden">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2" onClick={() => setLedgerProduct(product)}>
                                  <ExternalLink size={12} className="mr-1" /> Ledger
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-2" onClick={() => setAdjustmentProduct(product)}>
                                  <SlidersHorizontal size={12} className="mr-1" /> Adjust
                                </Button>
                              </div>
                            </td>
                          );
                        default:
                          return null;
                      }
                    };
                    const rows: React.ReactNode[] = [];
                    rows.push(
                      <tr key={product.id} className="hover:bg-gray-800/30 transition-colors">
                        {visibleCols.map((key) => renderProductCell(key))}
                      </tr>
                    );
                    // RULE 3: Display stock per variation (sub-rows under parent)
                    const variations = (product as any).variations as Array<{ id: string; sku?: string; attributes: any; stock: number }> | undefined;
                    if (product.hasVariations && variations?.length) {
                      variations.forEach((v) => {
                        const attrText = typeof v.attributes === 'object' && v.attributes !== null
                          ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ')
                          : String(v.attributes || '');
                        const renderVariationCell = (key: string) => {
                          const dash = <td key={key} className="px-4 py-1.5 text-center text-gray-500 text-xs">—</td>;
                          const dashRight = <td key={key} className="px-4 py-1.5 text-right text-gray-500 text-xs">—</td>;
                          const dashLeft = <td key={key} className="px-4 py-1.5 text-gray-500 text-xs">—</td>;
                          if (key === 'product') {
                            return (
                              <td key={key} className="px-4 py-1.5 pl-10">
                                <div className="text-gray-400 text-[11px]">
                                  <span className="font-mono">└ SKU: {v.sku || 'N/A'}</span>
                                  {attrText && <p className="text-gray-500 mt-0.5 text-[10px]">{attrText}</p>}
                                </div>
                              </td>
                            );
                          }
                          if (key === 'stockQty') {
                            const vStock = v.stock ?? 0;
                            return (
                              <td key={key} className="px-4 py-1.5 text-center">
                                <span className={cn("font-mono text-xs tabular-nums", vStock < 0 ? "text-red-400" : "text-gray-300")}>{vStock}</span>
                                {enablePacking && <span className="text-gray-500 text-[10px] ml-1">{product.unit || 'pcs'}</span>}
                              </td>
                            );
                          }
                          if (key === 'boxes') return <td key={key} className="px-4 py-1.5 text-center text-gray-500 text-xs">0</td>;
                          if (key === 'pieces') return <td key={key} className="px-4 py-1.5 text-center text-gray-500 text-xs">0</td>;
                          if (key === 'unit') return <td key={key} className="px-4 py-1.5 text-center text-gray-500 text-xs">{product.unit || 'pcs'}</td>;
                          if (key === 'stockValue') {
                            const val = (v.stock ?? 0) * product.sellingPrice;
                            return (
                              <td key={key} className={cn('px-4 py-1.5 text-right text-xs tabular-nums', val < 0 ? 'text-red-400' : 'text-green-400/80')}>
                                {val.toLocaleString()}
                              </td>
                            );
                          }
                          if (['sku', 'category', 'avgCost', 'sellingPrice', 'movement', 'status'].includes(key)) return key === 'sku' ? dashLeft : dash;
                          if (key === 'actions') return <td key={key} className="px-4 py-1.5 text-center print:hidden text-xs">—</td>;
                          return dash;
                        };
                        rows.push(
                          <tr key={`${product.id}-${v.id}`} className="bg-gray-900/40 hover:bg-gray-800/20 transition-colors opacity-90">
                            {visibleCols.map((key) => renderVariationCell(key))}
                          </tr>
                        );
                      });
                    }
                    return rows;
                  })
                )}
              </tbody>
            </table>
          </div>
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
        } : null}
        onAdjust={handleAdjustSave}
      />

      {/* Import Inventory CSV modal */}
      <Dialog open={importInventoryModalOpen} onOpenChange={(open) => { if (!open) { setImportInventoryModalOpen(false); setImportRows([]); } }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Upload size={20} />
              Import inventory
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400">Upload a CSV with columns <code className="bg-gray-800 px-1 rounded">sku</code> and <code className="bg-gray-800 px-1 rounded">quantity</code>. Quantities will be added as opening balance.</p>
          <div>
            <input
              type="file"
              accept=".csv"
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-gray-700 file:text-white file:text-sm"
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
          {importRows.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-400">SKU</th>
                    <th className="text-left px-3 py-2 text-gray-400">Product</th>
                    <th className="text-right px-3 py-2 text-gray-400">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-gray-800">
                      <td className="px-3 py-1.5 font-mono">{r.sku}</td>
                      <td className="px-3 py-1.5 text-gray-400">{r.name ?? '—'}</td>
                      <td className="px-3 py-1.5 text-right">{r.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importRows.length > 20 && <p className="text-xs text-gray-500 px-3 py-1">+ {importRows.length - 20} more</p>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-gray-700" onClick={() => { setImportInventoryModalOpen(false); setImportRows([]); }}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500"
              disabled={importRows.length === 0 || importing || importRows.every((r) => !r.productId)}
              onClick={async () => {
                const valid = importRows.filter((r) => r.productId && r.quantity > 0);
                if (!companyId || valid.length === 0) return;
                setImporting(true);
                try {
                  const branchIdOrNull = branchId && branchId !== 'all' ? branchId : null;
                  for (const row of valid) {
                    if (row.productId)
                      await inventoryService.insertOpeningBalanceMovement(companyId, branchIdOrNull, row.productId, row.quantity, 0);
                  }
                  await loadOverview();
                  toast.success(`Imported ${valid.length} item(s).`);
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
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">From Date</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="bg-gray-950 border-gray-700 text-white w-40"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">To Date</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="bg-gray-950 border-gray-700 text-white w-40"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Movement Type</label>
              <select
                value={filters.movementType}
                onChange={(e) => setFilters(f => ({ ...f, movementType: e.target.value }))}
                className="h-9 px-3 rounded-md bg-gray-950 border border-gray-700 text-white text-sm w-40"
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
              <label className="text-xs text-gray-400 block mb-1">Product</label>
              <select
                value={filters.productId}
                onChange={(e) => setFilters(f => ({ ...f, productId: e.target.value }))}
                className="h-9 px-3 rounded-md bg-gray-950 border border-gray-700 text-white text-sm min-w-[180px]"
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
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden min-w-0">
            <div className="p-6 border-b border-gray-800">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Stock Movements</h3>
                  <p className="text-sm text-gray-400 mt-1">Filter by date, product, and movement type</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-2 bg-gray-950/50 border border-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('detailed')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
                        viewMode === 'detailed'
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white"
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
                          : "text-gray-400 hover:text-white"
                      )}
                      title="Grouped mode shows net effect per document (user-friendly)"
                    >
                      <Layers size={14} />
                      Grouped
                    </button>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2 border-gray-700 text-gray-300" onClick={() => exportMovementsCsv(viewMode)}>
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
              <thead className="bg-gray-950/50 border-b border-gray-800 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Variation</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Qty Change</th>
                  {enablePacking && (
                    <>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Box Change</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Piece Change</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Before Qty</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">After Qty</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Unit Cost</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase max-w-[200px]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {movementsLoading ? (
                  <tr>
                    <td colSpan={enablePacking ? 11 : 9} className="px-6 py-12 text-center">
                      <Loader2 size={32} className="mx-auto text-blue-500 animate-spin" />
                      <p className="text-gray-400 text-sm mt-2">Loading movements...</p>
                    </td>
                  </tr>
                ) : displayedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={enablePacking ? 11 : 9} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No movements found. Adjust filters or ensure stock_movements has data.
                    </td>
                  </tr>
                ) : (
                  displayedMovements.map((m) => {
                    const isGrouped = (m as any).is_grouped === true;
                    const movementCount = (m as any).movement_count || 1;
                    return (
                    <tr key={m.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 text-gray-400 text-sm whitespace-nowrap">
                        {m.created_at ? new Date(m.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{m.product?.name ?? '-'}</p>
                          <p className="text-xs text-gray-500">{m.product?.sku ?? ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
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
                          m.movement_type === 'purchase' ? "bg-green-500/20 text-green-400 border-green-500/30" :
                          m.movement_type === 'adjustment' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                          "bg-gray-500/20 text-gray-400 border-gray-500/30"
                        )}>
                          {m.movement_type ?? '-'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-white">
                        {m.quantity != null ? (Number(m.quantity) >= 0 ? '+' : '') + Number(m.quantity) : '-'}
                      </td>
                      {enablePacking && (
                        <>
                          <td className="px-6 py-4 text-center text-gray-400">{m.box_change ?? '-'}</td>
                          <td className="px-6 py-4 text-center text-gray-400">{m.piece_change ?? '-'}</td>
                        </>
                      )}
                      <td className="px-6 py-4 text-center text-gray-400">{m.before_qty ?? '-'}</td>
                      <td className="px-6 py-4 text-center text-gray-400">{m.after_qty ?? '-'}</td>
                      <td className="px-6 py-4 text-right text-gray-400">
                        {m.unit_cost != null ? `Rs ${Number(m.unit_cost).toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm max-w-[200px] truncate" title={m.notes || ''}>
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
