/**
 * Purchase Return Item Selection Dialog
 *
 * Standalone dialog for selecting items (and packing, if applicable) for a Purchase Return.
 * UI layout and behaviour match the Purchase View items table (source of truth).
 *
 * - Same columns: Product, SKU, Variation, Packing, Unit Price, Original Qty, Return Qty, Unit, Total
 * - Packing-driven items: Return Qty from Return Packing dialog only (read-only in table)
 * - Simple items: direct Return Qty input
 * - Output: clean payload for validation, stock, and ledger (no posting in this component)
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { useSettings } from '@/app/context/SettingsContext';
import { PackingEntryModal } from '@/app/components/transactions/PackingEntryModal';
import { RotateCcw, Save, X } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types (aligned with Purchase View / purchase items)
// ---------------------------------------------------------------------------

export interface PurchaseReturnSelectedItem {
  product_id: string;
  variation_id?: string;
  product_name: string;
  sku: string;
  return_qty: number;
  unit_price: number;
  total: number;
  unit?: string;
  /** Piece-level return selection; only when item uses packing */
  return_packing_details?: {
    returned_pieces: Array<{ box_no: number; piece_no: number; meters: number }>;
    returned_boxes: number;
    returned_pieces_count: number;
    returned_total_meters: number;
  };
  /** Original purchase item id for reference */
  purchase_item_id?: string;
}

export interface PurchaseReturnItemSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Purchase with items (same shape as ViewPurchaseDetailsDrawer) */
  purchase: {
    id: string;
    items: Array<{
      id: string;
      productId: string;
      variationId?: string;
      productName: string;
      sku: string;
      price: number;
      quantity: number;
      unit?: string;
      packing_details?: any;
      packingDetails?: any;
      variation?: any;
    }>;
  } | null;
  /** Already returned qty per item key (e.g. from existing returns). Optional. */
  alreadyReturnedMap?: Record<string, number>;
  /** Called with selected items (return_qty > 0) when user clicks Save */
  onSave: (items: PurchaseReturnSelectedItem[]) => void;
}

