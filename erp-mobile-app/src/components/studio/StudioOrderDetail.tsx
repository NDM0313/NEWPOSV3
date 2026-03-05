import { useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, CheckCircle, Clock, Package } from 'lucide-react';
import type { StudioOrder, StudioStage } from './StudioDashboard';

interface StudioOrderDetailProps {
  order: StudioOrder;
  onBack: () => void;
  onAddStage: () => void;
  onEditStage: (stage: StudioStage) => void;
  onDeleteStage?: (stage: StudioStage) => void;
  onUpdateStatus: (stage: StudioStage) => void;
  onSendToWorker?: (stage: StudioStage) => void;
  onReceiveWork?: (stage: StudioStage) => void;
  onConfirmPayment?: (stage: StudioStage, params: { final_cost: number; pay_now: boolean }) => void;
  onCompleteStage?: (stage: StudioStage) => void;
  onReopen?: (stage: StudioStage) => void;
  onGenerateInvoice: () => void;
  onShipment: () => void;
}

export function StudioOrderDetail({
  order,
  onBack,
  onAddStage,
  onEditStage,
  onDeleteStage,
  onUpdateStatus,
  onSendToWorker,
  onReceiveWork,
  onConfirmPayment,
  onCompleteStage,
  onReopen,
  onGenerateInvoice,
  onShipment,
}: StudioOrderDetailProps) {
  const [paymentDialogStage, setPaymentDialogStage] = useState<StudioStage | null>(null);
  const [paymentFinalCost, setPaymentFinalCost] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const getStageStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#F59E0B', bg: 'bg-[#F59E0B]/10', text: 'Pending', icon: Clock };
      case 'assigned':
        return { color: '#3B82F6', bg: 'bg-[#3B82F6]/10', text: 'Assigned', icon: Package };
      case 'in-progress':
      case 'in_progress':
      case 'sent_to_worker':
        return { color: '#3B82F6', bg: 'bg-[#3B82F6]/10', text: 'In Progress', icon: Package };
      case 'received':
        return { color: '#10B981', bg: 'bg-[#10B981]/10', text: 'Received', icon: CheckCircle };
      case 'completed':
        return { color: '#10B981', bg: 'bg-[#10B981]/10', text: 'Completed', icon: CheckCircle };
      default:
        return { color: '#9CA3AF', bg: 'bg-[#374151]', text: 'Pending', icon: Clock };
    }
  };

  const getStageIcon = (type: string) => {
    const icons: Record<string, string> = {
      dyeing: '🎨',
      stitching: '🧵',
      handwork: '✋',
      embroidery: '🌸',
      finishing: '✨',
      'quality-check': '✓',
      dyer: '🎨',
    };
    return icons[type] ?? '📦';
  };

  const totalInternalCost = order.stages.reduce((sum, stage) => sum + stage.internalCost, 0);
  const totalCustomerCharge = order.stages.reduce((sum, stage) => sum + stage.customerCharge, 0);
  const profitMargin = totalCustomerCharge - totalInternalCost;

  const allStagesCompleted = order.stages.length > 0 && order.stages.every((s) => s.status === 'completed');
  const canGenerateInvoice = allStagesCompleted && order.status !== 'completed' && order.status !== 'shipped';

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">{order.orderNumber}</h1>
            <p className="text-xs text-white/80">Studio Production Order</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-xs text-white/60">Stages</p>
            <p className="text-sm font-semibold text-white">
              {order.completedStages}/{order.totalStages}
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-xs text-white/60">Progress</p>
            <p className="text-sm font-semibold text-white">
              {order.totalStages > 0 ? Math.round((order.completedStages / order.totalStages) * 100) : 0}%
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-xs text-white/60">Status</p>
            <p className="text-sm font-semibold text-white capitalize">{order.status.replace('-', ' ')}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-[#8B5CF6] mb-3">Customer Information</h2>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-[#9CA3AF]">Customer Name</p>
              <p className="text-sm text-white">{order.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Product</p>
              <p className="text-sm text-white">{order.productName}</p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Order Date</p>
              <p className="text-sm text-white">{order.createdDate}</p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Total Amount</p>
              <p className="text-lg font-bold text-white">Rs. {order.totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-[#8B5CF6] mb-3">Cost Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <p className="text-sm text-[#9CA3AF]">Internal Cost</p>
              <p className="text-sm font-semibold text-[#EF4444]">Rs. {totalInternalCost.toLocaleString()}</p>
            </div>
            <div className="flex justify-between">
              <p className="text-sm text-[#9CA3AF]">Customer Charge</p>
              <p className="text-sm font-semibold text-[#10B981]">Rs. {totalCustomerCharge.toLocaleString()}</p>
            </div>
            <div className="pt-2 border-t border-[#374151] flex justify-between">
              <p className="text-sm font-semibold text-white">Profit Margin</p>
              <p
                className={`text-sm font-bold ${profitMargin >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}
              >
                Rs. {profitMargin.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Production Pipeline</h2>
            <button
              onClick={onAddStage}
              className="p-2 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg transition-colors text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {order.stages.length === 0 ? (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-3">
                <Package className="w-8 h-8 text-[#6B7280]" />
              </div>
              <p className="text-[#9CA3AF] mb-1">No stages added yet</p>
              <p className="text-xs text-[#6B7280]">Add production stages to start the workflow</p>
            </div>
          ) : (
            <div className="space-y-3">
              {order.stages.map((stage, index) => {
                const statusConfig = getStageStatusConfig(stage.status);
                const StatusIcon = statusConfig.icon;
                const prevStage = order.stages[index - 1];
                const prevCompleted = !prevStage || prevStage.status === 'completed';
                const stepLocked = !prevCompleted;
                const canDelete = stage.status === 'pending' && stage.assignedTo === 'Unassigned';

                return (
                  <div key={stage.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-[#374151] rounded-lg flex items-center justify-center text-xl">
                          {getStageIcon(stage.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-white">{stage.name}</p>
                            <span
                              className={`px-2 py-0.5 ${statusConfig.bg} rounded-full text-xs font-medium flex items-center gap-1`}
                              style={{ color: statusConfig.color }}
                            >
                              <StatusIcon size={10} />
                              {statusConfig.text}
                            </span>
                          </div>
                          <p className="text-xs text-[#9CA3AF]">Assigned to: {stage.assignedTo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {canDelete && onDeleteStage && (
                          <button
                            onClick={() => onDeleteStage(stage)}
                            className="p-1.5 hover:bg-red-900/30 rounded-lg transition-colors text-red-400 hover:text-red-300"
                            title="Delete job"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        {stage.status !== 'completed' && (
                          <button
                            onClick={() => onEditStage(stage)}
                            className="p-1.5 hover:bg-[#374151] rounded-lg transition-colors"
                            title="Edit stage"
                          >
                            <Edit2 size={14} className="text-[#9CA3AF]" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-[#9CA3AF]">Internal Cost</p>
                        <p className="text-sm font-semibold text-[#EF4444]">
                          Rs. {stage.internalCost.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#9CA3AF]">Customer Charge</p>
                        <p className="text-sm font-semibold text-[#10B981]">
                          Rs. {stage.customerCharge.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#9CA3AF]">Expected Date</p>
                        <p className="text-sm text-white">{stage.expectedDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#9CA3AF]">Type</p>
                        <p className="text-sm text-white capitalize">{stage.type.replace('-', ' ')}</p>
                      </div>
                    </div>

                    <div className="bg-[#374151] rounded-lg p-2 mb-3">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-[#9CA3AF]">Sent</p>
                          <p className="text-white">{stage.sentDate ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-[#9CA3AF]">Received</p>
                          <p className="text-white">{stage.receivedDate ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-[#9CA3AF]">Completed</p>
                          <p className="text-white">{stage.completedDate ?? '—'}</p>
                        </div>
                      </div>
                    </div>

                    {stage.status !== 'completed' && (
                      <button
                        onClick={() => {
                          if (stepLocked) return;
                          if (!stage.workerId) {
                            onUpdateStatus(stage);
                            return;
                          }
                          if (stage.status === 'assigned' && onSendToWorker) {
                            onSendToWorker(stage);
                            return;
                          }
                          if ((stage.status === 'sent_to_worker' || stage.status === 'in_progress' || stage.status === 'in-progress') && onReceiveWork) {
                            onReceiveWork(stage);
                            return;
                          }
                          if (stage.status === 'received') {
                            if ((stage.internalCost ?? 0) <= 0 && onConfirmPayment) {
                              setPaymentFinalCost(String(stage.internalCost || stage.customerCharge || ''));
                              setPaymentDialogStage(stage);
                              return;
                            }
                            if (onCompleteStage) {
                              onCompleteStage(stage);
                              return;
                            }
                          }
                          onUpdateStatus(stage);
                        }}
                        disabled={stepLocked}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                          stepLocked
                            ? 'bg-[#374151]/50 text-[#6B7280] cursor-not-allowed'
                            : 'bg-[#374151] hover:bg-[#8B5CF6] text-white'
                        }`}
                      >
                        {stepLocked
                          ? 'Complete previous step first'
                          : !stage.workerId
                            ? 'Assign Worker'
                            : stage.status === 'assigned'
                              ? 'Send To Worker'
                              : stage.status === 'sent_to_worker' || stage.status === 'in_progress' || stage.status === 'in-progress'
                                ? 'Receive Work'
                                : stage.status === 'received'
                                  ? (stage.internalCost ?? 0) <= 0
                                    ? 'Confirm Payment'
                                    : 'Complete Stage'
                                  : 'Update'}
                      </button>
                    )}
                    {stage.status === 'completed' && onReopen && (
                      <button
                        onClick={() => onReopen(stage)}
                        className="w-full py-2 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/50 rounded-lg text-sm font-medium transition-colors text-[#F59E0B]"
                      >
                        Reopen
                      </button>
                    )}
                    {stage.status === 'completed' && !onReopen && (
                      <button
                        onClick={() => onUpdateStatus(stage)}
                        className="w-full py-2 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/50 rounded-lg text-sm font-medium transition-colors text-[#F59E0B]"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {canGenerateInvoice && (
          <button
            onClick={onGenerateInvoice}
            className="w-full mb-3 py-3 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-white"
          >
            <CheckCircle size={20} />
            Generate Final Invoice
          </button>
        )}

        {order.status === 'completed' && (
          <button
            onClick={onShipment}
            className="w-full py-3 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-white"
          >
            <Package size={20} />
            Process Shipment
          </button>
        )}
      </div>

      {paymentDialogStage && onConfirmPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-white mb-3">Confirm Payment</h3>
            <p className="text-sm text-[#9CA3AF] mb-2">{paymentDialogStage.name} – Worker: {paymentDialogStage.assignedTo}</p>
            <label className="block text-sm text-[#9CA3AF] mb-1">Final Cost (Rs)</label>
            <input
              type="number"
              inputMode="decimal"
              value={paymentFinalCost}
              onChange={(e) => setPaymentFinalCost(e.target.value)}
              placeholder={String(paymentDialogStage.internalCost || '')}
              className="w-full bg-[#374151] border border-[#4B5563] rounded-lg px-3 py-2 text-white mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const cost = parseFloat(paymentFinalCost) || paymentDialogStage.internalCost || 0;
                  if (cost <= 0) {
                    alert('Enter final cost');
                    return;
                  }
                  setPaymentSubmitting(true);
                  try {
                    await Promise.resolve(onConfirmPayment(paymentDialogStage, { final_cost: cost, pay_now: true }));
                    setPaymentDialogStage(null);
                  } finally {
                    setPaymentSubmitting(false);
                  }
                }}
                disabled={paymentSubmitting}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#10B981] hover:bg-[#059669] text-white"
              >
                Pay Now
              </button>
              <button
                onClick={async () => {
                  const cost = parseFloat(paymentFinalCost) || paymentDialogStage.internalCost || 0;
                  if (cost <= 0) {
                    alert('Enter final cost');
                    return;
                  }
                  setPaymentSubmitting(true);
                  try {
                    await Promise.resolve(onConfirmPayment(paymentDialogStage, { final_cost: cost, pay_now: false }));
                    setPaymentDialogStage(null);
                  } finally {
                    setPaymentSubmitting(false);
                  }
                }}
                disabled={paymentSubmitting}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#3B82F6] hover:bg-[#2563EB] text-white"
              >
                Pay Later
              </button>
            </div>
            <button
              onClick={() => setPaymentDialogStage(null)}
              className="w-full mt-2 py-2 rounded-lg text-sm text-[#9CA3AF] hover:bg-[#374151]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
