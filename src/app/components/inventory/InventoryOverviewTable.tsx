/**
 * Shared inventory overview table — used by InventoryDesignTestPage (live) and InventoryDashboardNew.
 */
import React from 'react';
import {
  Package, Loader2, ExternalLink, SlidersHorizontal, ChevronDown, ChevronRight, Pencil, ArrowRightLeft,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn, formatBoxesPieces } from '../ui/utils';
import {
  ErpTable,
  ErpTableBody,
  ErpTableCell,
  ErpTableHead,
  ErpTableHeaderCell,
  ErpTableRow,
  ErpTableScroll,
  ErpTableShell,
  ErpCategoryBadge,
  ErpMoneyCell,
  ErpMovementBadge,
  ErpStatusBadge,
  erpColumnAlign,
} from '../ui/erp-surfaces';
import { InventoryOverviewRow } from '../../services/inventoryService';
import { formatQty } from '@/app/utils/quantity';

export interface InventoryOverviewTableProps {
  products: InventoryOverviewRow[];
  loading: boolean;
  visibleCols: string[];
  columnsList: Array<{ key: string; label: string }>;
  enablePacking: boolean;
  combosEnabled?: boolean;
  expandedIds?: Set<string>;
  onToggleExpand?: (id: string) => void;
  comboDetailsCache?: Record<string, Array<{ product_name: string; qty: number; variation_sku?: string | null }>>;
  loadingComboId?: string | null;
  /** When true, variation rows always show (no expand toggle). */
  alwaysShowVariations?: boolean;
  actionsMode?: 'icons' | 'labels';
  onLedger: (product: InventoryOverviewRow) => void;
  onEdit?: (product: InventoryOverviewRow) => void;
  onAdjust: (product: InventoryOverviewRow) => void;
  onTransfer?: (product: InventoryOverviewRow) => void;
  className?: string;
}

