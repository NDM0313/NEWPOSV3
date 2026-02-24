import React, { useState, useEffect } from 'react';
import { X, Box, Plus, Minus, AlertCircle, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { productService } from '@/app/services/productService';
import { inventoryService } from '@/app/services/inventoryService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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
  const { companyId, branchId, user } = useSupabase();
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('increase');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [variations, setVariations] = useState<VariationWithStock[]>([]);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [loadingVariations, setLoadingVariations] = useState(false);

  const isVariable = product?.type === 'variable';
  const isCombo = product?.type === 'combo';
  const selectedVariation = selectedVariationId ? variations.find((v) => v.id === selectedVariationId) : null;
  const effectiveStock = isVariable && selectedVariation ? selectedVariation.stock : (product?.stock ?? 0);

  useEffect(() => {
    if (isOpen && product) {
      setQuantity('');
      setReason('');
      setAdjustmentType('increase');
      setSelectedVariationId(null);
      setVariations([]);
      if (isVariable && product.uuid && companyId) {
        setLoadingVariations(true);
        inventoryService
          .getVariationsWithStock(companyId, product.uuid, branchId)
          .then((list) => {
            setVariations(list);
            if (list.length === 1) setSelectedVariationId(list[0].id);
          })
          .catch((e) => {
            console.error('[AdjustStock] Failed to load variations:', e);
            toast.error('Could not load variations');
          })
          .finally(() => setLoadingVariations(false));
      }
    }
  }, [isOpen, product?.uuid, isVariable, companyId, branchId]);

  const calculateNewStock = () => {
    if (!quantity) return effectiveStock;
    const qty = parseFloat(quantity) || 0;
    switch (adjustmentType) {
      case 'increase':
        return effectiveStock + qty;
      case 'decrease':
        return Math.max(0, effectiveStock - qty);
      case 'set':
        return qty;
      default:
        return effectiveStock;
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

    if (adjustmentType === 'decrease' && qty > effectiveStock) {
      toast.error('Cannot decrease stock by more than current stock');
      return;
    }

    if (!companyId) {
      toast.error('Company ID not found');
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
        adjustmentQuantity = newStock - effectiveStock;
      }

      if (isVariable && selectedVariationId) {
        // Variation: only create stock movement (stock is movement-based)
        await productService.createStockMovement({
          company_id: companyId,
          branch_id: branchId || undefined,
          product_id: product.uuid,
          variation_id: selectedVariationId,
          movement_type: 'adjustment',
          quantity: adjustmentQuantity,
          unit_cost: 0,
          total_cost: 0,
          reference_type: 'adjustment',
          notes: reason || `Stock ${adjustmentType} - ${selectedVariation?.sku || selectedVariationId} - ${adjustmentType === 'set' ? `Set to ${newStock}` : `${adjustmentQuantity >= 0 ? '+' : ''}${adjustmentQuantity}`}`,
          created_by: user?.id || undefined,
        });
      } else {
        // Simple product: update product row + create movement (existing behavior)
        await productService.updateProduct(product.uuid, {
          current_stock: newStock,
        });
        try {
          await productService.createStockMovement({
            company_id: companyId,
            branch_id: branchId || undefined,
            product_id: product.uuid,
            movement_type: 'adjustment',
            quantity: adjustmentQuantity,
            unit_cost: 0,
            total_cost: 0,
            reference_type: 'adjustment',
            notes: reason || `Stock ${adjustmentType === 'increase' ? 'increase' : adjustmentType === 'decrease' ? 'decrease' : 'set'} - ${adjustmentType === 'set' ? `Set to ${newStock}` : `${adjustmentType === 'increase' ? '+' : '-'}${qty}`}`,
            created_by: user?.id || undefined,
          });
        } catch (movementError: any) {
          console.error('[ADJUST STOCK] Movement record failed:', movementError);
          toast.error('Stock updated but movement record failed.');
        }
      }

      toast.success(`Stock ${adjustmentType === 'increase' ? 'increased' : adjustmentType === 'decrease' ? 'decreased' : 'set'} successfully`);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[ADJUST STOCK] Error:', error);
      toast.error('Failed to update stock: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !product) return null;

  const newStock = calculateNewStock();
  const stockChange = adjustmentType === 'increase'
    ? `+${quantity || '0'}`
    : adjustmentType === 'decrease'
    ? `-${quantity || '0'}`
    : `→ ${quantity || '0'}`;

  if (isCombo) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-[#0B0F17] border border-gray-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between rounded-t-xl">
            <div className="flex items-center gap-3">
              <Box size={20} className="text-orange-500" />
              <div>
                <h2 className="text-lg font-semibold text-white">Adjust Stock</h2>
                <p className="text-xs text-gray-400">{product.name}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-800">
              <X size={20} />
            </Button>
          </div>
          <div className="p-6">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">Stock for bundle (combo) products is managed via their components. Adjust stock of individual items instead.</p>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
            <Button variant="outline" onClick={onClose} className="bg-gray-800 border-gray-700 text-white">Close</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0B0F17] border border-gray-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Box size={20} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Adjust Stock</h2>
              <p className="text-xs text-gray-400">{product.name}{isVariable ? ' (with variations)' : ''}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Variation selector (variable products only) */}
          {isVariable && (
            <div>
              <Label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                <Layers size={14} />
                Select variation
              </Label>
              {loadingVariations ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                  <Loader2 size={16} className="animate-spin" />
                  Loading variations...
                </div>
              ) : variations.length === 0 ? (
                <p className="text-sm text-amber-400">No variations found for this product.</p>
              ) : (
                <select
                  value={selectedVariationId ?? ''}
                  onChange={(e) => setSelectedVariationId(e.target.value || null)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose variation...</option>
                  {variations.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name || v.sku || (typeof v.attributes === 'object' && v.attributes && Object.values(v.attributes).length ? Object.values(v.attributes).join(' / ') : v.id)} — Stock: {v.stock}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Current Stock */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Current Stock{isVariable && selectedVariation ? ` (${selectedVariation.sku || selectedVariation.name || 'selected'})` : ''}</p>
            {isVariable && !selectedVariationId && variations.length > 0 ? (
              <p className="text-sm text-gray-500">Select a variation above</p>
            ) : (
              <p className={`text-3xl font-bold ${effectiveStock === 0 ? 'text-red-400' : 'text-green-400'}`}>
                {effectiveStock}
              </p>
            )}
          </div>

          {/* Adjustment Type */}
          <div>
            <Label className="text-sm text-gray-400 mb-3 block">Adjustment Type</Label>
            <div className="flex gap-2">
              <Button
                variant={adjustmentType === 'increase' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustmentType('increase')}
                className={adjustmentType === 'increase' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-800 border-gray-700'}
              >
                <Plus size={16} className="mr-1" />
                Increase
              </Button>
              <Button
                variant={adjustmentType === 'decrease' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustmentType('decrease')}
                className={adjustmentType === 'decrease' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 border-gray-700'}
              >
                <Minus size={16} className="mr-1" />
                Decrease
              </Button>
              <Button
                variant={adjustmentType === 'set' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustmentType('set')}
                className={adjustmentType === 'set' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 border-gray-700'}
              >
                Set To
              </Button>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <Label htmlFor="quantity" className="text-sm text-gray-400 mb-2 block">
              {adjustmentType === 'increase' ? 'Quantity to Add' : adjustmentType === 'decrease' ? 'Quantity to Remove' : 'New Stock Quantity'}
            </Label>
            <div className="relative">
              <Box className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
                placeholder="0"
                step="1"
                min="0"
              />
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <Label htmlFor="reason" className="text-sm text-gray-400 mb-2 block">
              Reason (Optional)
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
              placeholder="e.g., Stock received, Damaged items, Stock audit..."
              rows={3}
            />
          </div>

          {/* Preview */}
          {quantity && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-2">Stock Change Preview</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">Current:</span>
                  <span className="text-sm font-semibold text-white">{effectiveStock}</span>
                </div>
                <div className="flex items-center gap-2">
                  {adjustmentType === 'increase' && <TrendingUp size={16} className="text-green-400" />}
                  {adjustmentType === 'decrease' && <TrendingDown size={16} className="text-red-400" />}
                  <span className="text-sm text-gray-400">{stockChange}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">New:</span>
                  <span className={`text-lg font-bold ${newStock === 0 ? 'text-red-400' : newStock < effectiveStock ? 'text-yellow-400' : 'text-green-400'}`}>
                    {newStock}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {adjustmentType === 'decrease' && quantity && parseFloat(quantity) > effectiveStock && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">
                Cannot decrease stock by more than current stock ({effectiveStock}).
              </p>
            </div>
          )}
          {newStock < 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">
                Stock cannot be negative.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-[#111827] rounded-b-xl flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !quantity || parseFloat(quantity) <= 0 || (adjustmentType === 'decrease' && parseFloat(quantity) > effectiveStock) || (isVariable && !selectedVariationId) || (isVariable && variations.length === 0)}
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
