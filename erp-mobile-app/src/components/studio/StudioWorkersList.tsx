import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Users, Loader2 } from 'lucide-react';
import * as studioApi from '../../api/studio';

interface StudioWorkersListProps {
  companyId: string;
  onSelectWorker: (workerId: string) => void;
}

const stageTypeLabel: Record<string, string> = {
  dyer: 'Dyeing',
  stitching: 'Stitching',
  handwork: 'Handwork',
  embroidery: 'Embroidery',
  finishing: 'Finishing',
  quality_check: 'Quality',
};

function workerTypeLabel(t: string): string {
  const s = (t || '').toLowerCase();
  if (s === 'dyer' || s === 'dyeing') return 'Dyeing';
  if (s === 'hand-worker' || s === 'handwork' || s === 'helper' || s === 'embroidery') return 'Handwork';
  if (s === 'stitcher' || s === 'stitching' || s === 'tailor') return 'Stitching';
  return t || 'General';
}

export function StudioWorkersList({ companyId, onSelectWorker }: StudioWorkersListProps) {
  const [workers, setWorkers] = useState<studioApi.StudioWorkerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await studioApi.getWorkersWithStats(companyId);
    if (err) {
      setError(err);
      setWorkers([]);
    } else {
      setWorkers(data || []);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.phone.includes(q) ||
        workerTypeLabel(w.workerType).toLowerCase().includes(q),
    );
  }, [workers, search]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 text-[#EF4444] text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search worker name or phone..."
          className="w-full pl-10 pr-4 py-2.5 bg-[#1F2937] border border-[#374151] rounded-lg text-white text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 text-center text-[#9CA3AF] text-sm">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          No workers found. Add workers in Contacts.
        </div>
      ) : (
        filtered.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => onSelectWorker(w.id)}
            className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6]/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{w.name}</p>
                <p className="text-xs text-[#9CA3AF]">{w.phone || '—'}</p>
                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-[#8B5CF6]/20 text-[#C4B5FD] border border-[#8B5CF6]/30">
                  {workerTypeLabel(w.workerType)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="bg-[#111827] rounded-lg py-2 px-1">
                <p className="text-[10px] text-[#9CA3AF]">Active</p>
                <p className="text-sm font-semibold text-blue-400">{w.activeJobs}</p>
              </div>
              <div className="bg-[#111827] rounded-lg py-2 px-1">
                <p className="text-[10px] text-[#9CA3AF]">Pending</p>
                <p className="text-sm font-semibold text-amber-400">{w.pendingJobs}</p>
              </div>
              <div className="bg-[#111827] rounded-lg py-2 px-1">
                <p className="text-[10px] text-[#9CA3AF]">Done</p>
                <p className="text-sm font-semibold text-green-400">{w.completedJobs}</p>
              </div>
            </div>
            {w.pendingAmount > 0 && (
              <p className="text-xs text-orange-400 mt-2">Due balance: Rs. {w.pendingAmount.toLocaleString()}</p>
            )}
          </button>
        ))
      )}
    </div>
  );
}

export { stageTypeLabel };
