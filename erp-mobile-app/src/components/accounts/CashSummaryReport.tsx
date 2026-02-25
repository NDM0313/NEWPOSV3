import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Banknote, Share2, FileDown, RefreshCw } from 'lucide-react';
import * as accountsApi from '../../api/accounts';

interface CashSummaryReportProps {
  onBack: () => void;
  companyId: string | null;
}

export function CashSummaryReport({ onBack, companyId }: CashSummaryReportProps) {
  const [accounts, setAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  const fetchAccounts = () => {
    if (!companyId) return;
    setLoading(true);
    accountsApi.getAccounts(companyId).then(({ data, error }) => {
      setLoading(false);
      const all = error ? [] : data || [];
      setAccounts(all.filter((a) => (a.type || '').toLowerCase() === 'cash'));
    });
  };

  useEffect(() => {
    if (!companyId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    accountsApi.getAccounts(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      const all = error ? [] : data || [];
      setAccounts(all.filter((a) => (a.type || '').toLowerCase() === 'cash'));
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const total = accounts.reduce((s, a) => s + a.balance, 0);

  const handleShare = () => {
    const lines = [`Cash Summary: Total Rs. ${total.toLocaleString()}`, `${accounts.length} account(s)`];
    accounts.forEach((a) => lines.push(`${a.name} (${a.code}): Rs. ${a.balance.toLocaleString()}`));
    if (navigator.share) {
      navigator.share({ title: 'Cash Summary', text: lines.join('\n') }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white">Cash Summary</h1>
            <p className="text-xs text-white/80">Cash accounts balance</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={fetchAccounts} disabled={loading} className="p-2 hover:bg-white/10 rounded-lg text-white disabled:opacity-60" title="Refresh">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleShare} className="p-2 hover:bg-white/10 rounded-lg text-white" title="Share">
              <Share2 className="w-5 h-5" />
            </button>
            <button onClick={() => window.print?.()} className="p-2 hover:bg-white/10 rounded-lg text-white" title="Export / Print">
              <FileDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 bg-[#10B981]/20 rounded-xl flex items-center justify-center">
            <Banknote className="w-8 h-8 text-[#10B981]" />
          </div>
          <div>
            <p className="text-sm text-[#9CA3AF]">Total Cash</p>
            <p className="text-2xl font-bold text-white">Rs. {total.toLocaleString()}</p>
            <p className="text-xs text-[#6B7280]">{accounts.length} account(s)</p>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-[#9CA3AF]">Cash accounts</h2>
            {accounts.map((a) => (
              <div
                key={a.id}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex justify-between items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white">{a.name}</p>
                  <p className="text-sm text-[#9CA3AF]">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-[#374151] text-[#9CA3AF] font-mono text-xs">{a.code}</span>
                  </p>
                </div>
                <p className={`font-semibold shrink-0 ml-2 ${a.balance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  Rs. {a.balance.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
        {!loading && accounts.length === 0 && (
          <div className="text-center py-12 text-[#9CA3AF]">
            <Banknote className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p>No cash accounts</p>
          </div>
        )}
      </div>
    </div>
  );
}
