import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import * as studioApi from '../../api/studio';
import type { StudioOrder, StudioStage } from './StudioDashboard';

interface StudioUpdateStatusViewProps {
  selectedOrder: StudioOrder;
  selectedStage: StudioStage;
  companyId: string;
  onBack: () => void;
  onComplete: () => void;
}

export function StudioUpdateStatusView({
  selectedOrder,
  selectedStage,
  companyId,
  onBack,
  onComplete,
}: StudioUpdateStatusViewProps) {
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [workerId, setWorkerId] = useState<string>(selectedStage.workerId ?? '');
  const [expectedCost, setExpectedCost] = useState(selectedStage.internalCost?.toString() ?? '');
  const [finalCost, setFinalCost] = useState(selectedStage.internalCost?.toString() ?? '');
  const isPending = selectedStage.status === 'pending';
  const isAssigned = selectedStage.status === 'assigned' || selectedStage.status === 'in_progress' || selectedStage.status === 'in-progress';
  const isCompleted = selectedStage.status === 'completed';

  const handleAssign = async () => {
    const wid = workerId || selectedStage.workerId;
    const cost = parseFloat(expectedCost) || 0;
    if (!wid) {
      alert('Select a worker');
      return;
    }
    if (cost <= 0) {
      alert('Enter expected cost');
      return;
    }
    setLoading(true);
    const { data, error } = await studioApi.assignWorkerToStep(selectedStage.id, {
      worker_id: wid,
      expected_cost: cost,
      expected_completion_date: selectedStage.expectedDate || null,
      notes: null,
    });
    setLoading(false);
    if (error) {
      alert(error);
      return;
    }
    onComplete();
  };

  const handleReceive = async () => {
    const cost = parseFloat(finalCost) || 0;
    if (cost <= 0) {
      alert('Enter final cost');
      return;
    }
    setLoading(true);
    const { data, error } = await studioApi.receiveStepAndFinalizeCost(selectedStage.id, {
      final_cost: cost,
      notes: null,
    });
    setLoading(false);
    if (error) {
      alert(error);
      return;
    }
    onComplete();
  };

  useEffect(() => {
    if (!isPending) return;
    let cancelled = false;
    (async () => {
      const { data } = await studioApi.getWorkers(companyId);
      if (!cancelled && data) setWorkers(data);
    })();
    return () => { cancelled = true; };
  }, [companyId, isPending]);

  const handleReopen = async () => {
    setLoading(true);
    const { error } = await studioApi.reopenStep(selectedStage.id);
    setLoading(false);
    if (error) {
      alert(error);
      return;
    }
    onComplete();
  };

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">
              {isPending ? 'Assign Worker' : isAssigned ? 'Receive from Worker' : 'Reopen Stage'}
            </h1>
            <p className="text-xs text-white/80">{selectedStage.name}</p>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-white mb-3">{selectedStage.name}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Assigned to</span>
              <span className="text-white">{selectedStage.assignedTo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Expected Date</span>
              <span className="text-white">{selectedStage.expectedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Status</span>
              <span className="text-[#F59E0B] capitalize">
                {isCompleted ? 'Received' : isAssigned ? 'Assigned' : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        {isPending && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-2">Worker</label>
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-4 py-3 text-white"
              >
                <option value="">Select worker</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-2">Expected Cost (Rs)</label>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={expectedCost}
                onChange={(e) => setExpectedCost(e.target.value)}
                placeholder="500"
                className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-4 py-3 text-white"
              />
            </div>
            <button
              onClick={handleAssign}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Assign & Save
            </button>
          </div>
        )}

        {isAssigned && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-2">Final Cost (Rs)</label>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={finalCost}
                onChange={(e) => setFinalCost(e.target.value)}
                placeholder={selectedStage.internalCost?.toString() || '500'}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-4 py-3 text-white"
              />
            </div>
            <button
              onClick={handleReceive}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Receive & Finalize
            </button>
          </div>
        )}

        {isCompleted && (
          <div className="space-y-4">
            <p className="text-sm text-[#9CA3AF]">Reopen this stage to edit. Accounting entry will be reversed.</p>
            <button
              onClick={handleReopen}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#F59E0B] to-[#D97706] rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Reopen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
