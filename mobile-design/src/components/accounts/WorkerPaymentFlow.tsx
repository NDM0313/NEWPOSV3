import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react';
import { User } from '../../App';

interface WorkerPaymentFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
}

interface Worker {
  id: string;
  name: string;
  phone: string;
  type: 'dyer' | 'stitcher' | 'embroidery' | 'handwork' | 'finishing' | 'master';
  totalPayable: number;
  weeklyRate?: number;
  lastPayment?: string;
}

interface PaymentData {
  worker: Worker | null;
  paymentAccount: string;
  amount: number;
  date: string;
  workPeriod: string;
  notes: string;
}

export function WorkerPaymentFlow({ onBack, onComplete, user }: WorkerPaymentFlowProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | Worker['type']>('all');
  const [paymentData, setPaymentData] = useState<PaymentData>({
    worker: null,
    paymentAccount: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    workPeriod: '',
    notes: '',
  });

  // Mock workers/vendors
  const workers: Worker[] = [
    { id: '1', name: 'Master Ali', phone: '+92 300 1234567', type: 'dyer', totalPayable: 15000, weeklyRate: 12000, lastPayment: '2026-01-12' },
    { id: '2', name: 'Faisal Ahmed', phone: '+92 321 9876543', type: 'stitcher', totalPayable: 25000, weeklyRate: 20000, lastPayment: '2026-01-10' },
    { id: '3', name: 'Ayesha Khan', phone: '+92 333 5555555', type: 'embroidery', totalPayable: 18000, weeklyRate: 15000 },
    { id: '4', name: 'Sana Bibi', phone: '+92 345 7777777', type: 'handwork', totalPayable: 12000, weeklyRate: 10000, lastPayment: '2026-01-15' },
    { id: '5', name: 'Usman Tailor', phone: '+92 301 8888888', type: 'finishing', totalPayable: 8000, weeklyRate: 7000 },
    { id: '6', name: 'Rizwan Master', phone: '+92 312 9999999', type: 'master', totalPayable: 30000, weeklyRate: 25000, lastPayment: '2026-01-08' },
  ];

  const paymentAccounts = [
    { id: '1', name: 'Cash Account', balance: 450000, icon: '💵' },
    { id: '2', name: 'Bank Account - HBL', balance: 850000, icon: '🏦' },
    { id: '3', name: 'JazzCash Wallet', balance: 25000, icon: '📱' },
  ];

  const workerTypes = [
    { value: 'all', label: 'All Workers', icon: '👥', color: 'bg-[#6B7280]' },
    { value: 'dyer', label: 'Dyer', icon: '🎨', color: 'bg-[#8B5CF6]' },
    { value: 'stitcher', label: 'Stitcher', icon: '🧵', color: 'bg-[#3B82F6]' },
    { value: 'embroidery', label: 'Embroidery', icon: '🌸', color: 'bg-[#EC4899]' },
    { value: 'handwork', label: 'Handwork', icon: '✋', color: 'bg-[#F59E0B]' },
    { value: 'finishing', label: 'Finishing', icon: '✨', color: 'bg-[#10B981]' },
    { value: 'master', label: 'Master', icon: '👑', color: 'bg-[#EF4444]' },
  ];

  const getWorkerTypeLabel = (type: Worker['type']) => {
    return workerTypes.find(t => t.value === type)?.label || type;
  };

  const getWorkerTypeIcon = (type: Worker['type']) => {
    return workerTypes.find(t => t.value === type)?.icon || '👤';
  };

  const filteredWorkers = workers.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) || w.phone.includes(searchQuery);
    const matchesType = filterType === 'all' || w.type === filterType;
    return matchesSearch && matchesType;
  });

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
    console.log('Worker Payment:', {
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
        return paymentData.worker !== null;
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
      <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={step === 1 ? onBack : handlePreviousWithReset}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">Worker Payment</h1>
            <p className="text-xs text-white/80">Pay workers & vendors</p>
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
        {/* Step 1: Select Worker */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">Select Worker/Vendor</h2>
              <p className="text-xs text-[#9CA3AF]">Choose worker to pay</p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              <input
                type="text"
                placeholder="Search workers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
              />
            </div>

            {/* Type Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {workerTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFilterType(type.value as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                    filterType === type.value
                      ? `${type.color} text-white`
                      : 'bg-[#1F2937] text-[#9CA3AF] hover:bg-[#374151]'
                  }`}
                >
                  <span>{type.icon}</span>
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>

            {/* Workers List */}
            <div className="space-y-2">
              {filteredWorkers.map((worker) => (
                <button
                  key={worker.id}
                  onClick={() => setPaymentData({ 
                    ...paymentData, 
                    worker,
                    amount: worker.totalPayable
                  })}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    paymentData.worker?.id === worker.id
                      ? 'bg-[#10B981]/20 border-[#10B981]'
                      : 'bg-[#1F2937] border-[#374151] hover:border-[#10B981]/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-2xl">{getWorkerTypeIcon(worker.type)}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{worker.name}</p>
                        <p className="text-xs text-[#9CA3AF]">{getWorkerTypeLabel(worker.type)}</p>
                        <p className="text-xs text-[#6B7280]">{worker.phone}</p>
                      </div>
                    </div>
                    {paymentData.worker?.id === worker.id && (
                      <Check className="text-[#10B981]" size={20} />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#374151]">
                    <div>
                      <span className="text-xs text-[#9CA3AF]">Outstanding</span>
                      <p className="text-sm font-bold text-[#EF4444]">
                        Rs. {worker.totalPayable.toLocaleString()}
                      </p>
                    </div>
                    {worker.weeklyRate && (
                      <div>
                        <span className="text-xs text-[#9CA3AF]">Weekly Rate</span>
                        <p className="text-sm font-semibold text-white">
                          Rs. {worker.weeklyRate.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                  {worker.lastPayment && (
                    <p className="text-xs text-[#6B7280] mt-1">Last payment: {worker.lastPayment}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Payment Account */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Worker Info */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-3">Payment To</h2>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{getWorkerTypeIcon(paymentData.worker!.type)}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{paymentData.worker?.name}</p>
                  <p className="text-xs text-[#9CA3AF]">{getWorkerTypeLabel(paymentData.worker!.type)}</p>
                  <p className="text-xs text-[#6B7280]">{paymentData.worker?.phone}</p>
                </div>
              </div>
              <div className="flex justify-between pt-3 border-t border-[#374151]">
                <span className="text-xs text-[#9CA3AF]">Outstanding Balance</span>
                <span className="text-lg font-bold text-[#EF4444]">
                  Rs. {paymentData.worker?.totalPayable.toLocaleString()}
                </span>
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
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20"
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
                          ? 'bg-[#10B981]/20 border-[#10B981]'
                          : 'bg-[#1F2937] border-[#374151] hover:border-[#10B981]/50'
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
                          <Check className="text-[#10B981]" size={20} />
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
            {/* Worker & Account Summary */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-3">Payment Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between pb-2 border-b border-[#374151]">
                  <span className="text-xs text-[#9CA3AF]">Worker</span>
                  <span className="text-sm text-white font-medium">{paymentData.worker?.name}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#374151]">
                  <span className="text-xs text-[#9CA3AF]">Type</span>
                  <span className="text-sm text-white">{getWorkerTypeLabel(paymentData.worker!.type)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#374151]">
                  <span className="text-xs text-[#9CA3AF]">Payment Account</span>
                  <span className="text-sm text-white font-medium">{paymentData.paymentAccount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#9CA3AF]">Outstanding</span>
                  <span className="text-sm text-[#EF4444] font-bold">
                    Rs. {paymentData.worker?.totalPayable.toLocaleString()}
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
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-lg font-semibold placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
              />
              <div className="flex gap-2 mt-2">
                {paymentData.worker?.weeklyRate && (
                  <button
                    onClick={() => setPaymentData({ ...paymentData, amount: paymentData.worker?.weeklyRate || 0 })}
                    className="px-3 py-1 bg-[#374151] hover:bg-[#4B5563] rounded text-xs text-white transition-colors"
                  >
                    Weekly Rate
                  </button>
                )}
                <button
                  onClick={() => setPaymentData({ ...paymentData, amount: paymentData.worker?.totalPayable || 0 })}
                  className="px-3 py-1 bg-[#374151] hover:bg-[#4B5563] rounded text-xs text-white transition-colors"
                >
                  Full Amount
                </button>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-2">
                Remaining: Rs. {((paymentData.worker?.totalPayable || 0) - paymentData.amount).toLocaleString()}
              </p>
            </div>

            {/* Date */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Payment Date
              </label>
              <input
                type="date"
                value={paymentData.date}
                onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white focus:outline-none focus:border-[#10B981]"
              />
            </div>

            {/* Work Period */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Work Period (Optional)
              </label>
              <input
                type="text"
                value={paymentData.workPeriod}
                onChange={(e) => setPaymentData({ ...paymentData, workPeriod: e.target.value })}
                placeholder="e.g., Week 1-7 Jan, Jan 2026"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
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
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] resize-none"
              />
            </div>

            {/* User Info */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#10B981] rounded-full flex items-center justify-center">
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
              : 'bg-gradient-to-r from-[#10B981] to-[#059669]'
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