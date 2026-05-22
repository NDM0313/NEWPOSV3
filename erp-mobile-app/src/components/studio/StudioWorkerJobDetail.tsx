import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import * as studioApi from '../../api/studio';
import { StudioStageTimeline } from './StudioStageTimeline';
import { stageTypeLabel } from './StudioWorkersList';

interface StudioWorkerJobDetailProps {
  stageId: string;
  onBack: () => void;
  onOpenOrder?: (saleId: string) => void;
}

export function StudioWorkerJobDetail({ stageId, onBack, onOpenOrder }: StudioWorkerJobDetailProps) {
  const [detail, setDetail] = useState<studioApi.StudioStageJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await studioApi.getStageJobDetail(stageId);
    if (err) {
      setError(err);
      setDetail(null);
    } else {
      setDetail(data);
    }
    setLoading(false);
  }, [stageId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white truncate">Job detail</h1>
            <p className="text-xs text-white/80 truncate">
              {detail?.customer_name ?? '—'} · {detail?.production_no ?? detail?.invoice_no ?? '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 text-[#EF4444] text-sm">{error}</div>
        ) : !detail ? (
          <p className="text-[#9CA3AF] text-sm">Job not found.</p>
        ) : (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <StudioStageTimeline
              stageName={stageTypeLabel[detail.stage_type] || detail.stage_type}
              stageType={detail.stage_type}
              notes={detail.notes}
              assignedAt={detail.assigned_at}
              sentDate={detail.sent_date}
              receivedDate={detail.received_date}
              completedDate={detail.completed_at}
              expectedCost={detail.expected_cost ?? 0}
              workerCost={detail.cost}
              customerCharge={detail.customer_charge ?? 0}
              ledgerPaid={detail.ledger_paid}
              ledgerDue={detail.ledger_due}
            />
            {detail.worker_name ? (
              <p className="text-xs text-[#9CA3AF] mt-3 pt-3 border-t border-[#374151]">
                Worker: <span className="text-white">{detail.worker_name}</span>
              </p>
            ) : null}
            {detail.sale_id && onOpenOrder ? (
              <button
                type="button"
                onClick={() => onOpenOrder(detail.sale_id!)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[#4B5563] text-sm text-[#D1D5DB] hover:border-[#8B5CF6]"
              >
                <ExternalLink className="w-4 h-4" />
                Open studio order
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
