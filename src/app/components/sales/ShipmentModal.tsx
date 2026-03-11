/**
 * Reusable Shipment Modal (PART 3, PART 4).
 * Used by: SaleForm, SalesPage (3-dot Add Shipment), Studio (future).
 * One modal everywhere – same fields: Type, Courier, Weight, Tracking, Status, Charged, Actual Cost, Notes.
 * PART 6: Track Shipment is shown in the shipment block (parent), not inside this modal.
 * PART 7: Weight is included and sent to sale_shipments.weight.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { shipmentService, type ShipmentType } from '@/app/services/shipmentService';
import { courierService, type CourierRow, type CourierFormPayload } from '@/app/services/courierService';
import { toast } from 'sonner';

const SHIPMENT_STATUS_OPTIONS = ['Booked', 'Picked', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled'] as const;

export interface ShipmentFormState {
  shipmentType: ShipmentType;
  courierId: string;
  courierName: string;
  weightKg: number;
  chargedToCustomer: number;
  actualCost: number;
  trackingId: string;
  shipmentStatus: string;
  notes: string;
}

const emptyForm: ShipmentFormState = {
  shipmentType: 'Courier',
  courierId: '',
  courierName: '',
  weightKg: 0,
  chargedToCustomer: 0,
  actualCost: 0,
  trackingId: '',
  shipmentStatus: 'Booked',
  notes: '',
};

export interface EditingShipment {
  id: string;
  shipmentType: ShipmentType;
  courierMasterId?: string;
  courierName?: string;
  weight?: number;
  chargedToCustomer: number;
  actualCost: number;
  trackingId?: string;
  shipmentStatus: string;
  notes?: string;
}

export interface ShipmentModalProps {
  open: boolean;
  onClose: () => void;
  saleId: string;
  companyId: string;
  branchId: string;
  invoiceNo?: string;
  /** When set, modal is in "Update" mode. */
  editingShipment?: EditingShipment | null;
  /** Prefill Charged to Customer when adding (e.g. from Shipping Charge input). */
  initialChargedToCustomer?: number;
  onSaved: () => void;
  performedBy?: string | null;
}

