import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Loader2, Sparkles, Percent, Search, Save, CheckCircle } from 'lucide-react';
import type { User, Branch } from '../../types';
import * as studioApi from '../../api/studio';
import * as studioInvoiceApi from '../../api/studioInvoiceLine';
import type { StudioInvoiceProductRow } from '../../api/studioInvoiceLine';
import { getCategories } from '../../api/productCategories';
import { useLoading } from '../../contexts/LoadingContext';
import { StudioDashboard, type StudioOrder, type StudioStage } from './StudioDashboard';
import { StudioOrderDetail } from './StudioOrderDetail';
import { StudioStageAssignment } from './StudioStageAssignment';
import { StudioStageSelection } from './StudioStageSelection';
import { StudioUpdateStatusView } from './StudioUpdateStatusView';
import type { UiStageType } from '../../api/studio';
import {
  computeStudioCustomerPricing,
  readStudioProfitPctFromStorage,
  writeStudioProfitPctToStorage,
} from './studioPricing';
import { NumericInput } from '../common';

interface StudioModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branch: Branch | null;
  onNewStudioSale?: () => void;
  /** When set on mount, the module auto-selects the matching production and opens stage-selection. */
  focusSaleId?: string | null;
  /** Called after the module handles focusSaleId so the caller can clear it. */
  onFocusHandled?: () => void;
}

type View =
  | 'dashboard'
  | 'order-detail'
  | 'select-stages'
  | 'add-stage'
  | 'edit-stage'
  | 'update-status'
  | 'invoice'
  | 'shipment';

const shortOrderStatusLabel: Record<StudioOrder['status'], string> = {
  pending: 'Pending',
  'in-progress': 'Active',
  ready: 'Ready',
  completed: 'Done',
  shipped: 'Shipped',
};

function sortProductionsStable(prods: studioApi.StudioProductionRow[]): studioApi.StudioProductionRow[] {
  return [...prods].sort((a, b) => {
    const na = a.production_no || '';
    const nb = b.production_no || '';
    if (na !== nb) return na.localeCompare(nb);
    return a.id.localeCompare(b.id);
  });
}

function mergeAggregatedStatus(parts: StudioOrder['status'][]): StudioOrder['status'] {
  if (parts.length === 0) return 'pending';
  if (parts.every((s) => s === 'completed')) return 'completed';
  if (parts.some((s) => s === 'shipped')) return 'shipped';
  if (parts.some((s) => s === 'in-progress')) return 'in-progress';
  if (parts.every((s) => s === 'ready')) return 'ready';
  if (parts.some((s) => s === 'ready')) return 'in-progress';
  return 'pending';
}

