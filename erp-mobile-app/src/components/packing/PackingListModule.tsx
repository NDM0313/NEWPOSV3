import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Package,
  Loader2,
  Truck,
  Plus,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
} from 'lucide-react';
import type { User } from '../../types';
import * as salesApi from '../../api/sales';
import * as packingListApi from '../../api/packingList';
import * as courierShipmentsApi from '../../api/courierShipments';
import type { EnrichedCourierShipment } from '../../api/courierShipments';
import * as shipmentsApi from '../../api/shipments';
import { ShipmentModal } from '../shipment/ShipmentModal';
import { ShipmentStatusStepper } from '../shipment/ShipmentStatusStepper';
import { ShipmentAccountingStrip } from '../shipment/ShipmentAccountingStrip';
import { resolveDbUserId } from '../../lib/resolveDbUserId';
import { updateCourierAndSyncSale } from '../../api/shipmentSync';
import { nextCourierStatus, statusLabel } from '../../lib/shipmentStatus';

interface PackingListModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

type View = 'shipments' | 'detail' | 'pick_sale';

export function PackingListModule({ onBack, user, companyId, branchId }: PackingListModuleProps) {
  const dbUserId = resolveDbUserId(user);
  const [view, setView] = useState<View>('shipments');
  const [shipments, setShipments] = useState<EnrichedCourierShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EnrichedCourierShipment | null>(null);
  const [saleShipmentId, setSaleShipmentId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookContext, setBookContext] = useState<{
    saleId: string;
    packingListId: string;
    saleLabel: string;
  } | null>(null);
  const [sales, setSales] = useState<Array<Record<string, unknown>>>([]);
  const [salePackingMap, setSalePackingMap] = useState<Record<string, string>>({});
  const [creatingSaleId, setCreatingSaleId] = useState<string | null>(null);
  const [showCargoItems, setShowCargoItems] = useState(false);
  const [packingItems, setPackingItems] = useState<packingListApi.PackingListItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [bookingDateEdit, setBookingDateEdit] = useState('');
  const [expectedDateEdit, setExpectedDateEdit] = useState('');

  const loadShipments = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await courierShipmentsApi.listCourierShipmentsEnriched(companyId, 100);
    setLoading(false);
    if (err) setError(err);
    else setShipments(data || []);
  }, [companyId]);

  useEffect(() => {
    void loadShipments();
  }, [loadShipments]);

  const loadSalesForPick = useCallback(async () => {
    if (!companyId) return;
    const [salesRes, plRes] = await Promise.all([
      salesApi.getAllSales(companyId, branchId ?? undefined),
      packingListApi.listPackingListsByCompany(companyId),
    ]);
    setSales(salesRes.data || []);
    if (plRes.data?.length) {
      const map: Record<string, string> = {};
      for (const pl of plRes.data) {
        if (pl.sale_id && !map[pl.sale_id]) map[pl.sale_id] = pl.id;
      }
      setSalePackingMap(map);
    }
  }, [companyId, branchId]);

  const resolveSaleShipmentId = async (saleId: string) => {
    const { data } = await shipmentsApi.getShipmentsBySaleId(saleId);
    const last = data?.[data.length - 1];
    setSaleShipmentId(last?.id ? String(last.id) : null);
  };

  const openDetail = async (row: EnrichedCourierShipment) => {
    setSelected(row);
    setBookingDateEdit(row.booking_date?.slice(0, 10) ?? row.created_at?.slice(0, 10) ?? '');
    setExpectedDateEdit(row.expected_delivery_date?.slice(0, 10) ?? '');
    setView('detail');
    setShowCargoItems(false);
    if (row.saleId) await resolveSaleShipmentId(row.saleId);
    if (row.packing_list_id) {
      setItemsLoading(true);
      const { data } = await packingListApi.getPackingListWithItems(row.packing_list_id);
      setItemsLoading(false);
      setPackingItems(data?.items || []);
    }
  };

  const handleAdvanceStatus = async (nextStatus: string) => {
    if (!selected || !companyId || !branchId || !selected.saleId) return;
    setStatusUpdating(true);
    setError(null);
    const err = await updateCourierAndSyncSale({
      courierShipmentId: selected.id,
      saleId: selected.saleId,
      companyId,
      branchId,
      dbUserId,
      updates: { status: nextStatus },
    });
    setStatusUpdating(false);
    if (err.error) {
      setError(err.error);
      return;
    }
    setSelected((prev) => (prev ? { ...prev, status: nextStatus } : null));
    await loadShipments();
    await resolveSaleShipmentId(selected.saleId);
  };

  const saveDates = async () => {
    if (!selected || !companyId || !branchId || !selected.saleId) return;
    setStatusUpdating(true);
    const err = await updateCourierAndSyncSale({
      courierShipmentId: selected.id,
      saleId: selected.saleId,
      companyId,
      branchId,
      dbUserId,
      updates: {
        booking_date: bookingDateEdit || null,
        expected_delivery_date: expectedDateEdit || null,
      },
    });
    setStatusUpdating(false);
    if (err.error) setError(err.error);
    else {
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              booking_date: bookingDateEdit,
              expected_delivery_date: expectedDateEdit,
            }
          : null,
      );
    }
  };

  const ensurePackingListAndBook = async (saleId: string, invoiceNo: string) => {
    if (!companyId) return;
    let plId = salePackingMap[saleId];
    if (!plId) {
      setCreatingSaleId(saleId);
      const { data, error: err } = await packingListApi.createPackingListFromSale({
        companyId,
        saleId,
        branchId: branchId ?? undefined,
        createdBy: dbUserId,
      });
      setCreatingSaleId(null);
      if (err) {
        setError(err);
        return;
      }
      if (!data) return;
      plId = data.id;
      setSalePackingMap((prev) => ({ ...prev, [saleId]: plId! }));
    }
    setBookContext({ saleId, packingListId: plId, saleLabel: invoiceNo });
    setBookModalOpen(true);
  };

  if (view === 'detail' && selected) {
    const next = nextCourierStatus(selected.status);
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button
              type="button"
              onClick={() => {
                setView('shipments');
                setSelected(null);
              }}
              className="p-2 hover:bg-[#374151] rounded-lg text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Truck className="w-6 h-6 text-[#0EA5E9]" />
            <h1 className="text-white font-semibold text-base min-w-0 truncate">{selected.saleLabel}</h1>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/20 border border-red-500/50 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
            <p className="text-lg font-semibold text-white">{selected.customerName}</p>
            {selected.customerPhone !== '—' && (
              <p className="text-sm text-[#9CA3AF]">{selected.customerPhone}</p>
            )}
            {selected.customerAddress !== '—' && (
              <p className="text-sm text-[#D1D5DB] flex items-start gap-1.5">
                <MapPin className="w-4 h-4 shrink-0 text-[#6B7280] mt-0.5" />
                {selected.customerAddress}
              </p>
            )}
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Shipment status</p>
            <ShipmentStatusStepper
              status={selected.status}
              disabled={statusUpdating}
              onAdvance={(s) => void handleAdvanceStatus(s)}
            />
            {next && (
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => void handleAdvanceStatus(next)}
                className="w-full py-2 rounded-lg bg-[#0EA5E9]/20 text-[#7DD3FC] text-sm font-medium disabled:opacity-50"
              >
                {statusUpdating ? 'Updating…' : `Mark as ${statusLabel(next)}`}
              </button>
            )}
            <p className="text-sm text-white">
              {selected.courier?.name ?? 'Courier'}
              {selected.tracking_number ? ` · ${selected.tracking_number}` : ''}
            </p>
            <p className="text-sm text-[#9CA3AF]">
              Cost Rs. {Number(selected.shipment_cost || 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Dates
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[#9CA3AF]">Booking date</label>
                <input
                  type="date"
                  value={bookingDateEdit}
                  onChange={(e) => setBookingDateEdit(e.target.value)}
                  className="w-full mt-1 h-9 rounded bg-[#111827] border border-[#374151] text-white px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#9CA3AF]">Expected delivery</label>
                <input
                  type="date"
                  value={expectedDateEdit}
                  onChange={(e) => setExpectedDateEdit(e.target.value)}
                  className="w-full mt-1 h-9 rounded bg-[#111827] border border-[#374151] text-white px-2 text-sm"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={statusUpdating}
              onClick={() => void saveDates()}
              className="w-full py-2 rounded-lg border border-[#374151] text-[#D1D5DB] text-sm"
            >
              Save dates
            </button>
          </div>

          <ShipmentAccountingStrip saleShipmentId={saleShipmentId} />

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCargoItems((v) => !v)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="text-sm font-medium text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-[#10B981]" />
                Cargo line items ({packingItems.length})
              </span>
              {showCargoItems ? (
                <ChevronUp className="w-5 h-5 text-[#9CA3AF]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#9CA3AF]" />
              )}
            </button>
            {showCargoItems && (
              <div className="px-4 pb-4 border-t border-[#374151]">
                {itemsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 text-[#10B981] animate-spin" />
                  </div>
                ) : packingItems.length === 0 ? (
                  <p className="text-sm text-[#6B7280] py-4">No line items.</p>
                ) : (
                  <ul className="space-y-2 mt-2">
                    {packingItems.map((item) => (
                      <li
                        key={item.id}
                        className="bg-[#111827] rounded-lg p-2.5 text-sm flex justify-between gap-2"
                      >
                        <span className="text-white truncate">{item.product_name ?? '—'}</span>
                        <span className="text-[#9CA3AF] shrink-0">
                          {item.pieces} pc / {item.cartons} ct
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'pick_sale') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button
              type="button"
              onClick={() => setView('shipments')}
              className="p-2 hover:bg-[#374151] rounded-lg text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-semibold text-base">Book new shipment</h1>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-[#9CA3AF] mb-4">Select a sale to book courier cargo.</p>
          <ul className="space-y-2">
            {sales.slice(0, 60).map((sale) => {
              const id = sale.id as string;
              const invoiceNo =
                (sale.invoice_no as string) || (sale.order_no as string) || '—';
              const customerName =
                (sale.customer as { name?: string })?.name ??
                (sale.customer_name as string) ??
                'Walk-in';
              const creating = creatingSaleId === id;
              return (
                <li key={id} className="bg-[#1F2937] border border-[#374151] rounded-lg p-3">
                  <p className="font-medium text-white">{invoiceNo}</p>
                  <p className="text-sm text-[#9CA3AF]">{customerName}</p>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => void ensurePackingListAndBook(id, String(invoiceNo))}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0EA5E9]/20 text-[#7DD3FC] text-sm font-medium disabled:opacity-50"
                  >
                    {creating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Truck className="w-4 h-4" />
                    )}
                    Book courier
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {bookModalOpen && bookContext && companyId && branchId && (
          <ShipmentModal
            mode="packing_list"
            packingListId={bookContext.packingListId}
            saleId={bookContext.saleId}
            saleLabel={bookContext.saleLabel}
            companyId={companyId}
            branchId={branchId}
            userId={user.id}
            dbUserId={dbUserId}
            onClose={() => {
              setBookModalOpen(false);
              setBookContext(null);
            }}
            onSaved={() => {
              void loadShipments();
              setView('shipments');
              setBookModalOpen(false);
              setBookContext(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button type="button" onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Truck className="w-6 h-6 text-[#0EA5E9]" />
          <h1 className="text-white font-semibold text-base flex-1">Shipment & Cargo</h1>
          <button
            type="button"
            onClick={() => {
              void loadSalesForPick();
              setView('pick_sale');
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0EA5E9]/20 text-[#7DD3FC] text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Book
          </button>
        </div>
      </div>
      <div className="p-4">
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        <p className="text-sm text-[#9CA3AF] mb-4">
          Shipments booked with courier — tap to update status and delivery dates.
        </p>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#0EA5E9] animate-spin" />
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[#9CA3AF] mb-4">No shipments booked yet.</p>
            <button
              type="button"
              onClick={() => {
                void loadSalesForPick();
                setView('pick_sale');
              }}
              className="px-4 py-2 rounded-lg bg-[#0EA5E9] text-white text-sm font-medium"
            >
              Book first shipment
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {shipments.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void openDetail(s)}
                  className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#0EA5E9] transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{s.saleLabel}</p>
                      <p className="text-sm text-[#9CA3AF] truncate">{s.customerName}</p>
                      {s.customerAddress !== '—' && (
                        <p className="text-xs text-[#6B7280] truncate mt-0.5">{s.customerAddress}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-[#0EA5E9]/20 text-[#7DD3FC] capitalize">
                      {statusLabel(s.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#9CA3AF]">
                    <span>
                      Booked: {s.booking_date?.slice(0, 10) ?? s.created_at?.slice(0, 10) ?? '—'}
                    </span>
                    {s.expected_delivery_date && (
                      <span>Expected: {s.expected_delivery_date.slice(0, 10)}</span>
                    )}
                    <span>{s.courier?.name ?? 'Courier'}</span>
                    {s.tracking_number && <span>{s.tracking_number}</span>}
                  </div>
                  <p className="text-sm text-[#D1D5DB] mt-1">
                    Rs. {Number(s.shipment_cost || 0).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
