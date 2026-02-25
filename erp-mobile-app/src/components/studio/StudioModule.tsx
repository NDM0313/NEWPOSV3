import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import type { User, Branch } from '../../types';
import * as studioApi from '../../api/studio';
import { StudioDashboard, type StudioOrder, type StudioStage } from './StudioDashboard';
import { StudioOrderDetail } from './StudioOrderDetail';
import { StudioStageAssignment } from './StudioStageAssignment';
import { StudioUpdateStatusView } from './StudioUpdateStatusView';

interface StudioModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branch: Branch | null;
  onNewStudioSale?: () => void;
}

type View =
  | 'dashboard'
  | 'order-detail'
  | 'add-stage'
  | 'edit-stage'
  | 'update-status'
  | 'invoice'
  | 'shipment';

function mapProductionToOrder(
  prod: studioApi.StudioProductionRow,
  stages: studioApi.StudioStageRow[]
): StudioOrder {
  const sale = prod.sale as { customer_name?: string; total?: number; invoice_no?: string; invoice_date?: string } | undefined;
  const product = prod.product as { name?: string } | undefined;
  const completedCount = stages.filter((s) => s.status === 'completed').length;
  // CRITICAL: Only consider assigned when worker exists. status=assigned/in_progress + worker null = invalid; treat as pending.
  const inProgress = stages.find((s) => {
    if (s.status !== 'in_progress' && s.status !== 'assigned') return false;
    if (!s.assigned_worker_id) {
      console.warn('[StudioModule] Invalid state: stage', s.id, 'status=', s.status, 'but assigned_worker_id is null. Forcing pending.');
      return false;
    }
    return true;
  });
  const allDone = stages.length > 0 && stages.every((s) => s.status === 'completed');

  let status: StudioOrder['status'] = 'pending';
  if (prod.status === 'completed') status = 'completed';
  else if (allDone) status = 'ready';
  else if (prod.status === 'in_progress' || inProgress) status = 'in-progress';

  const mappedStages: StudioStage[] = stages.map((s) => {
    const worker = s.worker as { id?: string; name?: string } | undefined;
    const cost = Number(s.expected_cost ?? s.cost) || 0;
    // Force pending when status says assigned/in_progress but no worker (invalid state)
    const effectiveStatus =
      s.status === 'completed'
        ? 'completed'
        : s.assigned_worker_id && (s.status === 'assigned' || s.status === 'in_progress')
          ? s.status
          : 'pending';
    return {
      id: s.id,
      name: s.stage_type === 'dyer' ? 'Dyeing' : s.stage_type === 'stitching' ? 'Stitching' : 'Handwork',
      type: s.stage_type === 'dyer' ? 'dyeing' : s.stage_type === 'stitching' ? 'stitching' : 'handwork',
      assignedTo: worker?.name ?? 'Unassigned',
      workerId: s.assigned_worker_id ?? undefined,
      internalCost: cost,
      customerCharge: cost,
      expectedDate: s.expected_completion_date ?? '',
      status: effectiveStatus,
      startedDate: effectiveStatus !== 'pending' ? s.expected_completion_date ?? undefined : undefined,
      completedDate: s.completed_at ? new Date(s.completed_at).toISOString().slice(0, 10) : undefined,
    };
  });

  return {
    id: prod.id,
    orderNumber: sale?.invoice_no ?? prod.production_no,
    customerName: sale?.customer_name ?? '—',
    productName: product?.name ?? '—',
    totalAmount: Number(sale?.total ?? prod.product ? 0 : 0) || 0,
    createdDate: prod.production_date ? new Date(prod.production_date).toISOString().slice(0, 10) : '—',
    status,
    currentStage: allDone ? 'Ready for Invoice' : inProgress ? (inProgress.stage_type === 'dyer' ? 'Dyeing' : inProgress.stage_type === 'stitching' ? 'Stitching' : 'Handwork') : 'Not Started',
    stages: mappedStages,
    completedStages: completedCount,
    totalStages: stages.length,
  };
}

