import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Package, TrendingDown, DollarSign, AlertTriangle, 
  BarChart3, Search, Filter, Download, Warehouse, Loader2,
  ExternalLink, SlidersHorizontal, FileDown, Printer, List, Layers
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
import { groupStockMovements, ViewMode, GroupedMovementRow } from '../../utils/stockMovementGrouping';

type InventoryTab = 'overview' | 'analytics';

export const InventoryDashboardNew = () => {
  const { companyId, branchId, user } = useSupabase();
  const { inventorySettings } = useSettings();
  const enablePacking = inventorySettings.enablePacking;
  const [activeTab, setActiveTab] = useState<InventoryTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [overviewRows, setOverviewRows] = useState<InventoryOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const filteredProducts = useMemo(() => 
    overviewRows.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [overviewRows, searchTerm]
  );

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
      await productService.updateProduct(data.productId, { current_stock: data.newStock });
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
      ? ['Product', 'SKU', 'Category', 'Stock Qty', 'Boxes', 'Pieces', 'Unit', 'Avg Cost', 'Selling Price', 'Stock Value', 'Status', 'Movement']
      : ['Product', 'SKU', 'Category', 'Stock Qty', 'Unit', 'Avg Cost', 'Selling Price', 'Stock Value', 'Status', 'Movement'];
    const rows = filteredProducts.map(p => {
      if (enablePacking) {
        return [p.name, p.sku, p.category, p.stock, p.boxes, p.pieces, p.unit, p.avgCost, p.sellingPrice, p.stockValue, p.status, p.movement].join(',');
      } else {
        return [p.name, p.sku, p.category, p.stock, p.unit, p.avgCost, p.sellingPrice, p.stockValue, p.status, p.movement].join(',');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-800 pb-4">
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
      <div className="border-b border-gray-800">
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

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
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

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name, SKU, or category..."
              className="pl-10 bg-gray-900 border-gray-700 text-white"
            />
          </div>

          {/* Stock Table */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden print:border print:rounded">
            <table className="w-full">
              <thead className="bg-gray-950/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">SKU</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Stock Qty</th>
                  {enablePacking && (
                    <>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Boxes</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Pieces</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Unit</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Avg Cost</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Selling Price</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Stock Value</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Movement</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={enablePacking ? 13 : 11} className="px-6 py-12 text-center">
                      <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                      <p className="text-gray-400 text-sm">Loading inventory...</p>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={enablePacking ? 13 : 11} className="px-6 py-12 text-center">
                      <Package size={48} className="mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400 text-sm">No products found</p>
                      <p className="text-gray-600 text-xs mt-1">Try adjusting your search</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{product.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-400 font-mono text-sm">{product.sku}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-400">{product.category}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "font-bold font-mono",
                        product.status === 'Out' || product.status === 'Low' ? "text-red-400" : "text-white"
                      )}>
                        {product.stock}
                      </span>
                    </td>
                    {enablePacking && (
                      <>
                        <td className="px-6 py-4 text-center text-gray-400">{product.boxes}</td>
                        <td className="px-6 py-4 text-center text-gray-400">{product.pieces}</td>
                      </>
                    )}
                    <td className="px-6 py-4 text-center text-gray-400">{product.unit}</td>
                    <td className="px-6 py-4 text-right text-gray-400">
                      Rs {product.avgCost.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-white font-medium">
                      Rs {product.sellingPrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      Rs {product.stockValue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge className={cn("border", getMovementBadge(product.movement))}>
                        {product.movement}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {product.status === 'Out' ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border">Out</Badge>
                      ) : product.status === 'Low' ? (
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 border">
                          <AlertTriangle size={12} className="mr-1" />
                          Low
                        </Badge>
                      ) : (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">OK</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center print:hidden">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          onClick={() => setLedgerProduct(product)}
                        >
                          <ExternalLink size={14} className="mr-1" />
                          Ledger
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          onClick={() => setAdjustmentProduct(product)}
                        >
                          <SlidersHorizontal size={14} className="mr-1" />
                          Adjust
                        </Button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
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

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in duration-300">
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

          {/* Movements Table */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
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
            <table className="w-full">
              <thead className="bg-gray-950/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
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
                    <td colSpan={enablePacking ? 10 : 8} className="px-6 py-12 text-center">
                      <Loader2 size={32} className="mx-auto text-blue-500 animate-spin" />
                      <p className="text-gray-400 text-sm mt-2">Loading movements...</p>
                    </td>
                  </tr>
                ) : displayedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={enablePacking ? 10 : 8} className="px-6 py-12 text-center text-gray-400 text-sm">
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

          {/* Summary cards from overview (reuse for context) */}
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
        </div>
      )}
    </div>
  );
};
