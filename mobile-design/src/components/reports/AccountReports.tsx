import { useState } from 'react';
import { ArrowLeft, Book, Calendar, Wallet, Building2, TrendingDown, TrendingUp, Search, Download, FileText } from 'lucide-react';
import { User } from '../../App';
import { DateInputField } from '../shared/DateTimePicker';

interface AccountReportsProps {
  onBack: () => void;
  user: User;
}

type AccountReportType = 'ledger' | 'daybook' | 'cash' | 'bank' | 'payables' | 'receivables';

export function AccountReports({ onBack, user }: AccountReportsProps) {
  const [selectedReport, setSelectedReport] = useState<AccountReportType | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const reportTypes = [
    {
      id: 'ledger' as AccountReportType,
      title: 'Account Ledger',
      description: 'View account-wise ledger',
      icon: '📚',
      color: 'from-[#8B5CF6] to-[#7C3AED]',
    },
    {
      id: 'daybook' as AccountReportType,
      title: 'Day Book',
      description: 'Daily transaction log',
      icon: '📅',
      color: 'from-[#3B82F6] to-[#2563EB]',
    },
    {
      id: 'cash' as AccountReportType,
      title: 'Cash Summary',
      description: 'Cash account summary',
      icon: '💵',
      color: 'from-[#10B981] to-[#059669]',
    },
    {
      id: 'bank' as AccountReportType,
      title: 'Bank Summary',
      description: 'Bank accounts summary',
      icon: '🏦',
      color: 'from-[#F59E0B] to-[#D97706]',
    },
    {
      id: 'payables' as AccountReportType,
      title: 'Payables',
      description: 'Outstanding payables',
      icon: '📤',
      color: 'from-[#EF4444] to-[#DC2626]',
    },
    {
      id: 'receivables' as AccountReportType,
      title: 'Receivables',
      description: 'Outstanding receivables',
      icon: '📥',
      color: 'from-[#EC4899] to-[#DB2777]',
    },
  ];

  // Mock accounts for ledger selection
  const accounts = [
    { id: '1', name: 'Cash Account', type: 'Asset', balance: 450000 },
    { id: '2', name: 'Bank Account - HBL', type: 'Asset', balance: 850000 },
    { id: '3', name: 'Bank Account - MCB', type: 'Asset', balance: 400000 },
    { id: '4', name: 'Sales Account', type: 'Revenue', balance: 2500000 },
    { id: '5', name: 'Purchase Account', type: 'Expense', balance: 1200000 },
    { id: '6', name: 'Rent Expense', type: 'Expense', balance: 150000 },
    { id: '7', name: 'Salary Expense', type: 'Expense', balance: 300000 },
    { id: '8', name: 'Accounts Receivable', type: 'Asset', balance: 650000 },
    { id: '9', name: 'Accounts Payable', type: 'Liability', balance: 420000 },
  ];

  const filteredAccounts = accounts.filter(acc =>
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleReportSelect = (reportId: AccountReportType) => {
    setSelectedReport(reportId);
    setSelectedAccount('');
    setSearchQuery('');
  };

  const handleGenerateReport = () => {
    console.log('Generating report:', {
      reportType: selectedReport,
      account: selectedAccount,
      dateFrom,
      dateTo,
      generatedBy: user.name,
    });
    // Here you would typically generate PDF or show report view
    alert(`Report generated for ${selectedReport}`);
  };

  // Account Selection Screen (for Ledger)
  if (selectedReport === 'ledger' && !selectedAccount) {
    return (
      <div className="min-h-screen bg-[#111827] pb-20">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSelectedReport(null)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">Select Account</h1>
              <p className="text-xs text-white/80">Choose account for ledger</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:border-white/40"
            />
          </div>
        </div>

        {/* Accounts List */}
        <div className="p-4 space-y-2">
          {filteredAccounts.length > 0 ? (
            filteredAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => setSelectedAccount(account.name)}
                className="w-full p-4 bg-[#1F2937] border border-[#374151] rounded-xl hover:border-[#8B5CF6] transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{account.name}</p>
                    <p className="text-xs text-[#9CA3AF] mt-1">{account.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#9CA3AF]">Balance</p>
                    <p className="text-sm font-bold text-white">Rs. {account.balance.toLocaleString()}</p>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
              <p className="text-sm text-[#9CA3AF]">No accounts found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Report Parameters Screen
  if (selectedReport) {
    const report = reportTypes.find(r => r.id === selectedReport);
    
    return (
      <div className="min-h-screen bg-[#111827] pb-20">
        {/* Header */}
        <div className={`bg-gradient-to-br ${report?.color} p-4 sticky top-0 z-10`}>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => {
                setSelectedReport(null);
                setSelectedAccount('');
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">{report?.title}</h1>
              <p className="text-xs text-white/80">{report?.description}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Selected Account (for ledger) */}
          {selectedReport === 'ledger' && selectedAccount && (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <p className="text-xs text-[#9CA3AF] mb-1">Selected Account</p>
              <p className="text-sm font-semibold text-white">{selectedAccount}</p>
            </div>
          )}

          {/* Date Range */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Date Range</h3>
            <div className="space-y-3">
              <DateInputField
                label="From"
                value={dateFrom}
                onChange={setDateFrom}
                pickerLabel="SELECT FROM DATE"
              />
              <DateInputField
                label="To"
                value={dateTo}
                onChange={setDateTo}
                pickerLabel="SELECT TO DATE"
              />
            </div>
          </div>

          {/* Quick Date Filters */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Quick Filters</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  const today = new Date();
                  setDateFrom(today.toISOString().split('T')[0]);
                  setDateTo(today.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-[#374151] hover:bg-[#4B5563] rounded-lg text-xs text-white transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today.setDate(today.getDate() - 7));
                  setDateFrom(weekAgo.toISOString().split('T')[0]);
                  setDateTo(new Date().toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-[#374151] hover:bg-[#4B5563] rounded-lg text-xs text-white transition-colors"
              >
                This Week
              </button>
              <button
                onClick={() => {
                  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                  setDateFrom(firstDay.toISOString().split('T')[0]);
                  setDateTo(new Date().toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-[#374151] hover:bg-[#4B5563] rounded-lg text-xs text-white transition-colors"
              >
                This Month
              </button>
            </div>
          </div>

          {/* Report Preview Info */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{report?.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white">{report?.title}</p>
                <p className="text-xs text-[#9CA3AF]">Ready to generate</p>
              </div>
            </div>
            
            <div className="space-y-2 pt-3 border-t border-[#374151]">
              <div className="flex justify-between text-xs">
                <span className="text-[#9CA3AF]">Period</span>
                <span className="text-white">{dateFrom} to {dateTo}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#9CA3AF]">Generated by</span>
                <span className="text-white">{user.name}</span>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateReport}
            className={`w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 bg-gradient-to-r ${report?.color} shadow-lg`}
          >
            <FileText size={18} />
            Generate Report
          </button>
        </div>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-[#111827] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">Account Reports</h1>
            <p className="text-xs text-white/80">View financial reports</p>
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="p-4 grid grid-cols-2 gap-4">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => handleReportSelect(report.id)}
            className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 text-left hover:border-[#6366F1] transition-all group"
          >
            <span className="text-3xl block mb-2">{report.icon}</span>
            <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-[#6366F1] transition-colors">
              {report.title}
            </h3>
            <p className="text-xs text-[#9CA3AF]">{report.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}