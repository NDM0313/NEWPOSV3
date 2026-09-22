import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  User,
  Phone,
  FileText,
  Printer,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Scissors,
  Building2,
  Calendar,
  DollarSign,
  Pencil,
  Package,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { cn } from '../ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import {
  bespokeWorkOrderService,
  type BespokeWorkOrderDetail,
  type BespokeWorkOrderStatus,
} from '@/app/services/bespokeWorkOrderService';
import { BespokeInstructionBullets } from './BespokeInstructionBullets';
import { BespokeJobCardTemplate } from './BespokeJobCardTemplate';
import { BespokeWorkOrderForm } from './BespokeWorkOrderForm';
import { getBespokeInstructionBullets } from '@/app/types/bespoke';
import { toast } from 'sonner';
import {
  getWorkOrderStockPostStatus,
  hasWorkOrderActiveStockMovements,
  type WorkOrderStockPostStatus,
} from '@/app/services/bespokeFabricStockService';
import { nudgeConvertSaleToFinalAfterWoComplete } from './nudgeConvertSaleToFinal';

const statusStyles: Record<BespokeWorkOrderStatus, string> = {
  draft: 'bg-gray-500/20 text-muted-foreground border-gray-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-[var(--erp-money-positive)] border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export interface ViewBespokeWorkOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string | null;
  onUpdated?: () => void;
}

