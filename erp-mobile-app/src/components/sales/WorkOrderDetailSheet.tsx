import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Package, Pencil, X } from 'lucide-react';
import type { BespokeWorkOrderRow, WorkOrderStockPostStatus } from '../../api/bespokeWorkOrders';
import { ConfirmActionSheet } from '../common/ConfirmActionSheet';

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
  workers?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onComplete?: (woId: string) => void;
  onPostStock?: (woId: string) => void;
  onSaveEdit?: (params: {
    workOrderId: string;
    tailorContactId: string;
    productionCost: number;
    notes: string;
  }) => void | Promise<void>;
  onCancelWorkOrder?: (woId: string) => void | Promise<void>;
}

export function WorkOrderDetailSheet({
  open,
  workOrder,
  stock = null,
  busy = false,
  workers = [],
  onClose,
  onComplete,
  onPostStock,
  onSaveEdit,
  onCancelWorkOrder,
}: WorkOrderDetailSheetProps) {
  const [editing, setEditing] = useState(false);
  const [tailorId, setTailorId] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !workOrder) {
      setEditing(false);
      setConfirmCancel(false);
      setEditError(null);
      return;
    }
    setTailorId(workOrder.tailor_contact_id || workOrder.tailor?.id || '');
    setCost(String(Number(workOrder.production_cost) || ''));
    setNotes(workOrder.notes ?? '');
    setEditing(false);
    setConfirmCancel(false);
    setEditError(null);
  }, [open, workOrder]);

  if (!open || !workOrder) return null;

  const cancelled = workOrder.status === 'cancelled';
  const canComplete = workOrder.status !== 'completed' && !cancelled;
  const needsStock = workOrder.status === 'completed' && stock?.needsStockPost === true;
  const stockOk = workOrder.status === 'completed' && stock && !stock.needsStockPost;
  const canEdit = !cancelled && !!onSaveEdit;
  const canCancel = !cancelled && !!onCancelWorkOrder;

  const handleSave = async () => {
    if (!onSaveEdit) return;
    const productionCost = parseFloat(cost) || 0;
    if (!tailorId) {
      setEditError('Select a worker.');
      return;
    }
    if (productionCost <= 0) {
      setEditError('Production cost must be greater than 0.');
      return;
    }
    setEditError(null);
    await onSaveEdit({
      workOrderId: workOrder.id,
      tailorContactId: tailorId,
      productionCost,
      notes,
    });
    setEditing(false);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-end md:items-center md:justify-center bg-black/60"
        onClick={() => {
          if (!busy && !confirmCancel) onClose();
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

          {editing ? (
            <div className="space-y-3">
              {editError ? <p className="text-xs text-red-400">{editError}</p> : null}
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Worker</label>
                <select
                  value={tailorId}
                  onChange={(e) => setTailorId(e.target.value)}
                  className="w-full h-10 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white px-2"
                >
                  {workers.length === 0 ? (
                    <option value={tailorId}>{workOrder.tailor?.name || 'Current worker'}</option>
                  ) : (
                    workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Production cost</label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full h-10 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white px-2"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg text-sm text-white px-2 py-2"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                  className="flex-1 h-10 rounded-lg border border-gray-700 text-gray-300 text-sm font-medium"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSave()}
                  className="flex-1 h-10 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
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
                {workOrder.notes ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#9CA3AF]">Notes</dt>
                    <dd className="text-white text-right text-xs whitespace-pre-wrap">{workOrder.notes}</dd>
                  </div>
                ) : null}
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

              {!cancelled && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditing(true)}
                      className="h-10 px-4 rounded-lg border border-violet-500/40 text-violet-300 text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                  ) : null}
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
                  {canCancel ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmCancel(true)}
                      className="h-10 px-4 rounded-lg border border-red-500/40 text-red-300 text-sm font-semibold disabled:opacity-50"
                    >
                      Cancel WO
                    </button>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmActionSheet
        open={confirmCancel}
        title="Cancel work order?"
        description={`${workOrder.work_order_no} will be cancelled. Stock will be reversed and the production journal entry voided. It stays in the list as Cancelled.`}
        confirmLabel="Yes, cancel"
        cancelLabel="Keep"
        busy={busy}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          void onCancelWorkOrder?.(workOrder.id);
        }}
      />
    </>
  );
}
