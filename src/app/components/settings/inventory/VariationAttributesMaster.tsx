/**
 * Settings → Inventory → Variations: reusable attribute names and values for product variation picker.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Trash2, Loader2, Save } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { useSupabase } from '@/app/context/SupabaseContext';
import { variationMasterService, type VariationAttributesMaster } from '@/app/services/variationMasterService';
import { toast } from 'sonner';

export function VariationAttributesMaster() {
  const { companyId } = useSupabase();
  const [data, setData] = useState<VariationAttributesMaster>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAttr, setNewAttr] = useState('');
  const [valueInputs, setValueInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const d = await variationMasterService.get(companyId);
      setData(d);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load variation master');
      setData({});
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      await variationMasterService.save(companyId, data);
      toast.success('Variation master saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addAttribute = () => {
    const name = newAttr.trim();
    if (!name) return;
    if (data[name]) {
      toast.error('Attribute already exists');
      return;
    }
    setData((prev) => ({ ...prev, [name]: [] }));
    setNewAttr('');
  };

  const removeAttribute = (name: string) => {
    setData((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const addValue = (attr: string) => {
    const raw = (valueInputs[attr] || '').trim();
    if (!raw) return;
    setData((prev) => {
      const list = [...(prev[attr] || [])];
      if (list.includes(raw)) return prev;
      list.push(raw);
      list.sort((a, b) => a.localeCompare(b));
      return { ...prev, [attr]: list };
    });
    setValueInputs((prev) => ({ ...prev, [attr]: '' }));
  };

  const removeValue = (attr: string, value: string) => {
    setData((prev) => ({
      ...prev,
      [attr]: (prev[attr] || []).filter((v) => v !== value),
    }));
  };

  if (!companyId) {
    return <p className="text-sm text-gray-500">Select a company to manage variation attributes.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  const attrNames = Object.keys(data).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h4 className="text-lg font-semibold text-white flex items-center gap-2">
            <Layers className="h-5 w-5 text-teal-400" />
            Variation attributes
          </h4>
          <p className="text-sm text-gray-400 mt-1 max-w-xl">
            Define reusable attributes (e.g. Color, Size) and values. The product form can search and pick them; you can still type new values inline on the product.
          </p>
        </div>
        <Button type="button" onClick={persist} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save master
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-end bg-gray-950/80 border border-gray-800 rounded-lg p-4">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-gray-300">New attribute name</Label>
          <Input
            value={newAttr}
            onChange={(e) => setNewAttr(e.target.value)}
            placeholder="e.g. Color, Size, Material"
            className="mt-1 bg-gray-900 border-gray-700 text-white"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAttribute())}
          />
        </div>
        <Button type="button" variant="secondary" onClick={addAttribute} className="bg-gray-800 text-white">
          <Plus className="h-4 w-4 mr-1" />
          Add attribute
        </Button>
      </div>

      <div className="space-y-4">
        {attrNames.length === 0 && (
          <p className="text-sm text-gray-500 border border-dashed border-gray-700 rounded-lg p-6 text-center">
            No attributes yet. Add names like <span className="text-gray-300">Color</span> or{' '}
            <span className="text-gray-300">Size</span>, then add values for each.
          </p>
        )}
        {attrNames.map((attr) => (
          <div key={attr} className="border border-gray-800 rounded-xl p-4 bg-gray-950/50">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-medium text-white">{attr}</span>
              <Button type="button" variant="ghost" size="sm" className="text-red-400" onClick={() => removeAttribute(attr)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {(data[attr] || []).map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 text-sm text-gray-200 border border-gray-700"
                >
                  {v}
                  <button type="button" className="text-gray-500 hover:text-red-400" onClick={() => removeValue(attr, v)} aria-label={`Remove ${v}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                value={valueInputs[attr] || ''}
                onChange={(e) => setValueInputs((prev) => ({ ...prev, [attr]: e.target.value }))}
                placeholder="Add value"
                className="max-w-xs bg-gray-900 border-gray-700 text-white"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValue(attr))}
              />
              <Button type="button" size="sm" variant="secondary" className="bg-gray-800 text-white" onClick={() => addValue(attr)}>
                <Plus className="h-4 w-4 mr-1" />
                Add value
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
