import { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Search, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import * as accountsApi from '../../api/accounts';

interface AccountReportsProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId: string | null;
}

export function AccountReports({ onBack, user: _user, companyId, branchId }: AccountReportsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [accounts, setAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [entries, setEntries] = useState<accountsApi.JournalEntryRow[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId) {
      setAccounts([]);
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      accountsApi.getAccounts(companyId),
      accountsApi.getJournalEntries(companyId, branchId),
    ]).then(([accRes, entRes]) => {
      if (cancelled) return;
      setLoading(false);
      setAccounts(accRes.data || []);
      setEntries(entRes.data || []);
    });
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const filteredAccounts = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.code.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalBalance = filteredAccounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-base text-white">Account Reports</h1>
            <p className="text-xs text-[#9CA3AF]">Chart of accounts & journal</p>
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
            placeholder="Search by account name or code..."
            className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#FF9900]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <span className="text-sm text-[#9CA3AF]">Accounts</span>
            <p className="text-xl font-bold text-white">{filteredAccounts.length}</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <span className="text-sm text-[#9CA3AF]">Journal Entries</span>
            <p className="text-xl font-bold text-[#FF9900]">{entries.length}</p>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <span className="text-sm text-[#9CA3AF]">Total Balance (filtered)</span>
          <p className="text-xl font-bold text-[#F59E0B]">Rs. {totalBalance.toLocaleString()}</p>
        </div>

        <h3 className="text-sm font-medium text-[#9CA3AF]">Chart of Accounts</h3>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#FF9900] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAccounts.map((a) => (
              <div key={a.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">{a.name}</p>
                    <p className="text-sm text-[#9CA3AF]">{a.code} · {a.type}</p>
                  </div>
                  <p className={`font-semibold ${a.balance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    Rs. {a.balance.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 className="text-sm font-medium text-[#9CA3AF]">Recent Journal Entries</h3>
        {!loading && (
          <div className="space-y-2">
            {entries.slice(0, 20).map((e) => (
              <div key={e.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">{e.entry_no}</p>
                    <p className="text-sm text-[#9CA3AF]">{e.description}</p>
                    <p className="text-xs text-[#6B7280]">{e.entry_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[#9CA3AF]">Dr: Rs. {e.total_debit.toLocaleString()}</p>
                    <p className="text-sm text-[#9CA3AF]">Cr: Rs. {e.total_credit.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredAccounts.length === 0 && entries.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No accounts or entries</p>
          </div>
        )}
      </div>
    </div>
  );
}
