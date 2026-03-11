/**
 * Pay Courier — Accounting → Payments
 * Dr Courier Payable (specific courier) / Cr Cash or Bank
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { shipmentAccountingService } from '@/app/services/shipmentAccountingService';
import { contactService } from '@/app/services/contactService';
import { Truck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PayCourierModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  branchId?: string | null;
  onSuccess?: () => void;
}

export function PayCourierModal({ open, onClose, companyId, branchId, onSuccess }: PayCourierModalProps) {
  const [couriers, setCouriers] = useState<{ id: string; name: string; balance: number }[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [courierId, setCourierId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !companyId) return;
    setLoadingCouriers(true);
    shipmentAccountingService
      .getCourierBalances(companyId)
      .then((rows) => {
        const withBalance = rows.filter((r) => r.balance > 0 && r.courier_id);
        setCouriers(withBalance.map((r) => ({ id: r.courier_id!, name: r.courier_name, balance: r.balance })));
        setCourierId((prev) => (withBalance.some((r) => r.courier_id === prev) ? prev : withBalance[0]?.courier_id ?? ''));
      })
      .catch(() => setCouriers([]))
      .finally(() => setLoadingCouriers(false));
  }, [open, companyId]);

  useEffect(() => {
    if (!open) {
      setAmount('');
      setNotes('');
      setCourierId('');
      setPaymentMethod('cash');
    }
  }, [open]);

  const selectedCourier = couriers.find((c) => c.id === courierId);
  const balance = selectedCourier?.balance ?? 0;
  const amountNum = parseFloat(amount) || 0;
  const valid = courierId && amountNum > 0 && amountNum <= balance;

  const handleSubmit = async () => {
    if (!valid || !selectedCourier) return;
    setSubmitting(true);
    try {
      const jeId = await shipmentAccountingService.recordCourierPayment({
        companyId,
        branchId,
        courierContactId: courierId,
        courierName: selectedCourier.name,
        amount: amountNum,
        paymentMethod,
        notes: notes.trim() || undefined,
        performedBy: undefined,
      });
      if (jeId) {
        toast.success('Courier payment recorded');
        onSuccess?.();
        onClose();
      } else {
        toast.error('Failed to record payment');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0F1419] border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Truck size={20} className="text-indigo-400" />
            Pay Courier
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-gray-400">Courier</Label>
            <select
              value={courierId}
              onChange={(e) => setCourierId(e.target.value)}
              disabled={loadingCouriers}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Select courier</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} – Balance: {formatPkr(c.balance)}
                </option>
              ))}
            </select>
            {selectedCourier && (
              <p className="mt-1 text-xs text-gray-500">Outstanding: {formatPkr(balance)}</p>
            )}
          </div>

          <div>
            <Label className="text-gray-400">Amount (PKR)</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="mt-1 bg-gray-900 border-gray-700 text-white"
            />
          </div>

          <div>
            <Label className="text-gray-400">Payment method</Label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'bank')}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </select>
          </div>

          <div>
            <Label className="text-gray-400">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reference or notes"
              className="mt-1 bg-gray-900 border-gray-700 text-white"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-gray-800 pt-4">
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting ? ' Recording…' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatPkr(n: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n);
}
