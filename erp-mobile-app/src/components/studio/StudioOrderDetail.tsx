import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, CheckCircle, Clock, Package, Banknote, Building2, Wallet, Loader2 } from 'lucide-react';
import type { StudioOrder, StudioStage } from './StudioDashboard';
import { getPaymentAccounts } from '../../api/accounts';
import type { AccountRow } from '../../api/accounts';
import { useLoading } from '../../contexts/LoadingContext';
import { useSingleFlightAction } from '../../hooks/useSingleFlightAction';
import { getTotalInternalProductionCost } from './studioPricing';
import { getStudioDetailStatusLabel } from '../../lib/studioOrderDisplay';
import { todayDateInputValue } from '../../lib/studioWorkflowDates';
import { StudioStageTimeline } from './StudioStageTimeline';

type StudioPayMethod = 'cash' | 'bank' | 'wallet';
const STUDIO_METHOD_TO_TYPE: Record<StudioPayMethod, string[]> = {
  cash: ['cash'],
  bank: ['bank'],
  wallet: ['mobile_wallet'],
};

interface StudioOrderDetailProps {
  order: StudioOrder;
  companyId: string | null;
  onBack: () => void;
  /** Save replica / new design name to studio_productions.design_name (canonical production). */
  onDesignNameSave: (name: string | null) => Promise<void>;
  onAddStage: () => void;
  onEditStage: (stage: StudioStage) => void;
  onDeleteStage?: (stage: StudioStage) => void;
  onUpdateStatus: (stage: StudioStage) => void;
  onSendToWorker?: (stage: StudioStage, sentDate: string, notes?: string | null) => void;
  onReceiveWork?: (stage: StudioStage, receivedDate: string, notes?: string | null) => void;
  onConfirmPayment?: (
    stage: StudioStage,
    params: {
      final_cost: number;
      pay_now: boolean;
      payment_account_id?: string | null;
      notes?: string | null;
      customer_charge?: number | null;
    }
  ) => void;
  onCompleteStage?: (stage: StudioStage) => void;
  onReopen?: (stage: StudioStage) => void;
  onGenerateInvoice: () => void;
  onShipment: () => void;
}

