import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Minus, AlertCircle, Calendar, FileText, Save, MapPin, Loader2, Layers, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { branchService, type Branch } from '@/app/services/branchService';
import { inventoryService } from '@/app/services/inventoryService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { pickInitialStockAdjustBranchId } from '@/app/utils/branchScope';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { DateTimePicker, dateToDateTimePickerValue, dateTimePickerValueToDate } from "../ui/DateTimePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { formatQty } from '@/app/utils/quantity';
import { toLocalISOString } from '@/app/utils/localDate';

type AdjustmentType = 'add' | 'subtract';
type AdjustmentReason = 'damaged' | 'audit' | 'return' | 'theft' | 'correction' | 'other';

/** Single variation option for products with variations */
export type AdjustmentVariationOption = {
  id: string;
  attributes?: Record<string, unknown>;
  sku?: string;
  stock: number;
  boxes?: number;
  pieces?: number;
};

interface StockAdjustmentDrawerProps {
  open: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    unit: string;
    image?: string;
    /** When product has variations, which variation is pre-selected (e.g. from row context) */
    variationId?: string | null;
    /** If true, user must select a variation before adjusting */
    hasVariations?: boolean;
    /** List of variations with stock; required when hasVariations is true */
    variations?: AdjustmentVariationOption[];
  } | null;
  onAdjust: (data: {
    productId: string;
    branchId: string;
    type: AdjustmentType;
    quantity: number;
    reason: AdjustmentReason;
    notes: string;
    /** Full local timestamp for stock_movements.created_at */
    movementAt: string;
    newStock: number;
    /** Required when product has variations – adjustment applies only to this variation */
    variationId?: string | null;
  }) => void;
  onTransfer?: (data: {
    productId: string;
    fromBranchId: string;
    toBranchId: string;
    quantity: number;
    notes: string;
    variationId?: string | null;
  }) => void;
  /** Opens drawer on Adjust or Transfer tab */
  initialMode?: 'adjust' | 'transfer';
}

type DrawerMode = 'adjust' | 'transfer';

