import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, AlertCircle, Calendar, FileText, Save } from 'lucide-react';
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
  } | null;
  onAdjust: (data: {
    productId: string;
    type: AdjustmentType;
    quantity: number;
    reason: AdjustmentReason;
    notes: string;
    date: string;
    newStock: number;
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

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      setType('add');
      setQuantity(0);
      setReason('correction');
      setNotes('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [product]);

  if (!open || !product) return null;

  const calculatedNewStock = type === 'add' 
    ? product.currentStock + quantity 
    : product.currentStock - quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (quantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    if (type === 'subtract' && quantity > product.currentStock) {
      alert('Cannot subtract more than current stock');
      return;
    }

    onAdjust({
      productId: product.id,
      type,
      quantity,
      reason,
      notes,
      date,
      newStock: calculatedNewStock
    });

    // Log for audit trail
    console.log('Stock Adjustment Log:', {
      timestamp: new Date().toISOString(),
      product: product.name,
      sku: product.sku,
      type,
      quantity,
      reason,
      previousStock: product.currentStock,
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
      <div 
        className="fixed right-0 top-0 h-full w-[600px] border-l z-50 shadow-2xl overflow-y-auto"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderLeftColor: 'var(--color-border-primary)'
        }}
      >
        <div 
          className="sticky top-0 border-b px-6 py-4 z-10"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderBottomColor: 'var(--color-border-primary)'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 
                className="text-xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Stock Adjustment
              </h2>
              <p 
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Correct inventory levels and log changes
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Product Info */}
          <div 
            className="border rounded-lg p-4"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div className="flex items-center gap-4">
              {product.image && (
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover border"
                  style={{
                    borderColor: 'var(--color-border-secondary)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                />
              )}
              <div className="flex-1">
                <h3 
                  className="font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {product.name}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <code 
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      color: 'var(--color-primary)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    {product.sku}
                  </code>
                  <Badge
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--color-success)',
                      borderColor: 'rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    Current: {product.currentStock} {product.unit}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label style={{ color: 'var(--color-text-primary)' }}>Adjustment Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('add')}
                className="p-4 rounded-lg border-2 transition-all"
                style={{
                  backgroundColor: type === 'add' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg-card)',
                  borderColor: type === 'add' ? 'var(--color-success)' : 'var(--color-border-primary)',
                  borderWidth: '2px',
                  color: type === 'add' ? 'var(--color-success)' : 'var(--color-text-secondary)',
                  borderRadius: 'var(--radius-lg)'
                }}
                onMouseEnter={(e) => {
                  if (type !== 'add') {
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (type !== 'add') {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  }
                }}
              >
                <Plus size={24} className="mx-auto mb-2" />
                <div className="font-semibold">Add Stock</div>
                <div className="text-xs mt-1">Increase inventory</div>
              </button>
              <button
                type="button"
                onClick={() => setType('subtract')}
                className="p-4 rounded-lg border-2 transition-all"
                style={{
                  backgroundColor: type === 'subtract' ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg-card)',
                  borderColor: type === 'subtract' ? 'var(--color-error)' : 'var(--color-border-primary)',
                  borderWidth: '2px',
                  color: type === 'subtract' ? 'var(--color-error)' : 'var(--color-text-secondary)',
                  borderRadius: 'var(--radius-lg)'
                }}
                onMouseEnter={(e) => {
                  if (type !== 'subtract') {
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (type !== 'subtract') {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  }
                }}
              >
                <Minus size={24} className="mx-auto mb-2" />
                <div className="font-semibold">Subtract Stock</div>
                <div className="text-xs mt-1">Reduce inventory</div>
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label 
              htmlFor="quantity"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Quantity ({product.unit})
            </Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              placeholder="Enter quantity"
              required
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label 
              htmlFor="reason"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Reason for Adjustment
            </Label>
            <Select value={reason} onValueChange={(v: AdjustmentReason) => setReason(v)}>
              <SelectTrigger
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)'
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
              >
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
            <Label 
              htmlFor="notes" 
              className="flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <FileText size={14} />
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              placeholder="Add any additional notes about this adjustment..."
              rows={3}
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Preview */}
          {quantity > 0 && (
            <div 
              className="border rounded-lg p-4"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: 'rgba(59, 130, 246, 0.2)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle size={20} style={{ color: 'var(--color-primary)' }} className="mt-0.5" />
                <div className="flex-1">
                  <h4 
                    className="font-semibold mb-2"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    Adjustment Preview
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div 
                      className="flex justify-between"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <span>Current Stock:</span>
                      <span className="font-semibold">{product.currentStock} {product.unit}</span>
                    </div>
                    <div 
                      className="flex justify-between"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <span>Adjustment:</span>
                      <span 
                        className="font-semibold"
                        style={{ color: type === 'add' ? 'var(--color-success)' : 'var(--color-error)' }}
                      >
                        {type === 'add' ? '+' : '-'}{quantity} {product.unit}
                      </span>
                    </div>
                    <div 
                      className="border-t pt-2 mt-2 flex justify-between"
                      style={{ borderColor: 'rgba(59, 130, 246, 0.2)' }}
                    >
                      <span 
                        className="font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        New Stock:
                      </span>
                      <span 
                        className="font-bold text-lg"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
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
            <div 
              className="border rounded-lg p-4"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle size={20} style={{ color: 'var(--color-error)' }} className="mt-0.5" />
                <div>
                  <h4 
                    className="font-semibold"
                    style={{ color: 'var(--color-error)' }}
                  >
                    Invalid Quantity
                  </h4>
                  <p 
                    className="text-sm mt-1"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Cannot subtract more than current stock ({product.currentStock} {product.unit})
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div 
            className="flex gap-3 pt-4 border-t"
            style={{ borderColor: 'var(--color-border-primary)' }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-secondary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                e.currentTarget.style.opacity = '1';
              }}
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
