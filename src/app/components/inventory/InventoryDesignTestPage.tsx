/**
 * Inventory Design Test Page
 * Same design as the reference screenshot: header + toolbar + table.
 * Fully functional with real data. Does not replace the main Inventory page.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, Download, Warehouse, Loader2, ExternalLink, SlidersHorizontal,
  ChevronDown, ChevronRight, Pencil, Upload, BarChart3
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { useSupabase } from '../../context/SupabaseContext';
import { useSettings } from '../../context/SettingsContext';
import { useNavigation } from '../../context/NavigationContext';
import { productService } from '../../services/productService';
import { inventoryService, InventoryOverviewRow } from '../../services/inventoryService';
import { comboService } from '../../services/comboService';
import { toast } from 'sonner';
import { FullStockLedgerView } from '../products/FullStockLedgerView';
import { StockAdjustmentDrawer } from './StockAdjustmentDrawer';
import { ListToolbar } from '../ui/list-toolbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';

export const InventoryDesignTestPage = () => {
  const { openDrawer, setCurrentView } = useNavigation();
  const { companyId, branchId, user } = useSupabase();
  const { inventorySettings, modules } = useSettings();
  const enablePacking = inventorySettings.enablePacking;
  const combosEnabled = modules?.combosEnabled ?? false;
  const [overviewRows, setOverviewRows] = useState<InventoryOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [comboDetailsCache, setComboDetailsCache] = useState<Record<string, Array<{ product_name: string; qty: number; variation_sku?: string | null }>>>({});
  const [loadingComboId, setLoadingComboId] = useState<string | null>(null);
  const [ledgerProduct, setLedgerProduct] = useState<InventoryOverviewRow | null>(null);
  const [adjustmentProduct, setAdjustmentProduct] = useState<InventoryOverviewRow | null>(null);
  const [overviewFilterOpen, setOverviewFilterOpen] = useState(false);
  const [overviewCategoryFilter, setOverviewCategoryFilter] = useState('all');
  const [overviewStatusFilter, setOverviewStatusFilter] = useState('all');
  const [overviewMovementFilter, setOverviewMovementFilter] = useState('all');
  const [importInventoryModalOpen, setImportInventoryModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<Array<{ sku: string; quantity: number; productId?: string; name?: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    product: true, sku: true, category: true, stockQty: true, boxes: true, pieces: true,
    unit: true, avgCost: true, sellingPrice: true, stockValue: true, movement: true, status: true, actions: true,
  });

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
      console.error('[INVENTORY DESIGN TEST] Error loading:', error);
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

  // Load combo items when a combo product row is expanded (must run after displayedProducts is defined)
  useEffect(() => {
    if (!companyId || !combosEnabled) return;
    const toLoad = displayedProducts.filter(
      p => (p as any).isComboProduct && (p as any).comboItemCount > 0 && expandedIds.has(p.id) && !comboDetailsCache[p.id]
    );
    toLoad.forEach(async (product) => {
      setLoadingComboId(pid => pid || product.id);
      try {
        const combo = await comboService.getComboByProductId(product.id, companyId);
        if (!combo?.id) return;
        const items = await comboService.getComboItemsWithDetails(combo.id, companyId);
        setComboDetailsCache(prev => ({
          ...prev,
          [product.id]: (items || []).map(it => ({
            product_name: it.variation_sku ? `${it.product_name} (${it.variation_sku})` : it.product_name,
            qty: it.qty,
            variation_sku: it.variation_sku,
          })),
        }));
      } catch (e) {
        console.error('[INVENTORY DESIGN TEST] Combo details load error:', e);
        toast.error('Failed to load bundle items');
      } finally {
        setLoadingComboId(prev => (prev === product.id ? null : prev));
      }
    });
  }, [companyId, combosEnabled, displayedProducts, expandedIds]);

  const overviewFilterActiveCount = [overviewCategoryFilter !== 'all', overviewStatusFilter !== 'all', overviewMovementFilter !== 'all'].filter(Boolean).length;
  const uniqueCategories = useMemo(() => {
    const set = new Set(overviewRows.map(p => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [overviewRows]);

  // Packing OFF: sirf Stock column; Unit, Boxes, Pieces HIDE. Packing ON: Boxes, Pieces, Unit, Stock sab show.
  const columnKeys = useMemo(() => {
    const base = ['product', 'sku', 'category', 'stockQty'];
    const packingCols = enablePacking ? (['boxes', 'pieces', 'unit'] as const) : [];
    return [...base, ...packingCols, 'avgCost', 'sellingPrice', 'stockValue', 'movement', 'status', 'actions'] as const;
  }, [enablePacking]);

  const columnsList = useMemo(() => [
    { key: 'product', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'category', label: 'Category' },
    { key: 'stockQty', label: 'Stock' },
    ...(enablePacking ? [{ key: 'boxes', label: 'Boxes' }, { key: 'pieces', label: 'Pieces' }, { key: 'unit', label: 'Unit' }] : []),
    { key: 'avgCost', label: 'Cost Price' },
    { key: 'sellingPrice', label: 'Selling Price' },
    { key: 'stockValue', label: 'Stock Value' },
    { key: 'movement', label: 'Movement' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ], [enablePacking]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getMovementBadge = (movement: string) => {
    switch (movement) {
      case 'Fast': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Medium': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Slow': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Dead': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

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
      toast.error('Adjustment failed: ' + (error?.message || 'Unknown error'));
    }
  }, [companyId, branchId, user?.id, loadOverview]);

  const exportCsv = () => {
    const headers = ['Product', 'SKU', 'Category', 'Stock', ...(enablePacking ? ['Unit'] : []), 'Cost Price', 'Selling Price', 'Stock Value', 'Movement', 'Status'];
    const rows = filteredProducts.map(p =>
      [p.name, p.sku, p.category, p.stock, ...(enablePacking ? [p.unit] : []), p.avgCost, p.sellingPrice, p.stockValue, p.movement, p.status]
    );
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export downloaded');
  };

  const visibleCols = columnKeys.filter(k => visibleColumns[k] !== false);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0B0F19]">
      {/* Header - screenshot style */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventory Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track and manage your stock efficiently</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 border-gray-700 text-gray-300" onClick={() => setCurrentView('inventory-analytics-test')}>
            <BarChart3 size={16} />
            Stock Analytics
          </Button>
          <Button variant="outline" className="gap-2 border-gray-700 text-gray-300" onClick={exportCsv}>
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 border-b border-gray-800">
        <ListToolbar
          search={{ value: searchTerm, onChange: setSearchTerm, placeholder: 'Search by product name, SKU, or category...' }}
          rowsSelector={{ value: pageSize, onChange: setPageSize, totalItems: filteredProducts.length }}
          columnsManager={{
            columns: columnsList,
            visibleColumns,
            onToggle: (key) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] })),
            onShowAll: () => setVisibleColumns(prev => Object.fromEntries(Object.keys(prev).map(k => [k, true]))),
          }}
          filter={{
            isOpen: overviewFilterOpen,
            onToggle: () => setOverviewFilterOpen(o => !o),
            activeCount: overviewFilterActiveCount,
            renderPanel: () => (
              <div className="absolute right-0 top-12 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Filters</h3>
                  <button onClick={() => { setOverviewCategoryFilter('all'); setOverviewStatusFilter('all'); setOverviewMovementFilter('all'); }} className="text-xs text-blue-400 hover:text-blue-300">Clear All</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block font-medium mb-1">Category</label>
                    <select value={overviewCategoryFilter} onChange={e => setOverviewCategoryFilter(e.target.value)} className="w-full rounded-md bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2">
                      <option value="all">All categories</option>
                      {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block font-medium mb-1">Status</label>
                    <select value={overviewStatusFilter} onChange={e => setOverviewStatusFilter(e.target.value)} className="w-full rounded-md bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2">
                      <option value="all">All status</option>
                      <option value="OK">OK</option>
                      <option value="Low">Low</option>
                      <option value="Out">Out</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block font-medium mb-1">Movement</label>
                    <select value={overviewMovementFilter} onChange={e => setOverviewMovementFilter(e.target.value)} className="w-full rounded-md bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2">
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
          exportConfig={{ onExportCSV: exportCsv, onExportExcel: () => {}, onExportPDF: () => {} }}
        />
      </div>

      {/* Table — container width unchanged; scroll inside */}
      <div className="flex-1 min-h-0 flex flex-col px-6 py-4">
        <div className="flex-1 min-h-0 bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-gray-950/50 border-b border-gray-800">
              <tr>
                {visibleCols.map(key => {
                  const label = columnsList.find(c => c.key === key)?.label ?? key;
                  const align = ['avgCost', 'sellingPrice', 'stockValue'].includes(key) ? 'text-right' : ['stockQty', 'unit', 'boxes', 'pieces', 'movement', 'status', 'actions'].includes(key) ? 'text-center' : 'text-left';
                  return <th key={key} className={cn('px-4 py-3 text-xs font-medium text-gray-400 uppercase', align, key === 'product' && 'min-w-[220px] w-[220px]', key === 'sku' && 'min-w-[140px] w-[140px]', key === 'actions' && 'print:hidden')}>{label}</th>;
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={visibleCols.length} className="px-6 py-12 text-center">
                    <Loader2 size={40} className="mx-auto text-blue-500 animate-spin mb-2" />
                    <p className="text-gray-400 text-sm">Loading inventory...</p>
                  </td>
                </tr>
              ) : displayedProducts.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length} className="px-6 py-12 text-center">
                    <Package size={40} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-gray-400 text-sm">No products found</p>
                  </td>
                </tr>
              ) : (
                displayedProducts.flatMap(product => {
                  const rows: React.ReactNode[] = [];
                  const hasVariations = product.hasVariations && (product as any).variations?.length > 0;
                  const isCombo = combosEnabled && !!(product as any).isComboProduct && ((product as any).comboItemCount ?? 0) > 0;
                  const isExpandable = hasVariations || isCombo;
                  const isExpanded = expandedIds.has(product.id);

                  rows.push(
                    <tr key={product.id} className="hover:bg-gray-800/30 transition-colors">
                      {visibleCols.includes('product') && (
                        <td className="px-4 py-3 min-w-[220px] w-[220px]">
                          <div className="flex items-center gap-2">
                            {isExpandable ? (
                              <button type="button" onClick={() => toggleExpand(product.id)} className="text-gray-400 hover:text-white p-0.5">
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                            ) : <span className="w-5" />}
                            <Package size={16} className="text-gray-500 shrink-0" />
                            <div>
                              <div className="font-medium text-white text-sm leading-tight">{product.name}</div>
                              {hasVariations && (
                                <p className="text-xs text-gray-500 mt-0.5">{(product as any).variations?.length} variations</p>
                              )}
                              {isCombo && (
                                <p className="text-xs text-gray-500 mt-0.5">Bundle ({(product as any).comboItemCount ?? 0} items)</p>
                              )}
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleCols.includes('sku') && <td className="px-4 py-3 text-gray-400 font-mono text-sm min-w-[140px] w-[140px] whitespace-nowrap">{product.sku}</td>}
                      {visibleCols.includes('category') && (
                        <td className="px-4 py-3">
                          <Badge className="bg-gray-700/50 text-gray-300 border-gray-600 text-xs">{product.category}</Badge>
                        </td>
                      )}
                      {visibleCols.includes('stockQty') && (
                        <td className="px-4 py-3 text-center">
                          <span className={cn('font-semibold tabular-nums text-sm', product.stock < 0 ? 'text-red-400' : product.status === 'Out' || product.status === 'Low' ? 'text-red-400' : 'text-white')}>{product.stock}</span>
                          {enablePacking && <span className="text-gray-500 text-xs ml-1">{product.unit || 'pcs'}</span>}
                        </td>
                      )}
                      {enablePacking && visibleCols.includes('boxes') && <td className="px-4 py-3 text-center text-gray-400 text-sm">{product.boxes ?? 0}</td>}
                      {enablePacking && visibleCols.includes('pieces') && <td className="px-4 py-3 text-center text-gray-400 text-sm">{product.pieces ?? 0}</td>}
                      {enablePacking && visibleCols.includes('unit') && <td className="px-4 py-3 text-center text-gray-400 text-sm">{product.unit || 'pcs'}</td>}
                      {visibleCols.includes('avgCost') && (
                        <td className={cn('px-4 py-3 text-right text-sm font-medium tabular-nums', product.avgCost < 0 ? 'text-red-400' : 'text-green-400')}>
                          {product.avgCost.toLocaleString()}
                        </td>
                      )}
                      {visibleCols.includes('sellingPrice') && (
                        <td className={cn('px-4 py-3 text-right text-sm font-medium tabular-nums', product.sellingPrice < 0 ? 'text-red-400' : 'text-green-400')}>
                          {product.sellingPrice.toLocaleString()}
                        </td>
                      )}
                      {visibleCols.includes('stockValue') && (
                        <td className={cn('px-4 py-3 text-right font-medium text-sm tabular-nums', product.stockValue < 0 ? 'text-red-400' : 'text-green-400')}>
                          {product.stockValue.toLocaleString()}
                        </td>
                      )}
                      {visibleCols.includes('movement') && (
                        <td className="px-4 py-3 text-center">
                          <Badge className={cn('border text-xs', getMovementBadge(product.movement))}>{product.movement}</Badge>
                        </td>
                      )}
                      {visibleCols.includes('status') && (
                        <td className="px-4 py-3 text-center">
                          {product.status === 'Out' ? (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Out</Badge>
                          ) : product.status === 'Low' ? (
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Low</Badge>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">OK</Badge>
                          )}
                        </td>
                      )}
                      {visibleCols.includes('actions') && (
                        <td className="px-4 py-3 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-400 hover:bg-blue-500/10" onClick={() => setLedgerProduct(product)} title="Ledger">
                              <ExternalLink size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:bg-gray-500/10" onClick={() => openDrawer?.('edit-product', undefined, { product: { id: product.productId, uuid: product.productId, name: product.name, sku: product.sku } })} title="Edit">
                              <Pencil size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-amber-400 hover:bg-amber-500/10" onClick={() => setAdjustmentProduct(product)} title="Adjust">
                              <SlidersHorizontal size={16} />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );

                  if (isCombo && isExpanded) {
                    const bundleItems = comboDetailsCache[product.id];
                    const loadingBundle = loadingComboId === product.id;
                    rows.push(
                      <tr key={`${product.id}-bundle-includes`} className="bg-gray-900/60 hover:bg-gray-800/20">
                        <td colSpan={visibleCols.length} className="px-4 py-3 pl-12 text-gray-400 text-sm">
                          <p className="font-medium text-gray-300 mb-1">Bundle includes:</p>
                          {loadingBundle ? (
                            <span className="text-gray-500 flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Loading…</span>
                          ) : bundleItems?.length ? (
                            <ul className="list-disc list-inside space-y-0.5">
                              {bundleItems.map((it, idx) => (
                                <li key={idx}>{it.product_name} × {it.qty}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500">No items</span>
                          )}
                        </td>
                      </tr>
                    );
                  }
                  if (hasVariations && isExpanded && (product as any).variations?.length) {
                    ((product as any).variations as any[]).forEach((v: any) => {
                      const variationLabel = typeof v.attributes === 'object' && v.attributes !== null && Object.keys(v.attributes).length > 0
                        ? Object.values(v.attributes).map((val: any) => String(val)).join(' / ')
                        : (v.sku || '—');
                      rows.push(
                        <tr key={`${product.id}-${v.id}`} className="bg-gray-900/60 hover:bg-gray-800/20">
                          {visibleCols.includes('product') && (
                            <td className="px-4 py-2 pl-12 min-w-[220px] w-[220px]">
                              <span className="text-gray-400 text-sm">{variationLabel}</span>
                            </td>
                          )}
                          {visibleCols.includes('sku') && <td className="px-4 py-2 text-gray-500 text-sm font-mono min-w-[140px] w-[140px] whitespace-nowrap">{v.sku || v.id || '—'}</td>}
                          {visibleCols.includes('category') && <td className="px-4 py-2 text-gray-600">—</td>}
                          {visibleCols.includes('stockQty') && (
                            <td className="px-4 py-2 text-center">
                              <span className={cn('font-mono text-sm tabular-nums', (v.stock ?? 0) < 0 ? 'text-red-400' : 'text-gray-300')}>{v.stock ?? 0}</span>
                              {enablePacking && <span className="text-gray-500 text-xs ml-1">{product.unit || 'pcs'}</span>}
                            </td>
                          )}
                          {enablePacking && visibleCols.includes('boxes') && <td className="px-4 py-2 text-center text-gray-600">0</td>}
                          {enablePacking && visibleCols.includes('pieces') && <td className="px-4 py-2 text-center text-gray-600">0</td>}
                          {enablePacking && visibleCols.includes('unit') && <td className="px-4 py-2 text-center text-gray-600">{product.unit || 'pcs'}</td>}
                          {visibleCols.includes('avgCost') && <td className="px-4 py-2 text-right text-gray-600">—</td>}
                          {visibleCols.includes('sellingPrice') && <td className="px-4 py-2 text-right text-gray-600">—</td>}
                          {visibleCols.includes('stockValue') && (() => {
                            const val = (v.stock ?? 0) * product.sellingPrice;
                            return (
                              <td className={cn('px-4 py-2 text-right text-sm tabular-nums', val < 0 ? 'text-red-400' : 'text-green-400/80')}>
                                {val.toLocaleString()}
                              </td>
                            );
                          })()}
                          {visibleCols.includes('movement') && <td className="px-4 py-2 text-center text-gray-600">—</td>}
                          {visibleCols.includes('status') && (
                            <td className="px-4 py-2 text-center">
                              {(v.stock ?? 0) <= 0 ? <Badge className="bg-red-500/20 text-red-400 text-xs">Out</Badge> : <Badge className="bg-green-500/20 text-green-400 text-xs">OK</Badge>}
                            </td>
                          )}
                          {visibleCols.includes('actions') && <td className="px-4 py-2 text-center text-gray-600">—</td>}
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

      <Dialog open={importInventoryModalOpen} onOpenChange={o => { if (!o) { setImportInventoryModalOpen(false); setImportRows([]); } }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2"><Upload size={20} /> Import inventory</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400">CSV with columns <code className="bg-gray-800 px-1 rounded">sku</code> and <code className="bg-gray-800 px-1 rounded">quantity</code>.</p>
          <input
            type="file"
            accept=".csv"
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-gray-700 file:text-white"
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const text = String(reader.result ?? '');
                const lines = text.split(/\r?\n/).filter(Boolean);
                const header = (lines[0] ?? '').toLowerCase().split(',').map(h => h.trim());
                const skuIdx = header.findIndex(h => h === 'sku');
                const qtyIdx = header.findIndex(h => h === 'quantity' || h === 'qty');
                if (skuIdx < 0 || qtyIdx < 0) { toast.error('CSV must have sku and quantity columns'); return; }
                const rows: Array<{ sku: string; quantity: number; productId?: string; name?: string }> = [];
                for (let i = 1; i < lines.length; i++) {
                  const cells = lines[i].split(',').map(c => c.trim());
                  const sku = cells[skuIdx] ?? '';
                  const qty = parseInt(cells[qtyIdx] ?? '0', 10);
                  if (!sku || isNaN(qty) || qty < 0) continue;
                  const product = overviewRows.find(p => p.sku === sku);
                  rows.push({ sku, quantity: qty, productId: product?.productId, name: product?.name });
                }
                setImportRows(rows);
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
          {importRows.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border border-gray-700 text-sm">
              <table className="w-full">
                <thead className="bg-gray-800"><tr><th className="text-left px-3 py-2 text-gray-400">SKU</th><th className="text-left px-3 py-2 text-gray-400">Product</th><th className="text-right px-3 py-2 text-gray-400">Qty</th></tr></thead>
                <tbody>
                  {importRows.slice(0, 15).map((r, i) => (
                    <tr key={i} className="border-t border-gray-800"><td className="px-3 py-1 font-mono">{r.sku}</td><td className="px-3 py-1 text-gray-400">{r.name ?? '—'}</td><td className="px-3 py-1 text-right">{r.quantity}</td></tr>
                  ))}
                </tbody>
              </table>
              {importRows.length > 15 && <p className="text-xs text-gray-500 px-3 py-1">+ {importRows.length - 15} more</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-gray-700" onClick={() => { setImportInventoryModalOpen(false); setImportRows([]); }}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500"
              disabled={importRows.length === 0 || importing || importRows.every(r => !r.productId)}
              onClick={async () => {
                const valid = importRows.filter(r => r.productId && r.quantity > 0);
                if (!companyId || valid.length === 0) return;
                setImporting(true);
                try {
                  const branchIdOrNull = branchId && branchId !== 'all' ? branchId : null;
                  for (const row of valid) {
                    if (row.productId) await inventoryService.insertOpeningBalanceMovement(companyId, branchIdOrNull, row.productId, row.quantity, 0);
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
              {importing ? 'Importing…' : `Apply ${importRows.filter(r => r.productId).length} row(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
