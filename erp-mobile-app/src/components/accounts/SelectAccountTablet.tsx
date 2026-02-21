import { useState } from 'react';
import { ArrowLeft, Search, Plus, X, Wallet } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  code: string;
}

interface SelectAccountTabletProps {
  onBack: () => void;
  onSelect: (account: Account) => void;
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  title?: string;
  subtitle?: string;
}

export function SelectAccountTablet({
  onBack,
  onSelect,
  accounts,
  setAccounts,
  title = 'Select Account',
  subtitle = 'Choose account for transaction',
}: SelectAccountTabletProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', type: 'Asset' });

  const filteredAccounts = accounts.filter(
    (account) =>
      account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.code.includes(searchQuery) ||
      account.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentAccounts = accounts.slice(0, 2);

  const stats = {
    total: accounts.length,
    assets: accounts.filter((a) => a.type === 'Asset').length,
    liabilities: accounts.filter((a) => a.type === 'Liability').length,
  };

  const handleAddNewAccount = () => {
    if (!newAccount.name) return;

    const account: Account = {
      id: `a${Date.now()}`,
      name: newAccount.name,
      type: newAccount.type,
      code: `ACC-${Date.now().toString().slice(-4)}`,
      balance: 0,
    };

    setAccounts([account, ...accounts]);
    setShowAddDialog(false);
    setNewAccount({ name: '', type: 'Asset' });
    onSelect(account);
  };

  const CompactAccountCard = ({ account }: { account: Account }) => {
    const getTypeColor = (type: string) => {
      switch (type) {
        case 'Asset':
          return 'text-[#10B981] bg-[#10B981]/10';
        case 'Liability':
          return 'text-[#EF4444] bg-[#EF4444]/10';
        case 'Expense':
          return 'text-[#F59E0B] bg-[#F59E0B]/10';
        case 'Revenue':
          return 'text-[#3B82F6] bg-[#3B82F6]/10';
        default:
          return 'text-[#6B7280] bg-[#6B7280]/10';
      }
    };

    return (
      <button
        onClick={() => onSelect(account)}
        className="w-full bg-[#1F2937] border border-[#374151] rounded-lg p-3 hover:border-[#F59E0B] transition-all active:scale-[0.98] text-left group"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 ${getTypeColor(account.type)} rounded-full flex items-center justify-center flex-shrink-0`}>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white text-sm truncate">{account.name}</h3>
            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
              <span>{account.code}</span>
              <span>•</span>
              <span className={getTypeColor(account.type).split(' ')[0]}>{account.type}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-medium text-[#6B7280]">Balance</p>
            <p className={`text-sm font-semibold ${account.balance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>Rs. {Math.abs(account.balance).toLocaleString()}</p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#111827]">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95 text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-white">{title}</h1>
                <p className="text-xs text-[#6B7280]">{subtitle}</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search account by name, code or type..."
              className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            {!searchQuery && recentAccounts.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">RECENT ACCOUNTS</h2>
                <div className="space-y-2">
                  {recentAccounts.map((account) => (
                    <CompactAccountCard key={account.id} account={account} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">{searchQuery ? 'SEARCH RESULTS' : 'ALL ACCOUNTS'}</h2>
              <div className="space-y-2">
                {filteredAccounts.map((account) => (
                  <CompactAccountCard key={account.id} account={account} />
                ))}
              </div>

              {filteredAccounts.length === 0 && (
                <div className="text-center py-12 bg-[#1F2937] rounded-xl border border-[#374151]">
                  <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-[#6B7280]" />
                  </div>
                  <p className="text-[#9CA3AF]">No accounts found</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAddDialog(true)}
              className="w-full py-3 border-2 border-dashed border-[#374151] rounded-lg text-[#9CA3AF] hover:border-[#F59E0B] hover:text-[#F59E0B] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium text-sm">Add New Account</span>
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-4 h-4 text-[#F59E0B]" />
                <h3 className="text-sm font-semibold text-white">Account Stats</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Total Accounts</span>
                  <span className="text-sm font-semibold text-white">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Assets</span>
                  <span className="text-sm font-semibold text-[#10B981]">{stats.assets}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Liabilities</span>
                  <span className="text-sm font-semibold text-[#EF4444]">{stats.liabilities}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Account Types</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#10B981] rounded-full"></div>
                  <span className="text-[#9CA3AF]">Asset</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#EF4444] rounded-full"></div>
                  <span className="text-[#9CA3AF]">Liability</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#F59E0B] rounded-full"></div>
                  <span className="text-[#9CA3AF]">Expense</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#3B82F6] rounded-full"></div>
                  <span className="text-[#9CA3AF]">Revenue</span>
                </div>
              </div>
            </div>

            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4">
              <div className="text-lg mb-2">💡</div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                <span className="text-white font-medium">Quick Tip:</span> Search by name, code, or account type
              </p>
            </div>
          </div>
        </div>
      </div>

      {showAddDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-[#374151] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add New Account</h2>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewAccount({ name: '', type: 'Asset' });
                }}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Account Name *</label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  placeholder="Enter account name"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Account Type *</label>
                <select
                  value={newAccount.type}
                  onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
                >
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Expense">Expense</option>
                  <option value="Revenue">Revenue</option>
                  <option value="Equity">Equity</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setNewAccount({ name: '', type: 'Asset' });
                  }}
                  className="flex-1 h-12 border border-[#374151] rounded-lg font-medium text-white hover:bg-[#374151] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewAccount}
                  disabled={!newAccount.name}
                  className="flex-1 h-12 bg-[#F59E0B] hover:bg-[#D97706] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-white transition-colors"
                >
                  Add Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
