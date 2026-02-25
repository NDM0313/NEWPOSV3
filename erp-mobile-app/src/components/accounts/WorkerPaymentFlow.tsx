import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react';
import type { User } from '../../types';
import { getWorkersWithPayable, getPaymentAccounts, recordWorkerPayment } from '../../api/accounts';

interface WorkerPaymentFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
}

interface Worker {
  id: string;
  name: string;
  phone: string;
  type: string;
  totalPayable: number;
  weeklyRate?: number;
  lastPayment?: string;
}

interface PaymentData {
  worker: Worker | null;
  paymentAccountId: string;
  paymentAccountName: string;
  amount: number;
  date: string;
  workPeriod: string;
  notes: string;
}

const getAccountIcon = (type: string) => (type === 'cash' ? '💵' : type === 'bank' ? '🏦' : '📱');

export function WorkerPaymentFlow({ onBack, onComplete, user, companyId }: WorkerPaymentFlowProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<{ id: string; name: string; balance: number; type: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData>({
    worker: null,
    paymentAccountId: '',
    paymentAccountName: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    workPeriod: '',
    notes: '',
  });

  useEffect(() => {
    if (!companyId) return;
    Promise.all([getWorkersWithPayable(companyId), getPaymentAccounts(companyId)]).then(([wRes, aRes]) => {
      if (wRes.data) setWorkers(wRes.data.map((w) => ({ ...w, type: w.type || 'worker' })));
      if (aRes.data) setPaymentAccounts(aRes.data.map((a) => ({ id: a.id, name: a.name, balance: a.balance, type: a.type })));
    });
  }, [companyId]);

  const workerTypes = [
    { value: 'all', label: 'All Workers', icon: '👥', color: 'bg-[#6B7280]' },
    { value: 'dyer', label: 'Dyer', icon: '🎨', color: 'bg-[#8B5CF6]' },
    { value: 'stitcher', label: 'Stitcher', icon: '🧵', color: 'bg-[#3B82F6]' },
    { value: 'embroidery', label: 'Embroidery', icon: '🌸', color: 'bg-[#EC4899]' },
    { value: 'handwork', label: 'Handwork', icon: '✋', color: 'bg-[#F59E0B]' },
    { value: 'finishing', label: 'Finishing', icon: '✨', color: 'bg-[#10B981]' },
    { value: 'master', label: 'Master', icon: '👑', color: 'bg-[#EF4444]' },
  ];

  const getWorkerTypeLabel = (type: string) => workerTypes.find((t) => t.value === type)?.label || type;
  const getWorkerTypeIcon = (type: string) => workerTypes.find((t) => t.value === type)?.icon || '👤';

  const filteredWorkers = workers.filter((w) => {
    const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) || (w.phone || '').includes(searchQuery);
    const matchesType = filterType === 'all' || w.type === filterType;
    return matchesSearch && matchesType;
  });

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
    if (!companyId || !paymentData.worker || !paymentData.paymentAccountId || paymentData.amount <= 0) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await recordWorkerPayment({
      companyId,
      workerId: paymentData.worker.id,
      amount: paymentData.amount,
      paymentDate: paymentData.date,
      workPeriod: paymentData.workPeriod || undefined,
      notes: paymentData.notes || undefined,
      paymentReference: undefined, // API uses getNextDocumentNumber (PMT-0001 format)
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
        return paymentData.worker !== null;
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
      <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={step === 1 ? onBack : handlePreviousWithReset} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Worker Payment</h1>
            <p className="text-xs text-white/80">Pay workers & vendors</p>
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
              <h2 className="text-sm font-semibold text-white mb-2">Select Worker/Vendor</h2>
              <p className="text-xs text-[#9CA3AF]">Choose worker to pay</p>
            </div>
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
            <div className="flex gap-2 overflow-x-auto pb-2">
              {workerTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFilterType(type.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                    filterType === type.value ? `${type.color} text-white` : 'bg-[#1F2937] text-[#9CA3AF] hover:bg-[#374151]'
                  }`}
                >
                  <span>{type.icon}</span>
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredWorkers.map((worker) => (
                <button
                  key={worker.id}
                  onClick={() => setPaymentData({ ...paymentData, worker, amount: worker.totalPayable })}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    paymentData.worker?.id === worker.id ? 'bg-[#10B981]/20 border-[#10B981]' : 'bg-[#1F2937] border-[#374151] hover:border-[#10B981]/50'
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
                    {paymentData.worker?.id === worker.id && <Check className="text-[#10B981]" size={20} />}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#374151]">
                    <div>
                      <span className="text-xs text-[#9CA3AF]">Outstanding</span>
                      <p className="text-sm font-bold text-[#EF4444]">Rs. {worker.totalPayable.toLocaleString()}</p>
                    </div>
                    {worker.weeklyRate && (
                      <div>
                        <span className="text-xs text-[#9CA3AF]">Weekly Rate</span>
                        <p className="text-sm font-semibold text-white">Rs. {worker.weeklyRate.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                  {worker.lastPayment && <p className="text-xs text-[#6B7280] mt-1">Last payment: {worker.lastPayment}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-3">Payment To</h2>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{paymentData.worker && getWorkerTypeIcon(paymentData.worker.type)}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{paymentData.worker?.name}</p>
                  <p className="text-xs text-[#9CA3AF]">{paymentData.worker && getWorkerTypeLabel(paymentData.worker.type)}</p>
                  <p className="text-xs text-[#6B7280]">{paymentData.worker?.phone}</p>
                </div>
              </div>
              <div className="flex justify-between pt-3 border-t border-[#374151]">
                <span className="text-xs text-[#9CA3AF]">Outstanding Balance</span>
                <span className="text-lg font-bold text-[#EF4444]">Rs. {paymentData.worker?.totalPayable.toLocaleString()}</span>
              </div>
            </div>
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
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Select Payment Account</h3>
              <div className="space-y-2">
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setPaymentData({ ...paymentData, paymentAccountId: account.id, paymentAccountName: account.name })}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                        paymentData.paymentAccountId === account.id ? 'bg-[#10B981]/20 border-[#10B981]' : 'bg-[#1F2937] border-[#374151] hover:border-[#10B981]/50'
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
                        {paymentData.paymentAccountId === account.id && <Check className="text-[#10B981]" size={20} />}
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
                  <span className="text-xs text-[#9CA3AF]">Worker</span>
                  <span className="text-sm text-white font-medium">{paymentData.worker?.name}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#374151]">
                  <span className="text-xs text-[#9CA3AF]">Type</span>
                  <span className="text-sm text-white">{paymentData.worker && getWorkerTypeLabel(paymentData.worker.type)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#374151]">
                  <span className="text-xs text-[#9CA3AF]">Payment Account</span>
                  <span className="text-sm text-white font-medium">{paymentData.paymentAccountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#9CA3AF]">Outstanding</span>
                  <span className="text-sm text-[#EF4444] font-bold">Rs. {paymentData.worker?.totalPayable.toLocaleString()}</span>
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
                className="w-full max-w-full min-w-0 px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-lg font-semibold placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] box-border"
              />
              <div className="flex gap-2 mt-2">
                {paymentData.worker?.weeklyRate && (
                  <button onClick={() => setPaymentData({ ...paymentData, amount: paymentData.worker?.weeklyRate || 0 })} className="px-3 py-1 bg-[#374151] hover:bg-[#4B5563] rounded text-xs text-white transition-colors">
                    Weekly Rate
                  </button>
                )}
                <button onClick={() => setPaymentData({ ...paymentData, amount: paymentData.worker?.totalPayable || 0 })} className="px-3 py-1 bg-[#374151] hover:bg-[#4B5563] rounded text-xs text-white transition-colors">
                  Full Amount
                </button>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-2">Remaining: Rs. {((paymentData.worker?.totalPayable || 0) - paymentData.amount).toLocaleString()}</p>
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Payment Date</label>
              <input type="date" value={paymentData.date} onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })} className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white focus:outline-none focus:border-[#10B981]" />
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Work Period (Optional)</label>
              <input
                type="text"
                value={paymentData.workPeriod}
                onChange={(e) => setPaymentData({ ...paymentData, workPeriod: e.target.value })}
                placeholder="e.g., Week 1-7 Jan, Jan 2026"
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
              />
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Notes (Optional)</label>
              <textarea
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981] resize-none"
              />
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#10B981] rounded-full flex items-center justify-center">
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
          className={`w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-[#10B981] to-[#059669]`}
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
