import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import * as courierShipmentsApi from '../../../api/courierShipments';
import * as shipmentsApi from '../../../api/shipments';
import { ReportHeader } from './_shared/ReportHeader';
import { ReportShell } from './_shared/ReportShell';
import { formatAmount } from './_shared/format';

interface CourierShipmentsReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  onOpenSale?: (saleId: string) => void;
}

type Row =
  | { kind: 'courier'; id: string; label: string; tracking: string; cost: number; status: string; saleId?: string }
  | { kind: 'sale'; id: string; label: string; tracking: string; cost: number; status: string; saleId: string };

export function CourierShipmentsReport({ onBack, companyId, onOpenSale }: CourierShipmentsReportProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [csRes, salesRes] = await Promise.all([
        courierShipmentsApi.listCourierShipmentsByCompany(companyId, 80),
        shipmentsApi.listRecentSaleShipments(companyId, 80),
      ]);
      if (cancelled) return;
      const merged: Row[] = [];
      for (const cs of csRes.data || []) {
        const saleId = (cs.packing_list as { sale_id?: string } | undefined)?.sale_id;
        merged.push({
          kind: 'courier',
          id: cs.id,
          label: cs.courier?.name ?? 'Courier shipment',
          tracking: cs.tracking_number ?? '—',
          cost: Number(cs.shipment_cost || 0),
          status: cs.status,
          saleId,
        });
      }
      for (const s of salesRes.data || []) {
        merged.push({
          kind: 'sale',
          id: String(s.id),
          label: String(s.shipment_type || 'Sale shipment'),
          tracking: String(s.tracking_id || '—'),
          cost: Number(s.actual_cost || 0),
          status: String(s.shipment_status || '—'),
          saleId: String(s.sale_id),
        });
      }
      merged.sort((a, b) => b.cost - a.cost);
      setRows(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader onBack={onBack} title="Courier Shipments" subtitle="Cargo bookings & sale shipments" />
      <ReportShell>
        {loading ? (
          <p className="text-sm text-[#9CA3AF] text-center py-8">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-8">No shipments found.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <button
                  type="button"
                  disabled={!r.saleId || !onOpenSale}
                  onClick={() => r.saleId && onOpenSale?.(r.saleId)}
                  className={`w-full text-left p-3 rounded-xl border ${
                    r.saleId && onOpenSale
                      ? 'bg-[#1F2937] border-[#374151] hover:border-[#0EA5E9] cursor-pointer'
                      : 'bg-[#1F2937] border-[#374151] cursor-default'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#0EA5E9]/20 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-[#7DD3FC]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{r.label}</p>
                      <p className="text-xs text-[#9CA3AF] mt-0.5 capitalize">
                        {r.kind === 'courier' ? 'Packing list courier' : 'Direct sale'} · {r.status}
                      </p>
                      <p className="text-xs text-[#6B7280] mt-0.5">Tracking: {r.tracking}</p>
                      <p className="text-sm font-bold text-white mt-1">Rs. {formatAmount(r.cost, 0)}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ReportShell>
    </div>
  );
}
