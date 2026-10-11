import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Package, CheckCircle, Clock } from 'lucide-react';
import * as studioApi from '../../api/studio';
import { stageTypeLabel } from './StudioWorkersList';

interface StudioWorkerDetailProps {
  companyId: string;
  workerId: string;
  onBack: () => void;
  onOpenJob: (stageId: string) => void;
}

function statusLabel(status: string): string {
  const st = (status || '').toLowerCase();
  if (st === 'assigned' || st === 'pending') return 'Pending';
  if (st === 'sent_to_worker' || st === 'in_progress' || st === 'received') return 'In Progress';
  if (st === 'completed') return 'Completed';
  return status;
}

export function StudioWorkerDetail({ companyId, workerId, onBack, onOpenJob }: StudioWorkerDetailProps) {
  const [detail, setDetail] = useState<studioApi.StudioWorkerDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await studioApi.getWorkerDetail(companyId, workerId);
    if (err) {
      setError(err);
      setDetail(null);
    } else {
      setDetail(data);
    }
    setLoading(false);
  }, [companyId, workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const w = detail?.worker;

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white truncate">{w?.name ?? 'Worker'}</h1>
            <p className="text-xs text-white/80">Worker details</p>
          </div>
        </div>
        {w && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <p className="text-[10px] text-white/60">Active</p>
              <p className="text-sm font-semibold text-white">{w.activeJobs}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <p className="text-[10px] text-white/60">Pending</p>
              <p className="text-sm font-semibold text-white">{w.pendingJobs}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <p className="text-[10px] text-white/60">Completed</p>
              <p className="text-sm font-semibold text-white">{w.completedJobs}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 text-[#EF4444] text-sm">
            {error}
          </div>
        ) : !detail ? (
          <p className="text-[#9CA3AF] text-sm">Worker not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <p className="text-xs text-[#9CA3AF]">Phone</p>
              <p className="text-white text-sm">{w?.phone || '—'}</p>
              <p className="text-xs text-[#9CA3AF] mt-2">Total earnings (ledger)</p>
              <p className="text-green-400 font-semibold">Rs. {(w?.totalEarnings ?? 0).toLocaleString()}</p>
              {(w?.pendingAmount ?? 0) > 0 && (
                <>
                  <p className="text-xs text-[#9CA3AF] mt-2">Due balance</p>
                  <p className="text-orange-400 font-semibold">Rs. {w!.pendingAmount.toLocaleString()}</p>
                </>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-[#8B5CF6] mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Current jobs ({detail.currentStages.length})
              </h2>
              {detail.currentStages.length === 0 ? (
                <p className="text-xs text-[#6B7280]">No active jobs.</p>
              ) : (
                <div className="space-y-2">
                  {detail.currentStages.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => onOpenJob(job.id)}
                      className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-lg p-3 hover:border-[#8B5CF6]/50"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="text-sm text-white font-medium">
                          {stageTypeLabel[job.stage_type] || job.stage_type}
                        </p>
                        <span className="text-[10px] text-blue-400">{statusLabel(job.status)}</span>
                      </div>
                      <p className="text-xs text-[#9CA3AF] truncate">
                        {job.customer_name || '—'} · {job.production_no || '—'}
                      </p>
                      <p className="text-xs text-[#6B7280] mt-1">Rs. {job.cost.toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-[#8B5CF6] mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Recent completed ({detail.recentCompletedStages.length})
              </h2>
              {detail.recentCompletedStages.length === 0 ? (
                <p className="text-xs text-[#6B7280]">No completed jobs yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.recentCompletedStages.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => onOpenJob(job.id)}
                      className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-lg p-3 hover:border-[#8B5CF6]/50"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="text-sm text-white font-medium">
                          {stageTypeLabel[job.stage_type] || job.stage_type}
                        </p>
                        <Package className="w-4 h-4 text-green-400 shrink-0" />
                      </div>
                      <p className="text-xs text-[#9CA3AF] truncate">
                        {job.customer_name || '—'} · {job.production_no || '—'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
