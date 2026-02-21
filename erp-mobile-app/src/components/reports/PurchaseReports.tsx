import { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingBag, Search, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import * as reportsApi from '../../api/reports';

interface PurchaseReportsProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

export function PurchaseReports({ onBack, user: _user, companyId, branchId }: PurchaseReportsProps) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [purchases, setPurchases] = useState<{ id: string; poNo: string; supplier: string; total: number; date: string; paymentStatus: string }[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId || !dateFrom || !dateTo) {
      setPurchases([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    reportsApi.getPurchasesForReport(companyId, branchId, dateFrom, dateTo).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setPurchases(error ? [] : data);
    });
    return () => { cancelled = true; };
  }, [companyId, branchId, dateFrom, dateTo]);

  const filtered = purchases.filter(
    (p) =>
      p.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.poNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totals = {
    total: filtered.reduce((sum, p) => sum + p.total, 0),
    count: filtered.length,
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-base text-white">Purchase Reports</h1>
            <p className="text-xs text-[#9CA3AF]">{dateFrom} to {dateTo}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9CA3AF] mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg px-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9CA3AF] mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg px-3 text-sm text-white"
            />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by supplier or PO..."
            className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#10B981]"
          />
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-[#9CA3AF]">Total Purchases</span>
            <span className="text-xl font-bold text-[#10B981]">Rs. {totals.total.toLocaleString()}</span>
          </div>
          <p className="text-xs text-[#6B7280]">{totals.count} records</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div key={p.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">{p.poNo}</p>
                    <p className="text-sm text-[#9CA3AF]">{p.supplier}</p>
                    <p className="text-xs text-[#6B7280]">{p.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#10B981]">Rs. {p.total.toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${p.paymentStatus === 'paid' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#F59E0B]/20 text-[#F59E0B]'}`}>
                      {p.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No purchases in this period</p>
          </div>
        )}
      </div>
    </div>
  );
}