export function InventoryOverviewTable({
  products,
  loading,
  visibleCols,
  columnsList,
  enablePacking,
  combosEnabled = false,
  expandedIds,
  onToggleExpand,
  comboDetailsCache = {},
  loadingComboId = null,
  alwaysShowVariations = false,
  actionsMode = 'icons',
  onLedger,
  onEdit,
  onAdjust,
  onTransfer,
  className,
}: InventoryOverviewTableProps) {
  const expandMode = !alwaysShowVariations && expandedIds != null && onToggleExpand != null;

  const renderActions = (product: InventoryOverviewRow) => {
    if (actionsMode === 'labels') {
      return (
        <div className="flex items-center justify-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 px-2" onClick={() => onLedger(product)}>
            <ExternalLink size={12} className="mr-1" /> Ledger
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-2" onClick={() => onAdjust(product)}>
            <SlidersHorizontal size={12} className="mr-1" /> Adjust
          </Button>
          {onTransfer && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 px-2" onClick={() => onTransfer(product)}>
              <ArrowRightLeft size={12} className="mr-1" /> Transfer
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-1">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-primary hover:bg-primary/10" onClick={() => onLedger(product)} title="Ledger">
          <ExternalLink size={16} />
        </Button>
        {onEdit && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent" onClick={() => onEdit(product)} title="Edit">
            <Pencil size={16} />
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-amber-400 hover:bg-amber-500/10" onClick={() => onAdjust(product)} title="Adjust">
          <SlidersHorizontal size={16} />
        </Button>
      </div>
    );
  };

  const renderProductCell = (product: InventoryOverviewRow, isChild = false) => {
    const hasVariations = product.hasVariations && (product as any).variations?.length > 0;
    const isCombo = combosEnabled && !!(product as any).isComboProduct && ((product as any).comboItemCount ?? 0) > 0;
    const isExpandable = expandMode && (hasVariations || isCombo);
    const isExpanded = expandMode && expandedIds!.has(product.id);

    return (
      <ErpTableCell
        align="left"
        className={cn('min-w-[220px] w-[220px]', isChild && 'pl-10 border-l-2 border-border')}
      >
        <div className="flex items-center gap-2">
          {isExpandable ? (
            <button type="button" onClick={() => onToggleExpand!(product.id)} className="text-muted-foreground hover:text-foreground p-0.5">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : !isChild ? (
            <span className="w-5" />
          ) : null}
          {!isChild && <Package size={16} className="text-muted-foreground shrink-0" />}
          <div>
            <div className="font-medium text-foreground text-sm leading-tight">{product.name}</div>
            {hasVariations && !isChild && (
              <p className="text-xs text-muted-foreground mt-0.5">{(product as any).variations?.length} variations</p>
            )}
            {isCombo && !isChild && (
              <p className="text-xs text-muted-foreground mt-0.5">Bundle ({(product as any).comboItemCount ?? 0} items)</p>
            )}
          </div>
        </div>
      </ErpTableCell>
    );
  };

  const renderVariationRow = (
    product: InventoryOverviewRow,
    v: any,
    visibleColsLocal: string[],
  ) => {
    const attrText =
      typeof v.attributes === 'object' && v.attributes !== null
        ? Object.entries(v.attributes as Record<string, string>)
            .filter(([, val]) => String(val).trim() !== '')
            .map(([k, val]) => `${k}: ${val}`)
            .join(' · ')
        : '';
    const vQty = Number(v.stock ?? 0);
    const varPurch =
      typeof v.purchasePrice === 'number' && Number.isFinite(v.purchasePrice) ? v.purchasePrice : product.avgCost;
    const varSell =
      typeof v.sellingPrice === 'number' && Number.isFinite(v.sellingPrice) ? v.sellingPrice : product.sellingPrice;
    const valueAtCost =
      typeof v.stockValueAtCost === 'number' && Number.isFinite(v.stockValueAtCost) ? v.stockValueAtCost : vQty * varPurch;
    const valueAtRetail =
      typeof v.retailStockValue === 'number' && Number.isFinite(v.retailStockValue) ? v.retailStockValue : vQty * varSell;

    return (
      <ErpTableRow key={`${product.id}-${v.id}`} child>
        {visibleColsLocal.includes('actions') && (
          <ErpTableCell align="center" className="text-muted-foreground print:hidden">—</ErpTableCell>
        )}
        {visibleColsLocal.includes('product') && (
          <ErpTableCell align="left" className="pl-10 min-w-[220px] w-[220px] border-l-2 border-border">
            <div className="text-muted-foreground text-sm font-medium leading-snug">{attrText || 'Variation'}</div>
            <div className="text-muted-foreground text-xs font-mono mt-0.5">SKU {v.sku || '—'}</div>
          </ErpTableCell>
        )}
        {visibleColsLocal.includes('sku') && (
          <ErpTableCell align="left" className="font-mono text-muted-foreground min-w-[140px] w-[140px] whitespace-nowrap">
            {v.sku || v.id || '—'}
          </ErpTableCell>
        )}
        {visibleColsLocal.includes('category') && (
          <ErpTableCell align="left" className="text-muted-foreground">—</ErpTableCell>
        )}
        {visibleColsLocal.includes('stockQty') && (
          <ErpTableCell align="center">
            <span className={cn('font-medium tabular-nums text-sm', vQty < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {formatQty(vQty)}
            </span>
          </ErpTableCell>
        )}
        {enablePacking && visibleColsLocal.includes('boxes') && (
          <ErpTableCell align="center" className="text-muted-foreground tabular-nums">{formatBoxesPieces((v as any).boxes)}</ErpTableCell>
        )}
        {enablePacking && visibleColsLocal.includes('pieces') && (
          <ErpTableCell align="center" className="text-muted-foreground tabular-nums">{formatBoxesPieces((v as any).pieces)}</ErpTableCell>
        )}
        {enablePacking && visibleColsLocal.includes('unit') && (
          <ErpTableCell align="center" className="text-muted-foreground">{product.unit ?? '—'}</ErpTableCell>
        )}
        {visibleColsLocal.includes('avgCost') && (
          <ErpTableCell align="right"><ErpMoneyCell value={varPurch} /></ErpTableCell>
        )}
        {visibleColsLocal.includes('sellingPrice') && (
          <ErpTableCell align="right"><ErpMoneyCell value={varSell} /></ErpTableCell>
        )}
        {visibleColsLocal.includes('stockValue') && (
          <ErpTableCell align="right" className="align-top">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">At cost</div>
            <ErpMoneyCell value={valueAtCost} />
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mt-1">At retail</div>
            <span className={cn('text-sm tabular-nums', valueAtRetail < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {Number(valueAtRetail).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </ErpTableCell>
        )}
        {visibleColsLocal.includes('movement') && (
          <ErpTableCell align="center" className="text-muted-foreground">—</ErpTableCell>
        )}
        {visibleColsLocal.includes('status') && (
          <ErpTableCell align="center">
            {(v.stock ?? 0) <= 0 ? <ErpStatusBadge status="Out" /> : <ErpStatusBadge status="OK" />}
          </ErpTableCell>
        )}
      </ErpTableRow>
    );
  };

  return (
    <ErpTableShell className={className}>
      <ErpTableScroll>
        <ErpTable>
          <ErpTableHead>
            <tr>
              {visibleCols.map((key) => {
                const label = columnsList.find((c) => c.key === key)?.label ?? key;
                return (
                  <ErpTableHeaderCell
                    key={key}
                    align={erpColumnAlign(key)}
                    className={cn(
                      key === 'product' && 'min-w-[220px] w-[220px]',
                      key === 'sku' && 'min-w-[140px] w-[140px]',
                      key === 'actions' && 'print:hidden',
                    )}
                  >
                    {label}
                  </ErpTableHeaderCell>
                );
              })}
            </tr>
          </ErpTableHead>
          <ErpTableBody>
            {loading ? (
              <tr>
                <td colSpan={visibleCols.length} className="px-6 py-12 text-center">
                  <Loader2 size={40} className="mx-auto text-primary animate-spin mb-2" />
                  <p className="text-muted-foreground text-sm">Loading inventory...</p>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="px-6 py-12 text-center">
                  <Package size={40} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No products found</p>
                </td>
              </tr>
            ) : (
              products.flatMap((product) => {
                const rows: React.ReactNode[] = [];
                const hasVariations = product.hasVariations && (product as any).variations?.length > 0;
                const isCombo = combosEnabled && !!(product as any).isComboProduct && ((product as any).comboItemCount ?? 0) > 0;
                const showVariations = alwaysShowVariations || (expandMode && expandedIds!.has(product.id));

                rows.push(
                  <ErpTableRow key={product.id}>
                    {visibleCols.includes('actions') && (
                      <ErpTableCell align="center" className="print:hidden">{renderActions(product)}</ErpTableCell>
                    )}
                    {visibleCols.includes('product') && renderProductCell(product)}
                    {visibleCols.includes('sku') && (
                      <ErpTableCell align="left" className="font-mono text-muted-foreground min-w-[140px] w-[140px] whitespace-nowrap">
                        {product.sku}
                      </ErpTableCell>
                    )}
                    {visibleCols.includes('category') && (
                      <ErpTableCell align="left"><ErpCategoryBadge label={product.category} /></ErpTableCell>
                    )}
                    {visibleCols.includes('stockQty') && (
                      <ErpTableCell align="center">
                        <span
                          className={cn(
                            'font-semibold tabular-nums text-sm',
                            product.stock < 0 || product.status === 'Out' || product.status === 'Low'
                              ? 'text-destructive'
                              : 'text-foreground',
                          )}
                        >
                          {formatQty(product.stock)}
                        </span>
                      </ErpTableCell>
                    )}
                    {enablePacking && visibleCols.includes('boxes') && (
                      <ErpTableCell align="center" className="text-muted-foreground tabular-nums">{formatBoxesPieces(product.boxes)}</ErpTableCell>
                    )}
                    {enablePacking && visibleCols.includes('pieces') && (
                      <ErpTableCell align="center" className="text-muted-foreground tabular-nums">{formatBoxesPieces(product.pieces)}</ErpTableCell>
                    )}
                    {enablePacking && visibleCols.includes('unit') && (
                      <ErpTableCell align="center" className="text-muted-foreground">{product.unit ?? '—'}</ErpTableCell>
                    )}
                    {visibleCols.includes('avgCost') && (
                      <ErpTableCell align="right"><ErpMoneyCell value={product.avgCost} /></ErpTableCell>
                    )}
                    {visibleCols.includes('sellingPrice') && (
                      <ErpTableCell align="right"><ErpMoneyCell value={product.sellingPrice} /></ErpTableCell>
                    )}
                    {visibleCols.includes('stockValue') && (
                      <ErpTableCell align="right"><ErpMoneyCell value={product.stockValue} /></ErpTableCell>
                    )}
                    {visibleCols.includes('movement') && (
                      <ErpTableCell align="center"><ErpMovementBadge movement={product.movement} /></ErpTableCell>
                    )}
                    {visibleCols.includes('status') && (
                      <ErpTableCell align="center"><ErpStatusBadge status={product.status} /></ErpTableCell>
                    )}
                  </ErpTableRow>,
                );

                if (isCombo && showVariations) {
                  const bundleItems = comboDetailsCache[product.id];
                  const loadingBundle = loadingComboId === product.id;
                  rows.push(
                    <ErpTableRow key={`${product.id}-bundle`} child>
                      <td colSpan={visibleCols.length} className="px-4 py-2.5 pl-10 text-muted-foreground text-sm border-l-2 border-border">
                        <p className="font-medium text-foreground mb-1">Bundle includes:</p>
                        {loadingBundle ? (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Loader2 size={14} className="animate-spin" /> Loading…
                          </span>
                        ) : bundleItems?.length ? (
                          <ul className="list-disc list-inside space-y-0.5">
                            {bundleItems.map((it, idx) => (
                              <li key={idx}>{it.product_name} × {it.qty}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground">No items</span>
                        )}
                      </td>
                    </ErpTableRow>,
                  );
                }

                if (hasVariations && showVariations && (product as any).variations?.length) {
                  ((product as any).variations as any[]).forEach((v) => {
                    rows.push(renderVariationRow(product, v, visibleCols));
                  });
                }

                return rows;
              })
            )}
          </ErpTableBody>
        </ErpTable>
      </ErpTableScroll>
    </ErpTableShell>
  );
}
