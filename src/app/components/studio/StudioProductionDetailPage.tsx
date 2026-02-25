import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Edit2,
  Package,
  Loader2,
  FileText,
  Calendar,
  User,
  Save,
  X,
  Play,
  CheckCircle,
  XCircle,
  History,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { DatePicker } from '../ui/DatePicker';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { useNavigation } from '@/app/context/NavigationContext';
import { useProduction } from '@/app/context/ProductionContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioService } from '@/app/services/studioService';
import { cn } from '../ui/utils';
import { formatDate } from '@/utils/dateFormat';
import { toast } from 'sonner';
import type { StudioProduction, StudioProductionStatus } from '@/app/services/studioProductionService';
import type { StudioProductionLog } from '@/app/services/studioProductionService';

const statusConfig: Record<StudioProductionStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  in_progress: { label: 'In Progress', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  completed: { label: 'Completed', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export const StudioProductionDetailPage = () => {
  const { setCurrentView, selectedProductionId, setSelectedProductionId } = useNavigation();
  const { companyId } = useSupabase();
  const { getProductionById, updateProduction, changeStatus, getProductionLogs, refreshProductions } = useProduction();
  const [production, setProduction] = useState<StudioProduction | null>(null);
  const [logs, setLogs] = useState<StudioProductionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<StudioProduction>>({});

  const loadProduction = useCallback(async () => {
    if (!selectedProductionId) return;
    setLoading(true);
    try {
      const p = await getProductionById(selectedProductionId);
      setProduction(p || null);
      if (p) setForm(p);
      const l = await getProductionLogs(selectedProductionId);
      setLogs(l);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load production');
      setProduction(null);
    } finally {
      setLoading(false);
    }
  }, [selectedProductionId, getProductionById, getProductionLogs]);

  useEffect(() => { loadProduction(); }, [loadProduction]);


  const handleSave = async () => {
    if (!production) return;
    setSaving(true);
    try {
      await updateProduction(production.id, {
        production_date: form.production_date,
        quantity: form.quantity,
        unit: form.unit,
        estimated_cost: form.estimated_cost,
        actual_cost: form.actual_cost,
        start_date: form.start_date,
        expected_date: form.expected_date,
        assigned_worker_id: form.assigned_worker_id,
        assigned_machine_or_karigar: form.assigned_machine_or_karigar,
        notes: form.notes,
        instructions: form.instructions,
      });
      setEditMode(false);
      await loadProduction();
      refreshProductions();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: StudioProductionStatus) => {
    if (!production) return;
    try {
      await changeStatus(production.id, newStatus);
      await loadProduction();
      refreshProductions();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to change status');
    }
  };

  const handleBack = () => {
    setSelectedProductionId?.(undefined);
    setCurrentView('studio-sales-list-new');
  };

  if (loading || !production) {
    return (
      <div className="flex flex-col h-full bg-gray-950 text-white items-center justify-center">
        {loading ? <Loader2 size={48} className="animate-spin text-blue-500" /> : <p className="text-gray-500">Production not found</p>}
        <Button variant="ghost" className="mt-4" onClick={handleBack}>Back to list</Button>
      </div>
    );
  }

  const product = (production as any).product;
  const worker = (production as any).worker;
  const cfg = statusConfig[production.status];
  const isCompleted = production.status === 'completed';
  const isCancelled = production.status === 'cancelled';

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">{(production as any).sale?.invoice_no ?? product?.name ?? production.product_id}</h1>
            <p className="text-xs text-gray-500">{product?.name ?? production.product_id}</p>
          </div>
          <Badge className={cn('border', cfg?.className)}>{cfg?.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {!editMode && !isCompleted && !isCancelled && (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)} className="border-gray-600 text-gray-300 gap-1">
              <Edit2 size={14} /> Edit
            </Button>
          )}
          {editMode && (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-blue-600 gap-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setForm(production); }} className="border-gray-600 text-gray-300">
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 space-y-6 max-w-3xl">
        <section className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-500">Production Date</Label>
              {editMode ? (
                <DatePicker value={form.production_date || ''} onChange={(v) => setForm(f => ({ ...f, production_date: v }))} placeholder="Select date" className="mt-1" />
              ) : (
                <p className="text-white mt-1">{production.production_date ? formatDate(new Date(production.production_date)) : '—'}</p>
              )}
            </div>
            <div>
              <Label className="text-gray-500">Product</Label>
              <p className="text-white mt-1">{product?.name ?? production.product_id}</p>
            </div>
            <div>
              <Label className="text-gray-500">Quantity</Label>
              {editMode ? (
                <Input type="number" min={0.01} value={form.quantity ?? ''} onChange={(e) => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} className="bg-gray-900 border-gray-700 text-white mt-1" />
              ) : (
                <p className="text-white mt-1">{production.quantity} {production.unit}</p>
              )}
            </div>
            <div>
              <Label className="text-gray-500">Estimated / Actual Cost</Label>
              <p className="text-white mt-1">${Number(production.estimated_cost || 0).toFixed(2)} / ${Number(production.actual_cost || 0).toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-gray-500">Start / Expected Date</Label>
              <p className="text-white mt-1">{production.start_date ?? '–'} / {production.expected_date ?? '–'}</p>
            </div>
            <div>
              <Label className="text-gray-500">Assigned</Label>
              <p className="text-white mt-1">{worker?.name ?? production.assigned_machine_or_karigar ?? '–'}</p>
            </div>
          </div>
          {production.notes && (
            <div className="mt-4">
              <Label className="text-gray-500">Notes</Label>
              <p className="text-white mt-1">{production.notes}</p>
            </div>
          )}
        </section>

        {!isCompleted && !isCancelled && (
          <section className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Status</h2>
            <div className="flex flex-wrap gap-2">
              {production.status === 'draft' && (
                <Button size="sm" onClick={() => handleStatusChange('in_progress')} className="bg-blue-600 gap-1">
                  <Play size={14} /> Start
                </Button>
              )}
              {production.status === 'in_progress' && (
                <Button size="sm" onClick={() => handleStatusChange('completed')} className="bg-green-600 gap-1">
                  <CheckCircle size={14} /> Complete
                </Button>
              )}
              {(production.status === 'draft' || production.status === 'in_progress') && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('cancelled')} className="border-red-600 text-red-400 gap-1">
                  <XCircle size={14} /> Cancel
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">Completed: inventory (finished goods) will be updated. Cancelled: no inventory impact.</p>
          </section>
        )}

        <section className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4 flex items-center gap-2">
            <History size={16} /> Activity
          </h2>
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm">No activity yet</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((log) => (
                <li key={log.id} className="text-sm border-b border-gray-800 pb-2 last:border-0">
                  <span className="text-gray-400">{log.action_type}</span>
                  {log.performed_at && <span className="text-gray-500 ml-2">{new Date(log.performed_at).toLocaleString()}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
