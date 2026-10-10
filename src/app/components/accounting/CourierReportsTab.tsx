/**
 * Courier Reports tab: Summary, Ledger, and Shipment Ledger with filters and pagination.
 * Includes Add Courier button (full-detail modal, standard method with company context).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import CourierLedgerPanel from '@/app/components/shipments/CourierLedgerPanel';
import ShipmentLedgerPage from '@/app/components/shipments/ShipmentLedgerPage';
import { shipmentAccountingService } from '@/app/services/shipmentAccountingService';
import { courierService, type CourierFormPayload } from '@/app/services/courierService';
import { Truck, RefreshCw, Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { toast } from 'sonner';

type SubView = 'summary' | 'ledger' | 'shipment_ledger';

const emptyCourierForm: CourierFormPayload = {
  name: '',
  default_rate: 0,
  tracking_url: '',
  api_endpoint: '',
  api_key: '',
  is_active: true,
};

export function CourierReportsTab() {
  const { companyId } = useSupabase();
  const [subView, setSubView] = useState<SubView>('summary');
  const [courierId, setCourierId] = useState<string>('');
  const [courierOptions, setCourierOptions] = useState<{ id: string; name: string }[]>([]);
  const [showAddCourierModal, setShowAddCourierModal] = useState(false);
  const [addCourierForm, setAddCourierForm] = useState<CourierFormPayload>(emptyCourierForm);
  const [addCourierSaving, setAddCourierSaving] = useState(false);

  const refreshCourierOptions = useCallback(() => {
    if (!companyId) return;
    // Single identity: filter value = contact_id (ledger courier_id). Prefer couriers.contact_id; fallback from balance for legacy.
    Promise.all([
      courierService.getByCompanyId(companyId, false),
      shipmentAccountingService.getCourierBalances(companyId),
    ]).then(([list, balances]) => {
      const nameToContactId = new Map<string, string>();
      balances.forEach((b) => {
        if (b.courier_id && b.courier_name) nameToContactId.set(b.courier_name.trim(), b.courier_id);
      });
      const opts = list
        .filter((c) => c.is_active)
        .map((c) => ({
          id: (c.contact_id ?? nameToContactId.get(c.name.trim()) ?? c.id) as string,
          name: c.name,
        }));
      setCourierOptions(opts);
      setCourierId((prev) => (opts.some((o) => o.id === prev) ? prev : opts[0]?.id ?? ''));
    });
  }, [companyId]);

  useEffect(() => {
    refreshCourierOptions();
  }, [companyId, refreshCourierOptions]);

  const handleAddCourierSave = async () => {
    if (!companyId || !addCourierForm.name?.trim()) {
      toast.error('Courier name is required');
      return;
    }
    setAddCourierSaving(true);
    try {
      await courierService.create(companyId, {
        name: addCourierForm.name.trim(),
        default_rate: addCourierForm.default_rate ?? 0,
        tracking_url: addCourierForm.tracking_url || undefined,
        api_endpoint: addCourierForm.api_endpoint || undefined,
        api_key: addCourierForm.api_key || undefined,
        is_active: addCourierForm.is_active ?? true,
      });
      toast.success('Courier added');
      setShowAddCourierModal(false);
      setAddCourierForm(emptyCourierForm);
      refreshCourierOptions();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add courier');
    } finally {
      setAddCourierSaving(false);
    }
  };

  if (!companyId) {
    return <div className="p-6 text-muted-foreground">No company selected.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Truck size={20} className="text-indigo-400" />
          Courier Reports
        </h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setShowAddCourierModal(true)}
          >
            <Plus size={14} className="mr-2" />
            Add Courier
          </Button>
          <Select value={subView} onValueChange={(v) => setSubView(v as SubView)}>
            <SelectTrigger className="w-[200px] bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Courier Summary</SelectItem>
              <SelectItem value="ledger">Courier Ledger</SelectItem>
              <SelectItem value="shipment_ledger">Shipment Ledger</SelectItem>
            </SelectContent>
          </Select>
          {courierOptions.length > 0 && (subView === 'ledger' || subView === 'shipment_ledger') && (
            <Select value={courierId || 'all'} onValueChange={(v) => setCourierId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[180px] bg-card border-border text-foreground">
                <SelectValue placeholder="All couriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All couriers</SelectItem>
                {courierOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {subView === 'summary' && 'Courier balances: total expense, paid, and balance due per courier.'}
        {subView === 'ledger' && 'Date-wise ledger (debit, credit, balance) for courier payable accounts.'}
        {subView === 'shipment_ledger' && 'Shipment-level shipping income, expense, and courier payable.'}
        Shipment history is logged per shipment and can be viewed in Sale / Studio sale detail.
      </p>

      {subView === 'summary' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <CourierLedgerPanel companyId={companyId} />
        </div>
      )}

      {subView === 'ledger' && (
        <CourierLedgerView companyId={companyId} courierId={courierId || undefined} />
      )}

      {subView === 'shipment_ledger' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <ShipmentLedgerPage companyId={companyId} />
        </div>
      )}

      {/* Add Courier modal – full detail, standard method (company context) */}
      {showAddCourierModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-foreground">Add Courier</h4>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setShowAddCourierModal(false); setAddCourierForm(emptyCourierForm); }}>
                <X size={18} />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Add a courier for the current company. It will be available in shipment modal and reports.</p>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm">Courier Name *</Label>
                <Input
                  value={addCourierForm.name}
                  onChange={(e) => setAddCourierForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. TCS, Leopard, DHL"
                  className="mt-1 bg-input-background border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Default Rate (Rs)</Label>
                <Input
                  type="number"
                  min={0}
                  value={addCourierForm.default_rate > 0 ? addCourierForm.default_rate : ''}
                  onChange={(e) => setAddCourierForm((prev) => ({ ...prev, default_rate: parseFloat(e.target.value) || 0 }))}
                  placeholder="250"
                  className="mt-1 bg-input-background border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Tracking URL (use &#123;tracking_id&#125; for placeholder)</Label>
                <Input
                  value={addCourierForm.tracking_url}
                  onChange={(e) => setAddCourierForm((prev) => ({ ...prev, tracking_url: e.target.value }))}
                  placeholder="https://www.tcsexpress.com/track?trackingNo={tracking_id}"
                  className="mt-1 bg-input-background border-border text-foreground font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">API Endpoint (optional)</Label>
                <Input
                  value={addCourierForm.api_endpoint}
                  onChange={(e) => setAddCourierForm((prev) => ({ ...prev, api_endpoint: e.target.value }))}
                  placeholder="https://api.courier.com/v1/ship"
                  className="mt-1 bg-input-background border-border text-foreground font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">API Key (optional, stored securely)</Label>
                <Input
                  type="password"
                  value={addCourierForm.api_key}
                  onChange={(e) => setAddCourierForm((prev) => ({ ...prev, api_key: e.target.value }))}
                  placeholder="••••••••"
                  className="mt-1 bg-input-background border-border text-foreground"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-sm">Active</Label>
                <Switch
                  checked={addCourierForm.is_active ?? true}
                  onCheckedChange={(v) => setAddCourierForm((prev) => ({ ...prev, is_active: v }))}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4 mt-4 border-t border-border">
              <Button variant="outline" className="flex-1 border-border" onClick={() => { setShowAddCourierModal(false); setAddCourierForm(emptyCourierForm); }}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={addCourierSaving || !addCourierForm.name?.trim()} onClick={handleAddCourierSave}>
                {addCourierSaving ? 'Saving…' : 'Add Courier'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CourierLedgerView({ companyId, courierId }: { companyId: string; courierId?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [kindFilter, setKindFilter] = useState<'all' | 'accrual' | 'payment'>('all');
  const pageSize = 50;

  function load() {
    setLoading(true);
    shipmentAccountingService
      .getCourierLedger(companyId, courierId, { limit: pageSize, offset: page * pageSize })
      .then(setRows)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setPage(0);
  }, [companyId, courierId, kindFilter]);

  useEffect(load, [companyId, courierId, page]);

  const fmt = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

  const entryKindLabel = (r: { entry_kind?: string; debit?: number; credit?: number }) => {
    if (r.entry_kind === 'payment' || (r.debit ?? 0) > 0) return 'Paid';
    if (r.entry_kind === 'accrual' || (r.credit ?? 0) > 0) return 'Accrued';
    return r.entry_kind ?? '—';
  };

  const filteredRows = rows.filter((r) => {
    if (kindFilter === 'all') return true;
    if (kindFilter === 'payment') return r.entry_kind === 'payment' || (r.debit ?? 0) > 0;
    return r.entry_kind === 'accrual' || (r.credit ?? 0) > 0;
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Courier Ledger (oldest first — accrual + step payments)</span>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
            {(['all', 'accrual', 'payment'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors',
                  kindFilter === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {k === 'all' ? 'All' : k === 'accrual' ? 'Accrued' : 'Paid'}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>
      </div>
      {loading && rows.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      ) : filteredRows.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">No ledger entries for this filter.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-card border-b border-border">
                <tr className="text-muted-foreground uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Ref</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Courier</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr
                    key={r.journal_entry_line_id ?? `${r.journal_entry_id}-${r.payment_ref}`}
                    className="border-b border-border hover:bg-accent/30"
                  >
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2 text-blue-300 font-mono text-[11px]">{r.payment_ref || r.document_no || r.entry_no || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{entryKindLabel(r)}</td>
                    <td className="px-3 py-2 text-foreground">{r.courier_name}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{r.description}</td>
                    <td className="px-3 py-2 text-right text-orange-400">{r.debit > 0 ? fmt(r.debit) : '—'}</td>
                    <td className="px-3 py-2 text-right text-[var(--erp-money-positive)]">{r.credit > 0 ? fmt(r.credit) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">{fmt(r.balance ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-t border-border">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-muted-foreground text-xs">Page {page + 1}</span>
            <Button variant="ghost" size="sm" disabled={rows.length < pageSize} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
