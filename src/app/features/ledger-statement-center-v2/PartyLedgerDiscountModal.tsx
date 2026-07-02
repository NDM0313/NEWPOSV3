'use client';

import React, { useState } from 'react';
import { Loader2, Percent } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { COA_CODES } from '@/app/config/coaMapping';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  postPartyLedgerDiscount,
  type PartyLedgerDiscountType,
} from '@/app/services/partyLedgerDiscountService';

export interface PartyLedgerDiscountModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  branchId?: string | null;
  createdBy?: string | null;
  partyType: PartyLedgerDiscountType;
  contactId: string;
  partyName: string;
}

export function PartyLedgerDiscountModal({
  open,
  onClose,
  onSuccess,
  companyId,
  branchId,
  createdBy,
  partyType,
  contactId,
  partyName,
}: PartyLedgerDiscountModalProps) {
  const { formatCurrency } = useFormatCurrency();
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const title = partyType === 'customer' ? 'Customer discount' : 'Supplier discount';
  const coaSummary =
    partyType === 'customer'
      ? `Dr ${COA_CODES.DISCOUNT_ALLOWED} Discount Allowed · Cr party AR`
      : `Dr party AP · Cr ${COA_CODES.DISCOUNT_RECEIVED} Discount Received`;

  const handleClose = () => {
    if (loading) return;
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid discount amount.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await postPartyLedgerDiscount({
        companyId,
        branchId,
        partyType,
        contactId,
        partyName,
        amount: amt,
        entryDate,
        description: notes.trim() || undefined,
        createdBy,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.skipped && result.journalEntryId) {
        onSuccess();
        handleClose();
        return;
      }
      if (!result.journalEntryId) {
        setError('Discount was not posted.');
        return;
      }
      onSuccess();
      setAmount('');
      setNotes('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md bg-gray-900 text-white border-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Percent size={18} className="text-blue-400" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-gray-400">
            Party: <span className="text-white font-medium">{partyName}</span>
          </p>
          <p className="text-xs text-gray-500 rounded-lg bg-gray-800/60 border border-gray-700 px-3 py-2">
            {coaSummary} — reduces {partyType === 'customer' ? 'customer' : 'supplier'} balance by{' '}
            {amount ? formatCurrency(Number(amount) || 0) : 'the entered amount'}.
          </p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div>
            <Label className="text-gray-400">Amount *</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 bg-gray-800 border-gray-700 text-white"
              disabled={loading}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label className="text-gray-400">Date</Label>
            <DatePicker value={entryDate} onChange={setEntryDate} disabled={loading} />
          </div>
          <div>
            <Label className="text-gray-400">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 bg-gray-800 border-gray-700 text-white min-h-[72px]"
              disabled={loading}
              placeholder="Reason or reference…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="border-gray-700 text-white hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting…
                </>
              ) : (
                'Apply discount'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