function mapProductionToOrder(
  prod: studioApi.StudioProductionRow,
  stages: studioApi.StudioStageRow[]
): StudioOrder {
  const sale = prod.sale as { customer_name?: string; total?: number; invoice_no?: string; invoice_date?: string; deadline?: string | null } | undefined;
  const product = prod.product as { name?: string } | undefined;
  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const inProgress = stages.find((s) => {
    if (s.status === 'pending' || s.status === 'completed') return false;
    if (s.status === 'assigned' || s.status === 'sent_to_worker' || s.status === 'received' || s.status === 'in_progress') {
      if (!s.assigned_worker_id) return false;
      return true;
    }
    return false;
  });
  const allDone = stages.length > 0 && stages.every((s) => s.status === 'completed');

  let status: StudioOrder['status'] = 'pending';
  if (prod.status === 'completed') status = 'completed';
  else if (allDone) status = 'ready';
  else if (prod.status === 'in_progress' || inProgress) status = 'in-progress';

  const stageTypeToName: Record<string, string> = {
    dyer: 'Dyeing',
    stitching: 'Stitching',
    handwork: 'Handwork',
    embroidery: 'Embroidery',
    finishing: 'Finishing',
    quality_check: 'Quality Check',
  };
  const mappedStages: StudioStage[] = stages.map((s) => {
    const worker = s.worker as { id?: string; name?: string } | undefined;
    const cost = (s.status === 'received' || s.status === 'completed') ? Number(s.cost) || 0 : Number(s.expected_cost ?? s.cost) || 0;
    const expectedCostVal = Number(s.expected_cost ?? s.cost) || 0;
    const uiStatus: StudioStage['status'] =
      s.status === 'in_progress' ? 'in-progress' : (s.status as StudioStage['status']);
    const effectiveStatus: StudioStage['status'] =
      uiStatus === 'completed'
        ? 'completed'
        : s.assigned_worker_id &&
            (uiStatus === 'assigned' || uiStatus === 'in-progress' || uiStatus === 'sent_to_worker' || uiStatus === 'received')
          ? uiStatus
          : 'pending';
    const sentDate = s.sent_date ? new Date(s.sent_date).toISOString().slice(0, 10) : undefined;
    const receivedDate = s.received_date ? new Date(s.received_date).toISOString().slice(0, 10) : undefined;
    const completedDate = s.completed_at ? new Date(s.completed_at).toISOString().slice(0, 10) : undefined;
    const typeUi = s.stage_type === 'dyer' ? 'dyeing' : s.stage_type === 'stitching' ? 'stitching' : s.stage_type === 'embroidery' ? 'embroidery' : s.stage_type === 'finishing' ? 'finishing' : s.stage_type === 'quality_check' ? 'quality-check' : 'handwork';
    return {
      id: s.id,
      productionId: prod.id,
      stageOrder: Number(s.stage_order) || 0,
      name: stageTypeToName[s.stage_type] ?? 'Stage',
      type: typeUi as StudioStage['type'],
      assignedTo: worker?.name ?? 'Unassigned',
      workerId: s.assigned_worker_id ?? undefined,
      internalCost: cost,
      expectedCost: expectedCostVal,
      customerCharge: cost,
      expectedDate: s.expected_completion_date ?? '',
      status: effectiveStatus,
      startedDate: sentDate ?? (effectiveStatus !== 'pending' ? s.expected_completion_date ?? undefined : undefined),
      completedDate,
      sentDate,
      receivedDate,
      notes: s.notes ?? null,
    };
  });

  const currentStageRow = prod.current_stage_id ? stages.find((s) => s.id === prod.current_stage_id) : inProgress;
  const currentStageName = currentStageRow ? (stageTypeToName[currentStageRow.stage_type] ?? currentStageRow.stage_type) : 'Not Started';

  const deadlineStr = sale?.deadline ? new Date(sale.deadline).toISOString().slice(0, 10) : undefined;
  const productLabel = product?.name ?? '—';
  const designTrim = (prod.design_name ?? '').trim();
  const customerInvoiceGenerated = Boolean(prod.generated_invoice_item_id);
  return {
    id: prod.id,
    saleId: prod.sale_id,
    productionIds: [prod.id],
    productionLineLabels: { [prod.id]: productLabel },
    designName: designTrim || null,
    customerInvoiceGenerated,
    orderNumber: sale?.invoice_no ?? prod.production_no,
    customerName: sale?.customer_name ?? '—',
    productName: productLabel,
    totalAmount: Number(sale?.total) || 0,
    createdDate: prod.production_date ? new Date(prod.production_date).toISOString().slice(0, 10) : '—',
    deadline: deadlineStr,
    status,
    currentStage: allDone ? 'Ready for Invoice' : currentStageName,
    stages: mappedStages,
    completedStages: completedCount,
    totalStages: stages.length,
  };
}

function mergeProductionsToOrder(
  group: studioApi.StudioProductionRow[],
  stagesByProdId: Map<string, studioApi.StudioStageRow[]>
): StudioOrder {
  const sorted = sortProductionsStable(group);
  const primary = sorted[0];
  const partials = sorted.map((p) => mapProductionToOrder(p, stagesByProdId.get(p.id) ?? []));
  const mergedStages = partials.flatMap((o) => o.stages);
  const prodIndex = new Map(sorted.map((p, i) => [p.id, i]));
  mergedStages.sort((a, b) => {
    const ai = prodIndex.get(a.productionId) ?? 0;
    const bi = prodIndex.get(b.productionId) ?? 0;
    if (ai !== bi) return ai - bi;
    return (a.stageOrder ?? 0) - (b.stageOrder ?? 0);
  });
  const completedStages = mergedStages.filter((s) => s.status === 'completed').length;
  const totalStages = mergedStages.length;
  const status = mergeAggregatedStatus(partials.map((o) => o.status));

  const names = sorted
    .map((p) => {
      const pr = p.product as { name?: string } | undefined;
      return pr?.name?.trim();
    })
    .filter((n): n is string => Boolean(n));
  const uniqueNames = [...new Set(names)];
  const productName =
    uniqueNames.length === 0 ? '—' : uniqueNames.length <= 3 ? uniqueNames.join(' · ') : `${uniqueNames.slice(0, 2).join(' · ')} +${uniqueNames.length - 2}`;

  const productionLineLabels: Record<string, string> = {};
  sorted.forEach((p) => {
    const pr = p.product as { name?: string; sku?: string } | undefined;
    const label = pr?.name?.trim() || pr?.sku || '—';
    productionLineLabels[p.id] = label;
  });

  let currentStage = 'Not Started';
  for (const o of partials) {
    if (o.status !== 'ready' && o.status !== 'completed') {
      currentStage = o.currentStage ?? 'Not Started';
      break;
    }
  }
  if (partials.every((o) => o.status === 'ready')) currentStage = 'Ready for Invoice';
  if (partials.every((o) => o.status === 'completed')) currentStage = 'Completed';

  const base = partials[0];
  const designMerged = (primary.design_name ?? '').trim() || null;
  const customerInvoiceGenerated = partials.every((o) => o.customerInvoiceGenerated);
  return {
    id: primary.id,
    saleId: primary.sale_id,
    productionIds: sorted.map((p) => p.id),
    productionLineLabels,
    designName: designMerged,
    customerInvoiceGenerated,
    orderNumber: base.orderNumber,
    customerName: base.customerName,
    productName,
    totalAmount: base.totalAmount,
    createdDate: partials.map((o) => o.createdDate).sort()[0] ?? base.createdDate,
    deadline: base.deadline,
    status,
    currentStage,
    stages: mergedStages,
    completedStages,
    totalStages,
  };
}

