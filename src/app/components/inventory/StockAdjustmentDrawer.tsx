import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, AlertCircle, Calendar, FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { CalendarDatePicker } from "../ui/CalendarDatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";

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
    type: AdjustmentType;
    quantity: number;
    reason: AdjustmentReason;
    notes: string;
    date: string;
    newStock: number;
    /** Required when product has variations – adjustment applies only to this variation */
    variationId?: string | null;
  }) => void;
}

export const StockAdjustmentDrawer: React.FC<StockAdjustmentDrawerProps> = ({
  open,
  onClose,
  product,
  onAdjust
}) => {
  const [type, setType] = useState<AdjustmentType>('add');
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState<AdjustmentReason>('correction');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  /** When product has variations, which variation is selected for adjustment */
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);

  const hasVariations = Boolean(product?.hasVariations && product?.variations?.length);
  const variations = product?.variations ?? [];
  const selectedVariation = hasVariations && selectedVariationId
    ? variations.find((v) => v.id === selectedVariationId)
    : null;
  /** Effective current stock: selected variation's stock when product has variations, else product total */
  const effectiveCurrentStock = hasVariations && selectedVariation
    ? selectedVariation.stock
    : (product?.currentStock ?? 0);

  // Reset form when product changes; set initial variation selection
  useEffect(() => {
    if (product) {
      setType('add');
      setQuantity(0);
      setReason('correction');
      setNotes('');
      setDate(new Date());
      if (product.hasVariations && product.variations?.length) {
        const initial = product.variationId && product.variations.some((v) => v.id === product.variationId)
          ? product.variationId
          : product.variations[0]?.id ?? null;
        setSelectedVariationId(initial);
      } else {
        setSelectedVariationId(null);
      }
    }
  }, [product?.id, product?.variationId, product?.hasVariations, product?.variations]);

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

    if (hasVariations && !selectedVariationId) {
      toast.error('Please select a variation to adjust');
      return;
    }

    if (type === 'subtract' && quantity > effectiveCurrentStock) {
      toast.error('Cannot subtract more than current stock');
      return;
    }

    onAdjust({
      productId: product.id,
      type,
      quantity,
      reason,
      notes,
      date: date instanceof Date ? date.toISOString().split('T')[0] : date,
      newStock: calculatedNewStock,
      variationId: hasVariations ? selectedVariationId : undefined,
    });

    // Log for audit trail
    console.log('Stock Adjustment Log:', {
      timestamp: new Date().toISOString(),
      product: product.name,
      sku: product.sku,
      variationId: hasVariations ? selectedVariationId : undefined,
      type,
      quantity,
      reason,
      previousStock: effectiveCurrentStock,
      newStock: calculatedNewStock,
      notes
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
              <h2 className="text-xl font-bold text-white">Stock Adjustment</h2>
              <p className="text-sm text-gray-400">Correct inventory levels and log changes</p>
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

          {/* Variation selector: required when product has variations */}
          {hasVariations && (
            <div className="space-y-2">
              <Label className="text-gray-300">Variation to adjust</Label>
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
                      <span className="text-green-400">{v.stock} {product.unit}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Adjustment will apply only to the selected variation.</p>
            </div>
          )}

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

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-gray-300">
              Quantity ({product.unit})
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
            <CalendarDatePicker
              label="Adjustment Date"
              value={date}
              onChange={(d) => setDate(d || new Date())}
              showTime={true}
              required
            />
          </div>

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
          {quantity > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-400 mb-2">Adjustment Preview</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-gray-300">
                      <span>Current Stock:</span>
                      <span className="font-semibold">{product.currentStock} {product.unit}</span>
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

          {/* Warning for subtract */}
          {type === 'subtract' && quantity > product.currentStock && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-400">Invalid Quantity</h4>
                  <p className="text-sm text-gray-300 mt-1">
                    Cannot subtract more than current stock ({product.currentStock} {product.unit})
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
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
              disabled={quantity <= 0 || (type === 'subtract' && quantity > product.currentStock)}
            >
              <Save size={16} className="mr-2" />
              Save Adjustment
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};
