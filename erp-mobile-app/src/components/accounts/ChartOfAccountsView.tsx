import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, BookOpen, Loader2 } from 'lucide-react';
import * as accountsApi from '../../api/accounts';

interface ChartOfAccountsViewProps {
  onBack: () => void;
  onAddAccount: () => void;
  companyId: string | null;
}

export function ChartOfAccountsView({ onBack, onAddAccount, companyId }: ChartOfAccountsViewProps) {
  const [accounts, setAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  const load = () => {
    if (!companyId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    accountsApi.getAccounts(companyId).then(({ data, error }) => {
      setLoading(false);
      setAccounts(error ? [] : data);
    });
  };

  useEffect(load, [companyId]);

  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Chart of Accounts</h1>
            <p className="text-xs text-white/80">Manage accounts (same as Web ERP)</p>
          </div>
          <button
            onClick={onAddAccount}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
            <BookOpen className="w-12 h-12 text-[#6B7280] mx-auto mb-3" />
            <p className="text-[#9CA3AF] mb-4">No accounts yet. Add your first account.</p>
            <button
              onClick={onAddAccount}
              className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-lg font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F59E0B]/20 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-[#F59E0B]" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{acc.name}</p>
                    <p className="text-xs text-[#9CA3AF]">
                      {acc.code || '—'} · {acc.type}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-white">Rs. {(acc.balance || 0).toLocaleString()}</p>
              </div>
            ))}
            <button
              onClick={onAddAccount}
              className="w-full py-3 border border-dashed border-[#374151] rounded-xl text-[#9CA3AF] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