export function StudioModule({ onBack, companyId, branch, onNewStudioSale, focusSaleId, onFocusHandled }: StudioModuleProps) {
  const { withLoading } = useLoading();
  const [view, setView] = useState<View>('dashboard');
  const [dashboardVariant, setDashboardVariant] = useState<'classic' | 'test'>('classic');
  const [selectedOrder, setSelectedOrder] = useState<StudioOrder | null>(null);
  const [selectedStage, setSelectedStage] = useState<StudioStage | null>(null);
  /** Invoice screen: profit markup % (persisted locally + optional server default). */
  const [invoiceProfitPct, setInvoiceProfitPct] = useState(25);
  const [invoiceProfitPctStr, setInvoiceProfitPctStr] = useState('25');
  const [invoiceServerProfitPct, setInvoiceServerProfitPct] = useState<string | null>(null);
  const [invoiceProfitSaving, setInvoiceProfitSaving] = useState(false);
  const [invoiceProfitSaveOk, setInvoiceProfitSaveOk] = useState(false);
  /** When true, changing profit rules does not overwrite the bill amount (user typed a custom Rs.). */
  const [invSalePriceUserEdited, setInvSalePriceUserEdited] = useState(false);
  const [orders, setOrders] = useState<StudioOrder[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [error, setError] = useState<string | null>(null);
  /** Generate invoice (mobile parity with web Product & Invoice) */
  const [invProductQuery, setInvProductQuery] = useState('');
  const [invSelectedProduct, setInvSelectedProduct] = useState<StudioInvoiceProductRow | null>(null);
  const [invSearchResults, setInvSearchResults] = useState<StudioInvoiceProductRow[]>([]);
  const [invSalePrice, setInvSalePrice] = useState('');
  const [invCategoryId, setInvCategoryId] = useState('');
  const [invCategories, setInvCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [invSyncReplica, setInvSyncReplica] = useState(true);
  const [invSearchBusy, setInvSearchBusy] = useState(false);
  const refreshMergedOrder = useCallback(
    async (saleId: string): Promise<StudioOrder | null> => {
      if (!companyId) return null;
      const { data: prods } = await studioApi.getStudioProductions(companyId, undefined);
      const group = (prods || []).filter((p) => p.sale_id === saleId);
      if (group.length === 0) return null;
      const stagesByProdId = new Map<string, studioApi.StudioStageRow[]>();
      await Promise.all(
        group.map(async (p) => {
          const { data: stages } = await studioApi.getStudioStages(p.id);
          stagesByProdId.set(p.id, stages || []);
        }),
      );
      return mergeProductionsToOrder(group, stagesByProdId);
    },
    [companyId],
  );

  const loadOrders = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    await studioApi.ensureStudioProductionsForCompany(companyId);
    const { data: prods, error: prodErr } = await studioApi.getStudioProductions(companyId, undefined);
    if (prodErr) {
      setError(prodErr);
      setOrders([]);
      setLoading(false);
      return;
    }
    const list = prods || [];
    const stagesByProdId = new Map<string, studioApi.StudioStageRow[]>();
    await Promise.all(
      list.map(async (p) => {
        const { data: stages } = await studioApi.getStudioStages(p.id);
        stagesByProdId.set(p.id, stages || []);
      }),
    );
    const bySale = new Map<string, studioApi.StudioProductionRow[]>();
    for (const p of list) {
      const g = bySale.get(p.sale_id) ?? [];
      g.push(p);
      bySale.set(p.sale_id, g);
    }
    const saleFirstIndex = new Map<string, number>();
    list.forEach((p, i) => {
      if (!saleFirstIndex.has(p.sale_id)) saleFirstIndex.set(p.sale_id, i);
    });
    const ordersList: StudioOrder[] = [];
    for (const [, group] of bySale) {
      ordersList.push(mergeProductionsToOrder(group, stagesByProdId));
    }
    ordersList.sort((a, b) => (saleFirstIndex.get(a.saleId) ?? 0) - (saleFirstIndex.get(b.saleId) ?? 0));
    setOrders(ordersList);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!selectedOrder) return;
    const stored = readStudioProfitPctFromStorage(selectedOrder.id);
    const initialPct = stored !== null ? stored : 25;
    setInvoiceProfitPct(initialPct);
    setInvoiceProfitPctStr(String(initialPct));
    setInvoiceServerProfitPct(null);
    setInvoiceProfitSaveOk(false);
    let cancelled = false;
    void studioApi.loadProductionProfitMargin(selectedOrder.id).then(({ data }) => {
      if (cancelled || !data) return;
      const v = Number.isFinite(data.value) ? data.value : 25;
      setInvoiceServerProfitPct(String(v));
      try {
        if (readStudioProfitPctFromStorage(selectedOrder.id) !== null) return;
      } catch {
        /* ignore */
      }
      setInvoiceProfitPct(v);
      setInvoiceProfitPctStr(String(v));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedOrder?.id]);

  useEffect(() => {
    if (view !== 'invoice' || !selectedOrder || !companyId) return;
    const seed =
      selectedOrder.designName?.trim() ||
      selectedOrder.productName?.trim() ||
      '';
    setInvProductQuery(seed);
    setInvSalePrice('');
    setInvSelectedProduct(null);
    setInvSearchResults([]);
    setInvCategoryId('');
    setInvSyncReplica(true);
    setInvSalePriceUserEdited(false);
    void getCategories(companyId).then(({ data }) => setInvCategories(data || []));
  }, [view, selectedOrder?.id, companyId]);

  const invoicePricing = useMemo(() => {
    if (!selectedOrder || view !== 'invoice') return null;
    return {
      ...computeStudioCustomerPricing(selectedOrder, invoiceProfitPct),
      profitPct: invoiceProfitPct,
    };
  }, [selectedOrder, view, invoiceProfitPct]);

  useEffect(() => {
    if (view !== 'invoice' || !invoicePricing) return;
    if (invSalePriceUserEdited) return;
    setInvSalePrice(String(Math.max(0, Math.round(invoicePricing.effectiveCustomerCharge))));
  }, [view, selectedOrder?.id, invoicePricing?.effectiveCustomerCharge, invSalePriceUserEdited]);

  /** Run studio API call then refresh dashboard + merged order under one global loading overlay. */
  const orderDetailSyncAfterApi = useCallback(
    async (label: string, apiCall: () => Promise<{ error: string | null }>) => {
      await withLoading(label, async () => {
        const { error } = await apiCall();
        if (error) {
          alert(error);
          return;
        }
        await loadOrders();
        const sid = selectedOrder?.saleId;
        if (sid) {
          const next = await refreshMergedOrder(sid);
          if (next) setSelectedOrder(next);
        }
      });
    },
    [withLoading, loadOrders, refreshMergedOrder, selectedOrder?.saleId],
  );

  useEffect(() => {
    if (!focusSaleId || loading || orders.length === 0) return;
    const order = orders.find((o) => o.saleId === focusSaleId);
    if (!order) return;
    setSelectedOrder(order);
    setView(order.stages.length === 0 ? 'select-stages' : 'order-detail');
    onFocusHandled?.();
  }, [focusSaleId, loading, orders, onFocusHandled]);

  if (view === 'dashboard') {
    const openOrder = (order: StudioOrder) => {
      setSelectedOrder(order);
      setView('order-detail');
    };
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
          <div className="mt-3 grid grid-cols-2 gap-2 bg-white/10 p-1 rounded-xl border border-white/20">
            <button
              type="button"
              onClick={() => setDashboardVariant('classic')}
              className={`h-9 rounded-lg text-sm font-medium transition-colors ${dashboardVariant === 'classic' ? 'bg-white text-[#7C3AED]' : 'text-white/80 hover:bg-white/10'}`}
            >
              Studio (Classic)
            </button>
            <button
              type="button"
              onClick={() => setDashboardVariant('test')}
              className={`h-9 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5 ${dashboardVariant === 'test' ? 'bg-white text-[#7C3AED]' : 'text-white/80 hover:bg-white/10'}`}
            >
              <Sparkles className="w-4 h-4" />
              Studio Test
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
          ) : dashboardVariant === 'classic' ? (
            <StudioDashboard
              orders={orders}
              onOrderClick={openOrder}
            />
          ) : (
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 text-center text-[#9CA3AF] text-sm">
                  No studio orders yet.
                </div>
              ) : (
                orders.map((order) => {
                  const pendingStages = Math.max(0, order.totalStages - order.completedStages);
                  return (
                    <button
                      key={order.saleId}
                      type="button"
                      onClick={() => openOrder(order)}
                      className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6]/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">{order.orderNumber}</p>
                          <p className="text-xs text-[#9CA3AF] truncate">{order.customerName}</p>
                          {order.designName?.trim() && (
                            <p className="text-[10px] text-[#A78BFA] font-medium truncate">Replica: {order.designName.trim()}</p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded shrink-0 max-w-[38%] truncate ${
                            order.status === 'completed'
                              ? 'bg-[#10B981]/20 text-[#10B981]'
                              : order.status === 'in-progress'
                                ? 'bg-[#3B82F6]/20 text-[#93C5FD]'
                                : 'bg-[#374151] text-[#9CA3AF]'
                          }`}
                          title={order.status}
                        >
                          {shortOrderStatusLabel[order.status]}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-[#111827] border border-[#374151] rounded-lg p-2">
                          <p className="text-[#6B7280]">Completed</p>
                          <p className="text-white font-medium">{order.completedStages}</p>
                        </div>
                        <div className="bg-[#111827] border border-[#374151] rounded-lg p-2">
                          <p className="text-[#6B7280]">Pending</p>
                          <p className="text-[#F59E0B] font-medium">{pendingStages}</p>
                        </div>
                        <div className="bg-[#111827] border border-[#374151] rounded-lg p-2">
                          <p className="text-[#6B7280]">Target</p>
                          <p className="text-white font-medium">{order.deadline || '—'}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-[#9CA3AF] line-clamp-2 break-words min-w-0">
                        Current: <span className="text-white font-medium">{order.currentStage || 'Not Started'}</span>
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'order-detail' && selectedOrder) {
    return (
      <StudioOrderDetail
        order={selectedOrder}
        companyId={companyId}
        onBack={() => {
          setView('dashboard');
          setSelectedOrder(null);
          loadOrders();
        }}
        onDesignNameSave={async (name) => {
          await orderDetailSyncAfterApi('Saving name...', () =>
            studioApi.updateStudioProductionDesignName(selectedOrder.id, name),
          );
        }}
        onAddStage={() => {
          setSelectedStage(null);
          const canonicalStages = selectedOrder.stages.filter((s) => s.productionId === selectedOrder.id);
          setView(canonicalStages.length === 0 ? 'select-stages' : 'add-stage');
        }}
        onEditStage={(stage) => {
          setSelectedStage(stage);
          setView('edit-stage');
        }}
        onDeleteStage={async (stage) => {
          if (!confirm('Remove this job from the production pipeline?')) return;
          await orderDetailSyncAfterApi('Removing stage...', () => studioApi.deleteStudioStage(stage.id));
        }}
        onUpdateStatus={(stage) => {
          setSelectedStage(stage);
          setView('update-status');
        }}
        onSendToWorker={async (stage) => {
          await orderDetailSyncAfterApi('Sending to worker...', () => studioApi.sendToWorker(stage.id));
        }}
        onReceiveWork={async (stage) => {
          await orderDetailSyncAfterApi('Receiving work...', () => studioApi.receiveWork(stage.id));
        }}
        onConfirmPayment={async (stage, params) => {
          await withLoading('Posting payment...', async () => {
            const { error } = await studioApi.confirmStagePayment(stage.id, params);
            if (error) {
              alert(error);
              throw new Error(error);
            }
            await loadOrders();
            const sid = selectedOrder?.saleId;
            if (sid) {
              const next = await refreshMergedOrder(sid);
              if (next) setSelectedOrder(next);
            }
          });
        }}
        onCompleteStage={async (stage) => {
          await orderDetailSyncAfterApi('Completing stage...', () => studioApi.completeStage(stage.id));
        }}
        onReopen={async (stage) => {
          await orderDetailSyncAfterApi('Reopening stage...', () => studioApi.reopenStep(stage.id));
        }}
        onGenerateInvoice={() => setView('invoice')}
        onShipment={() => setView('shipment')}
      />
    );
  }

  if (view === 'select-stages' && selectedOrder && companyId) {
    const canonicalStages = selectedOrder.stages.filter((s) => s.productionId === selectedOrder.id);
    return (
      <StudioStageSelection
        onBack={() => setView('order-detail')}
        orderId={selectedOrder.id}
        existingStageTypes={canonicalStages.map((s) => s.type) as UiStageType[]}
        onSave={async (stageTypes) => {
          await withLoading('Adding stages...', async () => {
            const { error: err } = await studioApi.addStudioStagesBatch(selectedOrder.id, stageTypes);
            if (err) {
              alert(err);
              return;
            }
            await loadOrders();
            const next = await refreshMergedOrder(selectedOrder.saleId);
            if (next) setSelectedOrder(next);
            setView('order-detail');
          });
        }}
      />
    );
  }

  if ((view === 'add-stage' || view === 'edit-stage') && selectedOrder && companyId) {
    return (
      <StudioStageAssignment
        companyId={companyId}
        onBack={() => setView('order-detail')}
        onComplete={async (stageData) => {
          const targetPid = selectedOrder.id;
          if (view === 'add-stage') {
            const { data, error: err } = await studioApi.createStudioStage(targetPid, {
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
              const workerId = stageData.workerId ?? undefined;
              const internalCost = stageData.internalCost ?? 0;
              const assignedNow = workerId && internalCost > 0;
              if (assignedNow) {
                const { error: assignErr } = await studioApi.assignWorkerToStep(data.id, {
                  worker_id: workerId,
                  expected_cost: internalCost,
                  expected_completion_date: stageData.expectedDate || null,
                  notes: (stageData as { notes?: string })?.notes ?? null,
                });
                if (assignErr) {
                  alert(assignErr);
                  return;
                }
              }
              const newStage: StudioStage = {
                id: data.id,
                productionId: targetPid,
                name: stageData.name ?? 'Stage',
                type: stageData.type ?? 'handwork',
                assignedTo: stageData.assignedTo ?? 'Unassigned',
                workerId: stageData.workerId,
                internalCost: stageData.internalCost ?? 0,
                expectedCost: stageData.internalCost ?? 0,
                customerCharge: stageData.customerCharge ?? 0,
                expectedDate: stageData.expectedDate ?? '',
                status: assignedNow ? 'assigned' : 'pending',
                notes: (stageData as { notes?: string | null })?.notes ?? null,
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
        fixedStageType={view === 'edit-stage' ? selectedStage?.type : undefined}
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
          await withLoading('Updating...', async () => {
            await loadOrders();
            const next = await refreshMergedOrder(selectedOrder.saleId);
            if (next) setSelectedOrder(next);
            setView('order-detail');
            setSelectedStage(null);
          });
        }}
      />
    );
  }

  if (view === 'invoice' && selectedOrder) {
    const canSubmitInvoice = Boolean(companyId) && (invProductQuery.trim().length > 0 || invSelectedProduct);
    const handleInvoiceSearch = async () => {
      if (!companyId) return;
      const q = invProductQuery.trim();
      setInvSearchBusy(true);
      try {
        const { data, error } = await studioInvoiceApi.searchProductsForStudioInvoice(companyId, q);
        if (error) alert(error);
        else setInvSearchResults(data);
      } finally {
        setInvSearchBusy(false);
      }
    };

    const handleConfirmInvoice = () => {
      if (!companyId) {
        alert('Select a company to create the invoice line.');
        return;
      }
      const price = Number(String(invSalePrice).replace(/,/g, '')) || 0;
      if (price <= 0) {
        alert('Enter a valid sale price.');
        return;
      }
      if (invProductQuery.trim().length < 1 && !invSelectedProduct) {
        alert('Enter a product name or pick an existing product.');
        return;
      }
      void withLoading('Saving invoice line...', async () => {
        const { error } = await studioInvoiceApi.upsertStudioInvoiceLine({
          companyId,
          branchId: branch?.id ?? null,
          saleId: selectedOrder.saleId,
          productionId: selectedOrder.id,
          invoiceNoLabel: selectedOrder.orderNumber ?? '',
          salePrice: price,
          productName: invProductQuery.trim(),
          categoryId: invCategoryId || null,
          existingProductId: invSelectedProduct?.id ?? null,
          syncReplicaTitle: invSyncReplica,
        });
        if (error) {
          alert(error);
          return;
        }
        alert(
          selectedOrder.customerInvoiceGenerated
            ? 'Invoice line updated and sale totals refreshed.'
            : 'Invoice line added, production linked, and sale totals updated.',
        );
        await loadOrders();
        const next = await refreshMergedOrder(selectedOrder.saleId);
        if (next) setSelectedOrder(next);
        setView('order-detail');
      });
    };

    const suggestedBillRs =
      invoicePricing !== null ? Math.max(0, Math.round(invoicePricing.effectiveCustomerCharge)) : 0;
    const parsedInvoiceProfit = Number.parseFloat(invoiceProfitPctStr);
    const invoiceProfitDirty =
      invoiceServerProfitPct !== null &&
      Number.isFinite(parsedInvoiceProfit) &&
      Math.abs(Number.parseFloat(invoiceServerProfitPct) - parsedInvoiceProfit) > 1e-5;

    const applyInvoiceProfitInput = (raw: string) => {
      setInvoiceProfitPctStr(raw);
      if (raw === '' || raw === '-') return;
      const n = Number.parseFloat(raw);
      if (Number.isFinite(n)) {
        setInvoiceProfitPct(n);
        writeStudioProfitPctToStorage(selectedOrder.id, n);
      }
    };

    const saveInvoiceProfitToServer = async () => {
      const n = Number.parseFloat(invoiceProfitPctStr);
      if (!Number.isFinite(n) || invoiceProfitSaving) return;
      setInvoiceProfitSaving(true);
      setInvoiceProfitSaveOk(false);
      const { error } = await studioApi.saveProductionProfitMargin(selectedOrder.id, 'percentage', n);
      setInvoiceProfitSaving(false);
      if (!error) {
        setInvoiceServerProfitPct(invoiceProfitPctStr);
        setInvoiceProfitSaveOk(true);
        setTimeout(() => setInvoiceProfitSaveOk(false), 1800);
      } else {
        alert(error);
      }
    };

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
              <h1 className="font-semibold text-white">Product & Invoice</h1>
              <p className="text-xs text-white/80">{selectedOrder.orderNumber}</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
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
              {selectedOrder.designName?.trim() ? (
                <p className="text-sm">
                  <span className="text-[#9CA3AF]">Design / replica:</span>{' '}
                  <span className="text-white">{selectedOrder.designName.trim()}</span>
                </p>
              ) : null}
            </div>
            {invoicePricing ? (
              <>
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Production cost</span>
                    <span className="text-[#F87171] font-medium">Rs. {invoicePricing.totalInternalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[#9CA3AF] flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 shrink-0" />
                      Profit % (markup)
                    </span>
                    <div className="flex items-center gap-2 flex-1 min-w-[8rem] justify-end">
                      <NumericInput
                        value={invoiceProfitPctStr}
                        onChange={applyInvoiceProfitInput}
                        allowDecimal
                        maxDecimals={2}
                        min={0}
                        className="w-28 shrink-0"
                        inputClassName="!h-9 !py-1 !px-2 text-sm text-right"
                      />
                      <span className="text-sm text-[#9CA3AF] shrink-0">%</span>
                    </div>
                  </div>
                  {(invoiceProfitDirty || invoiceProfitSaveOk) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        {invoiceProfitSaveOk ? (
                          <>
                            <CheckCircle size={14} className="text-[#10B981]" />
                            <span className="text-[#10B981]">Saved as default for this order</span>
                          </>
                        ) : (
                          <>
                            <span className="inline-block w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                            <span className="text-[#F59E0B]">Not saved as server default yet</span>
                          </>
                        )}
                      </div>
                      {invoiceProfitDirty && (
                        <button
                          type="button"
                          onClick={() => void saveInvoiceProfitToServer()}
                          disabled={invoiceProfitSaving}
                          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 text-white text-xs font-semibold shrink-0"
                        >
                          <Save size={13} />
                          {invoiceProfitSaving ? 'Saving…' : 'Save default'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2 mb-4">
                  <h3 className="text-sm font-semibold text-[#8B5CF6] mb-2">Stage breakdown</h3>
                  {selectedOrder.stages.map((stage) => (
                    <div key={stage.id} className="rounded-lg bg-[#111827]/80 border border-[#374151] px-3 py-2">
                      <div className="flex justify-between gap-2 text-sm mb-1">
                        <span className="text-white font-medium min-w-0">{stage.name}</span>
                        <span className="text-[#10B981] font-medium shrink-0">
                          Customer Rs. {stage.customerCharge.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-[#6B7280]">
                        <span>Internal cost</span>
                        <span>Rs. {stage.internalCost.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {invoicePricing.totalStageCustomerCharge === 0 && selectedOrder.stages.length > 0 ? (
                  <p className="text-xs text-[#9CA3AF] mb-4 leading-relaxed">
                    No per-stage customer amounts are set—the suggested total below uses production cost × profit % only.
                  </p>
                ) : null}
                {invoicePricing.totalStageCustomerCharge > 0 &&
                invoicePricing.totalStageCustomerCharge < invoicePricing.suggestedCustomerCharge ? (
                  <div className="flex justify-between text-xs text-[#6B7280] mb-3">
                    <span>Sum of stage customer lines</span>
                    <span>Rs. {invoicePricing.totalStageCustomerCharge.toLocaleString()}</span>
                  </div>
                ) : null}
                {invoicePricing.suggestedCustomerCharge < invoicePricing.effectiveCustomerCharge &&
                invoicePricing.totalStageCustomerCharge > 0 ? (
                  <div className="flex justify-between text-xs text-[#6B7280] mb-3">
                    <span>Markup minimum (cost × profit%)</span>
                    <span>Rs. {invoicePricing.suggestedCustomerCharge.toLocaleString()}</span>
                  </div>
                ) : null}
                <div className="pt-4 border-t border-[#374151]">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-lg font-bold text-white">Suggested customer charge</span>
                    <span className="text-2xl font-bold text-[#10B981] shrink-0">
                      Rs. {invoicePricing.effectiveCustomerCharge.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6B7280] mt-2 leading-relaxed">
                    Uses this profit % and stage customer lines: the higher of markup on production cost and the sum of
                    per-stage customer amounts. You can override the billed amount below.
                  </p>
                </div>
              </>
            ) : null}
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Catalog product</h3>
              <p className="text-xs text-[#9CA3AF] mb-3">
                Search to link an existing product, or leave unselected to create a new one from the name below.
              </p>
              {selectedOrder.designName?.trim() ? (
                <p className="text-xs text-[#6B7280] mb-2">Prefilled from replica title — edit before creating.</p>
              ) : null}
              {selectedOrder.customerInvoiceGenerated ? (
                <p className="text-xs text-amber-200/90 mb-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                  This order already has a linked invoice line. Submitting updates the line, product, and sale total.
                </p>
              ) : null}
              {selectedOrder.productionIds.length > 1 ? (
                <p className="text-xs text-[#9CA3AF] mb-3">
                  Multiple productions on this sale: the line is linked to the primary production ({selectedOrder.orderNumber}).
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#9CA3AF]">Product name (search / new)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invProductQuery}
                  onChange={(e) => {
                    setInvProductQuery(e.target.value);
                    setInvSelectedProduct(null);
                  }}
                  className="flex-1 min-w-0 rounded-lg bg-[#111827] border border-[#374151] px-3 py-2.5 text-sm text-white placeholder:text-[#6B7280]"
                  placeholder="Product name"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => void handleInvoiceSearch()}
                  disabled={invSearchBusy || !invProductQuery.trim()}
                  className="shrink-0 px-3 py-2.5 rounded-lg bg-[#374151] text-white border border-[#4B5563] disabled:opacity-50 inline-flex items-center justify-center"
                  aria-label="Search products"
                >
                  {invSearchBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {invSearchResults.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-[#9CA3AF]">Tap to use catalog product</p>
                <ul className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-[#374151] divide-y divide-[#374151]">
                  {invSearchResults.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setInvSelectedProduct(row);
                          setInvProductQuery(row.name);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm ${
                          invSelectedProduct?.id === row.id ? 'bg-[#7C3AED]/30 text-white' : 'text-[#E5E7EB] hover:bg-[#111827]'
                        }`}
                      >
                        <span className="font-medium">{row.name}</span>
                        <span className="text-[#9CA3AF] text-xs ml-2">{row.sku}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setInvSelectedProduct(null);
                  }}
                  className="text-xs text-[#A78BFA] underline"
                >
                  Clear selection — create new product from name
                </button>
              </div>
            ) : null}

            {!invSelectedProduct ? (
              <div className="space-y-2">
                <label className="text-xs text-[#9CA3AF]">Category (new product)</label>
                <select
                  value={invCategoryId}
                  onChange={(e) => setInvCategoryId(e.target.value)}
                  className="w-full rounded-lg bg-[#111827] border border-[#374151] px-3 py-2.5 text-sm text-white"
                >
                  <option value="">Optional — uncategorized</option>
                  {invCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm text-[#10B981]">
                Using catalog: <span className="font-medium text-white">{invSelectedProduct.name}</span>{' '}
                <span className="text-[#9CA3AF]">({invSelectedProduct.sku})</span>
              </p>
            )}

            <div className="space-y-2">
              <label className="text-xs text-[#9CA3AF]">Amount to bill (Rs.)</label>
              <p className="text-xs text-[#6B7280] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Suggested from rules: Rs. {suggestedBillRs.toLocaleString()}</span>
                {invSalePriceUserEdited ? (
                  <button
                    type="button"
                    onClick={() => {
                      setInvSalePriceUserEdited(false);
                      setInvSalePrice(String(suggestedBillRs));
                    }}
                    className="text-[#A78BFA] underline font-medium"
                  >
                    Use suggested
                  </button>
                ) : null}
              </p>
              <NumericInput
                value={invSalePrice}
                onChange={(v) => {
                  setInvSalePriceUserEdited(true);
                  setInvSalePrice(v);
                }}
                allowDecimal
                className="w-full"
                inputClassName="!h-auto !py-2.5 !px-3 text-sm"
                placeholder="0"
              />
              <p className="text-[10px] text-[#6B7280]">This is what posts to the sale invoice line; edit freely if you need a custom total.</p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={invSyncReplica}
                onChange={(e) => setInvSyncReplica(e.target.checked)}
                className="mt-1 rounded border-[#4B5563]"
              />
              <span className="text-sm text-[#D1D5DB] leading-snug">
                Update replica title on the order to match the catalog product name after saving.
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleConfirmInvoice}
            disabled={!canSubmitInvoice}
            className="w-full py-4 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedOrder.customerInvoiceGenerated ? 'Update invoice line' : 'Confirm & generate invoice'}
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
            <p className="text-sm text-[#9CA3AF] leading-relaxed text-center py-4">
              Shipment is recorded in the system after a customer invoice line is linked to this studio order (same as web). If you do not see Process Shipment on the order, link the line on web Studio or Sales, then return here.
            </p>
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
