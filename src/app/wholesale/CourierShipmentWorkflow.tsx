/**
 * Wholesale: Courier Shipment workflow (Step 5).
 * From a packing list: create shipment (courier, tracking, cost), print Courier Slip.
 */
import React, { useState, useEffect } from 'react';
import { courierShipmentService, type CourierShipmentRow } from '@/app/services/courierShipmentService';
import { packingListService } from '@/app/services/packingListService';
import { courierService } from '@/app/services/courierService';
import { UnifiedCourierSlipView } from '@/app/documents';
import type { CourierSlipDocument } from '@/app/documents/templates/CourierSlipTemplate';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Truck, Printer, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { toast } from 'sonner';

export interface CourierShipmentWorkflowProps {
  packingListId: string;
  companyId: string;
  companyName: string;
  companyAddress?: string | null;
  /** For slip: order no and customer (from sale) */
  orderNo?: string;
  customerName?: string;
  customerAddress?: string | null;
  customerPhone?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export const CourierShipmentWorkflow: React.FC<CourierShipmentWorkflowProps> = ({
  packingListId,
  companyId,
  companyName,
  companyAddress,
  orderNo = '',
  customerName = '',
  customerAddress,
  customerPhone,
  isOpen,
  onClose,
  onCreated,
}) => {
  const [couriers, setCouriers] = useState<Array<{ id: string; name: string; tracking_url: string | null }>>([]);
  const [courierId, setCourierId] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipmentCost, setShipmentCost] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [shipments, setShipments] = useState<CourierShipmentRow[]>([]);
  const [slipDoc, setSlipDoc] = useState<CourierSlipDocument | null>(null);

  useEffect(() => {
    if (!companyId) return;
    courierService.getByCompanyId(companyId).then((list) => setCouriers(list));
  }, [companyId]);

  useEffect(() => {
    if (!isOpen || !packingListId) return;
    courierShipmentService.listByPackingList(packingListId).then(setShipments);
  }, [isOpen, packingListId]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const cost = parseFloat(shipmentCost) || 0;
      const ship = await courierShipmentService.create({
        companyId,
        packingListId,
        courierId: courierId || null,
        trackingNumber: trackingNumber.trim() || null,
        shipmentCost: cost,
        notes: notes.trim() || null,
      });
      toast.success('Shipment created');
      onCreated?.();
      setShipments((prev) => [ship, ...prev]);
      setTrackingNumber('');
      setShipmentCost('');
      setNotes('');

      const courierName = couriers.find((c) => c.id === courierId)?.name || 'Courier';
      const doc: CourierSlipDocument = {
        companyName,
        companyAddress: companyAddress ?? null,
        orderNo: orderNo || packingListId.slice(0, 8),
        date: new Date().toISOString().slice(0, 10),
        customerName: customerName || 'Customer',
        customerAddress: customerAddress ?? null,
        customerPhone: customerPhone ?? null,
        courierName,
        trackingNumber: ship.tracking_number || '',
        shipmentCost: cost > 0 ? `${cost}` : '—',
        status: ship.status,
        notes: ship.notes ?? null,
      };
      setSlipDoc(doc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create shipment');
    } finally {
      setCreating(false);
    }
  };

  const handlePrintSlip = (ship: CourierShipmentRow) => {
    const courierName = ship.courier?.name || 'Courier';
    const doc: CourierSlipDocument = {
      companyName,
      companyAddress: companyAddress ?? null,
      orderNo: orderNo || packingListId.slice(0, 8),
      date: ship.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      customerName: customerName || 'Customer',
      customerAddress: customerAddress ?? null,
      customerPhone: customerPhone ?? null,
      courierName,
      trackingNumber: ship.tracking_number || '—',
      shipmentCost: ship.shipment_cost > 0 ? String(ship.shipment_cost) : '—',
      status: ship.status,
      notes: ship.notes ?? null,
    };
    setSlipDoc(doc);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Create Shipment
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Packing list: {packingListId.slice(0, 8)}…</p>

          <div className="space-y-3 mt-3">
            <div>
              <Label>Courier</Label>
              <select
                className="w-full mt-1 rounded border px-3 py-2 text-sm"
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
              >
                <option value="">Select</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tracking number</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. TCS123456"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Shipment cost</Label>
              <Input
                type="number"
                step="0.01"
                value={shipmentCost}
                onChange={(e) => setShipmentCost(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Create & Print Slip
            </Button>
          </div>

          {shipments.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Existing shipments</p>
              <ul className="space-y-2">
                {shipments.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm rounded border p-2">
                    <span>{s.courier?.name || '—'} · {s.tracking_number || '—'}</span>
                    <Button variant="outline" size="sm" onClick={() => handlePrintSlip(s)} className="gap-1">
                      <Printer className="h-3 w-3" />
                      Print
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {slipDoc && (
        <Dialog open={!!slipDoc} onOpenChange={(open) => !open && setSlipDoc(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto print:max-w-none">
            <UnifiedCourierSlipView
              document={slipDoc}
              companyId={companyId}
              onClose={() => setSlipDoc(null)}
              showPrintAction={true}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
