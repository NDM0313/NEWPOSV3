import { useState, useEffect } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import type { User } from '../../types';
import { getWorkersWithPayable, recordWorkerPayment } from '../../api/accounts';
import {
  MobilePaymentSheet,
  type MobilePaymentSheetSubmitPayload,
  type MobilePaymentSheetSubmitResult,
} from '../shared/MobilePaymentSheet';

interface WorkerPaymentFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
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

const WORKER_TYPES = [
  { value: 'all', label: 'All Workers', icon: '👥', color: 'bg-[#6B7280]' },
  { value: 'dyer', label: 'Dyer', icon: '🎨', color: 'bg-[#8B5CF6]' },
  { value: 'stitcher', label: 'Stitcher', icon: '🧵', color: 'bg-[#3B82F6]' },
  { value: 'embroidery', label: 'Embroidery', icon: '🌸', color: 'bg-[#EC4899]' },
  { value: 'handwork', label: 'Handwork', icon: '✋', color: 'bg-[#F59E0B]' },
  { value: 'finishing', label: 'Finishing', icon: '✨', color: 'bg-[#10B981]' },
  { value: 'master', label: 'Master', icon: '👑', color: 'bg-[#EF4444]' },
];

const getWorkerTypeLabel = (type: string) => WORKER_TYPES.find((t) => t.value === type)?.label || type;
const getWorkerTypeIcon = (type: string) => WORKER_TYPES.find((t) => t.value === type)?.icon || '👤';

export function WorkerPaymentFlow({ onBack, onComplete, user, companyId, branchId, onViewLedger }: WorkerPaymentFlowProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  useEffect(() => {
    if (!companyId) return;
    getWorkersWithPayable(companyId).then((wRes) => {
      if (wRes.data) setWorkers(wRes.data.map((w) => ({ ...w, type: w.type || 'worker' })));
    });
  }, [companyId]);

  const filteredWorkers = workers.filter((w) => {
    const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) || (w.phone || '').includes(searchQuery);
    const matchesType = filterType === 'all' || w.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleSubmit = async (payload: MobilePaymentSheetSubmitPayload): Promise<MobilePaymentSheetSubmitResult> => {
    if (!companyId || !selectedWorker) {
      return { success: false, error: 'Company and worker required.' };
    }
    const methodForApi = payload.method === 'wallet' ? 'mobile_wallet' : payload.method;
    const { data, error } = await recordWorkerPayment({
      companyId,
      branchId: branchId ?? null,
      workerId: selectedWorker.id,
      workerName: selectedWorker.name,
      amount: payload.amount,
      paymentDate: payload.paymentDate,
      paymentAccountId: payload.accountId,
      paymentMethod: methodForApi,
      userId: user.id,
      workPeriod: undefined,
      notes: payload.notes || undefined,
      paymentReference: payload.reference || undefined,
    });
    return {
      success: !error && !!data,
      error: error ?? null,
      paymentId: data?.id ?? null,
      referenceNumber: payload.reference || null,
      partyAccountName: `Worker Payable — ${selectedWorker.name}`,
    };
  };

  if (selectedWorker && companyId) {
    return (
      <MobilePaymentSheet
        mode="pay-worker"
        companyId={companyId}
        branchId={branchId ?? null}
        userId={user.id}
        partyName={selectedWorker.name}
        referenceNo={getWorkerTypeLabel(selectedWorker.type)}
        outstandingAmount={selectedWorker.totalPayable}
        initialAmount={selectedWorker.totalPayable}
        allowOverpayment
        onClose={() => setSelectedWorker(null)}
        onSuccess={onComplete}
        onSubmit={handleSubmit}
        onViewLedger={onViewLedger}
      />
    );
  }

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Worker Payment</h1>
            <p className="text-xs text-white/80">Pay workers & vendors</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
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
          {WORKER_TYPES.map((type) => (
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
          {filteredWorkers.length === 0 ? (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
              <p className="text-sm text-[#9CA3AF]">No workers found</p>
            </div>
          ) : (
            filteredWorkers.map((worker) => (
              <button
                key={worker.id}
                onClick={() => setSelectedWorker(worker)}
                className="w-full p-4 rounded-xl border-2 text-left transition-all bg-[#1F2937] border-[#374151] hover:border-[#10B981]/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="text-2xl shrink-0">{getWorkerTypeIcon(worker.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{worker.name}</p>
                      <p className="text-xs text-[#9CA3AF]">{getWorkerTypeLabel(worker.type)}</p>
                      <p className="text-xs text-[#6B7280] truncate">{worker.phone}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#374151]">
                  <div>
                    <span className="text-xs text-[#9CA3AF]">Outstanding</span>
                    <p className="text-sm font-bold text-[#EF4444]">Rs. {worker.totalPayable.toLocaleString()}</p>
                  </div>
                  {worker.weeklyRate ? (
                    <div>
                      <span className="text-xs text-[#9CA3AF]">Weekly Rate</span>
                      <p className="text-sm font-semibold text-white">Rs. {worker.weeklyRate.toLocaleString()}</p>
                    </div>
                  ) : null}
                </div>
                {worker.lastPayment && <p className="text-xs text-[#6B7280] mt-1">Last payment: {worker.lastPayment}</p>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
