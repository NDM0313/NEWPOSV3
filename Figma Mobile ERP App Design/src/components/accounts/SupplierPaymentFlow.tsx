import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Search, Calendar } from 'lucide-react';
import { User } from '../../App';
import { DateInputField } from '../shared/DateTimePicker';

interface SupplierPaymentFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
  totalPayable: number;
  lastPayment?: string;
}

interface PaymentData {
  supplier: Supplier | null;
  paymentAccount: string;
  amount: number;
  date: string;
  reference: string;
  notes: string;
}

export function SupplierPaymentFlow({ onBack, onComplete, user }: SupplierPaymentFlowProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentData, setPaymentData] = useState<PaymentData>({
    supplier: null,
    paymentAccount: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  });

  // Mock suppliers
  const suppliers: Supplier[] = [
    { id: '1', name: 'Sana Textiles', phone: '+92 300 1234567', totalPayable: 125000, lastPayment: '2026-01-10' },
    { id: '2', name: 'Al-Karam Fabrics', phone: '+92 321 9876543', totalPayable: 85000, lastPayment: '2026-01-15' },
    { id: '3', name: 'Gul Ahmed Supplies', phone: '+92 333 5555555', totalPayable: 50000 },
    { id: '4', name: 'Nishat Mills', phone: '+92 301 7777777', totalPayable: 200000, lastPayment: '2026-01-05' },
    { id: '5', name: 'Sapphire Wholesale', phone: '+92 345 8888888', totalPayable: 0 },
  ];

  const paymentAccounts = [
    { id: '1', name: 'Cash Account', balance: 450000, icon: '💵' },
    { id: '2', name: 'Bank Account - HBL', balance: 850000, icon: '🏦' },
    { id: '3', name: 'Bank Account - MCB', balance: 400000, icon: '🏦' },
  ];

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone.includes(searchQuery)
  );

  const filteredAccounts = paymentAccounts.filter(account =>
    account.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset search when changing steps
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

  const handleSubmit = () => {
    console.log('Supplier Payment:', {
      ...paymentData,
      addedBy: user.name,
      addedByRole: user.role,
      createdAt: new Date().toISOString(),
    });
    onComplete();
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return paymentData.supplier !== null;
      case 2:
        return paymentData.paymentAccount !== '';
      case 3:
        return paymentData.amount > 0;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={step === 1 ? onBack : handlePreviousWithReset}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">Supplier Payment</h1>
            <p className="text-xs text-white/80">Pay outstanding supplier balances</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${
                s <= step ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-white/80 mt-2">Step {step} of 3</p>
      </div>

      <div className="p-4">
        {/* Step 1: Select Supplier */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">Select Supplier</h2>
              <p className="text-xs text-[#9CA3AF]">Choose supplier to pay</p>
            </div>

            {/* Search */}
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

            {/* Suppliers List */}
            <div className="space-y-2">
              {filteredSuppliers.map((supplier) => (
                <button
                  key={supplier.id}
                  onClick={() => setPaymentData({ 
                    ...paymentData, 
                    supplier,
                    amount: supplier.totalPayable
                  })}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    paymentData.supplier?.id === supplier.id
                      ? 'bg-[#F59E0B]/20 border-[#F59E0B]'
                      : 'bg-[#1F2937] border-[#374151] hover:border-[#F59E0B]/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{supplier.name}</p>
                      <p className="text-xs text-[#9CA3AF]">{supplier.phone}</p>
                    </div>
                    {paymentData.supplier?.id === supplier.id && (
                      <Check className="text-[#F59E0B]" size={20} />
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#374151]">
                    <span className="text-xs text-[#9CA3AF]">Outstanding Balance</span>
                    <span className={`text-sm font-bold ${supplier.totalPayable > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                      Rs. {supplier.totalPayable.toLocaleString()}
                    </span>
                  </div>
                  {supplier.lastPayment && (
                    <p className="text-xs text-[#6B7280] mt-1">Last payment: {supplier.lastPayment}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Payment Account */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Supplier Info */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-3">Payment To</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{paymentData.supplier?.name}</p>
                  <p className="text-xs text-[#9CA3AF]">{paymentData.supplier?.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#9CA3AF]">Outstanding</p>
                  <p className="text-lg font-bold text-[#EF4444]">
                    Rs. {paymentData.supplier?.totalPayable.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Search Bar */}
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

            {/* Payment Account Selection */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Select Payment Account</h3>
              <div className="space-y-2">
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setPaymentData({ ...paymentData, paymentAccount: account.name })}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                        paymentData.paymentAccount === account.name
                          ? 'bg-[#F59E0B]/20 border-[#F59E0B]'
                          : 'bg-[#1F2937] border-[#374151] hover:border-[#F59E0B]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{account.icon}</span>
                          <div>
                            <p className="text-sm font-semibold text-white">{account.name}</p>
                            <p className="text-xs text-[#9CA3AF]">Balance: Rs. {account.balance.toLocaleString()}</p>
                          </div>
                        </div>
                        {paymentData.paymentAccount === account.name && (
                          <Check className="text-[#F59E0B]" size={20} />
                        )}
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

        {/* Step 3: Amount & Details */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Supplier & Account Summary */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-3">Payment Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between pb-2 border-b border-[#374151]">
                  <span className="text-xs text-[#9CA3AF]">Supplier</span>
                  <span className="text-sm text-white font-medium">{paymentData.supplier?.name}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#374151]">
                  <span className="text-xs text-[#9CA3AF]">Payment Account</span>
                  <span className="text-sm text-white font-medium">{paymentData.paymentAccount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#9CA3AF]">Outstanding</span>
                  <span className="text-sm text-[#EF4444] font-bold">
                    Rs. {paymentData.supplier?.totalPayable.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Payment Amount (Rs.) *
              </label>
              <input
                type="number"
                value={paymentData.amount || ''}
                onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-lg font-semibold placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setPaymentData({ ...paymentData, amount: (paymentData.supplier?.totalPayable || 0) / 2 })}
                  className="px-3 py-1 bg-[#374151] hover:bg-[#4B5563] rounded text-xs text-white transition-colors"
                >
                  50%
                </button>
                <button
                  onClick={() => setPaymentData({ ...paymentData, amount: paymentData.supplier?.totalPayable || 0 })}
                  className="px-3 py-1 bg-[#374151] hover:bg-[#4B5563] rounded text-xs text-white transition-colors"
                >
                  Full Amount
                </button>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-2">
                Remaining: Rs. {((paymentData.supplier?.totalPayable || 0) - paymentData.amount).toLocaleString()}
              </p>
            </div>

            {/* Date */}
            <DateInputField
              label="Payment Date"
              value={paymentData.date}
              onChange={(date) => setPaymentData({ ...paymentData, date })}
              pickerLabel="SELECT PAYMENT DATE"
            />

            {/* Reference */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Reference # (Optional)
              </label>
              <input
                type="text"
                value={paymentData.reference}
                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                placeholder="e.g., Cheque #123, Invoice #456"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
              />
            </div>

            {/* Notes */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B] resize-none"
              />
            </div>

            {/* User Info */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#F59E0B] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </span>
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

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60]">
        <button
          onClick={step === 3 ? handleSubmit : handleNextWithReset}
          disabled={!canProceed()}
          className={`w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all ${
            step === 3
              ? 'bg-gradient-to-r from-[#10B981] to-[#059669]'
              : 'bg-gradient-to-r from-[#F59E0B] to-[#D97706]'
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