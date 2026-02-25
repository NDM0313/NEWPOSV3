import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, Loader2, Package, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { DatePicker } from '../ui/DatePicker';
import { Textarea } from '../ui/textarea';
import { useNavigation } from '@/app/context/NavigationContext';
import { useProduction } from '@/app/context/ProductionContext';
import { productService } from '@/app/services/productService';
import { studioService } from '@/app/services/studioService';
import { saleService } from '@/app/services/saleService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { cn } from '../ui/utils';
import { toast } from 'sonner';

export const StudioProductionAddPage = () => {
  const { setCurrentView, selectedStudioSaleId } = useNavigation();
  const { createProduction } = useProduction();
  const { companyId } = useSupabase();
  const [products, setProducts] = useState<{ id: string; name: string; sku?: string }[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [linkedSaleInfo, setLinkedSaleInfo] = useState<{ invoiceNo: string; product_id?: string; quantity?: number } | null>(null);

  // Option A: Studio production must be linked to a sale. No standalone production.
  const saleIdRequired = selectedStudioSaleId;
  const [form, setForm] = useState({
    production_date: new Date().toISOString().split('T')[0],
    product_id: '',
    variation_id: '' as string | null,
    quantity: 1,
    boxes: '' as number | string,
    pieces: '' as number | string,
    unit: 'piece',
    estimated_cost: 0,
    actual_cost: 0,
    start_date: '' as string | null,
    expected_date: '' as string | null,
    assigned_worker_id: '' as string | null,
    assigned_machine_or_karigar: '' as string | null,
    notes: '' as string | null,
    instructions: '' as string | null,
  });

  const loadProducts = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await productService.getAllProducts(companyId);
      setProducts((data || []).map((p: any) => ({ id: p.id, name: p.name || '', sku: p.sku })));
    } catch { setProducts([]); }
  }, [companyId]);

  const loadWorkers = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await studioService.getAllWorkers(companyId);
      setWorkers((data || []).map((w: any) => ({ id: w.id, name: w.name || '' })));
    } catch { setWorkers([]); }
  }, [companyId]);

  useEffect(() => { loadProducts(); loadWorkers(); }, [loadProducts, loadWorkers]);

  // When opened from dashboard "Shift to Production", prefill from linked sale if possible
  useEffect(() => {
    if (!selectedStudioSaleId || !companyId) return;
    (async () => {
      try {
        let orderOrSale: any = null;
        try {
          orderOrSale = await studioService.getStudioOrder(selectedStudioSaleId);
        } catch {
          orderOrSale = await saleService.getSale(selectedStudioSaleId);
        }
        if (!orderOrSale) return;
        const invoiceNo = orderOrSale.order_no || orderOrSale.invoice_no || `#${selectedStudioSaleId.slice(0, 8)}`;
        const items = orderOrSale.items || [];
        const first = items[0];
        setLinkedSaleInfo({
          invoiceNo,
          product_id: first?.product_id || first?.product?.id,
          quantity: first?.quantity ? Number(first.quantity) : undefined,
        });
        if (first?.product_id || first?.product?.id) {
          setForm(f => ({
            ...f,
            product_id: first.product_id || first.product?.id || f.product_id,
            quantity: first.quantity ? Number(first.quantity) : f.quantity,
          }));
        }
      } catch {
        setLinkedSaleInfo({ invoiceNo: `#${selectedStudioSaleId?.slice(0, 8) || ''}` });
      }
    })();
  }, [selectedStudioSaleId, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleIdRequired) {
      toast.error('Studio production must be linked to a sale. Create or open a Studio sale first.');
      return;
    }
    if (!form.product_id || form.quantity <= 0) {
      toast.error('Product and quantity ( > 0) are required');
      return;
    }
    setSaving(true);
    try {
      await createProduction({
        sale_id: saleIdRequired,
        production_date: form.production_date,
        product_id: form.product_id,
        variation_id: form.variation_id || null,
        quantity: Number(form.quantity),
        boxes: form.boxes === '' ? null : Number(form.boxes),
        pieces: form.pieces === '' ? null : Number(form.pieces),
        unit: form.unit,
        estimated_cost: Number(form.estimated_cost) || 0,
        actual_cost: Number(form.actual_cost) || 0,
        start_date: form.start_date || null,
        expected_date: form.expected_date || null,
        assigned_worker_id: form.assigned_worker_id || null,
        assigned_machine_or_karigar: form.assigned_machine_or_karigar || null,
        notes: form.notes || null,
        instructions: form.instructions || null,
      });
      setCurrentView('studio-sales-list-new');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create production');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4 flex items-center gap-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView('studio-sales-list-new')} className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-xl font-bold text-white">Add Production Job</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-6 max-w-2xl space-y-6">
        {!saleIdRequired ? (
          <div className="flex flex-col gap-2 p-4 rounded-lg bg-amber-900/30 border border-amber-600/50 text-amber-200 text-sm">
            <span className="font-medium">Sale required</span>
            <span>Studio production must be linked to a sale. Create a Studio sale from Sales (Sale Type: Studio), then you will be brought here automatically, or open a Studio sale from the Studio dashboard and choose &quot;Add Production&quot;.</span>
            <Button type="button" variant="outline" onClick={() => setCurrentView('studio-dashboard-new')} className="mt-2 border-amber-600 text-amber-200 w-fit">
              Go to Studio dashboard
            </Button>
          </div>
        ) : null}
        {linkedSaleInfo && saleIdRequired && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-900/20 border border-cyan-700/50 text-cyan-300 text-sm">
            <FileText size={18} />
            <span>Linked to sale: {linkedSaleInfo.invoiceNo}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-400">Production Date *</Label>
            <DatePicker
              value={form.production_date}
              onChange={(v) => setForm(f => ({ ...f, production_date: v }))}
              placeholder="Select date"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-400">Product *</Label>
            <select
              value={form.product_id}
              onChange={(e) => setForm(f => ({ ...f, product_id: e.target.value }))}
              className={cn('w-full mt-1 h-10 rounded-md border bg-gray-900 border-gray-700 text-white px-3')}
              required
            >
              <option value="">Select product</option>
              {products.map(pr => <option key={pr.id} value={pr.id}>{pr.name} {pr.sku ? `(${pr.sku})` : ''}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-400">Quantity *</Label>
            <Input
              type="number"
              min={0.01}
              step={1}
              value={form.quantity}
              onChange={(e) => setForm(f => ({ ...f, quantity: Number(e.target.value) || 0 }))}
              className="bg-gray-900 border-gray-700 text-white mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-gray-400">Unit</Label>
            <Input
              value={form.unit}
              onChange={(e) => setForm(f => ({ ...f, unit: e.target.value }))}
              className="bg-gray-900 border-gray-700 text-white mt-1"
              placeholder="piece"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-400">Estimated Cost</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.estimated_cost}
              onChange={(e) => setForm(f => ({ ...f, estimated_cost: Number(e.target.value) || 0 }))}
              className="bg-gray-900 border-gray-700 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-400">Actual Cost</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.actual_cost}
              onChange={(e) => setForm(f => ({ ...f, actual_cost: Number(e.target.value) || 0 }))}
              className="bg-gray-900 border-gray-700 text-white mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-400">Start Date</Label>
            <DatePicker
              value={form.start_date || ''}
              onChange={(v) => setForm(f => ({ ...f, start_date: v || null }))}
              placeholder="Select date"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-400">Expected Completion</Label>
            <DatePicker
              value={form.expected_date || ''}
              onChange={(v) => setForm(f => ({ ...f, expected_date: v || null }))}
              placeholder="Select date"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-gray-400">Assigned Worker / Karigar</Label>
          <select
            value={form.assigned_worker_id || ''}
            onChange={(e) => setForm(f => ({ ...f, assigned_worker_id: e.target.value || null }))}
            className={cn('w-full mt-1 h-10 rounded-md border bg-gray-900 border-gray-700 text-white px-3')}
          >
            <option value="">None</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <div>
          <Label className="text-gray-400">Notes</Label>
          <Textarea
            value={form.notes || ''}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value || null }))}
            className="bg-gray-900 border-gray-700 text-white mt-1"
            rows={2}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving || !saleIdRequired} className="bg-blue-600 hover:bg-blue-500 gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />}
            Create Production Job
          </Button>
          <Button type="button" variant="outline" onClick={() => setCurrentView('studio-sales-list-new')} className="border-gray-600 text-gray-300">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};
