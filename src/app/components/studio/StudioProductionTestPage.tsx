/**
 * Studio Production Test Page – Step-based workflow (Option A)
 * Entry from Sale → Process selection → Worker assignment → Receive / Next → Final completion
 * Test-only: validates manager decision flow before main production code.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Package,
  Scissors,
  Palette,
  Sparkles,
  User,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useProduction } from '@/app/context/ProductionContext';
import { saleService } from '@/app/services/saleService';
import { studioService } from '@/app/services/studioService';
import {
  studioProductionService,
  type StudioProduction,
  type StudioProductionStage,
  type StudioProductionStageType,
} from '@/app/services/studioProductionService';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PROCESS_OPTIONS: { id: StudioProductionStageType; label: string; icon: React.ReactNode }[] = [
  { id: 'stitching', label: 'Stitching', icon: <Scissors size={24} /> },
  { id: 'dyer', label: 'Dyeing', icon: <Palette size={24} /> },
  { id: 'handwork', label: 'Handwork', icon: <Sparkles size={24} /> },
];

type StepId = 'entry' | 'process' | 'worker' | 'receive' | 'final';

const STEP_ORDER: StepId[] = ['entry', 'process', 'worker', 'receive', 'final'];

export const StudioProductionTestPage = () => {
  const { setCurrentView, selectedStudioSaleId } = useNavigation();
  const { companyId } = useSupabase();
  const { createProduction, changeStatus, refreshProductions } = useProduction();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saleData, setSaleData] = useState<{
    id: string;
    invoice_no: string;
    customer_name: string;
    product_id: string;
    product_name?: string;
    quantity: number;
    unit?: string;
  } | null>(null);
  const [production, setProduction] = useState<StudioProduction | null>(null);
  const [stages, setStages] = useState<StudioProductionStage[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string; worker_type?: string }[]>([]);

  const [currentStep, setCurrentStep] = useState<StepId>('entry');
  const [selectedProcess, setSelectedProcess] = useState<StudioProductionStageType | null>(null);
  const [workerForm, setWorkerForm] = useState({
    assigned_worker_id: '' as string | null,
    estimated_cost: 0,
    expected_date: '' as string,
    notes: '',
  });
  const [receiveStageId, setReceiveStageId] = useState<string | null>(null);
  const [receiveActualCost, setReceiveActualCost] = useState<string>('');
  const [finalConfirmChecked, setFinalConfirmChecked] = useState(false);

  const loadSale = useCallback(async () => {
    if (!selectedStudioSaleId) return null;
    try {
      const sale = await saleService.getSale(selectedStudioSaleId);
      const items = (sale as any).items || [];
      const first = items[0];
      const product = first?.product || {};
      const data = {
        id: (sale as any).id,
        invoice_no: (sale as any).invoice_no || (sale as any).invoiceNo || `#${selectedStudioSaleId.slice(0, 8)}`,
        customer_name: (sale as any).customer_name || (sale as any).customerName || '—',
        product_id: first?.product_id || product?.id || '',
        product_name: product?.name || first?.product_name,
        quantity: Number(first?.quantity) || 1,
        unit: first?.unit || product?.unit || 'piece',
      };
      setSaleData(data);
      return data;
    } catch (e) {
      console.error(e);
      toast.error('Could not load sale');
      setSaleData(null);
      return null;
    }
  }, [selectedStudioSaleId]);

  const loadWorkers = useCallback(async () => {
    if (!companyId) return;
    try {
      const list = await studioService.getAllWorkers(companyId);
      setWorkers((list || []).map((w: any) => ({ id: w.id, name: w.name || '', worker_type: w.worker_type })));
    } catch {
      setWorkers([]);
    }
  }, [companyId]);

  const loadStages = useCallback(async () => {
    if (!production?.id) return;
    try {
      const list = await studioProductionService.getStagesByProductionId(production.id);
      setStages(list);
    } catch {
      setStages([]);
    }
  }, [production?.id]);

  // Option A: Ensure production exists for this sale (fetch or auto-create). One-to-one link.
  const ensureProductionForSale = useCallback(
    async (salePayload: NonNullable<typeof saleData>) => {
      const existing = await studioProductionService.getProductionsBySaleId(salePayload.id);
      const active = (existing || []).filter((p) => p.status !== 'cancelled');
      if (active.length > 0) {
        setProduction(active[0]);
        return active[0];
      }
      const created = await createProduction({
        sale_id: salePayload.id,
        production_date: new Date().toISOString().split('T')[0],
        product_id: salePayload.product_id,
        quantity: salePayload.quantity,
        unit: salePayload.unit || 'piece',
        estimated_cost: 0,
        actual_cost: 0,
      });
      setProduction(created);
      return created;
    },
    [createProduction]
  );

  useEffect(() => {
    if (!selectedStudioSaleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadWorkers();
    (async () => {
      const sale = await loadSale();
      if (!sale) {
        setLoading(false);
        return;
      }
      try {
        await ensureProductionForSale(sale);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to ensure production');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedStudioSaleId, loadSale, ensureProductionForSale]);

  useEffect(() => {
    if (production?.id) loadStages();
  }, [production?.id, loadStages]);

  const handleStartProduction = async () => {
    if (!saleData || !companyId) return;
    setSaving(true);
    try {
      const created = await createProduction({
        sale_id: saleData.id,
        production_date: new Date().toISOString().split('T')[0],
        product_id: saleData.product_id,
        quantity: saleData.quantity,
        unit: saleData.unit || 'piece',
        estimated_cost: 0,
        actual_cost: 0,
      });
      setProduction(created);
      setCurrentStep('process');
      setSelectedProcess(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start production');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStage = async () => {
    if (!production?.id || !selectedProcess) return;
    if (!workerForm.assigned_worker_id) {
      toast.error('Worker is required');
      return;
    }
    if (workerForm.estimated_cost <= 0) {
      toast.error('Enter estimated cost (Rs)');
      return;
    }
    if (!workerForm.expected_date.trim()) {
      toast.error('Expected completion date is required');
      return;
    }
    setSaving(true);
    try {
      await studioProductionService.createStage(production.id, {
        stage_type: selectedProcess,
        assigned_worker_id: workerForm.assigned_worker_id || null,
        cost: workerForm.estimated_cost,
        expected_completion_date: workerForm.expected_date || null,
        notes: workerForm.notes || null,
      });
      await loadStages();
      setWorkerForm({ assigned_worker_id: null, estimated_cost: 0, expected_date: '', notes: '' });
      setSelectedProcess(null);
      setCurrentStep('receive');
      toast.success('Step added');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add step');
    } finally {
      setSaving(false);
    }
  };

  const handleReceiveFromWorker = async (stageId: string) => {
    const actual = parseFloat(receiveActualCost);
    if (isNaN(actual) || actual < 0) {
      toast.error('Enter valid actual cost');
      return;
    }
    setSaving(true);
    try {
      await studioProductionService.updateStage(stageId, {
        status: 'completed',
        cost: actual,
        completed_at: new Date().toISOString(),
      });
      await loadStages();
      setReceiveStageId(null);
      setReceiveActualCost('');
      toast.success('Step marked completed');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update step');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalComplete = async () => {
    if (!production?.id) return;
    const pending = stages.filter((s) => (s as any).status !== 'completed');
    if (pending.length > 0) {
      toast.error('Complete all steps before final completion');
      return;
    }
    setSaving(true);
    try {
      await changeStatus(production.id, 'completed');
      await refreshProductions();
      toast.success('Production completed. Sale finalized, worker ledger & inventory updated.');
      setCurrentStep('final');
    } catch (e: any) {
      toast.error(e?.message || 'Final completion failed');
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const canProceedFromProcess = selectedProcess != null;
  const allStagesCompleted = stages.length > 0 && stages.every((s) => (s as any).status === 'completed');

  if (!selectedStudioSaleId) {
    return (
      <div className="flex flex-col h-full bg-gray-950 text-white p-6">
        <Button variant="ghost" className="w-fit text-gray-400" onClick={() => setCurrentView('studio-dashboard-new')}>
          <ArrowLeft size={18} className="mr-2" />
          Back
        </Button>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <AlertCircle size={48} className="mx-auto mb-3 opacity-50" />
            <p>Open this page from a sale using &quot;Send to Studio&quot;.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !saleData) {
    return (
      <div className="flex flex-col h-full bg-gray-950 text-white items-center justify-center">
        <Loader2 size={40} className="animate-spin text-cyan-500" />
        <p className="mt-3 text-gray-400">Loading sale…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-900/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentView('studio-sale-detail-new')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Studio Production (Test)</h1>
            <p className="text-xs text-gray-500">Step-based workflow – sale-linked</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-amber-900/30 text-amber-400 border-amber-600/50">Test Page</Badge>
      </div>

      {/* Step indicator */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-800 flex items-center gap-2 flex-wrap">
        {STEP_ORDER.map((step, i) => {
          const active = currentStep === step;
          const done = stepIndex > i || (currentStep === 'final' && step !== 'final');
          return (
            <React.Fragment key={step}>
              <button
                type="button"
                onClick={() => setCurrentStep(step)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                  active && 'bg-cyan-600 text-white',
                  done && !active && 'bg-gray-700 text-gray-300',
                  !active && !done && 'text-gray-500'
                )}
              >
                {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                {step === 'entry' && 'Entry'}
                {step === 'process' && 'Process'}
                {step === 'worker' && 'Worker'}
                {step === 'receive' && 'Receive'}
                {step === 'final' && 'Final'}
              </button>
              {i < STEP_ORDER.length - 1 && <span className="text-gray-600">→</span>}
            </React.Fragment>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-3xl mx-auto w-full">
        {/* Step 1 – Entry: Sale read-only */}
        {currentStep === 'entry' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <FileText size={20} className="text-cyan-400" />
                Sale (read-only)
              </h2>
              <p className="text-xs text-gray-500 mb-3">No manual product select. Data comes from the linked sale.</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Invoice</p>
                  <p className="text-white font-medium">{saleData.invoice_no}</p>
                </div>
                <div>
                  <p className="text-gray-500">Customer</p>
                  <p className="text-white font-medium">{saleData.customer_name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Product</p>
                  <p className="text-white font-medium">{saleData.product_name || saleData.product_id}</p>
                </div>
                <div>
                  <p className="text-gray-500">Qty & Unit</p>
                  <p className="text-white font-medium">{saleData.quantity} {saleData.unit}</p>
                </div>
              </div>
            </div>
            {production && (
              <div className="flex items-center gap-2 text-sm text-cyan-400">
                <CheckCircle2 size={18} />
                Production linked: {(production as any).production_no}
              </div>
            )}
            <Button onClick={() => setCurrentStep('process')} className="bg-cyan-600 hover:bg-cyan-500 gap-2">
              Continue to Process selection
              <ArrowRight size={18} />
            </Button>
          </div>
        )}

        {/* Step 2 – Process selection */}
        {currentStep === 'process' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Select process</h2>
            <p className="text-sm text-gray-400">Yeh kaam kis process mein jayega? Sirf ek process ek time par.</p>
            {stages.length > 0 && (
              <p className="text-xs text-cyan-400">Already added: {stages.map((s) => (s as any).stage_type).join(', ')}. Select another to add.</p>
            )}
            <div className="grid grid-cols-3 gap-4">
              {PROCESS_OPTIONS.filter((opt) => !stages.some((s) => (s as any).stage_type === opt.id)).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedProcess(opt.id)}
                  className={cn(
                    'p-6 rounded-xl border-2 text-center transition-colors',
                    selectedProcess === opt.id
                      ? 'border-cyan-500 bg-cyan-900/30 text-cyan-300'
                      : 'border-gray-700 bg-gray-900/50 text-gray-400 hover:border-gray-600 hover:text-white'
                  )}
                >
                  <div className="flex justify-center mb-2">{opt.icon}</div>
                  <span className="font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            {PROCESS_OPTIONS.filter((opt) => !stages.some((s) => (s as any).stage_type === opt.id)).length === 0 && (
              <p className="text-sm text-gray-400">All processes added. Go to Receive to complete steps or Final completion.</p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(stages.length > 0 ? 'receive' : 'entry')} className="border-gray-600">
                Back
              </Button>
              <Button
                onClick={() => setCurrentStep('worker')}
                disabled={!canProceedFromProcess}
                className="bg-cyan-600 hover:bg-cyan-500 gap-2"
              >
                Next: Worker assignment
                <ArrowRight size={18} />
              </Button>
              {stages.length > 0 && (
                <Button variant="outline" onClick={() => setCurrentStep('receive')} className="border-gray-500 text-gray-300">
                  Go to Receive
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 3 – Worker assignment */}
        {currentStep === 'worker' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Worker assignment</h2>
            <p className="text-sm text-gray-400">
              Process: <strong className="text-white">{PROCESS_OPTIONS.find((p) => p.id === selectedProcess)?.label}</strong>. Assign worker and estimated cost.
            </p>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-400">Worker *</Label>
                <select
                  value={workerForm.assigned_worker_id || ''}
                  onChange={(e) => setWorkerForm((f) => ({ ...f, assigned_worker_id: e.target.value || null }))}
                  className="w-full mt-1 h-10 rounded-md border bg-gray-900 border-gray-700 text-white px-3"
                  required
                >
                  <option value="">Select worker</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-gray-400">Estimated cost (Rs) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={workerForm.estimated_cost || ''}
                  onChange={(e) => setWorkerForm((f) => ({ ...f, estimated_cost: Number(e.target.value) || 0 }))}
                  className="bg-gray-900 border-gray-700 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400">Expected completion date *</Label>
                <Input
                  type="date"
                  value={workerForm.expected_date}
                  onChange={(e) => setWorkerForm((f) => ({ ...f, expected_date: e.target.value }))}
                  className="bg-gray-900 border-gray-700 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400">Notes (optional)</Label>
                <Input
                  value={workerForm.notes}
                  onChange={(e) => setWorkerForm((f) => ({ ...f, notes: e.target.value }))}
                  className="bg-gray-900 border-gray-700 text-white mt-1"
                  placeholder="Instructions…"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('process')} className="border-gray-600">
                Back
              </Button>
              <Button
                onClick={handleAddStage}
                disabled={saving || !workerForm.assigned_worker_id || workerForm.estimated_cost <= 0 || !workerForm.expected_date.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Add this step
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 – Work in progress / Receive */}
        {currentStep === 'receive' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Receive from worker</h2>
            <p className="text-sm text-gray-400">Mark steps completed and capture actual cost. Then add next process or final complete.</p>
            {stages.length === 0 ? (
              <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 text-gray-400 text-sm">
                No steps yet. Go back to Process → Worker to add a step.
              </div>
            ) : (
              <div className="space-y-3">
                {stages.map((s) => {
                  const st = s as any;
                  const isCompleted = st.status === 'completed';
                  const isReceiving = receiveStageId === st.id;
                  return (
                    <div
                      key={st.id}
                      className={cn(
                        'p-4 rounded-xl border',
                        isCompleted ? 'bg-gray-900/30 border-gray-700' : 'bg-gray-900/50 border-gray-700'
                      )}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">{st.stage_type}</Badge>
                          <span className="text-white">{st.worker?.name || '—'}</span>
                          <span className="text-gray-500">Rs {Number(st.cost).toLocaleString()}</span>
                          {isCompleted && (
                            <Badge className="bg-green-900/30 text-green-400 border-green-700">Completed</Badge>
                          )}
                        </div>
                        {!isCompleted && (
                          <>
                            {!isReceiving ? (
                              <Button
                                size="sm"
                                onClick={() => setReceiveStageId(st.id)}
                                className="bg-cyan-600 hover:bg-cyan-500"
                              >
                                Receive from Worker
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  placeholder="Actual cost"
                                  value={receiveActualCost}
                                  onChange={(e) => setReceiveActualCost(e.target.value)}
                                  className="w-28 bg-gray-900 border-gray-700 text-white"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleReceiveFromWorker(st.id)}
                                  disabled={saving}
                                  className="bg-green-600 hover:bg-green-500"
                                >
                                  {saving ? <Loader2 size={14} className="animate-spin" /> : 'Confirm'}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setReceiveStageId(null); setReceiveActualCost(''); }}>
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              {allStagesCompleted ? (
                <Button variant="outline" onClick={() => { setSelectedProcess(null); setCurrentStep('process'); }} className="border-gray-600">
                  Add next process
                </Button>
              ) : (
                <p className="text-amber-400 text-sm">Complete all current steps (Receive) before adding another process.</p>
              )}
              <Button
                onClick={() => setCurrentStep('final')}
                className="bg-cyan-600 hover:bg-cyan-500"
              >
                Go to Final completion
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5 – Final completion (cost summary + confirm) */}
        {currentStep === 'final' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Final completion</h2>
            <p className="text-sm text-gray-400">
              On &quot;Final Complete&quot;: Production → Completed, Sale → Finalized, customer bill (worker costs added), worker ledger entries, inventory update.
            </p>
            {production && (production as any).status === 'completed' ? (
              <div className="p-4 rounded-xl bg-green-900/20 border border-green-700/50 text-green-300">
                <CheckCircle2 size={24} className="mb-2" />
                <p className="font-medium">Production completed.</p>
                <p className="text-sm mt-1">Sale finalized, worker ledger & inventory updated.</p>
              </div>
            ) : (
              <>
                {/* Phase 4: Cost summary */}
                {stages.length > 0 && (
                  <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <DollarSign size={18} className="text-cyan-400" />
                      Cost summary (will be applied to sale)
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {stages.map((s) => {
                        const st = s as any;
                        return (
                          <li key={st.id} className="flex justify-between text-gray-300">
                            <span className="capitalize">{st.stage_type}</span>
                            <span>{st.worker?.name || '—'}</span>
                            <span className="font-medium text-white">Rs {Number(st.cost).toLocaleString()}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between text-white font-semibold">
                      <span>Total studio charges</span>
                      <span>Rs {stages.reduce((sum, s) => sum + Number((s as any).cost || 0), 0).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">This amount will be added to the customer bill and recorded in worker ledger.</p>
                  </div>
                )}
                {stages.length > 0 && !allStagesCompleted && (
                  <p className="text-amber-400 text-sm">Complete all steps in &quot;Receive&quot; before final completion.</p>
                )}
                {stages.length > 0 && allStagesCompleted && (
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={finalConfirmChecked}
                      onChange={(e) => setFinalConfirmChecked(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-900 text-cyan-500"
                    />
                    I confirm these costs and want to finalize production (sale, ledger, inventory).
                  </label>
                )}
                <Button
                  onClick={handleFinalComplete}
                  disabled={
                    saving ||
                    (stages.length > 0 && !allStagesCompleted) ||
                    (stages.length > 0 && allStagesCompleted && !finalConfirmChecked)
                  }
                  className="bg-green-600 hover:bg-green-500 gap-2"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Final Complete
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setCurrentView('studio-production-list')} className="border-gray-600">
              Back to Production list
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
