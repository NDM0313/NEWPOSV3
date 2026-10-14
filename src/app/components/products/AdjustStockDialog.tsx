import React, { useState, useEffect, useCallback } from 'react';
import { X, Box, Plus, Minus, AlertCircle, TrendingUp, TrendingDown, Layers, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { productService } from '@/app/services/productService';
import { inventoryService } from '@/app/services/inventoryService';
import { branchService, type Branch } from '@/app/services/branchService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { pickInitialStockAdjustBranchId } from '@/app/utils/branchScope';

interface Product {
  id: number;
  uuid: string;
  sku: string;
  name: string;
  stock: number;
  type?: 'simple' | 'variable' | 'combo';
}

interface AdjustStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: () => void;
}

type AdjustmentType = 'increase' | 'decrease' | 'set';

interface VariationWithStock {
  id: string;
  sku: string;
  name?: string;
  attributes: Record<string, unknown>;
  stock: number;
}

export const AdjustStockDialog: React.FC<AdjustStockDialogProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const { companyId, branchId, defaultBranchId, user } = useSupabase();
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('increase');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [adjustBranchId, setAdjustBranchId] = useState<string | null>(null);
  const [branchStock, setBranchStock] = useState<number | null>(null);
  const [loadingBranchStock, setLoadingBranchStock] = useState(false);
  const [variations, setVariations] = useState<VariationWithStock[]>([]);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [loadingVariations, setLoadingVariations] = useState(false);

  const isVariable = product?.type === 'variable';
  const isCombo = product?.type === 'combo';
  const selectedVariation = selectedVariationId ? variations.find((v) => v.id === selectedVariationId) : null;
  const showBranchSelect = branches.length > 1;

  const effectiveStock =
    isVariable && selectedVariation
      ? selectedVariation.stock
      : branchStock ?? (loadingBranchStock ? null : product?.stock ?? 0);

  const loadBranchStock = useCallback(
    async (branchUuid: string | null) => {
      if (!companyId || !product?.uuid || !branchUuid) {
        setBranchStock(null);
        return;
      }
      if (isVariable) return;
      setLoadingBranchStock(true);
      try {
        const rows = await inventoryService.getInventoryOverview(companyId, branchUuid);
        const row = rows.find((r) => r.productId === product.uuid);
        setBranchStock(row?.stock ?? 0);
      } catch (e) {
        console.error('[AdjustStock] Failed to load branch stock:', e);
        setBranchStock(0);
      } finally {
        setLoadingBranchStock(false);
      }
    },
    [companyId, product?.uuid, isVariable],
  );

  const loadVariationsForBranch = useCallback(
    async (branchUuid: string | null) => {
      if (!companyId || !product?.uuid || !isVariable) return;
      setLoadingVariations(true);
      try {
        const list = await inventoryService.getVariationsWithStock(companyId, product.uuid, branchUuid);
        setVariations(list);
        setSelectedVariationId(list.length === 1 ? list[0].id : null);
      } catch (e) {
        console.error('[AdjustStock] Failed to load variations:', e);
        toast.error('Could not load variations');
        setVariations([]);
        setSelectedVariationId(null);
      } finally {
        setLoadingVariations(false);
      }
    },
    [companyId, product?.uuid, isVariable],
  );

  useEffect(() => {
    if (!isOpen || !product || !companyId) return;

    setQuantity('');
    setReason('');
    setAdjustmentType('increase');
    setSelectedVariationId(null);
    setVariations([]);
    setBranchStock(null);

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
        if (!initial && list.length === 0) {
          toast.error('No branches found. Add a branch in Settings first.');
        }
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[AdjustStock] Failed to load branches:', e);
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
  }, [isOpen, product?.uuid, companyId, branchId, defaultBranchId]);

  useEffect(() => {
    if (!isOpen || !product || !adjustBranchId) return;
    void loadBranchStock(adjustBranchId);
    if (isVariable) void loadVariationsForBranch(adjustBranchId);
  }, [isOpen, product?.uuid, adjustBranchId, isVariable, loadBranchStock, loadVariationsForBranch]);

  const calculateNewStock = () => {
    const base = effectiveStock ?? 0;
    if (!quantity) return base;
    const qty = parseFloat(quantity) || 0;
    switch (adjustmentType) {
      case 'increase':
        return base + qty;
      case 'decrease':
        return Math.max(0, base - qty);
      case 'set':
        return qty;
      default:
        return base;
    }
  };

  const handleSave = async () => {
    if (!product?.uuid) {
      toast.error('Product not found');
      return;
    }
    if (isCombo) {
      toast.error('Stock for bundle products is managed via components.');
      return;
    }
    if (isVariable && !selectedVariationId) {
      toast.error('Please select a variation to adjust.');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const stockNow = effectiveStock ?? 0;
    if (adjustmentType === 'decrease' && qty > stockNow) {
      toast.error('Cannot decrease stock by more than current stock');
      return;
    }

    if (!companyId) {
      toast.error('Company ID not found');
      return;
    }

    if (!adjustBranchId || !isRealBranchUuid(adjustBranchId)) {
      toast.error('Select a branch / location to adjust stock.');
      return;
    }

    try {
      setSaving(true);
      const newStock = calculateNewStock();
      let adjustmentQuantity = 0;
      if (adjustmentType === 'increase') {
        adjustmentQuantity = qty;
      } else if (adjustmentType === 'decrease') {
        adjustmentQuantity = -qty;
      } else if (adjustmentType === 'set') {
        adjustmentQuantity = newStock - stockNow;
      }

      if (isVariable && selectedVariationId) {
        await productService.createStockMovement({
          company_id: companyId,
          branch_id: adjustBranchId,
          product_id: product.uuid,
          variation_id: selectedVariationId,
          movement_type: 'adjustment',
          quantity: adjustmentQuantity,
          unit_cost: 0,
          total_cost: 0,
          reference_type: 'adjustment',
          notes:
            reason ||
            `Stock ${adjustmentType} - ${selectedVariation?.sku || selectedVariationId} - ${adjustmentType === 'set' ? `Set to ${newStock}` : `${adjustmentQuantity >= 0 ? '+' : ''}${adjustmentQuantity}`}`,
          created_by: user?.id || undefined,
        });
      } else {
        await productService.createStockMovement({
          company_id: companyId,
          branch_id: adjustBranchId,
          product_id: product.uuid,
          movement_type: 'adjustment',
          quantity: adjustmentQuantity,
          unit_cost: 0,
          total_cost: 0,
          reference_type: 'adjustment',
          notes:
            reason ||
            `Stock ${adjustmentType === 'increase' ? 'increase' : adjustmentType === 'decrease' ? 'decrease' : 'set'} - ${adjustmentType === 'set' ? `Set to ${newStock}` : `${adjustmentType === 'increase' ? '+' : '-'}${qty}`}`,
          created_by: user?.id || undefined,
        });
      }

      toast.success(
        `Stock ${adjustmentType === 'increase' ? 'increased' : adjustmentType === 'decrease' ? 'decreased' : 'set'} successfully`,
      );
      window.dispatchEvent(new CustomEvent('products-updated'));
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error('[ADJUST STOCK] Error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to update stock: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !product) return null;

  const newStock = calculateNewStock();
  const stockChange =
    adjustmentType === 'increase'
      ? `+${quantity || '0'}`
      : adjustmentType === 'decrease'
        ? `-${quantity || '0'}`
        : `→ ${quantity || '0'}`;

  const stockDisplay =
    loadingBranchStock || (isVariable && loadingVariations)
      ? null
      : effectiveStock ?? 0;

  if (isCombo) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--erp-overlay)] backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-background border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="px-6 py-5 border-b border-border bg-background flex items-center justify-between rounded-t-xl">
            <div className="flex items-center gap-3">
              <Box size={20} className="text-orange-500" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Adjust Stock</h2>
                <p className="text-xs text-muted-foreground">{product.name}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground hover:bg-muted">
              <X size={20} />
            </Button>
          </div>
          <div className="p-6">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">
                Stock for bundle (combo) products is managed via their components. Adjust stock of individual items instead.
              </p>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-end">
            <Button variant="outline" onClick={onClose} className="bg-muted border-border text-foreground">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--erp-overlay)] backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-background border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="px-6 py-5 border-b border-border bg-background flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Box size={20} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Adjust Stock</h2>
              <p className="text-xs text-muted-foreground">
                {product.name}
                {isVariable ? ' (with variations)' : ''}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground hover:bg-muted">
            <X size={20} />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {(showBranchSelect || loadingBranches) && (
            <div>
              <Label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <MapPin size={14} />
                Branch / Location
              </Label>
              {loadingBranches ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <Loader2 size={16} className="animate-spin" />
                  Loading branches...
                </div>
              ) : showBranchSelect ? (
                <Select value={adjustBranchId ?? ''} onValueChange={(v) => setAdjustBranchId(v)}>
                  <SelectTrigger className="w-full bg-muted border-border text-foreground">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                        {b.address || b.city ? ` — ${(b.address || b.city || '').slice(0, 48)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : adjustBranchId ? (
                <p className="text-sm text-muted-foreground py-1">
                  {branches.find((b) => b.id === adjustBranchId)?.name ?? 'Branch'}
                </p>
              ) : null}
            </div>
          )}

          {isVariable && (
            <div>
              <Label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <Layers size={14} />
                Select variation
              </Label>
              {loadingVariations ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <Loader2 size={16} className="animate-spin" />
                  Loading variations...
                </div>
              ) : variations.length === 0 ? (
                <p className="text-sm text-amber-400">No variations found for this product.</p>
              ) : (
                <select
                  value={selectedVariationId ?? ''}
                  onChange={(e) => setSelectedVariationId(e.target.value || null)}
                  className="w-full rounded-lg bg-muted border border-border text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose variation...</option>
                  {variations.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name ||
                        v.sku ||
                        (typeof v.attributes === 'object' && v.attributes && Object.values(v.attributes).length
                          ? Object.values(v.attributes).join(' / ')
                          : v.id)}{' '}
                      — Stock: {v.stock}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">
              Current Stock
              {isVariable && selectedVariation ? ` (${selectedVariation.sku || selectedVariation.name || 'selected'})` : ''}
              {adjustBranchId && showBranchSelect
                ? ` · ${branches.find((b) => b.id === adjustBranchId)?.name ?? ''}`
                : ''}
            </p>
            {isVariable && !selectedVariationId && variations.length > 0 ? (
              <p className="text-sm text-muted-foreground">Select a variation above</p>
            ) : stockDisplay === null ? (
              <Loader2 size={24} className="text-muted-foreground animate-spin" />
            ) : (
              <p className={`text-3xl font-bold ${stockDisplay === 0 ? 'text-red-400' : 'text-[var(--erp-money-positive)]'}`}>
                {stockDisplay}
              </p>
            )}
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-3 block">Adjustment Type</Label>
            <div className="flex gap-2">
              <Button
                variant={adjustmentType === 'increase' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustmentType('increase')}
                className={adjustmentType === 'increase' ? 'bg-green-600 hover:bg-green-700' : 'bg-muted border-border'}
              >
                <Plus size={16} className="mr-1" />
                Increase
              </Button>
              <Button
                variant={adjustmentType === 'decrease' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustmentType('decrease')}
                className={adjustmentType === 'decrease' ? 'bg-red-600 hover:bg-red-700' : 'bg-muted border-border'}
              >
                <Minus size={16} className="mr-1" />
                Decrease
              </Button>
              <Button
                variant={adjustmentType === 'set' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustmentType('set')}
                className={adjustmentType === 'set' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-muted border-border'}
              >
                Set To
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="quantity" className="text-sm text-muted-foreground mb-2 block">
              {adjustmentType === 'increase'
                ? 'Quantity to Add'
                : adjustmentType === 'decrease'
                  ? 'Quantity to Remove'
                  : 'New Stock Quantity'}
            </Label>
            <div className="relative">
              <Box className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="pl-10 bg-muted border-border text-foreground"
                placeholder="0"
                step="1"
                min="0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reason" className="text-sm text-muted-foreground mb-2 block">
              Reason (Optional)
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-muted border-border text-foreground"
              placeholder="e.g., Stock received, Damaged items, Stock audit..."
              rows={3}
            />
          </div>

          {quantity && stockDisplay !== null && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-2">Stock Change Preview</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Current:</span>
                  <span className="text-sm font-semibold text-foreground">{stockDisplay}</span>
                </div>
                <div className="flex items-center gap-2">
                  {adjustmentType === 'increase' && <TrendingUp size={16} className="text-[var(--erp-money-positive)]" />}
                  {adjustmentType === 'decrease' && <TrendingDown size={16} className="text-red-400" />}
                  <span className="text-sm text-muted-foreground">{stockChange}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">New:</span>
                  <span
                    className={`text-lg font-bold ${newStock === 0 ? 'text-red-400' : newStock < stockDisplay ? 'text-yellow-400' : 'text-[var(--erp-money-positive)]'}`}
                  >
                    {newStock}
                  </span>
                </div>
              </div>
            </div>
          )}

          {adjustmentType === 'decrease' && quantity && stockDisplay !== null && parseFloat(quantity) > stockDisplay && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">
                Cannot decrease stock by more than current stock ({stockDisplay}).
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border bg-background rounded-b-xl flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="bg-muted border-border text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              loadingBranches ||
              !adjustBranchId ||
              !quantity ||
              parseFloat(quantity) <= 0 ||
              (stockDisplay !== null && adjustmentType === 'decrease' && parseFloat(quantity) > stockDisplay) ||
              (isVariable && !selectedVariationId) ||
              (isVariable && variations.length === 0)
            }
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
