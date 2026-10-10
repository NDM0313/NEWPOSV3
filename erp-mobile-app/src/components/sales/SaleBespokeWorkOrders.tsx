import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Package, Plus, Scissors } from 'lucide-react';
import {
  cancelBespokeWorkOrder,
  completeBespokeWorkOrder,
  createBespokeWorkOrder,
  getWorkOrderStockPostStatus,
  listBespokeParentSaleItems,
  listBespokeWorkOrdersBySale,
  repostBespokeWorkOrderStock,
  updateBespokeWorkOrder,
  type BespokeWorkOrderRow,
  type BespokeWorkOrderStatus,
  type WorkOrderStockPostStatus,
} from '../../api/bespokeWorkOrders';
import { getContacts } from '../../api/contacts';
import { CustomSearchableSheet } from '../common';
import { WorkOrderDetailSheet } from './WorkOrderDetailSheet';

function formatWoDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface SaleBespokeWorkOrdersProps {
  companyId: string;
  branchId: string;
  saleId: string;
  userId: string;
  saleStatus: string;
}

export function SaleBespokeWorkOrders({
  companyId,
  branchId,
  saleId,
  userId,
  saleStatus,
}: SaleBespokeWorkOrdersProps) {
  const [orders, setOrders] = useState<BespokeWorkOrderRow[]>([]);
  const [stockById, setStockById] = useState<Record<string, WorkOrderStockPostStatus>>({});
  const [parents, setParents] = useState<Array<{ id: string; product_name: string | null; sku: string | null }>>([]);
  const [tailors, setTailors] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parentItemId, setParentItemId] = useState('');
  const [tailorId, setTailorId] = useState('');
  const [cost, setCost] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailWo, setDetailWo] = useState<BespokeWorkOrderRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wo, pi, suppliersRes, workersRes] = await Promise.all([
        listBespokeWorkOrdersBySale(saleId),
        listBespokeParentSaleItems(saleId),
        getContacts(companyId, 'supplier'),
        getContacts(companyId, 'worker'),
      ]);
      setOrders(wo);
      setParents(pi);
      const byId = new Map<string, { id: string; name: string }>();
      for (const c of [...(suppliersRes.data ?? []), ...(workersRes.data ?? [])]) {
        if (c.id && c.name) byId.set(c.id, { id: c.id, name: c.name });
      }
      const workerList = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
      setTailors(workerList);
      if (!parentItemId && pi[0]?.id) setParentItemId(pi[0].id);
      if (!tailorId && workerList[0]?.id) setTailorId(workerList[0].id);

      const stockEntries = await Promise.all(
        wo
          .filter((row) => row.status === 'completed')
          .map(async (row) => {
            const status = await getWorkOrderStockPostStatus(
              row.id,
              row.parent_sales_item_id,
              row.sale_id,
              row.work_order_no,
            );
            return [row.id, status] as const;
          }),
      );
      setStockById(Object.fromEntries(stockEntries));
      setDetailWo((prev) => {
        if (!prev) return null;
        return wo.find((row) => row.id === prev.id) ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [saleId, companyId, parentItemId, tailorId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!parentItemId || !tailorId) {
      setError('Select dress line and worker.');
      return;
    }
    const productionCost = parseFloat(cost) || 0;
    if (productionCost <= 0) {
      setError('Production cost must be greater than 0.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createBespokeWorkOrder({
        companyId,
        branchId,
        saleId,
        parentSalesItemId: parentItemId,
        tailorContactId: tailorId,
        productionCost,
        createdByAuthUserId: userId,
      });
      setCost('');
      setShowCreate(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async (woId: string) => {
    setBusy(true);
    setError(null);
    try {
      await completeBespokeWorkOrder(woId, userId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Complete failed');
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async (woId: string) => {
    const wo = orders.find((row) => row.id === woId);
    if (!wo) return;
    setBusy(true);
    setError(null);
    try {
      await updateBespokeWorkOrder({
        workOrderId: wo.id,
        tailorContactId: wo.tailor_contact_id || wo.tailor?.id || '',
        productionCost: Number(wo.production_cost) || 0,
        notes: wo.notes ?? null,
        status: 'in_progress',
        createdAt: wo.created_at ?? null,
        completedAt: null,
        userId,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start failed');
    } finally {
      setBusy(false);
    }
  };

  const handlePostStock = async (woId: string) => {
    setBusy(true);
    setError(null);
    try {
      await repostBespokeWorkOrderStock(woId, userId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Post stock failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (params: {
    workOrderId: string;
    tailorContactId: string;
    productionCost: number;
    notes: string;
    status: BespokeWorkOrderStatus;
    createdAt: string | null;
    completedAt: string | null;
  }) => {
    setBusy(true);
    setError(null);
    try {
      await updateBespokeWorkOrder({
        workOrderId: params.workOrderId,
        tailorContactId: params.tailorContactId,
        productionCost: params.productionCost,
        notes: params.notes,
        status: params.status,
        createdAt: params.createdAt,
        completedAt: params.status === 'completed' ? params.completedAt : null,
        userId,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const handleCancelWo = async (woId: string) => {
    setBusy(true);
    setError(null);
    try {
      await cancelBespokeWorkOrder(woId, userId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  };

  const posted = String(saleStatus).toLowerCase() === 'final';
  const showCreateForm = !posted && parents.length > 0 && (orders.length === 0 || showCreate);
  const tailorOptions = useMemo(
    () =>
      tailors.map((t) => ({
        value: t.id,
        label: t.name,
      })),
    [tailors],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Work orders…
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-violet-500/30 rounded-lg p-3 bg-gray-950/80">
      <div className="flex items-center gap-2 text-violet-300 text-sm font-medium">
        <Scissors size={16} /> Customization work orders
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {orders.length === 0 ? (
        <p className="text-xs text-gray-500">
          {!posted && parents.length === 0
            ? 'No sale lines to attach a work order.'
            : 'No work orders yet. Create one per dress line.'}
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {orders.map((wo) => {
            const stock = stockById[wo.id];
            const needsStock = wo.status === 'completed' && stock?.needsStockPost === true;
            const stockOk = wo.status === 'completed' && stock && !stock.needsStockPost;
            const canStart = wo.status === 'draft';
            const canComplete = wo.status === 'in_progress';
            const receivedLabel = formatWoDate(wo.created_at);
            const completedLabel = formatWoDate(wo.completed_at);
            return (
              <li
                key={wo.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailWo(wo)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailWo(wo);
                  }
                }}
                className="flex flex-col gap-1.5 bg-gray-900 rounded px-2 py-1.5 cursor-pointer"
              >
                <div className="flex justify-between items-center gap-2">
                  <span>
                    {wo.work_order_no} · {wo.status}
                    {wo.tailor?.name ? ` · ${wo.tailor.name}` : ''}
                  </span>
                  {canStart && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleStart(wo.id);
                      }}
                      className="text-xs text-blue-400 font-medium"
                    >
                      Start
                    </button>
                  )}
                  {canComplete && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleComplete(wo.id);
                      }}
                      className="text-xs text-emerald-400 font-medium"
                    >
                      Complete
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  {receivedLabel ? `Received ${receivedLabel}` : 'Received —'}
                  {completedLabel ? ` · Completed ${completedLabel}` : ''}
                </p>
                {needsStock && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Stock pending
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handlePostStock(wo.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-amber-300 font-medium border border-amber-500/40 rounded px-2 py-0.5"
                    >
                      <Package size={12} /> Post stock
                    </button>
                  </div>
                )}
                {stockOk && (
                  <span className="w-fit text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Stock posted
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!posted && orders.length > 0 && parents.length > 0 && !showCreate && (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 text-xs text-violet-300 font-medium"
        >
          <Plus size={12} /> Add work order
        </button>
      )}

      {showCreateForm && (
        <div className="space-y-2 pt-2 border-t border-gray-800">
          <select
            value={parentItemId}
            onChange={(e) => setParentItemId(e.target.value)}
            className="w-full h-9 bg-gray-900 border border-gray-700 rounded text-sm text-white"
          >
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.product_name || p.sku || 'Custom').slice(0, 40)}
              </option>
            ))}
          </select>
          <CustomSearchableSheet
            label=""
            sheetTitle="Worker / supplier"
            value={tailorId}
            onChange={setTailorId}
            options={tailorOptions}
            placeholder={tailors.length === 0 ? 'No workers or suppliers' : 'Search worker or supplier…'}
            searchPlaceholder="Search name…"
            hint={
              tailors.length === 0
                ? 'Add workers or suppliers in Contacts first.'
                : undefined
            }
            zIndexClass="z-[85]"
          />
          <input
            type="number"
            placeholder="Production cost"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full h-9 bg-gray-900 border border-gray-700 rounded px-2 text-sm text-white"
          />
          <div className="flex gap-2">
            {orders.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowCreate(false)}
                className="flex-1 h-9 rounded border border-gray-700 text-gray-300 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCreate()}
              className="flex-1 h-9 rounded bg-violet-600 text-white text-sm font-medium disabled:opacity-50"
            >
              Create work order
            </button>
          </div>
        </div>
      )}
      {posted && (
        <p className="text-xs text-amber-500/90">Sale is final — new work orders are locked.</p>
      )}

      <WorkOrderDetailSheet
        open={!!detailWo}
        workOrder={detailWo}
        stock={detailWo ? stockById[detailWo.id] ?? null : null}
        busy={busy}
        workers={tailors}
        onClose={() => setDetailWo(null)}
        onStart={(id) => void handleStart(id)}
        onComplete={(id) => void handleComplete(id)}
        onPostStock={(id) => void handlePostStock(id)}
        onSaveEdit={handleSaveEdit}
        onCancelWorkOrder={(id) => void handleCancelWo(id)}
      />
    </div>
  );
}
