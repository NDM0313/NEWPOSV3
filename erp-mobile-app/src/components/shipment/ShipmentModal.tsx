import { useState, useEffect } from 'react';
import { X, Loader2, Truck } from 'lucide-react';
import { CustomSelect } from '../common';
import * as couriersApi from '../../api/couriers';
import * as shipmentsApi from '../../api/shipments';
import * as courierShipmentsApi from '../../api/courierShipments';
import { syncSaleShipmentFromCourier } from '../../api/shipmentSync';
import { postSaleShipmentJournal } from '../../api/shipmentAccounting';
import { COURIER_STATUS_STEPS } from '../../lib/shipmentStatus';
import { useSubmitLock } from '../../contexts/LoadingContext';
import { SaveBlockingOverlay } from '../common/SaveBlockingOverlay';
import { DateInputField } from '../shared/DateTimePicker';
import { toLocalDateString } from '../../utils/localDate';

export type ShipmentModalMode = 'sale' | 'packing_list';

interface ShipmentModalProps {
  mode: ShipmentModalMode;
  companyId: string;
  branchId: string;
  userId: string;
  dbUserId?: string | null;
  saleId?: string;
  saleLabel?: string;
  packingListId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

const STATUS_OPTIONS_SALE = ['Booked', 'Dispatched', 'In Transit', 'Delivered'];

export function ShipmentModal({
  mode,
  saleId,
  saleLabel,
  packingListId,
  companyId,
  branchId,
  userId,
  dbUserId,
  onClose,
  onSaved,
}: ShipmentModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [couriers, setCouriers] = useState<couriersApi.CourierRow[]>([]);
  const [couriersLoading, setCouriersLoading] = useState(true);
  const [shipmentType, setShipmentType] = useState<'Courier' | 'Local'>('Courier');
  const [courierId, setCourierId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipmentCost, setShipmentCost] = useState('');
  const [chargedToCustomer, setChargedToCustomer] = useState('');
  const [weight, setWeight] = useState('');
  const [shipmentStatus, setShipmentStatus] = useState(mode === 'sale' ? 'Booked' : 'booked');
  const [bookingDate, setBookingDate] = useState(today);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const { run: runSave, busy: saving } = useSubmitLock();
  const [error, setError] = useState<string | null>(null);
  const [glMessage, setGlMessage] = useState<string | null>(null);

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
    setGlMessage(null);
    await runSave('Saving shipment...', async () => {
    if (mode === 'packing_list') {
      if (!packingListId || !saleId) {
        setError('Packing list and sale required.');
        return;
      }
      const { data, error: err } = await courierShipmentsApi.createCourierShipment({
        companyId,
        packingListId,
        courierId: courierId || null,
        trackingNumber: trackingNumber.trim() || null,
        shipmentCost: parseFloat(shipmentCost) || 0,
        status: shipmentStatus || 'booked',
        notes: notes.trim() || null,
        bookingDate,
        expectedDeliveryDate: expectedDeliveryDate || null,
        createdBy: dbUserId ?? null,
      });
      if (err) {
        setError(err);
        return;
      }
      if (data) {
        const cost = parseFloat(shipmentCost) || 0;
        const syncRes = await syncSaleShipmentFromCourier({
          courier: data,
          saleId,
          companyId,
          branchId,
          dbUserId: dbUserId ?? null,
          chargedToCustomer: cost,
          courierMasterId: courierId || null,
        });
        if (syncRes.error) {
          setError(syncRes.error);
          return;
        }
        if (syncRes.data?.glError) {
          setGlMessage(`Shipment saved; ledger: ${syncRes.data.glError}`);
        } else if (syncRes.data?.journalEntryId) {
          setGlMessage('Posted to Chart of Accounts.');
        } else if (syncRes.data?.glSkipped) {
          setGlMessage('Shipment saved (ledger already posted or zero amounts).');
        }
      }
      onSaved?.();
      onClose();
      return;
    }

    if (!saleId) {
      setError('Sale required.');
      return;
    }
    const cost = parseFloat(shipmentCost) || 0;
    const charged = parseFloat(chargedToCustomer) || cost;
    const { data, error: err } = await shipmentsApi.createShipment(
      saleId,
      companyId,
      branchId,
      {
        courierId: shipmentType === 'Courier' ? courierId || null : null,
        trackingNumber: trackingNumber.trim() || null,
        shipmentCost: cost,
        weight: weight.trim() ? parseFloat(weight) : undefined,
        shipmentStatus: shipmentStatus || 'Booked',
        shipmentType,
        chargedToCustomer: charged,
        bookingDate,
        expectedDeliveryDate: expectedDeliveryDate || null,
      },
      dbUserId ?? userId,
    );
    if (err) {
      setError(err);
      return;
    }
    if (data?.id) {
      const gl = await postSaleShipmentJournal(data.id, dbUserId ?? userId);
      if (!gl.success && gl.error) setGlMessage(`Shipment saved; ledger: ${gl.error}`);
      else if (gl.journalEntryId) setGlMessage('Posted to Chart of Accounts.');
    }
    onSaved?.();
    onClose();
    });
  };