export function ViewBespokeWorkOrderDrawer({
  isOpen,
  onClose,
  workOrderId,
  onUpdated,
}: ViewBespokeWorkOrderDrawerProps) {
  const { user, companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { formatDateTime } = useFormatDate();
  const { setCurrentView, setOpenSaleIdForView, openDrawer } = useNavigation();
  const [workOrder, setWorkOrder] = useState<BespokeWorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [postingFabric, setPostingFabric] = useState(false);
  const [stockStatus, setStockStatus] = useState<WorkOrderStockPostStatus | null>(null);
  const [stockPosted, setStockPosted] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!workOrderId) {
      setWorkOrder(null);
      return;
    }
    setLoading(true);
    try {
      const row = await bespokeWorkOrderService.getById(workOrderId);
      setWorkOrder(row);
      if (row?.status === 'completed' && row.sale_id && row.parent_sales_item_id) {
        const [status, active] = await Promise.all([
          getWorkOrderStockPostStatus(
            row.id,
            row.parent_sales_item_id,
            row.sale_id,
            row.work_order_no,
          ),
          hasWorkOrderActiveStockMovements(row.id, row.work_order_no),
        ]);
        setStockStatus(status);
        setStockPosted(active);
      } else {
        setStockStatus(null);
        setStockPosted(false);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load work order');
      setWorkOrder(null);
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    if (isOpen && workOrderId) {
      void load();
    } else {
      setWorkOrder(null);
      setPrintOpen(false);
      setEditOpen(false);
    }
  }, [isOpen, workOrderId, load]);

  const handleComplete = async () => {
    if (!workOrder) return;
    setCompleting(true);
    try {
      const result = await bespokeWorkOrderService.complete(workOrder.id, user?.id);
      if (result.stockWarning) {
        toast.warning(result.stockWarning);
      } else {
        toast.success('Job complete — stock posted (fabric + custom order).');
      }
      await nudgeConvertSaleToFinalAfterWoComplete({
        saleId: workOrder.sale_id,
        knownStatus: workOrder.sale?.status,
        openConvert: (sale) => {
          setCurrentView('sales');
          openDrawer('edit-sale', undefined, { sale, convertToFinal: true });
          onClose();
        },
      });
      await load();
      onUpdated?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Complete failed');
    } finally {
      setCompleting(false);
    }
  };

  const handlePostStock = async () => {
    if (!workOrder) return;
    setPostingFabric(true);
    try {
      const result = await bespokeWorkOrderService.repostWorkOrderStock(workOrder.id, user?.id);
      if (result.stockMovementsPosted > 0) {
        toast.success(
          `Stock posted: ${result.stockMovementsPosted} movement${result.stockMovementsPosted === 1 ? '' : 's'} (fabric + custom line).`,
        );
      } else if (result.stockWarning) {
        toast.warning(result.stockWarning);
      }
      await load();
      onUpdated?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Post stock failed');
    } finally {
      setPostingFabric(false);
    }
  };

  const handleMarkInProgress = async () => {
    if (!workOrder) return;
    try {
      await bespokeWorkOrderService.updateStatus(workOrder.id, 'in_progress');
      toast.success('Marked in progress');
      await load();
      onUpdated?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleCancelWorkOrder = async () => {
    if (!workOrder) return;
    const ok = window.confirm(
      `Cancel work order ${workOrder.work_order_no}?\n\nThis will reverse stock and void the production journal entry.`,
    );
    if (!ok) return;
    setCompleting(true);
    try {
      await bespokeWorkOrderService.cancelWorkOrder(workOrder.id, user?.id);
      toast.success('Work order cancelled');
      await load();
      onUpdated?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setCompleting(false);
    }
  };

  const openLinkedSale = () => {
    if (!workOrder?.sale_id) return;
    setOpenSaleIdForView?.(workOrder.sale_id);
    setCurrentView('sales');
    onClose();
  };

  if (!isOpen) return null;

  const canComplete =
    workOrder &&
    workOrder.status !== 'completed' &&
    workOrder.status !== 'cancelled';
  const canMarkInProgress = workOrder?.status === 'draft';
  const canEdit = workOrder && workOrder.status !== 'cancelled';
  const canPostStock =
    workOrder?.status === 'completed' && stockStatus?.needsStockPost === true;
  const instructionBullets = workOrder
    ? getBespokeInstructionBullets(workOrder.instructions_snapshot)
    : [];

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} aria-hidden />
      <div className="fixed right-0 top-0 h-full w-full md:w-[640px] bg-input-background shadow-2xl z-[61] overflow-hidden flex flex-col border-l border-border">
        <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/30">
              <Scissors className="h-5 w-5 text-violet-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">
                {workOrder?.work_order_no ?? 'Work order'}
              </h2>
              <p className="text-xs text-muted-foreground">Bespoke production job</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground shrink-0" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          ) : !workOrder ? (
            <p className="text-sm text-muted-foreground text-center py-12">Work order not found.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('text-xs capitalize', statusStyles[workOrder.status])}>
                  {workOrder.status.replace('_', ' ')}
                </Badge>
                {workOrder.branch?.name && (
                  <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                    <Building2 className="h-3 w-3 mr-1" />
                    {workOrder.branch.name}
                  </Badge>
                )}
              </div>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Worker / supplier</h3>
                <div className="rounded-lg border border-border bg-card/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-white">
                    <User className="h-4 w-4 text-violet-400" />
                    <span className="font-medium">{workOrder.tailor?.name ?? '—'}</span>
                  </div>
                  {workOrder.tailor?.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {workOrder.tailor.phone}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked sale</h3>
                <button
                  type="button"
                  onClick={openLinkedSale}
                  className="w-full text-left rounded-lg border border-border bg-card/40 p-4 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm text-blue-400">
                        {workOrder.sale?.invoice_no ?? workOrder.sale_id.slice(0, 8)}
                      </p>
                      {workOrder.sale?.customer_name && (
                        <p className="text-sm text-muted-foreground mt-0.5">{workOrder.sale.customer_name}</p>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 shrink-0" />
                  </div>
                </button>
              </section>

              {workOrder.parent_item?.product_name && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Line item</h3>
                  <p className="text-sm text-gray-200">{workOrder.parent_item.product_name}</p>
                </section>
              )}

              <Separator className="bg-muted" />

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Design instructions</h3>
                <div className="rounded-lg border border-border bg-card/40 p-4">
                  {instructionBullets.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No instructions recorded.</p>
                  ) : (
                    <BespokeInstructionBullets customizationDetails={workOrder.instructions_snapshot} />
                  )}
                  {workOrder.notes && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      <span className="text-muted-foreground font-medium">Internal notes:</span> {workOrder.notes}
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                <div className="flex items-center gap-2 text-violet-300">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm font-medium">Production cost</span>
                </div>
                <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
                  {formatCurrency(Number(workOrder.production_cost) || 0)}
                </p>
              </section>

              <section className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                    <Calendar className="h-3 w-3" />
                    Created
                  </div>
                  <p className="text-muted-foreground">
                    {workOrder.created_at ? formatDateTime(workOrder.created_at) : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </div>
                  <p className="text-muted-foreground">
                    {workOrder.completed_at ? formatDateTime(workOrder.completed_at) : '—'}
                  </p>
                </div>
              </section>

              {workOrder.status === 'completed' && stockStatus?.needsStockPost && (
                <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                  Stock has not been fully posted for this job. Use Post stock below (fabric meters
                  and custom order line) or check fabric lines are linked on the sale.
                </section>
              )}

              {workOrder.journal_entry_id && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accounting</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border border-border bg-card/40 p-3">
                    <FileText className="h-4 w-4 text-[var(--erp-money-positive)]" />
                    Journal:{' '}
                    <span className="font-mono text-[var(--erp-money-positive)]">
                      {workOrder.journal_entry?.entry_no ?? workOrder.journal_entry_id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dr 5000 Cost of Production · Cr worker/supplier payable
                  </p>
                </section>
              )}
            </>
          )}
        </div>

        {workOrder && (
          <div className="shrink-0 px-6 py-4 border-t border-border bg-muted/40 flex flex-wrap gap-2">
            <Button variant="outline" className="border-border" onClick={() => setPrintOpen(true)}>
              <Printer className="h-4 w-4 mr-2" />
              Print job card
            </Button>
            {canEdit && (
              <Button variant="outline" className="border-border" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {canMarkInProgress && (
              <Button variant="outline" className="border-blue-500/40 text-blue-400" onClick={() => void handleMarkInProgress()}>
                Mark in progress
              </Button>
            )}
            {canPostStock && (
              <Button
                variant="outline"
                className="border-amber-500/40 text-amber-300"
                disabled={postingFabric}
                onClick={() => void handlePostStock()}
              >
                {postingFabric ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Package className="h-4 w-4 mr-2" />
                )}
                Post stock
              </Button>
            )}
            {canComplete && (
              <Button
                className="bg-violet-600 hover:bg-violet-500"
                disabled={completing}
                onClick={() => void handleComplete()}
              >
                {completing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Complete job
              </Button>
            )}
            {canEdit && (
              <Button
                variant="outline"
                className="border-red-500/40 text-red-300"
                disabled={completing}
                onClick={() => void handleCancelWorkOrder()}
              >
                Cancel work order
              </Button>
            )}
          </div>
        )}
      </div>

      {printOpen && workOrder && (
        <div className="fixed inset-0 z-[200] bg-black/80 overflow-auto p-4 print:relative print:bg-white print:p-0">
          <div className="max-w-3xl mx-auto mb-4 flex gap-2 print:hidden">
            <Button onClick={() => window.print()}>Print job card</Button>
            <Button variant="outline" onClick={() => setPrintOpen(false)}>
              Close
            </Button>
          </div>
          <BespokeJobCardTemplate
            workOrder={workOrder}
            partyName={workOrder.tailor?.name ?? 'Worker / Supplier'}
            formatCurrency={formatCurrency}
          />
        </div>
      )}

      {companyId && workOrder && (
        <BespokeWorkOrderForm
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          companyId={companyId}
          workOrderId={workOrder.id}
          workOrderNo={workOrder.work_order_no}
          initialValues={{
            partyContactId: workOrder.tailor_contact_id,
            productionCost: Number(workOrder.production_cost) || 0,
            notes: workOrder.notes,
            status: workOrder.status,
            createdAt: workOrder.created_at,
            completedAt: workOrder.completed_at,
            stockPosted,
          }}
          onSaved={() => {
            void load();
            onUpdated?.();
          }}
        />
      )}
    </>
  );
}
