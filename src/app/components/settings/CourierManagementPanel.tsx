/**
 * Settings → Courier Management (PART 6).
 * Add/Edit couriers: Name, Default Rate, Tracking URL, API Endpoint, API Key, Active.
 */

import React, { useState, useEffect } from 'react';
import { Truck, Plus, Edit, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSupabase } from '@/app/context/SupabaseContext';
import { courierService, type CourierRow, type CourierFormPayload } from '@/app/services/courierService';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

const emptyForm: CourierFormPayload & { id?: string } = {
  name: '',
  default_rate: 0,
  tracking_url: '',
  api_endpoint: '',
  api_key: '',
  is_active: true,
};

export const CourierManagementPanel = () => {
  const { companyId } = useSupabase();
  const [list, setList] = useState<CourierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    courierService.getByCompanyId(companyId, false)
      .then((data) => { if (!cancelled) setList(data); })
      .catch(() => { if (!cancelled) setList([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId || !form.name?.trim()) {
      toast.error('Courier name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await courierService.update(editingId, {
          name: form.name.trim(),
          default_rate: form.default_rate ?? 0,
          tracking_url: form.tracking_url || undefined,
          api_endpoint: form.api_endpoint || undefined,
          api_key: form.api_key || undefined,
          is_active: form.is_active ?? true,
        });
        toast.success('Courier updated');
      } else {
        await courierService.create(companyId, {
          name: form.name.trim(),
          default_rate: form.default_rate ?? 0,
          tracking_url: form.tracking_url || undefined,
          api_endpoint: form.api_endpoint || undefined,
          api_key: form.api_key || undefined,
          is_active: form.is_active ?? true,
        });
        toast.success('Courier added');
      }
      const data = await courierService.getByCompanyId(companyId, false);
      setList(data);
      setEditingId(null);
      setForm(emptyForm);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save courier');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (row: CourierRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      default_rate: row.default_rate ?? 0,
      tracking_url: row.tracking_url ?? '',
      api_endpoint: row.api_endpoint ?? '',
      api_key: row.api_key ?? '',
      is_active: row.is_active ?? true,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this courier? Shipments using it will keep the name but lose the link.')) return;
    try {
      await courierService.delete(id);
      setList((prev) => prev.filter((c) => c.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      toast.success('Courier removed');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  if (!companyId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-lg">
          <Truck className="text-blue-500" size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Courier Management</h3>
          <p className="text-sm text-gray-400">Manage courier companies for shipments (default rate, tracking URL, future API)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-300">Couriers</h4>
            {!editingId && (
              <Button size="sm" variant="outline" className="border-gray-600 text-blue-400" onClick={() => setForm(emptyForm)}>
                <Plus size={14} className="mr-2" />
                Add Courier
              </Button>
            )}
          </div>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {list.length === 0 && (
                <p className="text-gray-500 text-sm">No couriers. Add one to use in the shipment modal.</p>
              )}
              {list.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center justify-between gap-2 p-3 rounded-lg border',
                    editingId === c.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-gray-950/50'
                  )}
                >
                  <div>
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      Default rate: {Number(c.default_rate || 0).toLocaleString()} · {c.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(c)}>
                      <Edit size={14} className="text-gray-400" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-300" onClick={() => handleDelete(c.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-gray-800 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-300 flex items-center justify-between">
            {editingId ? 'Edit Courier' : 'Add Courier'}
            {editingId && (
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8 w-8 p-0">
                <X size={14} />
              </Button>
            )}
          </h4>
          <div>
            <Label className="text-gray-400 text-sm">Courier Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. TCS, Leopard, DHL"
              className="mt-1 bg-gray-950 border-gray-700 text-white"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-sm">Default Rate (Rs)</Label>
            <Input
              type="number"
              min={0}
              value={form.default_rate > 0 ? form.default_rate : ''}
              onChange={(e) => setForm((prev) => ({ ...prev, default_rate: parseFloat(e.target.value) || 0 }))}
              placeholder="250"
              className="mt-1 bg-gray-950 border-gray-700 text-white"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-sm">Tracking URL (use &#123;tracking_id&#125; for placeholder)</Label>
            <Input
              value={form.tracking_url}
              onChange={(e) => setForm((prev) => ({ ...prev, tracking_url: e.target.value }))}
              placeholder="https://www.tcsexpress.com/track?trackingNo={tracking_id}"
              className="mt-1 bg-gray-950 border-gray-700 text-white font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-sm">API Endpoint (future)</Label>
            <Input
              value={form.api_endpoint}
              onChange={(e) => setForm((prev) => ({ ...prev, api_endpoint: e.target.value }))}
              placeholder="https://api.courier.com/v1/ship"
              className="mt-1 bg-gray-950 border-gray-700 text-white font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-sm">API Key (future, stored securely)</Label>
            <Input
              type="password"
              value={form.api_key}
              onChange={(e) => setForm((prev) => ({ ...prev, api_key: e.target.value }))}
              placeholder="••••••••"
              className="mt-1 bg-gray-950 border-gray-700 text-white"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-gray-400 text-sm">Active</Label>
            <Switch
              checked={form.is_active ?? true}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, is_active: v }))}
            />
          </div>
          <Button onClick={handleSave} disabled={saving || !form.name?.trim()} className="w-full bg-blue-600 hover:bg-blue-700">
            {saving ? 'Saving…' : editingId ? 'Update Courier' : 'Add Courier'}
          </Button>
        </div>
      </div>
    </div>
  );
};
