import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { bespokeWorkOrderService, type BespokeWorkOrder } from '@/app/services/bespokeWorkOrderService';
import { BespokeWorkOrderForm } from './BespokeWorkOrderForm';
import { ViewBespokeWorkOrderDrawer } from './ViewBespokeWorkOrderDrawer';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';
import {
  getWorkOrderStockPostStatus,
  type WorkOrderStockPostStatus,
} from '@/app/services/bespokeFabricStockService';
import { CheckCircle2, Pencil, Package, Loader2 } from 'lucide-react';

export interface BespokeWorkOrdersPanelProps {
  saleId: string;
  companyId: string;
  branchId: string;
  parentItems: Array<{
    id: string;
    productName: string;
    customizationDetails?: Record<string, unknown> | null;
  }>;
  formatCurrency: (n: number) => string;
}

export function BespokeWorkOrdersPanel({
  saleId,
  companyId,
  branchId,
  parentItems,
  formatCurrency,
}: BespokeWorkOrdersPanelProps) {
  const { user } = useSupabase();
  const [orders, setOrders] = useState<BespokeWorkOrder[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formParent, setFormParent] = useState<{
    itemId: string;
    snapshot: Record<string, unknown>;
  } | null>(null);
  const [detailWorkOrderId, setDetailWorkOrderId] = useState<string | null>(null);
  const [editWorkOrder, setEditWorkOrder] = useState<BespokeWorkOrder | null>(null);
  const [stockByWoId, setStockByWoId] = useState<Record<string, WorkOrderStockPostStatus>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await bespokeWorkOrderService.listBySale(saleId);
      setOrders(list);
      const completed = list.filter(
        (wo) => wo.status === 'completed' && wo.parent_sales_item_id,
      );
      const statuses = await Promise.all(
        completed.map(async (wo) => ({
          id: wo.id,
          status: await getWorkOrderStockPostStatus(
            wo.id,
            wo.parent_sales_item_id,
            saleId,
            wo.work_order_no,
          ),
        })),
      );
      const map: Record<string, WorkOrderStockPostStatus> = {};
      for (const s of statuses) map[s.id] = s.status;
      setStockByWoId(map);
    } catch {
      setOrders([]);
      setStockByWoId({});
    }
  }, [saleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleComplete = async (id: string) => {
    setBusyId(id);
    try {
      const result = await bespokeWorkOrderService.complete(id, user?.id);
      if (result.stockWarning) {
        toast.warning(result.stockWarning);
      } else {
        toast.success('Job complete — stock posted (fabric + custom order).');
      }
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Complete failed');
    } finally {
      setBusyId(null);
    }
  };

  const handlePostStock = async (id: string) => {
    setBusyId(id);
    try {
      const result = await bespokeWorkOrderService.repostWorkOrderStock(id, user?.id);
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

  const handleCancelWorkOrder = async (id: string, workOrderNo: string) => {
    const ok = window.confirm(
      `Cancel work order ${workOrderNo}?\n\nThis will reverse stock and void the production journal entry.`,
    );
    if (!ok) return;
    setBusyId(id);
    try {
      await bespokeWorkOrderService.cancelWorkOrder(id, user?.id);
      toast.success('Work order cancelled');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-4 border border-border rounded-lg p-4 bg-card/40">
      <h3 className="text-sm font-semibold text-violet-300 mb-2">Bespoke work orders</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Internal production cost (hidden from customer invoice). Complete job posts payable, COGS, and stock OUT (like purchase Received).
      </p>

      {parentItems.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {parentItems.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="outline"
              className="text-xs border-violet-500/40"
              onClick={() => {
                setFormParent({
                  itemId: p.id,
                  snapshot: (p.customizationDetails as Record<string, unknown>) ?? {},
                });
                setFormOpen(true);
              }}
            >
              Work order — {p.productName}
            </Button>
          ))}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {parentItems.length === 0
            ? 'No sale lines to attach a work order.'
            : 'No work orders yet.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((wo) => (
            <li
              key={wo.id}
              className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-input-background border border-border"
            >
              <button
                type="button"
                onClick={() => setDetailWorkOrderId(wo.id)}
                className="flex-1 min-w-0 text-left hover:opacity-90 transition-opacity"
              >
                <span className="font-mono text-sm text-white">{wo.work_order_no}</span>
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {wo.status}
                </Badge>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cost: {formatCurrency(Number(wo.production_cost))}
                  {wo.tailor?.name ? ` · ${wo.tailor.name}` : ''}
                </p>
              </button>
              <div className="flex gap-1">
                {wo.status !== 'cancelled' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => setEditWorkOrder(wo)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
                {wo.status === 'completed' && stockByWoId[wo.id]?.needsStockPost && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-amber-500/40 text-amber-300"
                    disabled={busyId === wo.id}
                    onClick={() => void handlePostStock(wo.id)}
                  >
                    {busyId === wo.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Package className="h-3.5 w-3.5 mr-1" />
                    )}
                    Post stock
                  </Button>
                )}
                {wo.status !== 'completed' && wo.status !== 'cancelled' && (
                  <Button
                    size="sm"
                    className="h-7"
                    disabled={busyId === wo.id}
                    onClick={() => void handleComplete(wo.id)}
                  >
                    {busyId === wo.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    )}
                    Complete job
                  </Button>
                )}
                {wo.status !== 'cancelled' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-red-500/40 text-red-300"
                    disabled={busyId === wo.id}
                    onClick={() => void handleCancelWorkOrder(wo.id, wo.work_order_no)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {formParent && (
        <BespokeWorkOrderForm
          open={formOpen}
          onOpenChange={setFormOpen}
          companyId={companyId}
          branchId={branchId}
          saleId={saleId}
          parentSalesItemId={formParent.itemId}
          instructionsSnapshot={formParent.snapshot}
          onCreated={() => void load()}
        />
      )}

      <ViewBespokeWorkOrderDrawer
        isOpen={!!detailWorkOrderId}
        onClose={() => setDetailWorkOrderId(null)}
        workOrderId={detailWorkOrderId}
        onUpdated={() => void load()}
      />

      {editWorkOrder && (
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