export function ShipmentModal({
  open,
  onClose,
  saleId,
  companyId,
  branchId,
  invoiceNo,
  editingShipment,
  initialChargedToCustomer = 0,
  onSaved,
  performedBy,
}: ShipmentModalProps) {
  const [form, setForm] = useState<ShipmentFormState>(emptyForm);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddCourierDialog, setShowAddCourierDialog] = useState(false);
  const [addCourierForm, setAddCourierForm] = useState<CourierFormPayload>({
    name: '',
    default_rate: 0,
    tracking_url: '',
    api_endpoint: '',
    api_key: '',
    is_active: true,
  });
  const [addCourierSaving, setAddCourierSaving] = useState(false);

  const refreshCouriers = useCallback(() => {
    if (!companyId) return;
    courierService.getByCompanyId(companyId, false)
      .then(setCouriers)
      .catch(() => setCouriers([]));
  }, [companyId]);

  useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    courierService.getByCompanyId(companyId, false)
      .then((list) => { if (!cancelled) setCouriers(list); })
      .catch(() => { if (!cancelled) setCouriers([]); });
    return () => { cancelled = true; };
  }, [open, companyId]);

  useEffect(() => {
    if (!open) return;
    if (editingShipment) {
      setForm({
        shipmentType: (editingShipment.shipmentType as ShipmentType) || 'Courier',
        courierId: editingShipment.courierMasterId || '',
        courierName: editingShipment.courierName || '',
        weightKg: editingShipment.weight ?? 0,
        chargedToCustomer: editingShipment.chargedToCustomer ?? 0,
        actualCost: editingShipment.actualCost ?? 0,
        trackingId: editingShipment.trackingId || '',
        shipmentStatus: editingShipment.shipmentStatus || 'Booked',
        notes: editingShipment.notes || '',
      });
    } else {
      setForm({
        ...emptyForm,
        chargedToCustomer: initialChargedToCustomer || 0,
      });
    }
  }, [open, editingShipment, initialChargedToCustomer]);

  const emptyAddCourierForm: CourierFormPayload = {
    name: '',
    default_rate: 0,
    tracking_url: '',
    api_endpoint: '',
    api_key: '',
    is_active: true,
  };

  const handleClose = () => {
    setForm(emptyForm);
    setShowAddCourierDialog(false);
    setAddCourierForm(emptyAddCourierForm);
    onClose();
  };

  const handleAddCourierSave = async () => {
    if (!addCourierForm.name?.trim()) {
      toast.error('Courier name is required');
      return;
    }
    if (!companyId) return;
    setAddCourierSaving(true);
    try {
      await courierService.create(companyId, {
        name: addCourierForm.name.trim(),
        default_rate: addCourierForm.default_rate ?? 0,
        tracking_url: addCourierForm.tracking_url?.trim() || undefined,
        api_endpoint: addCourierForm.api_endpoint?.trim() || undefined,
        api_key: addCourierForm.api_key?.trim() || undefined,
        is_active: addCourierForm.is_active ?? true,
      });
      refreshCouriers();
      setShowAddCourierDialog(false);
      setAddCourierForm(emptyAddCourierForm);
      toast.success('Courier added');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add courier');
    } finally {
      setAddCourierSaving(false);
    }
  };

  const handleSave = async () => {
    if (!saleId || !companyId || !branchId) return;
    if (form.chargedToCustomer < 0) {
      toast.error('Charged to customer cannot be negative');
      return;
    }
    setSaving(true);
    try {
      const selectedCourier = form.courierId ? couriers.find((c) => c.id === form.courierId) : null;
      const courierNameForPayload = selectedCourier?.name || form.courierName || undefined;
      const payload = {
        shipment_type: form.shipmentType,
        courier_master_id: form.courierId || undefined,
        courier_name: courierNameForPayload,
        weight: form.weightKg > 0 ? form.weightKg : undefined,
        shipment_status: (form.shipmentStatus as any) || 'Booked',
        actual_cost: form.actualCost ?? 0,
        charged_to_customer: form.chargedToCustomer,
        notes: form.notes || undefined,
        tracking_id: form.trackingId || undefined,
      };
      if (editingShipment?.id) {
        await shipmentService.update(editingShipment.id, payload, performedBy);
        toast.success('Shipment updated');
      } else {
        await shipmentService.create(saleId, companyId, branchId, { ...payload, currency: 'PKR' }, performedBy, invoiceNo);
        toast.success('Shipment added');
      }
      onSaved();
      handleClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save shipment');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">
            {editingShipment ? 'Update Shipment' : 'Add Shipment'}
            {invoiceNo && <span className="text-gray-400 font-normal ml-1">— {invoiceNo}</span>}
          </h3>
          <Button size="sm" variant="ghost" onClick={handleClose} className="h-8 w-8 p-0">
            <X size={16} />
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-gray-400 text-sm">Shipment Type</Label>
            <select
              value={form.shipmentType}
              onChange={(e) => setForm((prev) => ({ ...prev, shipmentType: e.target.value as ShipmentType }))}
              className="w-full mt-1 bg-gray-950 border border-gray-700 rounded-lg text-white h-10 px-3"
            >
              <option value="Courier">Courier (DHL, TCS, etc.)</option>
              <option value="Local">Local Delivery</option>
            </select>
          </div>
          {form.shipmentType === 'Courier' && (
            <div>
              <Label className="text-gray-400 text-sm">Courier</Label>
              {couriers.length === 0 ? (
                <div className="mt-1 p-3 rounded-lg bg-gray-950 border border-gray-700 text-gray-400 text-sm">
                  No couriers found. Add a courier to select here.
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowAddCourierDialog(true)}
                  >
                    <Plus size={14} className="mr-2" /> Add Courier
                  </Button>
                </div>
              ) : (
                <>
                  <Select
                    value={form.courierId || '_none'}
                    onValueChange={(val) => {
                      const c = couriers.find((x) => x.id === val);
                      setForm((prev) => ({
                        ...prev,
                        courierId: val === '_none' ? '' : val,
                        courierName: c?.name ?? prev.courierName,
                        chargedToCustomer: c?.default_rate && c.default_rate > 0 ? c.default_rate : prev.chargedToCustomer,
                      }));
                    }}
                  >
                    <SelectTrigger className="mt-1 bg-gray-950 border-gray-700 text-white h-10">
                      <SelectValue placeholder="Select courier" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-950 border-gray-800 text-white">
                      <SelectItem value="_none">— Select —</SelectItem>
                      {couriers.filter((c) => c.is_active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                    onClick={() => setShowAddCourierDialog(true)}
                  >
                    <Plus size={14} className="mr-2" /> Add New Courier
                  </Button>
                </>
              )}
            </div>
          )}
          <div>
            <Label className="text-gray-400 text-sm">Weight (kg)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.weightKg > 0 ? form.weightKg : ''}
              onChange={(e) => setForm((prev) => ({ ...prev, weightKg: parseFloat(e.target.value) || 0 }))}
              placeholder="0.50"
              className="mt-1 bg-gray-950 border-gray-700"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-sm">Tracking Number</Label>
            <Input
              value={form.trackingId}
              onChange={(e) => setForm((prev) => ({ ...prev, trackingId: e.target.value }))}
              placeholder="e.g., DHL-123456789"
              className="mt-1 bg-gray-950 border-gray-700"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-sm">Shipment Status</Label>
            <select
              value={form.shipmentStatus}
              onChange={(e) => setForm((prev) => ({ ...prev, shipmentStatus: e.target.value }))}
              className="w-full mt-1 bg-gray-950 border border-gray-700 rounded-lg text-white h-10 px-3"
            >
              {SHIPMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400 text-sm">Charged To Customer (Rs)</Label>
              <Input
                type="number"
                min={0}
                value={form.chargedToCustomer > 0 ? form.chargedToCustomer : ''}
                onChange={(e) => setForm((prev) => ({ ...prev, chargedToCustomer: Number(e.target.value) || 0 }))}
                placeholder="0"
                className="mt-1 bg-gray-950 border-gray-700"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Actual Cost (Rs)</Label>
              <Input
                type="number"
                min={0}
                value={form.actualCost > 0 ? form.actualCost : ''}
                onChange={(e) => setForm((prev) => ({ ...prev, actualCost: Number(e.target.value) || 0 }))}
                placeholder="0"
                className="mt-1 bg-gray-950 border-gray-700"
              />
            </div>
          </div>
          <div>
            <Label className="text-gray-400 text-sm">Notes (Optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes..."
              className="mt-1 bg-gray-950 border-gray-700"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-4 mt-4 border-t border-gray-800">
          <Button variant="outline" className="flex-1 border-gray-700" onClick={handleClose}>Cancel</Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={saving || form.chargedToCustomer < 0}
            onClick={handleSave}
          >
            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            {editingShipment ? 'Update Shipment' : 'Add Shipment'}
          </Button>
        </div>
      </div>

      {/* Inline Add Courier dialog – full detail (same as Settings / Courier Reports) */}
      {showAddCourierDialog && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 rounded-xl p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h4 className="text-sm font-semibold text-white mb-3">Add Courier</h4>
            <div className="space-y-3">
              <div>
                <Label className="text-gray-400 text-xs">Courier Name *</Label>
                <Input
                  value={addCourierForm.name}
                  onChange={(e) => setAddCourierForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. TCS, DHL"
                  className="mt-1 bg-gray-950 border-gray-700 text-white h-9"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Default Rate (Rs)</Label>
                <Input
                  type="number"
                  min={0}
                  value={addCourierForm.default_rate > 0 ? addCourierForm.default_rate : ''}
                  onChange={(e) => setAddCourierForm((prev) => ({ ...prev, default_rate: Number(e.target.value) || 0 }))}
                  placeholder="250"
                  className="mt-1 bg-gray-950 border-gray-700 text-white h-9"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Tracking URL (use &#123;tracking_id&#125;)</Label>
                <Input
                  value={addCourierForm.tracking_url}
                  onChange={(e) => setAddCourierForm((prev) => ({ ...prev, tracking_url: e.target.value }))}
                  placeholder="https://www.tcsexpress.com/track?trackingNo={tracking_id}"
                  className="mt-1 bg-gray-950 border-gray-700 text-white h-9 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">API Endpoint (optional)</Label>
                <Input
                  value={addCourierForm.api_endpoint}
                  onChange={(e) => setAddCourierForm((prev) => ({ ...prev, api_endpoint: e.target.value }))}
                  placeholder="https://api.courier.com/v1/ship"
                  className="mt-1 bg-gray-950 border-gray-700 text-white h-9 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">API Key (optional)</Label>
                <Input
                  type="password"
                  value={addCourierForm.api_key}
                  onChange={(e) => setAddCourierForm((prev) => ({ ...prev, api_key: e.target.value }))}
                  placeholder="••••••••"
                  className="mt-1 bg-gray-950 border-gray-700 text-white h-9"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-400 text-xs">Active</Label>
                <Switch
                  checked={addCourierForm.is_active ?? true}
                  onCheckedChange={(v) => setAddCourierForm((prev) => ({ ...prev, is_active: v }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1 border-gray-600" onClick={() => { setShowAddCourierDialog(false); setAddCourierForm(emptyAddCourierForm); }}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={addCourierSaving || !addCourierForm.name?.trim()} onClick={handleAddCourierSave}>
                {addCourierSaving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
