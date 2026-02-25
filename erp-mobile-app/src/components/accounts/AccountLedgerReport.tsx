import { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import * as accountsApi from '../../api/accounts';
import { DateRangeSelector } from '../reports/DateRangeSelector';

interface AccountLedgerReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId: string | null;
}

const formatDate = (d: Date) => d.toISOString().split('T')[0];

export function AccountLedgerReport({ onBack, companyId, branchId: _branchId }: AccountLedgerReportProps) {
  const today = formatDate(new Date());
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [accounts, setAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<accountsApi.AccountRow | null>(null);
  const [lines, setLines] = useState<accountsApi.AccountLedgerLine[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(!!companyId);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setAccounts([]);
      setAccountsLoading(false);
      return;
    }
    let cancelled = false;
    setAccountsLoading(true);
    accountsApi.getAccounts(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setAccountsLoading(false);
      setAccounts(error ? [] : data || []);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  useEffect(() => {
    if (!companyId || !selectedAccount) {
      setLines([]);
      setLedgerLoading(false);
      return;
    }
    let cancelled = false;
    setLedgerLoading(true);
    accountsApi.getAccountLedger(companyId, selectedAccount.id, dateFrom, dateTo).then(({ data, error }) => {
      if (cancelled) return;
      setLedgerLoading(false);
      setLines(error ? [] : data || []);
    });
    return () => { cancelled = true; };
  }, [companyId, selectedAccount?.id, dateFrom, dateTo]);

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const closingBalance = lines.length ? lines[lines.length - 1].running_balance : 0;

  if (!selectedAccount) {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">Account Ledger</h1>
              <p className="text-xs text-white/80">Select an account</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          {accountsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAccount(a)}
                  className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 text-left hover:border-[#6366F1] transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-white">{a.name}</p>
                      <p className="text-sm text-[#9CA3AF]">{a.code} · {a.type}</p>
                    </div>
                    <p className={`font-semibold ${a.balance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      Rs. {a.balance.toLocaleString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!accountsLoading && accounts.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
              <p className="text-[#9CA3AF]">No accounts found</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedAccount(null)}
            className="p-2 hover:bg-white/10 rounded-lg text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white truncate">{selectedAccount.name}</h1>
            <p className="text-xs text-white/80">{selectedAccount.code} · {dateFrom} to {dateTo}</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <DateRangeSelector dateFrom={dateFrom} dateTo={dateTo} onDateChange={handleDateChange} />
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm text-[#9CA3AF]">Closing balance</span>
          <span className={`font-bold ${closingBalance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            Rs. {closingBalance.toLocaleString()}
          </span>
        </div>
        {ledgerLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
          </div>
        ) : (
          <div className="w-full max-w-full overflow-x-auto -mx-4 mobile-table-scroll">
            <div className="min-w-[640px] px-4 mobile-table-inner">
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
                <div className="grid grid-cols-[80px_72px_1fr_80px_80px_100px] gap-2 px-3 py-2.5 bg-[#374151]/50 text-[#9CA3AF] text-xs font-medium">
                  <span>Date</span>
                  <span>Voucher</span>
                  <span>Description</span>
                  <span className="text-right">Debit</span>
                  <span className="text-right">Credit</span>
                  <span className="text-right">Balance</span>
                </div>
                {lines.map((l, i) => (
                  <div
                    key={l.id + i}
                    className={`grid grid-cols-[80px_72px_1fr_80px_80px_100px] gap-2 px-3 py-2.5 border-t border-[#374151] text-sm ${
                      i % 2 === 0 ? 'bg-[#111827]' : 'bg-[#1F2937]/80'
                    }`}
                  >
                    <span className="text-white text-xs">{l.date}</span>
                    <span className="text-white font-mono text-xs truncate">{l.entry_no}</span>
                    <p className="text-white text-xs truncate min-w-0">{l.description}</p>
                    <span className="text-[#10B981] text-xs text-right font-mono">
                      {l.debit > 0 ? l.debit.toLocaleString() : '—'}
                    </span>
                    <span className="text-[#EF4444] text-xs text-right font-mono">
                      {l.credit > 0 ? l.credit.toLocaleString() : '—'}
                    </span>
                    <span className={`text-xs text-right font-mono ${l.running_balance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {l.running_balance.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-[80px_72px_1fr_80px_80px_100px] gap-2 px-3 py-3 border-t border-[#374151] bg-[#374151]/30 font-semibold text-white text-sm">
                  <span className="col-span-3">Totals</span>
                  <span className="text-[#10B981] text-right">Rs. {totalDebit.toLocaleString()}</span>
                  <span className="text-[#EF4444] text-right">Rs. {totalCredit.toLocaleString()}</span>
                  <span className="text-right">Rs. {closingBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {!ledgerLoading && lines.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No ledger entries in this period</p>
          </div>
        )}
      </div>
    </div>
  );
}
