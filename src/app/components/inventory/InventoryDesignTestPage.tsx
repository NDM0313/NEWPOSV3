/**
 * Inventory Design Test Page
 * Same design as the reference screenshot: header + toolbar + table.
 * Fully functional with real data. Does not replace the main Inventory page.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download, Warehouse, Loader2, Upload, BarChart3
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useSupabase } from '../../context/SupabaseContext';
import { useSettings } from '../../context/SettingsContext';
import { useNavigation } from '../../context/NavigationContext';
import { productService } from '../../services/productService';
import { inventoryService, InventoryOverviewRow } from '../../services/inventoryService';
import { openingBalanceJournalService } from '../../services/openingBalanceJournalService';
import { comboService } from '../../services/comboService';
import { toast } from 'sonner';
import { FullStockLedgerView } from '../products/FullStockLedgerView';
import { StockAdjustmentDrawer } from './StockAdjustmentDrawer';
import { ListToolbar } from '../ui/list-toolbar';
import { Pagination } from '../ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { formatQty } from '@/app/utils/quantity';
import {
  ErpPage,
  ErpPageDescription,
  ErpPageHeader,
  ErpPageTitle,
} from '../ui/erp-surfaces';
import { InventoryOverviewTable } from './InventoryOverviewTable';

export const InventoryDesignTestPage = () => {
  const { openDrawer, setCurrentView } = useNavigation();
  const { companyId, branchId, user } = useSupabase();
  const { inventorySettings, modules } = useSettings();
  const enablePacking = inventorySettings.enablePacking;
  const combosEnabled = modules?.combosEnabled ?? false;
  const [overviewRows, setOverviewRows] = useState<InventoryOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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

  // Global refresh: when inventory or products are updated anywhere in the app, refetch overview
  useEffect(() => {
    const onInventoryOrProductsUpdate = () => { if (companyId) loadOverview(); };
    window.addEventListener('products-updated', onInventoryOrProductsUpdate);
    window.addEventListener('inventory-updated', onInventoryOrProductsUpdate);
    return () => {
      window.removeEventListener('products-updated', onInventoryOrProductsUpdate);
      window.removeEventListener('inventory-updated', onInventoryOrProductsUpdate);
    };
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

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize) || 1);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, overviewCategoryFilter, overviewStatusFilter, overviewMovementFilter]);

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

  // Load combo items when a combo product row is expanded (must run after paginatedProducts is defined)
  useEffect(() => {
    if (!companyId || !combosEnabled) return;
    const toLoad = paginatedProducts.filter(
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
  }, [companyId, combosEnabled, paginatedProducts, expandedIds]);

  const overviewFilterActiveCount = [overviewCategoryFilter !== 'all', overviewStatusFilter !== 'all', overviewMovementFilter !== 'all'].filter(Boolean).length;
  const uniqueCategories = useMemo(() => {
    const set = new Set(overviewRows.map(p => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [overviewRows]);

  // Packing OFF: sirf Stock column; Unit, Boxes, Pieces HIDE. Packing ON: Boxes, Pieces, Unit, Stock sab show.
  const columnKeys = useMemo(() => {
    const base = ['product', 'sku', 'category', 'stockQty'];
    const packingCols = enablePacking ? (['boxes', 'pieces', 'unit'] as const) : [];
    return ['actions', ...base, ...packingCols, 'avgCost', 'sellingPrice', 'stockValue', 'movement', 'status'] as const;
  }, [enablePacking]);

  const columnsList = useMemo(() => [
    { key: 'actions', label: 'Actions' },
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
  ], [enablePacking]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      window.dispatchEvent(new CustomEvent('inventory-updated'));
    } catch (error: any) {
      toast.error('Adjustment failed: ' + (error?.message || 'Unknown error'));
    }
  }, [companyId, user?.id, loadOverview]);

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
    <ErpPage>
      <ErpPageHeader>
        <div>
          <ErpPageTitle>Inventory Management</ErpPageTitle>
          <ErpPageDescription>Track and manage your stock efficiently</ErpPageDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setCurrentView('stock-report')}>
            <BarChart3 size={16} />
            Stock Report
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setCurrentView('inventory-analytics-test')}>
            <BarChart3 size={16} />
            Stock Analytics
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download size={16} />
            Export
          </Button>
        </div>
      </ErpPageHeader>

      <div className="shrink-0 border-b border-border">
        <ListToolbar
          search={{ value: searchTerm, onChange: setSearchTerm, placeholder: 'Search by product name, SKU, or category...' }}
          rowsSelector={{
            value: pageSize,
            onChange: handlePageSizeChange,
            totalItems: filteredProducts.length,
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
            isOpen: overviewFilterOpen,
            onToggle: () => setOverviewFilterOpen(o => !o),
            activeCount: overviewFilterActiveCount,
            renderPanel: () => (
              <div className="absolute right-0 top-12 w-72 bg-card border border-border rounded-lg shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Filters</h3>
                  <button onClick={() => { setOverviewCategoryFilter('all'); setOverviewStatusFilter('all'); setOverviewMovementFilter('all'); }} className="text-xs text-blue-400 hover:text-blue-300">Clear All</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground block font-medium mb-1">Category</label>
                    <select value={overviewCategoryFilter} onChange={e => setOverviewCategoryFilter(e.target.value)} className="w-full rounded-md bg-muted border border-border text-foreground text-sm px-3 py-2">
                      <option value="all">All categories</option>
                      {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block font-medium mb-1">Status</label>
                    <select value={overviewStatusFilter} onChange={e => setOverviewStatusFilter(e.target.value)} className="w-full rounded-md bg-muted border border-border text-foreground text-sm px-3 py-2">
                      <option value="all">All status</option>
                      <option value="OK">OK</option>
                      <option value="Low">Low</option>
                      <option value="Out">Out</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block font-medium mb-1">Movement</label>
                    <select value={overviewMovementFilter} onChange={e => setOverviewMovementFilter(e.target.value)} className="w-full rounded-md bg-muted border border-border text-foreground text-sm px-3 py-2">
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

      <div className="flex-1 min-h-0 flex flex-col px-6 py-4">
        <InventoryOverviewTable
          products={paginatedProducts}
          loading={loading}
          visibleCols={visibleCols}
          columnsList={columnsList}
          enablePacking={enablePacking}
          combosEnabled={combosEnabled}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          comboDetailsCache={comboDetailsCache}
          loadingComboId={loadingComboId}
          onLedger={setLedgerProduct}
          onEdit={(product) => openDrawer?.('edit-product', undefined, { product: { id: product.productId, uuid: product.productId, name: product.name, sku: product.sku } })}
          onAdjust={setAdjustmentProduct}
        />
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredProducts.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

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
          hasVariations: adjustmentProduct.hasVariations,
          variations: adjustmentProduct.variations?.map((v) => ({
            id: v.id,
            attributes: v.attributes,
            sku: v.sku,
            stock: v.stock ?? 0,
          })),
        } : null}
        onAdjust={handleAdjustSave}
      />

      <Dialog open={importInventoryModalOpen} onOpenChange={o => { if (!o) { setImportInventoryModalOpen(false); setImportRows([]); } }}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2"><Upload size={20} /> Import inventory</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">CSV with columns <code className="bg-muted px-1 rounded">sku</code> and <code className="bg-muted px-1 rounded">quantity</code>.</p>
          <input
            type="file"
            accept=".csv"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-muted file:text-foreground"
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
            <div className="max-h-40 overflow-y-auto rounded border border-border text-sm">
              <table className="w-full">
                <thead className="bg-muted"><tr><th className="text-left px-3 py-2 text-muted-foreground">SKU</th><th className="text-left px-3 py-2 text-muted-foreground">Product</th><th className="text-right px-3 py-2 text-muted-foreground">Qty</th></tr></thead>
                <tbody>
                  {importRows.slice(0, 15).map((r, i) => (
                    <tr key={i} className="border-t border-border"><td className="px-3 py-1 font-mono">{r.sku}</td><td className="px-3 py-1 text-muted-foreground">{r.name ?? '—'}</td><td className="px-3 py-1 text-right tabular-nums">{formatQty(r.quantity)}</td></tr>
                  ))}
                </tbody>
              </table>
              {importRows.length > 15 && <p className="text-xs text-muted-foreground px-3 py-1">+ {importRows.length - 15} more</p>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-border mr-auto"
              disabled={!companyId || importing}
              onClick={async () => {
                if (!companyId) return;
                setImporting(true);
                try {
                  const r = await openingBalanceJournalService.syncInventoryOpeningBalancesForCompany(companyId);
                  const total = r.posted + r.kept;
                  toast.success(
                    total > 0
                      ? `Synced ${total} opening GL entr${total === 1 ? 'y' : 'ies'} (Rs. ${r.totalValue.toLocaleString()}).`
                      : 'No opening stock movements needed GL sync.'
                  );
                  if (r.skippedZeroCost > 0) {
                    toast.warning(`${r.skippedZeroCost} movement(s) skipped — zero cost.`);
                  }
                  if (r.errors.length > 0) {
                    toast.error(`${r.errors.length} sync error(s). Check console.`);
                  }
                } catch (err: unknown) {
                  toast.error('GL sync failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
                } finally {
                  setImporting(false);
                }
              }}
            >
              Sync opening GL
            </Button>
            <Button variant="outline" className="border-border" onClick={() => { setImportInventoryModalOpen(false); setImportRows([]); }}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500"
              disabled={importRows.length === 0 || importing || importRows.every(r => !r.productId)}
              onClick={async () => {
                const valid = importRows.filter(r => r.productId && r.quantity > 0);
                if (!companyId || valid.length === 0) return;
                setImporting(true);
                try {
                  const branchIdOrNull = branchId && branchId !== 'all' ? branchId : null;
                  const overviewByProductId = new Map(overviewRows.map(p => [p.productId, p]));
                  const result = await inventoryService.bulkImportOpeningInventory(
                    companyId,
                    branchIdOrNull,
                    valid.map(row => ({
                      productId: row.productId!,
                      quantity: row.quantity,
                      unitCost: overviewByProductId.get(row.productId!)?.avgCost ?? 0,
                    }))
                  );
                  await loadOverview();
                  window.dispatchEvent(new CustomEvent('inventory-updated'));
                  const glMsg =
                    result.openingGlPosted + result.openingGlKept > 0
                      ? ` · ${result.openingGlPosted + result.openingGlKept} opening GL entr${result.openingGlPosted + result.openingGlKept === 1 ? 'y' : 'ies'}`
                      : '';
                  toast.success(`Imported ${result.processed} item(s)${glMsg}.`);
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
              {importing ? 'Importing…' : `Apply ${importRows.filter(r => r.productId).length} row(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErpPage>
  );
};
