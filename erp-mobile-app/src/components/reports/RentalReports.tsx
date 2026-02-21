import { useState, useEffect } from 'react';
import { ArrowLeft, Shirt, Search, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import * as rentalsApi from '../../api/rentals';

interface RentalReportsProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

export function RentalReports({ onBack, user: _user, companyId, branchId }: RentalReportsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [rentals, setRentals] = useState<{ id: string; no: string; customer: string; pickup: string; return: string; status: string; total: number; paid: number; due: number }[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId) {
      setRentals([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    rentalsApi.getRentals(companyId, branchId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setRentals(error ? [] : data || []);
    });
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const filtered = rentals.filter(
    (r) =>
      r.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.no.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalDue = filtered.reduce((s, r) => s + r.due, 0);
  const totalRevenue = filtered.reduce((s, r) => s + r.paid, 0);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-base text-white">Rental Reports</h1>
            <p className="text-xs text-[#9CA3AF]">Bookings & returns</p>
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
            placeholder="Search by customer or booking no..."
            className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <span className="text-sm text-[#9CA3AF]">Total Rentals</span>
            <p className="text-xl font-bold text-white">{filtered.length}</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <span className="text-sm text-[#9CA3AF]">Outstanding</span>
            <p className="text-xl font-bold text-[#F59E0B]">Rs. {totalDue.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <span className="text-sm text-[#9CA3AF]">Collected</span>
          <p className="text-xl font-bold text-[#10B981]">Rs. {totalRevenue.toLocaleString()}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <div key={r.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">{r.no}</p>
                    <p className="text-sm text-[#9CA3AF]">{r.customer}</p>
                    <p className="text-xs text-[#6B7280]">{r.pickup} → {r.return}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#8B5CF6]">Rs. {r.total.toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${r.due > 0 ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#10B981]/20 text-[#10B981]'}`}>
                      {r.due > 0 ? `Due: Rs. ${r.due.toLocaleString()}` : 'Paid'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <Shirt className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No rentals found</p>
          </div>
        )}
      </div>
    </div>
  );
}
