import React, { useState, useEffect } from 'react';
import { X, MoveHorizontal, MapPin, Calendar, FileText, Save, AlertCircle, ArrowRight } from 'lucide-react';
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
      toast.error('Please enter a valid quantity');
      return;
    }

    if (quantity > product.currentStock) {
      toast.error('Cannot transfer more than current stock');
      return;
    }

    if (sourceLocation === destinationLocation) {
      toast.error('Source and destination locations must be different');
      return;
    }

    if (!destinationLocation) {
      toast.error('Please select a destination location');
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
      pending: { label: 'Pending', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
      'in-transit': { label: 'In Transit', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
      completed: { label: 'Completed', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
      cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
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
      <div className="fixed right-0 top-0 h-full w-[600px] bg-[#111827] border-l border-gray-800 z-50 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-[#111827] border-b border-gray-800 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Stock Transfer</h2>
              <p className="text-sm text-gray-400">Move inventory between locations</p>
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
                    Available: {product.currentStock} {product.unit}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Transfer Route Visual */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">From</div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-purple-400" />
                  <span className="font-semibold text-white">
                    {sourceLocation || 'Select source'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-4">
                <ArrowRight size={24} className="text-purple-400" />
                {quantity > 0 && (
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                    {quantity} {product.unit}
                  </Badge>
                )}
              </div>

              <div className="flex-1">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">To</div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-purple-400" />
                  <span className="font-semibold text-white">
                    {destinationLocation || 'Select destination'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Source Location */}
          <div className="space-y-2">
            <Label htmlFor="source" className="text-gray-300 flex items-center gap-2">
              <MapPin size={14} />
              Source Location
            </Label>
            <Select value={sourceLocation} onValueChange={setSourceLocation}>
              <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                <SelectValue placeholder="Select source location" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination Location */}
          <div className="space-y-2">
            <Label htmlFor="destination" className="text-gray-300 flex items-center gap-2">
              <MapPin size={14} />
              Destination Location
            </Label>
            <Select value={destinationLocation} onValueChange={setDestinationLocation}>
              <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                <SelectValue placeholder="Select destination location" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                {LOCATIONS.filter(loc => loc !== sourceLocation).map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-gray-300">
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
              className="bg-gray-900 border-gray-800 text-white"
              placeholder="Enter quantity"
              required
            />
            <p className="text-xs text-gray-500">
              Maximum available: {product.currentStock} {product.unit}
            </p>
          </div>

          {/* Transfer Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-gray-300">
              Transfer Status
            </Label>
            <Select value={status} onValueChange={(v: TransferStatus) => setStatus(v)}>
              <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-transit">In Transit</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={getStatusConfig(status).color}>
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
            <Label htmlFor="notes" className="text-gray-300 flex items-center gap-2">
              <FileText size={14} />
              Transfer Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-gray-900 border-gray-800 text-white resize-none"
              placeholder="Add any notes about this transfer (e.g., reason, carrier info, etc.)..."
              rows={3}
            />
          </div>

          {/* Validation Warnings */}
          {quantity > product.currentStock && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-400">Invalid Quantity</h4>
                  <p className="text-sm text-gray-300 mt-1">
                    Cannot transfer more than available stock ({product.currentStock} {product.unit})
                  </p>
                </div>
              </div>
            </div>
          )}

          {sourceLocation && destinationLocation && sourceLocation === destinationLocation && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-400">Invalid Transfer</h4>
                  <p className="text-sm text-gray-300 mt-1">
                    Source and destination locations must be different
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info Note */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-400 mb-1">Transfer Note</h4>
                <p className="text-sm text-gray-300">
                  This transfer will create a movement record in the audit log. The total stock quantity remains the same, but location allocation changes.
                </p>
              </div>
            </div>
          </div>

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
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white"
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
