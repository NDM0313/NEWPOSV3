import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, User } from 'lucide-react';
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
  selectedOrder: _selectedOrder,
  selectedStage,
  companyId,
  onBack,
  onComplete,
}: StudioUpdateStatusViewProps) {
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<studioApi.WorkerRow[]>([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [showAllWorkers, setShowAllWorkers] = useState(false);
  const [workerId, setWorkerId] = useState<string>(selectedStage.workerId ?? '');
  const [expectedDate, setExpectedDate] = useState(selectedStage.expectedDate || '');
  const [expectedCost, setExpectedCost] = useState(selectedStage.internalCost?.toString() ?? '');
  const [finalCost, setFinalCost] = useState(selectedStage.internalCost?.toString() ?? '');
  const isPending = selectedStage.status === 'pending';
  const isAssigned = selectedStage.status === 'assigned';
  const isSentToWorker = selectedStage.status === 'sent_to_worker' || selectedStage.status === 'in-progress';
  const isReceived = selectedStage.status === 'received';
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
    const { error } = await studioApi.assignWorkerToStep(selectedStage.id, {
      worker_id: wid,
      expected_cost: cost,
      expected_completion_date: expectedDate.trim() || null,
      notes: null,
    });
    setLoading(false);
    if (error) {
      alert(error);
      return;
    }
    onComplete();
  };

  const handleSendToWorker = async () => {
    setLoading(true);
    const { error } = await studioApi.sendToWorker(selectedStage.id);
    setLoading(false);
    if (error) {
      alert(error);
      return;
    }
    onComplete();
  };

  const handleReceiveWork = async () => {
    setLoading(true);
    const { error } = await studioApi.receiveWork(selectedStage.id);
    setLoading(false);
    if (error) {
      alert(error);
      return;
    }
    onComplete();
  };

  const handleConfirmPayment = async (payNow: boolean) => {
    const cost = parseFloat(finalCost) || 0;
    if (cost <= 0) {
      alert('Enter final cost');
      return;
    }
    setLoading(true);
    const { error } = await studioApi.confirmStagePayment(selectedStage.id, { final_cost: cost, pay_now: payNow });
    setLoading(false);
    if (error) {
      alert(error);
      return;
    }
    onComplete();
  };

  const handleCompleteStage = async () => {
    setLoading(true);
    const { error } = await studioApi.completeStage(selectedStage.id);
    setLoading(false);
    if (error) {
      alert(error);
      return;
    }
    onComplete();
  };

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

  useEffect(() => {
    if (!isPending) return;
    let cancelled = false;
    (async () => {
      setWorkersLoading(true);
      const stageType = showAllWorkers ? undefined : (selectedStage.type as studioApi.UiStageType);
      const { data } = await studioApi.getWorkers(companyId, { stageType });
      if (!cancelled) {
        setWorkers(data || []);
        setWorkersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, isPending, selectedStage.type, showAllWorkers]);

  const handlePickWorker = (w: studioApi.WorkerRow) => {
    setWorkerId(w.id);
    if ((!expectedCost || parseFloat(expectedCost) <= 0) && w.rate && w.rate > 0) {
      setExpectedCost(String(w.rate));
    }
  };

  const statusLabel = isPending ? 'Pending' : isAssigned ? 'Assigned' : isSentToWorker ? 'In Progress' : isReceived ? 'Received' : 'Completed';
  const title = isPending ? 'Assign Worker' : isAssigned ? 'Send To Worker' : isSentToWorker ? 'Receive Work' : isReceived ? 'Confirm Payment' : 'Reopen Stage';

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">{title}</h1>
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
              <span className="text-white">{expectedDate || selectedStage.expectedDate || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Sent</span>
              <span className="text-white">{selectedStage.sentDate ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Received</span>
              <span className="text-white">{selectedStage.receivedDate ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Status</span>
              <span className="text-[#F59E0B] capitalize">{statusLabel}</span>
            </div>
          </div>
        </div>

        {isPending && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-[#9CA3AF]">
                  Worker
                  {!showAllWorkers && (
                    <span className="ml-2 text-xs text-[#6B7280] capitalize">· {selectedStage.type.replace('-', ' ')} specialists</span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setShowAllWorkers((v) => !v)}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-[#1F2937] border border-[#374151] text-white hover:bg-[#374151] transition-colors"
                >
                  {showAllWorkers ? 'Match stage' : 'Show all'}
                </button>
              </div>
              {workersLoading ? (
                <div className="flex items-center py-4 text-[#9CA3AF] text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading workers…
                </div>
              ) : workers.length === 0 ? (
                <div className="bg-[#1F2937] border border-[#374151] rounded-lg px-4 py-3 text-sm text-[#9CA3AF]">
                  No workers match this stage. Tap "Show all" to see everyone.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {workers.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handlePickWorker(w)}
                      className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                        workerId === w.id
                          ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                          : 'border-[#374151] bg-[#1F2937] hover:border-[#8B5CF6]/50'
                      }`}
                    >
                      <div className="w-9 h-9 bg-[#374151] rounded-full flex items-center justify-center shrink-0">
                        <User size={16} className="text-[#9CA3AF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{w.name}</p>
                        <p className="text-xs text-[#9CA3AF] truncate">
                          {w.workerType ? <span className="capitalize">{String(w.workerType)}</span> : 'Worker'}
                          {w.rate && w.rate > 0 ? <span className="ml-2 text-[#10B981]">· Rs. {w.rate.toLocaleString()}</span> : null}
                        </p>
                      </div>
                      {workerId === w.id && (
                        <div className="w-4 h-4 bg-[#8B5CF6] rounded-full flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-[#9CA3AF] mb-2">Expected Return Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-lg px-4 py-3 text-white"
              />
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
            <p className="text-sm text-[#9CA3AF]">Mark that the item has been sent to the worker.</p>
            <button
              onClick={handleSendToWorker}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Send To Worker
            </button>
          </div>
        )}

        {isSentToWorker && (
          <div className="space-y-4">
            <p className="text-sm text-[#9CA3AF]">Mark that work has been received back from the worker.</p>
            <button
              onClick={handleReceiveWork}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Receive Work
            </button>
          </div>
        )}

        {isReceived && (
          <div className="space-y-4">
            {(selectedStage.internalCost ?? 0) <= 0 ? (
              <>
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
                  onClick={() => handleConfirmPayment(true)}
                  disabled={loading}
                  className="w-full py-3 bg-[#10B981] hover:bg-[#059669] rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Pay Now
                </button>
                <button
                  onClick={() => handleConfirmPayment(false)}
                  disabled={loading}
                  className="w-full py-3 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Pay Later
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-[#9CA3AF]">Payment confirmed. Complete this stage.</p>
                <button
                  onClick={handleCompleteStage}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Complete Stage
                </button>
              </>
            )}
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
