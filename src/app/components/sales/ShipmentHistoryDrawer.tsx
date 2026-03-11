/**
 * Shipment History Drawer — shows courier, tracking number, and status timeline
 * from shipment_history for a shipment. Opened when clicking shipment status in Sales list.
 */

import React, { useState, useEffect } from 'react';
import { X, Truck, Hash, Calendar } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { shipmentAccountingService } from '@/app/services/shipmentAccountingService';
import { shipmentService, type SaleShipmentRow } from '@/app/services/shipmentService';
import { formatDateAndTime } from '@/app/components/ui/utils';

export interface ShipmentHistoryRecord {
  id?: string;
  shipment_id: string;
  status: string;
  tracking_number?: string | null;
  courier_name?: string | null;
  charged_to_customer?: number;
  actual_cost?: number;
  notes?: string | null;
  created_at: string;
  created_by?: string | null;
}

interface ShipmentHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shipmentId: string | null;
  saleId?: string | null;
  invoiceNo?: string;
}

export function ShipmentHistoryDrawer({
  isOpen,
  onClose,
  shipmentId,
  saleId,
  invoiceNo,
}: ShipmentHistoryDrawerProps) {
  const [shipment, setShipment] = useState<SaleShipmentRow | null>(null);
  const [history, setHistory] = useState<ShipmentHistoryRecord[]>([]);
  const [ledgerRow, setLedgerRow] = useState<{ shipping_income: number; shipping_expense: number; courier_payable: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !shipmentId) {
      setShipment(null);
      setHistory([]);
      setLedgerRow(null);
      return;
    }
    setLoading(true);
    Promise.all([
      shipmentService.getById(shipmentId),
      shipmentAccountingService.getShipmentHistory(shipmentId),
      shipmentAccountingService.getShipmentLedgerByShipmentIds([shipmentId]),
    ])
      .then(([row, h, ledgerRows]) => {
        setShipment(row ?? null);
        setHistory((h ?? []) as ShipmentHistoryRecord[]);
        const first = (ledgerRows ?? [])[0] as { shipping_income?: number; shipping_expense?: number; courier_payable?: number } | undefined;
        if (first) {
          setLedgerRow({
            shipping_income: Number(first.shipping_income) || 0,
            shipping_expense: Number(first.shipping_expense) || 0,
            courier_payable: Number(first.courier_payable) || 0,
          });
        } else {
          setLedgerRow(null);
        }
      })
      .catch(() => {
        setShipment(null);
        setHistory([]);
        setLedgerRow(null);
      })
      .finally(() => setLoading(false));
  }, [isOpen, shipmentId]);

  if (!isOpen) return null;

  const fmtDate = (iso: string) => {
    const { date, time } = formatDateAndTime(iso);
    return `${date} ${time}`;
  };
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#0F1419] border-l border-gray-800 shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Truck size={20} className="text-indigo-400" />
            Shipment History
            {invoiceNo && (
              <span className="text-sm font-normal text-gray-400">— {invoiceNo}</span>
            )}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading…</div>
          ) : (
            <>
              {shipment && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Truck size={16} className="text-gray-500" />
                    <span className="text-gray-400">Courier:</span>
                    <span className="text-white">{shipment.courier_name || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Hash size={16} className="text-gray-500" />
                    <span className="text-gray-400">Tracking:</span>
                    <span className="text-white font-mono">{shipment.tracking_id || '—'}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-800">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Customer Charged</span>
                      <span className="text-green-400">{fmtCurrency(Number(shipment.charged_to_customer) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Courier Cost</span>
                      <span className="text-red-400">{fmtCurrency(Number(shipment.actual_cost) || 0)}</span>
                    </div>
                    {ledgerRow && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Courier Payable</span>
                        <span className="text-amber-400">{fmtCurrency(ledgerRow.courier_payable)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Calendar size={14} />
                  Status Timeline
                </h4>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500">No history records yet.</p>
                ) : (
                  <div className="space-y-0">
                    {[...history].reverse().map((rec, i) => (
                      <div key={rec.id ?? i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 rounded-full bg-indigo-500" />
                          {i < history.length - 1 && (
                            <div className="w-0.5 flex-1 min-h-[24px] bg-gray-700" />
                          )}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm font-medium text-white">{rec.status}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{fmtDate(rec.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
