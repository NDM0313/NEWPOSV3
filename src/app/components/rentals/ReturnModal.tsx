import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { useSupabase } from '@/app/context/SupabaseContext';
import type { RentalUI } from '@/app/context/RentalContext';
import { cn } from '@/app/components/ui/utils';

export interface ReturnConfirmPayload {
  actualReturnDate: string;
  notes?: string;
  conditionType: 'good' | 'minor_damage' | 'major_damage';
  damageNotes?: string;
  penaltyAmount: number;
  penaltyPaid: boolean;
  documentReturned: boolean;
}

interface ReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: RentalUI | null;
  /** Document info from pickup (document_type, document_number) */
  documentInfo?: { documentType?: string; documentNumber?: string };
  onConfirm: (rentalId: string, payload: ReturnConfirmPayload) => Promise<void>;
}

const CONDITION_OPTIONS = [
  { value: 'good' as const, label: 'Good Condition' },
  { value: 'minor_damage' as const, label: 'Minor Damage' },
  { value: 'major_damage' as const, label: 'Major Damage' },
];

export const ReturnModal = ({ open, onOpenChange, rental, documentInfo, onConfirm }: ReturnModalProps) => {
  const { user } = useSupabase();
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [conditionType, setConditionType] = useState<'good' | 'minor_damage' | 'major_damage'>('good');
  const [damageNotes, setDamageNotes] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyPaid, setPenaltyPaid] = useState(false);
  const [documentReturned, setDocumentReturned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const penalty = parseFloat(penaltyAmount) || 0;
  const hasPenalty = conditionType !== 'good';

  // When condition = Good: penalty = 0, penalty_paid auto true
  useEffect(() => {
    if (conditionType === 'good') {
      setPenaltyAmount('');
      setPenaltyPaid(true);
    } else {
      setPenaltyPaid(false);
    }
  }, [conditionType]);

  const handleConfirm = async () => {
    if (!rental) return;
    if (hasPenalty && !damageNotes.trim()) {
      setError('Damage notes are required when condition is not good');
      return;
    }
    if (hasPenalty && penalty <= 0) {
      setError('Penalty amount is required when there is damage');
      return;
    }
    if (hasPenalty && !penaltyPaid) {
      setError('Please confirm penalty received');
      return;
    }
    if (!documentReturned) {
      setError('Please confirm document returned to customer');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onConfirm(rental.id, {
        actualReturnDate: returnDate,
        notes: notes.trim() || undefined,
        conditionType,
        damageNotes: hasPenalty ? damageNotes.trim() : undefined,
        penaltyAmount: penalty,
        penaltyPaid: hasPenalty ? penaltyPaid : true,
        documentReturned,
      });
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to process return');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setError(null);
    setReturnDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setConditionType('good');
    setDamageNotes('');
    setPenaltyAmount('');
    setPenaltyPaid(false);
    setDocumentReturned(false);
    onOpenChange(next);
  };

  const returnedBy = user?.email || (user?.user_metadata as any)?.full_name || 'Current user';
  const docTypeLabel = documentInfo?.documentType ? { cnic: 'CNIC', passport: 'Passport', driving_license: 'Driving License', other: 'Other' }[documentInfo.documentType] || documentInfo.documentType : '—';

  // IF condition === good: enable if document_returned === true
  // IF condition !== good: enable if penalty_amount > 0 AND penalty_paid === true AND document_returned === true
  const canConfirm =
    documentReturned &&
    (conditionType === 'good'
      ? true
      : penalty > 0 && penaltyPaid && damageNotes.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-[950px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-800">
          <DialogTitle className="text-white text-xl">Confirm Return</DialogTitle>
          <DialogDescription className="text-gray-400">
            Process return for rental {rental?.rentalNo}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[450px]">
          {/* LEFT SIDE */}
          <div className="flex-[6] overflow-y-auto p-6 space-y-6">
            {/* Card 1 – Rental Info */}
            <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/30">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Rental Info</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Rental #</span><p className="font-mono text-pink-400">{rental?.rentalNo}</p></div>
                <div><span className="text-gray-500">Customer</span><p className="text-white">{rental?.customerName}</p></div>
                <div className="col-span-2">
                  <span className="text-gray-500">Product(s)</span>
                  <p className="text-white font-medium">{rental?.items?.map((i) => i.productName).join(', ') || '—'}</p>
                </div>
                <div><span className="text-gray-500">Pickup Date</span><p className="text-white">{rental?.startDate}</p></div>
                <div><span className="text-gray-500">Expected Return</span><p className="text-white">{rental?.expectedReturnDate}</p></div>
              </div>
            </div>

            {/* Card 2 – Item Inspection */}
            <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/30">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Item Inspection</h4>
              <div className="space-y-3">
                <Label className="text-gray-400 text-sm">Condition</Label>
                <div className="flex gap-4">
                  {CONDITION_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="condition"
                        checked={conditionType === opt.value}
                        onChange={() => setConditionType(opt.value)}
                        className="w-4 h-4 text-green-500 border-gray-600 bg-gray-800 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-300">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {hasPenalty && (
                  <>
                    <div>
                      <Label className="text-gray-400 text-sm">Damage Notes *</Label>
                      <textarea
                        value={damageNotes}
                        onChange={(e) => setDamageNotes(e.target.value)}
                        placeholder="Describe the damage..."
                        rows={2}
                        className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm resize-none"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">Penalty Amount *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={penaltyAmount}
                        onChange={(e) => setPenaltyAmount(e.target.value)}
                        placeholder="0"
                        className="mt-1 bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Card 3 – Penalty Settlement (if penalty > 0) */}
            {hasPenalty && penalty > 0 && (
              <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/30">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Penalty Settlement</h4>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-500">Penalty Amount</span>
                  <span className="text-red-400 font-semibold">${penalty.toLocaleString()}</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={penaltyPaid}
                    onCheckedChange={(v) => setPenaltyPaid(!!v)}
                    className="border-gray-600 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                  />
                  <span className="text-sm text-gray-300">Confirm penalty received</span>
                </label>
              </div>
            )}
          </div>

          {/* RIGHT SIDE */}
          <div className="flex-[4] border-l border-gray-800 p-6 bg-gray-900/50 flex flex-col space-y-6">
            {/* Guarantee Document Summary */}
            <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/30">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Guarantee Document</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Document Type</span><span className="text-white">{docTypeLabel}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Document Number</span><span className="text-white font-mono">{documentInfo?.documentNumber || '—'}</span></div>
                <p className="text-xs text-green-400 mt-2">Document received at pickup: Yes</p>
              </div>
              <label className="mt-4 flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={documentReturned}
                  onCheckedChange={(v) => setDocumentReturned(!!v)}
                  className="border-gray-600 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                />
                <span className="text-sm text-gray-300">Document returned to customer</span>
              </label>
            </div>

            {/* Final Summary */}
            <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/30 flex-1">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Final Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total Rental Amount</span><span className="text-white">${(rental?.totalAmount ?? 0).toLocaleString()}</span></div>
                {penalty > 0 && (
                  <div className="flex justify-between"><span className="text-gray-500">Total Penalty</span><span className="text-red-400">${penalty.toLocaleString()}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-700">
                  <span className="text-gray-500">Net Settlement</span>
                  <span className="text-white font-semibold">${((rental?.totalAmount ?? 0) + penalty).toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-4">
                <Label className="text-gray-400 text-sm">Return Date</Label>
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="mt-3">
                <Label className="text-gray-400 text-sm">Returned By</Label>
                <p className="mt-1 text-sm text-gray-300">{returnedBy}</p>
              </div>
              <div className="mt-3">
                <Label className="text-gray-400 text-sm">Notes</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                  rows={2}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="px-6 text-sm text-red-400">{error}</p>}

        <DialogFooter className="px-6 py-4 border-t border-gray-800">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-gray-800 text-white border-gray-700">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !canConfirm}
            className="bg-green-600 hover:bg-green-500 text-white"
          >
            {saving ? 'Saving…' : 'Confirm Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
