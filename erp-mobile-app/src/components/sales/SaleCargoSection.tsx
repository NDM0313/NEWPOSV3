import { useEffect, useState } from 'react';
import { Truck, Plus, Loader2 } from 'lucide-react';
import * as shipmentsApi from '../../api/shipments';
import * as packingListApi from '../../api/packingList';
import * as courierShipmentsApi from '../../api/courierShipments';
import { ShipmentModal } from '../shipment/ShipmentModal';
import { ShipmentStatusStepper } from '../shipment/ShipmentStatusStepper';
import { ShipmentAccountingStrip } from '../shipment/ShipmentAccountingStrip';
import { updateCourierAndSyncSale } from '../../api/shipmentSync';
import { statusLabel } from '../../lib/shipmentStatus';

interface SaleCargoSectionProps {
  saleId: string;
  saleLabel: string;
  companyId: string;
  branchId: string;
  authUserId: string;
  dbUserId?: string | null;
}

export function SaleCargoSection({
  saleId,
  saleLabel,
  companyId,
  branchId,
  authUserId,
  dbUserId,
}: SaleCargoSectionProps) {
  const [saleShipments, setSaleShipments] = useState<Array<Record<string, unknown>>>([]);
  const [courierRows, setCourierRows] = useState<courierShipmentsApi.CourierShipmentRow[]>([]);
  const [packingListId, setPackingListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<'sale' | 'packing_list' | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const primarySaleShipmentId =
    saleShipments.length > 0 ? String(saleShipments[saleShipments.length - 1].id) : null;
  const primaryCourier = courierRows[0] ?? null;

  const reload = async () => {
    setLoading(true);
    const [ssRes, plRes] = await Promise.all([
      shipmentsApi.getShipmentsBySaleId(saleId),
      packingListApi.listPackingListsBySale(saleId),
    ]);
    setSaleShipments(ssRes.data || []);
    const pl = plRes.data?.[0];
    setPackingListId(pl?.id ?? null);
    if (pl?.id) {
      const csRes = await courierShipmentsApi.listCourierShipmentsByPackingList(pl.id);
      setCourierRows(csRes.data || []);
    } else {
      setCourierRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, [saleId]);

  const handleCourierStatus = async (nextStatus: string) => {
    if (!primaryCourier) return;
    setStatusUpdating(true);
    await updateCourierAndSyncSale({
      courierShipmentId: primaryCourier.id,
      saleId,
      companyId,
      branchId,
      dbUserId,
      updates: { status: nextStatus },
    });
    setStatusUpdating(false);
    void reload();
  };

  return (
    <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#0EA5E9]" />
          Shipment & Cargo
        </h3>
        <button
          type="button"
          onClick={() => setModalMode(packingListId ? 'packing_list' : 'sale')}
          className="flex items-center gap-1 text-xs text-[#7DD3FC] font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Book cargo
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 text-[#0EA5E9] animate-spin" />
        </div>
      ) : saleShipments.length === 0 && courierRows.length === 0 ? (
        <p className="text-xs text-[#6B7280]">No shipments booked yet.</p>
      ) : (
        <>
          {primaryCourier && (
            <div className="bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold text-white">
                {primaryCourier.courier?.name ?? 'Courier'}
              </p>
              <ShipmentStatusStepper
                status={primaryCourier.status}
                disabled={statusUpdating}
                onAdvance={(s) => void handleCourierStatus(s)}
              />
              {primaryCourier.tracking_number && (
                <p className="text-xs text-[#D1D5DB]">Tracking: {primaryCourier.tracking_number}</p>
              )}
              <p className="text-xs text-[#9CA3AF]">
                Booked:{' '}
                {primaryCourier.booking_date?.slice(0, 10) ??
                  primaryCourier.created_at?.slice(0, 10) ??
                  '—'}
                {primaryCourier.expected_delivery_date &&
                  ` · Expected: ${primaryCourier.expected_delivery_date.slice(0, 10)}`}
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Cost Rs. {Number(primaryCourier.shipment_cost || 0).toLocaleString()} ·{' '}
                {statusLabel(primaryCourier.status)}
              </p>
            </div>
          )}
          {saleShipments.map((s) => {
            const id = String(s.id);
            if (primaryCourier && id === primarySaleShipmentId) return null;
            return (
              <li key={id} className="bg-[#111827] rounded-lg p-2.5 text-sm list-none">
                <p className="text-white font-medium">
                  {String(s.shipment_type || 'Courier')}
                  <span className="text-[#9CA3AF] font-normal ml-2">
                    {String(s.shipment_status || '—')}
                  </span>
                </p>
                {s.tracking_id != null && String(s.tracking_id) !== '' && (
                  <p className="text-xs text-[#D1D5DB] mt-0.5">Tracking: {String(s.tracking_id)}</p>
                )}
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Cost Rs. {Number(s.actual_cost || 0).toLocaleString()}
                </p>
              </li>
            );
          })}
          <ShipmentAccountingStrip saleShipmentId={primarySaleShipmentId} />
        </>
      )}

      {modalMode && (
        <ShipmentModal
          mode={modalMode}
          saleId={saleId}
          packingListId={modalMode === 'packing_list' ? packingListId ?? undefined : undefined}
          saleLabel={saleLabel}
          companyId={companyId}
          branchId={branchId}
          userId={authUserId}
          dbUserId={dbUserId}
          onClose={() => setModalMode(null)}
          onSaved={() => {
            void reload();
            setModalMode(null);
          }}
        />
      )}
    </div>
  );
}
