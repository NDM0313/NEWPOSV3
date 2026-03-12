/**
 * Manufacturing: Production workflow — steps for one production order (Cutting, Dyeing, Stitching, Handwork).
 */
import React, { useState, useEffect } from 'react';
import { productionOrderService, type ProductionOrderRow } from '@/app/services/productionOrderService';
import { productionStepService, type ProductionStepRow, DEFAULT_STEP_NAMES } from '@/app/services/productionStepService';
import { productService } from '@/app/services/productService';
import { supabase } from '@/lib/supabase';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { ArrowLeft, Loader2, CheckCircle2, Circle, UserPlus } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { toast } from 'sonner';

export const ProductionWorkflow: React.FC = () => {
  const { companyId } = useSupabase();
  const { setCurrentView, selectedManufacturingOrderId } = useNavigation();
  const [order, setOrder] = useState<ProductionOrderRow | null>(null);
  const [steps, setSteps] = useState<ProductionStepRow[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState<ProductionStepRow | null>(null);
  const [costInput, setCostInput] = useState('');
  const [saving, setSaving] = useState(false);

  const orderId = selectedManufacturingOrderId;

  const load = async () => {
    if (!orderId || !companyId) return;
    setLoading(true);
    try {
      const [orderRow, stepsData, workersData] = await Promise.all([
        productionOrderService.getById(orderId),
        productionStepService.listByOrder(orderId),
        supabase.from('workers').select('id, name').eq('company_id', companyId).order('name'),
      ]);
      setOrder(orderRow ?? null);
      setSteps(stepsData);
      setWorkers(workersData.data ?? []);

      if (stepsData.length === 0 && orderRow) {
        const created = await productionStepService.createStepsForOrder(orderId, [...DEFAULT_STEP_NAMES]);
        setSteps(created);
      }

      if (orderRow?.product_id) {
        const { data: p } = await supabase.from('products').select('name').eq('id', orderRow.product_id).maybeSingle();
        setProductName((p as any)?.name ?? orderRow.product_id.slice(0, 8));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
      setOrder(null);
      setSteps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [orderId, companyId]);

  const handleStartOrder = async () => {
    if (!orderId) return;
    try {
      await productionOrderService.update(orderId, {
        status: 'in_progress',
        start_date: new Date().toISOString().slice(0, 10),
      });
      toast.success('Order started');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleCompleteStep = async (step: ProductionStepRow) => {
    try {
      const cost = costInput ? parseFloat(costInput) : step.cost;
      await productionStepService.setCompleted(step.id, Number.isFinite(cost) ? cost : undefined);
      setAssignModal(null);
      setCostInput('');
      toast.success(`${step.step_name} completed`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignWorker = async (stepId: string, workerId: string) => {
    setSaving(true);
    try {
      await productionStepService.update(stepId, { worker_id: workerId, status: 'in_progress' });
      setAssignModal(null);
      toast.success('Worker assigned');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const workerName = (id: string | null) => (id ? workers.find((w) => w.id === id)?.name ?? id.slice(0, 8) : '—');

  if (!orderId) {
    return (
      <div className="p-4 md:p-6">
        <Button variant="ghost" onClick={() => setCurrentView('manufacturing-orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Production Orders
        </Button>
        <p className="mt-4 text-muted-foreground">Select an order from Production Orders to view its workflow.</p>
      </div>
    );
  }

  if (loading || !order) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('manufacturing-orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              {order.order_number ?? order.id.slice(0, 8)} — {productName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Qty: {order.quantity} · Status: {order.status}
            </p>
          </div>
        </div>
        {order.status === 'draft' && (
          <Button onClick={handleStartOrder}>Start Production</Button>
        )}
      </div>

      <div className="rounded-lg border divide-y">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="flex items-center justify-between p-4 hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              {step.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="font-medium">{step.step_name}</span>
              <span className="text-sm text-muted-foreground">{workerName(step.worker_id)}</span>
              {step.cost > 0 && (
                <span className="text-sm">Cost: {step.cost}</span>
              )}
            </div>
            <div className="flex gap-2">
              {step.status !== 'completed' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAssignModal(step);
                      setCostInput('');
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Assign / Complete
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!assignModal} onOpenChange={() => setAssignModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{assignModal?.step_name ?? 'Step'} — Assign worker & complete</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <label className="text-sm font-medium">Worker (optional)</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              onChange={(e) => {
                const id = e.target.value;
                if (id && assignModal) handleAssignWorker(assignModal.id, id);
              }}
            >
              <option value="">— Select worker —</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <label className="text-sm font-medium">Cost (optional)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              placeholder={String(assignModal?.cost ?? 0)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAssignModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => assignModal && handleCompleteStep(assignModal)}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark complete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
