import { CheckCircle2, Loader2, Package, X } from 'lucide-react';
import type { BespokeWorkOrderRow, WorkOrderStockPostStatus } from '../../api/bespokeWorkOrders';

function saleRef(wo: BespokeWorkOrderRow): string {
  return (
    wo.sale?.invoice_no?.trim() ||
    wo.sale?.order_no?.trim() ||
    wo.sale?.customer_name?.trim() ||
    'Sale'
  );
}

export interface WorkOrderDetailSheetProps {
  open: boolean;
  workOrder: BespokeWorkOrderRow | null;
  stock?: WorkOrderStockPostStatus | null;
  busy?: boolean;
  onClose: () => void;
  onComplete?: (woId: string) => void;
  onPostStock?: (woId: string) => void;
}

export function WorkOrderDetailSheet({
  open,
  workOrder,
  stock = null,
  busy = false,
  onClose,
  onComplete,
  onPostStock,
}: WorkOrderDetailSheetProps) {
  if (!open || !workOrder) return null;

  const canComplete = workOrder.status !== 'completed' && workOrder.status !== 'cancelled';
  const needsStock = workOrder.status === 'completed' && stock?.needsStockPost === true;
  const stockOk = workOrder.status === 'completed' && stock && !stock.needsStockPost;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center md:justify-center bg-black/60"
      onClick={() => {
        if (!busy) onClose();
      }}
      role="presentation"
    >
      <div
        className="w-full md:w-[28rem] max-h-[85vh] overflow-y-auto bg-[#111827] rounded-t-2xl md:rounded-2xl border border-[#374151] p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wo-detail-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="wo-detail-title" className="text-base font-semibold text-white">
              {workOrder.work_order_no}
            </h2>
            <p className="mt-1 text-xs text-[#9CA3AF] capitalize">
              {workOrder.status.replace('_', ' ')}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="p-2 rounded-lg bg-[#374151] text-white hover:bg-[#4B5563] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[#9CA3AF]">Sale</dt>
            <dd className="text-white text-right">{saleRef(workOrder)}</dd>
          </div>
          {workOrder.tailor?.name ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[#9CA3AF]">Worker</dt>
              <dd className="text-white text-right">{workOrder.tailor.name}</dd>
            </div>
          ) : null}
          {workOrder.parent_item?.product_name ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[#9CA3AF]">Dress line</dt>
              <dd className="text-white text-right">{workOrder.parent_item.product_name}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-[#9CA3AF]">Production cost</dt>
            <dd className="text-white text-right">
              Rs. {Number(workOrder.production_cost || 0).toLocaleString()}
            </dd>
          </div>
          <div className="flex justify-between gap-3 items-center">
            <dt className="text-[#9CA3AF]">Stock</dt>
            <dd className="text-right">
              {needsStock ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Stock pending
                </span>
              ) : stockOk ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 size={10} /> Stock posted
                </span>
              ) : (
                <span className="text-[#6B7280] text-xs">—</span>
              )}
            </dd>
          </div>
        </dl>

        {(canComplete || needsStock) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {canComplete && onComplete ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onComplete(workOrder.id)}
                className="h-10 px-4 rounded-lg bg-emerald-600/90 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Complete
              </button>
            ) : null}
            {needsStock && onPostStock ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onPostStock(workOrder.id)}
                className="h-10 px-4 rounded-lg border border-amber-500/40 text-amber-300 text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package size={14} />}
                Post stock
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
