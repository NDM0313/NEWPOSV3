import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Users, Search, Loader2, ChevronRight, FileText } from 'lucide-react';
import type { User } from '../../types';
import * as accountsApi from '../../api/accounts';

interface WorkerReportsProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function WorkerReports({ onBack, user: _user, companyId }: WorkerReportsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [workers, setWorkers] = useState<accountsApi.WorkerWithPayable[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [selectedWorker, setSelectedWorker] = useState<accountsApi.WorkerWithPayable | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<accountsApi.WorkerLedgerEntryRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

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

  const loadLedger = useCallback(() => {
    if (!companyId || !selectedWorker) return;
    setLedgerLoading(true);
    accountsApi.getWorkerLedgerEntries(companyId, selectedWorker.id).then(({ data, error }) => {
      setLedgerLoading(false);
      setLedgerEntries(error ? [] : data || []);
    });
  }, [companyId, selectedWorker]);

  useEffect(() => {
    if (selectedWorker) loadLedger();
  }, [selectedWorker, loadLedger]);

  const filtered = workers.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPayable = filtered.reduce((s, w) => s + w.totalPayable, 0);

  if (selectedWorker) {
    const unpaidTotal = ledgerEntries.filter((e) => e.status !== 'paid').reduce((s, e) => s + e.amount, 0);
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setSelectedWorker(null)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-base text-white truncate">{selectedWorker.name}</h1>
              <p className="text-xs text-[#9CA3AF]">Ledger detail</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Total Outstanding</p>
            <p className="text-xl font-bold text-[#F59E0B]">Rs. {(selectedWorker.totalPayable ?? unpaidTotal).toLocaleString()}</p>
            <p className="text-sm text-[#9CA3AF] mt-1">{selectedWorker.phone || '—'}</p>
            <p className="text-xs text-[#6B7280] capitalize">{selectedWorker.type.replace('-', ' ')}</p>
          </div>

          <h2 className="text-sm font-medium text-[#9CA3AF] flex items-center gap-2">
            <FileText size={16} />
            Ledger entries
          </h2>

          {ledgerLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 text-center">
              <p className="text-[#9CA3AF] text-sm">No ledger entries yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ledgerEntries.map((e) => (
                <div key={e.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-white">Rs. {e.amount.toLocaleString()}</p>
                    <p className="text-xs text-[#9CA3AF]">
                      {e.reference_type || '—'} {e.reference_id ? `#${e.reference_id.slice(0, 8)}` : ''}
                    </p>
                    <p className="text-xs text-[#6B7280]">{formatDate(e.created_at)}</p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      e.status === 'paid' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                    }`}
                  >
                    {e.status === 'paid' ? 'Paid' : 'Payable'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-[#6B7280] text-center">
            To pay this worker, go to <strong className="text-[#9CA3AF]">Accounts → Worker Payment</strong>.
          </p>
        </div>
      </div>
    );
  }

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
              <button
                type="button"
                key={w.id}
                onClick={() => setSelectedWorker(w)}
                className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#6366F1]/50 active:bg-[#374151]/50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{w.name}</p>
                    <p className="text-sm text-[#9CA3AF]">{w.phone || '—'}</p>
                    {w.weeklyRate != null && (
                      <p className="text-xs text-[#6B7280]">Rate: Rs. {w.weeklyRate.toLocaleString()}/wk</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className={`font-semibold ${w.totalPayable > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                        Rs. {w.totalPayable.toLocaleString()}
                      </p>
                      <span className="text-xs text-[#6B7280] capitalize">{w.type.replace('-', ' ')}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#6B7280]" />
                  </div>
                </div>
              </button>
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
