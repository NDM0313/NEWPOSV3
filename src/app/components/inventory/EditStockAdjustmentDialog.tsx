import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
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
import { DateTimePicker, dateToDateTimePickerValue, dateTimePickerValueToDate } from '../ui/DateTimePicker';
import { inventoryService } from '@/app/services/inventoryService';
import {
  formatAdjustmentNotes,
  parseAdjustmentNotes,
  projectedStockBalanceAfterEdit,
} from '@/app/lib/stockMovementEditPolicy';
import { parseLocalDateTimeInput, toLocalISOString } from '@/app/utils/localDate';

type AdjustmentReason = 'damaged' | 'audit' | 'return' | 'theft' | 'correction' | 'other';
type AdjustmentType = 'add' | 'subtract';

export type EditStockAdjustmentMovement = {
  id: string;
  quantity: number;
  created_at: string;
  notes?: string | null;
  branch?: { id?: string; name?: string } | null;
  variation?: { id?: string; name?: string; sku?: string } | null;
};

export interface EditStockAdjustmentDialogProps {
  open: boolean;
  onClose: () => void;
  movement: EditStockAdjustmentMovement | null;
  productName: string;
  productSku?: string;
  unit?: string;
  /** Running balance after this movement row (from ledger) */
  balanceAfter: number;
  onSaved: () => void;
}

const REASON_LABELS: Record<AdjustmentReason, string> = {
  damaged: 'Damaged/Defective',
  audit: 'Audit Adjustment',
  return: 'Customer Return',
  theft: 'Theft/Loss',
  correction: 'Stock Correction',
  other: 'Other',
};

export const EditStockAdjustmentDialog: React.FC<EditStockAdjustmentDialogProps> = ({
  open,
  onClose,
  movement,
  productName,
  productSku,
  unit = 'units',
  balanceAfter,
  onSaved,
}) => {
  const [type, setType] = useState<AdjustmentType>('add');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState<AdjustmentReason>('correction');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!movement || !open) return;
    const qty = Number(movement.quantity) || 0;
    setType(qty >= 0 ? 'add' : 'subtract');
    setQuantity(Math.abs(qty));
    const parsed = parseAdjustmentNotes(movement.notes);
    const reasonKey = (Object.keys(REASON_LABELS) as AdjustmentReason[]).includes(
      parsed.reason as AdjustmentReason
    )
      ? (parsed.reason as AdjustmentReason)
      : 'correction';
    setReason(reasonKey);
    setNotes(parsed.detail);
    setDate(parseLocalDateTimeInput(movement.created_at));
  }, [movement, open]);

  const signedNewQty = type === 'add' ? quantity : -quantity;
  const projectedBalance = useMemo(() => {
    if (!movement) return balanceAfter;
    return projectedStockBalanceAfterEdit(balanceAfter, Number(movement.quantity) || 0, signedNewQty);
  }, [balanceAfter, movement, signedNewQty]);

  const handleSave = async () => {
    if (!movement) return;
    if (quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    if (projectedBalance < -0.0001) {
      toast.error(`Cannot save: stock would become ${projectedBalance.toFixed(2)}`);
      return;
    }
    setSaving(true);
    try {
      const movementAt = toLocalISOString(date);
      const { error } = await inventoryService.updateManualStockAdjustment(movement.id, {
        movementAt,
        quantity: signedNewQty,
        notes: formatAdjustmentNotes(reason, notes),
        balanceAfter,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success('Stock adjustment updated');
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#111827] border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Edit stock adjustment</DialogTitle>
        </DialogHeader>

        {movement ? (
          <div className="space-y-4">
            <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-3 flex gap-3">
              <Package className="text-blue-400 shrink-0 mt-0.5" size={20} />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-white truncate">{productName}</p>
                {productSku ? <p className="text-gray-500 text-xs">SKU: {productSku}</p> : null}
                {movement.branch?.name ? (
                  <p className="text-gray-400 text-xs mt-1">Branch: {movement.branch.name}</p>
                ) : null}
                {movement.variation?.name || movement.variation?.sku ? (
                  <p className="text-gray-400 text-xs">
                    Variation: {movement.variation?.name || movement.variation?.sku}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-gray-300">Type</Label>
                <Select value={type} onValueChange={(v: AdjustmentType) => setType(v)}>
                  <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="add">Add stock</SelectItem>
                    <SelectItem value="subtract">Subtract stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={quantity || ''}
                  onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                  className="bg-gray-900 border-gray-800 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Reason</Label>
              <Select value={reason} onValueChange={(v: AdjustmentReason) => setReason(v)}>
                <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {(Object.keys(REASON_LABELS) as AdjustmentReason[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {REASON_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DateTimePicker
              label="Adjustment date & time"
              value={dateToDateTimePickerValue(date)}
              onChange={(v) => setDate(dateTimePickerValueToDate(v) || new Date())}
              required
            />

            <div className="space-y-2">
              <Label className="text-gray-300">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-gray-900 border-gray-800 text-white resize-none"
                rows={2}
              />
            </div>

            {quantity > 0 ? (
              <p className="text-xs text-gray-400">
                Stock after edit:{' '}
                <span className={projectedBalance < 0 ? 'text-red-400' : 'text-emerald-400'}>
                  {projectedBalance.toFixed(2)} {unit}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !movement}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
