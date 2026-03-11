/**
 * Pay Courier — Accounting → Payments
 * Same layout as Receive Payment (UnifiedPaymentDialog): Courier Details, Payment Summary,
 * Amount, Date & Time, Attachments, Notes, Payment Method, Select Account.
 * Dr Courier Payable / Cr Cash or Bank
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Truck, Wallet, Building2, CreditCard, ChevronDown, Calendar, Upload, FileText, Trash2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useAccounting, type PaymentMethod } from '@/app/context/AccountingContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { shipmentAccountingService } from '@/app/services/shipmentAccountingService';
import { toast } from 'sonner';

interface PayCourierModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  branchId?: string | null;
  onSuccess?: () => void;
}

type CourierOption = { id: string; name: string; balance: number; totalPayable: number; totalPaid: number };

const normalizePaymentType = (t: string) => String(t || '').toLowerCase().trim().replace(/\s+/g, '_');

export function PayCourierModal({ open, onClose, companyId, branchId, onSuccess }: PayCourierModalProps) {
  const accounting = useAccounting();
  const settings = useSettings();
  const { formatCurrency } = useFormatCurrency();

  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [courierId, setCourierId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentDateTime, setPaymentDateTime] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [attachments, setAttachments] = useState<File[]>([]);

  const selectedCourier = couriers.find((c) => c.id === courierId);
  const outstanding = selectedCourier?.balance ?? 0;
  const totalPayable = selectedCourier?.totalPayable ?? 0;
  const totalPaid = selectedCourier?.totalPaid ?? 0;

  useEffect(() => {
    if (!open || !companyId) return;
    setLoadingCouriers(true);
    shipmentAccountingService
      .getCourierBalances(companyId)
      .then((rows) => {
        const withBalance = rows.filter((r) => r.balance > 0 && r.courier_id);
        setCouriers(
          withBalance.map((r) => ({
            id: r.courier_id!,
            name: r.courier_name,
            balance: r.balance,
            totalPayable: r.total_payable ?? 0,
            totalPaid: r.total_paid ?? 0,
          }))
        );
        setCourierId((prev) => (withBalance.some((r) => r.courier_id === prev) ? prev : withBalance[0]?.courier_id ?? ''));
      })
      .catch(() => setCouriers([]))
      .finally(() => setLoadingCouriers(false));
  }, [open, companyId]);

  useEffect(() => {
    if (open && companyId) {
      accounting.refreshEntries?.().catch(() => {});
    }
  }, [open, companyId]);

  useEffect(() => {
    if (!open) {
      setAmount(0);
      setNotes('');
      setCourierId('');
      setPaymentMethod('Cash');
      setSelectedAccount('');
      setAttachments([]);
      const now = new Date();
      setPaymentDateTime(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    }
  }, [open]);

  const getFilteredAccounts = () => {
    const methodNorm = normalizePaymentType(paymentMethod);
    const isCash = methodNorm === 'cash';
    const isBank = methodNorm === 'bank';
    const isWallet = methodNorm === 'mobile_wallet' || methodNorm === 'mobilewallet';
    return accounting.accounts.filter((account) => {
      if (account.isActive === false) return false;
      const accType = normalizePaymentType(String((account as any).type ?? (account as any).accountType ?? ''));
      const accCode = String((account as any).code ?? '');
      const accName = (account.name || '').toLowerCase();
      const typeMatches =
        accType === methodNorm ||
        (isCash && (accType === 'cash' || accCode === '1000' || accName.includes('cash'))) ||
        (isBank && (accType === 'bank' || accCode === '1010' || accName.includes('bank') || accCode.startsWith('101'))) ||
        (isWallet && (accType === 'mobile_wallet' || accType === 'wallet' || accCode === '1020' || accName.includes('wallet') || accCode.startsWith('102')));
      if (!typeMatches) return false;
      const accountBranch = (account as any).branchId ?? (account as any).branch ?? '';
      const isGlobal = !accountBranch || accountBranch === 'global' || accountBranch === '';
      const isBranchSpecific = branchId && branchId !== 'all' && (accountBranch === branchId || accountBranch === String(branchId));
      const showAllBranches = !branchId || branchId === 'all';
      return isGlobal || isBranchSpecific || showAllBranches;
    });
  };

  useEffect(() => {
    if (!open || !companyId) return;
    const filtered = getFilteredAccounts();
    if (filtered.length === 0) {
      setSelectedAccount('');
      return;
    }
    const defaultCash = paymentMethod === 'Cash' && filtered.find((a) => (a as any).code === '1000' || a.name?.toLowerCase() === 'cash');
    const defaultBank = paymentMethod === 'Bank' && filtered.find((a) => (a as any).code === '1010' || a.name?.toLowerCase() === 'bank');
    const defaultAcc = defaultCash || defaultBank || filtered[0];
    setSelectedAccount(defaultAcc?.id ?? '');
  }, [open, companyId, paymentMethod, accounting.accounts, branchId]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setAmount(value);
  };
  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (amount > 0) e.target.select();
  };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachments((prev) => [...prev, ...Array.from(e.target.files || [])]);
    e.target.value = '';
  };
  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = courierId && amount > 0 && amount <= outstanding && selectedAccount && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedCourier) return;
    setSubmitting(true);
    try {
      const paymentDate = paymentDateTime.split('T')[0];
      const methodForService = paymentMethod === 'Mobile Wallet' ? 'mobile_wallet' : paymentMethod.toLowerCase();
      const jeId = await shipmentAccountingService.recordCourierPayment({
        companyId,
        branchId,
        courierContactId: courierId,
        courierName: selectedCourier.name,
        amount,
        paymentMethod: methodForService,
        paymentDate,
        notes: notes.trim() || undefined,
        performedBy: undefined,
        accountId: selectedAccount,
      });
      if (jeId) {
        toast.success('Courier payment recorded', {
          description: `${formatCurrency(amount)} via ${paymentMethod} on ${paymentDate}`,
        });
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

  if (!open) return null;

  const filteredAccounts = getFilteredAccounts();
  const currencyLabel = settings.company?.currency === 'PKR' || !settings.company?.currency ? 'Rs.' : settings.company.currency;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Truck size={20} className="text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Pay Courier</h2>
                <p className="text-xs text-gray-400 mt-0.5">Complete payment details</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* LEFT COLUMN */}
              <div className="space-y-4">
                {/* Courier Details */}
                <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-400">Courier Details</span>
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                      COURIER
                    </Badge>
                  </div>
                  <label className="block text-xs text-gray-400 mb-1">Courier Name</label>
                  <select
                    value={courierId}
                    onChange={(e) => setCourierId(e.target.value)}
                    disabled={loadingCouriers}
                    className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select courier</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} – {formatCurrency(c.balance)} due
                      </option>
                    ))}
                  </select>
                  {selectedCourier && (
                    <p className="text-xs text-gray-500 font-mono bg-gray-900/50 px-2 py-1 rounded inline-block mt-2">
                      Ref: {selectedCourier.id.slice(0, 8)}
                    </p>
                  )}
                  {selectedCourier && (
                    <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                      {totalPayable > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Total Payable</span>
                          <span className="text-sm font-semibold text-white">{formatCurrency(totalPayable)}</span>
                        </div>
                      )}
                      {totalPaid > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Already Paid</span>
                          <span className="text-sm font-semibold text-green-400">{formatCurrency(totalPaid)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                        <span className="text-xs text-gray-400">Outstanding Balance</span>
                        <span className="text-xl font-bold text-yellow-400">{formatCurrency(outstanding)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Amount */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Payment Amount <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">{currencyLabel}</span>
                    <input
                      type="number"
                      value={amount === 0 ? '' : amount}
                      onChange={handleAmountChange}
                      onFocus={handleAmountFocus}
                      placeholder="0.00"
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg pl-14 pr-4 py-3 text-white text-xl font-bold placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                      min={0}
                      max={outstanding}
                      step="0.01"
                    />
                  </div>
                  {amount > outstanding && (
                    <div className="flex items-center gap-2 mt-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                      <AlertCircle size={14} />
                      <span>Amount cannot exceed outstanding balance</span>
                    </div>
                  )}
                  {amount > 0 && amount <= outstanding && (
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-gray-400">Remaining Balance</span>
                      <span className="text-green-400 font-semibold">{formatCurrency(outstanding - amount)}</span>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Payment Method <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Cash', 'Bank', 'Mobile Wallet'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all ${
                          paymentMethod === method ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                        }`}
                      >
                        {method === 'Cash' && <Wallet size={18} className={paymentMethod === 'Cash' ? 'text-indigo-400' : 'text-gray-400'} />}
                        {method === 'Bank' && <Building2 size={18} className={paymentMethod === 'Bank' ? 'text-indigo-400' : 'text-gray-400'} />}
                        {method === 'Mobile Wallet' && <CreditCard size={18} className={paymentMethod === 'Mobile Wallet' ? 'text-indigo-400' : 'text-gray-400'} />}
                        <span className={`text-xs font-medium ${paymentMethod === method ? 'text-indigo-400' : 'text-gray-400'}`}>
                          {method === 'Mobile Wallet' ? 'Wallet' : method}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select Account */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Select Account <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-2.5 pr-10 text-white focus:outline-none focus:border-indigo-500 appearance-none"
                    >
                      <option value="" className="text-gray-500">
                        {paymentMethod === 'Cash' && 'Select Cash Account'}
                        {paymentMethod === 'Bank' && 'Select Bank Account'}
                        {paymentMethod === 'Mobile Wallet' && 'Select Wallet Account'}
                      </option>
                      {filteredAccounts.map((account) => (
                        <option key={account.id} value={account.id} className="text-white bg-gray-900">
                          {account.name} • Balance: {formatCurrency(account.balance)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  </div>
                  {selectedAccount && (() => {
                    const account = accounting.accounts.find((a) => a.id === selectedAccount);
                    if (account && amount > (account.balance ?? 0)) {
                      return (
                        <div className="flex items-center gap-2 mt-2 text-orange-400 text-xs bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
                          <AlertCircle size={14} />
                          <span>Warning: Amount exceeds account balance</span>
                        </div>
                      );
                    }
                    if (account) {
                      return (
                        <div className="mt-2 text-xs text-gray-400">
                          Selected: <span className="text-white font-medium">{account.name}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">
                {/* Payment Date & Time */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Payment Date & Time <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      type="datetime-local"
                      value={paymentDateTime}
                      onChange={(e) => setPaymentDateTime(e.target.value)}
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Attachments (optional) */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Attachments (Optional)</label>
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-indigo-500 hover:bg-gray-900/50 transition-all text-center">
                      <Upload className="mx-auto mb-2 text-gray-500" size={24} />
                      <p className="text-xs text-gray-400 mb-0.5">
                        <span className="text-indigo-400 font-medium">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-600">PDF, PNG, JPG up to 10MB</p>
                    </div>
                    <input type="file" multiple onChange={handleFileUpload} className="hidden" accept=".pdf,.png,.jpg,.jpeg" />
                  </label>
                  {attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg p-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="text-indigo-400 flex-shrink-0" size={16} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-white font-medium truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => removeAttachment(index)} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Notes (Optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add payment notes, reference, or additional details..."
                    rows={5}
                    className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-5 border-t border-gray-800 bg-gray-950/50">
            <div className="text-xs text-gray-400">
              {attachments.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <FileText size={12} />
                  {attachments.length} file{attachments.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 text-sm" disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[150px] px-5 py-2.5 text-sm font-semibold"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check size={16} />
                    Record Payment
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
