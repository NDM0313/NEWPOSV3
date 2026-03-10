import React, { useEffect, useState } from 'react';
import { shipmentAccountingService } from '@/app/services/shipmentAccountingService';
import { Truck, TrendingDown, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

interface CourierBalance {
  courier_id: string | null;
  courier_name: string;
  total_payable: number;
  total_paid: number;
  balance: number;
}

interface CourierLedgerPanelProps {
  companyId: string;
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency', currency: 'PKR', maximumFractionDigits: 0,
  }).format(amount);
}

export default function CourierLedgerPanel({ companyId }: CourierLedgerPanelProps) {
  const [balances, setBalances] = useState<CourierBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    shipmentAccountingService
      .getCourierBalances(companyId)
      .then(setBalances)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [companyId]);

  const totalPayable = balances.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Courier Balances</h3>
        </div>
        <button
          onClick={load}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary card */}
      {!loading && !error && balances.length > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">Total Courier Payable</span>
          <span className="text-base font-bold text-indigo-300">{fmt(totalPayable)}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
          <RefreshCw size={14} className="animate-spin" />
          Loading balances…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && balances.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-4">
          No courier balances yet.
        </div>
      )}

      {/* Table */}
      {!loading && !error && balances.length > 0 && (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/5 text-gray-400 border-b border-white/10">
                <th className="text-left px-3 py-2 font-medium">Courier</th>
                <th className="text-right px-3 py-2 font-medium">Payable</th>
                <th className="text-right px-3 py-2 font-medium">Paid</th>
                <th className="text-right px-3 py-2 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b, i) => (
                <tr
                  key={b.courier_id ?? b.courier_name}
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Truck size={12} className="text-gray-500 shrink-0" />
                      <span className="text-white font-medium truncate">{b.courier_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-orange-300">{fmt(b.total_payable)}</td>
                  <td className="px-3 py-2 text-right text-green-400">{fmt(b.total_paid)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={b.balance > 0 ? 'text-red-400 font-semibold' : 'text-green-400'}>
                      {fmt(b.balance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
