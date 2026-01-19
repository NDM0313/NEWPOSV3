import React, { useState } from 'react';
import { X, Tag, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { productService } from '@/app/services/productService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Product {
  id: number;
  uuid: string;
  sku: string;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
}

interface AdjustPriceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: () => void;
}

export const AdjustPriceDialog: React.FC<AdjustPriceDialogProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [margin, setMargin] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'purchase' | 'selling' | 'margin'>('selling');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen && product) {
      setPurchasePrice(product.purchasePrice.toString());
      setSellingPrice(product.sellingPrice.toString());
      const calculatedMargin = product.purchasePrice > 0
        ? (((product.sellingPrice - product.purchasePrice) / product.purchasePrice) * 100).toFixed(2)
        : '0';
      setMargin(calculatedMargin);
    }
  }, [isOpen, product]);

  const calculateSellingPrice = (purchase: number, marginPercent: number) => {
    return purchase * (1 + marginPercent / 100);
  };

  const calculateMargin = (purchase: number, selling: number) => {
    return purchase > 0 ? ((selling - purchase) / purchase) * 100 : 0;
  };

  const handlePurchasePriceChange = (value: string) => {
    setPurchasePrice(value);
    const purchase = parseFloat(value) || 0;
    if (adjustmentType === 'margin') {
      const marginPercent = parseFloat(margin) || 0;
      const selling = calculateSellingPrice(purchase, marginPercent);
      setSellingPrice(selling.toFixed(2));
    } else if (adjustmentType === 'selling') {
      const selling = parseFloat(sellingPrice) || 0;
      const marginPercent = calculateMargin(purchase, selling);
      setMargin(marginPercent.toFixed(2));
    }
  };

  const handleSellingPriceChange = (value: string) => {
    setSellingPrice(value);
    const selling = parseFloat(value) || 0;
    const purchase = parseFloat(purchasePrice) || 0;
    const marginPercent = calculateMargin(purchase, selling);
    setMargin(marginPercent.toFixed(2));
  };

  const handleMarginChange = (value: string) => {
    setMargin(value);
    const marginPercent = parseFloat(value) || 0;
    const purchase = parseFloat(purchasePrice) || 0;
    const selling = calculateSellingPrice(purchase, marginPercent);
    setSellingPrice(selling.toFixed(2));
  };

  const handleSave = async () => {
    if (!product?.uuid) {
      toast.error('Product not found');
      return;
    }

    const purchase = parseFloat(purchasePrice);
    const selling = parseFloat(sellingPrice);

    if (isNaN(purchase) || purchase < 0) {
      toast.error('Invalid purchase price');
      return;
    }

    if (isNaN(selling) || selling < 0) {
      toast.error('Invalid selling price');
      return;
    }

    if (selling < purchase) {
      toast.error('Selling price cannot be less than purchase price');
      return;
    }

    try {
      setSaving(true);
      await productService.updateProduct(product.uuid, {
        cost_price: purchase,
        retail_price: selling,
      });
      toast.success('Price updated successfully');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[ADJUST PRICE] Error updating price:', error);
      toast.error('Failed to update price: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !product) return null;

  const currentMargin = product.purchasePrice > 0
    ? (((product.sellingPrice - product.purchasePrice) / product.purchasePrice) * 100).toFixed(2)
    : '0';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0B0F17] border border-gray-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Tag size={20} className="text-yellow-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Adjust Price</h2>
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
          {/* Current Prices */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Current Prices</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400">Purchase</p>
                <p className="text-sm text-white font-semibold">${product.purchasePrice.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Selling</p>
                <p className="text-sm text-green-400 font-semibold">${product.sellingPrice.toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Current Margin</p>
                <p className="text-sm text-blue-400 font-semibold">+{currentMargin}%</p>
              </div>
            </div>
          </div>

          {/* Adjustment Type */}
          <div>
            <Label className="text-sm text-gray-400 mb-3 block">Adjustment Type</Label>
            <div className="flex gap-2">
              <Button
                variant={adjustmentType === 'purchase' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustmentType('purchase')}
                className={adjustmentType === 'purchase' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 border-gray-700'}
              >
                Purchase
              </Button>
              <Button
                variant={adjustmentType === 'selling' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustmentType('selling')}
                className={adjustmentType === 'selling' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 border-gray-700'}
              >
                Selling
              </Button>
              <Button
                variant={adjustmentType === 'margin' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustmentType('margin')}
                className={adjustmentType === 'margin' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 border-gray-700'}
              >
                Margin %
              </Button>
            </div>
          </div>

          {/* Price Inputs */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="purchasePrice" className="text-sm text-gray-400 mb-2 block">
                Purchase Price
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  id="purchasePrice"
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => handlePurchasePriceChange(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sellingPrice" className="text-sm text-gray-400 mb-2 block">
                Selling Price
              </Label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  id="sellingPrice"
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => handleSellingPriceChange(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="margin" className="text-sm text-gray-400 mb-2 block">
                Margin Percentage
              </Label>
              <div className="relative">
                <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  id="margin"
                  type="number"
                  value={margin}
                  onChange={(e) => handleMarginChange(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  placeholder="0.00"
                  step="0.01"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
              </div>
            </div>
          </div>

          {/* Warning */}
          {parseFloat(sellingPrice) < parseFloat(purchasePrice) && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">
                Selling price cannot be less than purchase price. Please adjust your values.
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
            disabled={saving || parseFloat(sellingPrice) < parseFloat(purchasePrice)}
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
