/**
 * Studio Production V3 Order Detail (Safe Zone)
 * Single order view: Customer, Fabric, Sale Date, Deadline, Stages, Worker Cost, Production Summary.
 * Final Complete → Invoice Panel (in-page): profit %, editable final price, breakdown, product, generate invoice.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  Loader2,
  Package,
  User,
  Calendar,
  Scissors,
  CheckCircle2,
  Plus,
  FileText,
  Truck,
  Eye,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { studioProductionV3Service } from '@/app/services/studioProductionV3Service';
import {
  getProductionCostSummaryV3,
  createProductFromProductionOrderV3,
  generateSalesInvoiceFromProductionV3,
} from '@/app/services/studioProductionV3InvoiceService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { StudioProductionOrderV3, StudioProductionStageV3 } from '@/app/services/studioProductionV3Service';

function safeFormatDate(val: string | null | undefined): string {
  if (val == null || val === '') return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '—' : format(d, 'dd MMM yyyy');
}

export const StudioProductionV3OrderDetail = () => {
  const { setCurrentView, selectedStudioOrderIdV3, setOpenSaleIdForView } = useNavigation();
  const { companyId, user } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [order, setOrder] = useState<StudioProductionOrderV3 | null>(null);
  const [stages, setStages] = useState<StudioProductionStageV3[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>('');
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoicePanelOpen, setInvoicePanelOpen] = useState(false);
  const [productionCost, setProductionCost] = useState(0);
  const [profitPercent, setProfitPercent] = useState<string>('25');
  const [finalPrice, setFinalPrice] = useState<string>('');
  const [shippingAmount, setShippingAmount] = useState<string>('0');
  const [showProductionDetail, setShowProductionDetail] = useState(false);
  const [productChoice, setProductChoice] = useState<'new' | 'existing'>('new');
  const [productNameInput, setProductNameInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [editingStageCost, setEditingStageCost] = useState<string | null>(null);
  const [editingCostValue, setEditingCostValue] = useState('');

  const orderId = selectedStudioOrderIdV3 ?? null;

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ord, stgs] = await Promise.all([
        studioProductionV3Service.getOrderById(orderId),
        studioProductionV3Service.getStagesByOrderId(orderId),
      ]);
      setOrder(ord);
      setStages(stgs);
      if (ord) {
        const cost = stgs.reduce((s, x) => s + (Number(x.actual_cost) || 0), 0);
        setProductionCost(cost);
        setFinalPrice(String(cost));
        const { data: sale } = await supabase
          .from('sales')
          .select('invoice_no, invoice_date, customer_name')
          .eq('id', ord.sale_id)
          .single();
        if (sale) {
          const s = sale as { invoice_no?: string; invoice_date?: string; customer_name?: string };
          setInvoiceNo(s.invoice_no ?? '');
          setSaleDate(s.invoice_date ?? '');
          if (s.customer_name) setCustomerName(s.customer_name);
        }
        if (ord.customer_id && !(sale as any)?.customer_name) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('name')
            .eq('id', ord.customer_id)
            .maybeSingle();
          setCustomerName((contact as { name?: string })?.name ?? '');
        }
      }
    } catch (e) {
      toast.error('Failed to load order');
      setOrder(null);
      setStages([]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('workers')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name')
      .then(({ data }) => setWorkers((data ?? []) as { id: string; name: string }[]));
  }, [companyId]);

  const allStagesCompleted = stages.length > 0 && stages.every((s) => s.status === 'completed');
  const canFinalComplete = allStagesCompleted && order?.status !== 'completed';

  const profitPct = parseFloat(profitPercent) || 0;
  const prodCost = productionCost;
  const profitAmt = (prodCost * profitPct) / 100;
  const computedFinal = prodCost + profitAmt;
  const displayFinal = finalPrice !== '' && !Number.isNaN(parseFloat(finalPrice)) ? parseFloat(finalPrice) : computedFinal;
  const displayProfitPct = prodCost > 0 ? ((displayFinal - prodCost) / prodCost) * 100 : 0;

  const handleFinalComplete = () => {
    if (!canFinalComplete || !orderId) return;
    setInvoicePanelOpen(true);
  };

  const handleAssignWorker = async (stageId: string, workerId: string) => {
    if (!workerId) return;
    setSaving(true);
    try {
      await studioProductionV3Service.assignWorker(stageId, workerId);
      await loadOrder();
    } catch (e: any) {
      toast.error(e?.message || 'Assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteStage = async (stageId: string, actualCost: number) => {
    setSaving(true);
    try {
      await studioProductionV3Service.completeStage(stageId, actualCost);
      const newCost = await studioProductionV3Service.recalculateProductionCost(orderId!);
      setProductionCost(newCost);
      setFinalPrice(String(newCost));
      setEditingStageCost(null);
      await loadOrder();
    } catch (e: any) {
      toast.error(e?.message || 'Complete failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!companyId || !orderId) return;
    const name = (productNameInput || 'Studio Product').trim();
    setCreatingProduct(true);
    try {
      await createProductFromProductionOrderV3({
        productionOrderId: orderId,
        productName: name,
        companyId,
      });
      toast.success('Product created and linked.');
      await loadOrder();
    } catch (e: any) {
      toast.error(e?.message || 'Create product failed');
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!orderId || !user?.id) return;
    const price = parseFloat(finalPrice);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Enter a valid final price.');
      return;
    }
    if (!order?.product_id) {
      toast.error('Create or link a product first.');
      return;
    }
    setGenerating(true);
    try {
      const shipping = parseFloat(shippingAmount) || 0;
      const created = await generateSalesInvoiceFromProductionV3({
        productionOrderId: orderId,
        finalPrice: price,
        shippingAmount: shipping,
        showProductionDetail,
        createdBy: user.id,
      });
      toast.success('Sales invoice generated.');
      setInvoicePanelOpen(false);
      await loadOrder();
      if (setOpenSaleIdForView) setOpenSaleIdForView(created.saleId);
      setCurrentView('sales');
    } catch (e: any) {
      toast.error((e as Error)?.message || 'Generate invoice failed');
    } finally {
      setGenerating(false);
    }
  };

  if (!orderId) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => setCurrentView('studio-pipeline')} className="text-gray-400">
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to Pipeline
        </Button>
        <p className="text-gray-500 mt-4">No order selected.</p>
      </div>
    );
  }

  if (loading || !order) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  const breakdownRows = [
    ...stages.map((s) => ({
      label: s.stage_name,
      value: Number(s.actual_cost) || 0,
    })),
    { label: 'Profit', value: Math.max(0, displayFinal - prodCost) },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentView('studio-pipeline')}
            className="text-gray-400 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">{order.production_no}</h1>
            <p className="text-sm text-gray-400">Studio Production Order (V3)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canFinalComplete && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleFinalComplete}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Final Complete
            </Button>
          )}
          {order.status === 'completed' && order.generated_invoice_id && (
            <Badge className="bg-green-600">Invoice generated</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-gray-400">Customer:</span>
            <span className="text-white">{customerName || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Scissors className="h-4 w-4 text-gray-500" />
            <span className="text-gray-400">Fabric:</span>
            <span className="text-white">{order.fabric || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-gray-400">Sale Date:</span>
            <span className="text-white">{saleDate ? safeFormatDate(saleDate) : '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Deadline:</span>
            <span className="text-white">{order.deadline ? safeFormatDate(order.deadline) : '—'}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-4">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-emerald-500" />
          Production Stages
        </h2>
        <div className="space-y-3">
          {stages.map((stage) => {
            const worker = stage.worker_id ? workers.find((w) => w.id === stage.worker_id) : null;
            const isEditingCost = editingStageCost === stage.id;
            return (
              <div
                key={stage.id}
                className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{stage.stage_name}</p>
                  <p className="text-xs text-gray-500">
                    {worker ? worker.name : 'Not assigned'}
                    {stage.status === 'completed' && (
                      <span className="ml-2 text-green-400"> · {formatCurrency(Number(stage.actual_cost) || 0)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {stage.status !== 'completed' ? (
                    <>
                      {isEditingCost ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            className="w-24 h-8 bg-gray-900"
                            value={editingCostValue}
                            onChange={(e) => setEditingCostValue(e.target.value)}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const v = parseFloat(editingCostValue);
                              if (Number.isFinite(v) && v >= 0) handleCompleteStage(stage.id, v);
                            }}
                          >
                            Done
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingStageCost(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <>
                          <select
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                            value={stage.worker_id || ''}
                            onChange={(e) => {
                              const id = e.target.value;
                              if (id) handleAssignWorker(stage.id, id);
                            }}
                          >
                            <option value="">Assign</option>
                            {workers.map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingStageCost(stage.id);
                              setEditingCostValue(String(stage.expected_cost || 0));
                            }}
                          >
                            Complete
                          </Button>
                        </>
                      )}
                    </>
                  ) : (
                    <Badge className="bg-green-600">Completed</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-4">
        <h2 className="text-base font-bold text-white mb-3">Production Cost Summary</h2>
        <div className="space-y-1">
          {stages.map((s) => (
            <div key={s.id} className="flex justify-between text-sm">
              <span className="text-gray-400">{s.stage_name}</span>
              <span className="text-white">{formatCurrency(Number(s.actual_cost) || 0)}</span>
            </div>
          ))}
          <div className="flex justify-between font-semibold text-white pt-2 border-t border-gray-700">
            <span>Total Production Cost</span>
            <span>{formatCurrency(productionCost)}</span>
          </div>
        </div>
      </div>

      {invoicePanelOpen && (
        <div className="rounded-lg border border-emerald-700/50 bg-gray-800/50 p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-500" />
            Invoice Generation Panel
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Production Cost</Label>
              <p className="text-xl font-semibold text-white">{formatCurrency(productionCost)}</p>
            </div>
            <div>
              <Label className="text-gray-400">Profit %</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                className="bg-gray-900 text-white"
                value={profitPercent}
                onChange={(e) => {
                  setProfitPercent(e.target.value);
                  const pct = parseFloat(e.target.value) || 0;
                  const amt = (productionCost * pct) / 100;
                  setFinalPrice(String(productionCost + amt));
                }}
              />
            </div>
            <div>
              <Label className="text-gray-400">Final Price (editable)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                className="bg-gray-900 text-white"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Profit: {formatCurrency(Math.max(0, displayFinal - prodCost))} ({displayProfitPct.toFixed(1)}%)
              </p>
            </div>
            <div>
              <Label className="text-gray-400">Shipping (optional)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                className="bg-gray-900 text-white"
                value={shippingAmount}
                onChange={(e) => setShippingAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded bg-gray-900/50 p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Production Breakdown</h3>
            {breakdownRows.map((r, i) => (
              <div key={i} className="flex justify-between text-sm py-1">
                <span className="text-gray-400">{r.label}</span>
                <span className="text-white">{formatCurrency(r.value)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-white pt-2 border-t border-gray-700">
              <span>Final Price</span>
              <span>{formatCurrency(displayFinal)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-detail"
              checked={showProductionDetail}
              onChange={(e) => setShowProductionDetail(e.target.checked)}
              className="rounded border-gray-600"
            />
            <Label htmlFor="show-detail" className="text-gray-400 flex items-center gap-1">
              <Eye className="h-4 w-4" /> Show Production Detail on invoice
            </Label>
          </div>

          {!order.product_id ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Product: Create new or use existing from linked sale.</p>
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Product name"
                  className="bg-gray-900 w-48"
                  value={productNameInput}
                  onChange={(e) => setProductNameInput(e.target.value)}
                />
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleCreateProduct}
                  disabled={creatingProduct}
                >
                  {creatingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Create New Product
                </Button>
              </div>
              <p className="text-xs text-gray-500">SKU will be auto-generated (e.g. STUDIO-DRESS-001).</p>
            </div>
          ) : (
            <p className="text-sm text-green-400">Product linked. You can generate the sales invoice.</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleGenerateInvoice}
              disabled={generating || !order.product_id}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Generate Sales Invoice
            </Button>
            <Button variant="outline" onClick={() => setInvoicePanelOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {order.status === 'completed' && !order.generated_invoice_id && !invoicePanelOpen && (
        <Button className="bg-green-600 hover:bg-green-700" onClick={() => setInvoicePanelOpen(true)}>
          Open Invoice Generation Panel
        </Button>
      )}
    </div>
  );
};