export function StudioOrderDetail({
  order,
  companyId,
  onBack,
  onDesignNameSave,
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
  const [paymentPayStep, setPaymentPayStep] = useState<1 | 2>(1);
  const [paymentPayMethod, setPaymentPayMethod] = useState<StudioPayMethod | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<AccountRow[]>([]);
  const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(false);
  const [paymentAccountsError, setPaymentAccountsError] = useState<string | null>(null);
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentCustomerCharge, setPaymentCustomerCharge] = useState('');
  const [stageDetailSheet, setStageDetailSheet] = useState<StudioStage | null>(null);
  const [workflowDateSheet, setWorkflowDateSheet] = useState<{
    type: 'send' | 'receive';
    stage: StudioStage;
  } | null>(null);
  const [workflowDate, setWorkflowDate] = useState(todayDateInputValue);
  const [workflowNotes, setWorkflowNotes] = useState('');
  const { isLoading } = useLoading();
  const { runSingleFlight, isRunning: isConfirmPaymentRunning } = useSingleFlightAction();

  useEffect(() => {
    if (!paymentDialogStage || !companyId) {
      setPaymentAccounts([]);
      setPaymentAccountsLoading(false);
      setPaymentAccountsError(null);
      return;
    }
    let cancelled = false;
    setPaymentAccountsLoading(true);
    setPaymentAccountsError(null);
    getPaymentAccounts(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setPaymentAccountsLoading(false);
      if (error) setPaymentAccountsError(error);
      else setPaymentAccounts(data || []);
    });
    return () => {
      cancelled = true;
    };
  }, [paymentDialogStage?.id, companyId]);

  const accountsForMethod = useMemo(() => {
    if (!paymentPayMethod) return [];
    const types = STUDIO_METHOD_TO_TYPE[paymentPayMethod].map((t) => t.toLowerCase());
    return paymentAccounts.filter((a) => types.includes((a.type || '').toLowerCase()));
  }, [paymentAccounts, paymentPayMethod]);

  const paymentBusy = paymentSubmitting || isConfirmPaymentRunning;

  const billGenerated = order.customerInvoiceGenerated;
  const structuralLocked = billGenerated;
  const openSettlementDialog = (stage: StudioStage) => {
    const workerPay = stage.expectedCost ?? stage.internalCost ?? stage.customerCharge ?? 0;
    const customer =
      stage.customerCharge > 0 ? stage.customerCharge : workerPay > 0 ? Math.round(workerPay * 1.25) : 0;
    setPaymentFinalCost(workerPay ? String(workerPay) : '');
    setPaymentCustomerCharge(customer ? String(customer) : '');
    setPaymentRemarks('');
    setPaymentPayStep(1);
    setPaymentPayMethod(null);
    setPaymentDialogStage(stage);
  };

  const requestDesignNameEdit = () => {
    if (!structuralLocked) {
      setDesignNameEditing(true);
      setDesignNameInput(order.designName?.trim() ?? '');
      return;
    }
    const ok = window.confirm(
      'Bill generate ho chuka hai. Design name change se invoice/ledger mismatch ho sakta hai. Sirf chhoti spelling fix ke liye continue karein.',
    );
    if (ok) {
      setDesignNameCautionUnlock(true);
      setDesignNameEditing(true);
      setDesignNameInput(order.designName?.trim() ?? '');
    }
  };

  const settlementAmounts = () => {
    const stage = paymentDialogStage;
    const workerPay =
      parseFloat(paymentFinalCost) ||
      (stage?.expectedCost ?? stage?.internalCost ?? stage?.customerCharge ?? 0);
    const customer = parseFloat(paymentCustomerCharge) || 0;
    return { workerPay, customer };
  };

  const postConfirmPayment = async (
    stage: StudioStage,
    params: {
      final_cost: number;
      pay_now: boolean;
      payment_account_id?: string | null;
      notes?: string | null;
      customer_charge?: number | null;
    },
  ) => {
    await runSingleFlight(async () => {
      setPaymentSubmitting(true);
      try {
        await Promise.resolve(onConfirmPayment?.(stage, params));
        setPaymentDialogStage(null);
        setPaymentPayStep(1);
        setPaymentPayMethod(null);
        setPaymentRemarks('');
        setPaymentCustomerCharge('');
      } finally {
        setPaymentSubmitting(false);
      }
    });
  };

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

  const [designNameInput, setDesignNameInput] = useState(() => order.designName?.trim() ?? '');
  const [designNameEditing, setDesignNameEditing] = useState(false);
  const [designNameCautionUnlock, setDesignNameCautionUnlock] = useState(false);
  const [savingDesignName, setSavingDesignName] = useState(false);
  const [designNameSaveOk, setDesignNameSaveOk] = useState(false);

  useEffect(() => {
    setDesignNameInput(order.designName?.trim() ?? '');
    setDesignNameEditing(false);
    setDesignNameCautionUnlock(false);
  }, [order.id, order.designName]);

  const totalInternalCost = useMemo(() => getTotalInternalProductionCost(order), [order]);

  const allStagesCompleted = order.stages.length > 0 && order.stages.every((s) => s.status === 'completed');
  const canGenerateInvoice =
    allStagesCompleted && order.status !== 'shipped' && !order.customerInvoiceGenerated;
  const canProcessShipment =
    allStagesCompleted && order.customerInvoiceGenerated && order.status === 'completed';
  const savedDesignName = Boolean(order.designName?.trim());
  const designNameReadOnly =
    structuralLocked && !designNameCautionUnlock && !designNameEditing;

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white disabled:opacity-50 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white">{order.orderNumber}</h1>
            <p className="text-xs text-white/80">Studio Production Order</p>
            {order.designName?.trim() && (
              <p className="text-xs text-[#E9D5FF] font-medium truncate mt-1">Replica: {order.designName.trim()}</p>
            )}
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
            <p className="text-sm font-semibold text-white">{getStudioDetailStatusLabel(order)}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {structuralLocked && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100 leading-relaxed">
            Bill generate ho chuka hai. Production pipeline aur design name locked hain taake ledger/stock na bigre.
            Invoice update ke liye neeche wala button use karein.
          </div>
        )}

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-[#8B5CF6] mb-3">New design name (replica title)</h2>
          <p className="text-xs text-[#6B7280] mb-2">Name this custom outfit / replica when production is ready to bill—saved with this studio order.</p>
          {savedDesignName && !designNameEditing ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-white flex-1 min-w-0">{order.designName?.trim()}</p>
              <button
                type="button"
                disabled={isLoading}
                onClick={requestDesignNameEdit}
                className="inline-flex items-center justify-center gap-2 shrink-0 px-4 py-2.5 rounded-lg border border-[#8B5CF6] text-[#A78BFA] hover:bg-[#8B5CF6]/10 text-sm font-semibold disabled:opacity-50"
              >
                <Edit2 className="w-4 h-4" />
                {structuralLocked ? 'Edit with caution' : 'Edit'}
              </button>
            </div>
          ) : designNameReadOnly ? (
            <p className="text-sm text-white">{order.designName?.trim() || '—'}</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={designNameInput}
                  onChange={(e) => setDesignNameInput(e.target.value)}
                  placeholder="e.g. Replica — Ivory bridal"
                  readOnly={designNameReadOnly}
                  className="flex-1 bg-[#111827] border border-[#374151] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] disabled:opacity-70"
                />
                <button
                  type="button"
                  disabled={savingDesignName || isLoading}
                  onClick={() => {
                    void (async () => {
                      setSavingDesignName(true);
                      setDesignNameSaveOk(false);
                      try {
                        await onDesignNameSave(designNameInput.trim() || null);
                        setDesignNameSaveOk(true);
                        setDesignNameEditing(false);
                        setTimeout(() => setDesignNameSaveOk(false), 2000);
                      } finally {
                        setSavingDesignName(false);
                      }
                    })();
                  }}
                  className="shrink-0 px-4 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 text-white text-sm font-semibold"
                >
                  {savingDesignName ? 'Saving…' : 'Save name'}
                </button>
              </div>
              {designNameSaveOk && (
                <p className="text-xs text-[#10B981] mt-2 flex items-center gap-1">
                  <CheckCircle size={14} /> Saved
                </p>
              )}
            </>
          )}
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-[#8B5CF6] mb-3">Customer Information</h2>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-[#9CA3AF]">Customer Name</p>
              <p className="text-sm text-white">{order.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Order items (materials / lines)</p>
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
          <p className="text-xs text-[#6B7280] mb-3">
            Internal production costs only. Set profit and billing amount when you generate the invoice.
          </p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <p className="text-sm text-[#9CA3AF]">Total production cost</p>
              <p className="text-sm font-semibold text-[#EF4444]">Rs. {totalInternalCost.toLocaleString()}</p>
            </div>
            {order.stages.length > 0 ? (
              <div className="pt-2 border-t border-[#374151] space-y-2">
                <p className="text-xs font-medium text-[#9CA3AF]">By stage (internal cost)</p>
                {order.stages.map((stage) => (
                  <div key={stage.id} className="flex justify-between gap-2 text-sm">
                    <span className="text-white min-w-0 truncate">{stage.name}</span>
                    <span className="text-[#F87171] font-medium shrink-0">Rs. {stage.internalCost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6B7280] pt-1">Add stages to see a cost breakdown.</p>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Production Pipeline</h2>
            {!structuralLocked && (
              <button
                type="button"
                onClick={onAddStage}
                disabled={isLoading}
                className="p-2 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg transition-colors text-white disabled:opacity-50 disabled:pointer-events-none"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
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
                const canDelete =
                  (stage.status === 'pending' || stage.status === 'assigned') &&
                  !stage.sentDate &&
                  !stage.receivedDate;

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
                        {canDelete && onDeleteStage && !structuralLocked && (
                          <button
                            type="button"
                            onClick={() => onDeleteStage(stage)}
                            disabled={isLoading}
                            className="p-1.5 hover:bg-red-900/30 rounded-lg transition-colors text-red-400 hover:text-red-300 disabled:opacity-40 disabled:pointer-events-none"
                            title="Delete job"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        {stage.status !== 'completed' && !structuralLocked && (
                          <button
                            type="button"
                            onClick={() => onEditStage(stage)}
                            disabled={isLoading}
                            className="p-1.5 hover:bg-[#374151] rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            title="Edit stage"
                          >
                            <Edit2 size={14} className="text-[#9CA3AF]" />
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full text-left rounded-lg border border-[#374151] bg-[#111827]/40 hover:bg-[#111827]/70 px-3 py-2 mb-3 focus:outline-none focus:border-[#6B7280]"
                      onClick={() => setStageDetailSheet(stage)}
                    >
                      {stage.notes?.trim() ? (
                        <p className="text-xs text-[#D1D5DB] mb-2 line-clamp-2 whitespace-pre-wrap leading-snug">
                          {stage.notes}
                        </p>
                      ) : (
                        <p className="text-xs text-[#6B7280] mb-2">Notes / task — tap for full detail</p>
                      )}
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

                      <div className="bg-[#374151] rounded p-2">
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
                    </button>

                    {stage.status !== 'completed' && !structuralLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isLoading) return;
                          if (stepLocked) return;
                          if (!stage.workerId) {
                            onUpdateStatus(stage);
                            return;
                          }
                          if (stage.status === 'assigned' && onSendToWorker) {
                            setWorkflowDate(todayDateInputValue());
                            setWorkflowNotes('');
                            setWorkflowDateSheet({ type: 'send', stage });
                            return;
                          }
                          if ((stage.status === 'sent_to_worker' || stage.status === 'in-progress') && onReceiveWork) {
                            setWorkflowDate(todayDateInputValue());
                            setWorkflowNotes('');
                            setWorkflowDateSheet({ type: 'receive', stage });
                            return;
                          }
                          if (stage.status === 'received') {
                            if ((stage.internalCost ?? 0) <= 0 && onConfirmPayment) {
                              openSettlementDialog(stage);
                              return;
                            }
                            if (onCompleteStage) {
                              onCompleteStage(stage);
                              return;
                            }
                          }
                          onUpdateStatus(stage);
                        }}
                        disabled={stepLocked || isLoading}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                          stepLocked || isLoading
                            ? 'bg-[#374151]/50 text-[#6B7280] cursor-not-allowed'
                            : 'bg-[#374151] hover:bg-[#8B5CF6] text-white'
                        }`}
                      >
                        {isLoading
                          ? 'Please wait…'
                          : stepLocked
                          ? 'Complete previous step first'
                          : !stage.workerId
                            ? 'Assign Worker'
                            : stage.status === 'assigned'
                              ? 'Send To Worker'
                              : stage.status === 'sent_to_worker' || stage.status === 'in-progress'
                                ? 'Receive Work'
                                : stage.status === 'received'
                                  ? (stage.internalCost ?? 0) <= 0
                                    ? 'Worker payment'
                                    : 'Complete Stage'
                                  : 'Update'}
                      </button>
                    )}
                    {stage.status === 'completed' && onReopen && !structuralLocked && (
                      <button
                        type="button"
                        onClick={() => onReopen(stage)}
                        disabled={isLoading}
                        className="w-full py-2 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/50 rounded-lg text-sm font-medium transition-colors text-[#F59E0B] disabled:opacity-50 disabled:pointer-events-none"
                      >
                        Reopen
                      </button>
                    )}
                    {stage.status === 'completed' && !onReopen && !structuralLocked && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(stage)}
                        disabled={isLoading}
                        className="w-full py-2 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/50 rounded-lg text-sm font-medium transition-colors text-[#F59E0B] disabled:opacity-50 disabled:pointer-events-none"
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
          <div className="mb-3">
            <button
              type="button"
              onClick={!isLoading ? onGenerateInvoice : undefined}
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-white bg-gradient-to-r from-[#10B981] to-[#059669] hover:opacity-90 shadow-lg shadow-[#10B981]/20 disabled:opacity-50 disabled:pointer-events-none"
            >
              <CheckCircle size={20} />
              Generate Final Invoice
            </button>
          </div>
        )}

        {billGenerated && (
          <div className="mb-3">
            <button
              type="button"
              onClick={!isLoading ? onGenerateInvoice : undefined}
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-white bg-gradient-to-r from-[#3B82F6] to-[#2563EB] hover:opacity-90 shadow-lg shadow-[#3B82F6]/20 disabled:opacity-50 disabled:pointer-events-none"
            >
              <CheckCircle size={20} />
              View / update invoice
            </button>
          </div>
        )}

        {order.status === 'completed' && !order.customerInvoiceGenerated && (
          <p className="mb-3 text-xs text-[#9CA3AF] leading-relaxed">
            Customer invoice line is not linked yet. On web, add or link the studio sale line on Studio or Sales, then pull to refresh this list.
          </p>
        )}

        {canProcessShipment && (
          <button
            type="button"
            onClick={onShipment}
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-white disabled:opacity-50 disabled:pointer-events-none mb-3"
          >
            <Package size={20} />
            Process Shipment
          </button>
        )}
      </div>

      {stageDetailSheet && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setStageDetailSheet(null)}
        >
          <div
            className="bg-[#1F2937] border border-[#374151] rounded-lg p-4 w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-2 mb-3 border-b border-[#374151] pb-2">
              <div>
                <h3 className="text-base font-semibold text-white">{stageDetailSheet.name}</h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  {getStageStatusConfig(stageDetailSheet.status).text} · {stageDetailSheet.assignedTo}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-[#9CA3AF] hover:text-white shrink-0"
                onClick={() => setStageDetailSheet(null)}
              >
                Close
              </button>
            </div>
            <StudioStageTimeline
              stageName={stageDetailSheet.name}
              stageType={stageDetailSheet.type}
              notes={stageDetailSheet.notes}
              sentDate={stageDetailSheet.sentDate}
              receivedDate={stageDetailSheet.receivedDate}
              completedDate={stageDetailSheet.completedDate}
              expectedCost={stageDetailSheet.expectedCost ?? 0}
              workerCost={stageDetailSheet.internalCost ?? 0}
              customerCharge={stageDetailSheet.customerCharge ?? 0}
            />
          </div>
        </div>
      )}

      {paymentDialogStage && onConfirmPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-[#1F2937] border border-[#374151] rounded-lg p-5 w-full max-w-sm max-h-[90vh] flex flex-col">
            {paymentBusy ? (
              <div
                className="absolute inset-0 z-[60] rounded-lg bg-black/55 flex flex-col items-center justify-center gap-2 pointer-events-auto"
                aria-busy
              >
                <Loader2 className="w-8 h-8 animate-spin text-[#A78BFA]" />
                <span className="text-xs text-[#D1D5DB]">Processing…</span>
              </div>
            ) : null}
            {paymentPayStep === 2 && paymentPayMethod ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentPayStep(1);
                    setPaymentPayMethod(null);
                  }}
                  disabled={paymentBusy}
                  className="flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-white mb-3 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <h3 className="text-lg font-semibold text-white mb-1">Select account</h3>
                <p className="text-sm text-[#9CA3AF] mb-3">
                  {paymentPayMethod === 'cash' ? 'Cash' : paymentPayMethod === 'bank' ? 'Bank' : 'Wallet'} —{' '}
                  {paymentDialogStage.name}
                </p>
                {paymentAccountsLoading ? (
                  <div className="flex items-center justify-center py-12 text-[#9CA3AF] gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm">Loading accounts…</span>
                  </div>
                ) : paymentAccountsError ? (
                  <p className="text-sm text-red-400 py-4">{paymentAccountsError}</p>
                ) : accountsForMethod.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF] py-4">No accounts for this method. Configure chart of accounts.</p>
                ) : (
                  <div className="overflow-y-auto flex-1 min-h-0 space-y-2 mb-3 max-h-[45vh]">
                    {accountsForMethod.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          const { workerPay, customer } = settlementAmounts();
                          if (workerPay <= 0) {
                            alert('Enter worker pay amount');
                            return;
                          }
                          void postConfirmPayment(paymentDialogStage, {
                            final_cost: workerPay,
                            pay_now: true,
                            payment_account_id: a.id,
                            notes: paymentRemarks.trim() || null,
                            customer_charge: customer > 0 ? customer : null,
                          });
                        }}
                        disabled={paymentBusy}
                        className="w-full text-left rounded-lg border border-[#374151] bg-[#111827] px-4 py-3 hover:border-[#8B5CF6] disabled:opacity-50"
                      >
                        <p className="text-white font-medium">{a.name}</p>
                        <p className="text-xs text-[#9CA3AF]">
                          {a.code} · Rs. {(a.balance ?? 0).toLocaleString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white mb-1">Worker settlement</h3>
                <p className="text-sm text-[#9CA3AF] mb-4">
                  {paymentDialogStage.name} – Worker: {paymentDialogStage.assignedTo}
                </p>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Charge customer (Rs)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={paymentCustomerCharge}
                  onChange={(e) => setPaymentCustomerCharge(e.target.value)}
                  placeholder="Amount to bill customer for this task"
                  className="w-full bg-[#374151] border border-[#4B5563] rounded-lg px-4 py-3 text-white text-base mb-3 focus:outline-none focus:border-[#8B5CF6]"
                />
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Pay worker (Rs)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={paymentFinalCost}
                  onChange={(e) => setPaymentFinalCost(e.target.value)}
                  placeholder={String(
                    paymentDialogStage.expectedCost ??
                      paymentDialogStage.internalCost ??
                      paymentDialogStage.customerCharge ??
                      '',
                  )}
                  className="w-full bg-[#374151] border border-[#4B5563] rounded-lg px-4 py-3 text-white text-base mb-3 focus:outline-none focus:border-[#8B5CF6]"
                />
                <label className="block text-sm font-medium text-[#9CA3AF] mb-1">Remarks (optional)</label>
                <textarea
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="Saved as [Payment Remarks] on this stage"
                  rows={2}
                  className="w-full bg-[#374151] border border-[#4B5563] rounded-lg px-3 py-2 text-white text-sm mb-4 resize-none focus:outline-none focus:border-[#8B5CF6]"
                />
                <p className="text-xs text-[#6B7280] mb-3">
                  Pick payment method, then account — posts to GL and worker ledger immediately.
                </p>
                {!companyId ? (
                  <p className="text-xs text-amber-400 mb-3">Company context missing — Pay Now requires account selection.</p>
                ) : null}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      const { workerPay } = settlementAmounts();
                      if (workerPay <= 0) {
                        alert('Enter worker pay amount');
                        return;
                      }
                      if (!companyId) {
                        alert('Company context required to select a payment account.');
                        return;
                      }
                      setPaymentPayMethod('cash');
                      setPaymentPayStep(2);
                    }}
                    disabled={paymentBusy || paymentAccountsLoading}
                    className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-[#10B981]/20 border border-[#10B981]/50 hover:bg-[#10B981]/30 text-[#10B981] disabled:opacity-50"
                  >
                    <Banknote className="w-6 h-6" />
                    <span className="text-xs font-medium">Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const { workerPay } = settlementAmounts();
                      if (workerPay <= 0) {
                        alert('Enter worker pay amount');
                        return;
                      }
                      if (!companyId) {
                        alert('Company context required to select a payment account.');
                        return;
                      }
                      setPaymentPayMethod('bank');
                      setPaymentPayStep(2);
                    }}
                    disabled={paymentBusy || paymentAccountsLoading}
                    className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-[#3B82F6]/20 border border-[#3B82F6]/50 hover:bg-[#3B82F6]/30 text-[#3B82F6] disabled:opacity-50"
                  >
                    <Building2 className="w-6 h-6" />
                    <span className="text-xs font-medium">Bank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const { workerPay } = settlementAmounts();
                      if (workerPay <= 0) {
                        alert('Enter worker pay amount');
                        return;
                      }
                      if (!companyId) {
                        alert('Company context required to select a payment account.');
                        return;
                      }
                      setPaymentPayMethod('wallet');
                      setPaymentPayStep(2);
                    }}
                    disabled={paymentBusy || paymentAccountsLoading}
                    className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/50 hover:bg-[#F59E0B]/30 text-[#F59E0B] disabled:opacity-50"
                  >
                    <Wallet className="w-6 h-6" />
                    <span className="text-xs font-medium">Wallet</span>
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setPaymentDialogStage(null);
                setPaymentPayStep(1);
                setPaymentPayMethod(null);
                setPaymentRemarks('');
                setPaymentCustomerCharge('');
              }}
              disabled={paymentBusy}
              className="w-full py-2 rounded-lg text-sm text-[#9CA3AF] hover:bg-[#374151] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {workflowDateSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#374151] bg-[#1F2937] p-5">
            <h3 className="text-base font-semibold text-white mb-1">
              {workflowDateSheet.type === 'send' ? 'Send to Worker' : 'Receive Work'}
            </h3>
            <p className="text-xs text-[#9CA3AF] mb-4">
              {workflowDateSheet.stage.name} — pick date (default today). Add a note if there are issues to record for the next user.
            </p>
            <label className="block text-sm text-[#9CA3AF] mb-2">
              {workflowDateSheet.type === 'send' ? 'Send date' : 'Receive date'}
            </label>
            <input
              type="date"
              value={workflowDate}
              onChange={(e) => setWorkflowDate(e.target.value)}
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-white mb-3"
            />
            <label className="block text-sm text-[#9CA3AF] mb-2">
              {workflowDateSheet.type === 'send' ? 'Send note (optional)' : 'Receive note (optional)'}
            </label>
            <textarea
              value={workflowNotes}
              onChange={(e) => setWorkflowNotes(e.target.value)}
              placeholder="e.g. damage, delay, quality issue…"
              rows={3}
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-white text-sm mb-4 resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setWorkflowDateSheet(null);
                  setWorkflowNotes('');
                }}
                className="flex-1 py-3 rounded-xl bg-[#374151] text-white text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  const { type, stage } = workflowDateSheet;
                  const notes = workflowNotes.trim() || null;
                  setWorkflowDateSheet(null);
                  setWorkflowNotes('');
                  if (type === 'send') onSendToWorker?.(stage, workflowDate, notes);
                  else onReceiveWork?.(stage, workflowDate, notes);
                }}
                className="flex-1 py-3 rounded-xl bg-[#8B5CF6] text-white text-sm font-semibold disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
