import { useState } from 'react';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, BarChart3, FileText, Search } from 'lucide-react';
import type { User, Branch } from '../../types';

interface AccountingModuleProps {
  onBack: () => void;
  user: User;
  companyId?: string | null;
  branch?: Branch | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  debitBalance: number;
  creditBalance: number;
  currentBalance: number;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: Date;
  description: string;
  totalDebit: number;
  totalCredit: number;
  referenceType: string;
  referenceNumber: string;
  status: 'posted' | 'void';
}

export function AccountingModule({ onBack }: AccountingModuleProps) {
  const [view, setView] = useState<'dashboard' | 'accounts' | 'journal' | 'reports'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock accounts data
  const [accounts] = useState<Account[]>([
    { id: '1', code: '1111', name: 'Main Cash Counter', type: 'asset', debitBalance: 125000, creditBalance: 0, currentBalance: 125000 },
    { id: '2', code: '1112', name: 'Shop Till', type: 'asset', debitBalance: 45000, creditBalance: 0, currentBalance: 45000 },
    { id: '3', code: '1121', name: 'Meezan Bank - Main', type: 'asset', debitBalance: 250000, creditBalance: 0, currentBalance: 250000 },
    { id: '4', code: '1131', name: 'JazzCash Wallet', type: 'asset', debitBalance: 15000, creditBalance: 0, currentBalance: 15000 },
    { id: '5', code: '1140', name: 'Accounts Receivable', type: 'asset', debitBalance: 85000, creditBalance: 0, currentBalance: 85000 },
    { id: '6', code: '1150', name: 'Inventory', type: 'asset', debitBalance: 450000, creditBalance: 0, currentBalance: 450000 },
    { id: '7', code: '2110', name: 'Accounts Payable', type: 'liability', debitBalance: 0, creditBalance: 120000, currentBalance: -120000 },
    { id: '8', code: '2120', name: 'Security Deposits Liability', type: 'liability', debitBalance: 0, creditBalance: 35000, currentBalance: -35000 },
    { id: '9', code: '3100', name: "Owner's Capital", type: 'equity', debitBalance: 0, creditBalance: 500000, currentBalance: -500000 },
    { id: '10', code: '4100', name: 'Sales Revenue', type: 'revenue', debitBalance: 0, creditBalance: 675000, currentBalance: -675000 },
    { id: '11', code: '4200', name: 'Rental Revenue', type: 'revenue', debitBalance: 0, creditBalance: 45000, currentBalance: -45000 },
    { id: '12', code: '5100', name: 'Cost of Goods Sold', type: 'expense', debitBalance: 380000, creditBalance: 0, currentBalance: 380000 },
    { id: '13', code: '5300', name: 'Rent Expense', type: 'expense', debitBalance: 50000, creditBalance: 0, currentBalance: 50000 },
    { id: '14', code: '5400', name: 'Utilities Expense', type: 'expense', debitBalance: 12500, creditBalance: 0, currentBalance: 12500 },
  ]);

  // Mock journal entries
  const [journalEntries] = useState<JournalEntry[]>([
    {
      id: '1',
      entryNumber: 'JE-0001',
      date: new Date('2026-01-15'),
      description: 'Sale to customer - INV-0023',
      totalDebit: 45500,
      totalCredit: 45500,
      referenceType: 'Sale',
      referenceNumber: 'INV-0023',
      status: 'posted',
    },
    {
      id: '2',
      entryNumber: 'JE-0002',
      date: new Date('2026-01-14'),
      description: 'Purchase from supplier - PO-0001',
      totalDebit: 60000,
      totalCredit: 60000,
      referenceType: 'Purchase',
      referenceNumber: 'PO-0001',
      status: 'posted',
    },
    {
      id: '3',
      entryNumber: 'JE-0003',
      date: new Date('2026-01-13'),
      description: 'Rental booking received - RNT-0002',
      totalDebit: 23000,
      totalCredit: 23000,
      referenceType: 'Rental',
      referenceNumber: 'RNT-0002',
      status: 'posted',
    },
    {
      id: '4',
      entryNumber: 'JE-0004',
      date: new Date('2026-01-12'),
      description: 'Rent expense payment',
      totalDebit: 50000,
      totalCredit: 50000,
      referenceType: 'Expense',
      referenceNumber: 'EXP-0001',
      status: 'posted',
    },
  ]);

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'asset':
        return 'text-[#3B82F6] bg-[#3B82F6]/10';
      case 'liability':
        return 'text-[#EF4444] bg-[#EF4444]/10';
      case 'equity':
        return 'text-[#8B5CF6] bg-[#8B5CF6]/10';
      case 'revenue':
        return 'text-[#10B981] bg-[#10B981]/10';
      case 'expense':
        return 'text-[#F59E0B] bg-[#F59E0B]/10';
      default:
        return 'text-[#9CA3AF] bg-[#9CA3AF]/10';
    }
  };

  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.code.includes(searchQuery)
  );

  const totalAssets = accounts
    .filter(a => a.type === 'asset')
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const totalLiabilities = Math.abs(
    accounts
      .filter(a => a.type === 'liability')
      .reduce((sum, a) => sum + a.currentBalance, 0)
  );

  const totalRevenue = Math.abs(
    accounts
      .filter(a => a.type === 'revenue')
      .reduce((sum, a) => sum + a.currentBalance, 0)
  );

  const totalExpenses = accounts
    .filter(a => a.type === 'expense')
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const netProfit = totalRevenue - totalExpenses;

  if (view === 'accounts') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        {/* Header */}
        <div className="bg-[#1F2937] border-b border-[#374151] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setView('dashboard')}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">Chart of Accounts</h1>
              <p className="text-xs text-[#9CA3AF]">{accounts.length} accounts</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search accounts..."
              className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
        </div>

        {/* Accounts List */}
        <div className="p-4 space-y-2">
          {filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="bg-[#1F2937] border border-[#374151] rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#9CA3AF]">{account.code}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getAccountTypeColor(account.type)}`}>
                      {account.type}
                    </span>
                  </div>
                  <h3 className="font-medium mt-1 text-white">{account.name}</h3>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#F59E0B]">
                    Rs. {Math.abs(account.currentBalance).toLocaleString()}
                  </p>
                  <p className="text-xs text-[#9CA3AF]">
                    {account.currentBalance >= 0 ? 'Debit' : 'Credit'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'journal') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        {/* Header */}
        <div className="bg-[#1F2937] border-b border-[#374151] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('dashboard')}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">Journal Entries</h1>
              <p className="text-xs text-[#9CA3AF]">All transactions</p>
            </div>
          </div>
        </div>

        {/* Journal List */}
        <div className="p-4 space-y-3">
          {journalEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-[#1F2937] border border-[#374151] rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-medium text-white">{entry.entryNumber}</h3>
                  <p className="text-xs text-[#9CA3AF]">
                    {entry.date.toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium text-[#10B981] bg-[#10B981]/10">
                  {entry.status}
                </span>
              </div>

              <p className="text-sm mb-3 text-[#D1D5DB]">{entry.description}</p>

              <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mb-3">
                <span className="px-2 py-1 bg-[#111827] rounded">
                  {entry.referenceType}
                </span>
                <span>{entry.referenceNumber}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-[#9CA3AF]">Debit: </span>
                  <span className="text-[#EF4444]">Rs. {entry.totalDebit.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[#9CA3AF]">Credit: </span>
                  <span className="text-[#10B981]">Rs. {entry.totalCredit.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'reports') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        {/* Header */}
        <div className="bg-[#1F2937] border-b border-[#374151] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('dashboard')}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">Financial Reports</h1>
              <p className="text-xs text-[#9CA3AF]">View reports</p>
            </div>
          </div>
        </div>

        {/* Reports Menu */}
        <div className="p-4 space-y-3">
          {[
            { name: 'Balance Sheet', desc: 'Assets, Liabilities & Equity', icon: BarChart3 },
            { name: 'Profit & Loss', desc: 'Revenue & Expenses', icon: TrendingUp },
            { name: 'Trial Balance', desc: 'All account balances', icon: FileText },
            { name: 'Cash Flow Statement', desc: 'Cash movements', icon: DollarSign },
          ].map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.name}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#F59E0B] transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#F59E0B]" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{report.name}</h3>
                    <p className="text-xs text-[#9CA3AF]">{report.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Dashboard View
  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Accounting</h1>
            <p className="text-xs text-white/80">Financial overview</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-[#3B82F6]/10 to-[#3B82F6]/5 border border-[#3B82F6]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-xs text-[#9CA3AF]">Total Assets</span>
          </div>
          <p className="text-xl font-bold text-[#3B82F6]">
            Rs. {totalAssets.toLocaleString()}
          </p>
        </div>

        <div className="bg-gradient-to-br from-[#EF4444]/10 to-[#EF4444]/5 border border-[#EF4444]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-[#EF4444]" />
            <span className="text-xs text-[#9CA3AF]">Total Liabilities</span>
          </div>
          <p className="text-xl font-bold text-[#EF4444]">
            Rs. {totalLiabilities.toLocaleString()}
          </p>
        </div>

        <div className="bg-gradient-to-br from-[#10B981]/10 to-[#10B981]/5 border border-[#10B981]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[#10B981]" />
            <span className="text-xs text-[#9CA3AF]">Total Revenue</span>
          </div>
          <p className="text-xl font-bold text-[#10B981]">
            Rs. {totalRevenue.toLocaleString()}
          </p>
        </div>

        <div className="bg-gradient-to-br from-[#F59E0B]/10 to-[#F59E0B]/5 border border-[#F59E0B]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-xs text-[#9CA3AF]">Total Expenses</span>
          </div>
          <p className="text-xl font-bold text-[#F59E0B]">
            Rs. {totalExpenses.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Net Profit */}
      <div className="px-4 mb-4">
        <div className={`p-6 rounded-2xl ${
          netProfit >= 0
            ? 'bg-gradient-to-br from-[#10B981]/20 to-[#059669]/20 border border-[#10B981]/30'
            : 'bg-gradient-to-br from-[#EF4444]/20 to-[#DC2626]/20 border border-[#EF4444]/30'
        }`}>
          <p className="text-sm text-[#9CA3AF] mb-2">Net Profit (Current Period)</p>
          <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            Rs. {Math.abs(netProfit).toLocaleString()}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            {netProfit >= 0 ? '↑ Profit' : '↓ Loss'}
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-medium text-[#9CA3AF] mb-2">QUICK ACCESS</h3>

        <button
          onClick={() => setView('accounts')}
          className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#F59E0B] transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3B82F6]/10 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div>
              <h3 className="font-medium text-white">Chart of Accounts</h3>
              <p className="text-xs text-[#9CA3AF]">{accounts.length} accounts</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setView('journal')}
          className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#F59E0B] transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <h3 className="font-medium text-white">Journal Entries</h3>
              <p className="text-xs text-[#9CA3AF]">{journalEntries.length} entries</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setView('reports')}
          className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#F59E0B] transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <h3 className="font-medium text-white">Financial Reports</h3>
              <p className="text-xs text-[#9CA3AF]">View all reports</p>
            </div>
          </div>
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-xl p-4">
          <p className="text-xs text-[#9CA3AF]">
            ℹ️ All transactions are automatically posted to accounting. Manual journal entries are restricted on mobile for security.
          </p>
        </div>
      </div>
    </div>
  );
}