export function StudioModule({ onBack, companyId, branch, onNewStudioSale }: StudioModuleProps) {
  const [view, setView] = useState<View>('dashboard');
  const [selectedOrder, setSelectedOrder] = useState<StudioOrder | null>(null);
  const [selectedStage, setSelectedStage] = useState<StudioStage | null>(null);
  const [orders, setOrders] = useState<StudioOrder[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [error, setError] = useState<string | null>(null);

  const effectiveBranchId = branch?.id && branch.id !== 'all' ? branch.id : null;

  const loadOrders = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data: prods, error: prodErr } = await studioApi.getStudioProductions(companyId, effectiveBranchId ?? undefined);
    if (prodErr) {
      setError(prodErr);
      setOrders([]);
      setLoading(false);
      return;
    }
    const ordersList: StudioOrder[] = [];
    for (const p of prods || []) {
      const { data: stages } = await studioApi.getStudioStages(p.id);
      ordersList.push(mapProductionToOrder(p, stages || []));
    }
    setOrders(ordersList);
    setLoading(false);
  }, [companyId, effectiveBranchId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  if (view === 'dashboard') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h1 className="font-semibold text-white">Studio Production</h1>
                <p className="text-xs text-white/80">Production pipeline management</p>
              </div>
            </div>
            <button
              onClick={() => onNewStudioSale?.()}
              className="flex items-center gap-2 px-3 py-2.5 bg-white text-[#7C3AED] hover:bg-white/90 rounded-lg font-medium text-sm shadow-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add
            </button>
          </div>
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
          ) : (
            <StudioDashboard
              orders={orders}
              onOrderClick={(order) => {
                setSelectedOrder(order);
                setView('order-detail');
              }}
            />
          )}
        </div>
      </div>
    );
  }

  if (view === 'order-detail' && selectedOrder) {
    return (
      <StudioOrderDetail
        order={selectedOrder}
        onBack={() => {
          setView('dashboard');
          setSelectedOrder(null);
          loadOrders();
        }}
        onAddStage={() => {
          setSelectedStage(null);
          setView('add-stage');
        }}
        onEditStage={(stage) => {
          setSelectedStage(stage);
          setView('edit-stage');
        }}
        onDeleteStage={async (stage) => {
          if (!confirm('Remove this job from the production pipeline?')) return;
          const { error } = await studioApi.deleteStudioStage(stage.id);
          if (error) {
            alert(error);
            return;
          }
          const newStages = selectedOrder.stages.filter((s) => s.id !== stage.id);
          setSelectedOrder({
            ...selectedOrder,
            stages: newStages,
            totalStages: newStages.length,
            completedStages: newStages.filter((s) => s.status === 'completed').length,
          });
        }}
        onUpdateStatus={(stage) => {
          setSelectedStage(stage);
          setView('update-status');
        }}
        onGenerateInvoice={() => setView('invoice')}
        onShipment={() => setView('shipment')}
      />
    );
  }

  if ((view === 'add-stage' || view === 'edit-stage') && selectedOrder && companyId) {
    return (
      <StudioStageAssignment
        companyId={companyId}
        onBack={() => setView('order-detail')}
        onComplete={async (stageData) => {
          if (view === 'add-stage') {
            const { data, error: err } = await studioApi.createStudioStage(selectedOrder.id, {
              stage_type: stageData.type ?? 'handwork',
              assigned_worker_id: null,
              cost: 0,
              expected_completion_date: stageData.expectedDate || null,
            });
            if (err) {
              alert(err);
              return;
            }
            if (data) {
              const newStage: StudioStage = {
                id: data.id,
                name: stageData.name ?? 'Stage',
                type: stageData.type ?? 'handwork',
                assignedTo: stageData.assignedTo ?? 'Unassigned',
                workerId: stageData.workerId,
                internalCost: stageData.internalCost ?? 0,
                customerCharge: stageData.customerCharge ?? 0,
                expectedDate: stageData.expectedDate ?? '',
                status: 'pending',
              };
              setSelectedOrder({
                ...selectedOrder,
                stages: [...selectedOrder.stages, newStage],
                totalStages: selectedOrder.totalStages + 1,
                status: selectedOrder.status === 'pending' ? 'in-progress' : selectedOrder.status,
              });
            }
          } else if (view === 'edit-stage' && selectedStage) {
            const internalCostVal = stageData.internalCost ?? selectedStage.internalCost ?? 0;
            const { error: err } = await studioApi.updateStudioStage(selectedStage.id, {
              cost: internalCostVal,
              expected_cost: internalCostVal,
              assigned_worker_id: stageData.workerId ?? selectedStage.workerId ?? null,
              expected_completion_date: stageData.expectedDate || null,
            });
            if (err) {
              alert(err);
              return;
            }
            setSelectedOrder({
              ...selectedOrder,
              stages: selectedOrder.stages.map((s) =>
                    s.id === selectedStage.id
                  ? {
                      ...s,
                      ...stageData,
                      internalCost: stageData.internalCost ?? selectedStage.internalCost ?? s.internalCost,
                      customerCharge: stageData.customerCharge ?? s.customerCharge,
                      expectedDate: stageData.expectedDate ?? s.expectedDate,
                      assignedTo: stageData.assignedTo ?? s.assignedTo,
                      workerId: stageData.workerId ?? s.workerId,
                    }
                  : s
              ),
            });
          }
          setView('order-detail');
        }}
        existingStage={selectedStage || undefined}
      />
    );
  }

  if (view === 'update-status' && selectedOrder && selectedStage && companyId) {
    return (
      <StudioUpdateStatusView
        selectedOrder={selectedOrder}
        selectedStage={selectedStage}
        companyId={companyId}
        onBack={() => setView('order-detail')}
        onComplete={async () => {
          await loadOrders();
          setView('order-detail');
          setSelectedStage(null);
          const updated = (await studioApi.getStudioProductions(companyId, effectiveBranchId ?? undefined)).data?.find((p) => p.id === selectedOrder.id);
          if (updated) {
            const { data: stages } = await studioApi.getStudioStages(updated.id);
            setSelectedOrder(mapProductionToOrder(updated, stages || []));
          }
        }}
      />
    );
  }

  if (view === 'invoice' && selectedOrder) {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('order-detail')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">Generate Invoice</h1>
              <p className="text-xs text-white/80">{selectedOrder.orderNumber}</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 mb-4">
            <h2 className="text-lg font-bold text-white mb-4">Studio Invoice</h2>
            <div className="space-y-3 mb-4 pb-4 border-b border-[#374151]">
              <p className="text-sm">
                <span className="text-[#9CA3AF]">Customer:</span>{' '}
                <span className="text-white font-medium">{selectedOrder.customerName}</span>
              </p>
              <p className="text-sm">
                <span className="text-[#9CA3AF]">Product:</span>{' '}
                <span className="text-white">{selectedOrder.productName}</span>
              </p>
            </div>
            <div className="space-y-2 mb-4">
              <h3 className="text-sm font-semibold text-[#8B5CF6] mb-2">Service Charges:</h3>
              {selectedOrder.stages.map((stage) => (
                <div key={stage.id} className="flex justify-between text-sm">
                  <span className="text-[#9CA3AF]">{stage.name}</span>
                  <span className="text-white font-medium">Rs. {stage.customerCharge.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-[#374151]">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-white">Total Amount</span>
                <span className="text-2xl font-bold text-[#10B981]">
                  Rs.{' '}
                  {selectedOrder.stages
                    .reduce((sum, s) => sum + s.customerCharge, 0)
                    .toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              studioApi.updateStudioProductionStatus(selectedOrder.id, 'completed').then(({ error: err }) => {
                if (err) alert(err);
                else {
                  alert('Invoice generated successfully!');
                  loadOrders();
                  setView('order-detail');
                }
              });
            }}
            className="w-full py-4 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl font-semibold text-white"
          >
            Confirm & Generate Invoice
          </button>
        </div>
      </div>
    );
  }

  if (view === 'shipment' && selectedOrder) {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('order-detail')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">Process Shipment</h1>
              <p className="text-xs text-white/80">{selectedOrder.orderNumber}</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
            <p className="text-center text-[#9CA3AF] py-8">Shipment flow coming soon...</p>
          </div>
          <button
            onClick={() => {
              setView('dashboard');
              setSelectedOrder(null);
              loadOrders();
            }}
            className="w-full py-4 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] rounded-xl font-semibold text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}
