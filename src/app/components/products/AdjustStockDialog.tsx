import React, { useState } from 'react';
import { X, Box, Plus, Minus, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { productService } from '@/app/services/productService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Product {
  id: number;
  uuid: string;
  sku: string;
  name: string;
  stock: number;
}

interface AdjustStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: () => void;
}

type AdjustmentType = 'increase' | 'decrease' | 'set';

export const AdjustStockDialog: React.FC<AdjustStockDialogProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('increase');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen && product) {
      setQuantity('');
      setReason('');
      setAdjustmentType('increase');
    }
  }, [isOpen, product]);

  const calculateNewStock = () => {
    if (!product || !quantity) return product?.stock || 0;
    
    const qty = parseFloat(quantity) || 0;
    switch (adjustmentType) {
      case 'increase':
        return product.stock + qty;
      case 'decrease':
        return Math.max(0, product.stock - qty);
      case 'set':
        return qty;
      default:
        return product.stock;
    }
  };

  const handleSave = async () => {
    if (!product?.uuid) {
      toast.error('Product not found');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (adjustmentType === 'decrease' && qty > product.stock) {
      toast.error('Cannot decrease stock by more than current stock');
      return;
    }

    try {
      setSaving(true);
      const newStock = calculateNewStock();
      
      await productService.updateProduct(product.uuid, {
        current_stock: newStock,
      });

      toast.success(`Stock ${adjustmentType === 'increase' ? 'increased' : adjustmentType === 'decrease' ? 'decreased' : 'set'} successfully`);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[ADJUST STOCK] Error updating stock:', error);
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
              <p className="text-xs text-gray-400">{product.name}</p>
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
          {/* Current Stock */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Current Stock</p>
            <p className={`text-3xl font-bold ${product.stock === 0 ? 'text-red-400' : 'text-green-400'}`}>
              {product.stock}
            </p>
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
                  <span className="text-sm font-semibold text-white">{product.stock}</span>
                </div>
                <div className="flex items-center gap-2">
                  {adjustmentType === 'increase' && <TrendingUp size={16} className="text-green-400" />}
                  {adjustmentType === 'decrease' && <TrendingDown size={16} className="text-red-400" />}
                  <span className="text-sm text-gray-400">{stockChange}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">New:</span>
                  <span className={`text-lg font-bold ${newStock === 0 ? 'text-red-400' : newStock < product.stock ? 'text-yellow-400' : 'text-green-400'}`}>
                    {newStock}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {adjustmentType === 'decrease' && quantity && parseFloat(quantity) > product.stock && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">
                Cannot decrease stock by more than current stock ({product.stock}).
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
            disabled={saving || !quantity || parseFloat(quantity) <= 0 || (adjustmentType === 'decrease' && parseFloat(quantity) > product.stock)}
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
