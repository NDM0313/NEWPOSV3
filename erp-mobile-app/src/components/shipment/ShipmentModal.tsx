import { useState, useEffect } from 'react';
import { X, Loader2, Truck } from 'lucide-react';
import { CustomSelect } from '../common';
import * as couriersApi from '../../api/couriers';
import * as shipmentsApi from '../../api/shipments';

interface ShipmentModalProps {
  saleId: string;
  saleLabel?: string; // e.g. invoice no
  companyId: string;
  branchId: string;
  userId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function ShipmentModal({
  saleId,
  saleLabel,
  companyId,
  branchId,
  userId,
  onClose,
  onSaved,
}: ShipmentModalProps) {
  const [couriers, setCouriers] = useState<couriersApi.CourierRow[]>([]);
  const [couriersLoading, setCouriersLoading] = useState(true);
  const [courierId, setCourierId] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipmentCost, setShipmentCost] = useState('');
  const [weight, setWeight] = useState('');
  const [shipmentStatus, setShipmentStatus] = useState('Booked');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const STATUS_OPTIONS = ['Booked', 'Picked', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled'];

  useEffect(() => {
    couriersApi.getCouriersByCompany(companyId).then(({ data, error: err }) => {
      setCouriersLoading(false);
      if (err) setError(err);
      else setCouriers(data || []);
    });
  }, [companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const { data, error: err } = await shipmentsApi.createShipment(
      saleId,
      companyId,
      branchId,
      {
        courierId: courierId || null,
        trackingNumber: trackingNumber.trim() || null,
        shipmentCost: parseFloat(shipmentCost) || 0,
        weight: weight.trim() ? parseFloat(weight) : undefined,
        shipmentStatus: shipmentStatus || 'Booked',
      },
      userId
    );
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      onSaved?.();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[#1F2937] border border-[#374151] rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#374151]">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#10B981]" />
            <h2 className="text-lg font-semibold text-white">Add Shipment</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[#374151] text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>
        {saleLabel && (
          <p className="px-4 pt-2 text-sm text-[#9CA3AF]">Sale: {saleLabel}</p>
        )}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/20 border border-red-500/50 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div>
            <CustomSelect
              label="Courier"
              value={courierId}
              onChange={setCourierId}
              options={[{ value: '', label: 'Select courier' }, ...couriers.map((c) => ({ value: c.id, label: c.name }))]}
              disabled={couriersLoading}
              zIndexClass="z-[100]"
            />
          </div>
          <div>
            <CustomSelect
              label="Status"
              value={shipmentStatus}
              onChange={setShipmentStatus}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
              zIndexClass="z-[100]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-1">Tracking number</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. 1234567890"
              className="w-full rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white placeholder-[#6B7280]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-1">Shipment cost (Rs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={shipmentCost}
              onChange={(e) => setShipmentCost(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white placeholder-[#6B7280]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-1">Weight (kg)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white placeholder-[#6B7280]"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[#374151] text-[#D1D5DB] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-[#10B981] text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
