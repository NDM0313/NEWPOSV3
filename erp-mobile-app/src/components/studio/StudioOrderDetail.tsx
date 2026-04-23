import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, CheckCircle, Clock, Package, Banknote, Building2, Wallet, Percent, Save } from 'lucide-react';
import type { StudioOrder, StudioStage } from './StudioDashboard';
import * as studioApi from '../../api/studio';
import { useLoading } from '../../contexts/LoadingContext';

const PROFIT_PCT_KEY_PREFIX = 'studio:profitPct:';

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
  const { withLoading } = useLoading();

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
  const totalStageCustomerCharge = order.stages.reduce((sum, stage) => sum + stage.customerCharge, 0);

  const profitKey = `${PROFIT_PCT_KEY_PREFIX}${order.id}`;
  const [profitPctStr, setProfitPctStr] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(profitKey);
      if (saved !== null) return saved;
    } catch { /* ignore */ }
    return '25';
  });
  const [serverProfitPct, setServerProfitPct] = useState<string | null>(null);
  const [savingProfit, setSavingProfit] = useState(false);
  const [profitSaveOk, setProfitSaveOk] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(profitKey, profitPctStr);
    } catch { /* ignore */ }
  }, [profitKey, profitPctStr]);

  // Load server-persisted profit % on mount.
  useEffect(() => {
    let cancelled = false;
    void studioApi
      .loadProductionProfitMargin(order.id)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const v = String(Number.isFinite(data.value) ? data.value : 25);
        setServerProfitPct(v);
        setProfitPctStr((cur) => {
          try {
            const stored = localStorage.getItem(profitKey);
            if (stored !== null) return cur;
          } catch { /* ignore */ }
          return v;
        });
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const profitDirty = serverProfitPct !== null && serverProfitPct !== profitPctStr;

  const saveProfitToServer = async () => {
    const n = parseFloat(profitPctStr);
    if (!Number.isFinite(n) || savingProfit) return;
    setSavingProfit(true);
    setProfitSaveOk(false);
    const { error } = await withLoading('Saving profit...', () =>
      studioApi.saveProductionProfitMargin(order.id, 'percentage', n),
    );
    setSavingProfit(false);
    if (!error) {
      setServerProfitPct(profitPctStr);
      setProfitSaveOk(true);
      setTimeout(() => setProfitSaveOk(false), 1800);
    }
  };

  const profitPct = useMemo(() => {
    const n = parseFloat(profitPctStr);
    return Number.isFinite(n) ? n : 0;
  }, [profitPctStr]);

  const suggestedCustomerCharge = Math.round(totalInternalCost * (1 + profitPct / 100));
  const effectiveCustomerCharge = totalStageCustomerCharge > 0 ? totalStageCustomerCharge : suggestedCustomerCharge;
  const profitMargin = effectiveCustomerCharge - totalInternalCost;
  const effectiveMarginPct = totalInternalCost > 0 ? (profitMargin / totalInternalCost) * 100 : 0;

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
              <p className="text-sm text-[#9CA3AF]">Production Cost</p>
              <p className="text-sm font-semibold text-[#EF4444]">Rs. {totalInternalCost.toLocaleString()}</p>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-sm text-[#9CA3AF] flex items-center gap-1">
                <Percent className="w-3.5 h-3.5" />
                Profit %
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={profitPctStr}
                  onChange={(e) => setProfitPctStr(e.target.value)}
                  placeholder="25"
                  className="w-20 text-right bg-[#111827] border border-[#374151] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#8B5CF6]"
                />
                <span className="text-sm text-[#9CA3AF]">%</span>
              </div>
            </div>
            <div className="flex justify-between pt-1">
              <p className="text-sm text-[#9CA3AF]">Suggested Customer Charge</p>
              <p className="text-sm font-semibold text-[#10B981]">Rs. {suggestedCustomerCharge.toLocaleString()}</p>
            </div>
            {totalStageCustomerCharge > 0 && totalStageCustomerCharge !== suggestedCustomerCharge && (
              <div className="flex justify-between">
                <p className="text-xs text-[#6B7280]">Stage charges sum</p>
                <p className="text-xs text-[#9CA3AF]">Rs. {totalStageCustomerCharge.toLocaleString()}</p>
              </div>
            )}
            <div className="pt-2 border-t border-[#374151] flex justify-between items-center">
              <p className="text-sm font-semibold text-white">Profit Margin</p>
              <div className="text-right">
                <p className={`text-sm font-bold ${profitMargin >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  Rs. {profitMargin.toLocaleString()}
                </p>
                {totalInternalCost > 0 && (
                  <p className={`text-xs ${profitMargin >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {effectiveMarginPct.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
            <p className="text-[10px] text-[#6B7280] pt-1">
              Customer Charge = Production Cost × (1 + Profit% / 100). Stage-level charges override when present.
            </p>

            {(profitDirty || profitSaveOk) && (
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs">
                  {profitSaveOk ? (
                    <>
                      <CheckCircle size={14} className="text-[#10B981]" />
                      <span className="text-[#10B981]">Saved to server</span>
                    </>
                  ) : (
                    <>
                      <span className="inline-block w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                      <span className="text-[#F59E0B]">Unsaved profit change</span>
                    </>
                  )}
                </div>
                {profitDirty && (
                  <button
                    type="button"
                    onClick={() => void saveProfitToServer()}
                    disabled={savingProfit}
                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 text-white text-xs font-semibold"
                  >
                    <Save size={13} />
                    {savingProfit ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            )}
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
                        <p className="text-sm text-white">{stage.name}</p>
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
                          if ((stage.status === 'sent_to_worker' || stage.status === 'in-progress') && onReceiveWork) {
                            onReceiveWork(stage);
                            return;
                          }
                          if (stage.status === 'received') {
                            if ((stage.internalCost ?? 0) <= 0 && onConfirmPayment) {
                              const assignedAmount = stage.expectedCost ?? stage.internalCost ?? stage.customerCharge ?? 0;
                              setPaymentFinalCost(assignedAmount ? String(assignedAmount) : '');
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
                              : stage.status === 'sent_to_worker' || stage.status === 'in-progress'
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

        {order.status !== 'completed' && order.status !== 'shipped' && (
          <div className="mb-3">
            <button
              onClick={canGenerateInvoice ? onGenerateInvoice : undefined}
              disabled={!canGenerateInvoice}
              className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-white ${
                canGenerateInvoice
                  ? 'bg-gradient-to-r from-[#10B981] to-[#059669] hover:opacity-90 shadow-lg shadow-[#10B981]/20'
                  : 'bg-[#374151] cursor-not-allowed opacity-70'
              }`}
            >
              <CheckCircle size={20} />
              Generate Final Invoice
            </button>
            {!canGenerateInvoice && order.stages.length > 0 && (
              <p className="mt-2 text-xs text-[#F59E0B] flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                Complete all production stages to unlock billing
                {(() => {
                  const remaining = order.stages.filter((s) => s.status !== 'completed').length;
                  return remaining > 0 ? ` (${remaining} pending)` : '';
                })()}
              </p>
            )}
            {!canGenerateInvoice && order.stages.length === 0 && (
              <p className="mt-2 text-xs text-[#F59E0B]">Add production stages first</p>
            )}
          </div>
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
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-1">Confirm Payment</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">{paymentDialogStage.name} – Worker: {paymentDialogStage.assignedTo}</p>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Final Cost (Rs)</label>
            <input
              type="number"
              inputMode="decimal"
              value={paymentFinalCost}
              onChange={(e) => setPaymentFinalCost(e.target.value)}
              placeholder={String(paymentDialogStage.expectedCost ?? paymentDialogStage.internalCost ?? paymentDialogStage.customerCharge ?? '')}
              className="w-full bg-[#374151] border border-[#4B5563] rounded-lg px-4 py-3 text-white text-base mb-4 focus:outline-none focus:border-[#8B5CF6]"
            />
            <p className="text-xs text-[#6B7280] mb-3">Payment method (Pay Now) or record as Pay Later</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={async () => {
                  const cost = parseFloat(paymentFinalCost) || (paymentDialogStage.expectedCost ?? paymentDialogStage.internalCost ?? paymentDialogStage.customerCharge ?? 0);
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
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-[#10B981]/20 border border-[#10B981]/50 hover:bg-[#10B981]/30 text-[#10B981] disabled:opacity-50"
              >
                <Banknote className="w-6 h-6" />
                <span className="text-xs font-medium">Cash</span>
              </button>
              <button
                onClick={async () => {
                  const cost = parseFloat(paymentFinalCost) || (paymentDialogStage.expectedCost ?? paymentDialogStage.internalCost ?? paymentDialogStage.customerCharge ?? 0);
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
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-[#3B82F6]/20 border border-[#3B82F6]/50 hover:bg-[#3B82F6]/30 text-[#3B82F6] disabled:opacity-50"
              >
                <Building2 className="w-6 h-6" />
                <span className="text-xs font-medium">Bank</span>
              </button>
              <button
                onClick={async () => {
                  const cost = parseFloat(paymentFinalCost) || (paymentDialogStage.expectedCost ?? paymentDialogStage.internalCost ?? paymentDialogStage.customerCharge ?? 0);
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
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/50 hover:bg-[#F59E0B]/30 text-[#F59E0B] disabled:opacity-50"
              >
                <Wallet className="w-6 h-6" />
                <span className="text-xs font-medium">Wallet</span>
              </button>
            </div>
            <button
              onClick={async () => {
                const cost = parseFloat(paymentFinalCost) || (paymentDialogStage.expectedCost ?? paymentDialogStage.internalCost ?? paymentDialogStage.customerCharge ?? 0);
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
              className="w-full py-3 rounded-xl text-sm font-medium bg-[#374151] hover:bg-[#4B5563] text-white mb-2 disabled:opacity-50"
            >
              Pay Later (record in ledger)
            </button>
            <button
              onClick={() => setPaymentDialogStage(null)}
              className="w-full py-2 rounded-lg text-sm text-[#9CA3AF] hover:bg-[#374151]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
