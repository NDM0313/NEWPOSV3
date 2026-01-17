import React, { useState, useEffect } from 'react';
import { X, MoveHorizontal, MapPin, Calendar, FileText, Save, AlertCircle, ArrowRight } from 'lucide-react';
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

type TransferStatus = 'pending' | 'in-transit' | 'completed' | 'cancelled';

interface StockTransferDrawerProps {
  open: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    unit: string;
    location?: string;
    image?: string;
  } | null;
  onTransfer: (data: {
    productId: string;
    sourceLocation: string;
    destinationLocation: string;
    quantity: number;
    status: TransferStatus;
    notes: string;
    transferDate: string;
  }) => void;
}

const LOCATIONS = [
  'Main Godown',
  'Shop Display',
  'Warehouse A',
  'Warehouse B',
  'Rental Section',
  'Custom Studio',
  'Production Unit'
];

export const StockTransferDrawer: React.FC<StockTransferDrawerProps> = ({
  open,
  onClose,
  product,
  onTransfer
}) => {
  const [sourceLocation, setSourceLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [status, setStatus] = useState<TransferStatus>('pending');
  const [notes, setNotes] = useState('');
  const [transferDate, setTransferDate] = useState<Date>(new Date());

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      setSourceLocation(product.location || 'Main Godown');
      setDestinationLocation('');
      setQuantity(0);
      setStatus('pending');
      setNotes('');
      setTransferDate(new Date().toISOString().split('T')[0]);
    }
  }, [product]);

  if (!open || !product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (quantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    if (quantity > product.currentStock) {
      alert('Cannot transfer more than current stock');
      return;
    }

    if (sourceLocation === destinationLocation) {
      alert('Source and destination locations must be different');
      return;
    }

    if (!destinationLocation) {
      alert('Please select a destination location');
      return;
    }

    onTransfer({
      productId: product.id,
      sourceLocation,
      destinationLocation,
      quantity,
      status,
      notes,
      transferDate
    });

    // Log for audit trail
    console.log('Stock Transfer Log:', {
      timestamp: new Date().toISOString(),
      product: product.name,
      sku: product.sku,
      from: sourceLocation,
      to: destinationLocation,
      quantity,
      status,
      transferDate,
      notes
    });
  };

  const getStatusConfig = (s: TransferStatus) => {
    const configs = {
      pending: { 
        label: 'Pending', 
        style: {
          backgroundColor: 'rgba(107, 114, 128, 0.1)',
          color: 'var(--color-text-secondary)',
          borderColor: 'rgba(107, 114, 128, 0.2)'
        }
      },
      'in-transit': { 
        label: 'In Transit', 
        style: {
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          color: 'var(--color-warning)',
          borderColor: 'rgba(249, 115, 22, 0.2)'
        }
      },
      completed: { 
        label: 'Completed', 
        style: {
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: 'var(--color-success)',
          borderColor: 'rgba(16, 185, 129, 0.2)'
        }
      },
      cancelled: { 
        label: 'Cancelled', 
        style: {
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--color-error)',
          borderColor: 'rgba(239, 68, 68, 0.2)'
        }
      }
    };
    return configs[s];
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
                Stock Transfer
              </h2>
              <p 
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Move inventory between locations
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
                    Available: {product.currentStock} {product.unit}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Transfer Route Visual */}
          <div 
            className="border rounded-lg p-4"
            style={{
              backgroundColor: 'rgba(147, 51, 234, 0.1)',
              borderColor: 'rgba(147, 51, 234, 0.2)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div 
                  className="text-xs uppercase tracking-wide mb-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  From
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} style={{ color: 'var(--color-wholesale)' }} />
                  <span 
                    className="font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {sourceLocation || 'Select source'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-4">
                <ArrowRight size={24} style={{ color: 'var(--color-wholesale)' }} />
                {quantity > 0 && (
                  <Badge
                    style={{
                      backgroundColor: 'rgba(147, 51, 234, 0.2)',
                      color: 'var(--color-wholesale)',
                      borderColor: 'rgba(147, 51, 234, 0.3)'
                    }}
                  >
                    {quantity} {product.unit}
                  </Badge>
                )}
              </div>

              <div className="flex-1">
                <div 
                  className="text-xs uppercase tracking-wide mb-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  To
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} style={{ color: 'var(--color-wholesale)' }} />
                  <span 
                    className="font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {destinationLocation || 'Select destination'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Source Location */}
          <div className="space-y-2">
            <Label 
              htmlFor="source" 
              className="flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <MapPin size={14} />
              Source Location
            </Label>
            <Select value={sourceLocation} onValueChange={setSourceLocation}>
              <SelectTrigger
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)'
                }}
              >
                <SelectValue placeholder="Select source location" />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
              >
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination Location */}
          <div className="space-y-2">
            <Label 
              htmlFor="destination" 
              className="flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <MapPin size={14} />
              Destination Location
            </Label>
            <Select value={destinationLocation} onValueChange={setDestinationLocation}>
              <SelectTrigger
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)'
                }}
              >
                <SelectValue placeholder="Select destination location" />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
              >
                {LOCATIONS.filter(loc => loc !== sourceLocation).map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label 
              htmlFor="quantity"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Quantity to Transfer ({product.unit})
            </Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              max={product.currentStock}
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
            <p 
              className="text-xs"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Maximum available: {product.currentStock} {product.unit}
            </p>
          </div>

          {/* Transfer Status */}
          <div className="space-y-2">
            <Label 
              htmlFor="status"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Transfer Status
            </Label>
            <Select value={status} onValueChange={(v: TransferStatus) => setStatus(v)}>
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-transit">In Transit</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 mt-2">
              <Badge style={getStatusConfig(status).style}>
                {getStatusConfig(status).label}
              </Badge>
            </div>
          </div>

          {/* Transfer Date */}
          <div className="space-y-2">
            <CalendarDatePicker
              label="Transfer Date"
              value={transferDate}
              onChange={(d) => setTransferDate(d || new Date())}
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
              Transfer Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              placeholder="Add any notes about this transfer (e.g., reason, carrier info, etc.)..."
              rows={3}
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Validation Warnings */}
          {quantity > product.currentStock && (
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
                    Cannot transfer more than available stock ({product.currentStock} {product.unit})
                  </p>
                </div>
              </div>
            </div>
          )}

          {sourceLocation && destinationLocation && sourceLocation === destinationLocation && (
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
                    Invalid Transfer
                  </h4>
                  <p 
                    className="text-sm mt-1"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Source and destination locations must be different
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info Note */}
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
              <div>
                <h4 
                  className="font-semibold mb-1"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Transfer Note
                </h4>
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  This transfer will create a movement record in the audit log. The total stock quantity remains the same, but location allocation changes.
                </p>
              </div>
            </div>
          </div>

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
                backgroundColor: 'var(--color-wholesale)',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                e.currentTarget.style.opacity = '1';
              }}
              disabled={
                quantity <= 0 || 
                quantity > product.currentStock || 
                !destinationLocation || 
                sourceLocation === destinationLocation
              }
            >
              <MoveHorizontal size={16} className="mr-2" />
              Create Transfer
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};
