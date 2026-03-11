/**
 * Courier Reports tab: Summary, Ledger, and Shipment Ledger with filters and pagination.
 */

import React, { useState, useEffect } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import CourierLedgerPanel from '@/app/components/shipments/CourierLedgerPanel';
import ShipmentLedgerPage from '@/app/components/shipments/ShipmentLedgerPage';
import { shipmentAccountingService } from '@/app/services/shipmentAccountingService';
import { Truck, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Button } from '@/app/components/ui/button';

type SubView = 'summary' | 'ledger' | 'shipment_ledger';

export function CourierReportsTab() {
  const { companyId } = useSupabase();
  const [subView, setSubView] = useState<SubView>('summary');
  const [courierId, setCourierId] = useState<string>('');
  const [courierOptions, setCourierOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!companyId) return;
    shipmentAccountingService.getCourierBalances(companyId).then((rows) => {
      const opts = rows.map((r) => ({ id: r.courier_id ?? '', name: r.courier_name })).filter((o) => o.id);
      setCourierOptions(opts);
      setCourierId((prev) => (opts.some((o) => o.id === prev) ? prev : opts[0]?.id ?? ''));
    });
  }, [companyId]);

  if (!companyId) {
    return <div className="p-6 text-gray-500">No company selected.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Truck size={20} className="text-indigo-400" />
          Courier Reports
        </h3>
        <div className="flex items-center gap-2">
          <Select value={subView} onValueChange={(v) => setSubView(v as SubView)}>
            <SelectTrigger className="w-[200px] bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Courier Summary</SelectItem>
              <SelectItem value="ledger">Courier Ledger</SelectItem>
              <SelectItem value="shipment_ledger">Shipment Ledger</SelectItem>
            </SelectContent>
          </Select>
          {courierOptions.length > 0 && (subView === 'ledger' || subView === 'shipment_ledger') && (
            <Select value={courierId || 'all'} onValueChange={(v) => setCourierId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="All couriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All couriers</SelectItem>
                {courierOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-400">
        {subView === 'summary' && 'Courier balances: total expense, paid, and balance due per courier.'}
        {subView === 'ledger' && 'Date-wise ledger (debit, credit, balance) for courier payable accounts.'}
        {subView === 'shipment_ledger' && 'Shipment-level shipping income, expense, and courier payable.'}
        Shipment history is logged per shipment and can be viewed in Sale / Studio sale detail.
      </p>

      {subView === 'summary' && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <CourierLedgerPanel companyId={companyId} />
        </div>
      )}

      {subView === 'ledger' && (
        <CourierLedgerView companyId={companyId} courierId={courierId || undefined} />
      )}

      {subView === 'shipment_ledger' && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <ShipmentLedgerPage companyId={companyId} />
        </div>
      )}
    </div>
  );
}

function CourierLedgerView({ companyId, courierId }: { companyId: string; courierId?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  function load() {
    setLoading(true);
    shipmentAccountingService
      .getCourierLedger(companyId, courierId, { limit: pageSize, offset: page * pageSize })
      .then(setRows)
      .finally(() => setLoading(false));
  }

  useEffect(load, [companyId, courierId, page]);

  const fmt = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-sm text-gray-400">Courier Ledger (date, description, debit, credit, balance)</span>
        <Button variant="ghost" size="sm" className="text-gray-400" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>
      {loading && rows.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No ledger entries.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr className="text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Courier</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-3 py-2 text-gray-300">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2 text-white">{r.courier_name}</td>
                    <td className="px-3 py-2 text-gray-400 max-w-[200px] truncate">{r.description}</td>
                    <td className="px-3 py-2 text-right text-orange-400">{r.debit > 0 ? fmt(r.debit) : '—'}</td>
                    <td className="px-3 py-2 text-right text-green-400">{r.credit > 0 ? fmt(r.credit) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-white">{fmt(r.balance ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-gray-500 text-xs">Page {page + 1}</span>
            <Button variant="ghost" size="sm" disabled={rows.length < pageSize} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
