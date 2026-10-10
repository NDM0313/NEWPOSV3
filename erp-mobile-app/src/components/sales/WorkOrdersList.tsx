import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Package, Scissors } from 'lucide-react';
import {
  cancelBespokeWorkOrder,
  completeBespokeWorkOrder,
  getWorkOrderStockPostStatus,
  listBespokeWorkOrdersByCompany,
  repostBespokeWorkOrderStock,
  updateBespokeWorkOrder,
  type BespokeWorkOrderRow,
  type BespokeWorkOrderStatus,
  type WorkOrderStockPostStatus,
} from '../../api/bespokeWorkOrders';
import { getContacts } from '../../api/contacts';
import { WorkOrderDetailSheet } from './WorkOrderDetailSheet';

const STATUS_TABS: Array<BespokeWorkOrderStatus | 'all'> = [
  'all',
  'draft',
  'in_progress',
  'completed',
  'cancelled',
];

function saleRef(wo: BespokeWorkOrderRow): string {
  return (
    wo.sale?.invoice_no?.trim() ||
    wo.sale?.order_no?.trim() ||
    wo.sale?.customer_name?.trim() ||
    'Sale'
  );
}

function formatWoDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface WorkOrdersListProps {
  companyId: string;
  branchId?: string | null;
  userId: string;
  searchQuery?: string;
  refreshToken?: number;
}

export function WorkOrdersList({
  companyId,
  branchId,
  userId,
  searchQuery = '',
  refreshToken = 0,
}: WorkOrdersListProps) {
  const [orders, setOrders] = useState<BespokeWorkOrderRow[]>([]);
  const [stockById, setStockById] = useState<Record<string, WorkOrderStockPostStatus>>({});
  const [workers, setWorkers] = useState<Array<{ id: string; name: string }>>([]);
  const [statusFilter, setStatusFilter] = useState<BespokeWorkOrderStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailWo, setDetailWo] = useState<BespokeWorkOrderRow | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [rows, contacts] = await Promise.all([
        listBespokeWorkOrdersByCompany(companyId, {
          status: statusFilter,
          branchId: branchId || undefined,
        }),
        getContacts(companyId, 'supplier'),
      ]);
      setOrders(rows);
      setWorkers(
        (contacts.data ?? [])
          .filter((c) => c.id && c.name)
          .map((c) => ({ id: c.id!, name: c.name! })),
      );
      const stockEntries = await Promise.all(
        rows
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
        return rows.find((row) => row.id === prev.id) ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load work orders');
      setOrders([]);
      setStockById({});
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, statusFilter, refreshToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((wo) => {
      const hay = [
        wo.work_order_no,
        wo.tailor?.name,
        wo.sale?.invoice_no,
        wo.sale?.order_no,
        wo.sale?.customer_name,
        wo.parent_item?.product_name,
        wo.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, searchQuery]);

  const handleComplete = async (woId: string) => {
    setBusyId(woId);
    setError(null);
    try {
      await completeBespokeWorkOrder(woId, userId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Complete failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleStart = async (woId: string) => {
    const wo = orders.find((row) => row.id === woId);
    if (!wo) return;
    setBusyId(woId);
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
      setBusyId(null);
    }
  };

  const handlePostStock = async (woId: string) => {
    setBusyId(woId);
    setError(null);
    try {
      await repostBespokeWorkOrderStock(woId, userId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Post stock failed');
    } finally {
      setBusyId(null);
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
    setBusyId(params.workOrderId);
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
      setBusyId(null);
    }
  };

  const handleCancelWo = async (woId: string) => {
    setBusyId(woId);
    setError(null);
    try {
      await cancelBespokeWorkOrder(woId, userId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Scissors className="w-4 h-4 text-violet-300" />
        <p className="text-sm text-white/80 font-medium">Bespoke work orders</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab;
          const label = tab === 'all' ? 'All' : tab.replace('_', ' ');
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize ${
                active
                  ? 'bg-violet-500 text-white'
                  : 'bg-white/10 text-white/80 border border-white/15'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400 px-1">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading work orders…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">No work orders found</div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((wo) => {
            const stock = stockById[wo.id];
            const needsStock = wo.status === 'completed' && stock?.needsStockPost === true;
            const stockOk = wo.status === 'completed' && stock && !stock.needsStockPost;
            const canStart = wo.status === 'draft';
            const canComplete = wo.status === 'in_progress';
            const receivedLabel = formatWoDate(wo.created_at);
            const completedLabel = formatWoDate(wo.completed_at);
            const busy = busyId === wo.id;
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
                className="rounded-xl border border-white/10 bg-[#1F2937] p-3 space-y-2 active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{wo.work_order_no}</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      {saleRef(wo)}
                      {wo.tailor?.name ? ` · ${wo.tailor.name}` : ''}
                    </p>
                    {wo.parent_item?.product_name && (
                      <p className="text-[11px] text-white/50 mt-0.5">{wo.parent_item.product_name}</p>
                    )}
                    <p className="text-[11px] text-white/45 mt-1">
                      {receivedLabel ? `Received ${receivedLabel}` : 'Received —'}
                      {completedLabel ? ` · Completed ${completedLabel}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${
                      wo.status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : wo.status === 'in_progress'
                          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          : wo.status === 'cancelled'
                            ? 'bg-red-500/15 text-red-300 border-red-500/30'
                            : 'bg-white/10 text-white/70 border-white/20'
                    }`}
                  >
                    {wo.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {needsStock && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Stock pending
                    </span>
                  )}
                  {stockOk && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 size={10} /> Stock posted
                    </span>
                  )}
                  <span className="text-[11px] text-white/50 ml-auto">
                    Cost {Number(wo.production_cost || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {canStart && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleStart(wo.id);
                      }}
                      className="h-8 px-3 rounded-lg bg-blue-600/90 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {busy ? '…' : 'Start'}
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
                      className="h-8 px-3 rounded-lg bg-emerald-600/90 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {busy ? '…' : 'Complete'}
                    </button>
                  )}
                  {needsStock && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handlePostStock(wo.id);
                      }}
                      className="h-8 px-3 rounded-lg border border-amber-500/40 text-amber-300 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Package size={12} /> {busy ? '…' : 'Post stock'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <WorkOrderDetailSheet
        open={!!detailWo}
        workOrder={detailWo}
        stock={detailWo ? stockById[detailWo.id] ?? null : null}
        busy={!!busyId}
        workers={workers}
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
