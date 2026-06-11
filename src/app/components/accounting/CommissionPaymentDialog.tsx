/**
 * Pay commission to staff/salesman user — Dr 2040 / Cr cash-bank.
 */
import { useState, useEffect, useMemo } from 'react';
import { X, Banknote, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { DatePicker } from '@/app/components/ui/DatePicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useAccounting } from '@/app/context/AccountingContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { createCommissionPayment } from '@/app/services/commissionPaymentService';
import { toast } from 'sonner';

export interface CommissionPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  /** Suggested amount (e.g. net owed from User Ledger). */
  suggestedAmount?: number;
  onSuccess?: () => void;
}

export function CommissionPaymentDialog({
  isOpen,
  onClose,
  userId,
  userName,
  suggestedAmount = 0,
  onSuccess,
}: CommissionPaymentDialogProps) {
  const { companyId, branchId } = useSupabase();
  const { accounts } = useAccounting();
  const { formatCurrency } = useFormatCurrency();
  const [amount, setAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const liquidityAccounts = useMemo(
    () =>
      (accounts || []).filter((a) => {
        const t = String(a.type || '').toLowerCase();
        return ['cash', 'bank', 'mobile_wallet'].includes(t) && a.is_active !== false;
      }),
    [accounts],
  );

  useEffect(() => {
    if (!isOpen) return;
    const sug = Math.abs(suggestedAmount) >= 0.01 ? String(Math.round(suggestedAmount * 100) / 100) : '';
    setAmount(sug);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    if (liquidityAccounts.length && !paymentAccountId) {
      setPaymentAccountId(liquidityAccounts[0].id);
    }
  }, [isOpen, suggestedAmount, liquidityAccounts, paymentAccountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !userId) {
      toast.error('Company or user not set.');
      return;
    }
    const amt = parseFloat(amount) || 0;
    if (amt < 0.01) {
      toast.error('Enter a valid amount.');
      return;
    }
    if (!paymentAccountId) {
      toast.error('Select a payment account.');
      return;
    }
    setSaving(true);
    try {
      const result = await createCommissionPayment({
        companyId,
        branchId,
        userId,
        userName,
        amount: amt,
        paymentAccountId,
        paymentDate,
        notes: notes.trim() || undefined,
      });
      toast.success(`Commission payment recorded (${result.referenceNumber})`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Commission payment failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#0B0F17] border border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Pay Commission</h2>
            <p className="text-sm text-gray-400">{userName} · Dr 2040 / Cr Cash-Bank</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} className="text-gray-400">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {Math.abs(suggestedAmount) >= 0.01 && suggestedAmount > 0 && (
            <p className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2">
              Net owed (operational): {formatCurrency(suggestedAmount)}
            </p>
          )}
          <div className="space-y-2">
            <Label className="text-gray-400">Amount *</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-gray-900 border-gray-700 text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-400">Pay from account *</Label>
            <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Cash / Bank / Wallet" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                {liquidityAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-400">Payment date</Label>
            <DatePicker value={paymentDate} onChange={setPaymentDate} />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-400">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Commission payment — ${userName}`}
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>
          <Button type="submit" disabled={saving} className="w-full bg-green-600 hover:bg-green-500">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Banknote className="w-4 h-4 mr-2" />}
            Record payment
          </Button>
        </form>
      </div>
    </div>
  );
}