export const StockAdjustmentDrawer: React.FC<StockAdjustmentDrawerProps> = ({
  open,
  onClose,
  product,
  onAdjust,
  onTransfer,
  initialMode = 'adjust',
}) => {
  const { companyId, branchId, defaultBranchId } = useSupabase();
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(initialMode);
  const [type, setType] = useState<AdjustmentType>('add');
  const [quantity, setQuantity] = useState<number>(0);
  const [toBranchId, setToBranchId] = useState<string | null>(null);
  const [reason, setReason] = useState<AdjustmentReason>('correction');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [adjustBranchId, setAdjustBranchId] = useState<string | null>(null);
  const [branchStock, setBranchStock] = useState<number | null>(null);
  const [loadingBranchStock, setLoadingBranchStock] = useState(false);
  const [branchVariations, setBranchVariations] = useState<AdjustmentVariationOption[]>([]);
  const [loadingVariations, setLoadingVariations] = useState(false);

  const hasVariations = Boolean(product?.hasVariations);
  const variations = branchVariations.length > 0 ? branchVariations : (product?.variations ?? []);
  const showBranchSelect = branches.length > 1;
  const canTransfer = branches.length > 1 && Boolean(onTransfer);
  const destinationBranches = branches.filter((b) => b.id !== adjustBranchId);
  const selectedVariation = hasVariations && selectedVariationId
    ? variations.find((v) => v.id === selectedVariationId)
    : null;
  const effectiveCurrentStock = hasVariations && selectedVariation
    ? selectedVariation.stock
    : branchStock ?? (loadingBranchStock ? product?.currentStock ?? 0 : product?.currentStock ?? 0);

  const loadBranchStock = useCallback(
    async (branchUuid: string | null) => {
      if (!companyId || !product?.id || !branchUuid || hasVariations) {
        setBranchStock(null);
        return;
      }
      setLoadingBranchStock(true);
      try {
        const rows = await inventoryService.getInventoryOverview(companyId, branchUuid);
        const row = rows.find((r) => r.productId === product.id);
        setBranchStock(row?.stock ?? 0);
      } catch (e) {
        console.error('[StockAdjustmentDrawer] branch stock:', e);
        setBranchStock(0);
      } finally {
        setLoadingBranchStock(false);
      }
    },
    [companyId, product?.id, hasVariations],
  );

  const loadVariationsForBranch = useCallback(
    async (branchUuid: string | null) => {
      if (!companyId || !product?.id || !hasVariations) {
        setBranchVariations([]);
        return;
      }
      setLoadingVariations(true);
      try {
        const list = await inventoryService.getVariationsWithStock(companyId, product.id, branchUuid);
        setBranchVariations(
          list.map((v) => ({
            id: v.id,
            sku: v.sku,
            attributes: v.attributes,
            stock: v.stock,
          })),
        );
        setSelectedVariationId(list.length === 1 ? list[0].id : null);
      } catch (e) {
        console.error('[StockAdjustmentDrawer] variations:', e);
        setBranchVariations([]);
      } finally {
        setLoadingVariations(false);
      }
    },
    [companyId, product?.id, hasVariations],
  );

  useEffect(() => {
    if (!open || !product || !companyId) return;

    setType('add');
    setQuantity(0);
    setReason('correction');
    setNotes('');
    setDate(new Date());
    setBranchStock(null);
    setBranchVariations([]);

    let cancelled = false;
    setLoadingBranches(true);
    void branchService
      .getBranchesCached(companyId)
      .then((list) => {
        if (cancelled) return;
        const activeList = list.filter((b) => b.is_active !== false);
        setBranches(activeList.length > 0 ? activeList : list);
        const initial = pickInitialStockAdjustBranchId(list, branchId, defaultBranchId);
        setAdjustBranchId(initial);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[StockAdjustmentDrawer] branches:', e);
        toast.error('Could not load branches');
        setBranches([]);
        setAdjustBranchId(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingBranches(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, product?.id, companyId, branchId, defaultBranchId]);

  useEffect(() => {
    if (!open || !product || !adjustBranchId) return;
    if (hasVariations) {
      void loadVariationsForBranch(adjustBranchId);
    } else {
      void loadBranchStock(adjustBranchId);
    }
  }, [open, product?.id, adjustBranchId, hasVariations, loadBranchStock, loadVariationsForBranch]);

  useEffect(() => {
    if (!open) return;
    setDrawerMode(initialMode);
    setQuantity(0);
    setToBranchId(null);
  }, [open, product?.id, initialMode]);

  useEffect(() => {
    if (!adjustBranchId || !destinationBranches.length) {
      setToBranchId(null);
      return;
    }
    if (toBranchId && destinationBranches.some((b) => b.id === toBranchId)) return;
    setToBranchId(destinationBranches[0]?.id ?? null);
  }, [adjustBranchId, destinationBranches, toBranchId]);

  useEffect(() => {
    if (!product?.hasVariations || !product.variations?.length || branchVariations.length > 0) return;
    if (product.variationId && product.variations.some((v) => v.id === product.variationId)) {
      setSelectedVariationId(product.variationId);
    } else {
      setSelectedVariationId(product.variations[0]?.id ?? null);
    }
  }, [product?.id, product?.variationId, product?.hasVariations, product?.variations, branchVariations.length]);

  if (!open || !product) return null;

  const calculatedNewStock = type === 'add'
    ? effectiveCurrentStock + quantity
    : effectiveCurrentStock - quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (!adjustBranchId) {
      toast.error(drawerMode === 'transfer' ? 'Select a source branch' : 'Select a branch for this adjustment');
      return;
    }

    if (hasVariations && !selectedVariationId) {
      toast.error(drawerMode === 'transfer' ? 'Please select a variation to transfer' : 'Please select a variation to adjust');
      return;
    }

    if (drawerMode === 'transfer') {
      if (!canTransfer || !onTransfer) {
        toast.error('Branch transfer requires at least two branches.');
        return;
      }
      if (!toBranchId) {
        toast.error('Select a destination branch');
        return;
      }
      if (quantity > effectiveCurrentStock) {
        toast.error(`Cannot transfer more than on-hand at source (${effectiveCurrentStock} ${product.unit})`);
        return;
      }
      onTransfer({
        productId: product.id,
        fromBranchId: adjustBranchId,
        toBranchId,
        quantity,
        notes,
        variationId: hasVariations ? selectedVariationId : undefined,
      });
      return;
    }

    if (type === 'subtract' && quantity > effectiveCurrentStock) {
      toast.error('Cannot subtract more than current stock');
      return;
    }

    onAdjust({
      productId: product.id,
      branchId: adjustBranchId,
      type,
      quantity,
      reason,
      notes,
      movementAt: toLocalISOString(date instanceof Date ? date : new Date()),
      newStock: calculatedNewStock,
      variationId: hasVariations ? selectedVariationId : undefined,
    });
  };

  const getReasonLabel = (r: AdjustmentReason) => {
    const labels = {
      damaged: 'Damaged/Defective',
      audit: 'Audit Adjustment',
      return: 'Customer Return',
      theft: 'Theft/Loss',
      correction: 'Stock Correction',
      other: 'Other'
    };
    return labels[r];
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[600px] bg-[#111827] border-l border-gray-800 z-50 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-[#111827] border-b border-gray-800 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {drawerMode === 'transfer' ? 'Stock Transfer' : 'Stock Adjustment'}
              </h2>
              <p className="text-sm text-gray-400">
                {drawerMode === 'transfer'
                  ? 'Move stock between branches'
                  : 'Correct inventory levels and log changes'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Product Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-4">
              {product.image && (
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover border border-gray-700"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-white">{product.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <code className="text-xs bg-gray-800 px-2 py-1 rounded text-blue-400">
                    {product.sku}
                  </code>
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                    Current: {effectiveCurrentStock} {product.unit}
                    {hasVariations && selectedVariation && ` (${selectedVariation.sku || selectedVariation.id})`}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {canTransfer && (
            <div className="flex rounded-lg bg-gray-900 border border-gray-800 p-1">
              <button
                type="button"
                onClick={() => setDrawerMode('adjust')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                  drawerMode === 'adjust' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Adjust
              </button>
              <button
                type="button"
                onClick={() => setDrawerMode('transfer')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition flex items-center justify-center gap-1.5 ${
                  drawerMode === 'transfer' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <ArrowRightLeft size={14} />
                Transfer
              </button>
            </div>
          )}

          {(showBranchSelect || loadingBranches || adjustBranchId) && (
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <MapPin size={14} />
                {drawerMode === 'transfer' ? 'From branch' : 'Branch / Location'}
              </Label>
              {loadingBranches ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                  <Loader2 size={16} className="animate-spin" />
                  Loading branches...
                </div>
              ) : showBranchSelect ? (
                <Select value={adjustBranchId ?? ''} onValueChange={(v) => setAdjustBranchId(v)}>
                  <SelectTrigger className="w-full bg-gray-900 border-gray-800 text-white">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                        {b.address || b.city ? ` — ${(b.address || b.city || '').slice(0, 48)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : adjustBranchId ? (
                <p className="text-sm text-gray-300 py-1">
                  {branches.find((b) => b.id === adjustBranchId)?.name ?? 'Branch'}
                </p>
              ) : null}
            </div>
          )}

          {drawerMode === 'transfer' && canTransfer && (
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <MapPin size={14} />
                To branch
              </Label>
              {loadingBranches ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                  <Loader2 size={16} className="animate-spin" />
                  Loading branches...
                </div>
              ) : destinationBranches.length === 0 ? (
                <p className="text-sm text-amber-400">Select a different source branch first.</p>
              ) : (
                <Select value={toBranchId ?? ''} onValueChange={(v) => setToBranchId(v)}>
                  <SelectTrigger className="w-full bg-gray-900 border-gray-800 text-white">
                    <SelectValue placeholder="Select destination branch" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    {destinationBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                        {b.address || b.city ? ` — ${(b.address || b.city || '').slice(0, 48)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Variation selector: required when product has variations */}
          {hasVariations && (
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <Layers size={14} />
                Variation to adjust
              </Label>
              {loadingVariations ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                  <Loader2 size={16} className="animate-spin" />
                  Loading variations...
                </div>
              ) : variations.length === 0 ? (
                <p className="text-sm text-amber-400">No variations found for this branch.</p>
              ) : (
              <Select value={selectedVariationId ?? ''} onValueChange={(v) => setSelectedVariationId(v || null)}>
                <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                  <SelectValue placeholder="Select variation" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {variations.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {(v.attributes && typeof v.attributes === 'object' && Object.keys(v.attributes).length > 0)
                        ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ')
                        : (v.sku || v.id)}
                      {' — '}
                      <span className="text-green-400 tabular-nums">{formatQty(v.stock)} {product.unit}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              )}
              <p className="text-xs text-gray-500">Adjustment will apply only to the selected variation.</p>
            </div>
          )}

          {drawerMode === 'adjust' && (
          <>
          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label className="text-gray-300">Adjustment Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('add')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  type === 'add'
                    ? 'bg-green-500/10 border-green-500 text-green-400'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <Plus size={24} className="mx-auto mb-2" />
                <div className="font-semibold">Add Stock</div>
                <div className="text-xs mt-1">Increase inventory</div>
              </button>
              <button
                type="button"
                onClick={() => setType('subtract')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  type === 'subtract'
                    ? 'bg-red-500/10 border-red-500 text-red-400'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <Minus size={24} className="mx-auto mb-2" />
                <div className="font-semibold">Subtract Stock</div>
                <div className="text-xs mt-1">Reduce inventory</div>
              </button>
            </div>
          </div>
          </>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-gray-300">
              {drawerMode === 'transfer' ? 'Transfer quantity' : 'Quantity'} ({product.unit})
            </Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="bg-gray-900 border-gray-800 text-white"
              placeholder="Enter quantity"
              required
            />
          </div>

          {drawerMode === 'adjust' && (
          <>
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-gray-300">
              Reason for Adjustment
            </Label>
            <Select value={reason} onValueChange={(v: AdjustmentReason) => setReason(v)}>
              <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                <SelectItem value="correction">{getReasonLabel('correction')}</SelectItem>
                <SelectItem value="damaged">{getReasonLabel('damaged')}</SelectItem>
                <SelectItem value="audit">{getReasonLabel('audit')}</SelectItem>
                <SelectItem value="return">{getReasonLabel('return')}</SelectItem>
                <SelectItem value="theft">{getReasonLabel('theft')}</SelectItem>
                <SelectItem value="other">{getReasonLabel('other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <DateTimePicker
              label="Adjustment Date"
              value={dateToDateTimePickerValue(date)}
              onChange={(v) => setDate(dateTimePickerValueToDate(v) || new Date())}
              required
            />
          </div>
          </>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-gray-300 flex items-center gap-2">
              <FileText size={14} />
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-gray-900 border-gray-800 text-white resize-none"
              placeholder="Add any additional notes about this adjustment..."
              rows={3}
            />
          </div>

          {/* Preview */}
          {quantity > 0 && drawerMode === 'adjust' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-400 mb-2">Adjustment Preview</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-gray-300">
                      <span>Current Stock:</span>
                      <span className="font-semibold">{effectiveCurrentStock} {product.unit}</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>Adjustment:</span>
                      <span className={`font-semibold ${type === 'add' ? 'text-green-400' : 'text-red-400'}`}>
                        {type === 'add' ? '+' : '-'}{quantity} {product.unit}
                      </span>
                    </div>
                    <div className="border-t border-blue-500/20 pt-2 mt-2 flex justify-between">
                      <span className="font-semibold text-white">New Stock:</span>
                      <span className="font-bold text-white text-lg">
                        {calculatedNewStock} {product.unit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {quantity > 0 && drawerMode === 'transfer' && toBranchId && (
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ArrowRightLeft size={20} className="text-violet-400 mt-0.5" />
                <div className="flex-1 text-sm space-y-1">
                  <p className="font-semibold text-violet-400">Transfer preview</p>
                  <p className="text-gray-300">
                    {quantity} {product.unit} from{' '}
                    <span className="text-white">{branches.find((b) => b.id === adjustBranchId)?.name}</span>
                    {' → '}
                    <span className="text-white">{branches.find((b) => b.id === toBranchId)?.name}</span>
                  </p>
                  <p className="text-gray-400">Source after: {Math.max(0, effectiveCurrentStock - quantity)} {product.unit}</p>
                </div>
              </div>
            </div>
          )}

          {/* Warning for subtract / over-transfer */}
          {drawerMode === 'adjust' && type === 'subtract' && quantity > effectiveCurrentStock && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-400">Invalid Quantity</h4>
                  <p className="text-sm text-gray-300 mt-1">
                    Cannot subtract more than current stock ({effectiveCurrentStock} {product.unit})
                  </p>
                </div>
              </div>
            </div>
          )}

          {drawerMode === 'transfer' && quantity > effectiveCurrentStock && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-400">Invalid Quantity</h4>
                  <p className="text-sm text-gray-300 mt-1">
                    Cannot transfer more than source stock ({effectiveCurrentStock} {product.unit})
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={`flex-1 text-white ${drawerMode === 'transfer' ? 'bg-violet-600 hover:bg-violet-500' : 'bg-blue-600 hover:bg-blue-500'}`}
              disabled={
                quantity <= 0 ||
                !adjustBranchId ||
                loadingBranches ||
                loadingBranchStock ||
                loadingVariations ||
                (drawerMode === 'adjust' && type === 'subtract' && quantity > effectiveCurrentStock) ||
                (drawerMode === 'transfer' && (!toBranchId || quantity > effectiveCurrentStock))
              }
            >
              <Save size={16} className="mr-2" />
              {drawerMode === 'transfer' ? 'Transfer Stock' : 'Save Adjustment'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};