function getItemKey(item: { productId: string; variationId?: string }) {
  return `${item.productId}_${item.variationId || 'null'}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PurchaseReturnItemSelectionDialog({
  open,
  onOpenChange,
  purchase,
  alreadyReturnedMap = {},
  onSave,
}: PurchaseReturnItemSelectionDialogProps) {
  const { inventorySettings } = useSettings();
  const enablePacking = inventorySettings.enablePacking ?? false;

  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnPackingDetails, setReturnPackingDetails] = useState<Record<string, any>>({});
  const [packingModalOpen, setPackingModalOpen] = useState(false);
  const [activePackingItem, setActivePackingItem] = useState<any>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open && purchase?.items) {
      const initial: Record<string, number> = {};
      purchase.items.forEach((item) => {
        initial[getItemKey(item)] = 0;
      });
      setReturnQuantities(initial);
      setReturnPackingDetails({});
    }
  }, [open, purchase?.items]);

  const handleOpenPackingModal = (item: any) => {
    setActivePackingItem(item);
    setPackingModalOpen(true);
  };

  const handleSaveReturnPacking = (itemKey: string, returnPacking: any) => {
    setReturnPackingDetails((prev) => ({ ...prev, [itemKey]: returnPacking }));
    const meters = Number(returnPacking?.returned_total_meters ?? 0);
    setReturnQuantities((prev) => ({ ...prev, [itemKey]: meters }));
    setPackingModalOpen(false);
    setActivePackingItem(null);
  };

  const handleReturnQuantityChange = (itemKey: string, value: number) => {
    const item = purchase?.items.find((it) => getItemKey(it) === itemKey);
    if (!item) return;
    const originalQty = item.quantity ?? 0;
    const alreadyReturned = alreadyReturnedMap[itemKey] ?? 0;
    const maxReturnable = originalQty - alreadyReturned;
    const qty = Math.max(0, Math.min(maxReturnable, isNaN(value) ? 0 : value));
    setReturnQuantities((prev) => ({ ...prev, [itemKey]: qty }));
  };

  const handleSave = () => {
    if (!purchase?.items?.length) {
      toast.error('No purchase items to return');
      return;
    }

    const selected: PurchaseReturnSelectedItem[] = [];
    for (const item of purchase.items) {
      const key = getItemKey(item);
      const returnQty = returnQuantities[key] ?? 0;
      if (returnQty <= 0) continue;

      const originalQty = item.quantity ?? 0;
      const alreadyReturned = alreadyReturnedMap[key] ?? 0;
      if (returnQty > originalQty - alreadyReturned) {
        toast.error(`Return quantity exceeds available for ${item.productName}`);
        return;
      }

      const pd = item.packing_details || item.packingDetails || {};
      const hasPackingStructure =
        (pd.boxes && pd.boxes.length > 0) || (pd.loose_pieces && pd.loose_pieces.length > 0);
      if (hasPackingStructure && !returnPackingDetails[key]) {
        toast.error(`Complete Return Packing for "${item.productName}" before saving.`);
        return;
      }

      selected.push({
        product_id: item.productId,
        variation_id: item.variationId,
        product_name: item.productName,
        sku: item.sku || 'N/A',
        return_qty: returnQty,
        unit_price: item.price,
        total: returnQty * item.price,
        unit: item.unit,
        return_packing_details: returnPackingDetails[key] ?? undefined,
        purchase_item_id: item.id,
      });
    }

    if (selected.length === 0) {
      toast.error('Select at least one item with return quantity');
      return;
    }

    onSave(selected);
    onOpenChange(false);
  };

  if (!purchase) return null;

  const items = purchase.items;
  const hasSelection = Object.values(returnQuantities).some((q) => q > 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b border-gray-700 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <RotateCcw size={22} className="text-purple-400" />
              Purchase Return — Select Items
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-1">
              Select items and quantities to return. Layout matches Purchase View.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-0 py-4">
            <div className="rounded-xl border border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent bg-gray-800/50">
                    <TableHead className="text-gray-400">Product</TableHead>
                    <TableHead className="text-gray-400">SKU</TableHead>
                    <TableHead className="text-gray-400">Variation</TableHead>
                    {enablePacking && <TableHead className="text-gray-400">Packing</TableHead>}
                    <TableHead className="text-gray-400 text-right">Unit Price</TableHead>
                    <TableHead className="text-gray-400 text-center">Original Qty</TableHead>
                    {Object.keys(alreadyReturnedMap).length > 0 && (
                      <TableHead className="text-gray-400 text-center">Already Returned</TableHead>
                    )}
                    <TableHead className="text-gray-400 text-center">Return Qty</TableHead>
                    <TableHead className="text-gray-400">Unit</TableHead>
                    <TableHead className="text-gray-400 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const productName = item.productName || 'Unknown Product';
                    const displaySku = item.sku || 'N/A';
                    const qty = item.quantity ?? 0;
                    const variation = (item as any).variation || null;
                    const variationAttrs = variation?.attributes || {};
                    const variationSku = variation?.sku || null;
                    const variationText = variationAttrs
                      ? Object.entries(variationAttrs)
                          .filter(([_, v]) => v != null && v !== '')
                          .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
                          .join(', ')
                      : null;
                    const finalSku = variationSku || displaySku;
                    const pd = item.packing_details || item.packingDetails || {};
                    const totalBoxes = pd.total_boxes ?? 0;
                    const totalPieces = pd.total_pieces ?? 0;
                    const unitDisplay = item.unit ?? 'pcs';

                    const itemKey = getItemKey(item);
                    const alreadyReturned = alreadyReturnedMap[itemKey] ?? 0;
                    const maxReturnable = qty - alreadyReturned;
                    const canReturn = maxReturnable > 0;
                    const returnQty =
                      returnQuantities[itemKey] !== undefined &&
                      returnQuantities[itemKey] !== null
                        ? Number(returnQuantities[itemKey])
                        : 0;
                    const savedReturnPacking = returnPackingDetails[itemKey];
                    const hasPackingStructure =
                      (pd.boxes && pd.boxes.length > 0) ||
                      (pd.loose_pieces && pd.loose_pieces.length > 0);
                    const returnQtyFromPacking =
                      hasPackingStructure && savedReturnPacking
                        ? Number(savedReturnPacking.returned_total_meters ?? 0)
                        : returnQty;

                    let packingText = '—';
                    if (savedReturnPacking) {
                      const parts: string[] = [];
                      if (savedReturnPacking.returned_boxes > 0)
                        parts.push(
                          `${savedReturnPacking.returned_boxes} Box${savedReturnPacking.returned_boxes !== 1 ? 'es' : ''}`
                        );
                      if (savedReturnPacking.returned_pieces_count > 0)
                        parts.push(
                          `${savedReturnPacking.returned_pieces_count} Piece${savedReturnPacking.returned_pieces_count !== 1 ? 's' : ''}`
                        );
                      if (savedReturnPacking.returned_total_meters > 0)
                        parts.push(`${savedReturnPacking.returned_total_meters.toFixed(2)} M`);
                      packingText = parts.length ? parts.join(', ') : '—';
                    } else if (returnQty > 0 && qty > 0) {
                      const returnRatio = returnQty / qty;
                      const returnBoxes = Math.round(totalBoxes * returnRatio * 100) / 100;
                      const returnPieces = Math.round(totalPieces * returnRatio * 100) / 100;
                      const returnMeters = pd.total_meters
                        ? Math.round(pd.total_meters * returnRatio * 100) / 100
                        : 0;
                      const parts: string[] = [];
                      if (returnBoxes > 0) parts.push(`${returnBoxes} Box${returnBoxes !== 1 ? 'es' : ''}`);
                      if (returnPieces > 0) parts.push(`${returnPieces} Piece${returnPieces !== 1 ? 's' : ''}`);
                      if (returnMeters > 0) parts.push(`${returnMeters.toFixed(2)} M`);
                      packingText = parts.length ? parts.join(', ') : '—';
                    } else {
                      const parts: string[] = [];
                      if (totalBoxes > 0) parts.push(`${totalBoxes} Box${totalBoxes !== 1 ? 'es' : ''}`);
                      if (totalPieces > 0) parts.push(`${totalPieces} Piece${totalPieces !== 1 ? 's' : ''}`);
                      packingText = parts.length ? parts.join(', ') : '—';
                    }

                    return (
                      <TableRow
                        key={item.id}
                        className={cn('border-gray-800', !canReturn && 'opacity-50')}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{productName}</p>
                            {finalSku && finalSku !== 'N/A' && (
                              <p className="text-xs text-gray-500">SKU: {finalSku}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-400">{finalSku}</TableCell>
                        <TableCell>
                          {variationText ? (
                            <span className="text-gray-300 text-sm">{variationText}</span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </TableCell>
                        {enablePacking && (
                          <TableCell className="text-gray-400">
                            {hasPackingStructure ? (
                              <button
                                type="button"
                                onClick={() => handleOpenPackingModal(item)}
                                className="text-left hover:text-purple-400 transition-colors cursor-pointer"
                              >
                                {returnQtyFromPacking > 0 ? (
                                  <span className="text-purple-400 font-medium">{packingText}</span>
                                ) : (
                                  <span>{packingText}</span>
                                )}
                              </button>
                            ) : (
                              <span>{packingText}</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right text-white">
                          Rs. {item.price.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-white font-medium">{qty}</TableCell>
                        {Object.keys(alreadyReturnedMap).length > 0 && (
                          <TableCell className="text-center">
                            {alreadyReturned > 0 ? (
                              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                {alreadyReturned}
                              </Badge>
                            ) : (
                              <span className="text-gray-500">0</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          {hasPackingStructure ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center justify-center gap-1 rounded bg-gray-800/80 border border-amber-500/40 px-2 py-1.5 min-w-[4rem]">
                                <span className="text-sm font-medium text-white tabular-nums">
                                  {returnQtyFromPacking}
                                </span>
                              </div>
                              <p className="text-[10px] text-amber-400/90">From Return Packing</p>
                              {!canReturn && (
                                <p className="text-xs text-red-400 mt-0.5">Fully returned</p>
                              )}
                            </div>
                          ) : (
                            <>
                              <input
                                type="number"
                                min={0}
                                max={maxReturnable}
                                value={returnQty}
                                onChange={(e) => {
                                  const val =
                                    e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                  handleReturnQuantityChange(itemKey, val);
                                }}
                                disabled={!canReturn}
                                className="w-20 text-center bg-gray-900 border border-gray-700 text-white h-8 mx-auto font-medium rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                placeholder="0"
                              />
                              {!canReturn && (
                                <p className="text-xs text-red-400 mt-1">Fully returned</p>
                              )}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-400">{unitDisplay}</TableCell>
                        <TableCell className="text-right text-red-400 font-medium">
                          {returnQtyFromPacking > 0
                            ? `-Rs. ${(returnQtyFromPacking * item.price).toLocaleString()}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="border-t border-gray-700 pt-4 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-600 text-gray-300"
            >
              <X size={16} className="mr-2" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!hasSelection}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Save size={16} className="mr-2" />
              Save selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activePackingItem && (
        <PackingEntryModal
          open={packingModalOpen}
          onOpenChange={(open) => {
            setPackingModalOpen(open);
            if (!open) setActivePackingItem(null);
          }}
          onSave={() => {
            setPackingModalOpen(false);
            setActivePackingItem(null);
          }}
          productName={activePackingItem.productName || 'Product'}
          initialData={activePackingItem.packing_details || activePackingItem.packingDetails}
          returnMode={true}
          returnPackingDetails={returnPackingDetails[getItemKey(activePackingItem)]}
          onSaveReturnPacking={(details) =>
            handleSaveReturnPacking(getItemKey(activePackingItem), details)
          }
          alreadyReturnedPieces={new Set()}
        />
      )}
    </>
  );
}
