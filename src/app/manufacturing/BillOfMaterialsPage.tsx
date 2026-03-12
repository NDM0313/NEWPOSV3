/**
 * Manufacturing: Bill of Materials. Product → materials with quantity.
 */
import React, { useState, useEffect } from 'react';
import { bomService, type BomRow } from '@/app/services/bomService';
import { productService } from '@/app/services/productService';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Layers, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';

export const BillOfMaterialsPage: React.FC = () => {
  const { companyId } = useSupabase();
  const [list, setList] = useState<BomRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [quantityRequired, setQuantityRequired] = useState('1');

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [bomData, prodData] = await Promise.all([
        bomService.listByCompany(companyId),
        productService.getAllProducts(companyId),
      ]);
      setList(bomData);
      setProducts((prodData || []).map((p: any) => ({ id: p.id, name: p.name || p.id, sku: p.sku })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load BOM');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const openAdd = () => {
    setEditingId(null);
    setProductId('');
    setMaterialId('');
    setQuantityRequired('1');
    setModalOpen(true);
  };

  const openEdit = (row: BomRow) => {
    setEditingId(row.id);
    setProductId(row.product_id);
    setMaterialId(row.material_id);
    setQuantityRequired(String(row.quantity_required));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!companyId || !productId || !materialId) {
      toast.error('Select product and material');
      return;
    }
    const qty = parseFloat(quantityRequired);
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be a positive number');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await bomService.update(editingId, { quantity_required: qty });
        toast.success('BOM line updated');
      } else {
        await bomService.create({
          company_id: companyId,
          product_id: productId,
          material_id: materialId,
          quantity_required: qty,
        });
        toast.success('BOM line added');
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this BOM line?')) return;
    try {
      await bomService.delete(id);
      toast.success('Removed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Bill of Materials
        </h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add BOM Line
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
                <th className="text-left p-3 font-medium">Product</th>
                <th className="text-left p-3 font-medium">Material</th>
                <th className="text-right p-3 font-medium">Qty Required</th>
                <th className="w-24 p-3" />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No BOM lines. Add a line to define materials per product.
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3">{productName(row.product_id)}</td>
                    <td className="p-3">{productName(row.material_id)}</td>
                    <td className="p-3 text-right">{row.quantity_required}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
            <DialogTitle>{editingId ? 'Edit BOM Line' : 'Add BOM Line'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <label className="text-sm font-medium">Product (finished good)</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={!!editingId}
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(${p.sku})` : ''}
                </option>
              ))}
            </select>
            <label className="text-sm font-medium">Material (raw material)</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              disabled={!!editingId}
            >
              <option value="">Select material</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(${p.sku})` : ''}
                </option>
              ))}
            </select>
            <label className="text-sm font-medium">Quantity required</label>
            <Input
              type="number"
              min="0.0001"
              step="any"
              value={quantityRequired}
              onChange={(e) => setQuantityRequired(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
