/**
 * Manufacturing: Production Orders. List and create orders; open workflow for steps.
 */
import React, { useState, useEffect } from 'react';
import { productionOrderService, type ProductionOrderRow } from '@/app/services/productionOrderService';
import { productService } from '@/app/services/productService';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { ClipboardList, Plus, Loader2, ExternalLink } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { toast } from 'sonner';

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-green-500/10 text-green-600',
  cancelled: 'bg-red-500/10 text-red-600',
};

export const ProductionOrdersPage: React.FC = () => {
  const { companyId } = useSupabase();
  const { setCurrentView, setSelectedManufacturingOrderId } = useNavigation();
  const [orders, setOrders] = useState<ProductionOrderRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [orderData, prodData] = await Promise.all([
        productionOrderService.listByCompany(companyId),
        productService.getAllProducts(companyId),
      ]);
      setOrders(orderData);
      setProducts((prodData || []).map((p: any) => ({ id: p.id, name: p.name || p.id, sku: p.sku })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const openAdd = () => {
    setProductId('');
    setQuantity('1');
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!companyId || !productId) {
      toast.error('Select a product');
      return;
    }
    const qty = parseFloat(quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be a positive number');
      return;
    }
    setSaving(true);
    try {
      await productionOrderService.create({
        company_id: companyId,
        product_id: productId,
        quantity: qty,
        status: 'draft',
      });
      toast.success('Production order created');
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const openWorkflow = (orderId: string) => {
    setSelectedManufacturingOrderId?.(orderId);
    setCurrentView('manufacturing-workflow');
  };

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Production Orders
        </h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Order #</th>
                <th className="text-left p-3 font-medium">Product</th>
                <th className="text-right p-3 font-medium">Qty</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Dates</th>
                <th className="w-24 p-3" />
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No production orders. Create one to start manufacturing.
                  </td>
                </tr>
              ) : (
                orders.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-mono">{row.order_number ?? row.id.slice(0, 8)}</td>
                    <td className="p-3">{productName(row.product_id)}</td>
                    <td className="p-3 text-right">{row.quantity}</td>
                    <td className="p-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {row.start_date ?? '—'} → {row.end_date ?? '—'}
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm" onClick={() => openWorkflow(row.id)}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Steps
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Production Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <label className="text-sm font-medium">Product</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(${p.sku})` : ''}
                </option>
              ))}
            </select>
            <label className="text-sm font-medium">Quantity</label>
            <Input
              type="number"
              min="0.0001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
