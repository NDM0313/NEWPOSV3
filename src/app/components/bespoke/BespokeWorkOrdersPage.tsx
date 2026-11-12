import React, { useCallback, useEffect, useState } from 'react';
import { Scissors, Loader2, Search, CheckCircle2, Package, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { branchService, type Branch } from '@/app/services/branchService';
import { supabase } from '@/lib/supabase';
import {
  bespokeWorkOrderService,
  type BespokeWorkOrderDetail,
  type BespokeWorkOrderStatus,
} from '@/app/services/bespokeWorkOrderService';
import { ViewBespokeWorkOrderDrawer } from './ViewBespokeWorkOrderDrawer';
import { BespokeWorkOrderForm } from './BespokeWorkOrderForm';
import { nudgeConvertSaleToFinalAfterWoComplete } from './nudgeConvertSaleToFinal';
import {
  getWorkOrderStockPostStatus,
  hasWorkOrderActiveStockMovements,
  type WorkOrderStockPostStatus,
} from '@/app/services/bespokeFabricStockService';

const STATUS_TABS: Array<BespokeWorkOrderStatus | 'all'> = [
  'all',
  'draft',
  'in_progress',
  'completed',
  'cancelled',
];

const statusStyles: Record<BespokeWorkOrderStatus, string> = {
  draft: 'bg-gray-500/20 text-muted-foreground border-gray-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-[var(--erp-money-positive)] border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function BespokeWorkOrdersPage() {
  const { companyId, user } = useSupabase();
  const { openDrawer, setCurrentView } = useNavigation();
  const { formatCurrency } = useFormatCurrency();
  const { formatDateTime } = useFormatDate();
  const [orders, setOrders] = useState<BespokeWorkOrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BespokeWorkOrderStatus | 'all'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [workerFilter, setWorkerFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [workers, setWorkers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editWorkOrder, setEditWorkOrder] = useState<BespokeWorkOrderDetail | null>(null);
  const [stockByWoId, setStockByWoId] = useState<Record<string, WorkOrderStockPostStatus>>({});
  const [activeStockByWoId, setActiveStockByWoId] = useState<Record<string, boolean>>({});
  const [editStockPosted, setEditStockPosted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    branchService.getAllBranches(companyId).then(setBranches).catch(() => setBranches([]));
    supabase
      .from('contacts')
      .select('id, name')
      .eq('company_id', companyId)
      .in('type', ['worker', 'supplier', 'both'])
      .order('name')
      .then(({ data }) => setWorkers((data ?? []) as Array<{ id: string; name: string }>))
      .catch(() => setWorkers([]));
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await bespokeWorkOrderService.listByCompany(companyId, {
        status: statusFilter,
        branchId: branchFilter !== 'all' ? branchFilter : undefined,
        tailorContactId: workerFilter !== 'all' ? workerFilter : undefined,
        search: search.trim() || undefined,
      });
      setOrders(list);
      const stockTargets = list.filter(
        (wo) => wo.status === 'completed' && wo.parent_sales_item_id && wo.sale_id,
      );
      const statuses = await Promise.all(
        stockTargets.map(async (wo) => ({
          id: wo.id,
          status: await getWorkOrderStockPostStatus(
            wo.id,
            wo.parent_sales_item_id,
            wo.sale_id,
            wo.work_order_no,
          ),
          active: await hasWorkOrderActiveStockMovements(wo.id, wo.work_order_no),
        })),
      );
      const map: Record<string, WorkOrderStockPostStatus> = {};
      const activeMap: Record<string, boolean> = {};
      for (const s of statuses) {
        map[s.id] = s.status;
        activeMap[s.id] = s.active;
      }
      setStockByWoId(map);
      setActiveStockByWoId(activeMap);
    } catch {
      setOrders([]);
      setStockByWoId({});
      setActiveStockByWoId({});
    } finally {
      setLoading(false);
    }
  }, [companyId, statusFilter, branchFilter, workerFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const handleMarkInProgress = async (woId: string) => {
    setBusyId(woId);
    try {
      await bespokeWorkOrderService.updateStatus(woId, 'in_progress');
      toast.success('Marked in progress');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleCompleteJob = async (woId: string) => {
    setBusyId(woId);
    try {
      const wo = orders.find((o) => o.id === woId);
      const result = await bespokeWorkOrderService.complete(woId, user?.id);
      if (result.stockWarning) {
        toast.warning(result.stockWarning);
      } else {
        toast.success('Job complete — stock posted (fabric + custom order).');
      }
      if (wo?.sale_id) {
        await nudgeConvertSaleToFinalAfterWoComplete({
          saleId: wo.sale_id,
          knownStatus: wo.sale?.status,
          openConvert: (sale) => {
            setCurrentView('sales');
            openDrawer('edit-sale', undefined, { sale, convertToFinal: true });
          },
        });
      }
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Complete failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelStock = async (woId: string) => {
    setBusyId(woId);
    try {
      const result = await bespokeWorkOrderService.cancelStockPost(woId, user?.id);
      if (result.stockMovementsReversed > 0) {
        toast.success(
          `Stock cancelled: ${result.stockMovementsReversed} reversal${result.stockMovementsReversed === 1 ? '' : 's'}.`,
        );
      } else {
        toast.info('No stock to reverse.');
      }
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Cancel stock failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelWorkOrder = async (woId: string, workOrderNo: string) => {
    const ok = window.confirm(
      `Cancel work order ${workOrderNo}?\n\nThis will reverse stock and void the production journal entry. The order stays in the list as Cancelled.`,
    );
    if (!ok) return;
    setBusyId(woId);
    try {
      await bespokeWorkOrderService.cancelWorkOrder(woId, user?.id);
      toast.success('Work order cancelled');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    if (!editWorkOrder) {
      setEditStockPosted(false);
      return;
    }
    void hasWorkOrderActiveStockMovements(editWorkOrder.id, editWorkOrder.work_order_no).then(
      setEditStockPosted,
    );
  }, [editWorkOrder]);

  const handlePostStock = async (woId: string) => {
    setBusyId(woId);
    try {
      const result = await bespokeWorkOrderService.repostWorkOrderStock(woId, user?.id);
      if (result.stockMovementsPosted > 0) {
        toast.success(
          `Stock posted: ${result.stockMovementsPosted} movement${result.stockMovementsPosted === 1 ? '' : 's'}.`,
        );
      } else if (result.stockWarning) {
        toast.warning(result.stockWarning);
      }
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Post stock failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-secondary">
      <div className="shrink-0 px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/30">
            <Scissors className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Work Orders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bespoke production jobs across all sales
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 mt-4 p-1 bg-input-background border border-border rounded-lg w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-all capitalize',
                statusFilter === tab
                  ? 'bg-violet-600 text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {tab === 'all' ? 'All' : tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search BWO, sale, worker…"
              className="pl-9 bg-input-background border-border"
            />
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[180px] bg-input-background border-border">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={workerFilter} onValueChange={setWorkerFilter}>
            <SelectTrigger className="w-[200px] bg-input-background border-border">
              <SelectValue placeholder="Worker" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workers</SelectItem>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-border" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="rounded-xl border border-border bg-muted/40 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Scissors className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No work orders found.</p>
              <p className="text-xs mt-1">Create one from a bespoke sale&apos;s detail drawer.</p>
            </div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead className="bg-muted/40 border-b border-border sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase font-medium">BWO #</th>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase font-medium">Worker</th>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase font-medium">Sale</th>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase font-medium">Branch</th>
                  <th className="px-4 py-3 text-right text-xs text-muted-foreground uppercase font-medium">Cost</th>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase font-medium">Created</th>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase font-medium">Completed</th>
                  <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase font-medium">Stock</th>
                  <th className="px-4 py-3 text-right text-xs text-muted-foreground uppercase font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((wo) => (
                  <tr
                    key={wo.id}
                    className="hover:bg-accent/30 cursor-pointer"
                    onClick={() => setSelectedId(wo.id)}
                  >
                    <td className="px-4 py-3 text-sm font-mono text-violet-300">{wo.work_order_no}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('text-[10px] capitalize', statusStyles[wo.status])}>
                        {wo.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{wo.tailor?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-blue-400">
                      {wo.sale?.invoice_no ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{wo.branch?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-foreground tabular-nums">
                      {formatCurrency(Number(wo.production_cost) || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {wo.created_at ? formatDateTime(wo.created_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {wo.completed_at ? formatDateTime(wo.completed_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {wo.status === 'completed' ? (
                        stockByWoId[wo.id]?.needsStockPost ? (
                          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                            Missing
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-green-500/40 text-[var(--erp-money-positive)]">
                            Posted
                          </Badge>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className="flex flex-wrap justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {wo.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-border text-xs"
                            disabled={busyId === wo.id}
                            onClick={() => void handleMarkInProgress(wo.id)}
                          >
                            {busyId === wo.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <PlayCircle className="h-3 w-3 mr-1" />
                            )}
                            In progress
                          </Button>
                        )}
                        {wo.status === 'in_progress' && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-violet-600 hover:bg-violet-500"
                            disabled={busyId === wo.id}
                            onClick={() => void handleCompleteJob(wo.id)}
                          >
                            {busyId === wo.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Complete job
                          </Button>
                        )}
                        {wo.status === 'completed' && stockByWoId[wo.id]?.needsStockPost && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-amber-500/40 text-amber-300 text-xs"
                            disabled={busyId === wo.id}
                            onClick={() => void handlePostStock(wo.id)}
                          >
                            {busyId === wo.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Package className="h-3 w-3 mr-1" />
                            )}
                            Post stock
                          </Button>
                        )}
                        {wo.status === 'completed' && activeStockByWoId[wo.id] && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-red-500/40 text-red-300 text-xs"
                            disabled={busyId === wo.id}
                            onClick={() => void handleCancelStock(wo.id)}
                          >
                            Cancel stock
                          </Button>
                        )}
                        {wo.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-border text-xs"
                            onClick={() => setEditWorkOrder(wo)}
                          >
                            Edit
                          </Button>
                        )}
                        {wo.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-red-500/40 text-red-300 text-xs"
                            disabled={busyId === wo.id}
                            onClick={() => void handleCancelWorkOrder(wo.id, wo.work_order_no)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ViewBespokeWorkOrderDrawer
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        workOrderId={selectedId}
        onUpdated={() => void load()}
      />

      {companyId && editWorkOrder && (
        <BespokeWorkOrderForm
          mode="edit"
          open={!!editWorkOrder}
          onOpenChange={(open) => {
            if (!open) setEditWorkOrder(null);
          }}
          companyId={companyId}
          workOrderId={editWorkOrder.id}
          workOrderNo={editWorkOrder.work_order_no}
          initialValues={{
            partyContactId: editWorkOrder.tailor_contact_id,
            productionCost: Number(editWorkOrder.production_cost) || 0,
            notes: editWorkOrder.notes,
            status: editWorkOrder.status,
            createdAt: editWorkOrder.created_at,
            completedAt: editWorkOrder.completed_at,
            stockPosted: editStockPosted,
          }}
          onSaved={() => {
            void load();
            setEditWorkOrder(null);
          }}
        />
      )}
    </div>
  );
}
