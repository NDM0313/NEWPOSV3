import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react';
import type { User } from '../../types';
import { DateInputField } from '../shared/DateTimePicker';
import {
  getSuppliersWithPayable,
  getPaymentAccounts,
  getPurchasesBySupplier,
  recordSupplierPayment,
  type SupplierWithPayable,
} from '../../api/accounts';

interface SupplierPaymentFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
}

interface PaymentData {
  supplier: SupplierWithPayable | null;
  paymentAccountId: string;
  paymentAccountName: string;
  amount: number;
  date: string;
  reference: string;
  notes: string;
}

const getAccountIcon = (type: string) => (type === 'cash' ? '💵' : type === 'bank' ? '🏦' : '📱');

export function SupplierPaymentFlow({ onBack, onComplete, user, companyId, branchId }: SupplierPaymentFlowProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierWithPayable[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<{ id: string; name: string; balance: number; type: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData>({
    supplier: null,
    paymentAccountId: '',
    paymentAccountName: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  });

  useEffect(() => {
    if (!companyId) return;
    Promise.all([getSuppliersWithPayable(companyId), getPaymentAccounts(companyId)]).then(([sRes, aRes]) => {
      if (sRes.data) setSuppliers(sRes.data.filter((s) => s.totalPayable > 0));
      if (aRes.data) setPaymentAccounts(aRes.data.map((a) => ({ id: a.id, name: a.name, balance: a.balance, type: a.type })));
    });
  }, [companyId]);

  const filteredSuppliers = suppliers.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.phone.includes(searchQuery));
  const filteredAccounts = paymentAccounts.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleStepChange = (newStep: number) => {
    setStep(newStep);
    setSearchQuery('');
  };

  const handleNextWithReset = () => {
    if (step < 3) handleStepChange(step + 1);
  };

  const handlePreviousWithReset = () => {
    if (step > 1) handleStepChange(step - 1);
  };

  const handleSubmit = async () => {
    if (!companyId || !branchId || !paymentData.supplier || !paymentData.paymentAccountId || paymentData.amount <= 0) return;
    setSubmitting(true);
    setError(null);
    const { data: purchases } = await getPurchasesBySupplier(companyId, paymentData.supplier.id);
    const purchase = purchases?.[0];
    if (!purchase) {
      setError('No outstanding purchase found for this supplier.');
      setSubmitting(false);
      return;
    }
    const amount = Math.min(paymentData.amount, purchase.due_amount);
    const paymentMethod = paymentAccounts.find((a) => a.id === paymentData.paymentAccountId)?.type === 'cash' ? 'cash' : 'bank';
    const { error: err } = await recordSupplierPayment({
      companyId,
      branchId,
      purchaseId: purchase.id,
      amount,
      paymentDate: paymentData.date,
      paymentAccountId: paymentData.paymentAccountId,
      paymentMethod: paymentMethod as 'cash' | 'bank',
      reference: paymentData.reference || undefined,
      notes: paymentData.notes || undefined,
      userId: user.id,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    onComplete();
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return paymentData.supplier !== null;
      case 2:
        return paymentData.paymentAccountId !== '';
      case 3:
        return paymentData.amount > 0;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={step === 1 ? onBack : handlePreviousWithReset} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Supplier Payment</h1>
            <p className="text-xs text-white/80">Pay outstanding supplier balances</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>
        <p className="text-xs text-white/80 mt-2">Step {step} of 3</p>
      </div>

      <div className="p-4">
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">Select Supplier</h2>
              <p className="text-xs text-[#9CA3AF]">Choose supplier to pay</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              <input
                type="text"
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
              />
            </div>
            <div className="space-y-2">
              {filteredSuppliers.length === 0 ? (
                <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">No suppliers with outstanding balance</p>
                </div>
              ) : filteredSuppliers.map((supplier) => (
                <button
                  key={supplier.id}
                  onClick={() => setPaymentData({ ...paymentData, supplier, amount: supplier.totalPayable })}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    paymentData.supplier?.id === supplier.id ? 'bg-[#F59E0B]/20 border-[#F59E0B]' : 'bg-[#1F2937] border-[#374151] hover:border-[#F59E0B]/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{supplier.name}</p>
                      <p className="text-xs text-[#9CA3AF]">{supplier.phone}</p>
                    </div>
                    {paymentData.supplier?.id === supplier.id && <Check className="text-[#F59E0B]" size={20} />}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#374151]">
                    <span className="text-xs text-[#9CA3AF]">Outstanding Balance</span>
                    <span className={`text-sm font-bold ${supplier.totalPayable > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>Rs. {supplier.totalPayable.toLocaleString()}</span>
                  </div>
                  {supplier.lastPayment && <p className="text-xs text-[#6B7280] mt-1">Last payment: {supplier.lastPayment}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-3">Payment To</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{paymentData.supplier?.name}</p>
                  <p className="text-xs text-[#9CA3AF]">{paymentData.supplier?.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#9CA3AF]">Outstanding</p>
                  <p className="text-lg font-bold text-[#EF4444]">Rs. {paymentData.supplier?.totalPayable.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Select Payment Account</h3>
              <div className="space-y-2">
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setPaymentData({ ...paymentData, paymentAccountId: account.id, paymentAccountName: account.name })}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                        paymentData.paymentAccountId === account.id ? 'bg-[#F59E0B]/20 border-[#F59E0B]' : 'bg-[#1F2937] border-[#374151] hover:border-[#F59E0B]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getAccountIcon(account.type)}</span>
                          <div>
                            <p className="text-sm font-semibold text-white">{account.name}</p>
                            <p className="text-xs text-[#9CA3AF]">Balance: Rs. {account.balance.toLocaleString()}</p>
                          </div>
                        </div>
                        {paymentData.paymentAccountId === account.id && <Check className="text-[#F59E0B]" size={20} />}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
                    <p className="text-sm text-[#9CA3AF]">No accounts found matching "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {error && <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-sm text-[#EF4444]">{error}</div>}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-3">Payment Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between pb-2 border-b border-[#374151]">
                  <span className="text-xs text-[#9CA3AF]">Supplier</span>
                  <span className="text-sm text-white font-medium">{paymentData.supplier?.name}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#374151]">
                  <span className="text-xs text-[#9CA3AF]">Payment Account</span>
                  <span className="text-sm text-white font-medium">{paymentData.paymentAccountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#9CA3AF]">Outstanding</span>
                  <span className="text-sm text-[#EF4444] font-bold">Rs. {paymentData.supplier?.totalPayable.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Payment Amount (Rs.) *</label>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9.]*"
                min="0"
                step="0.01"
                value={paymentData.amount || ''}
                onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full max-w-full min-w-0 px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-lg font-semibold placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B] box-border"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setPaymentData({ ...paymentData, amount: (paymentData.supplier?.totalPayable || 0) / 2 })} className="px-3 py-1 bg-[#374151] hover:bg-[#4B5563] rounded text-xs text-white transition-colors">
                  50%
                </button>
                <button onClick={() => setPaymentData({ ...paymentData, amount: paymentData.supplier?.totalPayable || 0 })} className="px-3 py-1 bg-[#374151] hover:bg-[#4B5563] rounded text-xs text-white transition-colors">
                  Full Amount
                </button>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-2">Remaining: Rs. {((paymentData.supplier?.totalPayable || 0) - paymentData.amount).toLocaleString()}</p>
            </div>

            <DateInputField label="Payment Date" value={paymentData.date} onChange={(date) => setPaymentData({ ...paymentData, date })} pickerLabel="SELECT PAYMENT DATE" />

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Reference # (Optional)</label>
              <input
                type="text"
                value={paymentData.reference}
                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                placeholder="e.g., Cheque #123, Invoice #456"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
              />
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Notes (Optional)</label>
              <textarea
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B] resize-none"
              />
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#F59E0B] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">{user.name.split(' ').map((n) => n[0]).join('')}</span>
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Added By</p>
                  <p className="text-sm text-white font-medium">{user.name}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60] fixed-bottom-above-nav">
        <button
          onClick={step === 3 ? handleSubmit : handleNextWithReset}
          disabled={!canProceed() || submitting}
          className={`w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all ${
            step === 3 ? 'bg-gradient-to-r from-[#10B981] to-[#059669]' : 'bg-gradient-to-r from-[#F59E0B] to-[#D97706]'
          }`}
        >
          {step === 3 ? (
            <>
              <Check size={18} />
              Confirm Payment
            </>
          ) : (
            <>
              Next
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
