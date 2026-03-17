import React, { useEffect, useState } from 'react';
import { shipmentAccountingService } from '@/app/services/shipmentAccountingService';
import { Truck, Package, DollarSign, TrendingDown, RefreshCw, AlertCircle, ChevronDown } from 'lucide-react';

interface LedgerRow {
  shipment_id: string;
  company_id: string;
  courier_id: string | null;
  courier_name: string;
  date: string;
  shipping_income: number;
  shipping_expense: number;
  courier_payable: number;
  journal_entry_id: string;
  entry_no: string;
}

interface ShipmentLedgerPageProps {
  companyId: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency', currency: 'PKR', maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ShipmentLedgerPage({ companyId }: ShipmentLedgerPageProps) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<string>('');

  function load(courierId?: string) {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    shipmentAccountingService
      .getShipmentLedger(companyId, courierId || undefined)
      .then((data) => setRows(data as LedgerRow[]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [companyId]);

  // Build dropdown from rows using courier_id (UUID); views expect UUID, not name.
  const courierOptions = (() => {
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    for (const r of rows) {
      if (r.courier_id && !seen.has(r.courier_id)) {
        seen.add(r.courier_id);
        out.push({ id: r.courier_id, name: r.courier_name || 'Unknown' });
      }
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  })();

  const totalIncome = rows.reduce((s, r) => s + (r.shipping_income ?? 0), 0);
  const totalExpense = rows.reduce((s, r) => s + (r.shipping_expense ?? 0), 0);
  const totalPayable = rows.reduce((s, r) => s + (r.courier_payable ?? 0), 0);
  const netProfit = totalIncome - totalExpense;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Truck size={20} className="text-indigo-400" />
          <h2 className="text-base font-semibold text-white">Shipment Ledger</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Courier filter: value must be courier_id (UUID); backend expects UUID */}
          <div className="relative">
            <select
              value={selectedCourier}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedCourier(v);
                load(v || undefined);
              }}
              className="appearance-none bg-[#1a2035] border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">All Couriers</option>
              {courierOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => load(selectedCourier ? selectedCourier : undefined)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg border border-white/10"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Shipping Income" value={totalIncome} color="green" icon={<DollarSign size={14} />} />
          <SummaryCard label="Shipping Expense" value={totalExpense} color="orange" icon={<TrendingDown size={14} />} />
          <SummaryCard label="Courier Payable" value={totalPayable} color="red" icon={<Truck size={14} />} />
          <SummaryCard
            label="Net Margin"
            value={netProfit}
            color={netProfit >= 0 ? 'green' : 'red'}
            icon={<Package size={14} />}
          />
        </div>
      )}

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-8">
          <RefreshCw size={14} className="animate-spin" /> Loading ledger…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 py-3">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-8">
          <p className="font-medium">No shipment ledger entries yet</p>
          <p className="text-xs mt-1">Create shipments from Sales to see income, expense, and courier payable here.</p>
        </div>
      )}

      {/* Ledger table */}
      {!loading && !error && rows.length > 0 && (
        <div className="rounded-lg border border-white/10 overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="bg-white/5 text-gray-400 border-b border-white/10">
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Entry No.</th>
                <th className="text-left px-3 py-2 font-medium">Courier</th>
                <th className="text-right px-3 py-2 font-medium">Shipping Income</th>
                <th className="text-right px-3 py-2 font-medium">Shipping Expense</th>
                <th className="text-right px-3 py-2 font-medium">Courier Payable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.journal_entry_id}
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                >
                  <td className="px-3 py-2 text-gray-300">{fmtDate(row.date)}</td>
                  <td className="px-3 py-2 font-mono text-indigo-300 text-[10px]">{row.entry_no}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Truck size={11} className="text-gray-500" />
                      <span className="text-white">{row.courier_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-green-400">
                    {row.shipping_income > 0 ? fmt(row.shipping_income) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-orange-400">
                    {row.shipping_expense > 0 ? fmt(row.shipping_expense) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400">
                    {row.courier_payable > 0 ? fmt(row.courier_payable) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-white/5 border-t border-white/10 font-semibold text-white">
                <td colSpan={3} className="px-3 py-2 text-gray-400">Totals</td>
                <td className="px-3 py-2 text-right text-green-400">{fmt(totalIncome)}</td>
                <td className="px-3 py-2 text-right text-orange-400">{fmt(totalExpense)}</td>
                <td className="px-3 py-2 text-right text-red-400">{fmt(totalPayable)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, color, icon,
}: {
  label: string;
  value: number;
  color: 'green' | 'orange' | 'red' | 'indigo';
  icon: React.ReactNode;
}) {
  const colorMap = {
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-1.5 mb-1 opacity-70">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-base font-bold">
        {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(value)}
      </p>
    </div>
  );
}
