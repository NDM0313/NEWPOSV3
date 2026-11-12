import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, RotateCcw, Play } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/app/components/ui/popover';
import { ErpFilterPanel } from '@/app/components/ui/erp-surfaces';
import { cn } from '@/app/components/ui/utils';
import type {
  MovementTypeFilter,
  ReportMode,
  StockMovementReportFilters,
  StockStatusFilter,
} from '@/app/lib/stockMovementReportLogic';
import type { CatalogProduct } from '@/app/services/stockMovementHistoryReportService';

export interface ProductVariationOption {
  id: string;
  label: string;
}

interface BranchOption {
  id: string;
  name: string;
}

interface Props {
  filters: StockMovementReportFilters;
  onChange: (patch: Partial<StockMovementReportFilters>) => void;
  onRun: () => void;
  onReset: () => void;
  validationError: string | null;
  branches: BranchOption[];
  categories: { id: string; name: string; parentId: string | null }[];
  brands: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  productSearchResults: CatalogProduct[];
  onProductSearch: (term: string) => void;
  onProductSelect: (product: CatalogProduct) => void;
  selectedProductLabel: string;
  productVariations?: ProductVariationOption[];
  showVariationPicker?: boolean;
  onVariationChange?: (variationId: string | null) => void;
  loading?: boolean;
  exportSlot?: React.ReactNode;
}

const MOVEMENT_TYPES: { value: MovementTypeFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'sale', label: 'Sale' },
  { value: 'return', label: 'Return' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'opening_stock', label: 'Opening Stock' },
  { value: 'production', label: 'Production' },
  { value: 'rental', label: 'Rental' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STOCK_STATUS: { value: StockStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'zero_stock', label: 'Zero Stock' },
  { value: 'negative_stock', label: 'Negative Stock' },
  { value: 'no_movement', label: 'No Movement' },
];

