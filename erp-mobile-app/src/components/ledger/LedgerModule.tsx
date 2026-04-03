import { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Loader2, ChevronRight } from 'lucide-react';
import type { User } from '../../types';
import * as ledgerApi from '../../api/customerLedger';

interface LedgerModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId?: string | null;
}

type View = 'customers' | 'detail';

export function LedgerModule({ onBack, user: _user, companyId, branchId }: LedgerModuleProps) {
  const [customers, setCustomers] = useState<ledgerApi.CustomerWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('customers');
  const [selectedCustomer, setSelectedCustomer] = useState<ledgerApi.CustomerWithBalance | null>(null);
  const [transactions, setTransactions] = useState<ledgerApi.LedgerTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    ledgerApi.getCustomersWithBalance(companyId, branchId).then(({ data, error: err }) => {
      setLoading(false);
      if (err) setError(err);
      else setCustomers(data || []);
    });
  }, [companyId, branchId]);

  const openCustomer = (c: ledgerApi.CustomerWithBalance) => {
    setSelectedCustomer(c);
    setView('detail');
    setTxLoading(true);
    if (!companyId) return;
    Promise.all([
      ledgerApi.getCustomerReceivableBalance(companyId, c.id, branchId),
      ledgerApi.getCustomerLastTransactions(companyId, c.id, branchId, 60),
    ]).then(([{ data: bal, error: balErr }, { data: txs, error: txErr }]) => {
      setTxLoading(false);
      const errMsg = balErr || txErr;
      if (errMsg) setError(errMsg);
      else setError(null);
      setSelectedCustomer((prev) => {
        if (!prev || prev.id !== c.id) return prev;
        if (balErr) return { ...prev };
        return { ...prev, balance: bal ?? prev.balance };
      });
      setTransactions(txs || []);
    });
  };

  if (view === 'detail' && selectedCustomer) {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button type="button" onClick={() => { setView('customers'); setSelectedCustomer(null); }} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <BookOpen className="w-6 h-6 text-[#10B981]" />
            <h1 className="text-white font-semibold text-base truncate">{selectedCustomer.name}</h1>
          </div>
        </div>
        <div className="p-4">
          <div className="mb-4 rounded-xl bg-[#1F2937] border border-[#374151] p-4">
            <p className="text-sm text-[#9CA3AF]">Balance (due)</p>
            <p className={`text-xl font-bold ${selectedCustomer.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
              Rs. {Math.abs(selectedCustomer.balance).toLocaleString()}
              {selectedCustomer.balance > 0 ? ' (Due)' : selectedCustomer.balance < 0 ? ' (Credit)' : ''}
            </p>
          </div>
          <p className="text-sm text-[#9CA3AF] mb-2">Last transactions</p>
          {txLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
            </div>
          ) : (
            <ul className="space-y-2">
              {transactions.map((tx) => (
                <li key={tx.id} className="bg-[#1F2937] border border-[#374151] rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-white">{tx.reference}</p>
                    <p className="text-xs text-[#9CA3AF]">{tx.date ? new Date(tx.date).toLocaleDateString() : ''}</p>
                  </div>
                  <p className={tx.amount >= 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}>
                    {tx.amount >= 0 ? '+' : ''}Rs. {tx.amount.toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {!txLoading && transactions.length === 0 && (
            <p className="text-[#9CA3AF] text-sm py-4">No transactions.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button type="button" onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <BookOpen className="w-6 h-6 text-[#10B981]" />
          <h1 className="text-white font-semibold text-base">Customer Ledger</h1>
        </div>
      </div>
      <div className="p-4">
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        <p className="text-sm text-[#9CA3AF] mb-4">Read-only. Tap a customer to see balance and last transactions.</p>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : (
          <ul className="space-y-2">
            {customers.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openCustomer(c)}
                  className="w-full bg-[#1F2937] border border-[#374151] rounded-lg p-3 flex justify-between items-center text-left"
                >
                  <div>
                    <p className="font-medium text-white">{c.name}</p>
                    {c.phone ? <p className="text-xs text-[#9CA3AF]">{c.phone}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={c.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}>
                      Rs. {Math.abs(c.balance).toLocaleString()}
                    </span>
                    <ChevronRight className="w-5 h-5 text-[#6B7280]" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!loading && customers.length === 0 && (
          <p className="text-[#9CA3AF] text-sm py-4">No customers with balance.</p>
        )}
      </div>
    </div>
  );
}
