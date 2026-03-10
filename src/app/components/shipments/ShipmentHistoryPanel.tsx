import React, { useEffect, useState } from 'react';
import { shipmentAccountingService } from '@/app/services/shipmentAccountingService';
import { Package, Clock, Truck, CheckCircle, RotateCcw, AlertCircle } from 'lucide-react';

interface HistoryEntry {
  id: string;
  shipment_id: string;
  status: string;
  tracking_number?: string | null;
  courier_name?: string | null;
  charged_to_customer: number;
  actual_cost: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

interface ShipmentHistoryPanelProps {
  shipmentId: string;
}

function statusIcon(status: string) {
  const s = status.toLowerCase();
  if (s.includes('created')) return <Package size={14} className="text-blue-400" />;
  if (s.includes('delivered')) return <CheckCircle size={14} className="text-green-400" />;
  if (s.includes('returned')) return <RotateCcw size={14} className="text-orange-400" />;
  if (s.includes('tracking')) return <Truck size={14} className="text-indigo-400" />;
  if (s.includes('dispatched') || s.includes('booked')) return <Truck size={14} className="text-purple-400" />;
  return <Clock size={14} className="text-gray-400" />;
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes('delivered')) return 'bg-green-500/10 text-green-400 border-green-500/20';
  if (s.includes('returned')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  if (s.includes('dispatched') || s.includes('booked')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  if (s.includes('created')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (s.includes('updated')) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
  return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ShipmentHistoryPanel({ shipmentId }: ShipmentHistoryPanelProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shipmentId) return;
    setLoading(true);
    shipmentAccountingService
      .getShipmentHistory(shipmentId)
      .then((data) => setHistory(data as HistoryEntry[]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-gray-400">
        <Clock size={14} className="animate-spin" />
        Loading history…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-red-400">
        <AlertCircle size={14} />
        {error}
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">No history available.</div>
    );
  }

  return (
    <div className="space-y-2 py-2">
      {history.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 px-3 py-3 rounded-lg bg-[#1a2035] border border-white/5"
        >
          <div className="mt-0.5">{statusIcon(entry.status)}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statusColor(entry.status)}`}>
                {entry.status}
              </span>
              {entry.courier_name && (
                <span className="text-xs text-gray-400">{entry.courier_name}</span>
              )}
            </div>

            {entry.tracking_number && (
              <p className="text-xs text-gray-400 mt-1">
                Tracking: <span className="text-white font-mono">{entry.tracking_number}</span>
              </p>
            )}

            {(entry.charged_to_customer > 0 || entry.actual_cost > 0) && (
              <div className="flex gap-3 mt-1 text-xs">
                {entry.charged_to_customer > 0 && (
                  <span className="text-gray-400">
                    Customer: <span className="text-green-400 font-medium">{fmt(entry.charged_to_customer)}</span>
                  </span>
                )}
                {entry.actual_cost > 0 && (
                  <span className="text-gray-400">
                    Cost: <span className="text-orange-400 font-medium">{fmt(entry.actual_cost)}</span>
                  </span>
                )}
              </div>
            )}

            {entry.notes && (
              <p className="text-xs text-gray-500 mt-1 truncate">{entry.notes}</p>
            )}
          </div>

          <div className="text-xs text-gray-500 whitespace-nowrap shrink-0">
            {fmtDate(entry.created_at)}
          </div>
        </div>
      ))}
    </div>
  );
}
