import { useState, useEffect } from 'react';
import { ArrowLeft, Camera, Search, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import * as studioApi from '../../api/studio';

interface StudioReportsProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

export function StudioReports({ onBack, user: _user, companyId, branchId }: StudioReportsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sales, setSales] = useState<studioApi.StudioSaleRow[]>([]);
  const [productions, setProductions] = useState<studioApi.StudioProductionRow[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId) {
      setSales([]);
      setProductions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      studioApi.getStudioSales(companyId, branchId),
      studioApi.getStudioProductions(companyId, branchId),
    ]).then(([salesRes, prodRes]) => {
      if (cancelled) return;
      setLoading(false);
      setSales(salesRes.data || []);
      setProductions(prodRes.data || []);
    });
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const filteredSales = sales.filter(
    (s) =>
      s.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalRevenue = filteredSales.reduce((s, x) => s + x.paid, 0);
  const totalDue = filteredSales.reduce((s, x) => s + x.due, 0);
  const inProgress = productions.filter((p) => (p.status as string) === 'in_progress' || (p.status as string) === 'in-progress').length;
  const completed = productions.filter((p) => (p.status as string) === 'completed').length;

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-base text-white">Studio Reports</h1>
            <p className="text-xs text-[#9CA3AF]">Sales & productions</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer or invoice..."
            className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EC4899]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <span className="text-sm text-[#9CA3AF]">Studio Sales</span>
            <p className="text-xl font-bold text-white">{filteredSales.length}</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <span className="text-sm text-[#9CA3AF]">Productions</span>
            <p className="text-xl font-bold text-[#EC4899]">{productions.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <span className="text-sm text-[#9CA3AF]">Collected</span>
            <p className="text-xl font-bold text-[#10B981]">Rs. {totalRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <span className="text-sm text-[#9CA3AF]">Outstanding</span>
            <p className="text-xl font-bold text-[#F59E0B]">Rs. {totalDue.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <span className="text-sm text-[#9CA3AF]">In Progress</span>
            <p className="text-xl font-bold text-[#3B82F6]">{inProgress}</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <span className="text-sm text-[#9CA3AF]">Completed</span>
            <p className="text-xl font-bold text-[#10B981]">{completed}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#EC4899] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[#9CA3AF]">Studio Sales</h3>
            {filteredSales.map((s) => (
              <div key={s.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">{s.invoiceNo}</p>
                    <p className="text-sm text-[#9CA3AF]">{s.customer}</p>
                    <p className="text-xs text-[#6B7280]">{s.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#EC4899]">Rs. {s.total.toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${s.due > 0 ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#10B981]/20 text-[#10B981]'}`}>
                      {s.due > 0 ? `Due: Rs. ${s.due.toLocaleString()}` : 'Paid'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredSales.length === 0 && (
          <div className="text-center py-12">
            <Camera className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No studio sales found</p>
          </div>
        )}
      </div>
    </div>
  );
}
