import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Search, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import * as accountsApi from '../../api/accounts';

interface WorkerReportsProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
}

export function WorkerReports({ onBack, user: _user, companyId }: WorkerReportsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [workers, setWorkers] = useState<accountsApi.WorkerWithPayable[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId) {
      setWorkers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    accountsApi.getWorkersWithPayable(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setWorkers(error ? [] : data || []);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const filtered = workers.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPayable = filtered.reduce((s, w) => s + w.totalPayable, 0);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-base text-white">Worker Ledger</h1>
            <p className="text-xs text-[#9CA3AF]">Outstanding balances</p>
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
            placeholder="Search by name or phone..."
            className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#6366F1]"
          />
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <span className="text-sm text-[#9CA3AF]">Total Outstanding</span>
          <p className="text-xl font-bold text-[#F59E0B]">Rs. {totalPayable.toLocaleString()}</p>
          <p className="text-xs text-[#6B7280]">{filtered.length} workers</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((w) => (
              <div key={w.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">{w.name}</p>
                    <p className="text-sm text-[#9CA3AF]">{w.phone || '—'}</p>
                    {w.weeklyRate != null && (
                      <p className="text-xs text-[#6B7280]">Rate: Rs. {w.weeklyRate.toLocaleString()}/wk</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${w.totalPayable > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                      Rs. {w.totalPayable.toLocaleString()}
                    </p>
                    <span className="text-xs text-[#6B7280]">{w.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No workers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
