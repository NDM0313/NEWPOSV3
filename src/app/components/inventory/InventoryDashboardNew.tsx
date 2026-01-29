import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Package, TrendingDown, DollarSign, AlertTriangle, 
  BarChart3, Search, Filter, Download, Warehouse, Loader2,
  ExternalLink, SlidersHorizontal, FileDown, Printer
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { useSupabase } from '../../context/SupabaseContext';
import { productService } from '../../services/productService';
import { inventoryService, InventoryOverviewRow, InventoryMovementRow } from '../../services/inventoryService';
import { toast } from 'sonner';
import { FullStockLedgerView } from '../products/FullStockLedgerView';
import { StockAdjustmentDrawer } from './StockAdjustmentDrawer';

type InventoryTab = 'overview' | 'analytics';

export const InventoryDashboardNew = () => {
  const { companyId, branchId, user, enablePacking } = useSupabase();
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
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    productId: '',
    movementType: '',
  });

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
    const headers = ['Product', 'SKU', 'Category', 'Stock', 'Boxes', 'Pieces', 'Unit', 'Avg Cost', 'Selling Price', 'Stock Value', 'Status', 'Movement'];
    const rows = filteredProducts.map(p => [
      p.name, p.sku, p.category, p.stock, p.boxes, p.pieces, p.unit,
      p.avgCost, p.sellingPrice, p.stockValue, p.status, p.movement,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Export downloaded');
  }, [filteredProducts]);

  const exportMovementsCsv = useCallback(() => {
    const headers = ['Date', 'Product', 'SKU', 'Type', 'Qty', 'Box', 'Piece', 'Before', 'After', 'Unit Cost', 'Notes'];
    const rows = movements.map(m => [
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
      (m.notes || '').replace(/,/g, ';'),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Export downloaded');
  }, [movements]);

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
              <Button variant="outline" className="gap-2 border-gray-700 text-gray-300" onClick={exportMovementsCsv}>
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
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Stock</th>
                  {enablePacking && (
                    <>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Boxes</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Pieces</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Unit</th>
                    </>
                  )}
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
                    <td colSpan={enablePacking ? 13 : 10} className="px-6 py-12 text-center">
                      <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                      <p className="text-gray-400 text-sm">Loading inventory...</p>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={enablePacking ? 13 : 10} className="px-6 py-12 text-center">
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
                        <td className="px-6 py-4 text-center text-gray-400">{product.unit}</td>
                      </>
                    )}
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
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Stock Movements</h3>
                <p className="text-sm text-gray-400 mt-1">Filter by date, product, and movement type</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2 border-gray-700 text-gray-300" onClick={exportMovementsCsv}>
                <Download size={16} /> Export CSV
              </Button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-950/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Qty</th>
                  {enablePacking && (
                    <>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Box</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Piece</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Before</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">After</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Unit Cost</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase max-w-[200px]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {movementsLoading ? (
                  <tr>
                    <td colSpan={enablePacking ? 10 : 6} className="px-6 py-12 text-center">
                      <Loader2 size={32} className="mx-auto text-blue-500 animate-spin" />
                      <p className="text-gray-400 text-sm mt-2">Loading movements...</p>
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={enablePacking ? 10 : 6} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No movements found. Adjust filters or ensure stock_movements has data.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
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
                          <td className="px-6 py-4 text-center text-gray-400">{m.before_qty ?? '-'}</td>
                          <td className="px-6 py-4 text-center text-gray-400">{m.after_qty ?? '-'}</td>
                        </>
                      )}
                      <td className="px-6 py-4 text-right text-gray-400">
                        {m.unit_cost != null ? `Rs ${Number(m.unit_cost).toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm max-w-[200px] truncate" title={m.notes || ''}>
                        {m.notes || '-'}
                      </td>
                    </tr>
                  ))
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