  const title = mode === 'packing_list' ? 'Book courier / cargo' : 'Add shipment';
  const statusOptions =
    mode === 'sale'
      ? STATUS_OPTIONS_SALE
      : COURIER_STATUS_STEPS.map((s) => s.key);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="relative bg-[#1F2937] border border-[#374151] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <SaveBlockingOverlay active={saving} label="Saving shipment..." />
        <div className="flex items-center justify-between p-4 border-b border-[#374151] sticky top-0 bg-[#1F2937] z-10">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#10B981]" />
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-2 rounded-lg hover:bg-[#374151] text-[#9CA3AF] disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        {saleLabel && <p className="px-4 pt-2 text-sm text-[#9CA3AF]">Sale: {saleLabel}</p>}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/20 border border-red-500/50 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          {glMessage && (
            <div className="rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/50 px-3 py-2 text-sm text-[#E9D5FF]">
              {glMessage}
            </div>
          )}
          {mode === 'sale' && (
            <div>
              <label className="block text-sm font-medium text-[#D1D5DB] mb-1">Shipment type</label>
              <select
                value={shipmentType}
                onChange={(e) => setShipmentType(e.target.value as 'Courier' | 'Local')}
                className="w-full rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white"
              >
                <option value="Courier">Courier (TCS, DHL, etc.)</option>
                <option value="Local">Local delivery</option>
              </select>
            </div>
          )}
          {(mode === 'packing_list' || shipmentType === 'Courier') && (
            <div>
              <CustomSelect
                label="Courier"
                value={courierId}
                onChange={setCourierId}
                options={[
                  { value: '', label: 'Select courier' },
                  ...couriers.map((c) => ({ value: c.id, label: c.name })),
                ]}
                disabled={couriersLoading}
                zIndexClass="z-[100]"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <DateInputField
              label="Booking date"
              value={bookingDate}
              onChange={(v) => setBookingDate(toLocalDateString(v))}
            />
            <DateInputField
              label="Expected delivery"
              value={expectedDeliveryDate}
              onChange={(v) => setExpectedDeliveryDate(toLocalDateString(v))}
            />
          </div>
          <div>
            <CustomSelect
              label="Status"
              value={shipmentStatus}
              onChange={setShipmentStatus}
              options={statusOptions.map((s) => ({
                value: s,
                label: s.replace(/_/g, ' '),
              }))}
              zIndexClass="z-[100]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-1">Tracking number</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. TCS-1234567890"
              className="w-full rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white placeholder-[#6B7280]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#D1D5DB] mb-1">
              {mode === 'packing_list' ? 'Courier cost (Rs)' : 'Actual cost (Rs)'}
            </label>
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
          {mode === 'sale' && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1">Charged to customer (Rs)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={chargedToCustomer}
                  onChange={(e) => setChargedToCustomer(e.target.value)}
                  placeholder="Same as cost if blank"
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
            </>
          )}
          {mode === 'packing_list' && (
            <div>
              <label className="block text-sm font-medium text-[#D1D5DB] mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg bg-[#111827] border border-[#374151] px-3 py-2 text-white placeholder-[#6B7280]"
                placeholder="Optional"
              />
            </div>
          )}
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
              Book & post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