export function StockMovementFilterPanel({
  filters,
  onChange,
  onRun,
  onReset,
  validationError,
  branches,
  categories,
  brands,
  suppliers,
  productSearchResults,
  onProductSearch,
  onProductSelect,
  selectedProductLabel,
  productVariations = [],
  showVariationPicker = false,
  onVariationChange,
  loading,
  exportSlot,
}: Props) {
  const [productTerm, setProductTerm] = useState('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openedAtRef = useRef(0);

  const displayValue = productTerm !== '' ? productTerm : selectedProductLabel;

  const handlePickerOpenChange = (next: boolean) => {
    if (!next && inputRef.current === document.activeElement) return;
    if (!next && Date.now() - openedAtRef.current < 120) return;
    setProductPickerOpen(next);
  };

  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories],
  );
  const subcategories = useMemo(
    () => categories.filter((c) => c.parentId === filters.categoryId),
    [categories, filters.categoryId],
  );

  useEffect(() => {
    const t = setTimeout(() => onProductSearch(productTerm), 300);
    return () => clearTimeout(t);
  }, [productTerm, onProductSearch]);

  const handleSelectProduct = (product: CatalogProduct) => {
    onProductSelect(product);
    onChange({ productId: product.id, variationId: null });
    setProductTerm('');
    setProductPickerOpen(false);
    inputRef.current?.blur();
  };

  return (
    <ErpFilterPanel className="no-print">
      <div className="flex items-center gap-2 text-foreground font-medium">
        <Filter size={18} className="text-blue-400" />
        Filters
      </div>

      <div className="flex flex-wrap gap-2">
        {(['single', 'all'] as ReportMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ mode })}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filters.mode === mode ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted',
            )}
          >
            {mode === 'single' ? 'Single Product' : 'All Products'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label className="text-muted-foreground">Branch</Label>
          <select
            value={filters.branchId || ''}
            onChange={(e) => onChange({ branchId: e.target.value || null })}
            className="w-full mt-1 rounded-md bg-input-background border border-border px-3 py-2 text-sm text-foreground"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-muted-foreground">Movement type</Label>
          <select
            value={filters.movementType}
            onChange={(e) => onChange({ movementType: e.target.value as MovementTypeFilter })}
            className="w-full mt-1 rounded-md bg-input-background border border-border px-3 py-2 text-sm text-foreground"
          >
            {MOVEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {filters.mode === 'single' && (
        <div className="space-y-3 max-w-md">
          <Popover open={productPickerOpen} onOpenChange={handlePickerOpenChange} modal={false}>
            <PopoverAnchor asChild>
              <div className="relative">
                <Label className="text-muted-foreground">Product</Label>
                <Input
                  ref={inputRef}
                  placeholder="Search by name or SKU…"
                  value={displayValue}
                  onChange={(e) => {
                    setProductTerm(e.target.value);
                    openedAtRef.current = Date.now();
                    setProductPickerOpen(true);
                    if (filters.productId) {
                      onChange({ productId: null, variationId: null });
                    }
                  }}
                  onFocus={() => {
                    openedAtRef.current = Date.now();
                    setProductPickerOpen(true);
                    onProductSearch(productTerm);
                  }}
                  className="bg-input-background border-border mt-1"
                />
                {filters.productId && selectedProductLabel && !productTerm && (
                  <p className="text-xs text-emerald-400 mt-1">Selected: {selectedProductLabel}</p>
                )}
              </div>
            </PopoverAnchor>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0 bg-card border-border"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="max-h-48 overflow-y-auto">
                {productSearchResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground italic">
                    {productTerm.trim() ? 'No products found' : 'Loading products…'}
                  </p>
                ) : (
                  productSearchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-gray-200"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectProduct(p)}
                    >
                      {p.name} <span className="text-muted-foreground">({p.sku})</span>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {showVariationPicker && productVariations.length > 0 && (
            <div>
              <Label className="text-muted-foreground">Variation</Label>
              <select
                value={filters.variationId || ''}
                onChange={(e) => onVariationChange?.(e.target.value || null)}
                className="w-full mt-1 rounded-md bg-input-background border border-border px-3 py-2 text-sm text-foreground"
              >
                <option value="">All variations (combined)</option>
                {productVariations.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {filters.mode === 'all' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-muted-foreground">Category</Label>
            <select
              value={filters.categoryId || ''}
              onChange={(e) => onChange({ categoryId: e.target.value || null, subcategoryId: null })}
              className="w-full mt-1 rounded-md bg-input-background border border-border px-3 py-2 text-sm text-foreground"
            >
              <option value="">All categories</option>
              {parentCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-muted-foreground">Subcategory</Label>
            <select
              value={filters.subcategoryId || ''}
              onChange={(e) => onChange({ subcategoryId: e.target.value || null })}
              disabled={!filters.categoryId}
              className="w-full mt-1 rounded-md bg-input-background border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50"
            >
              <option value="">All subcategories</option>
              {subcategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-muted-foreground">Brand</Label>
            <select
              value={filters.brandId || ''}
              onChange={(e) => onChange({ brandId: e.target.value || null })}
              className="w-full mt-1 rounded-md bg-input-background border border-border px-3 py-2 text-sm text-foreground"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-muted-foreground">Supplier (from purchases)</Label>
            <select
              value={filters.supplierId || ''}
              onChange={(e) => onChange({ supplierId: e.target.value || null })}
              className="w-full mt-1 rounded-md bg-input-background border border-border px-3 py-2 text-sm text-foreground"
            >
              <option value="">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Products purchased from supplier in date range</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Stock status</Label>
            <select
              value={filters.stockStatus}
              onChange={(e) => onChange({ stockStatus: e.target.value as StockStatusFilter })}
              className="w-full mt-1 rounded-md bg-input-background border border-border px-3 py-2 text-sm text-foreground"
            >
              {STOCK_STATUS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.includeZeroStock}
            onChange={(e) => onChange({ includeZeroStock: e.target.checked })}
            className="rounded border-gray-600"
          />
          Include zero stock products
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.includeNoTransaction}
            onChange={(e) => onChange({ includeNoTransaction: e.target.checked })}
            className="rounded border-gray-600"
          />
          Include products with no stock transaction
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.includeInactive}
            onChange={(e) => onChange({ includeInactive: e.target.checked })}
            className="rounded border-gray-600"
          />
          Include inactive products
        </label>
      </div>

      {validationError && (
        <p className="text-sm text-red-400">{validationError}</p>
      )}

      <div className="flex gap-2">
        <Button onClick={onRun} disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Play size={16} />
          Run Report
        </Button>
        <Button variant="outline" onClick={onReset} className="gap-2 border-border text-muted-foreground">
          <RotateCcw size={16} />
          Reset
        </Button>
      </div>

      {exportSlot && (
        <div className="pt-3 mt-3 border-t border-border">
          {exportSlot}
        </div>
      )}
    </ErpFilterPanel>
  );
}
